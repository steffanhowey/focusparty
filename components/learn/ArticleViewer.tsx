"use client";

import { Button } from "@/components/ui/Button";
import { CheckCircle, Clock, User, BookOpen } from "lucide-react";

interface ArticleViewerProps {
  title: string;
  creatorName: string | null;
  description: string | null;
  sourceUrl: string;
  wordCount: number | null;
  publishedAt: string | null;
  onComplete: () => void;
  isCompleted: boolean;
}

/**
 * Article viewer for the learning environment.
 * Shows summary content inline — no external links.
 */
export function ArticleViewer({
  title,
  creatorName,
  description,
  sourceUrl,
  wordCount,
  publishedAt,
  onComplete,
  isCompleted,
}: ArticleViewerProps) {
  const readTime = wordCount ? Math.ceil(wordCount / 200) : null;

  // Extract source name from URL for attribution
  const sourceName = (() => {
    try {
      const host = new URL(sourceUrl).hostname.replace("www.", "");
      return host.charAt(0).toUpperCase() + host.slice(1);
    } catch {
      return null;
    }
  })();

  const isShortDescription = !description || description.length < 100;

  return (
    <div className="max-w-2xl mx-auto space-y-6 py-8 px-4">
      {/* Article Header */}
      <div className="space-y-3">
        <h2 className="text-2xl font-bold text-shell-900">
          {title}
        </h2>
        <div className="flex flex-wrap items-center gap-3 text-sm text-shell-500">
          {creatorName && (
            <span className="flex items-center gap-1">
              <User size={14} />
              {creatorName}
            </span>
          )}
          {readTime && (
            <span className="flex items-center gap-1">
              <Clock size={14} />
              {readTime} min read
            </span>
          )}
          {publishedAt && (
            <span>
              {new Date(publishedAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          )}
        </div>
      </div>

      {/* Description / Summary */}
      {description && (
        <div
          className="p-5 rounded-lg text-sm text-shell-600 leading-relaxed whitespace-pre-line"
          style={{ background: "white" }}
        >
          {description}
        </div>
      )}

      {/* Source attribution for short descriptions */}
      {isShortDescription && sourceName && (
        <div
          className="flex items-center gap-2 px-4 py-3 rounded-lg text-xs text-shell-500"
          style={{ background: "white" }}
        >
          <BookOpen size={14} />
          <span>Full article available at {sourceName}</span>
        </div>
      )}

      {/* Mark Complete */}
      <div className="flex justify-center pt-4 border-t border-shell-border">
        <Button
          variant={isCompleted ? "ghost" : "primary"}
          size="sm"
          leftIcon={<CheckCircle size={14} />}
          onClick={onComplete}
          disabled={isCompleted}
        >
          {isCompleted ? "Completed" : "Mark as Complete"}
        </Button>
      </div>
    </div>
  );
}
