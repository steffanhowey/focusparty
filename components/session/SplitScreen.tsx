"use client";

import { ReactNode, memo } from "react";
import type { CharacterId } from "@/lib/types";
import { CHARACTERS } from "@/lib/constants";
import { ScreenSharePreview } from "@/components/session/ScreenSharePreview";

interface SplitScreenProps {
  character: CharacterId;
  /** Left panel: user camera placeholder */
  leftPanel?: ReactNode;
  /** Right panel: AI partner placeholder */
  rightPanel?: ReactNode;
  /** Active screen share stream for PiP preview */
  screenShareStream?: MediaStream | null;
}

export const SplitScreen = memo(function SplitScreen({
  character,
  leftPanel,
  rightPanel,
  screenShareStream,
}: SplitScreenProps) {
  const c = CHARACTERS[character];

  return (
    <div className="relative flex-1 overflow-hidden p-4">
      {/* ── AI partner (full-size) ── */}
      <div
        className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden rounded-xl border border-[var(--color-border-subtle)]"
        style={{
          background: c.roomBg,
          boxShadow: "0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06)",
        }}
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

      {/* ── PiP overlay (lower-left) — screen share replaces camera when active ── */}
      <div
        className="absolute bottom-10 left-10 z-10 h-36 w-48 overflow-hidden rounded-xl border border-white/[0.12]"
        style={{
          background: "rgba(13,14,32,0.65)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06)",
        }}
      >
        {screenShareStream ? (
          <>
            <ScreenSharePreview stream={screenShareStream} />
            <div className="absolute top-2 left-2 flex items-center gap-1 rounded-full bg-[var(--color-coral-700)]/80 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
              Screen
            </div>
          </>
        ) : (
          leftPanel ?? (
            <div className="flex h-full w-full flex-col items-center justify-center text-[var(--color-text-tertiary)]">
              <div
                className="mb-1.5 flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold"
                style={{
                  background: "var(--color-bg-elevated)",
                  border: "1px solid var(--color-border-default)",
                }}
              >
                S
              </div>
              <span className="text-[10px]">Camera preview</span>
            </div>
          )
        )}
      </div>
    </div>
  );
});
