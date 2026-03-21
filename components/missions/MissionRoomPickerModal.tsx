"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { RoomCard } from "@/components/party/RoomCard";
import { useActiveBackgrounds } from "@/lib/useActiveBackgrounds";
import { ROOMS_ROUTE } from "@/lib/appRoutes";
import {
  getLaunchRoomCatalogEntries,
  getLaunchRoomMissionFitHint,
  getPartyLaunchPickerDescription,
  isPartyLaunchVisible,
} from "@/lib/launchRooms";
import {
  prepareMissionRoomEntry,
  prepareMissionRoomHandoff,
} from "@/lib/missionRoomEntry";
import { getMissionRoomRecommendations } from "@/lib/missionRoomRecommendations";
import { useDiscoverableParties } from "@/lib/useDiscoverableParties";
import type { PartyWithCount } from "@/lib/parties";
import type { LearningPath } from "@/lib/types";

interface MissionRoomPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  path: LearningPath;
  title?: string;
  onBack?: () => void;
  backLabel?: string;
  missionStepIndex?: number | null;
  missionStepTitle?: string | null;
}

const ROOM_PICKER_GRID_CLASS_NAME = "grid gap-5 sm:grid-cols-2 lg:grid-cols-3";
const ROOM_PICKER_SKELETON_COUNT = getLaunchRoomCatalogEntries().length;

export function MissionRoomPickerModal({
  isOpen,
  onClose,
  path,
  title = "Bring this mission into a room",
  onBack,
  backLabel = "Back to mission",
  missionStepIndex = null,
  missionStepTitle = null,
}: MissionRoomPickerModalProps) {
  const router = useRouter();
  const backgrounds = useActiveBackgrounds();
  const { parties, loading, error } = useDiscoverableParties();
  const [joiningRoomId, setJoiningRoomId] = useState<string | null>(null);

  const availableRooms = useMemo(
    () => parties.filter((party) => party.persistent && isPartyLaunchVisible(party)),
    [parties],
  );
  const { recommendedRoom, otherRooms, missionDomainLabel } =
    useMemo(() => getMissionRoomRecommendations(path, parties), [path, parties]);
  const orderedRooms = useMemo(
    () => (recommendedRoom ? [recommendedRoom, ...otherRooms] : otherRooms),
    [recommendedRoom, otherRooms],
  );
  const recommendedRoomFitHint = useMemo(
    () => getLaunchRoomMissionFitHint(recommendedRoom),
    [recommendedRoom],
  );

  const handleSelectRoom = (party: PartyWithCount) => {
    setJoiningRoomId(party.id);
    const href = prepareMissionRoomEntry({
      party,
      path,
      missionDomainLabel,
      missionStepIndex,
      missionStepTitle,
    });
    router.push(href);
  };

  const handleSeeAllRooms = () => {
    prepareMissionRoomHandoff({
      path,
      missionDomainLabel,
      missionStepIndex,
      missionStepTitle,
    });
    onClose();
    router.push(ROOMS_ROUTE);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      variant="immersive"
      panelClassName="max-w-[1120px] p-6 sm:p-8"
    >
      <div className={`space-y-6 ${loading ? "min-h-[560px] sm:min-h-[620px]" : ""}`}>
        {onBack ? (
          <div>
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<ArrowLeft size={14} />}
              className="text-white/60 hover:bg-white/10 hover:text-white"
              onClick={onBack}
            >
              {backLabel}
            </Button>
          </div>
        ) : null}

        {loading ? (
          <>
            <div
              className="h-4 w-40 animate-pulse rounded-full"
              style={{ background: "rgba(255,255,255,0.10)" }}
            />
            <section>
              <div className={ROOM_PICKER_GRID_CLASS_NAME}>
                {Array.from({ length: ROOM_PICKER_SKELETON_COUNT }).map((_, index) => (
                  <RoomPickerCardSkeleton
                    key={index}
                    showRecommendedBadge={index === 0}
                  />
                ))}
              </div>
            </section>
          </>
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
            {recommendedRoomFitHint ? (
              <p className="text-sm text-white/55">
                {recommendedRoomFitHint}
              </p>
            ) : null}

            <section>
              <div className={ROOM_PICKER_GRID_CLASS_NAME}>
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
                    descriptionOverride={getPartyLaunchPickerDescription(party)}
                    onClick={() => handleSelectRoom(party)}
                    isJoining={joiningRoomId === party.id}
                  />
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </Modal>
  );
}

function RoomPickerCardSkeleton({
  showRecommendedBadge = false,
}: {
  showRecommendedBadge?: boolean;
}) {
  return (
    <div className="animate-pulse">
      <div
        className="relative h-[200px] w-full overflow-hidden rounded-md border"
        style={{
          borderColor: "rgba(255,255,255,0.08)",
          background: "rgba(255,255,255,0.04)",
        }}
      >
        <div
          className="absolute inset-0"
          style={{ background: "rgba(255,255,255,0.03)" }}
        />
        {showRecommendedBadge ? (
          <div
            className="absolute left-3 top-3 h-6 w-28 rounded-full"
            style={{ background: "rgba(255,255,255,0.10)" }}
          />
        ) : null}
      </div>

      <div className="flex items-center gap-2 px-1 pt-2">
        <div className="min-w-0 flex-1 space-y-1.5">
          <div
            className="h-4 w-3/5 rounded-full"
            style={{ background: "rgba(255,255,255,0.10)" }}
          />
          <div
            className="h-3 w-4/5 rounded-full"
            style={{ background: "rgba(255,255,255,0.08)" }}
          />
          <div
            className="h-3 w-2/3 rounded-full"
            style={{ background: "rgba(255,255,255,0.08)" }}
          />
        </div>

        <div className="flex shrink-0 items-center">
          {[0, 1, 2].map((index) => (
            <div
              key={index}
              className={`h-5 w-5 rounded-full border ${
                index === 0 ? "" : "-ml-[6px]"
              }`}
              style={{
                background: "rgba(255,255,255,0.08)",
                borderColor: "rgba(15,35,24,0.45)",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
