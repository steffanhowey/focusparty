"use client";

import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Loader2, AlertCircle } from "lucide-react";

interface GenerationCardProps {
  status: "generating" | "failed";
  query: string;
  onRetry: () => void;
}

/**
 * Placeholder card shown in the results grid while a learning path
 * is being generated in the background. Matches PathCard dimensions.
 */
export function GenerationCard({ status, query, onRetry }: GenerationCardProps) {
  return (
    <Card className="overflow-hidden">
      {/* Thumbnail area — matches PathCard aspect-video */}
      <div
        className="relative aspect-video flex items-center justify-center"
        style={{
          background:
            "linear-gradient(135deg, var(--color-bg-secondary), var(--color-bg-hover))",
        }}
      >
        {status === "generating" ? (
          <Loader2
            size={32}
            className="text-[var(--color-text-tertiary)] animate-spin"
          />
        ) : (
          <AlertCircle
            size={32}
            className="text-[var(--color-coral-700)]"
          />
        )}
      </div>

      {/* Content area — matches PathCard p-3 space-y-2 */}
      <div className="p-3 space-y-2">
        {status === "generating" ? (
          <>
            <h3 className="text-sm font-medium text-[var(--color-text-primary)]">
              Building a learning path...
            </h3>
            <p className="text-xs text-[var(--color-text-tertiary)] line-clamp-1">
              {query}
            </p>
          </>
        ) : (
          <>
            <h3 className="text-sm font-medium text-[var(--color-text-primary)]">
              Couldn&apos;t generate path
            </h3>
            <Button variant="ghost" size="sm" onClick={onRetry}>
              Try again
            </Button>
          </>
        )}
      </div>
    </Card>
  );
}
