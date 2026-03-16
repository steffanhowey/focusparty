"use client";

interface TopicFiltersProps {
  topics: string[];
  selected: string[];
  onToggle: (slug: string) => void;
}

/**
 * Horizontal scrollable row of topic filter pills.
 */
export function TopicFilters({ topics, selected, onToggle }: TopicFiltersProps) {
  if (topics.length === 0) return null;

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
      {topics.map((slug) => {
        const isActive = selected.includes(slug);
        return (
          <button
            key={slug}
            onClick={() => onToggle(slug)}
            className="shrink-0 px-3 py-1.5 rounded-full text-xs font-medium backdrop-blur-md transition-colors"
            style={{
              background: isActive
                ? "var(--color-accent-primary)"
                : "rgba(0,0,0,0.35)",
              color: isActive ? "white" : "rgba(255,255,255,0.8)",
              border: `1px solid ${isActive ? "transparent" : "rgba(255,255,255,0.15)"}`,
            }}
          >
            {slug}
          </button>
        );
      })}
    </div>
  );
}
