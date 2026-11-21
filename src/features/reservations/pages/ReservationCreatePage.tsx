import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Card } from '@/components/shared/DetailList';
import { EntityPicker, type PickerOption } from '@/components/shared/EntityPicker';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { TextArea } from '@/components/ui/TextArea';
import { TextField } from '@/components/ui/TextField';
import { customerKeys, customersApi } from '@/features/customers/api/customers-api';
import type { Customer } from '@/features/customers/types';
import { vehicleKeys, vehiclesApi } from '@/features/vehicles/api/vehicles-api';
import type { Vehicle } from '@/features/vehicles/types';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { isApiError } from '@/lib/api';
import { getErrorMessage } from '@/lib/api/error-message';
import { parseRouteId } from '@/lib/route-id';
import { ar } from '@/locales/ar';
import { reservationKeys, reservationsApi } from '../api/reservations-api';
import type { ReservationDetailLinkState } from './ReservationDetailPage';

const t = ar.reservations.form;

const vehicleOption = (v: Vehicle): PickerOption => ({
  id: v.id,
  title: [v.brand?.name, v.model?.name, v.year].filter(Boolean).join(' '),
  subtitle: [v.stock_number, v.color, v.vin].filter(Boolean).join(' · '),
});

const customerOption = (c: Customer): PickerOption => ({
  id: c.id,
  title: c.name,
  subtitle: [c.customer_code, c.phone].join(' · '),
});

/** `datetime-local` value (local time) → ISO instant, so the backend gets an explicit offset. */
function toInstant(local: string): string | null {
  if (local === '') return null;
  const time = new Date(local).getTime();
  return Number.isNaN(time) ? null : new Date(time).toISOString();
}

