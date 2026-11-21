import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { ForbiddenPage, NotFoundPage } from '@/app/pages/StatusPages';
import { Card, DetailList, type DetailItem } from '@/components/shared/DetailList';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { useAuth } from '@/features/auth/auth-context';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { isApiError } from '@/lib/api';
import { getErrorMessage } from '@/lib/api/error-message';
import { formatDate } from '@/lib/format';
import { parseRouteId } from '@/lib/route-id';
import { ar, interpolate } from '@/locales/ar';
import { customerKeys, customersApi } from '../api/customers-api';
import {
  CustomerBalanceCard,
  CustomerContractsCard,
  CustomerPaymentsCard,
} from '../components/CustomerAccount';
import { customerStatusLabels, customerStatusTone } from '../labels';
import { isRevealedNationalId, type Customer } from '../types';

const t = ar.customers.detail;
const NA = ar.common.notAvailable;

/** List URL state carried by links into the page, so "back" restores filters and page. */
export interface CustomerDetailLinkState {
  listSearch?: string;
  /** One-off confirmation after a save or lookup. */
  notice?: string;
}

export function CustomerDetailPage() {
  const id = parseRouteId(useParams().customerId);
  if (id === null) return <NotFoundPage />;
  return <CustomerDetail id={id} />;
}

function CustomerDetail({ id }: { id: number }) {
  const { can } = useAuth();
  const location = useLocation();
  const linkState = location.state as CustomerDetailLinkState | null;
  const listSearch = linkState?.listSearch ?? '';
  const [deleting, setDeleting] = useState(false);

  const query = useQuery({
    queryKey: customerKeys.detail(id),
    queryFn: ({ signal }) => customersApi.get(id, {}, signal),
  });
  const customer = query.data;
  useDocumentTitle(customer ? `${customer.name} · ${customer.customer_code}` : ar.customers.title);

  const error = query.error;
  if (isApiError(error) && error.kind === 'not_found') return <NotFoundPage />;
  // Customer not linked to any of the user's branches.
  if (isApiError(error) && error.kind === 'forbidden') return <ForbiddenPage />;

  const backLink = (
    <Link to={`/customers${listSearch}`} className="text-sm text-accent hover:underline">
      → {t.back}
    </Link>
  );

  if (!customer) {
    return (
      <section className="flex flex-col gap-4">
        {backLink}
        {query.isError ? (
          <Alert tone="danger">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span>
                {ar.list.loadError} {getErrorMessage(error)}
              </span>
              <Button
                variant="secondary"
                onClick={() => {
                  void query.refetch();
                }}
              >
                {ar.common.retry}
              </Button>
            </div>
          </Alert>
        ) : (
          <p role="status" className="py-12 text-center text-fg-muted">
            {ar.common.loading}
          </p>
        )}
      </section>
    );
  }

  const f = t.fields;
  const details: DetailItem[] = [
    { label: f.code, value: customer.customer_code, ltr: true },
    {
      label: f.phone,
      value: (
        <a href={`tel:${customer.phone}`} className="hover:text-accent hover:underline">
          {customer.phone}
        </a>
      ),
      ltr: true,
    },
    { label: f.email, value: customer.email ?? NA, ltr: Boolean(customer.email) },
    {
      label: f.nationalId,
      value: <NationalIdValue customer={customer} canReveal={can('customers.view-sensitive')} />,
    },
    { label: f.branch, value: customer.branch?.name ?? NA },
    { label: f.address, value: customer.address ?? NA },
    { label: f.createdAt, value: formatDate(customer.created_at) },
  ];

  return (
    <article className="flex flex-col gap-5">
      {backLink}

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-fg">{customer.name}</h1>
          <p className="mt-1 text-sm text-fg-muted" dir="ltr">
            <span className="inline-block">{customer.customer_code}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone={customerStatusTone[customer.status]}>
            {customerStatusLabels[customer.status]}
          </Badge>
          {can('customers.update') ? (
            <Link
              to={`/customers/${String(customer.id)}/edit`}
              className="inline-flex h-10 items-center rounded-md border border-border-strong bg-surface px-4 text-sm font-medium text-fg hover:bg-surface-muted"
            >
              {ar.customers.form.edit}
            </Link>
          ) : null}
          {can('customers.delete') ? (
            <Button
              variant="danger"
              onClick={() => {
                setDeleting(true);
              }}
            >
              {ar.customers.actions.delete}
            </Button>
          ) : null}
        </div>
      </header>

      {linkState?.notice ? <Alert tone="success">{linkState.notice}</Alert> : null}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card title={t.sections.info}>
          <DetailList items={details} />
        </Card>
        <CustomerBalanceCard customerId={customer.id} />
      </div>

      {customer.notes ? (
        <Card title={t.sections.notes}>
          <p className="text-sm whitespace-pre-line text-fg">{customer.notes}</p>
        </Card>
      ) : null}

      <CustomerContractsCard customerId={customer.id} />
      <CustomerPaymentsCard customerId={customer.id} />

      {deleting ? (
        <DeleteCustomerDialog
          customer={customer}
          onClose={() => {
            setDeleting(false);
          }}
        />
      ) : null}
    </article>
  );
}

