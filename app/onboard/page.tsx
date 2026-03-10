"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Logo } from "@/components/shell/Logo";
import { useAuth } from "@/components/providers/AuthProvider";
import { createClient } from "@/lib/supabase/client";
import { createParty } from "@/lib/parties";
import { useUsernameValidation } from "@/lib/username";
import { PartyPopper, Check, X, Loader2, RefreshCw } from "lucide-react";

const STEPS_FULL = ["Identity", "Avatar", "Start focusing"];
const STEPS_RE_ONBOARD = ["Identity", "Avatar"];

function getInitials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function OnboardPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center" style={{ background: "var(--color-bg-primary)", color: "var(--color-text-primary)" }}>
        <p className="text-[var(--color-text-secondary)]">Loading...</p>
      </div>
    }>
      <OnboardContent />
    </Suspense>
  );
}

function OnboardContent() {
  const { user, authState } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  // Re-onboarding mode: existing user coming back to set username
  const isReOnboard = searchParams.get("step") === "username";
  const STEPS = isReOnboard ? STEPS_RE_ONBOARD : STEPS_FULL;

  const [step, setStep] = useState(0);
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  const username = useUsernameValidation();

  // Pre-fill display name from user metadata or existing profile
  useEffect(() => {
    if (!user) return;

    if (isReOnboard) {
      // For re-onboarding, fetch existing display name from profile
      const fetchProfile = async () => {
        const { data } = await supabase
          .from("fp_profiles")
          .select("display_name, avatar_url")
          .eq("id", user.id)
          .maybeSingle();
        if (data?.display_name) setDisplayName(data.display_name);
        if (data?.avatar_url) setAvatarUrl(data.avatar_url);
      };
      fetchProfile();
    } else {
      const meta = user.user_metadata;
      const first = meta?.first_name ?? "";
      const last = meta?.last_name ?? "";
      const full = `${first} ${last}`.trim();
      if (full) setDisplayName(full);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Auto-generate avatar when entering step 1 (avatar step)
  useEffect(() => {
    if (step === 1 && !avatarUrl && !generating && user && username.value) {
      generateAvatar();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const generateAvatar = useCallback(async () => {
    if (!user || !username.value) return;
    setGenerating(true);
    setGenError(null);

    try {
      const res = await fetch("/api/avatar/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.value, userId: user.id }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.fallback) {
          // Use DiceBear fallback
          const fallbackUrl = `https://api.dicebear.com/9.x/notionists-neutral/svg?seed=${username.value}`;
          setAvatarUrl(fallbackUrl);
          setGenError("AI generation unavailable. Using a placeholder — you can regenerate later from Settings.");
          // Save fallback URL to profile
          await supabase
            .from("fp_profiles")
            .update({ avatar_url: fallbackUrl })
            .eq("id", user.id);
        } else {
          setGenError("Failed to generate avatar. Try again.");
        }
      } else {
        const data = await res.json();
        setAvatarUrl(data.url);
      }
    } catch {
      setGenError("Failed to generate avatar. Try again.");
    } finally {
      setGenerating(false);
    }
  }, [user, username.value, supabase]);

  const shuffleAvatar = () => {
    setAvatarUrl(null);
    generateAvatar();
  };

  if (authState === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: "var(--color-bg-primary)", color: "var(--color-text-primary)" }}>
        <p className="text-[var(--color-text-secondary)]">Loading...</p>
      </div>
    );
  }

  if (authState === "anonymous") {
    router.replace("/login");
    return null;
  }

  const saveIdentity = async () => {
    if (!user || !displayName.trim() || !username.isValid) return;
    setSaving(true);

    const { error } = await supabase
      .from("fp_profiles")
      .update({
        display_name: displayName.trim(),
        username: username.value,
      })
      .eq("id", user.id);

    if (error) {
      // Handle unique constraint violation (race condition)
      if (error.code === "23505") {
        setSaving(false);
        username.setValue(username.value); // re-trigger availability check
        return;
      }
      console.error("[onboard] Save identity failed:", error);
    }

    setSaving(false);
    setStep(1);
  };

  const confirmAvatar = () => {
    if (isReOnboard) {
      // Re-onboarding complete — redirect back to app
      router.push("/session");
      return;
    }
    setStep(2);
  };

  const completeOnboarding = () => {
    if (!user) return;
    setSaving(true);

    // Navigate immediately — DB calls fire in background
    router.push("/session");

    supabase
      .from("fp_profiles")
      .update({ onboarding_completed: true })
      .eq("id", user.id);

    createParty(
      {
        creator_id: user.id,
        name: `${displayName}'s Party`,
        character: "ember",
        planned_duration_min: 25,
        max_participants: 3,
        status: "active",
      },
      displayName
    );
  };

  // Username status indicator
  const usernameIndicator = () => {
    switch (username.status) {
      case "checking":
        return <Loader2 size={16} className="animate-spin text-[var(--color-text-tertiary)]" />;
      case "available":
        return <Check size={16} className="text-[#5BC682]" />;
      case "taken":
      case "invalid":
        return <X size={16} className="text-[#EF5555]" />;
      default:
        return null;
    }
  };

  return (
    <div className="flex min-h-screen flex-col" style={{ background: "var(--color-bg-primary)", color: "var(--color-text-primary)" }}>
      <header className="backdrop-blur-md" style={{ background: "var(--color-bg-primary)" }}>
        <nav className="mx-auto flex h-16 max-w-6xl items-center px-4 sm:px-6">
          <Logo href="/" height={32} maxWidth={140} />
        </nav>
      </header>

      <main className="mx-auto w-full max-w-md flex-1 px-4 py-16 sm:py-24">
        {/* Progress dots */}
        <div className="mb-10 flex items-center justify-center gap-2">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-2 rounded-full transition-all ${
                i === step
                  ? "w-8 bg-[var(--color-accent-primary)]"
                  : i < step
                    ? "w-2 bg-[var(--color-text-tertiary)]"
                    : "w-2 bg-[var(--color-border-default)]"
              }`}
            />
          ))}
        </div>

        {/* Step 1: Identity — display name + username */}
        {step === 0 && (
          <>
            <h1 className="text-2xl font-semibold text-[var(--color-text-primary)]">
              {isReOnboard ? "Claim your handle" : "Who are you?"}
            </h1>
            <p className="mt-2 text-[var(--color-text-secondary)]">
              {isReOnboard
                ? "Pick a unique @username — this is how others will find you."
                : "Set your name and pick a unique @username."}
            </p>

            <div className="mt-8 rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-bg-hover)] p-6">
              {/* Display name */}
              <label className="mb-1.5 block text-xs font-medium text-[var(--color-text-secondary)]">
                Display name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
                className="h-11 w-full rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-hover)] px-4 text-sm text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-border-focus)]"
              />

              {/* Username */}
              <label className="mb-1.5 mt-5 block text-xs font-medium text-[var(--color-text-secondary)]">
                Username
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-[var(--color-text-tertiary)]">
                  @
                </span>
                <input
                  type="text"
                  value={username.value}
                  onChange={(e) => username.setValue(e.target.value)}
                  placeholder="your_handle"
                  className="h-11 w-full rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-hover)] pl-8 pr-10 text-sm text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-border-focus)]"
                  style={{
                    borderColor:
                      username.status === "available"
                        ? "#5BC682"
                        : username.status === "taken" || username.status === "invalid"
                          ? "#EF5555"
                          : undefined,
                  }}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2">
                  {usernameIndicator()}
                </span>
              </div>
              {username.error && (
                <p className="mt-1.5 text-xs text-[#EF5555]">{username.error}</p>
              )}
              {username.status === "available" && (
                <p className="mt-1.5 text-xs text-[#5BC682]">@{username.value} is available</p>
              )}

              <button
                onClick={saveIdentity}
                disabled={!displayName.trim() || !username.isValid || saving}
                className="mt-5 inline-flex h-12 w-full items-center justify-center rounded-full bg-[var(--color-accent-primary)] font-medium text-white transition-opacity hover:opacity-85 active:opacity-75 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Continue"}
              </button>
            </div>
          </>
        )}

        {/* Step 2: Avatar — AI-generated */}
        {step === 1 && (
          <>
            <h1 className="text-2xl font-semibold text-[var(--color-text-primary)]">
              Here&apos;s your look
            </h1>
            <p className="mt-2 text-[var(--color-text-secondary)]">
              We generated a unique avatar just for you.
            </p>

            <div className="mt-8 rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-bg-hover)] p-6">
              <div className="flex flex-col items-center gap-5">
                {/* Avatar display */}
                <div className="relative h-[120px] w-[120px] overflow-hidden rounded-full border-2 border-[var(--color-border-default)]">
                  {generating ? (
                    <div className="flex h-full w-full items-center justify-center bg-[var(--color-bg-active)]">
                      <div className="h-full w-full animate-pulse bg-gradient-to-br from-[var(--color-bg-active)] via-[var(--color-bg-hover)] to-[var(--color-bg-active)]" />
                      <Loader2
                        size={32}
                        className="absolute animate-spin text-[var(--color-text-tertiary)]"
                      />
                    </div>
                  ) : avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={avatarUrl}
                      alt="Your avatar"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-[var(--color-bg-active)] text-3xl font-bold text-[var(--color-text-secondary)]">
                      {getInitials(displayName || "FP")}
                    </div>
                  )}
                </div>

                {/* Shuffle button */}
                <button
                  onClick={shuffleAvatar}
                  disabled={generating}
                  className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-default)] px-5 py-2.5 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)] disabled:opacity-50"
                >
                  <RefreshCw size={14} strokeWidth={2} className={generating ? "animate-spin" : ""} />
                  {generating ? "Generating..." : "Shuffle"}
                </button>

                {genError && (
                  <p className="text-center text-xs text-[var(--color-text-tertiary)]">{genError}</p>
                )}
              </div>

              <button
                onClick={confirmAvatar}
                disabled={generating || !avatarUrl}
                className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-full bg-[var(--color-accent-primary)] font-medium text-white transition-opacity hover:opacity-85 active:opacity-75 disabled:opacity-50"
              >
                {isReOnboard ? "Done" : "Looks good"}
              </button>
            </div>
          </>
        )}

        {/* Step 3: Start focusing (only for new users) */}
        {step === 2 && !isReOnboard && (
          <>
            <h1 className="text-2xl font-semibold text-[var(--color-text-primary)]">
              You&apos;re all set!
            </h1>
            <p className="mt-2 text-[var(--color-text-secondary)]">
              Start your first focus session and see what FocusParty is all about.
            </p>

            <div className="mt-8 rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-bg-hover)] p-6 text-center">
              {/* Avatar + username welcome */}
              <div className="mb-4 flex flex-col items-center gap-3">
                {avatarUrl && (
                  <div className="h-16 w-16 overflow-hidden rounded-full border-2 border-[var(--color-border-default)]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                  </div>
                )}
                <p className="text-sm text-[var(--color-text-secondary)]">
                  Welcome, <strong className="text-[var(--color-text-primary)]">@{username.value}</strong>.
                  Let&apos;s get focused.
                </p>
              </div>
              <button
                onClick={completeOnboarding}
                disabled={saving}
                className="mt-2 inline-flex h-14 w-full items-center justify-center gap-2 rounded-full bg-[var(--color-accent-primary)] font-semibold text-white transition-opacity hover:opacity-85 active:opacity-75 disabled:opacity-50"
              >
                <PartyPopper size={20} strokeWidth={1.8} />
                {saving ? "Joining..." : "Join a party"}
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
