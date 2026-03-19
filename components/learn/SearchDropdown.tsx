"use client";

import { useRef, useEffect } from "react";
import { Sparkles, ArrowRight, Bookmark, BookmarkCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { UsePathGenerationReturn } from "@/lib/usePathGeneration";
import type { LearningPath } from "@/lib/types";
import { PathCover } from "./PathCover";

// ─── Shared helpers ─────────────────────────────────────────

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

// ─── Props ──────────────────────────────────────────────────

interface SearchDropdownProps {
  query: string;
  results: LearningPath[];
  isSearching: boolean;
  shouldOfferGeneration: boolean;
  generation: UsePathGenerationReturn;
  onSelectPath: (pathId: string) => void;
  onStartGeneration: (query: string) => void;
  onClose: () => void;
  savedPathIds?: Set<string>;
  onToggleSave?: (path: LearningPath) => void;
}

// ─── Component ──────────────────────────────────────────────

/**
 * Dropdown overlay below the search input showing matching paths
 * and an explicit "Build Path" action row.
 */
export function SearchDropdown({
  query,
  results,
  isSearching,
  shouldOfferGeneration,
  generation,
  onSelectPath,
  onStartGeneration,
  onClose,
  savedPathIds,
  onToggleSave,
}: SearchDropdownProps) {
  void shouldOfferGeneration;
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  // Always show Build Path — dropdown is the only search surface
  const showBuildRow = true;

  const hasContent = results.length > 0 || showBuildRow || isSearching;
  if (!hasContent) return null;

  return (
    <div
      ref={dropdownRef}
      className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border shadow-lg"
      style={{
        background: "var(--sg-shell-50)",
        borderColor: "var(--sg-shell-border)",
      }}
      // Prevent input blur so clicks inside the dropdown (Build Path, result rows)
      // register before the dropdown closes
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="max-h-[60vh] overflow-y-auto">
        {/* Loading state */}
        {isSearching && results.length === 0 && (
          <div className="flex items-center gap-2 px-4 py-3">
            <Loader2
              size={14}
              className="animate-spin text-shell-500"
            />
            <span className="text-xs text-shell-500">
              Searching...
            </span>
          </div>
        )}

        {/* Build Path row — top spot: the exact match for their query */}
        {showBuildRow && (
          <BuildPathRow
            query={query}
            generation={generation}
            onSelectPath={onSelectPath}
            onStartGeneration={onStartGeneration}
            savedPathIds={savedPathIds}
            onToggleSave={onToggleSave}
          />
        )}

        {/* Divider between Build Mission and related results */}
        {results.length > 0 && showBuildRow && (
          <div
            className="border-t"
            style={{ borderColor: "var(--sg-shell-border)" }}
          />
        )}

        {/* Related results */}
        {results.length > 0 && (
          <div className="px-3 pt-2 pb-1">
            <p className="text-[10px] font-medium uppercase tracking-wider text-shell-500">
              Related missions
            </p>
          </div>
        )}
        {results.slice(0, 5).map((path) => (
          <ResultRow
            key={path.id}
            path={path}
            onSelect={() => onSelectPath(path.id)}
            isSaved={savedPathIds?.has(path.id) ?? false}
            onToggleSave={onToggleSave}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Result Row ─────────────────────────────────────────────

function ResultRow({
  path,
  onSelect,
  isSaved = false,
  onToggleSave,
}: {
  path: LearningPath;
  onSelect: () => void;
  isSaved?: boolean;
  onToggleSave?: (path: LearningPath) => void;
}) {
  const difficulty = DIFFICULTY_CONFIG[path.difficulty_level];
  const moduleCount = path.modules?.length ?? 0;

  return (
    <div className="flex items-center gap-2 px-3 py-2.5">
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-1 py-0.5 text-left transition-colors hover:bg-shell-100 cursor-pointer"
        onClick={onSelect}
      >
        {/* Thumbnail — branded cover at small size */}
        <div
          className="relative shrink-0 overflow-hidden rounded-md border"
          style={{
            width: 96,
            height: 64,
            borderColor: "var(--sg-shell-border)",
          }}
        >
          <PathCover path={path} height="h-full" sizes="96px" />
        </div>

        {/* Title + meta */}
        <div className="min-w-0 flex-1">
          {difficulty && (
            <span
              className="mb-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-medium leading-none"
              style={{
                background: "var(--sg-shell-100)",
                color: difficulty.color,
              }}
            >
              {difficulty.label}
            </span>
          )}
          <p className="truncate text-sm font-semibold text-shell-900">
            {path.title}
          </p>
          <p className="mt-0.5 text-xs text-shell-500">
            {formatDuration(path.estimated_duration_seconds)}
            {moduleCount > 0 && ` · ${moduleCount} parts`}
          </p>
          {path.skill_tags && path.skill_tags.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {path.skill_tags
                .filter((t) => t.relevance === "primary")
                .slice(0, 2)
                .map((tag) => (
                  <span
                    key={tag.skill_slug}
                    className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                    style={{
                      background: "var(--sg-shell-100)",
                      color: "var(--sg-shell-500)",
                    }}
                  >
                    {tag.skill_name}
                  </span>
                ))}
            </div>
          )}
        </div>

        {/* Navigate arrow */}
        <div
          className="shrink-0 flex items-center justify-center rounded-full"
          style={{
            width: 28,
            height: 28,
            background: "var(--sg-shell-100)",
          }}
        >
          <ArrowRight
            size={14}
            className="text-shell-500"
          />
        </div>
      </button>

      {onToggleSave && (
        <Button
          variant="ghost"
          size="xs"
          aria-label={isSaved ? "Remove from queue" : "Save to queue"}
          className="w-8 justify-center rounded-full px-0"
          leftIcon={
            isSaved ? (
              <BookmarkCheck size={14} strokeWidth={1.9} />
            ) : (
              <Bookmark size={14} strokeWidth={1.9} />
            )
          }
          onClick={() => onToggleSave(path)}
        >
          {null}
        </Button>
      )}
    </div>
  );
}

// ─── Thumbnail placeholder (shared by Build Path states) ────

function BuildPathThumbnail() {
  return (
    <div
      className="relative shrink-0 overflow-hidden rounded-md border flex items-center justify-center"
      style={{
        width: 96,
        height: 64,
        borderColor: "var(--sg-shell-border)",
        background: "white",
      }}
    >
      <Sparkles size={20} className="text-shell-500" />
    </div>
  );
}

// ─── Build Path Row ─────────────────────────────────────────

function BuildPathRow({
  query,
  generation,
  onSelectPath,
  onStartGeneration,
  savedPathIds,
  onToggleSave,
}: {
  query: string;
  generation: UsePathGenerationReturn;
  onSelectPath: (pathId: string) => void;
  onStartGeneration: (query: string) => void;
  savedPathIds?: Set<string>;
  onToggleSave?: (path: LearningPath) => void;
}) {
  const { status, generatedPath, retry } = generation;

  if (status === "generating") {
    return (
      <div className="flex w-full items-center gap-3 px-3 py-2.5">
        <BuildPathThumbnail />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-shell-900">
            Building mission
          </p>
          <p className="mt-1 text-xs text-shell-500">
            Curating a focused mission for {query}
          </p>
        </div>
        <Loader2
          size={14}
          className="animate-spin text-forest-500"
        />
      </div>
    );
  }

  // Completed state — show the generated path as a result row
  if (status === "complete" && generatedPath) {
    return (
      <ResultRow
        path={generatedPath}
        onSelect={() => onSelectPath(generatedPath.id)}
        isSaved={savedPathIds?.has(generatedPath.id) ?? false}
        onToggleSave={onToggleSave}
      />
    );
  }

  // Failed state — same row structure as ResultRow
  if (status === "failed") {
    return (
      <div className="flex w-full items-center gap-3 px-3 py-2.5">
        <BuildPathThumbnail />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-shell-900">
            Couldn&apos;t build mission
          </p>
          <p className="mt-1 text-xs text-shell-500">
            Not enough content available yet
          </p>
        </div>
        <Button variant="ghost" size="xs" onClick={retry}>
          Try again
        </Button>
      </div>
    );
  }

  // Idle — show the Build Mission button
  return (
    <div className="flex w-full items-center gap-3 px-3 py-2.5">
      <BuildPathThumbnail />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-shell-900">
          {query}
        </p>
        <p className="mt-0.5 text-xs text-shell-500">
          Custom AI-curated mission set
        </p>
      </div>
      <Button
        variant="outline"
        size="xs"
        onClick={() => onStartGeneration(query)}
        className="!border-forest-500 !text-forest-500 hover:!bg-forest-500/10"
      >
        Build Mission
      </Button>
    </div>
  );
}
