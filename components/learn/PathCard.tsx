"use client";

import Image from "next/image";
import { Layers } from "lucide-react";
import type { LearningPath, LearningProgress } from "@/lib/types";

interface PathCardProps {
  path: LearningPath;
  progress?: LearningProgress | null;
  onClick: (pathId: string) => void;
}

const DIFFICULTY_COLORS: Record<string, string> = {
  beginner: "var(--color-green-700)",
  intermediate: "var(--color-cyan-700)",
  advanced: "var(--color-coral-700)",
};

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  if (m < 60) return `~${m}min`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm ? `~${h}h ${rm}m` : `~${h}h`;
}

/**
 * Learning path card for the Learn page grid.
 * Styled identically to RoomCard (persistent) — image + title + meta line below.
 */
export function PathCard({ path, progress, onClick }: PathCardProps) {
  const thumbnail = path.items.find(
    (i) => i.content_type === "video" && i.thumbnail_url
  )?.thumbnail_url;

  const percentComplete = progress
    ? progress.items_total > 0
      ? Math.round(
          (progress.items_completed / progress.items_total) * 100
        )
      : 0
    : null;

  return (
    <div
      className="block transition-all duration-150 cursor-pointer"
      onClick={() => onClick(path.id)}
      role="button"
    >
      {/* Image card */}
      <div
        className="group/card relative h-[200px] w-full overflow-hidden rounded-md border shadow-[var(--shadow-sm)] transition-all duration-200 hover:shadow-[var(--shadow-md)]"
        style={{ borderColor: "var(--color-border-default)" }}
      >
        {thumbnail ? (
          <Image
            src={thumbnail}
            alt={path.title}
            fill
            sizes="(max-width: 640px) 100vw, 400px"
            className="object-cover"
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(135deg, var(--color-bg-secondary), var(--color-bg-hover))",
            }}
          >
            <div className="flex h-full w-full items-center justify-center">
              <Layers
                size={32}
                className="text-[var(--color-text-tertiary)]"
              />
            </div>
          </div>
        )}

        {/* Difficulty badge */}
        <span
          className="absolute top-2 left-2 rounded px-2 py-0.5 text-xs font-medium"
          style={{
            background:
              DIFFICULTY_COLORS[path.difficulty_level] ??
              "var(--color-cyan-700)",
            color: "white",
          }}
        >
          {path.difficulty_level}
        </span>

        {/* Progress bar overlay at bottom */}
        {percentComplete !== null && percentComplete > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
            <div
              className="h-full transition-all"
              style={{
                width: `${percentComplete}%`,
                background: "var(--color-accent-primary)",
              }}
            />
          </div>
        )}
      </div>

      {/* Text + meta outside card — identical to RoomCard layout */}
      <div className="flex items-center gap-2 px-1 pt-2">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-white">
            {path.title}
          </h3>
          <p className="mt-0.5 line-clamp-1 text-xs text-[var(--color-text-tertiary)]">
            {formatDuration(path.estimated_duration_seconds)}
            {percentComplete !== null && ` · ${percentComplete}% complete`}
          </p>
        </div>
      </div>
    </div>
  );
}
