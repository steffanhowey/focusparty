"use client";

import { PartyPopper } from "lucide-react";

export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-shell-100">
        <PartyPopper
          size={28}
          strokeWidth={1.5}
          className="text-shell-500"
        />
      </div>
      <p className="max-w-xs text-sm text-shell-600">
        Create a room and invite friends to work together with an AI host.
      </p>
    </div>
  );
}
