"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/shell/Logo";
import { Card } from "@/components/ui/Card";
import { FlameIcon } from "@/components/ui/FlameIcon";
import { Button } from "@/components/ui/Button";
import { CHARACTERS } from "@/lib/constants";
import {
  getParty,
  getPartyParticipants,
  joinParty,
  type Party,
  type PartyParticipant,
} from "@/lib/parties";
import { useCurrentUser } from "@/lib/useCurrentUser";

export default function JoinPartyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { userId, displayName, isAuthenticated, requireAuth } = useCurrentUser();

  const [party, setParty] = useState<Party | null>(null);
  const [participants, setParticipants] = useState<PartyParticipant[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [joining, setJoining] = useState(false);

  const loadParty = useCallback(async () => {
    try {
      const [p, pp] = await Promise.all([
        getParty(id),
        getPartyParticipants(id),
      ]);
      if (!p) {
        setNotFound(true);
      } else {
        setParty(p);
        setParticipants(pp);
      }
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadParty();
  }, [loadParty]);

  const handleJoin = async () => {
    if (joining) return;
    if (!requireAuth(`/join/${id}`)) return;

    setJoining(true);
    try {
      await joinParty(id, userId!, displayName);
      router.push(party?.status === "active" ? `/environment/${id}` : `/rooms/${id}`);
    } catch {
      setJoining(false);
    }
  };

  const isFull = party ? participants.length >= party.max_participants : false;
  const isCompleted = party?.status === "completed";
  const isActive = party?.status === "active";
  const canJoin = !isFull && !isCompleted && isAuthenticated;

  return (
    <div className="min-h-screen bg-[var(--sg-white)] text-[var(--sg-shell-900)]">
      <header className="border-b border-[var(--sg-shell-200)]">
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo href="/" height={32} maxWidth={140} />
          <Link
            href="/rooms"
            className="text-sm font-medium text-[var(--sg-shell-600)] hover:text-[var(--sg-shell-900)] transition-colors"
          >
            Open app
          </Link>
        </nav>
      </header>

      <main className="mx-auto max-w-md px-4 py-16 sm:py-24">
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--sg-shell-500)] border-t-transparent" />
          </div>
        )}

        {!loading && notFound && (
          <div className="text-center">
            <h1 className="text-2xl font-semibold text-white">
              Party not found
            </h1>
            <p className="mt-2 text-sm text-[var(--sg-shell-600)]">
              This party may have ended or the link is invalid.
            </p>
            <Link
              href="/rooms"
              className="mt-6 inline-flex h-12 items-center justify-center rounded-full bg-[var(--sg-forest-500)] px-8 font-medium text-white transition-all hover:bg-[var(--sg-forest-400)]"
            >
              Go to app
            </Link>
          </div>
        )}

        {!loading && !notFound && party && (
          <>
            <h1
              className="mb-6 text-2xl font-semibold text-white"
            >
              Join party
            </h1>

            <Card
              variant="character"
              character={party.character}
              className="mb-6 p-5"
            >
              <div className="flex items-start gap-3">
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
                  style={{ background: `${CHARACTERS[party.character].primary}20` }}
                >
                  <FlameIcon character={party.character} size={24} />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">
                    {party.name}
                  </h2>
                  <p className="text-sm text-[var(--sg-shell-600)]">
                    {party.planned_duration_min}m sprint &middot;{" "}
                    <span style={{ color: CHARACTERS[party.character].primary }}>
                      {CHARACTERS[party.character].name}
                    </span>{" "}
                    hosting
                  </p>
                  <p className="mt-2 text-xs text-[var(--sg-shell-500)]">
                    {participants.length}/{party.max_participants} participants
                    joined
                  </p>
                </div>
              </div>
            </Card>

            {isCompleted && (
              <p className="mb-4 text-sm text-[var(--sg-shell-600)]">
                This party has already ended.
              </p>
            )}

            {isActive && !isFull && (
              <p className="mb-4 text-sm text-[var(--sg-shell-600)]">
                This party is in progress. Join now to hop in!
              </p>
            )}

            {isFull && !isCompleted && (
              <p className="mb-4 text-sm text-[var(--sg-shell-600)]">
                This party is full.
              </p>
            )}

            {!isCompleted && !isFull && (
              <>
                {!isAuthenticated && (
                  <p className="mb-4 text-sm text-[var(--sg-shell-600)]">
                    Sign in to join this party.
                  </p>
                )}

                <Button
                  variant="primary"
                  className="w-full"
                  onClick={handleJoin}
                  disabled={!canJoin || joining}
                >
                  {joining ? "Joining..." : isAuthenticated ? "Join Party" : "Sign in to join"}
                </Button>
              </>
            )}

            <div className="mt-4 text-center">
              <Link
                href="/rooms"
                className="text-sm text-[var(--sg-shell-600)] hover:text-white"
              >
                Back to app
              </Link>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
