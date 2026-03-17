"use client";

/**
 * Loading skeleton for PathCard. Matches the simplified layout:
 * h-[200px] image card + title + one meta line below.
 */
export function PathCardSkeleton() {
  return (
    <div>
      {/* Image placeholder */}
      <div
        className="h-[200px] w-full animate-pulse rounded-md border bg-shell-100"
        style={{ borderColor: "var(--sg-shell-border)" }}
      />

      {/* Text placeholder below */}
      <div className="space-y-1.5 px-1 pt-2">
        <div className="h-4 w-4/5 animate-pulse rounded bg-shell-100" />
        <div className="h-3 w-2/5 animate-pulse rounded bg-shell-100" />
      </div>
    </div>
  );
}

/**
 * Grid of skeleton cards for loading states.
 */
export function PathCardSkeletonGrid({ count = 3 }: { count?: number }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }, (_, i) => (
        <PathCardSkeleton key={i} />
      ))}
    </div>
  );
}
