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
    <div className="rounded-md border border-shell-border bg-shell-100 p-4">
      <p className="mb-2 text-xs font-medium text-shell-600">
        Share invite link
      </p>
      <div className="flex gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-shell-border bg-white/[0.04] px-3 py-2">
          <Link2
            size={14}
            className="shrink-0 text-shell-500"
          />
          <span className="truncate text-xs text-shell-600">
            {joinUrl}
          </span>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-md bg-forest-500 px-3 text-xs font-medium text-white transition-all hover:bg-forest-600"
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
