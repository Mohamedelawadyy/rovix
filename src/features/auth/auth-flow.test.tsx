import { screen, waitFor } from '@testing-library/react';
import { http } from 'msw/http';
import { apiSession } from '@/lib/api';
import { laravel } from '@/test/msw/laravel';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render-app';
import { TOKEN_STORAGE_KEY } from './token-storage';
import type { AuthUser } from './types';

const API = '*/api/v1';
const inSevenDays = () => new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();

const admin: AuthUser = {
  id: 1,
  name: 'Mohamed Admin',
  email: 'admin@nilemotors.test',
  phone: null,
  is_active: true,
  locale: 'ar',
  last_login_at: null,
  roles: ['Super Admin'],
  permissions: ['vehicles.view'],
  branches: [],
  created_at: '2026-11-01T10:00:00+02:00',
};

function storedSession() {
  const raw = localStorage.getItem(TOKEN_STORAGE_KEY);
  return raw ? (JSON.parse(raw) as { token: string; expiresAt: string | null }) : null;
}

afterEach(() => {
  localStorage.clear();
  apiSession.setToken(null);
});

describe('authentication flow', () => {
  it('redirects a guest to login (unknown routes fall back to the protected home)', async () => {
    const { router } = renderApp({ route: '/vehicles?page=2' });

    expect(await screen.findByRole('heading', { name: 'تسجيل الدخول' })).toBeInTheDocument();
    // Unknown routes fall back to "/", which requires auth.
    expect(router.state.location.pathname).toBe('/login');
  });

  it('logs in, loads the profile, persists the token and opens the app', async () => {
    let meAuth: string | null = null;
    server.use(
      http.post(`${API}/auth/login`, () =>
        laravel.ok({
          token: '1|abc',
          token_type: 'Bearer',
          expires_at: '2099-01-01T00:00:00+02:00',
          user: admin,
        }),
      ),
      http.get(`${API}/auth/me`, ({ request }) => {
        meAuth = request.headers.get('Authorization');
        return laravel.ok(admin);
      }),
    );
    const { user, router } = renderApp({ route: '/login' });

    await user.type(await screen.findByLabelText('البريد الإلكتروني'), 'admin@nilemotors.test');
    await user.type(screen.getByLabelText('كلمة المرور'), 'password');
    await user.click(screen.getByRole('button', { name: 'دخول' }));

    expect(await screen.findByRole('heading', { name: 'أهلًا، Mohamed Admin' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
    expect(meAuth).toBe('Bearer 1|abc');
    expect(storedSession()).toEqual({ token: '1|abc', expiresAt: '2099-01-01T00:00:00+02:00' });
  });

  it('returns to the requested page after login, but never to an external URL', async () => {
    server.use(
      http.post(`${API}/auth/login`, () =>
        laravel.ok({ token: 't', token_type: 'Bearer', expires_at: inSevenDays(), user: admin }),
      ),
      http.get(`${API}/auth/me`, () => laravel.ok(admin)),
    );
    const { user, router } = renderApp({ route: '/login?redirect=%2F%2Fevil.example.com' });

    await user.type(await screen.findByLabelText('البريد الإلكتروني'), 'a@b.co');
    await user.type(screen.getByLabelText('كلمة المرور'), 'secret123');
    await user.click(screen.getByRole('button', { name: 'دخول' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/');
    });
  });

  it('shows wrong-credential errors from the backend (422 on email)', async () => {
    server.use(
      http.post(`${API}/auth/login`, () =>
        laravel.validation({ email: ['بيانات الدخول غير صحيحة.'] }),
      ),
    );
    const { user } = renderApp({ route: '/login' });

    await user.type(await screen.findByLabelText('البريد الإلكتروني'), 'a@b.co');
    await user.type(screen.getByLabelText('كلمة المرور'), 'wrong');
    await user.click(screen.getByRole('button', { name: 'دخول' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('بيانات الدخول غير صحيحة.');
    expect(storedSession()).toBeNull();
  });

  it('shows the disabled-account business error (409)', async () => {
    server.use(
      http.post(`${API}/auth/login`, () =>
        laravel.conflict('account_disabled', 'تم تعطيل هذا الحساب.'),
      ),
    );
    const { user } = renderApp({ route: '/login' });

    await user.type(await screen.findByLabelText('البريد الإلكتروني'), 'a@b.co');
    await user.type(screen.getByLabelText('كلمة المرور'), 'password1');
    await user.click(screen.getByRole('button', { name: 'دخول' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('تم تعطيل هذا الحساب.');
  });

  it('restores a stored session on reload', async () => {
    server.use(http.get(`${API}/auth/me`, () => laravel.ok(admin)));

    renderApp({ route: '/', session: { token: 'stored', expiresAt: inSevenDays() } });

    expect(await screen.findByRole('heading', { name: 'أهلًا، Mohamed Admin' })).toBeInTheDocument();
  });

  it('drops a revoked stored token (401 on /auth/me) and goes to login', async () => {
    server.use(http.get(`${API}/auth/me`, () => laravel.error(401, 'Unauthenticated.')));

    renderApp({ route: '/', session: { token: 'revoked', expiresAt: inSevenDays() } });

    expect(await screen.findByRole('heading', { name: 'تسجيل الدخول' })).toBeInTheDocument();
    expect(storedSession()).toBeNull();
  });

  it('ignores an expired stored token without calling the API', async () => {
    renderApp({ route: '/', session: { token: 'old', expiresAt: '2000-01-01T00:00:00Z' } });

    // No /auth/me handler: an API call would fail the test (unhandled request).
    expect(await screen.findByRole('heading', { name: 'تسجيل الدخول' })).toBeInTheDocument();
  });

  it('keeps the session and offers retry when the backend is unreachable', async () => {
    let calls = 0;
    server.use(
      http.get(`${API}/auth/me`, () => {
        calls += 1;
        return calls === 1 ? laravel.error(503, 'Service Unavailable') : laravel.ok(admin);
      }),
    );
    const { user } = renderApp({ route: '/', session: { token: 'ok', expiresAt: inSevenDays() } });

    expect(await screen.findByRole('alert')).toHaveTextContent('تعذر التحقق من الجلسة.');
    expect(storedSession()).not.toBeNull();

    await user.click(screen.getByRole('button', { name: 'إعادة المحاولة' }));
    expect(await screen.findByRole('heading', { name: 'أهلًا، Mohamed Admin' })).toBeInTheDocument();
  });

  it('logs out: revokes the token, clears storage and returns to login', async () => {
    let logoutCalled = false;
    server.use(
      http.get(`${API}/auth/me`, () => laravel.ok(admin)),
      http.post(`${API}/auth/logout`, () => {
        logoutCalled = true;
        return laravel.ok(null);
      }),
    );
    const { user } = renderApp({
      route: '/',
      session: { token: 'live', expiresAt: inSevenDays() },
    });

    await user.click(await screen.findByRole('button', { name: 'تسجيل الخروج' }));

    expect(await screen.findByRole('heading', { name: 'تسجيل الدخول' })).toBeInTheDocument();
    expect(logoutCalled).toBe(true);
    expect(storedSession()).toBeNull();
  });

  it('logs out locally even if the logout request fails', async () => {
    server.use(
      http.get(`${API}/auth/me`, () => laravel.ok(admin)),
      http.post(`${API}/auth/logout`, () => laravel.error(500, 'boom')),
    );
    const { user } = renderApp({
      route: '/',
      session: { token: 'live', expiresAt: inSevenDays() },
    });

    await user.click(await screen.findByRole('button', { name: 'تسجيل الخروج' }));

    expect(await screen.findByRole('heading', { name: 'تسجيل الدخول' })).toBeInTheDocument();
    expect(storedSession()).toBeNull();
  });

  it('renews the token when it is close to expiry', async () => {
    const soon = new Date(Date.now() + 2 * 3600 * 1000).toISOString();
    const later = '2099-01-01T00:00:00+02:00';
    server.use(
      http.get(`${API}/auth/me`, () => laravel.ok(admin)),
      http.post(`${API}/auth/refresh`, () =>
        laravel.ok({ token: 'renewed', token_type: 'Bearer', expires_at: later }),
      ),
    );

    renderApp({ route: '/', session: { token: 'expiring', expiresAt: soon } });

    await waitFor(() => {
      expect(storedSession()).toEqual({ token: 'renewed', expiresAt: later });
    });
    expect(apiSession.getToken()).toBe('renewed');
  });

  it('signs out when another tab signs out', async () => {
    server.use(http.get(`${API}/auth/me`, () => laravel.ok(admin)));
    renderApp({ route: '/', session: { token: 'shared', expiresAt: inSevenDays() } });
    await screen.findByRole('heading', { name: 'أهلًا، Mohamed Admin' });

    localStorage.removeItem(TOKEN_STORAGE_KEY);
    window.dispatchEvent(new StorageEvent('storage', { key: TOKEN_STORAGE_KEY, newValue: null }));

    expect(await screen.findByRole('heading', { name: 'تسجيل الدخول' })).toBeInTheDocument();
  });

  it('sends a signed-in user away from the login page', async () => {
    server.use(http.get(`${API}/auth/me`, () => laravel.ok(admin)));

    const { router } = renderApp({
      route: '/login',
      session: { token: 't', expiresAt: inSevenDays() },
    });

    await screen.findByRole('heading', { name: 'أهلًا، Mohamed Admin' });
    expect(router.state.location.pathname).toBe('/');
  });
});

describe('password reset', () => {
  it('requests a reset link and shows the neutral confirmation', async () => {
    let body: unknown;
    server.use(
      http.post(`${API}/auth/forgot-password`, async ({ request }) => {
        body = await request.json();
        return laravel.ok(null);
      }),
    );
    const { user } = renderApp({ route: '/forgot-password' });

    await user.type(await screen.findByLabelText('البريد الإلكتروني'), ' someone@x.co ');
    await user.click(screen.getByRole('button', { name: 'إرسال اللينك' }));

    expect(await screen.findByRole('status')).toHaveTextContent('لو البريد مسجل عندنا');
    expect(body).toEqual({ email: 'someone@x.co' });
  });

  it('resets the password from the emailed link and returns to login with a notice', async () => {
    let body: unknown;
    server.use(
      http.post(`${API}/auth/reset-password`, async ({ request }) => {
        body = await request.json();
        return laravel.ok(null);
      }),
    );
    const { user, router } = renderApp({
      route: '/reset-password?token=tok123&email=admin%40nilemotors.test',
    });

    await user.type(await screen.findByLabelText('كلمة المرور'), 'newpass123');
    await user.type(screen.getByLabelText('تأكيد كلمة المرور'), 'newpass123');
    await user.click(screen.getByRole('button', { name: 'حفظ كلمة المرور' }));

    expect(await screen.findByRole('status')).toHaveTextContent('تم تغيير كلمة المرور');
    expect(router.state.location.pathname).toBe('/login');
    expect(body).toEqual({
      email: 'admin@nilemotors.test',
      token: 'tok123',
      password: 'newpass123',
      password_confirmation: 'newpass123',
    });
  });

  it('shows field errors and an invalid-token error from the backend', async () => {
    server.use(
      http.post(`${API}/auth/reset-password`, () =>
        laravel.validation({
          email: ['رمز إعادة التعيين غير صالح.'],
          password: ['كلمة المرور يجب أن تحتوي على أرقام.'],
        }),
      ),
    );
    const { user } = renderApp({ route: '/reset-password?token=bad&email=a%40b.co' });

    await user.type(await screen.findByLabelText('كلمة المرور'), 'onlyletters');
    await user.type(screen.getByLabelText('تأكيد كلمة المرور'), 'onlyletters');
    await user.click(screen.getByRole('button', { name: 'حفظ كلمة المرور' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('رمز إعادة التعيين غير صالح.');
    expect(screen.getByText('كلمة المرور يجب أن تحتوي على أرقام.')).toBeInTheDocument();
  });

  it('explains a broken link instead of showing the form', async () => {
    renderApp({ route: '/reset-password?email=a%40b.co' });

    expect(await screen.findByRole('alert')).toHaveTextContent('لينك إعادة التعيين غير صالح');
    expect(screen.getByRole('link', { name: 'طلب لينك جديد' })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
  });
});
