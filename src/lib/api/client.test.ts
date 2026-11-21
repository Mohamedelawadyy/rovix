// @vitest-environment node
// Node environment: fetch, FormData and Blob must come from the same runtime (as in a browser).
// jsdom's FormData/Blob are not understood by Node's fetch.
import { http, HttpResponse } from 'msw/http';
import { server } from '@/test/msw/server';
import { laravel } from '@/test/msw/laravel';
import { createApiClient } from './client';
import { ApiError } from './errors';
import type { Paginated } from './types';

const API = '*/api/v1';

beforeEach(() => {
  // The relative base URL (/api/v1) is resolved against the page origin, as in the browser.
  vi.stubGlobal('location', new URL('http://localhost:3000/'));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function makeClient(overrides: Partial<Parameters<typeof createApiClient>[0]> = {}) {
  return createApiClient({
    baseUrl: '/api/v1',
    getToken: () => 'test-token',
    getLocale: () => 'ar',
    ...overrides,
  });
}

async function catchApiError(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ApiError) return error;
    throw error;
  }
  throw new Error('Expected the request to fail');
}

describe('api client', () => {
  describe('requests', () => {
    it('sends auth, locale and JSON headers and unwraps the envelope', async () => {
      let seen: Request | undefined;
      server.use(
        http.get(`${API}/auth/me`, ({ request }) => {
          seen = request;
          return laravel.ok({ id: 1, name: 'Admin' });
        }),
      );

      const user = await makeClient().get<{ id: number; name: string }>('/auth/me');

      expect(user).toEqual({ id: 1, name: 'Admin' });
      expect(seen?.headers.get('Authorization')).toBe('Bearer test-token');
      expect(seen?.headers.get('Accept')).toBe('application/json');
      expect(seen?.headers.get('Accept-Language')).toBe('ar');
    });

    it('omits Authorization when signed out', async () => {
      let auth: string | null = 'unset';
      server.use(
        http.post(`${API}/auth/login`, ({ request }) => {
          auth = request.headers.get('Authorization');
          return laravel.ok({ token: 't' });
        }),
      );

      await makeClient({ getToken: () => null }).post('/auth/login', { email: 'a@b.c' });

      expect(auth).toBeNull();
    });

    it('sends JSON bodies', async () => {
      let body: unknown;
      let contentType: string | null = null;
      server.use(
        http.post(`${API}/customers`, async ({ request }) => {
          body = await request.json();
          contentType = request.headers.get('Content-Type');
          return laravel.created({ id: 9 });
        }),
      );

      await makeClient().post('/customers', { name: 'Ahmed', branch_id: 1 });

      expect(body).toEqual({ name: 'Ahmed', branch_id: 1 });
      expect(contentType).toBe('application/json');
    });

    it('sends FormData as multipart without forcing a Content-Type', async () => {
      let contentType: string | null = null;
      let fileName: string | undefined;
      server.use(
        http.post(`${API}/vehicles/5/images`, async ({ request }) => {
          contentType = request.headers.get('Content-Type');
          const form = await request.formData();
          const file = form.get('image');
          fileName = file instanceof File ? file.name : undefined;
          return laravel.created({ id: 1, url: 'http://x/storage/1.png', is_primary: true });
        }),
      );

      const form = new FormData();
      form.append('image', new File(['png'], 'car.png', { type: 'image/png' }));
      form.append('is_primary', '1');
      await makeClient().post('/vehicles/5/images', form);

      expect(contentType).toMatch(/^multipart\/form-data; boundary=/);
      expect(fileName).toBe('car.png');
    });

    it('serializes list params the way Laravel ListQuery expects', async () => {
      let url: URL | undefined;
      server.use(
        http.get(`${API}/vehicles`, ({ request }) => {
          url = new URL(request.url);
          return laravel.paginated([{ id: 1 }], 2, 15, 16);
        }),
      );

      const result = await makeClient().get<Paginated<{ id: number }>>('/vehicles', {
        query: {
          page: 2,
          search: 'corolla',
          sort: '-year',
          filter: { status: ['available', 'reserved'] },
        },
      });

      expect(url?.searchParams.get('page')).toBe('2');
      expect(url?.searchParams.get('sort')).toBe('-year');
      expect(url?.searchParams.get('filter[status]')).toBe('available,reserved');
      expect(result.items).toEqual([{ id: 1 }]);
      expect(result.pagination).toEqual({ current_page: 2, per_page: 15, total: 16, last_page: 2 });
    });

    it('returns null data for deletes (Laravel answers 200 with data: null)', async () => {
      server.use(http.delete(`${API}/customers/3`, () => laravel.ok(null, 'Resource deleted.')));

      await expect(makeClient().delete('/customers/3')).resolves.toBeNull();
    });

    it('handles 202 accepted (report export queued)', async () => {
      server.use(
        http.post(`${API}/reports/sales/export`, () =>
          HttpResponse.json(
            { success: true, message: 'Queued', data: { id: 4, status: 'queued' }, errors: null },
            { status: 202 },
          ),
        ),
      );

      await expect(makeClient().post('/reports/sales/export', { type: 'daily' })).resolves.toEqual({
        id: 4,
        status: 'queued',
      });
    });

    it('supports absolute base URLs', async () => {
      server.use(http.get('https://api.example.com/api/v1/settings/lookups', () => laravel.ok({})));

      await expect(
        makeClient({ baseUrl: 'https://api.example.com/api/v1/' }).get('/settings/lookups'),
      ).resolves.toEqual({});
    });
  });

  describe('errors', () => {
    it('maps 422 to validation with dot-notation field errors', async () => {
      server.use(
        http.post(`${API}/purchase-orders`, () =>
          laravel.validation({
            supplier_id: ['The supplier id field is required.'],
            'vehicles.0.model_id': ['The selected model does not belong to the brand.'],
          }),
        ),
      );

      const error = await catchApiError(makeClient().post('/purchase-orders', {}));

      expect(error.kind).toBe('validation');
      expect(error.status).toBe(422);
      expect(error.message).toBe('The given data was invalid.');
      expect(error.fieldError('vehicles.0.model_id')).toBe(
        'The selected model does not belong to the brand.',
      );
      expect(error.fieldErrors).toHaveProperty('supplier_id');
    });

    it('maps 409 to conflict with the business rule code', async () => {
      server.use(
        http.post(`${API}/auth/login`, () =>
          laravel.conflict('account_disabled', 'This account has been disabled.'),
        ),
      );

      const error = await catchApiError(makeClient().post('/auth/login', {}));

      expect(error.kind).toBe('conflict');
      expect(error.code).toBe('account_disabled');
      expect(error.message).toBe('This account has been disabled.');
      expect(error.fieldErrors).toEqual({});
    });

    it('handles a 409 without errors (abort(409, msg) in controllers)', async () => {
      server.use(
        http.put(`${API}/commission-rules/2`, () => laravel.error(409, 'This rule is inactive.')),
      );

      const error = await catchApiError(makeClient().put('/commission-rules/2', {}));

      expect(error.kind).toBe('conflict');
      expect(error.code).toBeNull();
      expect(error.message).toBe('This rule is inactive.');
    });

    it.each([
      [401, 'unauthenticated', 'Unauthenticated.'],
      [403, 'forbidden', 'You are not authorized to perform this action.'],
      [404, 'not_found', 'The requested resource was not found.'],
      [415, 'http', 'Unsupported Media Type'],
      [429, 'rate_limited', 'Too many requests. Please slow down.'],
      [500, 'server', 'An unexpected error occurred. Please try again later.'],
    ] as const)('maps %i to %s', async (status, kind, message) => {
      server.use(http.get(`${API}/anything`, () => laravel.error(status, message)));

      const error = await catchApiError(makeClient().get('/anything'));

      expect(error.kind).toBe(kind);
      expect(error.status).toBe(status);
      expect(error.message).toBe(message);
    });

    it('notifies the auth layer on 401', async () => {
      const onUnauthenticated = vi.fn();
      server.use(http.get(`${API}/auth/me`, () => laravel.error(401, 'Unauthenticated.')));

      await catchApiError(makeClient({ onUnauthenticated }).get('/auth/me'));

      expect(onUnauthenticated).toHaveBeenCalledOnce();
      expect(onUnauthenticated).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'unauthenticated' }),
      );
    });

    it('does not notify the auth layer on other errors', async () => {
      const onUnauthenticated = vi.fn();
      server.use(http.get(`${API}/roles`, () => laravel.error(403, 'Forbidden')));

      await catchApiError(makeClient({ onUnauthenticated }).get('/roles'));

      expect(onUnauthenticated).not.toHaveBeenCalled();
    });

    it('treats a non-JSON error page (proxy 502) as a server error', async () => {
      server.use(
        http.get(
          `${API}/auth/me`,
          () => new HttpResponse('<html>Bad Gateway</html>', { status: 502 }),
        ),
      );

      const error = await catchApiError(makeClient().get('/auth/me'));

      expect(error.kind).toBe('server');
      expect(error.status).toBe(502);
      expect(error.message).toMatch(/server error/i);
    });

    it('treats a successful non-envelope response as a server error', async () => {
      server.use(http.get(`${API}/odd`, () => HttpResponse.json({ hello: 'world' })));

      const error = await catchApiError(makeClient().get('/odd'));

      expect(error.kind).toBe('server');
    });

    it('maps a failed connection to network', async () => {
      server.use(http.get(`${API}/auth/me`, () => HttpResponse.error()));

      const error = await catchApiError(makeClient().get('/auth/me'));

      expect(error.kind).toBe('network');
      expect(error.status).toBeNull();
    });

    it('maps cancellation to aborted', async () => {
      server.use(http.get(`${API}/vehicles`, () => new Promise<never>(() => undefined)));
      const controller = new AbortController();

      const pending = catchApiError(makeClient().get('/vehicles', { signal: controller.signal }));
      controller.abort();
      const error = await pending;

      expect(error.kind).toBe('aborted');
    });
  });

  describe('downloads', () => {
    it('returns the blob and the filename from Content-Disposition', async () => {
      let auth: string | null = null;
      server.use(
        http.get(`${API}/documents/7/download`, ({ request }) => {
          auth = request.headers.get('Authorization');
          return new HttpResponse(new Blob(['%PDF-1.7']), {
            headers: {
              'Content-Type': 'application/pdf',
              'Content-Disposition': `attachment; filename="contract.pdf"; filename*=UTF-8''${encodeURIComponent('عقد بيع.pdf')}`,
            },
          });
        }),
      );

      const result = await makeClient().download('/documents/7/download');

      expect(auth).toBe('Bearer test-token');
      expect(result.filename).toBe('عقد بيع.pdf');
      expect(result.contentType).toBe('application/pdf');
      expect(await result.blob.text()).toBe('%PDF-1.7');
    });

    it('throws ApiError for a failed download', async () => {
      server.use(
        http.get(`${API}/report-exports/1/download`, () => laravel.error(404, 'Not found')),
      );

      const error = await catchApiError(makeClient().download('/report-exports/1/download'));

      expect(error.kind).toBe('not_found');
    });
  });
});