function nowLocalInput(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

/**
 * /reservations/new — guarded by `reservations.create`. `?vehicle_id=` / `?customer_id=` preselect
 * from the vehicle or customer page.
 */
export function ReservationCreatePage() {
  useDocumentTitle(t.title);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const presetVehicleId = parseRouteId(searchParams.get('vehicle_id') ?? undefined);
  const presetCustomerId = parseRouteId(searchParams.get('customer_id') ?? undefined);

  // undefined = still following the preset from the URL; null = user cleared it.
  const [vehicleChoice, setVehicle] = useState<PickerOption | null | undefined>(undefined);
  const [customerChoice, setCustomer] = useState<PickerOption | null | undefined>(undefined);
  const [expiresAt, setExpiresAt] = useState('');
  const [notes, setNotes] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const presetVehicle = useQuery({
    queryKey: vehicleKeys.detail(presetVehicleId ?? 0),
    queryFn: ({ signal }) => vehiclesApi.get(presetVehicleId ?? 0, signal),
    enabled: presetVehicleId !== null && vehicleChoice === undefined,
  });
  const presetCustomer = useQuery({
    queryKey: customerKeys.detail(presetCustomerId ?? 0),
    queryFn: ({ signal }) => customersApi.get(presetCustomerId ?? 0, {}, signal),
    enabled: presetCustomerId !== null && customerChoice === undefined,
  });

  const vehicle =
    vehicleChoice !== undefined
      ? vehicleChoice
      : presetVehicle.data?.status === 'available'
        ? vehicleOption(presetVehicle.data)
        : null;
  const customer =
    customerChoice !== undefined
      ? customerChoice
      : presetCustomer.data?.status === 'active'
        ? customerOption(presetCustomer.data)
        : null;

  const mutation = useMutation({
    mutationFn: () =>
      reservationsApi.create({
        vehicle_id: vehicle?.id ?? 0,
        customer_id: customer?.id ?? 0,
        expires_at: toInstant(expiresAt),
        notes: notes.trim() === '' ? null : notes.trim(),
      }),
    onSuccess: async (reservation) => {
      queryClient.setQueryData(reservationKeys.detail(reservation.id), reservation);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [...reservationKeys.all, 'list'] }),
        // The vehicle is now `reserved`.
        queryClient.invalidateQueries({ queryKey: ['vehicles'] }),
      ]);
      const state: ReservationDetailLinkState = { notice: t.created };
      void navigate(`/reservations/${String(reservation.id)}`, { state });
    },
  });

  const serverError = (field: string) =>
    isApiError(mutation.error) && mutation.error.kind === 'validation'
      ? mutation.error.fieldError(field)
      : undefined;
  const fieldErrors = {
    vehicle_id: submitted && !vehicle ? t.required : serverError('vehicle_id'),
    customer_id: submitted && !customer ? t.required : serverError('customer_id'),
    expires_at:
      submitted && expiresAt !== '' && (toInstant(expiresAt) ?? '') <= new Date().toISOString()
        ? t.future
        : serverError('expires_at'),
    notes: serverError('notes'),
  };
  const hasServerFieldError = ['vehicle_id', 'customer_id', 'expires_at', 'notes'].some(
    (field) => serverError(field) !== undefined,
  );
  // 409 business rules (vehicle not available, customer inactive) and other failures.
  const formError =
    mutation.error && !hasServerFieldError
      ? isApiError(mutation.error) && mutation.error.kind === 'validation'
        ? t.serverErrors
        : getErrorMessage(mutation.error)
      : null;

  return (
    <section className="flex flex-col gap-5">
      <header className="flex flex-col gap-2">
        <Link to="/reservations" className="text-sm text-accent hover:underline">
          → {ar.reservations.detail.back}
        </Link>
        <h1 className="text-2xl font-semibold text-fg">{t.title}</h1>
      </header>

      <form
        noValidate
        className="flex flex-col gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          setSubmitted(true);
          const futureOk =
            expiresAt === '' || (toInstant(expiresAt) ?? '') > new Date().toISOString();
          if (vehicle && customer && futureOk) mutation.mutate();
        }}
      >
        {formError ? <Alert tone="danger">{formError}</Alert> : null}

        <Card title={ar.reservations.detail.sections.info}>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <EntityPicker
              label={t.vehicle}
              hint={t.vehicleHint}
              error={fieldErrors.vehicle_id}
              searchPlaceholder={t.vehicleSearch}
              selected={vehicle}
              onSelect={(option) => {
                mutation.reset();
                setVehicle(option);
              }}
              loading={vehicleChoice === undefined && presetVehicle.isLoading}
              queryKey={reservationKeys.vehicleOptions}
              queryFn={reservationsApi.availableVehicles}
              toOption={vehicleOption}
            />
            <EntityPicker
              label={t.customer}
              hint={t.customerHint}
              error={fieldErrors.customer_id}
              searchPlaceholder={t.customerSearch}
              selected={customer}
              onSelect={(option) => {
                mutation.reset();
                setCustomer(option);
              }}
              loading={customerChoice === undefined && presetCustomer.isLoading}
              queryKey={reservationKeys.customerOptions}
              queryFn={reservationsApi.activeCustomers}
              toOption={customerOption}
            />
            <TextField
              label={t.expiresAt}
              optional
              type="datetime-local"
              min={nowLocalInput()}
              hint={t.expiresAtHint}
              value={expiresAt}
              error={fieldErrors.expires_at}
              onChange={(event) => {
                setExpiresAt(event.target.value);
              }}
            />
            <TextArea
              label={t.notes}
              optional
              rows={3}
              maxLength={1000}
              value={notes}
              error={fieldErrors.notes}
              onChange={(event) => {
                setNotes(event.target.value);
              }}
            />
          </div>
        </Card>

        <div className="flex flex-wrap gap-3">
          <Button
            type="submit"
            variant="primary"
            loading={mutation.isPending}
            loadingLabel={t.saving}
          >
            {t.save}
          </Button>
          <Link
            to="/reservations"
            className="inline-flex h-10 items-center rounded-md px-4 text-sm text-fg-secondary hover:bg-surface-muted"
          >
            {t.cancel}
          </Link>
        </div>
      </form>
    </section>
  );
}
