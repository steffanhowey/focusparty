"use client";

import type { CharacterId } from "@/lib/types";
import { CHARACTERS } from "@/lib/constants";

interface FlameIconProps {
  size?: number;
  character: CharacterId;
}

export function FlameIcon({ size = 20, character }: FlameIconProps) {
  const c = CHARACTERS[character];
  const gradientId = `flame-${character}`;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor={c.primary} />
          <stop offset="100%" stopColor={c.secondary} />
        </linearGradient>
      </defs>
      <path
        d="M12 2c0 4-4 6-4 10a4 4 0 008 0c0-4-4-6-4-10z"
        fill={`url(#${gradientId})`}
        opacity="0.9"
      />
      <path
        d="M12 8c0 2-2 3-2 5a2 2 0 004 0c0-2-2-3-2-5z"
        fill="white"
        opacity="0.3"
      />
    </svg>
  );
}
