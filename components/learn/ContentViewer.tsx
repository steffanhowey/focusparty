"use client";

import React from "react";
import { CheckCircle } from "lucide-react";
import { LearnVideoPlayer } from "./LearnVideoPlayer";
import { ArticleViewer } from "./ArticleViewer";
import { MissionViewer } from "./MissionViewer";
import { QuickCheckViewer } from "./QuickCheckViewer";
import { ReflectionViewer } from "./ReflectionViewer";
import { Button } from "@/components/ui/Button";
import {
  RoomStageFooter,
  RoomStageScaffold,
} from "./RoomStageScaffold";
import type { PathItem, ItemState } from "@/lib/types";

interface ContentViewerProps {
  item: PathItem;
  isCompleted: boolean;
  onComplete: () => void;
  onCompleteWithState: (stateData: Partial<ItemState>) => void;
  variant?: "default" | "roomOverlay" | "missionPage";
  onPlayStateChange?: (playing: boolean) => void;
  togglePlayRef?: React.MutableRefObject<(() => void) | null>;
}

/**
 * Content viewer wrapper that renders the appropriate viewer
 * based on the current item's task_type.
 */

function formatDuration(seconds: number | null): string | null {
  if (!seconds || seconds <= 0) return null;
  const minutes = Math.max(1, Math.round(seconds / 60));
  return `${minutes} min`;
}

export function ContentViewer({
  item,
  isCompleted,
  onComplete,
  onCompleteWithState,
  variant = "default",
  onPlayStateChange,
  togglePlayRef,
}: ContentViewerProps) {
  const taskType = item.task_type ?? "watch";
  const isImmersiveStage = variant === "roomOverlay" || variant === "missionPage";

  // ── Do tasks → MissionViewer ──
  if (taskType === "do" && item.mission) {
    return (
      <MissionViewer
        item={item}
        isCompleted={isCompleted}
        onComplete={onCompleteWithState}
        variant={variant}
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
        variant={variant}
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
        variant={variant}
      />
    );
  }

  // ── Watch tasks (default) — route by content_type ──
  if (item.content_type === "video" && item.source_url) {
    const footerMeta = [
      "Watch",
      item.creator_name ?? "Video",
      formatDuration(item.duration_seconds),
    ]
      .filter(Boolean)
      .join(" · ");

    if (variant === "missionPage") {
      return (
        <RoomStageScaffold
          variant="missionPage"
          eyebrow="Watch"
          title={item.title}
          description={item.connective_text}
          footerMeta={footerMeta}
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
          contentClassName="max-w-[960px] space-y-4"
        >
          <div className="overflow-hidden rounded-[var(--sg-radius-lg)] border border-white/[0.08] bg-black">
            <LearnVideoPlayer
              sourceUrl={item.source_url}
              title={item.title}
              onComplete={onComplete}
              isCompleted={isCompleted}
              immersive
              immersiveLayout="aspect"
              onPlayStateChange={onPlayStateChange}
              togglePlayRef={togglePlayRef}
              clipStartSeconds={item.clip_start_seconds}
              clipEndSeconds={item.clip_end_seconds}
            />
          </div>
        </RoomStageScaffold>
      );
    }

    if (variant === "roomOverlay") {
      return (
        <div className="h-full w-full">
          <LearnVideoPlayer
            sourceUrl={item.source_url}
            title={item.title}
            onComplete={onComplete}
            isCompleted={isCompleted}
            immersive
            immersiveLayout="fill"
            footer={
              <RoomStageFooter
                meta={footerMeta}
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
              />
            }
            onPlayStateChange={onPlayStateChange}
            togglePlayRef={togglePlayRef}
            clipStartSeconds={item.clip_start_seconds}
            clipEndSeconds={item.clip_end_seconds}
          />
        </div>
      );
    }

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
      variant={isImmersiveStage ? variant : "default"}
      contextText={item.connective_text}
    />
  );
}
