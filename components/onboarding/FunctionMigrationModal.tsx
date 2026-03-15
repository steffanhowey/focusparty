"use client";

import { useState, useEffect, useCallback } from "react";
import { X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";
import { useProfile } from "@/lib/useProfile";
import FunctionStep from "@/app/onboard/steps/FunctionStep";
import FluencyStep from "@/app/onboard/steps/FluencyStep";
import type { ProfessionalFunction, FluencyLevel } from "@/lib/onboarding/types";

const MAX_DISMISSALS = 3;

/**
 * Modal for existing users who onboarded before function/fluency was added.
 * Shows on login when primary_function IS NULL.
 * Dismissable — resurfaces once per week, max 3 times.
 */
export function FunctionMigrationModal() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState<0 | 1>(0);
  const [primaryFunction, setPrimaryFunction] =
    useState<ProfessionalFunction | null>(null);
  const [secondaryFunctions, setSecondaryFunctions] = useState<
    ProfessionalFunction[]
  >([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!profile || !user) return;
    // Already has function set — nothing to do
    if (profile.primary_function) return;
    // Hasn't completed onboarding — let the wizard handle it
    if (!profile.onboarding_completed) return;
    // Hit max dismissals
    if (profile.function_prompt_dismissed_count >= MAX_DISMISSALS) return;

    // Check if dismissed recently (within 7 days) via localStorage
    const lastDismissed = localStorage.getItem("sg_func_prompt_dismissed_at");
    if (lastDismissed) {
      const daysSince =
        (Date.now() - new Date(lastDismissed).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince < 7) return;
    }

    setVisible(true);
  }, [profile, user]);

  const dismiss = useCallback(async () => {
    setVisible(false);
    localStorage.setItem(
      "sg_func_prompt_dismissed_at",
      new Date().toISOString()
    );

    if (!user) return;
    const supabase = createClient();
    // Increment dismissal count via raw RPC isn't available,
    // so read + write the count
    const current = profile?.function_prompt_dismissed_count ?? 0;
    await supabase
      .from("fp_profiles")
      .update({ function_prompt_dismissed_count: current + 1 })
      .eq("id", user.id);
  }, [user, profile]);

  const handleFunctionSelect = useCallback(
    (primary: ProfessionalFunction, secondaries: ProfessionalFunction[]) => {
      setPrimaryFunction(primary);
      setSecondaryFunctions(secondaries);
      setStep(1);
    },
    []
  );

  const handleFluencySelect = useCallback(
    async (level: FluencyLevel) => {
      if (!user || !primaryFunction) return;
      setSaving(true);

      const supabase = createClient();
      await supabase
        .from("fp_profiles")
        .update({
          primary_function: primaryFunction,
          secondary_functions: secondaryFunctions,
          fluency_level: level,
        })
        .eq("id", user.id);

      setSaving(false);
      setVisible(false);
    },
    [user, primaryFunction, secondaryFunctions]
  );

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 animate-fade-in"
        style={{ background: "rgba(0,0,0,0.6)" }}
        onClick={dismiss}
      />

      {/* Modal */}
      <div
        className="relative z-10 mx-4 w-full max-w-md animate-scale-in overflow-hidden rounded-2xl"
        style={{
          background: "var(--color-bg-elevated)",
          border: "1px solid var(--color-border-default)",
          boxShadow: "var(--shadow-xl)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--color-border-default)] px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
              {step === 0
                ? "We\u2019ve added something new"
                : "One more thing"}
            </h2>
            <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
              {step === 0
                ? "Tell us what you do and we\u2019ll personalize everything."
                : "This helps us calibrate your experience."}
            </p>
          </div>
          <button
            onClick={dismiss}
            className="rounded-full p-1.5 text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-secondary)]"
          >
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
          {step === 0 && <FunctionStep onSelect={handleFunctionSelect} />}
          {step === 1 && (
            <>
              <FluencyStep onSelect={handleFluencySelect} />
              {saving && (
                <p className="mt-3 text-center text-xs text-[var(--color-text-tertiary)]">
                  Saving...
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
