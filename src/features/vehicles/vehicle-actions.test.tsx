import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http } from 'msw/http';
import type { AuthUser } from '@/features/auth/types';
import { apiSession } from '@/lib/api';
import { laravel } from '@/test/msw/laravel';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render-app';
import { vehiclesApi } from './api/vehicles-api';
import type { Vehicle, VehicleHistory, VehicleMovement } from './types';

const API = '*/api/v1';
const session = { token: 't', expiresAt: '2099-01-01T00:00:00Z' };
const NASR = { id: 1, name: 'مدينة نصر', code: 'NSR' };
const ZAYED = { id: 2, name: 'الشيخ زايد', code: 'ZYD' };

function makeUser(permissions: string[], branches = [NASR]): AuthUser {
  return {
    id: 3,
    name: 'Mona Manager',
    email: 'm@x.co',
    phone: null,
    is_active: true,
    locale: 'ar',
    last_login_at: null,
    created_at: '',
    roles: ['Branch Manager'],
    permissions,
    branches,
  };
}

const manager = (branches = [NASR]) =>
  makeUser(['vehicles.view', 'vehicles.update', 'vehicles.transfer', 'vehicles.delete'], branches);

function makeVehicle(overrides: Partial<Vehicle> = {}): Vehicle {
  return {
    id: 42,
    stock_number: 'STK000042',
    brand: { id: 1, name: 'Toyota' },
    model: { id: 11, name: 'Corolla' },
    year: 2024,
    vin: null,
    engine_number: null,
    color: null,
    mileage: 0,
    transmission: 'automatic',
    fuel_type: 'petrol',
    vehicle_type: 'sedan',
    selling_price: null,
    purchase_date: null,
    supplier: null,
    branch: { id: 1, name: 'مدينة نصر' },
    description: null,
    specifications: null,
    status: 'available',
    images: [],
    created_at: '',
    updated_at: '',
    ...overrides,
  };
}

const inTransit: VehicleMovement = {
  id: 9,
  reference: 'TRF-2026-000009',
  vehicle: { id: 42, stock_number: 'STK000042' },
  from_branch: { id: 1, name: 'مدينة نصر' },
  to_branch: { id: 2, name: 'الشيخ زايد' },
  status: 'in_transit',
  notes: null,
  initiated_by: 3,
  initiated_at: '2026-11-20T10:00:00+02:00',
  completed_by: null,
  completed_at: null,
};

function mockVehicle({
  user,
  vehicle = makeVehicle(),
  history = { status_history: [], movements: [], costs: null },
}: {
  user: AuthUser;
  vehicle?: Vehicle;
  history?: VehicleHistory;
}) {
  server.use(
    http.get(`${API}/auth/me`, () => laravel.ok(user)),
    http.get(`${API}/vehicles/42`, () => laravel.ok(vehicle)),
    http.get(`${API}/vehicles/42/history`, () => laravel.ok(history)),
  );
}

afterEach(() => {
  localStorage.clear();
  apiSession.setToken(null);
  vi.restoreAllMocks();
});

describe('vehicle actions visibility', () => {
  it('shows nothing to a read-only user', async () => {
    mockVehicle({ user: makeUser(['vehicles.view']) });
    renderApp({ route: '/vehicles/42', session });

    await screen.findByRole('heading', { level: 1, name: 'Toyota Corolla 2024' });
    expect(screen.queryByRole('group', { name: 'إجراءات العربية' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'إدارة الصور' })).not.toBeInTheDocument();
  });

  it('offers no manual action for a reserved vehicle (workflow-owned status)', async () => {
    mockVehicle({ user: manager(), vehicle: makeVehicle({ status: 'reserved' }) });
    renderApp({ route: '/vehicles/42', session });

    await screen.findByRole('heading', { level: 1, name: 'Toyota Corolla 2024' });
    expect(screen.queryByRole('button', { name: 'إدخال الصيانة' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'تحويل لفرع' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'حذف العربية' })).not.toBeInTheDocument();
  });

  it('offers only "out of maintenance" and delete for a vehicle in maintenance', async () => {
    mockVehicle({ user: manager(), vehicle: makeVehicle({ status: 'under_maintenance' }) });
    renderApp({ route: '/vehicles/42', session });

    expect(await screen.findByRole('button', { name: 'إخراج من الصيانة' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'تحويل لفرع' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'حذف العربية' })).toBeInTheDocument();
  });
});

