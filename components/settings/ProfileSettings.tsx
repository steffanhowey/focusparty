"use client";

import { useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { useProfile } from "@/lib/useProfile";
import { useUsernameValidation, type UsernameStatus } from "@/lib/username";
import { RefreshCw, Check, X, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/Button";

const inputClass =
  "h-11 w-full rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-hover)] px-4 text-sm text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-border-focus)]";

function UsernameStatusIcon({ status }: { status: UsernameStatus }) {
  switch (status) {
    case "checking":
      return <Loader2 size={16} className="animate-spin text-[var(--color-text-tertiary)]" />;
    case "available":
      return <Check size={16} className="text-[var(--color-green-700)]" />;
    case "taken":
    case "invalid":
      return <X size={16} className="text-[var(--color-red-700)]" />;
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
        <Loader2 size={24} className="animate-spin text-[var(--color-text-tertiary)]" />
      </div>
    );
  }

  return (
    <div className="space-y-8 py-8">
      <div>
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Profile</h2>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Manage your identity across SkillGap.
        </p>
      </div>

      {/* Avatar section */}
      <div className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-hover)] p-6">
        <label className="mb-3 block text-xs font-medium text-[var(--color-text-secondary)]">
          Avatar
        </label>
        <div className="flex items-center gap-5">
          <div className="relative h-[88px] w-[88px] overflow-hidden rounded-full border-2 border-[var(--color-border-default)]">
            {profile.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.avatar_url}
                alt="Avatar"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-[var(--color-bg-active)] text-2xl font-bold text-[var(--color-text-secondary)]">
                {currentDisplayName.charAt(0).toUpperCase()}
              </div>
            )}
            {generating && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40">
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
              <p className="text-xs text-[var(--color-text-tertiary)]">{genMessage}</p>
            )}
            {!profile.username && (
              <p className="text-xs text-[var(--color-text-tertiary)]">
                Set a username first to generate an avatar.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Display name */}
      <div className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-hover)] p-6">
        <label className="mb-1.5 block text-xs font-medium text-[var(--color-text-secondary)]">
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
              className="shrink-0 rounded-lg bg-[var(--color-accent-primary)] px-4 text-sm font-medium text-white transition-opacity hover:opacity-85 disabled:opacity-50"
            >
              {savingName ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            </button>
          )}
        </div>
      </div>

      {/* Username */}
      <div className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-hover)] p-6">
        <label className="mb-1.5 block text-xs font-medium text-[var(--color-text-secondary)]">
          Username
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-[var(--color-text-tertiary)]">
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
                    ? "var(--color-green-700)"
                    : username.status === "taken" || username.status === "invalid"
                      ? "var(--color-red-700)"
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
              className="shrink-0 rounded-lg bg-[var(--color-accent-primary)] px-4 text-sm font-medium text-white transition-opacity hover:opacity-85 disabled:opacity-50"
            >
              {savingUsername ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            </button>
          )}
        </div>
        {username.error && (
          <p className="mt-1.5 text-xs text-[var(--color-red-700)]">{username.error}</p>
        )}
        {username.status === "available" && usernameChanged && (
          <p className="mt-1.5 text-xs text-[var(--color-green-700)]">@{username.value} is available</p>
        )}
        {profile.username && !usernameChanged && (
          <p className="mt-1.5 text-xs text-[var(--color-text-tertiary)]">
            Your current handle: @{profile.username}
          </p>
        )}
      </div>

      {/* Email (read-only) */}
      <div className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-hover)] p-6">
        <label className="mb-1.5 block text-xs font-medium text-[var(--color-text-secondary)]">
          Email
        </label>
        <input
          type="email"
          value={email ?? ""}
          disabled
          className={`${inputClass} cursor-not-allowed opacity-60`}
        />
      </div>
    </div>
  );
}
