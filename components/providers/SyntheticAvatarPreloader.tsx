"use client";

import { useEffect } from "react";
import { SYNTHETIC_POOL } from "@/lib/synthetics/pool";

/**
 * Preloads all synthetic participant avatar thumbnails into the
 * browser's HTTP cache. Renders nothing — zero visual impact.
 *
 * Mounted in the Providers tree so avatars are cached before the
 * user navigates to any page that displays them (party discovery,
 * environment rooms, etc.). Uses requestIdleCallback to avoid
 * competing with critical rendering or hydration.
 *
 * Total payload: 42 × ~3-5KB = ~210KB (comparable to a single image).
 */
export function SyntheticAvatarPreloader() {
  useEffect(() => {
    const preload = () => {
      for (const s of SYNTHETIC_POOL) {
        const img = new Image();
        img.src = s.avatarUrl;
      }
    };

    if (typeof requestIdleCallback === "function") {
      const id = requestIdleCallback(preload);
      return () => cancelIdleCallback(id);
    } else {
      // Safari fallback — requestIdleCallback not supported
      const timer = setTimeout(preload, 100);
      return () => clearTimeout(timer);
    }
  }, []);

  return null;
}
