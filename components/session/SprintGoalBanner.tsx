"use client";

import { ArrowRight } from "lucide-react";

interface SprintGoalBannerProps {
  goalText: string;
  parentGoalTitle?: string | null;
}

export function SprintGoalBanner({
  goalText,
  parentGoalTitle,
}: SprintGoalBannerProps) {
  return (
    <div className="flex flex-col items-center text-center px-8">
      <span
        className="mb-3 text-2xs font-semibold uppercase tracking-widest text-white/30"
      >
        Mission
      </span>

      {parentGoalTitle ? (
        <>
          <h2
            className="text-3xl font-bold tracking-tight text-white md:text-4xl"
            style={{
              textShadow: "0 2px 8px rgba(0,0,0,0.5)",
            }}
          >
            {parentGoalTitle}
          </h2>
          <p
            className="mt-2.5 flex items-center gap-2 text-lg text-white/50"
            style={{ textShadow: "0 1px 4px rgba(0,0,0,0.4)" }}
          >
            <ArrowRight size={16} strokeWidth={2} className="shrink-0 text-white/30" />
            {goalText}
          </p>
        </>
      ) : (
        <h2
          className="text-3xl font-bold tracking-tight text-white md:text-4xl"
          style={{
            textShadow: "0 2px 8px rgba(0,0,0,0.5)",
          }}
        >
          {goalText}
        </h2>
      )}
    </div>
  );
}
