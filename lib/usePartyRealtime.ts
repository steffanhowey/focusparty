"use client";

import { useEffect } from "react";
import { getSupabase } from "./supabase";

interface UsePartyRealtimeOptions {
  /** Specific party ID to watch participants for. */
  partyId?: string;
  /** Called when the party list should be refreshed. */
  onPartiesChange?: () => void;
  /** Called when participants for a specific party change. */
  onParticipantsChange?: () => void;
}

export function usePartyRealtime({
  partyId,
  onPartiesChange,
  onParticipantsChange,
}: UsePartyRealtimeOptions) {
  useEffect(() => {
    const channelName = partyId ? `party-lobby-${partyId}` : "party-list";
    const client = getSupabase();
    const channel = client.channel(channelName);

    if (onPartiesChange) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table: "fp_parties" },
        () => onPartiesChange()
      );
    }

    if (onParticipantsChange && partyId) {
      channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "fp_party_participants",
          filter: `party_id=eq.${partyId}`,
        },
        () => onParticipantsChange()
      );
    }

    channel.subscribe();

    return () => {
      client.removeChannel(channel);
    };
  }, [partyId, onPartiesChange, onParticipantsChange]);
}
