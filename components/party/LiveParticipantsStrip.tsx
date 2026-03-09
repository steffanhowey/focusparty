"use client";

import { useMemo } from "react";
import { CHARACTERS } from "@/lib/constants";
import { PARTICIPANT_STATUS_CONFIG } from "@/lib/presence";
import type { PresencePayload } from "@/lib/types";

interface LiveParticipantsStripProps {
  participants: PresencePayload[];
  maxVisible?: number;
  size?: "sm" | "md";
  currentUserId?: string | null;
}

const SIZE_MAP = { sm: 28, md: 36 } as const;
const DOT_SIZE = 8;

export function LiveParticipantsStrip({
  participants,
  maxVisible = 6,
  size = "md",
  currentUserId,
}: LiveParticipantsStripProps) {
  // Sort: current user first, then alphabetical
  const sorted = useMemo(() => {
    const copy = [...participants];
    copy.sort((a, b) => {
      if (a.userId === currentUserId) return -1;
      if (b.userId === currentUserId) return 1;
      return a.displayName.localeCompare(b.displayName);
    });
    return copy;
  }, [participants, currentUserId]);

  const visible = sorted.slice(0, maxVisible);
  const overflow = sorted.length - maxVisible;
  const px = SIZE_MAP[size];
  const overlap = Math.round(px * 0.3);

  if (participants.length === 0) return null;

  return (
    <div className="flex items-center">
      <div className="flex" style={{ paddingRight: overflow > 0 ? 4 : 0 }}>
        {visible.map((p, i) => {
          const initial = p.displayName.charAt(0).toUpperCase();
          const charDef = p.character ? CHARACTERS[p.character] : null;
          const statusCfg = PARTICIPANT_STATUS_CONFIG[p.status];
          const bgColor = charDef ? `${charDef.primary}20` : "rgba(255,255,255,0.08)";
          const borderColor = charDef ? charDef.primary : "rgba(255,255,255,0.2)";

          return (
            <div
              key={p.userId}
              className="relative"
              style={{
                marginLeft: i === 0 ? 0 : -overlap,
                zIndex: visible.length - i,
              }}
              title={`${p.displayName} \u00b7 ${statusCfg.label}`}
            >
              {/* Avatar circle */}
              <div
                className="flex items-center justify-center rounded-full border-2 font-semibold"
                style={{
                  width: px,
                  height: px,
                  borderColor,
                  background: bgColor,
                  color: charDef?.primary ?? "var(--color-text-secondary)",
                  fontSize: size === "sm" ? 11 : 13,
                  boxShadow: "0 0 0 2px var(--color-bg-secondary)",
                }}
              >
                {initial}
              </div>

              {/* Status dot */}
              <div
                className="absolute rounded-full"
                style={{
                  width: DOT_SIZE,
                  height: DOT_SIZE,
                  backgroundColor: statusCfg.dotColor,
                  bottom: -1,
                  right: -1,
                  border: "2px solid var(--color-bg-secondary)",
                }}
              />
            </div>
          );
        })}
      </div>

      {overflow > 0 && (
        <span
          className="ml-1.5 rounded-full px-2 py-0.5 text-xs font-medium"
          style={{
            background: "rgba(255,255,255,0.08)",
            color: "var(--color-text-secondary)",
          }}
        >
          +{overflow}
        </span>
      )}
    </div>
  );
}
