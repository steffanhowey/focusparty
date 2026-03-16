"use client";

import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { ArrowRight, BookOpen } from "lucide-react";
import type { LearningPath, LearningProgress } from "@/lib/types";

interface ContinueLearningProps {
  paths: { path: LearningPath; progress: LearningProgress }[];
}

/**
 * Shows in-progress learning paths for the current user.
 * Renders above the search bar on the Learn home page.
 */
export function ContinueLearning({ paths }: ContinueLearningProps) {
  if (paths.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] flex items-center gap-2">
          <BookOpen size={14} />
          Continue Learning
        </h2>
        <Link
          href="/skills"
          className="text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-accent-primary)] transition-colors flex items-center gap-1"
        >
          View skills
          <ArrowRight size={10} />
        </Link>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
        {paths.map(({ path, progress }) => {
          const pct =
            progress.items_total > 0
              ? Math.round(
                  (progress.items_completed / progress.items_total) * 100
                )
              : 0;

          return (
            <Link
              key={path.id}
              href={`/learn/paths/${path.id}`}
              className="block shrink-0 group"
            >
              <Card className="p-3 w-64 space-y-2 hover:border-[var(--color-border-focus)] transition-colors">
                <h3 className="text-sm font-medium text-[var(--color-text-primary)] line-clamp-2 group-hover:text-[var(--color-accent-primary)] transition-colors">
                  {path.title}
                </h3>
                <div className="flex items-center gap-2 text-xs text-[var(--color-text-tertiary)]">
                  <span>
                    {progress.items_completed}/{progress.items_total} done
                  </span>
                  <span>·</span>
                  <span>{pct}%</span>
                </div>
                {/* Progress bar */}
                <div className="h-1 rounded-full bg-[var(--color-bg-hover)] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${pct}%`,
                      background: "var(--color-accent-primary)",
                    }}
                  />
                </div>
                <div className="flex items-center gap-1 text-xs text-[var(--color-accent-primary)] opacity-0 group-hover:opacity-100 transition-opacity">
                  <span>Continue</span>
                  <ArrowRight size={12} />
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
