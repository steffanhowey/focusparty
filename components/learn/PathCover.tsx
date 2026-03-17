"use client";

import Image from "next/image";
import type { LearningPath } from "@/lib/types";

interface PathCoverProps {
  path: LearningPath;
  /** Height class — defaults to h-[200px] */
  height?: string;
  /** Image sizes hint for Next.js Image */
  sizes?: string;
}

/**
 * Brand gradient pairs for the no-thumbnail fallback cover.
 * Each entry is [startColor, endColor] for a 135deg diagonal gradient.
 * Colors are from the brand design system (forest, teal, gold families).
 */
const FALLBACK_GRADIENTS: [string, string][] = [
  ["#162E21", "#1a3a35"],  // forest → teal
  ["#1E3A2C", "#3A7D53"],  // forest → forest-500
  ["#1a3a35", "#3D8E8B"],  // teal → teal
  ["#33280f", "#1E3A2C"],  // gold → forest
  ["#0F2318", "#1E3A2C"],  // forest-900 → forest
  ["#162E21", "#3A7D53"],  // forest → forest bright
];

/** Simple string hash → index */
function hashString(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/**
 * Resolve the best thumbnail for a path. Picks the first video
 * item's YouTube ID and selects a frame index (0-3) based on the
 * path title hash so different paths using the same video get
 * different frames.
 */
function resolveThumbnail(path: LearningPath): string | null {
  const videoItem = path.items.find(
    (i) => i.content_type === "video" && i.source_url,
  );
  if (!videoItem?.source_url) return null;

  const match = videoItem.source_url.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
  );
  if (!match) return videoItem.thumbnail_url ?? null;

  const ytId = match[1];
  const frameIndex = hashString(path.title) % 4;
  if (frameIndex === 0) {
    return `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`;
  }
  return `https://img.youtube.com/vi/${ytId}/hq${frameIndex}.jpg`;
}

/**
 * Cover image for learning path cards.
 *
 * With video: shows a YouTube frame (varied per path via frame index).
 * Without video: renders a subtle gradient with an icon.
 */
export function PathCover({
  path,
  height = "h-[200px]",
  sizes = "(max-width: 640px) 100vw, 400px",
}: PathCoverProps) {
  const thumbnail = resolveThumbnail(path);
  const gradientIdx = hashString(path.title) % FALLBACK_GRADIENTS.length;
  const [start, end] = FALLBACK_GRADIENTS[gradientIdx];

  return (
    <div className={`relative w-full overflow-hidden ${height}`}>
      {thumbnail ? (
        <Image
          src={thumbnail}
          alt=""
          fill
          sizes={sizes}
          className="object-cover"
        />
      ) : (
        <>
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(135deg, ${start} 0%, ${end} 100%)`,
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)",
              backgroundSize: "16px 16px",
            }}
          />
        </>
      )}
    </div>
  );
}
