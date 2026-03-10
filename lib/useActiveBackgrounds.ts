"use client";

import { useState, useEffect } from "react";
import {
  getAllActiveBackgrounds,
  type ActiveBackground,
} from "./roomBackgrounds";
import { getUserTimeState } from "./timeOfDay";

/**
 * Fetches all active AI-generated room backgrounds for the user's
 * current time-of-day state, once on mount.
 * Returns a map from worldKey → ActiveBackground.
 */
export function useActiveBackgrounds() {
  const [backgrounds, setBackgrounds] = useState<
    Map<string, ActiveBackground>
  >(new Map());

  useEffect(() => {
    const timeState = getUserTimeState();
    getAllActiveBackgrounds(timeState).then(setBackgrounds).catch((err) => console.error("Failed to load active backgrounds:", err));
  }, []);

  return backgrounds;
}
