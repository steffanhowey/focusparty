"use client";

import { Check, X, Loader2 } from "lucide-react";
import type { useUsernameValidation } from "@/lib/username";

type UsernameValidation = ReturnType<typeof useUsernameValidation>;

interface UsernameStepProps {
  username: UsernameValidation;
  saving: boolean;
  onConfirm: () => void;
  onSkip: () => void;
}

export default function UsernameStep({
  username,
  saving,
  onConfirm,
  onSkip,
}: UsernameStepProps) {
  const indicator = () => {
    switch (username.status) {
      case "checking":
        return (
          <Loader2
            size={16}
            className="animate-spin text-[var(--color-text-tertiary)]"
          />
        );
      case "available":
        return (
          <Check size={16} className="text-[var(--color-green-700)]" />
        );
      case "taken":
      case "invalid":
        return <X size={16} className="text-[var(--color-red-700)]" />;
      default:
        return null;
    }
  };

  return (
    <>
      <h1 className="text-2xl font-semibold text-[var(--color-text-primary)]">
        Pick a handle
      </h1>
      <p className="mt-2 text-[var(--color-text-secondary)]">
        This is how others will find you. You can always change it later.
      </p>

      <div className="mt-8 rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-hover)] p-6">
        <label className="mb-1.5 block text-xs font-medium text-[var(--color-text-secondary)]">
          Username
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-[var(--color-text-tertiary)]">
            @
          </span>
          <input
            type="text"
            value={username.value}
            onChange={(e) => username.setValue(e.target.value)}
            placeholder="your_handle"
            className="h-11 w-full rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-hover)] pl-8 pr-10 text-sm text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-border-focus)]"
            style={{
              borderColor:
                username.status === "available"
                  ? "var(--color-green-700)"
                  : username.status === "taken" || username.status === "invalid"
                    ? "var(--color-red-700)"
                    : undefined,
            }}
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2">
            {indicator()}
          </span>
        </div>
        {username.error && (
          <p className="mt-1.5 text-xs text-[var(--color-red-700)]">
            {username.error}
          </p>
        )}
        {username.status === "available" && (
          <p className="mt-1.5 text-xs text-[var(--color-green-700)]">
            @{username.value} is available
          </p>
        )}

        <button
          onClick={onConfirm}
          disabled={!username.isValid || saving}
          className="mt-5 inline-flex h-12 w-full items-center justify-center rounded-full bg-[var(--color-accent-primary)] font-medium text-white transition-opacity hover:opacity-85 active:opacity-75 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Let\u2019s go"}
        </button>
      </div>

      <button
        onClick={onSkip}
        disabled={saving}
        className="mx-auto mt-4 block text-xs text-[var(--color-text-tertiary)] underline decoration-[var(--color-border-default)] underline-offset-2 transition-colors hover:text-[var(--color-text-secondary)]"
      >
        Skip for now
      </button>
    </>
  );
}
