"use client";

import { useEffect } from "react";

/**
 * Error boundary for the hub layout.
 * Catches React rendering errors in any hub page and shows
 * a recovery UI instead of white-screening the entire app.
 */
export default function HubError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[hub] Uncaught error:", error);
  }, [error]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "60vh",
        gap: "1rem",
        padding: "2rem",
        textAlign: "center",
      }}
    >
      <h2
        style={{
          fontSize: "1.25rem",
          fontWeight: 600,
          color: "var(--color-text-primary)",
        }}
      >
        Something went wrong
      </h2>
      <p
        style={{
          color: "var(--color-text-secondary)",
          maxWidth: "28rem",
          lineHeight: 1.5,
        }}
      >
        An unexpected error occurred. You can try again, or refresh the page if
        the problem persists.
      </p>
      <button
        onClick={reset}
        style={{
          padding: "0.5rem 1.25rem",
          borderRadius: "0.5rem",
          backgroundColor: "var(--color-accent-primary)",
          color: "#fff",
          border: "none",
          cursor: "pointer",
          fontSize: "0.875rem",
          fontWeight: 500,
        }}
      >
        Try again
      </button>
      {error.digest && (
        <p
          style={{
            fontSize: "0.75rem",
            color: "var(--color-text-tertiary)",
            marginTop: "0.5rem",
          }}
        >
          Error ID: {error.digest}
        </p>
      )}
    </div>
  );
}
