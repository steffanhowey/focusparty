"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { RoomCard } from "@/components/party/RoomCard";
import { useActiveBackgrounds } from "@/lib/useActiveBackgrounds";
import { getCanonicalRoomEntryRoute, ROOMS_ROUTE } from "@/lib/appRoutes";
import { writeMissionRoomHandoff } from "@/lib/missionRoomHandoff";
import { getMissionRoomRecommendations } from "@/lib/missionRoomRecommendations";
import { useDiscoverableParties } from "@/lib/useDiscoverableParties";
import type { PartyWithCount } from "@/lib/parties";
import type { LearningPath, LearningProgress } from "@/lib/types";

interface MissionRoomPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  path: LearningPath;
  progress?: LearningProgress | null;
}

export function MissionRoomPickerModal({
  isOpen,
  onClose,
  path,
}: MissionRoomPickerModalProps) {
  const router = useRouter();
  const backgrounds = useActiveBackgrounds();
  const { parties, loading, error } = useDiscoverableParties();
  const [joiningRoomId, setJoiningRoomId] = useState<string | null>(null);

  const availableRooms = useMemo(
    () => parties.filter((party) => party.persistent),
    [parties],
  );
  const { recommendedRoom, otherRooms, missionDomainLabel } =
    useMemo(() => getMissionRoomRecommendations(path, parties), [path, parties]);
  const orderedRooms = useMemo(
    () => (recommendedRoom ? [recommendedRoom, ...otherRooms] : otherRooms),
    [recommendedRoom, otherRooms],
  );

  const handleSelectRoom = (party: PartyWithCount) => {
    setJoiningRoomId(party.id);
    writeMissionRoomHandoff({
      missionId: path.id,
      missionTitle: path.title,
      missionDomain: missionDomainLabel,
    });
    const entryRoute = getCanonicalRoomEntryRoute(party);
    const params = new URLSearchParams();
    params.set("missionId", path.id);
    params.set("missionTitle", path.title);
    if (missionDomainLabel) {
      params.set("missionDomain", missionDomainLabel);
    }
    router.push(`${entryRoute}?${params.toString()}`);
  };

  const handleSeeAllRooms = () => {
    onClose();
    router.push(ROOMS_ROUTE);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Bring this mission into a room"
      variant="immersive"
      panelClassName="max-w-[1120px] p-6 sm:p-8"
    >
      <div className="space-y-6">
        {loading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Card
                key={index}
                className="animate-pulse border-white/[0.08] bg-white/[0.04] p-4"
              >
                <div className="h-[200px] rounded-md bg-white/10" />
                <div className="mt-3 h-4 w-3/5 rounded-full bg-white/10" />
                <div className="mt-2 h-3 w-4/5 rounded-full bg-white/10" />
              </Card>
            ))}
          </div>
        ) : error ? (
          <Card className="border-white/[0.08] bg-white/[0.04] p-5">
            <div className="space-y-3">
              <h3 className="text-base font-semibold text-white">
                Couldn&apos;t load rooms right now
              </h3>
              <p className="text-sm leading-6 text-white/55">
                Open the full Rooms page to pick a room manually.
              </p>
              <Button variant="outline" size="sm" onClick={handleSeeAllRooms}>
                See all rooms
              </Button>
            </div>
          </Card>
        ) : availableRooms.length === 0 ? (
          <Card className="border-white/[0.08] bg-white/[0.04] p-5">
            <div className="space-y-3">
              <h3 className="text-base font-semibold text-white">
                No rooms are open right now
              </h3>
              <p className="text-sm leading-6 text-white/55">
                Browse the full Rooms page to find a room that fits this mission.
              </p>
              <Button variant="outline" size="sm" onClick={handleSeeAllRooms}>
                See all rooms
              </Button>
            </div>
          </Card>
        ) : (
          <>
            <section>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {orderedRooms.map((party, index) => (
                  <RoomCard
                    key={party.id}
                    party={party}
                    backgrounds={backgrounds}
                    tone="dark"
                    badge={
                      index === 0 && recommendedRoom?.id === party.id ? (
                        <span
                          className="inline-flex items-center rounded-full px-2.5 py-1 text-2xs font-semibold backdrop-blur-md"
                          style={{
                            background:
                              "color-mix(in srgb, var(--sg-shell-900) 52%, transparent)",
                            color: "var(--sg-forest-300)",
                          }}
                        >
                          Recommended
                        </span>
                      ) : null
                    }
                    onClick={() => handleSelectRoom(party)}
                    isJoining={joiningRoomId === party.id}
                  />
                ))}
              </div>
            </section>

            <div className="flex justify-end">
              <Button
                variant="link"
                size="sm"
                rightIcon={<ArrowRight size={14} />}
                onClick={handleSeeAllRooms}
              >
                See all rooms
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
