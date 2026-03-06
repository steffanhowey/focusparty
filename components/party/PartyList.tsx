"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/Button";
import { PartyCard } from "./PartyCard";
import { EmptyState } from "./EmptyState";
import { DisplayNameBanner } from "./DisplayNameBanner";
import { CreatePartyModal } from "./CreatePartyModal";
import { listWaitingParties, type PartyWithCount } from "@/lib/parties";
import { getIdentity } from "@/lib/identity";
import { usePartyRealtime } from "@/lib/usePartyRealtime";

export function PartyList() {
  const [parties, setParties] = useState<PartyWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [displayName, setDisplayName] = useState("Guest");

  useEffect(() => {
    const id = getIdentity();
    setDisplayName(id.displayName);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const data = await listWaitingParties();
      setParties(data);
    } catch {
      // silently fail — list will be empty
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  usePartyRealtime({ onPartiesChange: refresh });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-text-tertiary)] border-t-transparent" />
      </div>
    );
  }

  return (
    <>
      <DisplayNameBanner
        currentName={displayName}
        onNameUpdated={setDisplayName}
      />

      <div className="mb-5 flex items-center justify-between">
        <p className="text-sm text-[var(--color-text-secondary)]">
          {parties.length === 0
            ? "No active parties"
            : `${parties.length} ${parties.length === 1 ? "party" : "parties"} waiting`}
        </p>
        <Button variant="primary" className="h-10 px-5 text-sm" onClick={() => setShowCreate(true)}>
          + Create Party
        </Button>
      </div>

      {parties.length === 0 ? (
        <EmptyState onCreateParty={() => setShowCreate(true)} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {parties.map((party) => (
            <PartyCard key={party.id} party={party} />
          ))}
        </div>
      )}

      <CreatePartyModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
      />
    </>
  );
}
