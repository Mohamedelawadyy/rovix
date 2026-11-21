import { Link, useLocation } from 'react-router';
import { Badge } from '@/components/ui/Badge';
import { formatDate } from '@/lib/format';
import { ar } from '@/locales/ar';
import { customerStatusLabels, customerStatusTone } from '../labels';
import type { CustomerDetailLinkState } from '../pages/CustomerDetailPage';
import type { Customer } from '../types';

const c = ar.customers.columns;
const NA = ar.common.notAvailable;

export function CustomersTable({ customers, busy }: { customers: Customer[]; busy: boolean }) {
  const location = useLocation();
  const linkState: CustomerDetailLinkState = { listSearch: location.search };

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-surface">
      <table aria-busy={busy} className="w-full min-w-[48rem] text-sm">
        <caption className="sr-only">{ar.customers.title}</caption>
        <thead className="bg-surface-muted text-xs text-fg-secondary">
          <tr>
            <th scope="col" className="px-4 py-3 text-start font-medium">
              {c.code}
            </th>
            <th scope="col" className="px-4 py-3 text-start font-medium">
              {c.name}
            </th>
            <th scope="col" className="px-4 py-3 text-start font-medium">
              {c.phone}
            </th>
            <th scope="col" className="px-4 py-3 text-start font-medium">
              {c.nationalId}
            </th>
            <th scope="col" className="px-4 py-3 text-start font-medium">
              {c.branch}
            </th>
            <th scope="col" className="px-4 py-3 text-start font-medium">
              {c.createdAt}
            </th>
            <th scope="col" className="px-4 py-3 text-start font-medium">
              {c.status}
            </th>
          </tr>
        </thead>
        <tbody className={`divide-y divide-border ${busy ? 'opacity-60' : ''}`}>
          {customers.map((customer) => (
            <tr key={customer.id} className="hover:bg-canvas">
              <td className="px-4 py-3 font-medium whitespace-nowrap" dir="ltr">
                {customer.customer_code}
              </td>
              <td className="px-4 py-3">
                <Link
                  to={`/customers/${String(customer.id)}`}
                  state={linkState}
                  className="font-medium text-fg hover:text-accent hover:underline"
                >
                  {customer.name}
                </Link>
                {customer.email ? (
                  <div className="text-xs text-fg-muted" dir="ltr">
                    <span className="inline-block">{customer.email}</span>
                  </div>
                ) : null}
              </td>
              <td className="px-4 py-3 whitespace-nowrap tabular-nums" dir="ltr">
                <span className="inline-block">{customer.phone}</span>
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-fg-secondary tabular-nums" dir="ltr">
                <span className="inline-block">{customer.national_id ?? NA}</span>
              </td>
              <td className="px-4 py-3 whitespace-nowrap">{customer.branch?.name ?? NA}</td>
              <td className="px-4 py-3 whitespace-nowrap">{formatDate(customer.created_at)}</td>
              <td className="px-4 py-3">
                <Badge tone={customerStatusTone[customer.status]}>
                  {customerStatusLabels[customer.status]}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
