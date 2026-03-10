"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import Image from "next/image";
import { Hand, Check } from "lucide-react";
import { PARTICIPANT_STATUS_CONFIG } from "@/lib/presence";
import type { ParticipantInfo } from "./EnvironmentParticipants";
import type { ActivityFeedItem } from "@/lib/types";

// ─── Archetype display ──────────────────────────────────────

const ARCHETYPE_CONFIG: Record<string, { label: string; flavor: string }> = {
  coder: { label: "Coder", flavor: "Shipping code alongside you" },
  writer: { label: "Writer", flavor: "Quietly crafting words" },
  founder: { label: "Founder", flavor: "Building something big" },
  gentle: { label: "Mindful", flavor: "Focusing at their own pace" },
};

// ─── Host personality descriptions ──────────────────────────

const HOST_DESCRIPTIONS: Record<string, string> = {
  default: "Calm, clear focus coach",
  "vibe-coding": "Builder-focused pair programming energy",
  "writer-room": "Quiet clarity for the craft of writing",
  "yc-build": "Execution-obsessed founder coach",
  "gentle-start": "Warmth and zero-pressure momentum",
};

// ─── Fallback avatar ────────────────────────────────────────

function fallbackAvatar(seed: string): string {
  return `https://api.dicebear.com/9.x/notionists-neutral/png?seed=${encodeURIComponent(seed)}&size=80`;
}

// ─── High Five Button ───────────────────────────────────────

function HighFiveButton({
  onHighFive,
  cooldownUntil,
}: {
  onHighFive: () => void;
  cooldownUntil: number | null;
}) {
  const [sent, setSent] = useState(false);

  // Reset "sent" when cooldown expires
  useEffect(() => {
    if (!cooldownUntil) return;
    const remaining = cooldownUntil - Date.now();
    if (remaining <= 0) return;
    const id = setTimeout(() => setSent(false), remaining);
    return () => clearTimeout(id);
  }, [cooldownUntil]);

  const isCooling = cooldownUntil !== null && cooldownUntil > Date.now();

  const handleClick = () => {
    onHighFive();
    setSent(true);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isCooling}
      className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
      style={{
        background: sent
          ? "rgba(91,198,130,0.15)"
          : "rgba(245,158,11,0.15)",
        color: sent ? "#5BC682" : "#F5C54E",
      }}
    >
      {sent ? (
        <>
          <Check size={15} strokeWidth={2} />
          Sent!
        </>
      ) : (
        <>
          <Hand size={15} strokeWidth={2} />
          High Five
        </>
      )}
    </button>
  );
}

// ─── Main Card ──────────────────────────────────────────────

interface ParticipantCardProps {
  participant: ParticipantInfo;
  feedEvents: ActivityFeedItem[];
  onHighFive: (targetId: string, targetName: string) => void;
  highFiveCooldownUntil: number | null;
  onClose: () => void;
  anchorRect: DOMRect;
}

