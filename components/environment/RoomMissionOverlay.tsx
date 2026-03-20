"use client";

import { useCallback, useEffect, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { ArrowRight, CheckCircle2, PanelsTopLeft } from "lucide-react";
import { ContentViewer } from "@/components/learn/ContentViewer";
import {
  RoomStagePanel,
  RoomStageScaffold,
  RoomStageSecondaryButton,
} from "@/components/learn/RoomStageScaffold";
import { usePointerDrag } from "@/lib/usePointerDrag";
import type { ItemState, LearningPath, LearningProgress, PathItem } from "@/lib/types";

interface RoomMissionOverlayProps {
  path: LearningPath | null;
  progress: LearningProgress | null;
  currentItemIndex: number;
  isLoading: boolean;
  error: string | null;
  isCompleted: boolean;
  showTransition: boolean;
  onClose: () => void;
  onViewProgress: () => void;
  onCompleteItem: (contentId: string, stateData?: Partial<ItemState>) => Promise<void>;
  onAdvanceToItem: (index: number) => Promise<void>;
  leftInset?: number;
  rightInset?: number;
}

function getItemKey(item: PathItem, index: number): string {
  return item.item_id ?? item.content_id ?? `idx-${index}`;
}

function getStepLabel(item: PathItem | null): string {
  if (!item) return "Mission";

  if (item.task_type === "do") return "Build";
  if (item.task_type === "check") return "Check";
  if (item.task_type === "reflect") return "Reflect";
  return item.content_type === "video" ? "Watch" : "Read";
}

export function RoomMissionOverlay({
  path,
  progress,
  currentItemIndex,
  isLoading,
  error,
  isCompleted,
  showTransition,
  onClose,
  onViewProgress,
  onCompleteItem,
  onAdvanceToItem,
  leftInset = 232,
  rightInset = 404,
}: RoomMissionOverlayProps) {
  const { dragRef, dragStyle } = usePointerDrag({ threshold: 4, centerY: true });

  const currentItem = path?.items[currentItemIndex] ?? null;
  const nextItem = path?.items[currentItemIndex + 1] ?? null;
  const currentItemKey = currentItem ? getItemKey(currentItem, currentItemIndex) : null;
  const isItemCompleted = currentItemKey
    ? progress?.item_states?.[currentItemKey]?.completed ?? false
    : false;
  const progressLabel = path
    ? `${Math.min(currentItemIndex + 1, path.items.length)} of ${path.items.length}`
    : null;
  const currentTaskType = currentItem?.task_type ?? "watch";
  const isVideoStage = Boolean(
    currentItem &&
      currentTaskType === "watch" &&
      currentItem.content_type === "video" &&
      currentItem.source_url,
  );
  const overlayTitle = isCompleted
    ? path?.title ?? "Mission"
    : currentItem?.title ?? path?.title ?? "Mission";
  const overlaySubtitle = isCompleted
    ? "Mission complete"
    : [path?.title, progressLabel ? `Step ${progressLabel}` : null].filter(Boolean).join(" · ");
  const overlayInfoVisible = Boolean(path || currentItem || isCompleted);
  const overlayWidth = `min(1120px, calc(100vw - ${leftInset}px - ${rightInset}px))`;
  const overlayLeft = `calc(${leftInset}px + ((100vw - ${leftInset}px - ${rightInset}px) / 2))`;

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const handleComplete = useCallback(async () => {
    if (!currentItemKey) return;

    await onCompleteItem(currentItemKey);
  }, [currentItemKey, onCompleteItem]);

  const handleCompleteWithState = useCallback(
    async (stateData: Partial<ItemState>) => {
      if (!currentItemKey) return;

      await onCompleteItem(currentItemKey, stateData);
    },
    [currentItemKey, onCompleteItem],
  );

  const handleContinue = useCallback(() => {
    if (!nextItem) return;

    void onAdvanceToItem(currentItemIndex + 1);
  }, [currentItemIndex, nextItem, onAdvanceToItem]);

  const handlePointerDownInside = useCallback(
    (event: ReactPointerEvent) => {
      event.stopPropagation();
    },
    [],
  );

  const renderLandscapeShell = useCallback(
    (
      children: ReactNode,
      options?: {
        scrollable?: boolean;
        fillHeight?: boolean;
        maxWidthClassName?: string;
      },
    ) => (
      <div className="relative aspect-video w-full bg-black">
        <div
          className={
            options?.scrollable
              ? "absolute inset-0 overflow-y-auto fp-shell-scroll"
              : "absolute inset-0"
          }
        >
          <div
            className={`flex w-full items-center justify-center px-6 py-6 md:px-10 md:py-8 ${
              options?.fillHeight ? "h-full" : "min-h-full"
            }`}
          >
            <div
              className={`w-full ${
                options?.maxWidthClassName ?? "max-w-[820px]"
              } ${options?.fillHeight ? "h-full" : ""}`}
            >
              {children}
            </div>
          </div>
        </div>
      </div>
    ),
    [],
  );

  const renderStageCard = useCallback(
    (children: ReactNode, options?: { maxWidth?: string }) =>
      renderLandscapeShell(
        <div
          className="w-full rounded-[var(--sg-radius-xl)] border border-white/[0.08] p-6 text-center md:p-7"
          style={{
            maxWidth: options?.maxWidth ?? "760px",
            background: "rgba(255,255,255,0.04)",
          }}
        >
          {children}
        </div>,
      ),
    [renderLandscapeShell],
  );

  return (
    <div
      ref={dragRef}
      className="group absolute top-1/2 z-30 overflow-hidden rounded-xl border border-white/[0.08]"
      style={{
        width: overlayWidth,
        left: overlayLeft,
        ...dragStyle,
        transition: "left 0.3s ease, width 0.3s ease",
        background: "rgba(15,35,24,0.85)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        boxShadow: "var(--sg-shadow-dark-lg)",
      }}
    >
      {overlayInfoVisible && (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          <div
            className="flex items-start justify-between gap-4 px-4 pt-3 pb-6"
            style={{
              background: "linear-gradient(to bottom, rgba(0,0,0,0.72) 0%, transparent 100%)",
            }}
          >
            <div className="min-w-0">
              <p className="text-sm font-medium leading-tight text-white/90 line-clamp-1">
                {overlayTitle}
              </p>
              {overlaySubtitle && (
                <p className="mt-0.5 text-2xs text-white/50 line-clamp-1">
                  {overlaySubtitle}
                </p>
              )}
            </div>

            <div className="pointer-events-auto flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                onPointerDown={handlePointerDownInside}
                className="cursor-pointer rounded-full px-3 py-1 text-2xs font-medium text-white/60 transition-colors duration-150 hover:bg-white/10 hover:text-white/90"
                style={{ border: "1px solid rgba(255,255,255,0.15)" }}
                aria-label="Close mission"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <div onPointerDown={handlePointerDownInside}>
        {isLoading && !path ? (
          renderLandscapeShell(
            <div className="flex items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/30 border-t-transparent" />
            </div>
          )
        ) : error || !path ? (
          renderStageCard(
            <div className="space-y-5">
              <div className="space-y-2">
                <p className="text-sm font-semibold text-white">Couldn&apos;t load this mission</p>
                <p className="text-sm text-white/45">
            {error ?? "Try reopening the mission from the room action bar."}
                  </p>
                </div>
                <div className="flex items-center justify-center pt-1">
                  <button
                    type="button"
                    onClick={onClose}
                    className="cursor-pointer rounded-full border border-white/[0.08] px-3 py-1.5 text-sm font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                  >
                    Close
                  </button>
                </div>
              </div>
            )
        ) : isCompleted ? (
          renderLandscapeShell(
            <RoomStageScaffold
              eyebrow="Mission"
              title={path.title}
              description="Your work is saved, and your mission evidence is ready to review whenever you want to jump into Progress."
              footerMeta="Mission · Completed"
              primaryAction={
                <button
                  type="button"
                  onClick={onViewProgress}
                  className="inline-flex h-9 cursor-pointer items-center justify-center rounded-[var(--sg-radius-btn)] bg-forest-500 px-4 text-sm font-semibold text-white transition-all duration-150 hover:opacity-85 hover:scale-[1.02] active:scale-[0.98] active:opacity-75"
                >
                  View Progress
                </button>
              }
              secondaryAction={
                <RoomStageSecondaryButton onClick={onClose}>
                  Keep Working In Room
                </RoomStageSecondaryButton>
              }
              contentClassName="max-w-[700px] space-y-4"
            >
              <RoomStagePanel className="space-y-2 text-center">
                <div className="flex items-center justify-center gap-2 text-sm font-semibold text-[var(--sg-forest-300)]">
                  <CheckCircle2 size={14} />
                  Mission complete
                </div>
                <p className="text-sm leading-6 text-white/55">
                  Everything for this mission has been saved from inside the room.
                </p>
              </RoomStagePanel>
            </RoomStageScaffold>,
            { fillHeight: true, maxWidthClassName: "max-w-[860px]" },
          )
        ) : showTransition && nextItem ? (
          renderLandscapeShell(
            <RoomStageScaffold
              eyebrow="Up Next"
              title={nextItem.title}
              description={nextItem.connective_text}
              footerMeta={`${getStepLabel(nextItem)} · Ready when you are`}
              primaryAction={
                <button
                  type="button"
                  onClick={handleContinue}
                  className="inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-[var(--sg-radius-btn)] bg-forest-500 px-4 text-sm font-semibold text-white transition-all duration-150 hover:opacity-85 hover:scale-[1.02] active:scale-[0.98] active:opacity-75"
                >
                  Continue
                  <ArrowRight size={14} />
                </button>
              }
              secondaryAction={
                <RoomStageSecondaryButton onClick={onClose}>
                  Close
                </RoomStageSecondaryButton>
              }
              contentClassName="max-w-[700px] space-y-4"
            >
              <RoomStagePanel className="space-y-3 text-center">
                <div className="flex items-center justify-center">
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-2xs text-white/50">
                    <PanelsTopLeft size={12} />
                    {getStepLabel(nextItem)}
                  </div>
                </div>
                <p className="text-sm leading-6 text-white/55">
                  This is the next step waiting for you in the mission.
                </p>
              </RoomStagePanel>
            </RoomStageScaffold>,
            { fillHeight: true, maxWidthClassName: "max-w-[860px]" },
          )
        ) : currentItem ? (
          renderLandscapeShell(
            <ContentViewer
              item={currentItem}
              isCompleted={isItemCompleted}
              onComplete={handleComplete}
              onCompleteWithState={handleCompleteWithState}
              variant="roomOverlay"
            />,
            {
              fillHeight: true,
              maxWidthClassName: isVideoStage ? "max-w-full" : "max-w-[860px]",
            },
          )
        ) : (
          renderStageCard(
            <div className="space-y-3">
              <p className="text-sm font-semibold text-white">This mission has no steps yet</p>
              <p className="text-sm text-white/45">
                Select another mission from the action bar to keep working in this room.
              </p>
            </div>
          )
        )}
      </div>
    </div>
  );
}
