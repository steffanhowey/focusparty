"use client";

import { PartyPopper } from "lucide-react";

export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-bg-hover)]">
        <PartyPopper
          size={28}
          strokeWidth={1.5}
          className="text-[var(--color-text-tertiary)]"
        />
      </div>
      <p className="max-w-xs text-sm text-[var(--color-text-secondary)]">
        Create a room and invite friends to work together with an AI host.
      </p>
    </div>
  );
}
