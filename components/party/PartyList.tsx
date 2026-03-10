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

type RoomFilter = "all" | "most-active" | "coding" | "writing" | "calm";

const FILTER_OPTIONS: { value: RoomFilter; label: string }[] = [
  { value: "all", label: "All Rooms" },
  { value: "most-active", label: "Most Active" },
  { value: "coding", label: "Coding & Building" },
  { value: "writing", label: "Writing & Focus" },
  { value: "calm", label: "Calm & Gentle" },
];

const FILTER_WORLD_KEYS: Record<string, string[]> = {
  coding: ["vibe-coding", "yc-build"],
  writing: ["writer-room", "default"],
  calm: ["gentle-start"],
};

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

  const handleOpenRoom = (partyId: string) => {
    if (!requireAuth()) return;
    // Stop any active preview before navigating
    preview.stopPreview();
    router.push(`/environment/${partyId}`);
  };

  // Pick the featured room: most participants among persistent rooms
  const persistentRooms = parties.filter((p) => p.persistent);
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
    const keys = FILTER_WORLD_KEYS[filter];
    return keys ? allListedRooms.filter((p) => keys.includes(p.world_key)) : allListedRooms;
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
            {/* Featured room e-spot */}
            {featuredRoom && (
              <section className="mb-8">
                <FeaturedRoom
                  party={featuredRoom}
                  backgrounds={backgrounds}
                  onClick={() => handleOpenRoom(featuredRoom.id)}
                  isPreviewPlaying={preview.previewingWorldKey === featuredRoom.world_key && (preview.status === "playing" || preview.status === "loading")}
                  previewStatus={preview.status}
                  onTogglePreview={() => preview.togglePreview(featuredRoom.world_key)}
                />
              </section>
            )}

            {/* All rooms */}
            {allListedRooms.length > 0 && (
              <section>
                <div className="mb-6 flex items-center justify-between">
                  <h2 className="text-xl font-bold text-[var(--color-text-primary)]">
                    Rooms
                  </h2>
                  <div className="relative">
                    <select
                      value={filter}
                      onChange={(e) => setFilter(e.target.value as RoomFilter)}
                      className="cursor-pointer appearance-none rounded-full border border-[var(--color-border-default)] bg-white/[0.06] px-4 py-2 pr-8 text-sm text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-border-focus)] focus:border-[var(--color-border-focus)] focus:outline-none"
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
                      className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)]"
                    />
                  </div>
                </div>
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredRooms.map((party) => (
                    <RoomCard
                      key={party.id}
                      party={party}
                      backgrounds={backgrounds}
                      onClick={() => handleOpenRoom(party.id)}
                      isPreviewPlaying={
                        party.persistent &&
                        preview.previewingWorldKey === party.world_key &&
                        (preview.status === "playing" || preview.status === "loading")
                      }
                      previewStatus={preview.status}
                      onTogglePreview={
                        party.persistent
                          ? () => preview.togglePreview(party.world_key)
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