export function ParticipantCard({
  participant,
  feedEvents,
  onHighFive,
  highFiveCooldownUntil,
  onClose,
  anchorRect,
}: ParticipantCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  // ── Click-outside + Escape to close ──
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    // Delay adding mousedown listener to avoid immediate close from the click that opened this
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClick);
    }, 0);
    document.addEventListener("keydown", handleKey);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  // ── Stats from feed events ──
  const stats = useMemo(() => {
    let sprintsCompleted = 0;
    let tasksCompleted = 0;

    for (const event of feedEvents) {
      if (participant.participantType === "real") {
        if (event.user_id !== participant.id) continue;
        if (event.event_type === "sprint_completed") sprintsCompleted++;
        if (event.event_type === "task_completed") tasksCompleted++;
      } else if (participant.participantType === "synthetic") {
        if (event.event_type !== "sprint_completed") continue;
        const synId = (event.payload as Record<string, unknown>)
          ?.synthetic_id;
        if (synId === participant.id) sprintsCompleted++;
      }
    }

    return { sprintsCompleted, tasksCompleted };
  }, [feedEvents, participant.id, participant.participantType]);

  // ── Card positioning — fixed to viewport ──
  const top = Math.min(anchorRect.top, window.innerHeight - 320);
  const left = anchorRect.right + 12;

  const avatarUrl =
    participant.avatarUrl ||
    fallbackAvatar(participant.id || participant.displayName);
  const statusConfig =
    participant.status && PARTICIPANT_STATUS_CONFIG[participant.status];
  const archetypeConfig =
    participant.archetype && ARCHETYPE_CONFIG[participant.archetype];
  const showHighFive =
    !participant.isHost && !participant.isCurrentUser;
  const showStats = participant.participantType !== "host";

  return (
    <div
      ref={cardRef}
      className="fixed z-50 w-60 rounded-xl border border-[var(--color-border-default)] p-4"
      style={{
        top,
        left,
        background: "rgba(13,14,32,0.85)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        boxShadow:
          "0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06)",
      }}
      role="dialog"
      aria-label={`${participant.displayName} profile`}
    >
      {/* ── Header: Avatar + Name + Subtitle ── */}
      <div className="mb-3 flex items-center gap-3">
        <Image
          src={avatarUrl}
          alt={participant.displayName}
          width={48}
          height={48}
          className="h-12 w-12 shrink-0 rounded-full object-cover"
          style={{
            border: "2px solid rgba(255,255,255,0.12)",
          }}
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">
            {participant.isCurrentUser
              ? "You"
              : participant.displayName}
          </p>

          {/* @username + status for real users */}
          {participant.participantType === "real" && (
            <span className="flex items-center gap-1.5 text-xs">
              {participant.username && (
                <span className="text-white/40">@{participant.username}</span>
              )}
              {statusConfig && (
                <span className="font-medium" style={{ color: statusConfig.color }}>
                  {participant.username ? `· ${statusConfig.label}` : statusConfig.label}
                </span>
              )}
            </span>
          )}

          {/* Synthetic handle + archetype */}
          {participant.participantType === "synthetic" && (
            <span className="flex items-center gap-1.5 text-xs">
              {participant.username && (
                <span className="text-white/40">@{participant.username}</span>
              )}
              {archetypeConfig && (
                <span className="text-white/50">
                  {participant.username ? `· ${archetypeConfig.label}` : archetypeConfig.label}
                </span>
              )}
            </span>
          )}

          {/* Host label */}
          {participant.participantType === "host" && (
            <span className="text-xs" style={{ color: "#8C55EF" }}>
              Room Host
            </span>
          )}
        </div>
      </div>

      {/* ── Goal / Flavor / Host Description ── */}
      {participant.participantType === "real" && participant.goalPreview && (
        <div className="mb-3 rounded-lg bg-white/[0.05] px-3 py-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
            Working on
          </span>
          <p className="mt-0.5 text-xs leading-relaxed text-white/70">
            {participant.goalPreview}
          </p>
        </div>
      )}

      {participant.participantType === "synthetic" && archetypeConfig && (
        <p className="mb-3 text-xs italic text-white/40">
          {archetypeConfig.flavor}
        </p>
      )}

      {participant.participantType === "host" && (
        <p className="mb-3 text-xs text-white/50">
          {HOST_DESCRIPTIONS[participant.hostPersonality ?? "default"] ??
            "Your session facilitator"}
        </p>
      )}

      {/* ── Stats ── */}
      {showStats &&
        (stats.sprintsCompleted > 0 || stats.tasksCompleted > 0) && (
          <div className="mb-3 flex gap-4">
            {stats.sprintsCompleted > 0 && (
              <div>
                <div className="text-lg font-bold text-white">
                  {stats.sprintsCompleted}
                </div>
                <div className="text-[10px] text-white/40">Sprints</div>
              </div>
            )}
            {participant.participantType === "real" &&
              stats.tasksCompleted > 0 && (
                <div>
                  <div className="text-lg font-bold text-white">
                    {stats.tasksCompleted}
                  </div>
                  <div className="text-[10px] text-white/40">Tasks</div>
                </div>
              )}
          </div>
        )}

      {/* ── High Five Button ── */}
      {showHighFive && (
        <HighFiveButton
          onHighFive={() =>
            onHighFive(participant.id, participant.displayName)
          }
          cooldownUntil={highFiveCooldownUntil}
        />
      )}
    </div>
  );
}
