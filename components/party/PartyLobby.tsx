"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Link2, Check } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { FlameIcon } from "@/components/ui/FlameIcon";
import { Card } from "@/components/ui/Card";
import { LiveParticipantsStrip } from "./LiveParticipantsStrip";
import { LiveActivityFeed } from "./LiveActivityFeed";
import { ResumeSessionCard } from "./ResumeSessionCard";
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
import { getActiveSession, updateSession } from "@/lib/sessions";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { usePartyRealtime } from "@/lib/usePartyRealtime";
import { usePartyPresence } from "@/lib/usePartyPresence";
import { usePartyActivityFeed } from "@/lib/usePartyActivityFeed";
import { useNotification } from "@/components/providers/NotificationProvider";
import { usePartySummaryStats } from "@/lib/usePartySummaryStats";
import { computeRoomState, ROOM_STATE_CONFIG } from "@/lib/roomState";
import {
  getPartyLaunchDisplayName,
  getPartyLaunchShortDescription,
} from "@/lib/launchRooms";
import type { RoomState, SessionRow } from "@/lib/types";

const ROOM_STATE_CLASS: Record<RoomState, string> = {
  quiet: "fp-room-quiet",
  warming_up: "fp-room-warming",
  focused: "fp-room-focused",
  flowing: "fp-room-flowing",
  cooling_down: "fp-room-cooling",
};

interface PartyLobbyProps {
  partyId: string;
}

