"use client";

import { ReactNode, memo } from "react";
import type { CharacterId } from "@/lib/types";
import { CHARACTERS } from "@/lib/constants";

interface SplitScreenProps {
  character: CharacterId;
  /** Left panel: user camera placeholder */
  leftPanel?: ReactNode;
  /** Right panel: AI partner placeholder */
  rightPanel?: ReactNode;
}

export const SplitScreen = memo(function SplitScreen({
  character,
  leftPanel,
  rightPanel,
}: SplitScreenProps) {
  const c = CHARACTERS[character];

  return (
    <div className="flex flex-1 gap-4 overflow-hidden px-4 pb-4 md:gap-6 md:px-6 md:pb-6">
      <div
        className="relative flex min-w-0 flex-1 items-center justify-center overflow-hidden rounded-xl border border-[var(--color-border-default)]"
        style={{
          background: "rgba(13,14,32,0.35)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          textShadow: "0 1px 4px rgba(0,0,0,0.6)",
        }}
      >
        {leftPanel ?? (
          <div className="flex flex-col items-center justify-center text-[var(--color-text-tertiary)]">
            <div
              className="mb-2.5 flex h-16 w-16 items-center justify-center rounded-full text-2xl font-bold"
              style={{
                background: "var(--color-bg-elevated)",
                border: "1px solid var(--color-border-default)",
              }}
            >
              S
            </div>
            <span className="text-xs">Camera preview</span>
            <div
              className="absolute left-4 top-4 h-2 w-2 animate-pulse rounded-full bg-[var(--color-coral-700)]"
              style={{ animationDuration: "2s" }}
            />
          </div>
        )}
      </div>
      <div
        className="relative flex min-w-0 flex-1 flex-col items-center justify-center overflow-hidden rounded-xl border border-[var(--color-border-subtle)]"
        style={{ background: c.roomBg }}
      >
        {rightPanel ?? (
          <>
            <div
              className="mb-3 flex h-20 w-20 items-center justify-center rounded-full text-3xl font-bold"
              style={{
                background: `linear-gradient(135deg, ${c.primary}40, ${c.secondary}30)`,
                border: `2px solid ${c.primary}80`,
                color: c.primary,
                boxShadow: `0 0 40px ${c.glow}`,
              }}
            >
              FP
            </div>
            <span className="text-sm font-semibold text-white">Focus Partner</span>
            <span className="text-xs text-[var(--color-text-secondary)]">
              Your co-working buddy
            </span>
            <div
              className="absolute bottom-0 left-1/5 right-1/5 h-20 blur-3xl opacity-[0.08]"
              style={{ background: c.primary, transform: "translateY(50%)" }}
            />
          </>
        )}
      </div>
    </div>
  );
});
