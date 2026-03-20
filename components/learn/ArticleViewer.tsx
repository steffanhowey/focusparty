"use client";

import { Button } from "@/components/ui/Button";
import { CheckCircle, Clock, User, BookOpen } from "lucide-react";
import {
  RoomStagePanel,
  RoomStageScaffold,
} from "./RoomStageScaffold";

interface ArticleViewerProps {
  title: string;
  creatorName: string | null;
  description: string | null;
  sourceUrl: string;
  wordCount: number | null;
  publishedAt: string | null;
  onComplete: () => void;
  isCompleted: boolean;
  variant?: "default" | "roomOverlay";
  contextText?: string | null;
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
  variant = "default",
  contextText = null,
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
  const roomDescription = contextText || description;

  if (variant === "roomOverlay") {
    return (
      <RoomStageScaffold
        eyebrow="Read"
        title={title}
        description={roomDescription}
        footerMeta={[
          "Read",
          creatorName ?? sourceName ?? "Source",
          readTime ? `${readTime} min` : null,
        ]
          .filter(Boolean)
          .join(" · ")}
        primaryAction={
          <Button
            variant="cta"
            size="sm"
            leftIcon={<CheckCircle size={14} />}
            onClick={onComplete}
            disabled={isCompleted}
          >
            {isCompleted ? "Completed" : "Mark Complete"}
          </Button>
        }
        contentClassName="max-w-[720px] space-y-4"
      >
        <RoomStagePanel className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 text-xs text-white/45">
            {creatorName ? (
              <span className="inline-flex items-center gap-1.5">
                <User size={13} />
                {creatorName}
              </span>
            ) : null}
            {readTime ? (
              <span className="inline-flex items-center gap-1.5">
                <Clock size={13} />
                {readTime} min read
              </span>
            ) : null}
            {publishedAt ? (
              <span>
                {new Date(publishedAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            ) : null}
          </div>

          {description ? (
            <p className="text-sm leading-7 text-white/70 whitespace-pre-line">
              {description}
            </p>
          ) : null}

          {sourceName ? (
            <div className="flex items-center gap-2 text-xs text-white/45">
              <BookOpen size={14} />
              <span>Referenced from {sourceName}</span>
            </div>
          ) : null}
        </RoomStagePanel>
      </RoomStageScaffold>
    );
  }

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
