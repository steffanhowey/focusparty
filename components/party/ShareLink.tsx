"use client";

import { useState } from "react";
import { Link2, Check } from "lucide-react";

interface ShareLinkProps {
  partyId: string;
}

export function ShareLink({ partyId }: ShareLinkProps) {
  const [copied, setCopied] = useState(false);

  const joinUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/join/${partyId}`
      : `/join/${partyId}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback — select the text
    }
  };

  return (
    <div className="rounded-md border border-[var(--color-border-default)] bg-[var(--color-bg-hover)] p-4">
      <p className="mb-2 text-xs font-medium text-[var(--color-text-secondary)]">
        Share invite link
      </p>
      <div className="flex gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-[var(--color-border-default)] bg-white/[0.04] px-3 py-2">
          <Link2
            size={14}
            className="shrink-0 text-[var(--color-text-tertiary)]"
          />
          <span className="truncate text-xs text-[var(--color-text-secondary)]">
            {joinUrl}
          </span>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-md bg-[var(--color-accent-primary)] px-3 text-xs font-medium text-white transition-all hover:bg-[var(--color-purple-800)]"
        >
          {copied ? (
            <>
              <Check size={14} />
              Copied
            </>
          ) : (
            "Copy"
          )}
        </button>
      </div>
    </div>
  );
}
