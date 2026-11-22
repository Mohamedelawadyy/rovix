import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Card } from '@/components/shared/DetailList';
import { EntityPicker, type PickerOption } from '@/components/shared/EntityPicker';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { TextArea } from '@/components/ui/TextArea';
import { TextField } from '@/components/ui/TextField';
import { useAuth } from '@/features/auth/auth-context';
import { customerKeys, customersApi } from '@/features/customers/api/customers-api';
import type { Customer } from '@/features/customers/types';
import { reservationsApi } from '@/features/reservations/api/reservations-api';
import { vehicleKeys, vehiclesApi } from '@/features/vehicles/api/vehicles-api';
import type { Vehicle } from '@/features/vehicles/types';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { isApiError } from '@/lib/api';
import { getErrorMessage } from '@/lib/api/error-message';
import { applyServerErrors } from '@/lib/forms/server-errors';
import { addMoney, compareMoney, formatMoney, subtractMoney } from '@/lib/money/money';
import { parseRouteId } from '@/lib/route-id';
import { ar, interpolate } from '@/locales/ar';
import { contractKeys, salesContractsApi } from '../api/sales-contracts-api';
import {
  CONTRACT_FORM_FIELDS,
  contractFormSchema,
  emptyContractForm,
  finalAmount,
  MAX_INSTALLMENTS,
  toContractPayload,
  todayIso,
  type ContractFormValues,
} from '../contract-form-schema';
import { frequencyLabels, labelOf, paymentTypeLabels } from '../labels';
import { buildSchedule } from '../schedule';
import { PAYMENT_TYPES, type InstallmentFrequency } from '../types';
import { useContractLookups } from '../use-contract-lookups';
import type { ContractDetailLinkState } from './ContractDetailPage';

const t = ar.salesContracts.form;
const MONEY = /^\d+(\.\d{1,2})?$/;

const vehicleOption = (v: Vehicle): PickerOption => ({
  id: v.id,
  title: [v.brand?.name, v.model?.name, v.year].filter(Boolean).join(' '),
  subtitle: [v.stock_number, v.color, v.vin].filter(Boolean).join(' · '),
});
const customerOption = (
  c: Pick<Customer, 'id' | 'name' | 'customer_code'> & { phone?: string },
) => ({
  id: c.id,
  title: c.name,
  subtitle: [c.customer_code, c.phone].filter(Boolean).join(' · '),
});
const money = (value: string) => formatMoney(value);
const safeMoney = (value: string) => (MONEY.test(value.trim()) ? value.trim() : null);

/**
 * /sales-contracts/new — guarded by `sales-contracts.create`. `?vehicle_id=` and `?customer_id=`
 * preselect (e.g. converting a reservation).
 */
