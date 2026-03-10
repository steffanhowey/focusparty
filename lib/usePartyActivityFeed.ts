"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "./supabase/client";
import { listPartyEvents } from "./sessions";
import { eventDisplayText } from "./presence";
import type { ActivityEvent, ActivityFeedItem } from "./types";

/** Enrich a raw ActivityEvent with display text. */
function enrichEvent(
  event: ActivityEvent,
  nameMap: Map<string, string>
): ActivityFeedItem {
  const name = nameMap.get(event.user_id ?? "") ?? event.body ?? "Someone";
  return {
    ...event,
    displayText: eventDisplayText(event.event_type, name, event.body),
  };
}

interface UsePartyActivityFeedReturn {
  events: ActivityFeedItem[];
  isLoading: boolean;
}

/**
 * Fetches recent activity events for a party and subscribes
 * to realtime INSERTs for live momentum updates.
 */
export function usePartyActivityFeed(
  partyId: string | null,
  /** Map of userId → displayName, built from presence or participants. */
  displayNameMap: Map<string, string>,
  limit = 30
): UsePartyActivityFeedReturn {
  const [events, setEvents] = useState<ActivityFeedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Ref to avoid stale closure in realtime callback
  const nameMapRef = useRef(displayNameMap);
  nameMapRef.current = displayNameMap;

  // Initial fetch
  useEffect(() => {
    if (!partyId) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        const raw = await listPartyEvents(partyId!, limit);
        if (cancelled) return;
        // Reverse so oldest first (feed reads top-to-bottom chronologically)
        const enriched = raw
          .reverse()
          .map((e) => enrichEvent(e, nameMapRef.current));
        setEvents(enriched);
      } catch (err) {
        console.error("[usePartyActivityFeed] load error:", err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [partyId, limit]);

  // Realtime: subscribe to INSERT on fp_activity_events for this party
  useEffect(() => {
    if (!partyId) return;

    const client = createClient();
    const channel = client
      .channel(`party-feed-${partyId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "fp_activity_events",
          filter: `party_id=eq.${partyId}`,
        },
        (payload) => {
          const newEvent = payload.new as ActivityEvent;
          const enriched = enrichEvent(newEvent, nameMapRef.current);
          setEvents((prev) => {
            const next = [...prev, enriched];
            // Cap at 150 to prevent unbounded memory growth in long sessions
            return next.length > 150 ? next.slice(-100) : next;
          });
        }
      )
      .subscribe();

    return () => {
      client.removeChannel(channel);
    };
  }, [partyId]);

  return { events, isLoading };
}
