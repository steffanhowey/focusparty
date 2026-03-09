"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { FlameIcon } from "@/components/ui/FlameIcon";
import { Card } from "@/components/ui/Card";
import { ParticipantList } from "./ParticipantList";
import { LiveParticipantsStrip } from "./LiveParticipantsStrip";
import { LiveActivityFeed } from "./LiveActivityFeed";
import { ResumeSessionCard } from "./ResumeSessionCard";
import { ShareLink } from "./ShareLink";
import { CHARACTERS } from "@/lib/constants";
import {
  getParty,
  getPartyParticipants,
  joinParty,
  leaveParty,
  updatePartyStatus,
  type Party,
  type PartyParticipant,
} from "@/lib/parties";
import { getActiveSessionForParty } from "@/lib/sessions";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { usePartyRealtime } from "@/lib/usePartyRealtime";
import { usePartyPresence } from "@/lib/usePartyPresence";
import { usePartyActivityFeed } from "@/lib/usePartyActivityFeed";
import { useNotification } from "@/components/providers/NotificationProvider";
import { usePartySummaryStats } from "@/lib/usePartySummaryStats";
import type { SessionRow } from "@/lib/types";

interface PartyLobbyProps {
  partyId: string;
}

export function PartyLobby({ partyId }: PartyLobbyProps) {
  const router = useRouter();
  const { showToast } = useNotification();
  const { userId, displayName, isAuthenticated } = useCurrentUser();

  const [party, setParty] = useState<Party | null>(null);
  const [participants, setParticipants] = useState<PartyParticipant[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [starting, setStarting] = useState(false);
  const [joiningRoom, setJoiningRoom] = useState(false);

  const isCreator = party?.creator_id === userId;
  const isParticipant = participants.some((p) => p.user_id === userId);
  const [activeSession, setActiveSession] = useState<SessionRow | null>(null);
  const initialStatusRef = useRef<string | null>(null);

  // Presence tracking
  const presence = usePartyPresence({
    partyId,
    userId,
    displayName,
    phase: null, // not in a session from the lobby
    character: party?.character ?? null,
  });

  // Build a merged display name map from DB participants + presence
  const displayNameMap = useMemo(() => {
    const map = new Map<string, string>();
    participants.forEach((p) => map.set(p.user_id, p.display_name));
    presence.participants.forEach((p) => map.set(p.userId, p.displayName));
    return map;
  }, [participants, presence.participants]);

  // Activity feed
  const { events: feedEvents, isLoading: feedLoading } =
    usePartyActivityFeed(partyId, displayNameMap);

  // Party summary stats
  const partySummary = usePartySummaryStats(partyId);

  // Check for an existing active session (for resume card)
  useEffect(() => {
    if (!userId || !partyId) return;
    getActiveSessionForParty(userId, partyId)
      .then(setActiveSession)
      .catch(() => {});
  }, [userId, partyId]);

  const refreshParty = useCallback(async () => {
    try {
      const data = await getParty(partyId);
      if (!data) {
        setNotFound(true);
        return;
      }
      setParty(data);
    } catch {
      setNotFound(true);
    }
  }, [partyId]);

  const refreshParticipants = useCallback(async () => {
    try {
      const data = await getPartyParticipants(partyId);
      setParticipants(data);
    } catch {
      // silent
    }
  }, [partyId]);

  useEffect(() => {
    async function init() {
      const partyData = await getParty(partyId);
      if (partyData && !initialStatusRef.current) {
        initialStatusRef.current = partyData.status;
      }
      if (!partyData) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setParty(partyData);
      await refreshParticipants();
      setLoading(false);
    }
    init();
  }, [partyId, refreshParticipants]);

  // Auto-join once loaded (if authenticated and not already in)
  useEffect(() => {
    if (loading || notFound || !party || !userId || !isAuthenticated) return;
    if (party.status !== "waiting" && party.status !== "active") return;
    if (isParticipant) return;

    const isFull = participants.length >= party.max_participants;
    if (isFull) return;

    joinParty(partyId, userId, displayName)
      .then(() => refreshParticipants())
      .catch(() => {
        // silent — might already be joined
      });
  }, [loading, notFound, party, isParticipant, participants.length, partyId, userId, displayName, isAuthenticated, refreshParticipants]);

  // Auto-redirect only when party transitions waiting→active (realtime).
  // If the user navigated directly to an already-active party, let them see the lobby.
  useEffect(() => {
    if (!party || loading) return;
    if (
      party.status === "active" &&
      isParticipant &&
      initialStatusRef.current === "waiting"
    ) {
      router.push("/session");
    }
  }, [party, loading, isParticipant, router]);

  usePartyRealtime({
    partyId,
    onPartiesChange: refreshParty,
    onParticipantsChange: refreshParticipants,
  });

  const handleResumeSession = useCallback(() => {
    router.push("/session");
  }, [router]);

  const handleAbandonSession = useCallback(async () => {
    setActiveSession(null);
    // The session will remain "active" in DB until the user starts a new one
    // (at which point the duplicate guard handles it) or it's explicitly ended
  }, []);

  const handleStart = async () => {
    if (starting) return;
    setStarting(true);
    try {
      await updatePartyStatus(partyId, "active");
      router.push("/session");
    } catch {
      showToast({
        type: "error",
        title: "Failed to start session",
        message: "Please try again.",
      });
      setStarting(false);
    }
  };

  const handleJoin = async () => {
    if (!userId || !isAuthenticated || joiningRoom) return;
    setJoiningRoom(true);
    try {
      await joinParty(partyId, userId, displayName);
      await refreshParticipants();
      // If party is active, the redirect effect handles navigation
    } catch {
      showToast({
        type: "error",
        title: "Failed to join",
        message: "Please try again.",
      });
      setJoiningRoom(false);
    }
  };

  const handleLeave = async () => {
    if (!userId) return;
    try {
      await leaveParty(partyId, userId);
      router.push("/party");
    } catch {
      router.push("/party");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-text-tertiary)] border-t-transparent" />
      </div>
    );
  }

  if (notFound || !party) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <h3 className="text-lg font-semibold text-white">Party not found</h3>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          This party may have ended or doesn&apos;t exist.
        </p>
        <Link
          href="/party"
          className="mt-4 text-sm font-medium text-[var(--color-accent-primary)] hover:underline"
        >
          Back to parties
        </Link>
      </div>
    );
  }

  if (party.status === "completed") {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <h3 className="text-lg font-semibold text-white">Party ended</h3>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          This party has already completed.
        </p>
        <Link
          href="/party"
          className="mt-4 text-sm font-medium text-[var(--color-accent-primary)] hover:underline"
        >
          Back to parties
        </Link>
      </div>
    );
  }

  const c = CHARACTERS[party.character];

  return (
    <div className="mx-auto max-w-lg">
      {/* Back link */}
      <Link
        href="/party"
        className="mb-5 inline-flex items-center gap-1.5 text-sm text-[var(--color-text-secondary)] hover:text-white"
      >
        <ArrowLeft size={16} />
        All parties
      </Link>

      {/* Party header */}
      <div className="mb-6 flex items-center gap-3">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full"
          style={{ background: `${c.primary}20` }}
        >
          <FlameIcon character={party.character} size={28} />
        </div>
        <div>
          <h2
            className="text-xl font-semibold text-white"
            style={{ fontFamily: "var(--font-montserrat), sans-serif" }}
          >
            {party.name}
          </h2>
          <p className="text-sm text-[var(--color-text-secondary)]">
            {party.planned_duration_min}m sprint &middot;{" "}
            <span style={{ color: c.primary }}>{c.name}</span> hosting
            {presence.count > 0 && (
              <span className="ml-1">
                &middot; {presence.count} here
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Party summary stats */}
      {!partySummary.loading && partySummary.sessionsToday > 0 && (
        <div className="mb-4 flex gap-4 text-xs text-[var(--color-text-tertiary)]">
          <span>
            {partySummary.sessionsToday} session{partySummary.sessionsToday !== 1 ? "s" : ""} today
          </span>
          {partySummary.completedSprintsToday > 0 && (
            <span>
              {partySummary.completedSprintsToday} sprint{partySummary.completedSprintsToday !== 1 ? "s" : ""} completed
            </span>
          )}
        </div>
      )}

      {/* Resume session card */}
      {activeSession && (
        <div className="mb-4">
          <ResumeSessionCard
            session={activeSession}
            onResume={handleResumeSession}
            onAbandon={handleAbandonSession}
          />
        </div>
      )}

      {/* Participants */}
      <Card variant="default" className="mb-4 p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-medium text-white">
            {participants.length}/{party.max_participants} focus friends ready
          </p>
          {presence.participants.length > 0 && (
            <LiveParticipantsStrip
              participants={presence.participants}
              currentUserId={userId}
              size="sm"
              maxVisible={4}
            />
          )}
        </div>
        <ParticipantList
          participants={participants}
          maxParticipants={party.max_participants}
          creatorId={party.creator_id}
          character={party.character}
        />
      </Card>

      {/* Activity feed */}
      <Card variant="default" className="mb-4 p-4">
        <p className="mb-2 text-sm font-medium text-white">Activity</p>
        <LiveActivityFeed events={feedEvents} isLoading={feedLoading} />
      </Card>

      {/* Share link */}
      <div className="mb-6">
        <ShareLink partyId={party.id} />
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        {!isParticipant && participants.length < party.max_participants && (
          <Button
            variant="primary"
            className="flex-1"
            onClick={handleJoin}
            disabled={joiningRoom}
          >
            {joiningRoom ? "Joining..." : "Join Room"}
          </Button>
        )}
        {isParticipant && party.status === "active" && (
          <Button
            variant="primary"
            className="flex-1"
            onClick={() => router.push("/session")}
          >
            Enter Session
          </Button>
        )}
        {isCreator && isParticipant && party.status === "waiting" && (
          <Button
            variant="primary"
            className="flex-1"
            onClick={handleStart}
            disabled={starting || participants.length < 1}
          >
            {starting ? "Starting..." : "Start Session"}
          </Button>
        )}
        {isParticipant && (
          <Button variant="ghost" onClick={handleLeave}>
            Leave
          </Button>
        )}
      </div>
    </div>
  );
}
