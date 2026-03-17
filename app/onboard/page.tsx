"use client";

import { Suspense, useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Logo } from "@/components/shell/Logo";
import { useAuth } from "@/components/providers/AuthProvider";
import { createClient } from "@/lib/supabase/client";
import { useUsernameValidation } from "@/lib/username";
import type {
  ProfessionalFunction,
  FluencyLevel,
  OnboardingPick,
} from "@/lib/onboarding/types";
import {
  trackStepViewed,
  trackStepCompleted,
  trackFunctionSelected,
  trackFluencySelected,
  trackPathAccepted,
  trackOnboardingCompleted,
} from "@/lib/onboarding/tracking";
import FunctionStep from "./steps/FunctionStep";
import FluencyStep from "./steps/FluencyStep";
import PathRecommendationStep from "./steps/PathRecommendationStep";
import UsernameStep from "./steps/UsernameStep";

const STEPS = ["Function", "Fluency", "Path", "Username"];

function generateTempHandle(): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `user_${rand}`;
}

export default function OnboardPage() {
  return (
    <Suspense
      fallback={
        <div
          className="flex min-h-screen items-center justify-center"
          style={{
            background: "var(--sg-white)",
            color: "var(--sg-shell-900)",
          }}
        >
          <p className="text-[var(--sg-shell-600)]">Loading...</p>
        </div>
      }
    >
      <OnboardContent />
    </Suspense>
  );
}

