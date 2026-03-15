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
            className="shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
            style={{
              background: isActive
                ? "var(--color-accent-primary)"
                : "var(--color-bg-hover)",
              color: isActive
                ? "white"
                : "var(--color-text-secondary)",
            }}
          >
            {slug}
          </button>
        );
      })}
    </div>
  );
}
