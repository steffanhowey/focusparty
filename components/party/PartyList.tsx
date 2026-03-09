"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { useDiscoverableParties } from "@/lib/useDiscoverableParties";
import { joinParty } from "@/lib/parties";
import { RoomCard } from "./RoomCard";
import { EmptyState } from "./EmptyState";
import { CreatePartyModal } from "./CreatePartyModal";

export function PartyList() {
  const router = useRouter();
  const { userId, displayName, requireAuth } = useCurrentUser();
  const [headerSlot, setHeaderSlot] = useState<HTMLElement | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [joining, setJoining] = useState<string | null>(null);

  const { parties, loading, error } = useDiscoverableParties();

  useEffect(() => {
    setHeaderSlot(document.getElementById("hub-header-action"));
  }, []);

  // Synthetic participants: trigger a global tick every 30s while on discovery page
  useEffect(() => {
    const tick = () =>
      fetch("/api/synthetics/tick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }).catch(() => {});
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  const handleStartParty = () => {
    if (!requireAuth()) return;
    setShowCreate(true);
  };

  const handleJoinPersistentRoom = useCallback(
    async (partyId: string) => {
      if (!requireAuth() || !userId || joining) return;
      setJoining(partyId);
      try {
        await joinParty(partyId, userId, displayName);
        router.push(`/environment/${partyId}`);
      } catch {
        setJoining(null);
      }
    },
    [requireAuth, userId, displayName, joining, router]
  );

  const startButton = (
    <button
      type="button"
      onClick={handleStartParty}
      className="flex h-10 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full px-4 sm:px-5"
      style={{
        background: "var(--color-accent-primary)",
        color: "white",
      }}
    >
      <Plus size={18} strokeWidth={2} className="shrink-0" />
      <span className="hidden text-sm font-semibold sm:inline">
        Start Party
      </span>
    </button>
  );

  return (
    <>
      {headerSlot && createPortal(startButton, headerSlot)}

      <CreatePartyModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
      />

      <div className="px-4 py-6 sm:px-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-text-tertiary)] border-t-transparent" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-sm text-[var(--color-text-secondary)]">
              {error}
            </p>
          </div>
        ) : parties.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {/* Persistent rooms */}
            {parties.filter((p) => p.persistent).length > 0 && (
              <section>
                <h2 className="mb-3 text-sm font-semibold text-[var(--color-text-secondary)]">
                  Rooms
                </h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {parties
                    .filter((p) => p.persistent)
                    .map((party) => (
                      <RoomCard
                        key={party.id}
                        party={party}
                        onClick={() => handleJoinPersistentRoom(party.id)}
                        isJoining={joining === party.id}
                      />
                    ))}
                </div>
              </section>
            )}

            {/* User-created rooms */}
            {parties.filter((p) => !p.persistent).length > 0 && (
              <section className={parties.some((p) => p.persistent) ? "mt-8" : ""}>
                <h2 className="mb-3 text-sm font-semibold text-[var(--color-text-secondary)]">
                  Community Rooms
                </h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {parties
                    .filter((p) => !p.persistent)
                    .map((party) => (
                      <RoomCard key={party.id} party={party} />
                    ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </>
  );
}
