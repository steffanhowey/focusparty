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
      style={{ zIndex: "var(--sg-z-notification)" }}
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="alert"
          className="rounded-[var(--sg-radius-md)] border border-shell-border bg-white px-4 py-3 shadow-md"
          style={{
            borderLeftWidth: 4,
            borderLeftColor:
              toast.type === "error"
                ? "var(--sg-coral-500)"
                : toast.type === "success"
                  ? "var(--sg-forest-300)"
                  : toast.type === "warning"
                    ? "var(--sg-gold-600)"
                    : "var(--sg-forest-500)",
          }}
        >
          <div className="font-semibold text-shell-900">{toast.title}</div>
          {toast.message && (
            <div className="mt-1 text-sm text-shell-600">
              {toast.message}
            </div>
          )}
          <button
            type="button"
            onClick={() => onDismiss(toast.id)}
            className="mt-2 text-xs text-shell-500 underline hover:text-shell-900"
          >
            Dismiss
          </button>
        </div>
      ))}
    </div>
  );
}
