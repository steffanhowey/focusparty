"use client";

import type { LearningPath, LearningProgress } from "@/lib/types";
import { PathCover } from "./PathCover";

interface PathCardProps {
  path: LearningPath;
  progress?: LearningProgress | null;
  onClick: (pathId: string) => void;
}

const DIFFICULTY_CONFIG: Record<string, { label: string; color: string }> = {
  beginner: { label: "Beginner", color: "var(--color-green-700)" },
  intermediate: { label: "Intermediate", color: "var(--color-cyan-700)" },
  advanced: { label: "Advanced", color: "var(--color-coral-700)" },
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
 * Uses PathCover for branded thumbnail treatment.
 */
export function PathCard({ path, progress, onClick }: PathCardProps) {
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
        className="group/card relative w-full overflow-hidden rounded-md border shadow-[var(--shadow-sm)] transition-all duration-200 hover:shadow-[var(--shadow-md)]"
        style={{ borderColor: "var(--color-border-default)" }}
      >
        <PathCover path={path} height="h-[200px]" />

        {/* Difficulty badge — matches FeaturedRoom overlay badge pattern */}
        <span
          className="absolute top-3 left-3 rounded-full px-2.5 py-1 text-2xs font-semibold backdrop-blur-md"
          style={{
            background: "rgba(0,0,0,0.5)",
            color:
              DIFFICULTY_CONFIG[path.difficulty_level]?.color ??
              "var(--color-cyan-700)",
          }}
        >
          {DIFFICULTY_CONFIG[path.difficulty_level]?.label ?? path.difficulty_level}
        </span>

        {/* Progress bar overlay at bottom */}
        {percentComplete !== null && percentComplete > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10 z-10">
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

      {/* Title + meta below card */}
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
