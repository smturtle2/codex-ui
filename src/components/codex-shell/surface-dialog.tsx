"use client";

import { forwardRef, type ReactNode } from "react";

type SurfaceDialogProps = {
  title: string;
  subtitle?: string | null;
  footer?: string | null;
  size?: "medium" | "wide";
  kickerLabel: string;
  closeLabel: string;
  onClose: () => void;
  children: ReactNode;
};

export const SurfaceDialog = forwardRef<HTMLDivElement, SurfaceDialogProps>(
  function SurfaceDialog(
    {
      title,
      subtitle = null,
      footer = null,
      size = "medium",
      kickerLabel,
      closeLabel,
      onClose,
      children,
    },
    ref,
  ) {
    return (
      <div className="screen-overlay" onClick={onClose}>
        <section
          ref={ref}
          className={`surface-dialog ${size === "wide" ? "wide" : "medium"}`}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-labelledby="surface-dialog-title"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="surface-dialog-header">
            <div className="surface-dialog-copy">
              <span className="surface-dialog-kicker">{kickerLabel}</span>
              <strong id="surface-dialog-title">{title}</strong>
              {subtitle ? <span className="surface-dialog-subtitle">{subtitle}</span> : null}
            </div>
            <button
              className="plain-action"
              type="button"
              data-autofocus="true"
              onClick={onClose}
            >
              {closeLabel}
            </button>
          </div>

          <div className="surface-dialog-body">{children}</div>

          {footer ? <div className="surface-dialog-footer">{footer}</div> : null}
        </section>
      </div>
    );
  },
);
