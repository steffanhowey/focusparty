"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { updateDisplayName } from "@/lib/identity";

interface DisplayNameBannerProps {
  currentName: string;
  onNameUpdated: (name: string) => void;
}

export function DisplayNameBanner({
  currentName,
  onNameUpdated,
}: DisplayNameBannerProps) {
  const [name, setName] = useState(currentName === "Guest" ? "" : currentName);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || currentName !== "Guest") return null;

  const handleSave = () => {
    if (!name.trim()) return;
    const updated = updateDisplayName(name.trim());
    onNameUpdated(updated.displayName);
  };

  return (
    <div className="relative mb-5 rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-bg-hover)] px-4 py-3">
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="absolute right-3 top-3 rounded p-0.5 text-[var(--color-text-tertiary)] hover:text-white"
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>
      <p className="mb-2 text-sm font-medium text-white">
        Set your display name
      </p>
      <p className="mb-3 text-xs text-[var(--color-text-secondary)]">
        Other party members will see this name.
      </p>
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
          maxLength={30}
          className="h-9 flex-1 rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-white/[0.06] px-3 text-sm text-white outline-none placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-border-focus)]"
          style={{ fontFamily: "var(--font-montserrat), sans-serif" }}
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={!name.trim()}
          className="h-9 rounded-[var(--radius-md)] bg-[var(--color-accent-primary)] px-4 text-sm font-medium text-white transition-opacity disabled:opacity-50"
        >
          Save
        </button>
      </div>
    </div>
  );
}
