"use client";

import type { LearningPath, LearningProgress } from "@/lib/types";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PathCardFrame } from "./PathCardFrame";

interface PathCardProps {
  path: LearningPath;
  progress?: LearningProgress | null;
  onClick: (pathId: string) => void;
  onSkillClick?: (skillSlug: string, skillName: string) => void;
  isSaved?: boolean;
  onToggleSave?: (path: LearningPath) => void;
}

const DIFFICULTY_CONFIG: Record<string, { label: string; color: string }> = {
  beginner: { label: "Beginner", color: "var(--sg-forest-300)" },
  intermediate: { label: "Intermediate", color: "var(--sg-teal-500)" },
  advanced: { label: "Advanced", color: "var(--sg-coral-500)" },
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
export function PathCard({
  path,
  progress,
  onClick,
  onSkillClick,
  isSaved = false,
  onToggleSave,
}: PathCardProps) {
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
      <PathCardFrame
        path={path}
        badge={(
          <span
            className="inline-flex items-center rounded-full px-2.5 py-1 text-2xs font-semibold backdrop-blur-md"
            style={{
              background:
                "color-mix(in srgb, var(--sg-shell-900) 52%, transparent)",
              color:
                DIFFICULTY_CONFIG[path.difficulty_level]?.color ??
                "var(--sg-teal-500)",
            }}
          >
            {DIFFICULTY_CONFIG[path.difficulty_level]?.label ?? path.difficulty_level}
          </span>
        )}
        topRight={
          onToggleSave ? (
            <Button
              variant="ghost"
              size="xs"
              aria-label={isSaved ? "Remove from queue" : "Save to queue"}
              className={`w-8 justify-center rounded-full px-0 backdrop-blur-md ${
                isSaved ? "opacity-100" : "opacity-0 group-hover/card:opacity-100"
              }`}
              style={{
                background:
                  "color-mix(in srgb, var(--sg-forest-900) 58%, transparent)",
                color: "var(--sg-white)",
              }}
              leftIcon={
                isSaved ? (
                  <BookmarkCheck size={14} strokeWidth={1.9} />
                ) : (
                  <Bookmark size={14} strokeWidth={1.9} />
                )
              }
              onClick={(event) => {
                event.stopPropagation();
                onToggleSave(path);
              }}
            >
              {null}
            </Button>
          ) : null
        }
        bottomOverlay={
          percentComplete !== null && percentComplete > 0 ? (
            <div className="absolute bottom-0 left-0 right-0 z-10 h-1 bg-white/10">
              <div
                className="h-full transition-all"
                style={{
                  width: `${percentComplete}%`,
                  background: "var(--sg-forest-500)",
                }}
              />
            </div>
          ) : null
        }
      />

      {/* Title + meta below card */}
      <div className="flex items-center gap-2 px-1 pt-2">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-shell-900">
            {path.title}
          </h3>
          <p className="mt-0.5 line-clamp-1 text-xs text-shell-500">
            {formatDuration(path.estimated_duration_seconds)}
            {percentComplete !== null && ` · ${percentComplete}% complete`}
          </p>
          {path.skill_tags && path.skill_tags.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {path.skill_tags
                .filter((t) => t.relevance === "primary")
                .slice(0, 2)
                .map((tag) => (
                  <span
                    key={tag.skill_slug}
                    className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium cursor-pointer transition-colors hover:bg-shell-200 hover:text-shell-900"
                    style={{
                      background: "var(--sg-shell-100)",
                      color: "var(--sg-shell-600)",
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSkillClick?.(tag.skill_slug, tag.skill_name);
                    }}
                  >
                    {tag.skill_name}
                  </span>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