describe('maintenance status', () => {
  it('sends the reason and confirms', async () => {
    let body: unknown;
    mockVehicle({ user: manager() });
    server.use(
      http.post(`${API}/vehicles/42/status`, async ({ request }) => {
        body = await request.json();
        return laravel.ok(makeVehicle({ status: 'under_maintenance' }));
      }),
    );
    const { user } = renderApp({ route: '/vehicles/42', session });

    await user.click(await screen.findByRole('button', { name: 'إدخال الصيانة' }));
    const dialog = screen.getByRole('dialog', { name: 'تغيير حالة العربية' });
    expect(dialog).toHaveTextContent('الحالة الجديدة: في الصيانة');
    await user.type(within(dialog).getByLabelText('السبب'), 'تغيير زيت وفرامل');
    await user.click(within(dialog).getByRole('button', { name: 'تأكيد' }));

    expect(await screen.findByText('تم تغيير حالة العربية.')).toBeInTheDocument();
    expect(body).toEqual({ status: 'under_maintenance', reason: 'تغيير زيت وفرامل' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows validation and business errors inside the dialog', async () => {
    mockVehicle({ user: manager() });
    server.use(
      http.post(`${API}/vehicles/42/status`, () =>
        laravel.validation({ reason: ['السبب مطلوب.'] }),
      ),
    );
    const { user } = renderApp({ route: '/vehicles/42', session });

    await user.click(await screen.findByRole('button', { name: 'إدخال الصيانة' }));
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'تأكيد' }));
    expect(await within(dialog).findByText('السبب مطلوب.')).toBeInTheDocument();

    server.use(
      http.post(`${API}/vehicles/42/status`, () =>
        laravel.conflict('invalid_vehicle_status_transition', 'لا يمكن تغيير الحالة.'),
      ),
    );
    await user.type(within(dialog).getByLabelText('السبب'), 'x');
    await user.click(within(dialog).getByRole('button', { name: 'تأكيد' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('لا يمكن تغيير الحالة.');
  });
});

describe('branch transfer', () => {
  it('offers the user’s other branches and starts the transfer', async () => {
    let body: unknown;
    mockVehicle({ user: manager([NASR, ZAYED]) });
    server.use(
      http.post(`${API}/vehicles/42/transfer`, async ({ request }) => {
        body = await request.json();
        return laravel.created(inTransit);
      }),
    );
    const { user } = renderApp({ route: '/vehicles/42', session });

    await user.click(await screen.findByRole('button', { name: 'تحويل لفرع' }));
    const dialog = screen.getByRole('dialog', { name: 'تحويل العربية لفرع تاني' });
    const branch = within(dialog).getByLabelText('الفرع المستلم');
    // The vehicle's own branch is not offered.
    expect(within(branch).queryByRole('option', { name: 'مدينة نصر' })).not.toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'بدء التحويل' }));
    expect(within(dialog).getByText('الحقل ده مطلوب.')).toBeInTheDocument();
    expect(body).toBeUndefined();

    await user.selectOptions(branch, 'الشيخ زايد');
    await user.type(within(dialog).getByLabelText(/ملاحظات/), 'لعميل في زايد');
    await user.click(within(dialog).getByRole('button', { name: 'بدء التحويل' }));

    expect(await screen.findByText('تم بدء التحويل.')).toBeInTheDocument();
    expect(body).toEqual({ to_branch_id: 2, notes: 'لعميل في زايد' });
  });

  it('explains when there is no other branch to transfer to', async () => {
    mockVehicle({ user: manager([NASR]) });
    const { user } = renderApp({ route: '/vehicles/42', session });

    await user.click(await screen.findByRole('button', { name: 'تحويل لفرع' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/مفيش فروع تانية متاحة/)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'بدء التحويل' })).toBeDisabled();

    await user.click(within(dialog).getByRole('button', { name: 'إغلاق' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('lets the source branch cancel an open transfer from the vehicle page', async () => {
    let cancelled = false;
    mockVehicle({
      user: manager([NASR]),
      vehicle: makeVehicle({ status: 'transferred' }),
      history: { status_history: [], movements: [inTransit], costs: null },
    });
    server.use(
      http.post(`${API}/vehicle-transfers/9/cancel`, () => {
        cancelled = true;
        return laravel.ok({ ...inTransit, status: 'cancelled' });
      }),
    );
    const { user } = renderApp({ route: '/vehicles/42', session });

    expect(
      await screen.findByText(
        'العربية في الطريق من مدينة نصر إلى الشيخ زايد (مرجع TRF-2026-000009).',
      ),
    ).toBeInTheDocument();
    // Source-branch user: can cancel, cannot receive.
    expect(screen.queryByRole('button', { name: 'تأكيد الاستلام' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'إلغاء التحويل' }));
    const dialog = screen.getByRole('dialog', { name: 'إلغاء التحويل' });
    expect(dialog).toHaveTextContent('العربية هترجع متاحة في فرع مدينة نصر.');
    await user.click(within(dialog).getByRole('button', { name: 'إلغاء التحويل' }));

    expect(await screen.findByText('تم إلغاء التحويل.')).toBeInTheDocument();
    expect(cancelled).toBe(true);
  });

  it('lets the destination branch receive from the transfers page', async () => {
    const requests: URL[] = [];
    let received = false;
    server.use(
      http.get(`${API}/auth/me`, () => laravel.ok(manager([ZAYED]))),
      http.get(`${API}/vehicle-transfers`, ({ request }) => {
        requests.push(new URL(request.url));
        return laravel.paginated(received ? [] : [inTransit]);
      }),
      http.post(`${API}/vehicle-transfers/9/receive`, () => {
        received = true;
        return laravel.ok({ ...inTransit, status: 'completed' });
      }),
    );
    const { user } = renderApp({ route: '/vehicles/transfers', session });

    const row = (await screen.findByText('TRF-2026-000009')).closest('tr') as HTMLElement;
    expect(within(row).getByText('وارد')).toBeInTheDocument();
    expect(within(row).queryByRole('button', { name: 'إلغاء التحويل' })).not.toBeInTheDocument();
    expect(requests[0]?.searchParams.get('filter[status]')).toBe('in_transit');

    await user.click(within(row).getByRole('button', { name: 'تأكيد الاستلام' }));
    await user.click(
      within(screen.getByRole('dialog', { name: 'تأكيد استلام العربية' })).getByRole('button', {
        name: 'تأكيد الاستلام',
      }),
    );

    expect(await screen.findByText('تم استلام العربية.')).toBeInTheDocument();
    expect(received).toBe(true);
    expect(await screen.findByText('مفيش تحويلات مطابقة.')).toBeInTheDocument();
  });

  it('links the transfers page from the inventory list', async () => {
    server.use(
      http.get(`${API}/auth/me`, () => laravel.ok(manager())),
      http.get(`${API}/vehicles`, () => laravel.paginated([])),
      http.get(`${API}/vehicle-brands`, () => laravel.paginated([])),
      http.get(`${API}/vehicle-transfers`, () => laravel.paginated([])),
    );
    const { user, router } = renderApp({ route: '/vehicles', session });

    await user.click(await screen.findByRole('link', { name: 'التحويلات بين الفروع' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'تحويلات المخزون' }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/vehicles/transfers');
  });
});

describe('delete vehicle', () => {
  it('confirms, deletes and returns to the inventory', async () => {
    let deleted = false;
    mockVehicle({ user: manager() });
    server.use(
      http.delete(`${API}/vehicles/42`, () => {
        deleted = true;
        return laravel.ok(null);
      }),
      http.get(`${API}/vehicles`, () => laravel.paginated([])),
      http.get(`${API}/vehicle-brands`, () => laravel.paginated([])),
    );
    const { user, router } = renderApp({ route: '/vehicles/42', session });

    await user.click(await screen.findByRole('button', { name: 'حذف العربية' }));
    const dialog = screen.getByRole('dialog', { name: 'حذف العربية؟' });
    expect(dialog).toHaveTextContent('Toyota Corolla 2024');
    await user.click(within(dialog).getByRole('button', { name: 'حذف' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/vehicles');
    });
    expect(deleted).toBe(true);
  });

  it('keeps the dialog open with the business error when deletion is refused', async () => {
    mockVehicle({ user: manager() });
    server.use(
      http.delete(`${API}/vehicles/42`, () =>
        laravel.conflict('vehicle_not_deletable', 'لا يمكن حذف عربية مرتبطة بعقد.'),
      ),
    );
    const { user } = renderApp({ route: '/vehicles/42', session });

    await user.click(await screen.findByRole('button', { name: 'حذف العربية' }));
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'حذف' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'لا يمكن حذف عربية مرتبطة بعقد.',
    );
  });
});

describe('vehicle images', () => {
  const withImages = makeVehicle({
    images: [
      { id: 5, url: 'http://localhost:8000/storage/vehicles/42/a.jpg', is_primary: true },
      { id: 6, url: 'http://localhost:8000/storage/vehicles/42/b.jpg', is_primary: false },
    ],
  });

  it('rejects unsupported or oversized files before uploading', async () => {
    const upload = vi.spyOn(vehiclesApi, 'uploadImage');
    mockVehicle({ user: manager() });
    const { user } = renderApp({ route: '/vehicles/42', session });

    const input = await screen.findByLabelText('اختار صورة');
    fireEvent.change(input, {
      target: { files: [new File(['x'], 'doc.pdf', { type: 'application/pdf' })] },
    });
    expect(screen.getByText('نوع الملف غير مدعوم. استخدم JPG أو PNG أو WEBP.')).toBeInTheDocument();

    const big = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'big.jpg', { type: 'image/jpeg' });
    fireEvent.change(input, { target: { files: [big] } });
    expect(screen.getByText('حجم الصورة أكبر من 5 ميجا.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'رفع صورة' }));
    expect(upload).not.toHaveBeenCalled();
  });

  it('uploads a photo as primary and confirms', async () => {
    // jsdom's FormData cannot travel through Node's fetch; the multipart request itself is
    // covered by the API client tests (node environment). Here we check the UI → API call.
    const upload = vi
      .spyOn(vehiclesApi, 'uploadImage')
      .mockResolvedValue({ id: 7, url: 'http://x/7.jpg', is_primary: true });
    mockVehicle({ user: manager() });
    const { user } = renderApp({ route: '/vehicles/42', session });

    const photo = new File(['png'], 'front.png', { type: 'image/png' });
    await user.upload(await screen.findByLabelText('اختار صورة'), photo);
    await user.click(screen.getByLabelText('اجعلها الصورة الأساسية'));
    await user.click(screen.getByRole('button', { name: 'رفع صورة' }));

    expect(await screen.findByText('تم رفع الصورة.')).toBeInTheDocument();
    expect(upload).toHaveBeenCalledWith(42, photo, true);
  });

  it('deletes a photo after confirmation', async () => {
    let deletedId: string | undefined;
    mockVehicle({ user: manager(), vehicle: withImages });
    server.use(
      http.delete(`${API}/vehicles/42/images/:imageId`, ({ params }) => {
        deletedId = String(params.imageId);
        return laravel.ok(null);
      }),
    );
    const { user } = renderApp({ route: '/vehicles/42', session });

    const manager_ = (await screen.findByRole('heading', { name: 'إدارة الصور' }))
      .parentElement as HTMLElement;
    expect(within(manager_).getByText('أساسية')).toBeInTheDocument();
    await user.click(within(manager_).getByRole('button', { name: 'حذف الصورة 2' }));
    await user.click(
      within(screen.getByRole('dialog', { name: 'حذف الصورة؟' })).getByRole('button', {
        name: 'حذف',
      }),
    );

    expect(await screen.findByText('تم حذف الصورة.')).toBeInTheDocument();
    expect(deletedId).toBe('6');
  });
});
