"use client";

import { useState, useEffect } from "react";
import {
  getAllActiveBackgrounds,
  type ActiveBackground,
} from "./roomBackgrounds";

/**
 * Fetches all active AI-generated room backgrounds once on mount.
 * Returns a map from worldKey → ActiveBackground.
 */
export function useActiveBackgrounds() {
  const [backgrounds, setBackgrounds] = useState<
    Map<string, ActiveBackground>
  >(new Map());

  useEffect(() => {
    getAllActiveBackgrounds().then(setBackgrounds).catch(() => {});
  }, []);

  return backgrounds;
}
