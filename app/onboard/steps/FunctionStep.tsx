"use client";

import { useState } from "react";
import type { LucideProps } from "lucide-react";
import {
  Code2,
  Megaphone,
  PenTool,
  Layers,
  BarChart3,
  Handshake,
  Settings,
  LayoutGrid,
  Star,
  Check,
} from "lucide-react";
import {
  FUNCTION_OPTIONS,
  type ProfessionalFunction,
} from "@/lib/onboarding/types";

const ICON_MAP: Record<string, React.ComponentType<LucideProps>> = {
  "code-2": Code2,
  megaphone: Megaphone,
  "pen-tool": PenTool,
  layers: Layers,
  "bar-chart-3": BarChart3,
  handshake: Handshake,
  settings: Settings,
};

interface FunctionStepProps {
  onSelect: (primary: ProfessionalFunction, secondaries: ProfessionalFunction[]) => void;
}

export default function FunctionStep({ onSelect }: FunctionStepProps) {
  const [mode, setMode] = useState<"single" | "multi">("single");
  const [selected, setSelected] = useState<Set<ProfessionalFunction>>(new Set());
  const [primary, setPrimary] = useState<ProfessionalFunction | null>(null);

  /** Single-select: tap a function card → advance immediately. */
  function handleSingleSelect(fn: ProfessionalFunction): void {
    onSelect(fn, []);
  }

  /** Enter multi-select mode. */
  function enterMultiMode(): void {
    setMode("multi");
  }

  /** Toggle a function in multi-select mode (max 3). */
  function toggleFunction(fn: ProfessionalFunction): void {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(fn)) {
        next.delete(fn);
        if (primary === fn) setPrimary(null);
      } else if (next.size < 3) {
        next.add(fn);
        // Auto-star if it's the first selection
        if (next.size === 1) setPrimary(fn);
      }
      return next;
    });
  }

  /** Star a function as primary in multi-select. */
  function starAsPrimary(fn: ProfessionalFunction): void {
    setPrimary(fn);
  }

  /** Confirm multi-select. */
  function confirmMulti(): void {
    if (!primary || selected.size === 0) return;
    const secondaries = [...selected].filter((f) => f !== primary);
    onSelect(primary, secondaries);
  }

  const canConfirmMulti = primary && selected.size >= 1;

  return (
    <>
      <h1 className="text-2xl font-semibold text-[var(--sg-shell-900)]">
        What kind of work do you do?
      </h1>
      <p className="mt-2 text-[var(--sg-shell-600)]">
        {mode === "single"
          ? "Pick your primary role — this shapes everything you see."
          : "Select up to 3, then star your primary."}
      </p>

      <div className="mt-8 grid grid-cols-2 gap-3">
        {FUNCTION_OPTIONS.map((opt) => {
          const Icon = ICON_MAP[opt.icon];
          const isSelected = selected.has(opt.value);
          const isPrimary = primary === opt.value;

          if (mode === "single") {
            return (
              <button
                key={opt.value}
                onClick={() => handleSingleSelect(opt.value)}
                className="group flex flex-col items-center gap-3 rounded-xl border border-[var(--sg-shell-border)] bg-[var(--sg-shell-100)] p-5 transition-all hover:border-[var(--sg-forest-500)] hover:bg-[var(--sg-shell-200)]"
              >
                {Icon && (
                  <Icon
                    size={28}
                    strokeWidth={1.5}
                    className="text-[var(--sg-shell-600)] transition-colors group-hover:text-[var(--sg-forest-500)]"
                  />
                )}
                <span className="text-sm font-medium text-[var(--sg-shell-900)]">
                  {opt.label}
                </span>
              </button>
            );
          }

          // Multi-select mode
          return (
            <button
              key={opt.value}
              onClick={() => toggleFunction(opt.value)}
              disabled={!isSelected && selected.size >= 3}
              className={`group relative flex flex-col items-center gap-3 rounded-xl border p-5 transition-all ${
                isSelected
                  ? "border-[var(--sg-forest-500)] bg-[var(--sg-shell-200)]"
                  : "border-[var(--sg-shell-border)] bg-[var(--sg-shell-100)] hover:border-[var(--sg-forest-500)]"
              } disabled:cursor-not-allowed disabled:opacity-40`}
            >
              {isSelected && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    starAsPrimary(opt.value);
                  }}
                  className="absolute right-2 top-2 rounded-full p-1 transition-colors hover:bg-[var(--sg-shell-100)]"
                  title="Set as primary"
                >
                  <Star
                    size={14}
                    strokeWidth={1.8}
                    className={
                      isPrimary
                        ? "fill-[var(--sg-gold-600)] text-[var(--sg-gold-600)]"
                        : "text-[var(--sg-shell-500)]"
                    }
                  />
                </button>
              )}
              {isSelected && (
                <div className="absolute left-2 top-2">
                  <Check size={14} strokeWidth={2} className="text-[var(--sg-forest-500)]" />
                </div>
              )}
              {Icon && (
                <Icon
                  size={28}
                  strokeWidth={1.5}
                  className={
                    isSelected
                      ? "text-[var(--sg-forest-500)]"
                      : "text-[var(--sg-shell-600)]"
                  }
                />
              )}
              <span className="text-sm font-medium text-[var(--sg-shell-900)]">
                {opt.label}
              </span>
            </button>
          );
        })}

        {/* Multiple / Founder card */}
        {mode === "single" ? (
          <button
            onClick={enterMultiMode}
            className="group flex flex-col items-center gap-3 rounded-xl border border-[var(--sg-shell-border)] bg-[var(--sg-shell-100)] p-5 transition-all hover:border-[var(--sg-forest-500)] hover:bg-[var(--sg-shell-200)]"
          >
            <LayoutGrid
              size={28}
              strokeWidth={1.5}
              className="text-[var(--sg-shell-600)] transition-colors group-hover:text-[var(--sg-forest-500)]"
            />
            <span className="text-sm font-medium text-[var(--sg-shell-900)]">
              Multiple / Founder
            </span>
          </button>
        ) : (
          <div className="col-span-2">
            {!canConfirmMulti && selected.size > 0 && !primary && (
              <p className="mb-3 text-center text-xs text-[var(--sg-gold-600)]">
                Star one as your primary to continue
              </p>
            )}
            <button
              onClick={confirmMulti}
              disabled={!canConfirmMulti}
              className="inline-flex h-12 w-full items-center justify-center rounded-full bg-[var(--sg-forest-500)] font-medium text-white transition-opacity hover:opacity-85 active:opacity-75 disabled:opacity-50"
            >
              Continue
            </button>
          </div>
        )}
      </div>
    </>
  );
}
