"use client";

import { Card } from "@/components/ui/Card";

/**
 * Loading skeleton for PathCard. Matches PathCard dimensions.
 */
export function PathCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      {/* Thumbnail placeholder */}
      <div className="aspect-video bg-[var(--color-bg-hover)] animate-pulse" />

      {/* Content placeholder */}
      <div className="p-3 space-y-2.5">
        {/* Title */}
        <div className="h-4 w-4/5 rounded bg-[var(--color-bg-hover)] animate-pulse" />
        <div className="h-4 w-3/5 rounded bg-[var(--color-bg-hover)] animate-pulse" />

        {/* Description */}
        <div className="h-3 w-full rounded bg-[var(--color-bg-hover)] animate-pulse" />

        {/* Meta row */}
        <div className="flex items-center gap-2">
          <div className="h-3 w-16 rounded bg-[var(--color-bg-hover)] animate-pulse" />
          <div className="h-3 w-20 rounded bg-[var(--color-bg-hover)] animate-pulse" />
        </div>

        {/* Topic pills */}
        <div className="flex gap-1">
          <div className="h-4 w-14 rounded bg-[var(--color-bg-hover)] animate-pulse" />
          <div className="h-4 w-10 rounded bg-[var(--color-bg-hover)] animate-pulse" />
          <div className="h-4 w-16 rounded bg-[var(--color-bg-hover)] animate-pulse" />
        </div>
      </div>
    </Card>
  );
}

/**
 * Grid of skeleton cards for loading states.
 */
export function PathCardSkeletonGrid({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }, (_, i) => (
        <PathCardSkeleton key={i} />
      ))}
    </div>
  );
}
