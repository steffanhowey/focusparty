"use client";

import { useEffect } from "react";

export default function HubError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Hub error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
        Something went wrong
      </h2>
      <p className="max-w-sm text-sm text-[var(--color-text-secondary)]">
        An unexpected error occurred. Try again or head back to Rooms.
      </p>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="rounded-full px-5 py-2.5 text-sm font-medium text-white"
          style={{ background: "var(--color-accent-primary)" }}
        >
          Try again
        </button>
        <a
          href="/rooms"
          className="rounded-full border px-5 py-2.5 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]"
          style={{ borderColor: "var(--color-border-default)" }}
        >
          Back to Rooms
        </a>
      </div>
    </div>
  );
}
