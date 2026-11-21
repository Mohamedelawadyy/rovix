import { type ReactNode, useEffect, useId, useRef } from 'react';

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  /** Action buttons, rendered at the bottom. */
  footer?: ReactNode;
  /** While a request runs, Escape/backdrop must not close the dialog. */
  dismissible?: boolean;
}

/**
 * Modal built on the native <dialog>: the browser provides the focus trap, Escape handling,
 * top-layer rendering and an inert background — no dependency needed.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  dismissible = true,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || !open) return;
    // Remember the trigger so focus goes back to it however the dialog ends: closed, or
    // unmounted by the parent (removing an open <dialog> would otherwise drop focus on <body>).
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!dialog.open) dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
      if (trigger?.isConnected) trigger.focus();
    };
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-lg border border-border bg-surface p-0 text-fg shadow-lg backdrop:bg-sidebar/60"
      onCancel={(event) => {
        // Escape key
        event.preventDefault();
        if (dismissible) onClose();
      }}
      onClick={(event) => {
        // A click on the backdrop targets the <dialog> element itself.
        if (event.target === event.currentTarget && dismissible) onClose();
      }}
    >
      {open ? (
        <div className="flex flex-col gap-4 p-5">
          <h2 id={titleId} className="text-lg font-semibold">
            {title}
          </h2>
          {description ? (
            <div id={descriptionId} className="text-sm text-fg-secondary">
              {description}
            </div>
          ) : null}
          {children}
          {footer ? <div className="flex flex-wrap justify-end gap-2 pt-1">{footer}</div> : null}
        </div>
      ) : null}
    </dialog>
  );
}
