import { keepPreviousData, useQuery, type QueryKey } from '@tanstack/react-query';
import { useEffect, useId, useRef, useState } from 'react';
import type { Paginated } from '@/lib/api';
import { getErrorMessage } from '@/lib/api/error-message';
import { ar, interpolate } from '@/locales/ar';
import { SearchInput } from './SearchInput';

export interface PickerOption {
  id: number;
  title: string;
  subtitle?: string;
}

const t = ar.picker;

/**
 * Pick one record from a server-searched list (e.g. a vehicle or a customer). The selection
 * shows as a summary with a "change" button; while choosing, a debounced search lists up to one
 * page of results as buttons. Focus follows the switch so keyboard users don't get lost.
 */
export function EntityPicker<T>({
  label,
  hint,
  error,
  searchPlaceholder,
  selected,
  onSelect,
  queryKey,
  queryFn,
  toOption,
  loading = false,
}: {
  label: string;
  hint?: string;
  error?: string | undefined;
  searchPlaceholder: string;
  selected: PickerOption | null;
  onSelect: (option: PickerOption | null) => void;
  queryKey: (search: string) => QueryKey;
  queryFn: (search: string, signal: AbortSignal) => Promise<Paginated<T>>;
  toOption: (item: T) => PickerOption;
  /** A preselected record is still loading: show that instead of the search. */
  loading?: boolean;
}) {
  const id = useId();
  const [search, setSearch] = useState('');
  const changeRef = useRef<HTMLButtonElement>(null);
  const searchBoxRef = useRef<HTMLDivElement>(null);
  const focusNext = useRef(false);

  const query = useQuery({
    queryKey: queryKey(search),
    queryFn: ({ signal }) => queryFn(search, signal),
    enabled: selected === null && !loading,
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    if (!focusNext.current) return;
    focusNext.current = false;
    if (selected) changeRef.current?.focus();
    else searchBoxRef.current?.querySelector('input')?.focus();
  }, [selected]);

  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null]
    .filter(Boolean)
    .join(' ');
  const data = query.data;
  const options = data?.items.map(toOption) ?? [];

  return (
    <fieldset
      className="flex flex-col gap-2"
      aria-describedby={describedBy || undefined}
      aria-invalid={error ? true : undefined}
    >
      <legend className="mb-1.5 text-sm font-medium text-fg">{label}</legend>

      {loading ? (
        <p role="status" className="py-2.5 text-sm text-fg-muted">
          {ar.common.loading}
        </p>
      ) : selected ? (
        <div
          className={`flex items-center justify-between gap-3 rounded-md border bg-surface-muted px-3 py-2.5 ${
            error ? 'border-danger' : 'border-border-strong'
          }`}
        >
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-fg">{selected.title}</div>
            {selected.subtitle ? (
              <div className="truncate text-xs text-fg-muted">{selected.subtitle}</div>
            ) : null}
          </div>
          <button
            ref={changeRef}
            type="button"
            aria-label={`${t.change}: ${label}`}
            className="shrink-0 rounded text-sm font-medium text-accent hover:underline"
            onClick={() => {
              focusNext.current = true;
              onSelect(null);
            }}
          >
            {t.change}
          </button>
        </div>
      ) : (
        <div ref={searchBoxRef} className="flex flex-col gap-2">
          <SearchInput
            label={`${ar.list.search}: ${label}`}
            placeholder={searchPlaceholder}
            initialValue={search}
            onCommit={setSearch}
          />
          <p role="status" className="text-xs text-fg-muted">
            {query.isPending
              ? ar.common.loading
              : query.isError
                ? `${t.loadError} ${getErrorMessage(query.error)}`
                : data
                  ? data.items.length === 0
                    ? t.noResults
                    : data.pagination.total > data.items.length
                      ? `${interpolate(t.results, { count: data.pagination.total })} · ${t.more}`
                      : interpolate(t.results, { count: data.pagination.total })
                  : null}
          </p>
          {options.length > 0 ? (
            <ul
              aria-label={label}
              aria-busy={query.isFetching}
              className="max-h-64 divide-y divide-border overflow-y-auto rounded-md border border-border"
            >
              {options.map((option) => (
                <li key={option.id}>
                  <button
                    type="button"
                    className="flex w-full flex-col items-start px-3 py-2 text-start hover:bg-surface-muted focus-visible:bg-surface-muted"
                    onClick={() => {
                      focusNext.current = true;
                      onSelect(option);
                    }}
                  >
                    <span className="text-sm font-medium text-fg">{option.title}</span>
                    {option.subtitle ? (
                      <span className="text-xs text-fg-muted">{option.subtitle}</span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      )}

      {hint ? (
        <p id={`${id}-hint`} className="text-xs text-fg-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="text-xs text-danger">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
