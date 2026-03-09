"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { createParty } from "@/lib/parties";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { useNotification } from "@/components/providers/NotificationProvider";
import { useDiscoverableParties } from "@/lib/useDiscoverableParties";
import { RoomCard } from "./RoomCard";
import { EmptyState } from "./EmptyState";

export function PartyList() {
  const router = useRouter();
  const { showToast } = useNotification();
  const { userId, displayName, requireAuth } = useCurrentUser();
  const [creating, setCreating] = useState(false);
  const [headerSlot, setHeaderSlot] = useState<HTMLElement | null>(null);

  const { parties, loading, error } = useDiscoverableParties();

  useEffect(() => {
    setHeaderSlot(document.getElementById("hub-header-action"));
  }, []);

  const handleCreateParty = () => {
    if (creating) return;
    if (!requireAuth()) return;

    setCreating(true);

    // Navigate immediately — party creation fires in background
    router.push("/session");

    createParty(
      {
        creator_id: userId!,
        name: `${displayName}'s Party`,
        character: "ember",
        planned_duration_min: 25,
        max_participants: 3,
        status: "active",
      },
      displayName
    );
  };

  const startButton = (
    <button
      type="button"
      onClick={handleCreateParty}
      disabled={creating}
      className="flex h-10 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full px-4 sm:px-5 disabled:cursor-not-allowed disabled:opacity-50"
      style={{
        background: "var(--color-accent-primary)",
        color: "white",
      }}
    >
      <Plus size={18} strokeWidth={2} className="shrink-0" />
      <span className="hidden text-sm font-semibold sm:inline">
        {creating ? "Starting..." : "Start Party"}
      </span>
    </button>
  );

  return (
    <>
      {headerSlot && createPortal(startButton, headerSlot)}

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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {parties.map((party) => (
              <RoomCard key={party.id} party={party} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
