"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Users, Settings } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";
import { useProfile } from "@/lib/useProfile";
import {
  trackRoomBridgeShown,
  trackRoomBridgeAccepted,
  trackRoomBridgeDismissed,
} from "@/lib/onboarding/tracking";

// ─── Moment 1: Path Landing Tooltip ──────────────────────────

/**
 * Shows a soft hint on the first path page the user lands on.
 * Disappears after 6 seconds or on tap.
 */
export function FirstPathTooltip() {
  const { profile } = useProfile();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Only show for users who just onboarded and haven't completed a mission yet
    if (!profile) return;
    if (profile.first_mission_completed_at) return;
    if (!profile.onboarding_completed) return;

    setVisible(true);
    const timer = setTimeout(() => setVisible(false), 6000);
    return () => clearTimeout(timer);
  }, [profile]);

  if (!visible) return null;

  return (
    <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 animate-fade-in">
      <button
        onClick={() => setVisible(false)}
        className="rounded-lg border border-[var(--sg-shell-border)] bg-white px-4 py-2.5 text-sm font-medium text-[var(--sg-shell-900)] shadow-lg"
      >
        Your first module takes about 8 minutes
      </button>
    </div>
  );
}

// ─── Adjust Anytime Banner ───────────────────────────────────

/**
 * Shown on first path page when user tapped "I'm not sure" during fluency selection.
 * Clears after dismissal.
 */
export function AdjustAnytimeBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const notSure = localStorage.getItem("sg_fluency_not_sure");
    if (notSure === "true") {
      setVisible(true);
    }
  }, []);

  const dismiss = useCallback(() => {
    setVisible(false);
    localStorage.removeItem("sg_fluency_not_sure");
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed top-20 left-1/2 z-40 w-full max-w-sm -translate-x-1/2 animate-fade-in px-4">
      <div className="relative flex items-center gap-3 rounded-lg border border-[var(--sg-shell-border)] bg-white px-4 py-3 shadow-lg">
        <Settings
          size={16}
          strokeWidth={1.8}
          className="shrink-0 text-[var(--sg-shell-400)]"
        />
        <p className="text-xs text-[var(--sg-shell-600)]">
          We set your level to <strong className="text-[var(--sg-shell-900)]">Practicing</strong>.
          You can adjust anytime in{" "}
          <a
            href="/settings"
            className="font-medium text-[var(--sg-forest-500)] underline underline-offset-2"
          >
            Settings
          </a>.
        </p>
        <button
          onClick={dismiss}
          className="shrink-0 rounded-full p-1 text-[var(--sg-shell-400)] transition-colors hover:text-[var(--sg-shell-600)]"
        >
          <X size={12} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}

// ─── Moment 2: First Mission Celebration ─────────────────────

interface MissionCelebrationProps {
  onDismiss: () => void;
}

/**
 * Brief, warm celebration when the user completes their first hands-on mission.
 * Matches SkillGap's professional tone — no confetti.
 */
export function MissionCelebration({ onDismiss }: MissionCelebrationProps) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 5000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 animate-fade-in bg-[var(--sg-shell-900)]/40"
        onClick={onDismiss}
      />

      {/* Card */}
      <div className="relative z-10 mx-4 max-w-sm animate-scale-in rounded-2xl border border-[var(--sg-shell-border)] bg-white p-8 text-center shadow-xl">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--sg-forest-100)]">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--sg-forest-500)]">
            <span className="text-lg text-white">&#10003;</span>
          </div>
        </div>

        <h2 className="text-lg font-semibold text-[var(--sg-shell-900)]">
          You just built something with AI
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--sg-shell-600)]">
          This is how it starts. Every skill compounds from here.
        </p>

        <button
          onClick={onDismiss}
          className="mt-6 text-sm font-medium text-[var(--sg-forest-500)] transition-opacity hover:opacity-80"
        >
          Keep going
        </button>
      </div>
    </div>
  );
}

// ─── Moment 3: Room Bridge ───────────────────────────────────

interface RoomBridgeProps {
  topicName?: string;
  activeCount?: number;
  roomHref?: string;
}

/**
 * Non-blocking prompt to try the social layer.
 * Surfaces after first path completion OR on second session.
 */
export function RoomBridge({
  topicName = "AI",
  activeCount = 0,
  roomHref = "/practice",
}: RoomBridgeProps) {
  const { user } = useAuth();
  const { profile } = useProfile();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!profile || !user) return;
    // Don't show if already shown
    if (profile.room_bridge_shown_at) return;
    // Don't show if user hasn't completed their first mission
    if (!profile.first_mission_completed_at) return;

    setVisible(true);

    // Track + record that we showed it
    const daysSince = profile.onboarding_completed
      ? Math.floor((Date.now() - new Date(profile.first_mission_completed_at!).getTime()) / (1000 * 60 * 60 * 24))
      : 0;
    trackRoomBridgeShown("domain-room", daysSince);

    const supabase = createClient();
    supabase
      .from("fp_profiles")
      .update({ room_bridge_shown_at: new Date().toISOString() })
      .eq("id", user.id)
      .then(() => {});
  }, [profile, user]);

  const dismiss = useCallback(async () => {
    setVisible(false);
    trackRoomBridgeDismissed(1);
    if (!user) return;
    const supabase = createClient();
    await supabase
      .from("fp_profiles")
      .update({ room_bridge_dismissed: true })
      .eq("id", user.id);
  }, [user]);

  if (!visible) return null;

  return (
    <div className="fixed bottom-6 left-1/2 z-50 w-full max-w-sm -translate-x-1/2 animate-fade-in px-4">
      <div className="relative rounded-xl border border-[var(--sg-shell-border)] bg-white p-5 shadow-lg">
        <button
          onClick={dismiss}
          className="absolute right-3 top-3 rounded-full p-1 text-[var(--sg-shell-400)] transition-colors hover:bg-[var(--sg-shell-100)] hover:text-[var(--sg-shell-600)]"
        >
          <X size={14} strokeWidth={2} />
        </button>

        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--sg-forest-100)]">
            <Users
              size={18}
              strokeWidth={1.8}
              className="text-[var(--sg-forest-500)]"
            />
          </div>
          <div>
            <p className="text-sm font-medium text-[var(--sg-shell-900)]">
              Want to practice with others?
            </p>
            <p className="mt-1 text-xs text-[var(--sg-shell-600)]">
              {activeCount > 0
                ? `${activeCount} people are learning ${topicName} right now.`
                : `Join others learning ${topicName} together.`}
            </p>
            <Button
              variant="primary"
              size="sm"
              className="mt-3"
              onClick={() => {
                trackRoomBridgeAccepted("domain-room");
                window.location.href = roomHref;
              }}
            >
              Join a room
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
