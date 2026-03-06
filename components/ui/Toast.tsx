"use client";

import type { ToastItem } from "@/lib/types";

interface ToastContainerProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  return (
    <div
      className="fixed right-4 top-4 z-[60] flex flex-col gap-2"
      style={{ zIndex: "var(--z-notification)" }}
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="alert"
          className="rounded-lg border border-[var(--color-border-default)] bg-[#1A1D3A] px-4 py-3 shadow-lg"
          style={{
            borderLeftWidth: 4,
            borderLeftColor:
              toast.type === "error"
                ? "var(--color-accent-error)"
                : toast.type === "success"
                  ? "var(--color-accent-success)"
                  : toast.type === "warning"
                    ? "var(--color-accent-warning)"
                    : "var(--color-accent-primary)",
          }}
        >
          <div className="font-semibold text-white">{toast.title}</div>
          {toast.message && (
            <div className="mt-1 text-sm text-[var(--color-text-secondary)]">
              {toast.message}
            </div>
          )}
          <button
            type="button"
            onClick={() => onDismiss(toast.id)}
            className="mt-2 text-xs text-[var(--color-text-tertiary)] underline hover:text-white"
          >
            Dismiss
          </button>
        </div>
      ))}
    </div>
  );
}
