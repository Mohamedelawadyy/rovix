import { useEffect, useId, useState } from 'react';

/**
 * Debounced search box. Remount it with `key={value}` to reset it when the value changes
 * from outside (e.g. back/forward navigation or "clear filters").
 */
export function SearchInput({
  label,
  placeholder,
  initialValue,
  onCommit,
  delay = 350,
}: {
  label: string;
  placeholder?: string;
  initialValue: string;
  onCommit: (value: string) => void;
  delay?: number;
}) {
  const id = useId();
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    if (value.trim() === initialValue.trim()) return;
    const timer = window.setTimeout(() => {
      onCommit(value.trim());
    }, delay);
    return () => {
      window.clearTimeout(timer);
    };
  }, [value, initialValue, onCommit, delay]);

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-medium text-fg-secondary">
        {label}
      </label>
      <input
        id={id}
        type="search"
        value={value}
        placeholder={placeholder}
        maxLength={100}
        className="h-10 rounded-md border border-border-strong bg-surface px-3 text-sm text-fg placeholder:text-fg-muted"
        onChange={(event) => {
          setValue(event.target.value);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') onCommit(value.trim());
        }}
      />
    </div>
  );
}
