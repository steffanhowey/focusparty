"use client";

import { Card } from "@/components/ui/Card";
import { Clock, Play, FileText, Layers } from "lucide-react";
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
 * Click navigates to the learning environment — no external links.
 */
export function PathCard({ path, progress, onClick }: PathCardProps) {
  const thumbnail = path.items.find(
    (i) => i.content_type === "video" && i.thumbnail_url
  )?.thumbnail_url;

  const videoCount = path.items.filter(
    (i) => i.content_type === "video"
  ).length;
  const articleCount = path.items.filter(
    (i) => i.content_type === "article"
  ).length;

  const resourceText =
    videoCount > 0 && articleCount > 0
      ? `${videoCount} videos, ${articleCount} articles`
      : `${path.items.length} resources`;

  const percentComplete = progress
    ? progress.items_total > 0
      ? Math.round(
          (progress.items_completed / progress.items_total) * 100
        )
      : 0
    : null;

  // Build module names for the hint row
  const sectionNames: string[] = [];
  if (path.modules?.length) {
    for (const mod of path.modules) {
      sectionNames.push(mod.title);
    }
  }

  return (
    <button
      onClick={() => onClick(path.id)}
      className="block w-full text-left group"
    >
      <Card className="overflow-hidden transition-all hover:border-[var(--color-border-focus)] hover:shadow-md">
        {/* Thumbnail */}
        <div className="relative aspect-video bg-[var(--color-bg-secondary)] overflow-hidden">
          {thumbnail ? (
            <img
              src={thumbnail}
              alt=""
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center"
              style={{
                background:
                  "linear-gradient(135deg, var(--color-bg-secondary), var(--color-bg-hover))",
              }}
            >
              <Layers
                size={32}
                className="text-[var(--color-text-tertiary)]"
              />
            </div>
          )}

          {/* Difficulty badge */}
          <span
            className="absolute top-2 left-2 px-2 py-0.5 rounded text-xs font-medium"
            style={{
              background:
                DIFFICULTY_COLORS[path.difficulty_level] ??
                "var(--color-cyan-700)",
              color: "white",
            }}
          >
            {path.difficulty_level}
          </span>

          {/* Resource count badge */}
          <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded text-xs bg-black/70 text-white flex items-center gap-1">
            <Layers size={10} />
            {path.items.length} items
          </span>
        </div>

        {/* Content */}
        <div className="p-3 space-y-2">
          <h3 className="text-sm font-medium text-[var(--color-text-primary)] line-clamp-2 leading-snug group-hover:text-[var(--color-accent-primary)] transition-colors">
            {path.title}
          </h3>

          {path.description && (
            <p className="text-xs text-[var(--color-text-tertiary)] line-clamp-1">
              {path.description}
            </p>
          )}

          {/* Meta row */}
          <div className="flex items-center gap-2 text-xs text-[var(--color-text-tertiary)]">
            <span className="flex items-center gap-1">
              <Clock size={10} />
              {formatDuration(path.estimated_duration_seconds)}
            </span>
            <span>·</span>
            <span>{resourceText}</span>
          </div>

          {/* Topic pills */}
          {path.topics?.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {path.topics.slice(0, 3).map((t) => (
                <span
                  key={t}
                  className="px-1.5 py-0.5 rounded text-[10px] bg-[var(--color-bg-hover)] text-[var(--color-text-secondary)]"
                >
                  {t}
                </span>
              ))}
              {path.topics.length > 3 && (
                <span className="px-1.5 py-0.5 text-[10px] text-[var(--color-text-tertiary)]">
                  +{path.topics.length - 3}
                </span>
              )}
            </div>
          )}

          {/* Progress bar (if in-progress) or section hint */}
          {percentComplete !== null ? (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px] text-[var(--color-text-tertiary)]">
                <span>
                  {progress!.items_completed}/{progress!.items_total}{" "}
                  completed
                </span>
                <span>{percentComplete}%</span>
              </div>
              <div className="h-1 rounded-full bg-[var(--color-bg-hover)] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${percentComplete}%`,
                    background: "var(--color-accent-primary)",
                  }}
                />
              </div>
            </div>
          ) : sectionNames.length > 1 ? (
            <p className="text-[10px] text-[var(--color-text-tertiary)]">
              {sectionNames.join(" → ")}
            </p>
          ) : null}
        </div>
      </Card>
    </button>
  );
}
