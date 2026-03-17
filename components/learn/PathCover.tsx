"use client";

import Image from "next/image";
import { Layers } from "lucide-react";
import type { LearningPath } from "@/lib/types";

interface PathCoverProps {
  path: LearningPath;
  /** Height class — defaults to h-[200px] */
  height?: string;
  /** Image sizes hint for Next.js Image */
  sizes?: string;
}

/**
 * Subtle accent colors for the no-thumbnail fallback gradient.
 * Using rgba values for gradient overlays — these are intentional
 * design choices, not color token replacements.
 */
const FALLBACK_ACCENTS = [
  "rgba(58, 125, 83, 0.3)",
  "rgba(61, 142, 139, 0.3)",
  "rgba(58, 125, 83, 0.2)",
  "rgba(42, 83, 64, 0.4)",
  "rgba(30, 58, 44, 0.3)",
  "rgba(107, 191, 135, 0.25)",
  "rgba(58, 125, 83, 0.35)",
  "rgba(61, 142, 139, 0.25)",
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
  const accentIdx = hashString(path.title) % FALLBACK_ACCENTS.length;
  const accent = FALLBACK_ACCENTS[accentIdx];

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
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            background: `linear-gradient(135deg, ${accent}, white)`,
          }}
        >
          <Layers size={32} style={{ color: "rgba(255,255,255,0.15)" }} />
        </div>
      )}
    </div>
  );
}
