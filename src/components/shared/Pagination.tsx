import type { Pagination as PaginationMeta } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { formatNumber } from '@/lib/format';
import { ar, interpolate } from '@/locales/ar';

/** Previous/next pager for the backend's `{ current_page, last_page, total, per_page }`. */
export function Pagination({
  meta,
  onPageChange,
}: {
  meta: PaginationMeta;
  onPageChange: (page: number) => void;
}) {
  const { current_page: page, last_page: last, total, per_page: perPage } = meta;
  const from = total === 0 ? 0 : (page - 1) * perPage + 1;
  const to = Math.min(page * perPage, total);

  return (
    <nav
      aria-label={ar.list.pagination}
      className="flex flex-wrap items-center justify-between gap-3 text-sm text-fg-secondary"
    >
      <p>
        {interpolate(ar.list.range, {
          from: formatNumber(from),
          to: formatNumber(to),
          total: formatNumber(total),
        })}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          disabled={page <= 1}
          onClick={() => {
            onPageChange(page - 1);
          }}
        >
          {ar.list.previous}
        </Button>
        <span aria-current="page">
          {interpolate(ar.list.pageOf, { page: formatNumber(page), last: formatNumber(last) })}
        </span>
        <Button
          variant="secondary"
          disabled={page >= last}
          onClick={() => {
            onPageChange(page + 1);
          }}
        >
          {ar.list.next}
        </Button>
      </div>
    </nav>
  );
}
