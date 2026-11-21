import { HttpResponse } from 'msw/http';

/**
 * Builders that mirror the Laravel backend's response envelope
 * (App\Http\Traits\ResponsesTrait + Modules\Core\Exceptions\ApiExceptionRenderer).
 */
function envelope(
  status: number,
  body: { success: boolean; message: string | null; data: unknown; errors: unknown },
) {
  return HttpResponse.json(body, { status });
}

export const laravel = {
  ok: (data: unknown, message = 'Success') =>
    envelope(200, { success: true, message, data, errors: null }),

  created: (data: unknown, message = 'Created successfully') =>
    envelope(201, { success: true, message, data, errors: null }),

  paginated: (items: unknown[], page = 1, perPage = 15, total = items.length) =>
    envelope(200, {
      success: true,
      message: 'Success',
      data: {
        items,
        pagination: {
          current_page: page,
          per_page: perPage,
          total,
          last_page: Math.max(1, Math.ceil(total / perPage)),
        },
      },
      errors: null,
    }),

  validation: (errors: Record<string, string[]>) =>
    envelope(422, { success: false, message: 'The given data was invalid.', data: null, errors }),

  conflict: (code: string, message: string, extra: Record<string, unknown> = {}) =>
    envelope(409, { success: false, message, data: null, errors: { code, ...extra } }),

  error: (status: number, message: string) =>
    envelope(status, { success: false, message, data: null, errors: null }),
};
