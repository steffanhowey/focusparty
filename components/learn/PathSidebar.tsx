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
import { FluencyBadge } from "@/components/skills/FluencyBadge";
import type { SkillFluency } from "@/lib/types/skills";

interface PathSidebarProps {
  path: LearningPath;
  progress: LearningProgress | null;
  currentItemIndex: number;
  onSelectItem: (index: number) => void;
  isPlaying?: boolean;
  onTogglePlay?: () => void;
  title?: string | null;
  showSkills?: boolean;
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
 * Dark (forest-900) immersive background — preserves rgba overlays.
 */
export function PathSidebar({
  path,
  progress,
  currentItemIndex,
  onSelectItem,
  isPlaying,
  onTogglePlay,
  title = "Path",
  showSkills = true,
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
        {title ? (
          <h3 className="text-sm font-semibold text-white">
            {title}
          </h3>
        ) : null}
        {progress && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
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
                    "linear-gradient(to right, var(--sg-forest-500), var(--sg-teal-600))",
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Skills */}
      {showSkills && path.skill_tags && path.skill_tags.length > 0 && (
        <div className="px-4 pb-3">
          <p className="mb-2 text-[10px] font-medium uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>
            Skills
          </p>
          <div className="space-y-1.5">
            {path.skill_tags
              .filter((t) => t.relevance === "primary")
              .slice(0, 3)
              .map((tag) => (
                <div
                  key={tag.skill_slug}
                  className="flex items-center justify-between"
                >
                  <span className="text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>
                    {tag.skill_name}
                  </span>
                  {tag.user_fluency && (
                    <FluencyBadge
                      level={tag.user_fluency as SkillFluency}
                      size="sm"
                    />
                  )}
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Sections */}
      {orderedSections.map(({ key, items }, sectionIndex) => {
        const currentGroupKey = `module-${path.items[currentItemIndex]?.module_index ?? 0}`;
        const isCollapsed = collapsed[key] ?? (key !== currentGroupKey);
        const moduleMeta = modules.find((m) => `module-${m.index}` === key);
        const sectionDone = isSectionCompleted(key);

        return (
          <div key={key}>
            {sectionIndex > 0 ? (
              <div className="mx-4 border-t border-white/[0.06]" />
            ) : null}
            <button
              onClick={() => toggleSection(key)}
              className="flex min-h-[56px] w-full items-center justify-between px-4 py-3.5 text-left transition-colors hover:bg-white/[0.06]"
            >
              <div className="flex items-center gap-1.5">
                {sectionDone && (
                  <Check
                    size={10}
                    style={{ color: "var(--sg-forest-300)" }}
                  />
                )}
                <span
                  className="text-xs font-semibold uppercase tracking-wider"
                  style={{
                    color: sectionDone
                      ? "var(--sg-forest-300)"
                      : "rgba(255,255,255,0.4)",
                  }}
                >
                  {moduleMeta?.title ?? key}
                </span>
              </div>
              {isCollapsed ? (
                <ChevronDown
                  size={12}
                  style={{ color: "rgba(255,255,255,0.4)" }}
                />
              ) : (
                <ChevronUp
                  size={12}
                  style={{ color: "rgba(255,255,255,0.4)" }}
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
                        ? "rgba(255,255,255,0.06)"
                        : "transparent",
                      borderLeft: isCurrent
                        ? "2px solid var(--sg-forest-500)"
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
                            ? "var(--sg-forest-500)"
                            : "rgba(255,255,255,0.08)",
                        border: completed
                          ? "1px solid rgba(255,255,255,0.08)"
                          : isCurrent
                            ? "1px solid var(--sg-forest-500)"
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
                          style={{ color: "var(--sg-forest-500)" }}
                        />
                      ) : (item.task_type ?? "watch") === "do" ? (
                        <Pencil
                          size={13}
                          style={{
                            color: isCurrent
                              ? "white"
                              : "rgba(255,255,255,0.4)",
                          }}
                        />
                      ) : (item.task_type ?? "watch") === "check" ? (
                        <HelpCircle
                          size={13}
                          style={{
                            color: isCurrent
                              ? "white"
                              : "rgba(255,255,255,0.4)",
                          }}
                        />
                      ) : (item.task_type ?? "watch") === "reflect" ? (
                        <MessageSquare
                          size={13}
                          style={{
                            color: isCurrent
                              ? "white"
                              : "rgba(255,255,255,0.4)",
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
                                : "rgba(255,255,255,0.4)",
                            }}
                          />
                        )
                      ) : (
                        <FileText
                          size={13}
                          style={{
                            color: isCurrent
                              ? "white"
                              : "rgba(255,255,255,0.4)",
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
                            ? "rgba(255,255,255,0.4)"
                            : isCurrent
                              ? "white"
                              : "rgba(255,255,255,0.6)",
                          fontWeight: isCurrent ? 600 : 400,
                        }}
                      >
                        {item.title}
                      </p>
                      <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>
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
