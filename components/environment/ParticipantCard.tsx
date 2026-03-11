"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import Image from "next/image";
import { Hand, Check, User, Users, Lock, Coffee } from "lucide-react";
import { PARTICIPANT_STATUS_CONFIG } from "@/lib/presence";
import type { ParticipantInfo } from "./EnvironmentParticipants";
import type { ActivityFeedItem, CommitmentType } from "@/lib/types";

// ─── Commitment type display ────────────────────────────────

const COMMITMENT_CONFIG: Record<CommitmentType, { icon: typeof User; label: string; color: string }> = {
  personal: { icon: User, label: "Personal", color: "#888888" },
  social: { icon: Users, label: "Social", color: "#5CC2EC" },
  locked: { icon: Lock, label: "Locked In", color: "#F59E0B" },
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

// ─── Sprint Countdown ───────────────────────────────────────

function SprintCountdown({
  startedAt,
  durationSec,
}: {
  startedAt: string;
  durationSec: number;
}) {
  const [remaining, setRemaining] = useState(() => {
    const elapsed = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
    return Math.max(0, durationSec - elapsed);
  });

  useEffect(() => {
    const id = setInterval(() => {
      const elapsed = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
      const r = Math.max(0, durationSec - elapsed);
      setRemaining(r);
      if (r <= 0) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [startedAt, durationSec]);

  if (remaining <= 0) return null;

  const progress = 1 - remaining / durationSec;
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const totalMins = Math.round(durationSec / 60);

  return (
    <div className="mb-3 rounded-lg bg-white/[0.05] px-3 py-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
          Sprint
        </span>
        <span className="text-xs tabular-nums text-white/60">
          {mins}:{secs.toString().padStart(2, "0")}
          <span className="text-white/30"> / {totalMins}m</span>
        </span>
      </div>
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/[0.08]">
        <div
          className="h-full rounded-full transition-[width] duration-1000 ease-linear"
          style={{
            width: `${progress * 100}%`,
            background: "rgba(91, 198, 130, 0.6)",
          }}
        />
      </div>
    </div>
  );
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
  onJoinBreak?: (contentId: string) => void;
}

export function ParticipantCard({
  participant,
  feedEvents,
  onHighFive,
  highFiveCooldownUntil,
  onClose,
  anchorRect,
  onJoinBreak,
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
        background: "rgba(10,10,10,0.85)",
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

          {/* Synthetic handle + status (same format as real users) */}
          {participant.participantType === "synthetic" && (
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

          {/* Host label */}
          {participant.participantType === "host" && (
            <span className="text-xs" style={{ color: "#8C55EF" }}>
              Room Host
            </span>
          )}
        </div>
      </div>

      {/* ── Break content (replaces Working on when on break) ── */}
      {participant.status === "on_break" && participant.breakContentTitle ? (
        <div className="mb-3 rounded-lg bg-white/[0.05] px-3 py-2.5">
          <div className="mb-2 flex items-center gap-1.5">
            <Coffee size={10} strokeWidth={2} style={{ color: "#8C55EF" }} />
            <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#8C55EF" }}>
              On Break
            </span>
          </div>
          <div className="flex items-start gap-2.5">
            {participant.breakContentThumbnail && (
              <Image
                src={participant.breakContentThumbnail}
                alt=""
                width={64}
                height={36}
                className="mt-0.5 shrink-0 rounded object-cover"
                style={{ width: 64, height: 36 }}
              />
            )}
            <p className="text-xs leading-relaxed text-white/70">
              {participant.breakContentTitle}
            </p>
          </div>
          {onJoinBreak && participant.breakContentId && !participant.isCurrentUser && (
            <button
              type="button"
              onClick={() => onJoinBreak(participant.breakContentId!)}
              className="mt-2.5 flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all hover:brightness-110"
              style={{
                background: "rgba(140, 85, 239, 0.15)",
                color: "#8C55EF",
              }}
            >
              <Coffee size={15} strokeWidth={2} />
              Watch too
            </button>
          )}
        </div>
      ) : (
        <>
          {/* ── Goal / Working on (real + synthetic) ── */}
          {(participant.participantType === "real" || participant.participantType === "synthetic") && (() => {
            const goalText = participant.participantType === "real"
              ? participant.goalPreview
              : participant.syntheticFlavor;
            if (!goalText && !participant.commitmentType) return null;
            return (
              <div className="mb-3 rounded-lg bg-white/[0.05] px-3 py-2">
                {goalText && (
                  <>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
                      Working on
                    </span>
                    <p className="mt-0.5 text-xs leading-relaxed text-white/70">
                      {goalText}
                    </p>
                  </>
                )}
                {participant.commitmentType && (() => {
                  const cfg = COMMITMENT_CONFIG[participant.commitmentType];
                  const Icon = cfg.icon;
                  return (
                    <div
                      className={`flex items-center gap-1.5${goalText ? " mt-2 border-t border-white/[0.06] pt-2" : ""}`}
                    >
                      <Icon size={11} strokeWidth={1.5} style={{ color: cfg.color }} />
                      <span className="text-[10px] font-medium" style={{ color: cfg.color }}>
                        {cfg.label}
                      </span>
                    </div>
                  );
                })()}
              </div>
            );
          })()}
        </>
      )}

      {/* ── Sprint Timer (hidden during break) ── */}
      {participant.status !== "on_break" && participant.sprintStartedAt && participant.sprintDurationSec && (
        <SprintCountdown
          startedAt={participant.sprintStartedAt}
          durationSec={participant.sprintDurationSec}
        />
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