export function PartyLobby({ partyId }: PartyLobbyProps) {
  const router = useRouter();
  const { showToast } = useNotification();
  const { userId, displayName, username, isAuthenticated } = useCurrentUser();
  const environmentRoute = `/environment/${partyId}`;

  const [party, setParty] = useState<Party | null>(null);
  const [participants, setParticipants] = useState<PartyParticipant[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [starting, setStarting] = useState(false);
  const [joiningRoom, setJoiningRoom] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);

  const isCreator = party?.creator_id === userId;
  const isParticipant = participants.some((p) => p.user_id === userId);
  const [activeSession, setActiveSession] = useState<SessionRow | null>(null);
  const initialStatusRef = useRef<string | null>(null);
  const prevPartyIdRef = useRef(partyId);

  useEffect(() => {
    if (partyId === prevPartyIdRef.current) return;
    prevPartyIdRef.current = partyId;
    initialStatusRef.current = null;
  }, [partyId]);

  // Presence tracking
  const presence = usePartyPresence({
    partyId,
    userId,
    displayName,
    username,
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

  // Ambient room state
  const roomState = useMemo(
    () => computeRoomState(feedEvents, participants.length),
    [feedEvents, participants.length]
  );
  const roomStateDisplay = ROOM_STATE_CONFIG[roomState];

  // Party summary stats
  const partySummary = usePartySummaryStats(partyId);

  // Check for an existing active session (for resume card).
  // The environment runtime lets a sprint follow the user across rooms,
  // so the lobby should reflect that same continuity.
  useEffect(() => {
    if (!userId || !partyId) return;
    getActiveSession(userId)
      .then(setActiveSession)
      .catch((err) => console.error("Failed to fetch active session:", err));
  }, [userId, partyId]);

  // Synthetic participants: heartbeat tick every 15s
  useEffect(() => {
    if (!partyId) return;

    const tick = () =>
      fetch("/api/synthetics/tick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partyId }),
      }).catch((err) => console.error("Failed to tick synthetics:", err));

    tick(); // fire immediately on mount
    const id = setInterval(tick, 15_000);
    return () => clearInterval(id);
  }, [partyId]);

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
      router.push(environmentRoute);
    }
  }, [party, loading, isParticipant, router, environmentRoute]);

  usePartyRealtime({
    partyId,
    onPartiesChange: refreshParty,
    onParticipantsChange: refreshParticipants,
  });

  const handleResumeSession = useCallback(() => {
    router.push(environmentRoute);
  }, [router, environmentRoute]);

  const handleAbandonSession = useCallback(async () => {
    if (!activeSession) return;

    try {
      await updateSession(activeSession.id, {
        status: "abandoned",
        ended_at: new Date().toISOString(),
      });
      setActiveSession(null);
    } catch (err) {
      console.error("Failed to abandon active session:", err);
      showToast({
        type: "error",
        title: "Couldn’t start fresh",
        message: "Please try again.",
      });
    }
  }, [activeSession, showToast]);

  const handleStart = async () => {
    if (starting) return;
    setStarting(true);
    try {
      await updatePartyStatus(partyId, "active");
      router.push(environmentRoute);
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
      if (party?.status === "active") {
        router.push(environmentRoute);
        return;
      }
      setJoiningRoom(false);
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
      router.push("/rooms");
    } catch {
      router.push("/rooms");
    }
  };

  const handleCopyInvite = async () => {
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}/join/${partyId}`
        : `/join/${partyId}`;
    try {
      await navigator.clipboard.writeText(url);
      setInviteCopied(true);
      setTimeout(() => setInviteCopied(false), 2000);
    } catch {
      // silent
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-shell-500 border-t-transparent" />
      </div>
    );
  }

  if (notFound || !party) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <h3 className="text-lg font-semibold text-white">Room not found</h3>
        <p className="mt-1 text-sm text-shell-600">
          This room may have ended or doesn&apos;t exist.
        </p>
        <Link
          href="/rooms"
          className="mt-4 text-sm font-medium text-forest-500 hover:underline"
        >
          Back to rooms
        </Link>
      </div>
    );
  }

  if (party.status === "completed") {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <h3 className="text-lg font-semibold text-white">Room ended</h3>
        <p className="mt-1 text-sm text-shell-600">
          This room has already completed.
        </p>
        <Link
          href="/rooms"
          className="mt-4 text-sm font-medium text-forest-500 hover:underline"
        >
          Back to rooms
        </Link>
      </div>
    );
  }

  const c = CHARACTERS[party.character];
  const roomName = getPartyLaunchDisplayName(party);
  const roomDescription = getPartyLaunchShortDescription(party);

  return (
    <div className={ROOM_STATE_CLASS[roomState]}>
      {/* Back link */}
      <Link
        href="/rooms"
        className="mb-5 inline-flex items-center gap-1.5 text-sm text-shell-600 hover:text-shell-900"
      >
        <ArrowLeft size={16} />
        All rooms
      </Link>

      {/* Party header */}
      <div className="mb-4 flex items-center gap-3">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full"
          style={{ background: `${c.primary}20` }}
        >
          <FlameIcon character={party.character} size={28} />
        </div>
        <div>
          <h2
            className="text-xl font-semibold text-white"
          >
            {roomName}
          </h2>
          <p className="text-sm text-shell-600">
            {party.persistent
              ? roomDescription
              : <>{party.planned_duration_min}m sprint &middot;{" "}
                <span style={{ color: c.primary }}>{c.name}</span> hosting</>}
            {presence.count > 0 && (
              <span className="ml-1">
                &middot; {presence.count} here
              </span>
            )}
            {!feedLoading && (
              <span
                className="ml-1"
                style={{ color: roomStateDisplay.color }}
              >
                &middot; {roomStateDisplay.icon} {roomStateDisplay.label}
              </span>
            )}
            {!partySummary.loading && partySummary.sessionsToday > 0 && (
              <span className="ml-1 text-shell-500">
                &middot; {partySummary.sessionsToday} session{partySummary.sessionsToday !== 1 ? "s" : ""} today
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Resume session card */}
      {activeSession && party.status === "active" && isParticipant && (
        <div className="mb-4">
          <ResumeSessionCard
            session={activeSession}
            onResume={handleResumeSession}
            onAbandon={handleAbandonSession}
          />
        </div>
      )}

      {/* Room Pulse — presence + activity */}
      <Card variant="default" className="mb-4 p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-medium text-white">
            {participants.length}/{party.max_participants} ready in the room
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
        <div className="mb-3 border-t border-shell-border" />
        <LiveActivityFeed
          events={feedEvents}
          isLoading={feedLoading}
          maxHeight={180}
        />
      </Card>

      {/* Actions */}
      <div className="flex items-center gap-3">
        {!isParticipant && participants.length < party.max_participants && (
          <Button
            variant="cta"
            className="flex-1"
            onClick={handleJoin}
            disabled={joiningRoom}
          >
            {joiningRoom ? "Joining..." : "Join Room"}
          </Button>
        )}
        {isParticipant && party.status === "active" && (
          <Button
            variant="cta"
            className="flex-1"
            onClick={() => router.push(environmentRoute)}
          >
            Enter Session
          </Button>
        )}
        {isCreator && isParticipant && party.status === "waiting" && (
          <Button
            variant="cta"
            className="flex-1"
            onClick={handleStart}
            disabled={starting || participants.length < 1}
          >
            {starting ? "Starting..." : "Start Session"}
          </Button>
        )}
        {isParticipant && (
          <>
            <Button variant="ghost" size="sm" onClick={handleCopyInvite}>
              {inviteCopied ? <Check size={14} /> : <Link2 size={14} />}
              <span className="ml-1.5">{inviteCopied ? "Copied" : "Invite"}</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLeave}>
              Leave
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
