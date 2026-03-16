"use client";

import React from "react";
import { LearnVideoPlayer } from "./LearnVideoPlayer";
import { ArticleViewer } from "./ArticleViewer";
import { MissionViewer } from "./MissionViewer";
import { QuickCheckViewer } from "./QuickCheckViewer";
import { ReflectionViewer } from "./ReflectionViewer";
import type { PathItem, ItemState } from "@/lib/types";

interface ContentViewerProps {
  item: PathItem;
  isCompleted: boolean;
  onComplete: () => void;
  onCompleteWithState: (stateData: Partial<ItemState>) => void;
  onPlayStateChange?: (playing: boolean) => void;
  togglePlayRef?: React.MutableRefObject<(() => void) | null>;
}

/**
 * Content viewer wrapper that renders the appropriate viewer
 * based on the current item's task_type.
 */
export function ContentViewer({
  item,
  isCompleted,
  onComplete,
  onCompleteWithState,
  onPlayStateChange,
  togglePlayRef,
}: ContentViewerProps) {
  const taskType = item.task_type ?? "watch";

  // ── Do tasks → MissionViewer ──
  if (taskType === "do" && item.mission) {
    return (
      <MissionViewer
        item={item}
        isCompleted={isCompleted}
        onComplete={onCompleteWithState}
      />
    );
  }

  // ── Check tasks → QuickCheckViewer ──
  if (taskType === "check" && item.check) {
    return (
      <QuickCheckViewer
        item={item}
        isCompleted={isCompleted}
        onComplete={onCompleteWithState}
      />
    );
  }

  // ── Reflect tasks → ReflectionViewer ──
  if (taskType === "reflect" && item.reflection) {
    return (
      <ReflectionViewer
        item={item}
        isCompleted={isCompleted}
        onComplete={onCompleteWithState}
      />
    );
  }

  // ── Watch tasks (default) — route by content_type ──
  if (item.content_type === "video" && item.source_url) {
    return (
      <div className="flex flex-col h-full p-4">
        <LearnVideoPlayer
          sourceUrl={item.source_url}
          title={item.title}
          onComplete={onComplete}
          isCompleted={isCompleted}
          onPlayStateChange={onPlayStateChange}
          togglePlayRef={togglePlayRef}
          clipStartSeconds={item.clip_start_seconds}
          clipEndSeconds={item.clip_end_seconds}
        />
      </div>
    );
  }

  // Article fallback
  return (
    <ArticleViewer
      title={item.title}
      creatorName={item.creator_name ?? "Unknown"}
      description={null}
      sourceUrl={item.source_url ?? ""}
      wordCount={item.duration_seconds ? Math.round(item.duration_seconds / 60 * 200) : null}
      publishedAt={null}
      onComplete={onComplete}
      isCompleted={isCompleted}
    />
  );
}
