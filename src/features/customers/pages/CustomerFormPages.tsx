import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { ForbiddenPage, NotFoundPage } from '@/app/pages/StatusPages';
import { Alert } from '@/components/ui/Alert';
import { useAuth } from '@/features/auth/auth-context';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { isApiError } from '@/lib/api';
import { getErrorMessage } from '@/lib/api/error-message';
import { parseRouteId } from '@/lib/route-id';
import { ar, interpolate } from '@/locales/ar';
import { customerKeys, customersApi } from '../api/customers-api';
import { CustomerForm } from '../components/CustomerForm';
import {
  customerToFormValues,
  emptyCustomerForm,
  NATIONAL_ID_PATTERN,
  type CustomerPayload,
} from '../customer-form-schema';
import { isRevealedNationalId, type Customer } from '../types';
import type { CustomerDetailLinkState } from './CustomerDetailPage';

const t = ar.customers.form;

/** Values carried from the national-ID lookup when no customer matched. */
export interface CustomerFormPrefill {
  national_id?: string;
  branch_id?: string;
}

function useOnSaved() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return (customer: Customer, notice: string) => {
    queryClient.setQueryData(customerKeys.detail(customer.id), customer);
    void queryClient.invalidateQueries({ queryKey: [...customerKeys.all, 'list'] });
    const state: CustomerDetailLinkState = { notice };
    void navigate(`/customers/${String(customer.id)}`, { state });
  };
}

function PageHeader({ title, back }: { title: string; back: string }) {
  return (
    <header className="flex flex-col gap-2">
      <Link to={back} className="text-sm text-accent hover:underline">
        → {ar.customers.detail.back}
      </Link>
      <h1 className="text-2xl font-semibold text-fg">{title}</h1>
    </header>
  );
}

/** /customers/new — guarded by `customers.create` in the router. */
export function CustomerCreatePage() {
  useDocumentTitle(t.createTitle);
  const onSaved = useOnSaved();
  const prefill = (useLocation().state ?? {}) as CustomerFormPrefill;
  const nationalId =
    prefill.national_id && NATIONAL_ID_PATTERN.test(prefill.national_id) ? prefill.national_id : '';

  return (
    <section className="flex flex-col gap-5">
      <PageHeader title={t.createTitle} back="/customers" />
      <CustomerForm
        mode="create"
        defaultValues={{
          ...emptyCustomerForm,
          national_id: nationalId,
          branch_id: prefill.branch_id ?? '',
        }}
        cancelTo="/customers"
        onSubmit={async (payload: CustomerPayload) => {
          onSaved(await customersApi.create(payload), t.created);
        }}
      />
    </section>
  );
}

/** /customers/:customerId/edit — guarded by `customers.update` in the router. */
export function CustomerEditPage() {
  const id = parseRouteId(useParams().customerId);
  if (id === null) return <NotFoundPage />;
  return <CustomerEdit id={id} />;
}

function CustomerEdit({ id }: { id: number }) {
  const { can } = useAuth();
  const onSaved = useOnSaved();
  // Users allowed to see the national ID edit the real value; others keep it masked.
  const reveal = can('customers.view-sensitive');
  const query = useQuery({
    queryKey: reveal ? customerKeys.sensitive(id) : customerKeys.detail(id),
    queryFn: ({ signal }) => customersApi.get(id, { revealNationalId: reveal }, signal),
    gcTime: reveal ? 0 : undefined,
  });
  const customer = query.data;
  useDocumentTitle(customer ? interpolate(t.editTitle, { name: customer.name }) : t.edit);

  const error = query.error;
  if (isApiError(error) && error.kind === 'not_found') return <NotFoundPage />;
  if (isApiError(error) && error.kind === 'forbidden') return <ForbiddenPage />;

  const detailPath = `/customers/${String(id)}`;

  if (!customer) {
    return (
      <section className="flex flex-col gap-5">
        <PageHeader title={t.edit} back={detailPath} />
        {query.isError ? (
          <Alert tone="danger">
            {ar.list.loadError} {getErrorMessage(error)}
          </Alert>
        ) : (
          <p role="status" className="py-12 text-center text-fg-muted">
            {ar.common.loading}
          </p>
        )}
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-5">
      <PageHeader title={interpolate(t.editTitle, { name: customer.name })} back={detailPath} />
      <CustomerForm
        mode="edit"
        defaultValues={customerToFormValues(customer)}
        maskedNationalId={isRevealedNationalId(customer.national_id) ? null : customer.national_id}
        cancelTo={detailPath}
        onSubmit={async (payload: CustomerPayload) => {
          onSaved(await customersApi.update(id, payload), t.updated);
        }}
      />
    </section>
  );
}