export function ContractCreatePage() {
  useDocumentTitle(t.title);
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const presetVehicleId = parseRouteId(searchParams.get('vehicle_id') ?? undefined);
  const presetCustomerId = parseRouteId(searchParams.get('customer_id') ?? undefined);

  // undefined = follow the URL preset; null = cleared by the user.
  const [vehicleChoice, setVehicleChoice] = useState<Vehicle | null | undefined>(undefined);
  const [customerChoice, setCustomerChoice] = useState<PickerOption | null | undefined>(undefined);
  const [formErrors, setFormErrors] = useState<string[]>([]);

  const {
    register,
    control,
    handleSubmit,
    setValue,
    setError,
    clearErrors,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<ContractFormValues>({
    resolver: zodResolver(contractFormSchema),
    defaultValues: emptyContractForm(),
    mode: 'onTouched',
  });
  const schedule = useFieldArray({ control, name: 'installments' });
  const [paymentType, sellingPrice, discount, downPayment, installments] = useWatch({
    control,
    name: ['payment_type', 'selling_price', 'discount', 'down_payment', 'installments'],
  });

  // --- presets (?vehicle_id / ?customer_id) -------------------------------------------------
  const presetVehicle = useQuery({
    queryKey: vehicleKeys.detail(presetVehicleId ?? 0),
    queryFn: ({ signal }) => vehiclesApi.get(presetVehicleId ?? 0, signal),
    enabled: presetVehicleId !== null,
  });
  const presetCustomer = useQuery({
    queryKey: customerKeys.detail(presetCustomerId ?? 0),
    queryFn: ({ signal }) => customersApi.get(presetCustomerId ?? 0, {}, signal),
    enabled: presetCustomerId !== null,
  });
  const presetSellable =
    presetVehicle.data?.status === 'available' || presetVehicle.data?.status === 'reserved';
  const vehicle =
    vehicleChoice !== undefined
      ? vehicleChoice
      : presetSellable
        ? (presetVehicle.data ?? null)
        : null;

  // A reserved vehicle can only be sold to the customer holding the reservation.
  const reservation = useQuery({
    queryKey: contractKeys.reservationFor(vehicle?.id ?? 0),
    queryFn: ({ signal }) => salesContractsApi.activeReservationFor(vehicle?.id ?? 0, signal),
    enabled: vehicle?.status === 'reserved',
  });
  const reservedCustomer =
    vehicle?.status === 'reserved' ? (reservation.data?.items[0]?.customer ?? null) : null;
  const customer = reservedCustomer
    ? customerOption(reservedCustomer)
    : customerChoice !== undefined
      ? customerChoice
      : presetCustomer.data?.status === 'active'
        ? customerOption(presetCustomer.data)
        : null;

  const lookups = useContractLookups({
    branchId: vehicle?.branch?.id ?? null,
    needsCashbox: paymentType !== '',
    needsBank: paymentType === 'bank_financing',
  });

  // The signed-in user's own employee record is the default salesperson.
  useEffect(() => {
    if (getValues('sales_employee_id') !== '') return;
    const own = lookups.employees.find((e) => e.user_id === user?.id);
    if (own) setValue('sales_employee_id', String(own.id));
  }, [lookups.employees, user?.id, getValues, setValue]);

  function chooseVehicle(v: Vehicle | null) {
    setVehicleChoice(v);
    // Employees belong to the vehicle's branch.
    setValue('sales_employee_id', '');
    if (v?.selling_price && getValues('selling_price') === '') {
      setValue('selling_price', v.selling_price);
    }
  }

  // --- derived amounts ----------------------------------------------------------------------
  const price = safeMoney(sellingPrice);
  const disc = discount.trim() === '' ? '0' : safeMoney(discount);
  const final =
    price && disc && compareMoney(disc, price) <= 0 ? finalAmount(price, discount) : null;
  const down = safeMoney(downPayment);
  const remaining =
    final && down && compareMoney(down, final) < 0 ? subtractMoney(final, down) : null;
  const scheduleRows = installments.filter((r) => safeMoney(r.amount) !== null);
  const scheduleTotal =
    scheduleRows.length > 0 ? addMoney(...scheduleRows.map((r) => r.amount.trim())) : '0.00';

  function generateSchedule() {
    const values = getValues();
    const count = Number(values.number_of_installments);
    const ok =
      remaining &&
      compareMoney(remaining, 0) > 0 &&
      /^\d+$/.test(values.number_of_installments) &&
      count >= 1 &&
      count <= MAX_INSTALLMENTS &&
      values.installment_frequency !== '' &&
      values.start_date !== '';
    if (!ok) {
      setError('installments', { type: 'manual', message: t.validation.scheduleNotBuilt });
      return;
    }
    clearErrors('installments');
    schedule.replace(
      buildSchedule({
        total: remaining,
        count,
        frequency: values.installment_frequency as InstallmentFrequency,
        startDate: values.start_date,
      }),
    );
  }

  const submit = handleSubmit(async (values) => {
    setFormErrors([]);
    try {
      const contract = await salesContractsApi.create(toContractPayload(values));
      queryClient.setQueryData(contractKeys.detail(contract.id), contract);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [...contractKeys.all, 'list'] }),
        // The vehicle is sold; a reservation may have been converted; balances changed.
        queryClient.invalidateQueries({ queryKey: ['vehicles'] }),
        queryClient.invalidateQueries({ queryKey: ['reservations'] }),
        queryClient.invalidateQueries({ queryKey: ['customers'] }),
      ]);
      const state: ContractDetailLinkState = { notice: t.created };
      void navigate(`/sales-contracts/${String(contract.id)}`, { state });
    } catch (error) {
      if (isApiError(error) && error.kind === 'validation') {
        const unmatched = applyServerErrors(error, setError, CONTRACT_FORM_FIELDS);
        setFormErrors(unmatched.length > 0 ? unmatched : [t.serverErrors]);
      } else {
        // 409 business rules come with a localized message.
        setFormErrors([getErrorMessage(error)]);
      }
      window.scrollTo({ top: 0 });
    }
  });

  const err = (path: string): string | undefined => {
    let node: unknown = errors;
    for (const key of path.split('.')) {
      node = (node as Record<string, unknown> | undefined)?.[key];
    }
    return (node as { message?: string } | undefined)?.message;
  };

  const missing = [
    !lookups.canEmployees ? t.lookupEmployees : null,
    !lookups.canCashboxes && paymentType !== '' ? t.lookupCashboxes : null,
  ].filter((x) => x !== null);

  const frequencyOptions = lookups.frequencies.map((f) => ({
    value: f,
    label: labelOf(frequencyLabels, f),
  }));

  const receiptFields = (prefix: 'payment' | 'down_payment_receipt') => (
    <>
      <Select
        labelSize="md"
        label={t.cashbox}
        placeholder={lookups.cashboxOptions.length ? t.choose : t.noOptions}
        options={lookups.cashboxOptions}
        error={err(`${prefix}.cashbox_id`)}
        {...register(`${prefix}.cashbox_id`)}
      />
      <Select
        labelSize="md"
        label={t.paymentMethod}
        placeholder={t.choose}
        options={lookups.methodOptions}
        error={err(`${prefix}.payment_method`)}
        {...register(`${prefix}.payment_method`)}
      />
      <TextField
        label={t.reference}
        optional
        dir="ltr"
        maxLength={100}
        error={err(`${prefix}.reference`)}
        {...register(`${prefix}.reference`)}
      />
    </>
  );

  const grid = 'grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3';

  return (
    <section className="flex flex-col gap-5">
      <header className="flex flex-col gap-2">
        <Link to="/sales-contracts" className="text-sm text-accent hover:underline">
          → {ar.salesContracts.detail.back}
        </Link>
        <h1 className="text-2xl font-semibold text-fg">{t.title}</h1>
      </header>

      {missing.length > 0 ? (
        <Alert tone="warning">{interpolate(t.missingLookups, { what: missing.join('، ') })}</Alert>
      ) : null}

      <form
        noValidate
        onSubmit={(event) => {
          // The pickers live outside react-hook-form; copy their ids in before validating.
          setValue('vehicle_id', vehicle ? String(vehicle.id) : '');
          setValue('customer_id', customer ? String(customer.id) : '');
          void submit(event);
        }}
        className="flex flex-col gap-5"
      >
        {formErrors.length > 0 ? (
          <Alert tone="danger">
            <ul className="list-inside list-disc">
              {formErrors.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          </Alert>
        ) : null}

        <Card title={t.sections.parties}>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <EntityPicker<Vehicle>
              label={t.vehicle}
              hint={t.vehicleHint}
              error={err('vehicle_id')}
              searchPlaceholder={t.vehicleSearch}
              selected={vehicle ? vehicleOption(vehicle) : null}
              loading={vehicleChoice === undefined && presetVehicle.isLoading}
              onSelect={(_option, item) => {
                chooseVehicle(item ?? null);
              }}
              queryKey={contractKeys.vehicleOptions}
              queryFn={salesContractsApi.sellableVehicles}
              toOption={vehicleOption}
            />
            <div className="flex flex-col gap-2">
              {vehicle?.status === 'reserved' && reservedCustomer ? (
                <>
                  <p className="mb-1.5 text-sm font-medium text-fg">{t.customer}</p>
                  <div className="rounded-md border border-border-strong bg-surface-muted px-3 py-2.5 text-sm">
                    {reservedCustomer.name}
                  </div>
                  <Alert tone="info">
                    {interpolate(t.reservedFor, { name: reservedCustomer.name })}
                  </Alert>
                </>
              ) : (
                <>
                  <EntityPicker<Customer>
                    label={t.customer}
                    hint={t.customerHint}
                    error={err('customer_id')}
                    searchPlaceholder={t.customerSearch}
                    selected={customer}
                    loading={customerChoice === undefined && presetCustomer.isLoading}
                    onSelect={(option) => {
                      setCustomerChoice(option);
                    }}
                    queryKey={(s) => ['sales-contracts', 'customer-options', s]}
                    queryFn={reservationsApi.activeCustomers}
                    toOption={customerOption}
                  />
                  {vehicle?.status === 'reserved' && reservation.isError ? (
                    <Alert tone="warning">{t.reservedLookupError}</Alert>
                  ) : null}
                </>
              )}
            </div>
          </div>
          <div className={`${grid} mt-5`}>
            <Select
              labelSize="md"
              label={t.employee}
              placeholder={vehicle ? t.choose : t.employeeChooseVehicle}
              disabled={!vehicle || !lookups.canEmployees}
              hint={t.employeeHint}
              options={lookups.employeeOptions}
              error={err('sales_employee_id')}
              {...register('sales_employee_id')}
            />
            <TextField
              label={t.contractDate}
              type="date"
              max={todayIso()}
              error={err('contract_date')}
              {...register('contract_date')}
            />
          </div>
        </Card>

        <Card title={t.sections.price}>
          <div className={grid}>
            <TextField
              label={t.sellingPrice}
              inputMode="decimal"
              dir="ltr"
              error={err('selling_price')}
              {...register('selling_price')}
            />
            <TextField
              label={t.discount}
              optional
              inputMode="decimal"
              dir="ltr"
              error={err('discount')}
              {...register('discount')}
            />
            <Select
              labelSize="md"
              label={t.paymentType}
              placeholder={t.choose}
              options={PAYMENT_TYPES.map((type) => ({
                value: type,
                label: paymentTypeLabels[type],
              }))}
              error={err('payment_type')}
              {...register('payment_type', {
                onChange: () => {
                  setFormErrors([]);
                },
              })}
            />
          </div>
          {final ? (
            <p role="status" className="mt-4 text-sm font-medium text-fg">
              {interpolate(t.finalAmount, { amount: money(final) })}
            </p>
          ) : null}
        </Card>

        {paymentType === 'cash' ? (
          <Card title={t.sections.cash}>
            <div className={grid}>
              <TextField
                label={t.amount}
                inputMode="decimal"
                dir="ltr"
                hint={t.cashAmountHint}
                error={err('payment.amount')}
                {...register('payment.amount')}
              />
              <TextField
                label={t.paymentDate}
                type="date"
                max={todayIso()}
                error={err('payment.payment_date')}
                {...register('payment.payment_date')}
              />
              {receiptFields('payment')}
            </div>
          </Card>
        ) : null}

        {paymentType === 'installment' || paymentType === 'bank_financing' ? (
          <Card title={t.sections.down}>
            <div className={grid}>
              <TextField
                label={t.downPayment}
                inputMode="decimal"
                dir="ltr"
                hint={t.downPaymentHint}
                error={err('down_payment')}
                {...register('down_payment')}
              />
              {down && compareMoney(down, 0) > 0 ? receiptFields('down_payment_receipt') : null}
            </div>
            {down && compareMoney(down, 0) > 0 ? (
              <p className="mt-3 text-xs text-fg-muted">{t.downReceiptHint}</p>
            ) : null}
            {remaining ? (
              <p role="status" className="mt-3 text-sm font-medium text-fg">
                {interpolate(t.remaining, { amount: money(remaining) })}
              </p>
            ) : null}
          </Card>
        ) : null}

        {paymentType === 'installment' ? (
          <Card title={t.sections.installments}>
            <div className={grid}>
              <Select
                labelSize="md"
                label={t.frequency}
                placeholder={t.choose}
                options={frequencyOptions}
                error={err('installment_frequency')}
                {...register('installment_frequency')}
              />
              <TextField
                label={t.startDate}
                type="date"
                error={err('start_date')}
                {...register('start_date')}
              />
              <TextField
                label={t.count}
                inputMode="numeric"
                dir="ltr"
                error={err('number_of_installments')}
                {...register('number_of_installments')}
              />
            </div>
            <div className="mt-4 flex flex-col gap-3">
              <div>
                <Button variant="secondary" onClick={generateSchedule}>
                  {schedule.fields.length > 0 ? t.rebuildSchedule : t.buildSchedule}
                </Button>
              </div>
              <p className="text-xs text-fg-muted">{t.scheduleHint}</p>
              {err('installments') ? (
                <p role="alert" className="text-sm text-danger">
                  {err('installments')}
                </p>
              ) : null}
              {schedule.fields.length > 0 ? (
                <>
                  <ol className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {schedule.fields.map((field, index) => (
                      <li
                        key={field.id}
                        className="grid grid-cols-[2rem_minmax(0,1fr)_minmax(0,1fr)] items-start gap-2"
                      >
                        <span className="pt-8 text-sm text-fg-muted tabular-nums">{index + 1}</span>
                        <TextField
                          label={interpolate(t.installmentAmount, { index: index + 1 })}
                          inputMode="decimal"
                          dir="ltr"
                          error={err(`installments.${String(index)}.amount`)}
                          {...register(`installments.${index}.amount`)}
                        />
                        <TextField
                          label={interpolate(t.installmentDate, { index: index + 1 })}
                          type="date"
                          error={err(`installments.${String(index)}.due_date`)}
                          {...register(`installments.${index}.due_date`)}
                        />
                      </li>
                    ))}
                  </ol>
                  {remaining ? (
                    <p
                      role="status"
                      className={`text-sm font-medium ${
                        compareMoney(scheduleTotal, remaining) === 0 ? 'text-fg' : 'text-danger'
                      }`}
                    >
                      {interpolate(t.scheduleTotal, {
                        total: money(scheduleTotal),
                        remaining: money(remaining),
                      })}
                    </p>
                  ) : null}
                </>
              ) : null}
            </div>
          </Card>
        ) : null}

        {paymentType === 'bank_financing' ? (
          <Card title={t.sections.financing}>
            <div className={grid}>
              <Select
                labelSize="md"
                label={t.bank}
                placeholder={lookups.bankOptions.length ? t.choose : t.noOptions}
                options={lookups.bankOptions}
                error={err('bank_financing.bank_id')}
                {...register('bank_financing.bank_id')}
              />
              <TextField
                label={t.expectedAmount}
                inputMode="decimal"
                dir="ltr"
                hint={t.expectedHint}
                error={err('bank_financing.expected_amount')}
                {...register('bank_financing.expected_amount')}
              />
              <TextField
                label={t.applicationDate}
                type="date"
                max={todayIso()}
                error={err('bank_financing.application_date')}
                {...register('bank_financing.application_date')}
              />
              <TextField
                label={t.bankReference}
                optional
                dir="ltr"
                maxLength={100}
                error={err('bank_financing.transaction_reference')}
                {...register('bank_financing.transaction_reference')}
              />
            </div>
            <div className="mt-4">
              <TextArea
                label={t.internalNotes}
                optional
                rows={2}
                maxLength={2000}
                error={err('bank_financing.internal_notes')}
                {...register('bank_financing.internal_notes')}
              />
            </div>
          </Card>
        ) : null}

        <Card title={t.sections.extra}>
          <TextArea
            label={t.notes}
            optional
            rows={3}
            maxLength={2000}
            error={err('notes')}
            {...register('notes')}
          />
        </Card>

        <div className="flex flex-wrap gap-3">
          <Button
            type="submit"
            variant="primary"
            loading={isSubmitting}
            loadingLabel={t.saving}
            disabled={missing.length > 0}
          >
            {t.save}
          </Button>
          <Link
            to="/sales-contracts"
            className="inline-flex h-10 items-center rounded-md px-4 text-sm text-fg-secondary hover:bg-surface-muted"
          >
            {t.cancel}
          </Link>
        </div>
      </form>
    </section>
  );
}
