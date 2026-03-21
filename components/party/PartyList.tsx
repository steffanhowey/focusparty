"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { useDiscoverableParties } from "@/lib/useDiscoverableParties";
import { useVibePreview } from "@/lib/useVibePreview";
import { RoomCard } from "./RoomCard";
import { FeaturedRoom } from "@/components/party/FeaturedRoom";
import { EmptyState } from "./EmptyState";
import { CreatePartyModal } from "./CreatePartyModal";
import { useActiveBackgrounds } from "@/lib/useActiveBackgrounds";
import { ChevronDown } from "lucide-react";
import { getCanonicalRoomEntryRoute } from "@/lib/appRoutes";
import {
  getPartyLaunchDiscoveryTags,
  isPartyLaunchVisible,
} from "@/lib/launchRooms";
import type { PartyWithCount } from "@/lib/parties";
import { getPartyRuntimeWorldKey } from "@/lib/worlds";

type RoomFilter = "all" | "most-active" | "coding" | "writing" | "calm";

const FILTER_OPTIONS: { value: RoomFilter; label: string }[] = [
  { value: "all", label: "All Rooms" },
  { value: "most-active", label: "Most Active" },
  { value: "coding", label: "Coding & Building" },
  { value: "writing", label: "Writing & Deep Work" },
  { value: "calm", label: "Calm & Gentle" },
];

export function PartyList() {
  const router = useRouter();
  const { requireAuth } = useCurrentUser();
  const [showCreate, setShowCreate] = useState(false);

  const { parties, loading, error } = useDiscoverableParties();
  const backgrounds = useActiveBackgrounds();
  const preview = useVibePreview();

  // Synthetic participants: trigger a global tick every 30s while on discovery page
  useEffect(() => {
    const tick = () =>
      fetch("/api/synthetics/tick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }).catch((err) => console.error("Failed to tick synthetics:", err));
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  const handleOpenRoom = (party: PartyWithCount) => {
    if (!requireAuth()) return;
    // Stop any active preview before navigating
    preview.stopPreview();
    router.push(getCanonicalRoomEntryRoute(party));
  };

  // Pick the featured room: most participants among persistent rooms
  const persistentRooms = parties.filter(
    (p) => p.persistent && isPartyLaunchVisible(p),
  );
  const featuredRoom = persistentRooms.length > 0
    ? persistentRooms.reduce((a, b) => (b.participant_count > a.participant_count ? b : a))
    : null;
  const remainingRooms = persistentRooms.filter((p) => p.id !== featuredRoom?.id);
  const communityRooms = parties.filter((p) => !p.persistent);
  const allListedRooms = [...remainingRooms, ...communityRooms];

  const [filter, setFilter] = useState<RoomFilter>("all");

  const filteredRooms = (() => {
    if (filter === "all") return allListedRooms;
    if (filter === "most-active") return [...allListedRooms].sort((a, b) => b.participant_count - a.participant_count);
    return allListedRooms.filter((party) =>
      getPartyLaunchDiscoveryTags(party).includes(filter),
    );
  })();

  return (
    <>
      <CreatePartyModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
      />

      <div>
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-shell-500 border-t-transparent" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-sm text-shell-600">
              {error}
            </p>
          </div>
        ) : parties.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {/* Featured room e-spot */}
            {featuredRoom && (
              <section className="mb-8">
                <FeaturedRoom
                  party={featuredRoom}
                  backgrounds={backgrounds}
                  onClick={() => handleOpenRoom(featuredRoom)}
                  isPreviewPlaying={
                    preview.previewingKey === featuredRoom.id &&
                    (preview.status === "playing" || preview.status === "loading")
                  }
                  previewStatus={preview.status}
                  onTogglePreview={() =>
                    preview.togglePreview(
                      getPartyRuntimeWorldKey(featuredRoom),
                      featuredRoom.id,
                    )
                  }
                />
              </section>
            )}

            {/* All rooms */}
            {allListedRooms.length > 0 && (
              <section>
                <div className="mb-6 flex items-center justify-between">
                  <h2 className="text-xl font-bold text-shell-900">
                    Rooms
                  </h2>
                  <div className="relative">
                    <select
                      value={filter}
                      onChange={(e) => setFilter(e.target.value as RoomFilter)}
                      className="cursor-pointer appearance-none rounded-full border border-shell-border bg-shell-50 px-4 py-2 pr-8 text-sm text-shell-600 transition-colors hover:border-forest-400 focus:border-forest-400 focus:outline-none"
                    >
                      {FILTER_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={14}
                      strokeWidth={1.5}
                      className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-shell-500"
                    />
                  </div>
                </div>
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredRooms.map((party) => (
                    <RoomCard
                      key={party.id}
                      party={party}
                      backgrounds={backgrounds}
                      onClick={() => handleOpenRoom(party)}
                      isPreviewPlaying={
                        party.persistent &&
                        preview.previewingKey === party.id &&
                        (preview.status === "playing" || preview.status === "loading")
                      }
                      previewStatus={preview.status}
                      onTogglePreview={
                        party.persistent
                          ? () =>
                              preview.togglePreview(
                                getPartyRuntimeWorldKey(party),
                                party.id,
                              )
                          : undefined
                      }
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>

      {/* Hidden YouTube preview player container */}
      <div
        data-preview-container
        style={{
          position: "fixed",
          bottom: 0,
          right: 0,
          width: 200,
          height: 200,
          clipPath: "inset(100%)",
          pointerEvents: "none",
        }}
      >
        <div id={preview.playerContainerId} />
      </div>
    </>
  );
}
