"use client";

import { PartyPopper } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface EmptyStateProps {
  onCreateParty: () => void;
}

export function EmptyState({ onCreateParty }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-bg-hover)]">
        <PartyPopper
          size={28}
          strokeWidth={1.5}
          className="text-[var(--color-text-tertiary)]"
        />
      </div>
      <h3 className="text-lg font-semibold text-white">No parties yet</h3>
      <p className="mt-1 max-w-xs text-sm text-[var(--color-text-secondary)]">
        Create a focus party and invite friends to work together with an AI host.
      </p>
      <Button
        variant="primary"
        className="mt-6"
        onClick={onCreateParty}
      >
        Create your first party
      </Button>
    </div>
  );
}
