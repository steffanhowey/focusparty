"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import {
  renderActivityEvent,
  relativeTime,
} from "@/lib/activityEventRender";
import type { ActivityEvent } from "@/lib/types";

interface EnvironmentRailProps {
  activityEvents: ActivityEvent[];
  onClose: () => void;
}

export function EnvironmentRail({
  activityEvents,
  onClose,
}: EnvironmentRailProps) {
  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // Show latest events first (reversed for display)
  const recentEvents = activityEvents.slice(-15).reverse();

  return (
    <>
      {/* Panel header */}
      <div
        className="flex h-20 items-center justify-between px-4 md:px-6"
        style={{ textShadow: "0 1px 4px rgba(0,0,0,0.5)" }}
      >
        <span className="text-base font-semibold text-white">Momentum</span>
        <button
          type="button"
          onClick={onClose}
          className="cursor-pointer rounded-lg p-1.5 text-[var(--color-text-tertiary)] transition-colors hover:bg-white/10 hover:text-white"
          aria-label="Close momentum"
        >
          <X size={18} strokeWidth={2} />
        </button>
      </div>

      {/* Activity feed */}
      <div className="fp-shell-scroll flex-1 overflow-y-auto px-5 py-3">
        {recentEvents.length === 0 ? (
          <p className="py-4 text-center text-xs text-white/30">
            No activity yet
          </p>
        ) : (
          <div className="space-y-2.5">
            {recentEvents.map((event) => {
              const rendered = renderActivityEvent(event);
              const Icon = rendered.icon;
              return (
                <div
                  key={event.id}
                  className="flex items-start gap-2 text-xs"
                >
                  <Icon
                    size={14}
                    className="mt-0.5 shrink-0"
                    style={{ color: rendered.color }}
                  />
                  <div className="min-w-0 flex-1">
                    <span className="text-white/70">{rendered.label}</span>
                    <span className="ml-1.5 text-white/30">
                      {relativeTime(event.created_at)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