/**
 * Masked by default. With customers.view-sensitive the user can explicitly fetch the full number
 * (`?include=national_id`); it is never cached beyond this page view.
 */
function NationalIdValue({ customer, canReveal }: { customer: Customer; canReveal: boolean }) {
  const [revealed, setRevealed] = useState(false);
  const sensitive = useQuery({
    queryKey: customerKeys.sensitive(customer.id),
    queryFn: ({ signal }) => customersApi.get(customer.id, { revealNationalId: true }, signal),
    enabled: revealed,
    gcTime: 0,
    staleTime: 0,
  });

  if (!customer.national_id) return NA;

  const full = revealed && isRevealedNationalId(sensitive.data?.national_id);
  const shown = full ? sensitive.data?.national_id : customer.national_id;

  return (
    <span className="flex flex-wrap items-center gap-2">
      <span dir="ltr" className="inline-block tabular-nums">
        {shown}
      </span>
      {canReveal ? (
        <button
          type="button"
          aria-busy={(revealed && sensitive.isFetching) || undefined}
          className="rounded text-xs font-medium text-accent hover:underline"
          onClick={() => {
            setRevealed((value) => !value);
          }}
        >
          {revealed && sensitive.isFetching ? t.revealing : revealed ? t.hide : t.reveal}
        </button>
      ) : null}
      {revealed && sensitive.isError ? (
        <span role="alert" className="text-xs text-danger">
          {t.revealError}
        </span>
      ) : null}
    </span>
  );
}

function DeleteCustomerDialog({ customer, onClose }: { customer: Customer; onClose: () => void }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const a = ar.customers.actions;
  const mutation = useMutation({
    mutationFn: () => customersApi.remove(customer.id),
    onSuccess: async () => {
      // Leave first, so the deleted record is not refetched (404) while still on screen.
      await navigate('/customers', { replace: true });
      queryClient.removeQueries({ queryKey: customerKeys.detail(customer.id) });
      await queryClient.invalidateQueries({ queryKey: [...customerKeys.all, 'list'] });
    },
  });

  return (
    <Dialog
      open
      onClose={onClose}
      dismissible={!mutation.isPending}
      title={a.deleteTitle}
      description={interpolate(a.deleteBody, { name: customer.name })}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={mutation.isPending}>
            {a.close}
          </Button>
          <Button
            variant="danger"
            loading={mutation.isPending}
            loadingLabel={a.working}
            onClick={() => {
              mutation.mutate();
            }}
          >
            {a.confirmDelete}
          </Button>
        </>
      }
    >
      {mutation.error ? <Alert tone="danger">{getErrorMessage(mutation.error)}</Alert> : null}
    </Dialog>
  );
}
