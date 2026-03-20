"use client";

import type { CSSProperties, ReactNode } from "react";
import type { LearningPath } from "@/lib/types";
import { PathCover } from "./PathCover";

interface PathCardFrameProps {
  path: LearningPath;
  coverHeight?: string;
  coverSizes?: string;
  badge?: ReactNode;
  topRight?: ReactNode;
  bottomOverlay?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/**
 * Shared image-first shell used by path and mission cards so they stay aligned
 * with the same thumbnail-first card system.
 */
export function PathCardFrame({
  path,
  coverHeight = "h-[200px]",
  coverSizes = "(max-width: 640px) 100vw, 400px",
  badge,
  topRight,
  bottomOverlay,
  className = "",
  style,
}: PathCardFrameProps) {
  return (
    <div
      className={`group/card relative w-full overflow-hidden rounded-md border shadow-sm transition-all duration-200 hover:shadow-md ${className}`}
      style={{
        borderColor: "var(--sg-shell-border)",
        ...style,
      }}
    >
      <PathCover path={path} height={coverHeight} sizes={coverSizes} />

      {badge ? (
        <div className="absolute left-3 top-3 z-10">
          {badge}
        </div>
      ) : null}

      {topRight ? (
        <div className="absolute right-3 top-3 z-10">
          {topRight}
        </div>
      ) : null}

      {bottomOverlay}
    </div>
  );
}
