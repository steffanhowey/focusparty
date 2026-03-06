"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { FlameIcon } from "@/components/ui/FlameIcon";
import { Card } from "@/components/ui/Card";
import { ParticipantList } from "./ParticipantList";
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
import { useCurrentUser } from "@/lib/useCurrentUser";
import { usePartyRealtime } from "@/lib/usePartyRealtime";
import { useNotification } from "@/components/providers/NotificationProvider";

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

  const isCreator = party?.creator_id === userId;
  const isParticipant = participants.some((p) => p.user_id === userId);

  const refreshParty = useCallback(async () => {
    try {
      const data = await getParty(partyId);
      if (!data) {
        setNotFound(true);
        return;
      }
      setParty(data);
      if (data.status === "active") {
        router.push("/session");
      }
    } catch {
      setNotFound(true);
    }
  }, [partyId, router]);

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
      await refreshParty();
      await refreshParticipants();
      setLoading(false);
    }
    init();
  }, [refreshParty, refreshParticipants]);

  // Auto-join once loaded (if authenticated and not already in)
  useEffect(() => {
    if (loading || notFound || !party || !userId || !isAuthenticated) return;
    if (party.status !== "waiting") return;
    if (isParticipant) return;

    const isFull = participants.length >= party.max_participants;
    if (isFull) return;

    joinParty(partyId, userId, displayName)
      .then(() => refreshParticipants())
      .catch(() => {
        // silent — might already be joined
      });
  }, [loading, notFound, party, isParticipant, participants.length, partyId, userId, displayName, isAuthenticated, refreshParticipants]);

  usePartyRealtime({
    partyId,
    onPartiesChange: refreshParty,
    onParticipantsChange: refreshParticipants,
  });

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
          </p>
        </div>
      </div>

      {/* Participants */}
      <Card variant="default" className="mb-4 p-4">
        <p className="mb-3 text-sm font-medium text-white">
          {participants.length}/{party.max_participants} focus friends ready
        </p>
        <ParticipantList
          participants={participants}
          maxParticipants={party.max_participants}
          creatorId={party.creator_id}
          character={party.character}
        />
      </Card>

      {/* Share link */}
      <div className="mb-6">
        <ShareLink partyId={party.id} />
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        {isCreator && (
          <Button
            variant="primary"
            className="flex-1"
            onClick={handleStart}
            disabled={starting || participants.length < 1}
          >
            {starting ? "Starting..." : "Start Session"}
          </Button>
        )}
        <Button variant="ghost" onClick={handleLeave}>
          Leave
        </Button>
      </div>
    </div>
  );
}
