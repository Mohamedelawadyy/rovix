import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Select } from '@/components/ui/Select';
import { TextArea } from '@/components/ui/TextArea';
import { TextField } from '@/components/ui/TextField';
import { isValidReason } from '@/features/reservations/types';
import { isApiError } from '@/lib/api';
import { getErrorMessage } from '@/lib/api/error-message';
import { compareMoney, formatMoney } from '@/lib/money/money';
import { ar, interpolate } from '@/locales/ar';
import { contractKeys, salesContractsApi } from '../api/sales-contracts-api';
import { MAX_MONEY, todayIso } from '../contract-form-schema';
import type { SalesContract } from '../types';
import { useContractLookups } from '../use-contract-lookups';

const MONEY = /^\d+(\.\d{1,2})?$/;

function useRefreshContract(id: number) {
  const queryClient = useQueryClient();
  return async (updated?: SalesContract) => {
    if (updated) queryClient.setQueryData(contractKeys.detail(id), updated);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: contractKeys.all }),
      queryClient.invalidateQueries({ queryKey: ['customers'] }),
      queryClient.invalidateQueries({ queryKey: ['vehicles'] }),
      queryClient.invalidateQueries({ queryKey: ['reservations'] }),
    ]);
  };
}

function fieldError(error: unknown, field: string): string | undefined {
  return isApiError(error) && error.kind === 'validation' ? error.fieldError(field) : undefined;
}

/**
 * POST /sales-contracts/{id}/payments — cash and bank-financing contracts (treasury.create).
 * Mirrors ContractPaymentRequest; overpayment is rejected by the backend (409).
 */
export function RecordPaymentDialog({
  contract,
  onClose,
  onDone,
}: {
  contract: SalesContract;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const t = ar.salesContracts.payment;
  const f = ar.salesContracts.form;
  const v = f.validation;
  const lookups = useContractLookups({ branchId: null, needsCashbox: true, needsBank: false });
  const refresh = useRefreshContract(contract.id);
  const [values, setValues] = useState({
    amount: '',
    cashbox_id: '',
    payment_method: '',
    payment_date: todayIso(),
    reference: '',
    notes: '',
  });
  const [touched, setTouched] = useState(false);
  const set = (key: keyof typeof values) => (event: { target: { value: string } }) => {
    setValues((current) => ({ ...current, [key]: event.target.value }));
  };

  const amount = values.amount.trim();
  const clientErrors = {
    amount: !amount
      ? v.required
      : !MONEY.test(amount) || compareMoney(amount, MAX_MONEY) > 0
        ? v.money
        : compareMoney(amount, 0) <= 0
          ? v.positiveMoney
          : compareMoney(amount, contract.outstanding_amount) > 0
            ? v.paymentTooHigh
            : undefined,
    cashbox_id: values.cashbox_id ? undefined : v.required,
    payment_method: values.payment_method ? undefined : v.required,
    payment_date: !values.payment_date
      ? v.required
      : values.payment_date > todayIso()
        ? v.notFuture
        : undefined,
  };
  const valid = Object.values(clientErrors).every((e) => e === undefined);

  const mutation = useMutation({
    mutationFn: () =>
      salesContractsApi.recordPayment(contract.id, {
        amount,
        cashbox_id: Number(values.cashbox_id),
        payment_method: values.payment_method,
        payment_date: values.payment_date,
        reference: values.reference.trim() || null,
        notes: values.notes.trim() || null,
      }),
    onSuccess: async () => {
      await refresh();
      onDone(t.done);
    },
  });
  const known = ['amount', 'cashbox_id', 'payment_method', 'payment_date', 'reference', 'notes'];
  const formError =
    mutation.error && !known.some((k) => fieldError(mutation.error, k))
      ? getErrorMessage(mutation.error)
      : null;
  const show = (key: keyof typeof clientErrors) =>
    (touched ? clientErrors[key] : undefined) ?? fieldError(mutation.error, key);

  return (
    <Dialog
      open
      onClose={onClose}
      dismissible={!mutation.isPending}
      title={t.title}
      description={interpolate(t.outstanding, { amount: formatMoney(contract.outstanding_amount) })}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={mutation.isPending}>
            {t.close}
          </Button>
          <Button
            variant="primary"
            loading={mutation.isPending}
            loadingLabel={t.saving}
            onClick={() => {
              setTouched(true);
              if (valid) mutation.mutate();
            }}
          >
            {t.save}
          </Button>
        </>
      }
    >
      {formError ? <Alert tone="danger">{formError}</Alert> : null}
      {!lookups.canCashboxes ? (
        <Alert tone="warning">{interpolate(f.missingLookups, { what: f.lookupCashboxes })}</Alert>
      ) : null}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TextField
          label={f.amount}
          inputMode="decimal"
          dir="ltr"
          value={values.amount}
          error={show('amount')}
          onChange={set('amount')}
        />
        <TextField
          label={f.paymentDate}
          type="date"
          max={todayIso()}
          value={values.payment_date}
          error={show('payment_date')}
          onChange={set('payment_date')}
        />
        <Select
          labelSize="md"
          label={f.cashbox}
          placeholder={lookups.cashboxOptions.length ? f.choose : f.noOptions}
          options={lookups.cashboxOptions}
          value={values.cashbox_id}
          error={show('cashbox_id')}
          onChange={set('cashbox_id')}
        />
        <Select
          labelSize="md"
          label={f.paymentMethod}
          placeholder={f.choose}
          options={lookups.methodOptions}
          value={values.payment_method}
          error={show('payment_method')}
          onChange={set('payment_method')}
        />
        <TextField
          label={f.reference}
          optional
          dir="ltr"
          maxLength={100}
          value={values.reference}
          error={fieldError(mutation.error, 'reference')}
          onChange={set('reference')}
        />
      </div>
      <TextArea
        label={t.notes}
        optional
        rows={2}
        maxLength={1000}
        value={values.notes}
        error={fieldError(mutation.error, 'notes')}
        onChange={set('notes')}
      />
    </Dialog>
  );
}

export function CancelContractDialog({
  contract,
  onClose,
  onDone,
}: {
  contract: SalesContract;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const t = ar.salesContracts.cancel;
  const refresh = useRefreshContract(contract.id);
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const mutation = useMutation({
    mutationFn: () => salesContractsApi.cancel(contract.id, reason.trim()),
    onSuccess: async (updated) => {
      await refresh(updated);
      onDone(t.done);
    },
  });
  const serverFieldError = fieldError(mutation.error, 'reason');
  const formError = mutation.error && !serverFieldError ? getErrorMessage(mutation.error) : null;

  return (
    <Dialog
      open
      onClose={onClose}
      dismissible={!mutation.isPending}
      title={t.title}
      description={t.body}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={mutation.isPending}>
            {t.close}
          </Button>
          <Button
            variant="danger"
            loading={mutation.isPending}
            loadingLabel={t.working}
            onClick={() => {
              setTouched(true);
              if (isValidReason(reason)) mutation.mutate();
            }}
          >
            {t.confirm}
          </Button>
        </>
      }
    >
      {formError ? <Alert tone="danger">{formError}</Alert> : null}
      <TextArea
        label={t.reason}
        hint={t.reasonHint}
        rows={3}
        maxLength={255}
        value={reason}
        error={
          (touched && !isValidReason(reason) ? t.reasonInvalid : undefined) ?? serverFieldError
        }
        onChange={(event) => {
          setReason(event.target.value);
        }}
      />
    </Dialog>
  );
}
