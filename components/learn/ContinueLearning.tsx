"use client";

import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { ArrowRight, BookOpen } from "lucide-react";
import type { LearningPath, LearningProgress } from "@/lib/types";
import { getMissionRoute } from "@/lib/appRoutes";

interface ContinueLearningProps {
  paths: { path: LearningPath; progress: LearningProgress }[];
  title?: string;
  linkHref?: string;
  linkLabel?: string;
}

/**
 * Shows in-progress learning paths for the current user.
 * Renders above the search bar on the Learn home page.
 */
export function ContinueLearning({
  paths,
  title = "Active Missions",
  linkHref = "/progress",
  linkLabel = "Open progress",
}: ContinueLearningProps) {
  if (paths.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-shell-600 flex items-center gap-2">
          <BookOpen size={14} />
          {title}
        </h2>
        <Link
          href={linkHref}
          className="text-xs text-shell-500 hover:text-forest-500 transition-colors flex items-center gap-1"
        >
          {linkLabel}
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
              href={getMissionRoute(path.id)}
              className="block shrink-0 group"
            >
              <Card className="p-3 w-64 space-y-2 hover:border-forest-400 transition-colors">
                <h3 className="text-sm font-medium text-shell-900 line-clamp-2 group-hover:text-forest-500 transition-colors">
                  {path.title}
                </h3>
                <div className="flex items-center gap-2 text-xs text-shell-500">
                  <span>
                    {progress.items_completed}/{progress.items_total} done
                  </span>
                  <span>·</span>
                  <span>{pct}%</span>
                </div>
                {/* Progress bar */}
                <div className="h-1 rounded-full bg-shell-100 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${pct}%`,
                      background: "var(--sg-forest-500)",
                    }}
                  />
                </div>
                <div className="flex items-center gap-1 text-xs text-forest-500 opacity-0 group-hover:opacity-100 transition-opacity">
                  <span>Open mission</span>
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
