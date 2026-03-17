"use client";

import { useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { useProfile } from "@/lib/useProfile";
import { useUsernameValidation, type UsernameStatus } from "@/lib/username";
import { RefreshCw, Check, X, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  FUNCTION_OPTIONS,
  FLUENCY_OPTIONS,
  type ProfessionalFunction,
  type FluencyLevel,
} from "@/lib/onboarding/types";

const inputClass =
  "h-11 w-full rounded-lg border border-[var(--sg-shell-border)] bg-[var(--sg-shell-50)] px-4 text-sm text-[var(--sg-shell-900)] outline-none placeholder:text-[var(--sg-shell-400)] focus:border-[var(--sg-forest-400)]";

function UsernameStatusIcon({ status }: { status: UsernameStatus }) {
  switch (status) {
    case "checking":
      return <Loader2 size={16} className="animate-spin text-[var(--sg-shell-400)]" />;
    case "available":
      return <Check size={16} className="text-[var(--sg-forest-400)]" />;
    case "taken":
    case "invalid":
      return <X size={16} className="text-[var(--sg-coral-500)]" />;
    default:
      return null;
  }
}

export function ProfileSettings() {
  const { userId, email } = useCurrentUser();
  const { profile, refetch } = useProfile();
  const supabase = createClient();

  const [displayName, setDisplayName] = useState<string | null>(null);
  const [savingName, setSavingName] = useState(false);
  const [savingUsername, setSavingUsername] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genMessage, setGenMessage] = useState<string | null>(null);

  const username = useUsernameValidation(profile?.username ?? "");
  const nameChanged = displayName !== null && displayName !== (profile?.display_name ?? "");
  const usernameChanged = username.value !== (profile?.username ?? "") && username.isValid;

  const currentDisplayName = displayName ?? profile?.display_name ?? "";

  const saveDisplayName = useCallback(async () => {
    if (!userId || !currentDisplayName.trim()) return;
    setSavingName(true);
    await supabase
      .from("fp_profiles")
      .update({ display_name: currentDisplayName.trim() })
      .eq("id", userId);
    await refetch();
    setDisplayName(null);
    setSavingName(false);
  }, [userId, currentDisplayName, supabase, refetch]);

  const saveUsername = useCallback(async () => {
    if (!userId || !username.isValid) return;
    setSavingUsername(true);

    const { error } = await supabase
      .from("fp_profiles")
      .update({ username: username.value })
      .eq("id", userId);

    if (error?.code === "23505") {
      username.setValue(username.value); // re-trigger check
    }

    await refetch();
    setSavingUsername(false);
  }, [userId, username, supabase, refetch]);

  const regenerateAvatar = useCallback(async () => {
    if (!userId || !profile?.username) return;
    setGenerating(true);
    setGenMessage(null);

    try {
      const res = await fetch("/api/avatar/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: profile.username, userId }),
      });

      if (!res.ok) {
        setGenMessage("Failed to generate — try again.");
      } else {
        setGenMessage("Avatar updated!");
        await refetch();
      }
    } catch {
      setGenMessage("Failed to generate — try again.");
    } finally {
      setGenerating(false);
    }
  }, [userId, profile?.username, refetch]);

  if (!profile) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-[var(--sg-shell-400)]" />
      </div>
    );
  }

  return (
    <div className="space-y-8 py-8">
      <div>
        <h2 className="text-lg font-semibold text-[var(--sg-shell-900)]">Profile</h2>
        <p className="mt-1 text-sm text-[var(--sg-shell-600)]">
          Manage your identity across SkillGap.
        </p>
      </div>

      {/* Avatar section */}
      <div className="rounded-lg border border-[var(--sg-shell-border)] bg-[var(--sg-shell-50)] p-6">
        <label className="mb-3 block text-xs font-medium text-[var(--sg-shell-600)]">
          Avatar
        </label>
        <div className="flex items-center gap-5">
          <div className="relative h-[88px] w-[88px] overflow-hidden rounded-full border-2 border-[var(--sg-shell-border)]">
            {profile.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.avatar_url}
                alt="Avatar"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-[var(--sg-shell-100)] text-2xl font-bold text-[var(--sg-shell-600)]">
                {currentDisplayName.charAt(0).toUpperCase()}
              </div>
            )}
            {generating && (
              <div className="absolute inset-0 flex items-center justify-center bg-[var(--sg-shell-900)]/40">
                <Loader2 size={24} className="animate-spin text-white" />
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Button
              variant="outline"
              size="sm"
              onClick={regenerateAvatar}
              disabled={generating || !profile.username}
              leftIcon={<RefreshCw size={14} className={generating ? "animate-spin" : ""} />}
            >
              {generating ? "Generating..." : "Regenerate"}
            </Button>
            {genMessage && (
              <p className="text-xs text-[var(--sg-shell-500)]">{genMessage}</p>
            )}
            {!profile.username && (
              <p className="text-xs text-[var(--sg-shell-500)]">
                Set a username first to generate an avatar.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Display name */}
      <div className="rounded-lg border border-[var(--sg-shell-border)] bg-[var(--sg-shell-50)] p-6">
        <label className="mb-1.5 block text-xs font-medium text-[var(--sg-shell-600)]">
          Display name
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={currentDisplayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your name"
            className={inputClass}
          />
          {nameChanged && (
            <button
              onClick={saveDisplayName}
              disabled={savingName || !currentDisplayName.trim()}
              className="shrink-0 rounded-lg bg-[var(--sg-forest-500)] px-4 text-sm font-medium text-white transition-opacity hover:opacity-85 disabled:opacity-50"
            >
              {savingName ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            </button>
          )}
        </div>
      </div>

      {/* Username */}
      <div className="rounded-lg border border-[var(--sg-shell-border)] bg-[var(--sg-shell-50)] p-6">
        <label className="mb-1.5 block text-xs font-medium text-[var(--sg-shell-600)]">
          Username
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-[var(--sg-shell-400)]">
              @
            </span>
            <input
              type="text"
              value={username.value}
              onChange={(e) => username.setValue(e.target.value)}
              placeholder="your_handle"
              className={`${inputClass} pl-8 pr-10`}
              style={{
                borderColor:
                  username.status === "available"
                    ? "var(--sg-forest-400)"
                    : username.status === "taken" || username.status === "invalid"
                      ? "var(--sg-coral-500)"
                      : undefined,
              }}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2">
              <UsernameStatusIcon status={username.status} />
            </span>
          </div>
          {usernameChanged && (
            <button
              onClick={saveUsername}
              disabled={savingUsername}
              className="shrink-0 rounded-lg bg-[var(--sg-forest-500)] px-4 text-sm font-medium text-white transition-opacity hover:opacity-85 disabled:opacity-50"
            >
              {savingUsername ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            </button>
          )}
        </div>
        {username.error && (
          <p className="mt-1.5 text-xs text-[var(--sg-coral-500)]">{username.error}</p>
        )}
        {username.status === "available" && usernameChanged && (
          <p className="mt-1.5 text-xs text-[var(--sg-forest-500)]">@{username.value} is available</p>
        )}
        {profile.username && !usernameChanged && (
          <p className="mt-1.5 text-xs text-[var(--sg-shell-500)]">
            Your current handle: @{profile.username}
          </p>
        )}
      </div>

      {/* Email (read-only) */}
      <div className="rounded-lg border border-[var(--sg-shell-border)] bg-[var(--sg-shell-50)] p-6">
        <label className="mb-1.5 block text-xs font-medium text-[var(--sg-shell-600)]">
          Email
        </label>
        <input
          type="email"
          value={email ?? ""}
          disabled
          className={`${inputClass} cursor-not-allowed opacity-60`}
        />
      </div>

      {/* Function & Fluency */}
      <FunctionFluencySection
        userId={userId}
        currentFunction={profile.primary_function as ProfessionalFunction | null}
        currentFluency={profile.fluency_level as FluencyLevel | null}
        onSaved={refetch}
      />
    </div>
  );
}

// ─── Function & Fluency Settings ─────────────────────────────

function FunctionFluencySection({
  userId,
  currentFunction,
  currentFluency,
  onSaved,
}: {
  userId: string | null;
  currentFunction: ProfessionalFunction | null;
  currentFluency: FluencyLevel | null;
  onSaved: () => void;
}) {
  const supabase = createClient();
  const [fn, setFn] = useState<ProfessionalFunction | null>(currentFunction);
  const [fl, setFl] = useState<FluencyLevel | null>(currentFluency);
  const [saving, setSaving] = useState(false);

  const hasChanges = fn !== currentFunction || fl !== currentFluency;

  const save = useCallback(async () => {
    if (!userId || !fn || !fl) return;
    setSaving(true);
    await supabase
      .from("fp_profiles")
      .update({ primary_function: fn, fluency_level: fl })
      .eq("id", userId);
    onSaved();
    setSaving(false);
  }, [userId, fn, fl, supabase, onSaved]);

  const fnLabel =
    FUNCTION_OPTIONS.find((o) => o.value === currentFunction)?.label ?? "Not set";
  const flLabel =
    FLUENCY_OPTIONS.find((o) => o.value === currentFluency)?.label ?? "Not set";

  return (
    <>
      <div>
        <h2 className="text-lg font-semibold text-[var(--sg-shell-900)]">
          Personalization
        </h2>
        <p className="mt-1 text-sm text-[var(--sg-shell-600)]">
          These shape your learning paths and recommendations.
        </p>
      </div>

      <div className="rounded-lg border border-[var(--sg-shell-border)] bg-[var(--sg-shell-50)] p-6 space-y-5">
        {/* Function */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-[var(--sg-shell-600)]">
            Professional function
          </label>
          <select
            value={fn ?? ""}
            onChange={(e) => setFn((e.target.value || null) as ProfessionalFunction | null)}
            className="h-11 w-full rounded-lg border border-[var(--sg-shell-border)] bg-[var(--sg-shell-50)] px-3 text-sm text-[var(--sg-shell-900)] outline-none focus:border-[var(--sg-forest-400)]"
          >
            <option value="">Select...</option>
            {FUNCTION_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {!hasChanges && (
            <p className="mt-1 text-xs text-[var(--sg-shell-500)]">
              Current: {fnLabel}
            </p>
          )}
        </div>

        {/* Fluency */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-[var(--sg-shell-600)]">
            AI fluency level
          </label>
          <select
            value={fl ?? ""}
            onChange={(e) => setFl((e.target.value || null) as FluencyLevel | null)}
            className="h-11 w-full rounded-lg border border-[var(--sg-shell-border)] bg-[var(--sg-shell-50)] px-3 text-sm text-[var(--sg-shell-900)] outline-none focus:border-[var(--sg-forest-400)]"
          >
            <option value="">Select...</option>
            {FLUENCY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label} — {o.anchor}
              </option>
            ))}
          </select>
          {!hasChanges && (
            <p className="mt-1 text-xs text-[var(--sg-shell-500)]">
              Current: {flLabel}
            </p>
          )}
        </div>

        {/* Save */}
        {hasChanges && (
          <Button
            variant="primary"
            size="sm"
            onClick={save}
            disabled={saving || !fn || !fl}
            loading={saving}
            leftIcon={<Save size={14} />}
          >
            Save changes
          </Button>
        )}
      </div>
    </>
  );
}
