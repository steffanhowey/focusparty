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
            className="animate-spin text-[var(--sg-shell-500)]"
          />
        );
      case "available":
        return (
          <Check size={16} className="text-[var(--sg-forest-300)]" />
        );
      case "taken":
      case "invalid":
        return <X size={16} className="text-[var(--sg-coral-500)]" />;
      default:
        return null;
    }
  };

  return (
    <>
      <h1 className="text-2xl font-semibold text-[var(--sg-shell-900)]">
        Pick a handle
      </h1>
      <p className="mt-2 text-[var(--sg-shell-600)]">
        This is how others will find you. You can always change it later.
      </p>

      <div className="mt-8 rounded-xl border border-[var(--sg-shell-border)] bg-[var(--sg-shell-100)] p-6">
        <label className="mb-1.5 block text-xs font-medium text-[var(--sg-shell-600)]">
          Username
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-[var(--sg-shell-500)]">
            @
          </span>
          <input
            type="text"
            value={username.value}
            onChange={(e) => username.setValue(e.target.value)}
            placeholder="your_handle"
            className="h-11 w-full rounded-lg border border-[var(--sg-shell-border)] bg-[var(--sg-shell-100)] pl-8 pr-10 text-sm text-[var(--sg-shell-900)] outline-none placeholder:text-[var(--sg-shell-500)] focus:border-[var(--sg-forest-500)]"
            style={{
              borderColor:
                username.status === "available"
                  ? "var(--sg-forest-300)"
                  : username.status === "taken" || username.status === "invalid"
                    ? "var(--sg-coral-500)"
                    : undefined,
            }}
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2">
            {indicator()}
          </span>
        </div>
        {username.error && (
          <p className="mt-1.5 text-xs text-[var(--sg-coral-500)]">
            {username.error}
          </p>
        )}
        {username.status === "available" && (
          <p className="mt-1.5 text-xs text-[var(--sg-forest-300)]">
            @{username.value} is available
          </p>
        )}

        <button
          onClick={onConfirm}
          disabled={!username.isValid || saving}
          className="mt-5 inline-flex h-12 w-full items-center justify-center rounded-full bg-[var(--sg-forest-500)] font-medium text-white transition-opacity hover:opacity-85 active:opacity-75 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Let\u2019s go"}
        </button>
      </div>

      <button
        onClick={onSkip}
        disabled={saving}
        className="mx-auto mt-4 block text-xs text-[var(--sg-shell-500)] underline decoration-[var(--sg-shell-border)] underline-offset-2 transition-colors hover:text-[var(--sg-shell-600)]"
      >
        Skip for now
      </button>
    </>
  );
}