function OnboardContent() {
  const { user, authState } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  // Re-onboarding: existing user sent back to set username only
  const isReOnboard = searchParams.get("step") === "username";

  // Restore wizard progress from localStorage (survives tab close)
  const savedProgress = useRef(
    (() => {
      if (isReOnboard || typeof window === "undefined") return null;
      try {
        const raw = localStorage.getItem("sg_onboard_progress");
        return raw ? (JSON.parse(raw) as {
          step: number;
          primaryFunction: ProfessionalFunction | null;
          secondaryFunctions: ProfessionalFunction[];
          fluencyLevel: FluencyLevel | null;
        }) : null;
      } catch {
        return null;
      }
    })()
  );

  const [step, setStep] = useState(isReOnboard ? 3 : (savedProgress.current?.step ?? 0));
  const [saving, setSaving] = useState(false);

  // Timing for analytics
  const wizardStartRef = useRef(Date.now());
  const stepStartRef = useRef(Date.now());

  // Selections accumulated through the wizard (restored from localStorage if available)
  const [primaryFunction, setPrimaryFunction] =
    useState<ProfessionalFunction | null>(savedProgress.current?.primaryFunction ?? null);
  const [secondaryFunctions, setSecondaryFunctions] = useState<
    ProfessionalFunction[]
  >(savedProgress.current?.secondaryFunctions ?? []);
  const [fluencyLevel, setFluencyLevel] = useState<FluencyLevel | null>(
    savedProgress.current?.fluencyLevel ?? null
  );
  const [selectedPick, setSelectedPick] = useState<OnboardingPick | null>(null);

  // Username (reuses existing validation hook)
  const username = useUsernameValidation();
  const [displayName, setDisplayName] = useState("");

  // Pre-fill display name from user metadata
  useEffect(() => {
    if (!user) return;

    if (isReOnboard) {
      const fetchProfile = async () => {
        const { data } = await supabase
          .from("fp_profiles")
          .select("display_name")
          .eq("id", user.id)
          .maybeSingle();
        if (data?.display_name) setDisplayName(data.display_name);
      };
      fetchProfile();
    } else {
      const meta = user.user_metadata;
      const first = (meta?.first_name as string) ?? "";
      const last = (meta?.last_name as string) ?? "";
      const full = `${first} ${last}`.trim();
      if (full) setDisplayName(full);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Track step views
  useEffect(() => {
    trackStepViewed(step);
    stepStartRef.current = Date.now();
  }, [step]);

  // Persist wizard progress to localStorage on each step change
  useEffect(() => {
    if (isReOnboard) return;
    localStorage.setItem(
      "sg_onboard_progress",
      JSON.stringify({ step, primaryFunction, secondaryFunctions, fluencyLevel })
    );
  }, [step, primaryFunction, secondaryFunctions, fluencyLevel, isReOnboard]);

  // Partial save to DB when function/fluency are set (protects against data loss)
  useEffect(() => {
    if (!user || !primaryFunction || !fluencyLevel) return;
    const supabaseClient = createClient();
    supabaseClient
      .from("fp_profiles")
      .update({
        primary_function: primaryFunction,
        secondary_functions: secondaryFunctions,
        fluency_level: fluencyLevel,
      })
      .eq("id", user.id)
      .then(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fluencyLevel]);

  // Auto-suggest username from display name
  useEffect(() => {
    if (step === 3 && displayName && !username.value) {
      const suggested = displayName
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_|_$/g, "")
        .slice(0, 20);
      if (suggested.length >= 3) {
        username.setValue(suggested);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, displayName]);

  // --- Step handlers ---

  const handleFunctionSelect = useCallback(
    (primary: ProfessionalFunction, secondaries: ProfessionalFunction[]) => {
      const elapsed = Date.now() - stepStartRef.current;
      trackStepCompleted(0, primary, elapsed);
      trackFunctionSelected(primary, secondaries);
      setPrimaryFunction(primary);
      setSecondaryFunctions(secondaries);
      setStep(1);
    },
    []
  );

  const handleFluencySelect = useCallback((level: FluencyLevel, notSure?: boolean) => {
    const elapsed = Date.now() - stepStartRef.current;
    trackStepCompleted(1, level, elapsed);
    trackFluencySelected(level, notSure ?? false);
    setFluencyLevel(level);
    if (notSure) {
      localStorage.setItem("sg_fluency_not_sure", "true");
    }
    setStep(2);
  }, []);

  const handleStartPath = useCallback(
    (pick: OnboardingPick) => {
      const elapsed = Date.now() - stepStartRef.current;
      trackStepCompleted(2, pick.display_title, elapsed);
      trackPathAccepted(pick.id, true);
      setSelectedPick(pick);
      setStep(3);
    },
    []
  );

  const handleBrowse = useCallback(() => {
    setSelectedPick(null);
    setStep(3);
  }, []);

  /** Save all onboarding data and complete the wizard. */
  const completeOnboarding = useCallback(
    async (handle: string) => {
      if (!user) return;
      setSaving(true);

      const updates: Record<string, unknown> = {
        username: handle,
        onboarding_completed: true,
      };

      if (primaryFunction) updates.primary_function = primaryFunction;
      if (secondaryFunctions.length > 0)
        updates.secondary_functions = secondaryFunctions;
      if (fluencyLevel) updates.fluency_level = fluencyLevel;
      if (selectedPick)
        updates.recommended_first_path_id = selectedPick.id;

      // Persist display name if not already saved
      if (displayName.trim()) updates.display_name = displayName.trim();

      const { error } = await supabase
        .from("fp_profiles")
        .update(updates)
        .eq("id", user.id);

      if (error) {
        // Handle unique constraint on username
        if (error.code === "23505") {
          setSaving(false);
          username.setValue(handle);
          return;
        }
        console.error("[onboard] Save failed:", error);
      }

      // Track onboarding completion
      const totalDuration = Date.now() - wizardStartRef.current;
      trackStepCompleted(3, handle, Date.now() - stepStartRef.current);
      trackOnboardingCompleted(totalDuration, 4);

      // Clear wizard progress from localStorage
      localStorage.removeItem("sg_onboard_progress");

      // Fire avatar generation in the background
      fetch("/api/avatar/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: handle, userId: user.id }),
      }).catch(() => {
        // Fallback avatar will be generated on next profile load
      });

      // Navigate to the selected path or browse page
      if (selectedPick) {
        // Generate path from the pick topic, then navigate
        router.push(`/learn?q=${encodeURIComponent(selectedPick.path_topic)}`);
      } else {
        router.push("/learn");
      }
    },
    [
      user,
      supabase,
      router,
      primaryFunction,
      secondaryFunctions,
      fluencyLevel,
      selectedPick,
      displayName,
      username,
    ]
  );

  const handleUsernameConfirm = useCallback(() => {
    if (!username.isValid) return;
    completeOnboarding(username.value);
  }, [username.isValid, username.value, completeOnboarding]);

  const handleUsernameSkip = useCallback(() => {
    completeOnboarding(generateTempHandle());
  }, [completeOnboarding]);

  // --- Auth guard ---

  if (authState === "loading") {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{
          background: "var(--sg-white)",
          color: "var(--sg-shell-900)",
        }}
      >
        <p className="text-[var(--sg-shell-600)]">Loading...</p>
      </div>
    );
  }

  if (authState === "anonymous") {
    router.replace("/login");
    return null;
  }

  // --- Render ---

  const visibleSteps = isReOnboard ? 1 : STEPS.length;
  const normalizedStep = isReOnboard ? 0 : step;

  return (
    <div
      className="flex min-h-screen flex-col"
      style={{
        background: "var(--sg-white)",
        color: "var(--sg-shell-900)",
      }}
    >
      <header
        className="backdrop-blur-md"
        style={{ background: "var(--sg-white)" }}
      >
        <nav className="mx-auto flex h-16 max-w-6xl items-center px-4 sm:px-6">
          <Logo href="/" height={32} maxWidth={140} />
        </nav>
      </header>

      <main className="mx-auto w-full max-w-md flex-1 px-4 py-16 sm:py-24">
        {/* Progress dots */}
        <div className="mb-10 flex items-center justify-center gap-2">
          {Array.from({ length: visibleSteps }).map((_, i) => (
            <div
              key={i}
              className={`h-2 rounded-full transition-all ${
                i === normalizedStep
                  ? "w-8 bg-[var(--sg-forest-500)]"
                  : i < normalizedStep
                    ? "w-2 bg-[var(--sg-shell-500)]"
                    : "w-2 bg-[var(--sg-shell-border)]"
              }`}
            />
          ))}
        </div>

        {/* Step 1: Function */}
        {step === 0 && <FunctionStep onSelect={handleFunctionSelect} />}

        {/* Step 2: Fluency */}
        {step === 1 && <FluencyStep onSelect={handleFluencySelect} />}

        {/* Step 3: Path recommendation */}
        {step === 2 && primaryFunction && fluencyLevel && (
          <PathRecommendationStep
            primaryFunction={primaryFunction}
            fluencyLevel={fluencyLevel}
            secondaryFunctions={secondaryFunctions}
            onStartPath={handleStartPath}
            onBrowse={handleBrowse}
          />
        )}

        {/* Step 4: Username */}
        {step === 3 && (
          <UsernameStep
            username={username}
            saving={saving}
            onConfirm={handleUsernameConfirm}
            onSkip={handleUsernameSkip}
          />
        )}
      </main>
    </div>
  );
}
