"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/shell/Logo";
import { Card } from "@/components/ui/Card";
import { FlameIcon } from "@/components/ui/FlameIcon";
import { Button } from "@/components/ui/Button";
import { CHARACTERS } from "@/lib/constants";
import { joinParty, type Party } from "@/lib/parties";
import { useCurrentUser } from "@/lib/useCurrentUser";

interface JoinCardProps {
  party: Party | null;
  inviterName: string | null;
  participantCount: number;
  inviteCode: string;
}

export function JoinCard({
  party,
  inviterName,
  participantCount,
  inviteCode,
}: JoinCardProps) {
  const router = useRouter();
  const { userId, displayName, isAuthenticated } = useCurrentUser();
  const [joining, setJoining] = useState(false);

  const isFull = party ? participantCount >= party.max_participants : false;
  const isCompleted = party?.status === "completed";
  const isActive = party?.status === "active";
  const canJoin = !isFull && !isCompleted && isAuthenticated;

  const handleJoin = async () => {
    if (joining || !party) return;
    if (!isAuthenticated) {
      router.push(`/login?next=${encodeURIComponent(`/i/${inviteCode}`)}`);
      return;
    }

    setJoining(true);
    try {
      await joinParty(party.id, userId!, displayName);
      router.push(party.status === "active" ? "/session" : `/rooms/${party.id}`);
    } catch {
      setJoining(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
      <header className="border-b border-[var(--color-border-subtle)]">
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo href="/" height={32} maxWidth={140} />
          <Link
            href="/rooms"
            className="text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            Open app
          </Link>
        </nav>
      </header>

      <main className="mx-auto max-w-md px-4 py-16 sm:py-24">
        {!party && (
          <div className="text-center">
            <h1 className="text-2xl font-semibold text-white">
              Party not found
            </h1>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
              This party may have ended or the link is invalid.
            </p>
            <Link
              href="/rooms"
              className="mt-6 inline-flex h-12 items-center justify-center rounded-full bg-[var(--color-accent-primary)] px-8 font-medium text-white transition-all hover:bg-[var(--color-purple-800)]"
            >
              Go to app
            </Link>
          </div>
        )}

        {party && (
          <>
            {inviterName ? (
              <p className="mb-6 text-sm text-[var(--color-text-secondary)]">
                <span className="font-medium text-white">{inviterName}</span>{" "}
                invited you to focus together
              </p>
            ) : (
              <h1
                className="mb-6 text-2xl font-semibold text-white"
                style={{ fontFamily: "var(--font-montserrat), sans-serif" }}
              >
                Join party
              </h1>
            )}

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
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    {party.planned_duration_min}m sprint &middot;{" "}
                    <span style={{ color: CHARACTERS[party.character].primary }}>
                      {CHARACTERS[party.character].name}
                    </span>{" "}
                    hosting
                  </p>
                  <p className="mt-2 text-xs text-[var(--color-text-tertiary)]">
                    {participantCount}/{party.max_participants} participants
                    joined
                  </p>
                </div>
              </div>
            </Card>

            {isCompleted && (
              <p className="mb-4 text-sm text-[var(--color-text-secondary)]">
                This party has already ended.
              </p>
            )}

            {isActive && !isFull && (
              <p className="mb-4 text-sm text-[var(--color-text-secondary)]">
                This party is in progress. Join now to hop in!
              </p>
            )}

            {isFull && !isCompleted && (
              <p className="mb-4 text-sm text-[var(--color-text-secondary)]">
                This party is full.
              </p>
            )}

            {!isCompleted && !isFull && (
              <>
                {!isAuthenticated && (
                  <p className="mb-4 text-sm text-[var(--color-text-secondary)]">
                    Sign in to join this party.
                  </p>
                )}

                <Button
                  variant="primary"
                  className="w-full"
                  onClick={handleJoin}
                  disabled={!canJoin || joining}
                >
                  {joining
                    ? "Joining..."
                    : isAuthenticated
                      ? "Join Party"
                      : "Sign in to join"}
                </Button>
              </>
            )}

            <div className="mt-4 text-center">
              <Link
                href="/rooms"
                className="text-sm text-[var(--color-text-secondary)] hover:text-white"
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
