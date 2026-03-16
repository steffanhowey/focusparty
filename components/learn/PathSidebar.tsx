"use client";

import { useState } from "react";
import {
  Play,
  Pause,
  FileText,
  Pencil,
  Check,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  MessageSquare,
} from "lucide-react";
import type { LearningPath, LearningProgress, PathItem, CurriculumModule } from "@/lib/types";

interface PathSidebarProps {
  path: LearningPath;
  progress: LearningProgress | null;
  currentItemIndex: number;
  onSelectItem: (index: number) => void;
  isPlaying?: boolean;
  onTogglePlay?: () => void;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm ? `${h}h${rm}m` : `${h}h`;
}

/**
 * Path navigation sidebar for the learning environment.
 * Groups items by section with clear active/completed/upcoming states.
 */
export function PathSidebar({
  path,
  progress,
  currentItemIndex,
  onSelectItem,
  isPlaying,
  onTogglePlay,
}: PathSidebarProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const toggleSection = (section: string) => {
    setCollapsed((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  // Resolve modules — fallback to a single module for legacy paths
  const modules: CurriculumModule[] = path.modules?.length
    ? path.modules
    : [{
        index: 0,
        title: path.title,
        description: "",
        task_count: path.items.length,
        duration_seconds: path.estimated_duration_seconds,
      }];

  // Group items by module_index preserving global index
  const grouped: Record<string, (PathItem & { globalIndex: number })[]> = {};
  let idx = 0;
  for (const item of path.items) {
    const groupKey = `module-${item.module_index ?? 0}`;
    if (!grouped[groupKey]) grouped[groupKey] = [];
    grouped[groupKey].push({ ...item, globalIndex: idx });
    idx++;
  }

  const orderedSections = modules
    .map((mod) => ({ key: `module-${mod.index}`, items: grouped[`module-${mod.index}`] ?? [] }))
    .filter((s) => s.items.length > 0);

  const getItemKey = (item: PathItem): string =>
    item.item_id ?? item.content_id ?? `idx-${item.position ?? 0}`;

  const isItemCompleted = (item: PathItem): boolean =>
    progress?.item_states?.[getItemKey(item)]?.completed ?? false;

  // Check if an entire section/module is completed
  const isSectionCompleted = (sectionKey: string): boolean => {
    const items = grouped[sectionKey];
    if (!items?.length) return false;
    return items.every((i) => isItemCompleted(i));
  };

  return (
    <div className="h-full overflow-y-auto fp-shell-scroll">
      {/* Header + Progress */}
      <div className="p-4 space-y-3">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
          Path
        </h3>
        {progress && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-[var(--color-text-tertiary)]">
              <span>
                {progress.items_completed}/{progress.items_total} complete
              </span>
              <span>
                {progress.items_total > 0
                  ? Math.round(
                      (progress.items_completed / progress.items_total) * 100
                    )
                  : 0}
                %
              </span>
            </div>
            <div className="h-1 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${
                    progress.items_total > 0
                      ? Math.round(
                          (progress.items_completed / progress.items_total) *
                            100
                        )
                      : 0
                  }%`,
                  background:
                    "linear-gradient(to right, var(--color-accent-primary), var(--color-cyan-700))",
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Sections */}
      {orderedSections.map(({ key, items }) => {
        const currentGroupKey = `module-${path.items[currentItemIndex]?.module_index ?? 0}`;
        const isCollapsed = collapsed[key] ?? (key !== currentGroupKey);
        const moduleMeta = modules.find((m) => `module-${m.index}` === key);
        const sectionDone = isSectionCompleted(key);

        return (
          <div key={key}>
            <button
              onClick={() => toggleSection(key)}
              className="w-full flex items-center justify-between px-4 py-3.5 text-left hover:bg-[var(--color-bg-hover)] transition-colors"
            >
              <div className="flex items-center gap-1.5">
                {sectionDone && (
                  <Check
                    size={10}
                    style={{ color: "var(--color-green-700)" }}
                  />
                )}
                <span
                  className="text-[10px] font-semibold uppercase tracking-wider"
                  style={{
                    color: sectionDone
                      ? "var(--color-green-700)"
                      : "var(--color-text-tertiary)",
                  }}
                >
                  {moduleMeta?.title ?? key}
                </span>
              </div>
              {isCollapsed ? (
                <ChevronDown
                  size={12}
                  className="text-[var(--color-text-tertiary)]"
                />
              ) : (
                <ChevronUp
                  size={12}
                  className="text-[var(--color-text-tertiary)]"
                />
              )}
            </button>

            {!isCollapsed &&
              items.map((item) => {
                const isCurrent = item.globalIndex === currentItemIndex;
                const completed = isItemCompleted(item);
                const itemKey = getItemKey(item);

                return (
                  <button
                    key={itemKey}
                    onClick={() => onSelectItem(item.globalIndex)}
                    className="w-full flex items-start gap-2.5 px-4 py-3.5 text-left transition-colors border-b border-[rgba(255,255,255,0.06)]"
                    style={{
                      background: isCurrent
                        ? "var(--color-bg-hover)"
                        : "transparent",
                      borderLeft: isCurrent
                        ? "2px solid var(--color-accent-primary)"
                        : "2px solid transparent",
                    }}
                  >
                    {/* Format icon — interactive for current video */}
                    <span
                      className="shrink-0 flex items-center justify-center rounded-full transition-transform hover:scale-110"
                      style={{
                        width: 30,
                        height: 30,
                        background: completed
                          ? "rgba(255,255,255,0.06)"
                          : isCurrent
                            ? "var(--color-accent-primary)"
                            : "rgba(255,255,255,0.08)",
                        border: completed
                          ? "1px solid rgba(255,255,255,0.08)"
                          : isCurrent
                            ? "1px solid var(--color-accent-primary)"
                            : "1px solid rgba(255,255,255,0.10)",
                        cursor: isCurrent && item.content_type === "video" && !completed ? "pointer" : undefined,
                      }}
                      onClick={
                        isCurrent && item.content_type === "video" && !completed && onTogglePlay
                          ? (e) => { e.stopPropagation(); onTogglePlay(); }
                          : undefined
                      }
                    >
                      {completed ? (
                        <Check
                          size={14}
                          style={{ color: "var(--color-accent-primary)" }}
                        />
                      ) : (item.task_type ?? "watch") === "do" ? (
                        <Pencil
                          size={13}
                          style={{
                            color: isCurrent
                              ? "white"
                              : "var(--color-text-tertiary)",
                          }}
                        />
                      ) : (item.task_type ?? "watch") === "check" ? (
                        <HelpCircle
                          size={13}
                          style={{
                            color: isCurrent
                              ? "white"
                              : "var(--color-text-tertiary)",
                          }}
                        />
                      ) : (item.task_type ?? "watch") === "reflect" ? (
                        <MessageSquare
                          size={13}
                          style={{
                            color: isCurrent
                              ? "white"
                              : "var(--color-text-tertiary)",
                          }}
                        />
                      ) : item.content_type === "video" ? (
                        isCurrent && isPlaying ? (
                          <Pause
                            size={13}
                            style={{ color: "white" }}
                          />
                        ) : (
                          <Play
                            size={13}
                            className="ml-px"
                            style={{
                              color: isCurrent
                                ? "white"
                                : "var(--color-text-tertiary)",
                            }}
                          />
                        )
                      ) : (
                        <FileText
                          size={13}
                          style={{
                            color: isCurrent
                              ? "white"
                              : "var(--color-text-tertiary)",
                          }}
                        />
                      )}
                    </span>

                    {/* Title + duration */}
                    <div className="min-w-0">
                      <p
                        className="text-xs truncate"
                        style={{
                          color: completed
                            ? "var(--color-text-tertiary)"
                            : isCurrent
                              ? "var(--color-text-primary)"
                              : "var(--color-text-secondary)",
                          fontWeight: isCurrent ? 600 : 400,
                        }}
                      >
                        {item.title}
                      </p>
                      <span className="text-[10px] text-[var(--color-text-tertiary)]">
                        {formatDuration(item.duration_seconds)}
                        {(item.clip_start_seconds != null && item.clip_start_seconds > 0) || item.clip_end_seconds != null
                          ? " · clip"
                          : ""}
                      </span>
                    </div>
                  </button>
                );
              })}
          </div>
        );
      })}
    </div>
  );
}
