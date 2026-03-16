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
 */
const FALLBACK_ACCENTS = [
  "rgba(88, 28, 135, 0.3)",
  "rgba(14, 116, 144, 0.3)",
  "rgba(30, 64, 175, 0.3)",
  "rgba(124, 58, 237, 0.3)",
  "rgba(21, 128, 61, 0.3)",
  "rgba(157, 23, 77, 0.3)",
  "rgba(180, 83, 9, 0.3)",
  "rgba(194, 65, 12, 0.3)",
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
            background: `linear-gradient(135deg, ${accent}, var(--color-bg-secondary))`,
          }}
        >
          <Layers size={32} style={{ color: "rgba(255,255,255,0.15)" }} />
        </div>
      )}
    </div>
  );
}
