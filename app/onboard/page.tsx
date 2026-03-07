"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/shell/Logo";
import { useAuth } from "@/components/providers/AuthProvider";
import { createClient } from "@/lib/supabase/client";
import { createParty } from "@/lib/parties";
import { PartyPopper } from "lucide-react";

const STEPS = ["Display name", "Avatar", "Start focusing"];

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
  const { user, authState } = useAuth();
  const router = useRouter();
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState(0);
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Pre-fill display name from user metadata
  useEffect(() => {
    if (!user) return;
    const meta = user.user_metadata;
    const first = meta?.first_name ?? "";
    const last = meta?.last_name ?? "";
    const full = `${first} ${last}`.trim();
    if (full) setDisplayName(full);
  }, [user]);

  if (authState === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white">
        <p className="text-white/50">Loading...</p>
      </div>
    );
  }

  if (authState === "anonymous") {
    router.replace("/login");
    return null;
  }

  const handleAvatarUpload = async (file: File) => {
    if (!user) return;

    // Show local preview immediately
    setAvatarPreview(URL.createObjectURL(file));
    setUploading(true);

    const ext = file.name.split(".").pop();
    const path = `${user.id}/avatar.${ext}`;

    const { error } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true });

    if (!error) {
      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(path);
      setAvatarUrl(`${publicUrl}?t=${Date.now()}`);
    }
    setUploading(false);
  };

  const saveDisplayName = async () => {
    if (!user || !displayName.trim()) return;
    setSaving(true);
    await supabase
      .from("fp_profiles")
      .update({ display_name: displayName.trim() })
      .eq("id", user.id);
    setSaving(false);
    setStep(1);
  };

  const saveAvatar = async () => {
    if (!user) return;
    if (avatarUrl) {
      await supabase
        .from("fp_profiles")
        .update({ avatar_url: avatarUrl })
        .eq("id", user.id);
    }
    setStep(2);
  };

  const completeOnboarding = () => {
    if (!user) return;
    setSaving(true);

    // Navigate immediately — DB calls fire in background
    router.push("/session");

    // Fire all DB work in parallel, no awaiting
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

  return (
    <div className="flex min-h-screen flex-col bg-black text-white">
      <header className="bg-black/80 backdrop-blur-md">
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
                    ? "w-2 bg-white/40"
                    : "w-2 bg-white/10"
              }`}
            />
          ))}
        </div>

        {/* Step 1: Display name */}
        {step === 0 && (
          <>
            <h1 className="text-2xl font-semibold text-white">
              What should we call you?
            </h1>
            <p className="mt-2 text-white/50">
              This is how you&apos;ll appear in focus sessions.
            </p>

            <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6">
              <label className="mb-1.5 block text-xs font-medium text-white/50">
                Display name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
                className="h-11 w-full rounded-lg border border-white/10 bg-white/5 px-4 text-sm text-white outline-none placeholder:text-white/30 focus:border-white/25"
              />
              <button
                onClick={saveDisplayName}
                disabled={!displayName.trim() || saving}
                className="mt-4 inline-flex h-12 w-full items-center justify-center rounded-full bg-[var(--color-accent-primary)] font-medium text-white transition-opacity hover:opacity-85 active:opacity-75 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Continue"}
              </button>
            </div>
          </>
        )}

        {/* Step 2: Avatar */}
        {step === 1 && (
          <>
            <h1 className="text-2xl font-semibold text-white">
              Add a profile picture
            </h1>
            <p className="mt-2 text-white/50">
              Upload a photo or use your initials.
            </p>

            <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6">
              <div className="flex flex-col items-center gap-4">
                {/* Avatar preview */}
                <div className="relative h-24 w-24 overflow-hidden rounded-full border-2 border-white/10">
                  {avatarPreview || avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={(avatarPreview || avatarUrl)!}
                      alt="Avatar"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-white/10 text-2xl font-bold text-white/60">
                      {getInitials(displayName || "FP")}
                    </div>
                  )}
                </div>

                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleAvatarUpload(file);
                  }}
                />

                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="rounded-full border border-white/20 px-5 py-2.5 text-sm font-medium text-white/60 transition-colors hover:bg-white/5 hover:text-white"
                >
                  {uploading ? "Uploading..." : "Upload photo"}
                </button>
              </div>

              <button
                onClick={saveAvatar}
                disabled={uploading}
                className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-full bg-[var(--color-accent-primary)] font-medium text-white transition-opacity hover:opacity-85 active:opacity-75 disabled:opacity-50"
              >
                {uploading
                  ? "Uploading..."
                  : avatarPreview || avatarUrl
                    ? "Continue"
                    : "Skip for now"}
              </button>
            </div>
          </>
        )}

        {/* Step 3: Start focusing */}
        {step === 2 && (
          <>
            <h1 className="text-2xl font-semibold text-white">
              You&apos;re all set!
            </h1>
            <p className="mt-2 text-white/50">
              Start your first focus session and see what FocusParty is all
              about.
            </p>

            <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
              <p className="text-sm text-white/50">
                Welcome, <strong className="text-white">{displayName}</strong>.
                Let&apos;s get focused.
              </p>
              <button
                onClick={completeOnboarding}
                disabled={saving}
                className="mt-6 inline-flex h-14 w-full items-center justify-center gap-2 rounded-full bg-[var(--color-accent-primary)] font-semibold text-white transition-opacity hover:opacity-85 active:opacity-75 disabled:opacity-50"
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
