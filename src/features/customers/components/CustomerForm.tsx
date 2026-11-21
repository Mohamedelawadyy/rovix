import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { Card } from '@/components/shared/DetailList';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { TextArea } from '@/components/ui/TextArea';
import { TextField } from '@/components/ui/TextField';
import { useBranchOptions } from '@/features/branches/use-branch-options';
import { isApiError } from '@/lib/api';
import { getErrorMessage } from '@/lib/api/error-message';
import { applyServerErrors } from '@/lib/forms/server-errors';
import { ar, interpolate } from '@/locales/ar';
import {
  createCustomerFormSchema,
  toCustomerPayload,
  type CustomerFormValues,
  type CustomerPayload,
} from '../customer-form-schema';
import { customerStatusLabels } from '../labels';
import { CUSTOMER_STATUSES } from '../types';

const t = ar.customers.form;
const f = t.fields;

const FORM_FIELDS = [
  'name',
  'phone',
  'customer_code',
  'email',
  'national_id',
  'address',
  'notes',
  'status',
  'branch_id',
] as const;

export interface CustomerFormProps {
  mode: 'create' | 'edit';
  defaultValues: CustomerFormValues;
  onSubmit: (payload: CustomerPayload) => Promise<unknown>;
  cancelTo: string;
  /**
   * Edit mode when the real national ID is not available to this user: the masked value is
   * shown as a hint and an empty field keeps the stored number.
   */
  maskedNationalId?: string | null;
}

export function CustomerForm({
  mode,
  defaultValues,
  onSubmit,
  cancelTo,
  maskedNationalId,
}: CustomerFormProps) {
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const branches = useBranchOptions({ enabled: mode === 'create' });
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CustomerFormValues>({
    resolver: zodResolver(createCustomerFormSchema(mode)),
    defaultValues: {
      ...defaultValues,
      // A single branch is chosen for the user.
      branch_id: defaultValues.branch_id || (mode === 'create' ? branches.defaultValue : ''),
    },
    mode: 'onTouched',
  });

  const submit = handleSubmit(async (values) => {
    setFormErrors([]);
    try {
      await onSubmit(toCustomerPayload(values, mode, defaultValues.national_id));
    } catch (error) {
      if (isApiError(error) && error.kind === 'validation') {
        const unmatched = applyServerErrors(error, setError, FORM_FIELDS);
        setFormErrors(unmatched.length > 0 ? unmatched : [t.serverErrors]);
      } else {
        setFormErrors([getErrorMessage(error)]);
      }
    }
  });

  const err = (name: keyof CustomerFormValues) => errors[name]?.message;
  const nationalIdHint =
    mode === 'edit' && maskedNationalId
      ? // LTR isolate keeps the masked digits in order inside the Arabic sentence.
        interpolate(f.nationalIdKeep, { masked: `⁦${maskedNationalId}⁩` })
      : f.nationalIdHint;

  return (
    <form noValidate onSubmit={(event) => void submit(event)} className="flex flex-col gap-5">
      {formErrors.length > 0 ? (
        <Alert tone="danger">
          <ul className="list-inside list-disc">
            {formErrors.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </Alert>
      ) : null}

      <Card title={t.sections.main}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <TextField label={f.name} autoComplete="off" error={err('name')} {...register('name')} />
          <TextField
            label={f.phone}
            type="tel"
            inputMode="tel"
            dir="ltr"
            hint={f.phoneHint}
            error={err('phone')}
            {...register('phone')}
          />
          <TextField
            label={f.nationalId}
            optional
            inputMode="numeric"
            dir="ltr"
            maxLength={14}
            autoComplete="off"
            hint={nationalIdHint}
            error={err('national_id')}
            {...register('national_id')}
          />
          {mode === 'create' ? (
            <Select
              labelSize="md"
              label={f.branch}
              placeholder={t.choose}
              options={branches.options}
              hint={f.branchHint}
              error={err('branch_id')}
              {...register('branch_id')}
            />
          ) : (
            <Select
              labelSize="md"
              label={f.status}
              options={CUSTOMER_STATUSES.map((s) => ({ value: s, label: customerStatusLabels[s] }))}
              error={err('status')}
              {...register('status')}
            />
          )}
        </div>
      </Card>

      <Card title={t.sections.extra}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <TextField
            label={f.customerCode}
            optional
            dir="ltr"
            maxLength={30}
            hint={mode === 'create' ? f.customerCodeHint : undefined}
            error={err('customer_code')}
            {...register('customer_code')}
          />
          <TextField
            label={f.email}
            optional
            type="email"
            dir="ltr"
            error={err('email')}
            {...register('email')}
          />
          <TextField
            label={f.address}
            optional
            maxLength={255}
            error={err('address')}
            {...register('address')}
          />
        </div>
        <div className="mt-4">
          <TextArea
            label={f.notes}
            optional
            rows={3}
            maxLength={2000}
            error={err('notes')}
            {...register('notes')}
          />
        </div>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button type="submit" variant="primary" loading={isSubmitting} loadingLabel={t.saving}>
          {mode === 'create' ? t.save : t.saveChanges}
        </Button>
        <Link
          to={cancelTo}
          className="inline-flex h-10 items-center rounded-md px-4 text-sm text-fg-secondary hover:bg-surface-muted"
        >
          {t.cancel}
        </Link>
      </div>
    </form>
  );
}
