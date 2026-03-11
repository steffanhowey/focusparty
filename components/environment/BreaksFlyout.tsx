"use client";

import { useEffect } from "react";
import { PanelHeader } from "@/components/session/PanelHeader";
import { BreakContentCard } from "./BreakContentCard";
import { useBreakContent } from "@/lib/useBreakContent";
import type { BreakContentItem } from "@/lib/types";

interface BreaksFlyoutProps {
  roomWorldKey: string;
  worldLabel: string;
  onClose: () => void;
  onSelectContent: (item: BreakContentItem) => void;
}

export function BreaksFlyout({
  roomWorldKey,
  worldLabel,
  onClose,
  onSelectContent,
}: BreaksFlyoutProps) {
  const { items, loading } = useBreakContent(roomWorldKey, "learning");

  // Escape key closes
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <>
      <PanelHeader title="Breaks" onClose={onClose} />

      <div className="px-5 pb-2">
        <p className="text-xs text-white/40">Take a productive break</p>
      </div>

      <div className="fp-shell-scroll flex-1 overflow-y-auto px-5 py-3">
        <p className="mb-3 text-[11px] font-medium uppercase tracking-wider text-white/25">
          Curated learning for {worldLabel}
        </p>

        {loading ? (
          <div className="flex flex-col gap-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-24 animate-pulse rounded-xl bg-white/[0.04]"
              />
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="py-8 text-center text-xs text-white/30">
            No break content available yet
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {items.map((item) => (
              <BreakContentCard
                key={item.id}
                item={item}
                onSelect={onSelectContent}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
