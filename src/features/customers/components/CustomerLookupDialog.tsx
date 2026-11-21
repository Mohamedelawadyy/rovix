import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Select } from '@/components/ui/Select';
import { TextField } from '@/components/ui/TextField';
import { useBranchOptions } from '@/features/branches/use-branch-options';
import { isApiError } from '@/lib/api';
import { getErrorMessage } from '@/lib/api/error-message';
import { ar } from '@/locales/ar';
import { customerKeys, customersApi } from '../api/customers-api';
import { NATIONAL_ID_PATTERN } from '../customer-form-schema';
import type { CustomerFormPrefill } from '../pages/CustomerFormPages';
import type { CustomerDetailLinkState } from '../pages/CustomerDetailPage';

const t = ar.customers.lookup;
const v = ar.customers.form.validation;

/**
 * POST /customers/lookup: exact match by national ID across branches. A match is linked to the
 * chosen branch (a side effect the dialog states up front) and opened; no match offers to
 * register a new customer with that number.
 */
export function CustomerLookupDialog({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const branches = useBranchOptions();
  const [nationalId, setNationalId] = useState('');
  const [branchId, setBranchId] = useState('');
  const [touched, setTouched] = useState(false);
  const branch = branchId || branches.defaultValue;

  const lookup = useMutation({
    mutationFn: () =>
      customersApi.lookup({ national_id: nationalId.trim(), branch_id: Number(branch) }),
    onSuccess: async (customer) => {
      // The customer may be new to this branch's list.
      await queryClient.invalidateQueries({ queryKey: customerKeys.all });
      const state: CustomerDetailLinkState = { notice: t.found };
      void navigate(`/customers/${String(customer.id)}`, { state });
    },
  });

  const notFound = isApiError(lookup.error) && lookup.error.kind === 'not_found';
  const fieldError = (field: string) =>
    isApiError(lookup.error) && lookup.error.kind === 'validation'
      ? lookup.error.fieldError(field)
      : undefined;
  const otherError =
    lookup.error && !notFound && !fieldError('national_id') && !fieldError('branch_id')
      ? getErrorMessage(lookup.error)
      : null;

  const idError =
    touched && !NATIONAL_ID_PATTERN.test(nationalId.trim()) ? v.nationalId : undefined;
  const branchError = touched && branch === '' ? v.required : undefined;
  const prefill: CustomerFormPrefill = { national_id: nationalId.trim(), branch_id: branch };

  return (
    <Dialog
      open
      onClose={onClose}
      dismissible={!lookup.isPending}
      title={t.title}
      description={t.description}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={lookup.isPending}>
            {ar.customers.actions.close}
          </Button>
          <Button
            variant="primary"
            loading={lookup.isPending}
            loadingLabel={t.searching}
            onClick={() => {
              setTouched(true);
              if (NATIONAL_ID_PATTERN.test(nationalId.trim()) && branch !== '') {
                lookup.mutate();
              }
            }}
          >
            {t.submit}
          </Button>
        </>
      }
    >
      {otherError ? <Alert tone="danger">{otherError}</Alert> : null}
      {notFound ? (
        <Alert tone="info">
          <div className="flex flex-col gap-2">
            <span>{t.notFound}</span>
            <Link
              to="/customers/new"
              state={prefill}
              className="font-medium text-accent hover:underline"
            >
              {t.createWith}
            </Link>
          </div>
        </Alert>
      ) : null}
      <TextField
        label={t.nationalId}
        inputMode="numeric"
        dir="ltr"
        maxLength={14}
        autoComplete="off"
        value={nationalId}
        error={idError ?? fieldError('national_id')}
        onChange={(event) => {
          lookup.reset();
          setNationalId(event.target.value);
        }}
      />
      {branches.options.length !== 1 ? (
        <Select
          labelSize="md"
          label={t.branch}
          placeholder={ar.customers.form.choose}
          options={branches.options}
          value={branch}
          error={branchError ?? fieldError('branch_id')}
          onChange={(event) => {
            lookup.reset();
            setBranchId(event.target.value);
          }}
        />
      ) : null}
    </Dialog>
  );
}
