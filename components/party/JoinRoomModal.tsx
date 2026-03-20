"use client";

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Target } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { JoinRoomHeader } from "./JoinRoomHeader";
import { MissionSelectionPicker } from "./MissionSelectionPicker";
import { DurationPills } from "@/components/session/DurationPills";
import { SPRINT_DURATION_OPTIONS } from "@/lib/constants";
import { useCurrentUser } from "@/lib/useCurrentUser";
import type { CommitmentType } from "@/lib/types";
import { usePartyPresence } from "@/lib/usePartyPresence";
import { usePartyActivityFeed } from "@/lib/usePartyActivityFeed";
import { useRoomSprint } from "@/lib/useRoomSprint";
import { getParty, joinParty, getSyntheticParticipants, type Party, type SyntheticPresenceInfo } from "@/lib/parties";
import { getWorldConfig } from "@/lib/worlds";
import { useFocusTrap } from "@/lib/useFocusTrap";
import type { ActiveBackground } from "@/lib/roomBackgrounds";
import { getMissionPrimaryArea, getMissionProgressSummary } from "@/lib/missionPresentation";
import { useActiveMissions } from "@/lib/useActiveMissions";

interface JoinRoomModalProps {
  partyId: string;
  isOpen: boolean;
  onClose: () => void;
  party?: Party | null;
  syntheticParticipants?: SyntheticPresenceInfo[];
  backgrounds?: Map<string, ActiveBackground>;
  onJoin?: (config: JoinConfig) => void;
  /** Presence from the parent environment page — avoids duplicate channel. */
  presence?: { participants: import("@/lib/types").PresencePayload[]; count: number };
}

/** Config stored in sessionStorage for the environment page to read. */
export interface JoinConfig {
  missionId: string | null;
  missionTitle: string | null;
  missionDomain: string | null;
  durationSec: number;
  autoStart: boolean;
  commitmentType: CommitmentType;
  musicAutoPlay: boolean;
}

export function JoinRoomModal({
  partyId,
  isOpen,
  onClose,
  party: initialParty,
  syntheticParticipants: initialSyntheticParticipants,
  backgrounds,
  onJoin,
  presence: externalPresence,
}: JoinRoomModalProps) {
  const router = useRouter();
  const { userId, displayName, username } = useCurrentUser();
  const [mounted, setMounted] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const previousActive = useRef<HTMLElement | null>(null);
  useFocusTrap(overlayRef, isOpen && mounted);

  // ─── Party data ──────────────────────────────────────────
  const [fetchedParty, setFetchedParty] = useState<Party | null>(null);
  const [partyLoading, setPartyLoading] = useState(!initialParty);

  useEffect(() => {
    if (!isOpen || !partyId || initialParty) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPartyLoading(true);
    getParty(partyId)
      .then((p) => { if (!cancelled) setFetchedParty(p); })
      .catch((err) => console.error("Failed to fetch party:", err))
      .finally(() => { if (!cancelled) setPartyLoading(false); });
    return () => { cancelled = true; };
  }, [initialParty, isOpen, partyId]);

  // ─── Synthetic participants ─────────────────────────────
  const [fetchedSyntheticParticipants, setFetchedSyntheticParticipants] =
    useState<SyntheticPresenceInfo[]>([]);

  useEffect(() => {
    if (!isOpen || !partyId || initialSyntheticParticipants) return;
    let cancelled = false;
    getSyntheticParticipants(partyId)
      .then((sp) => { if (!cancelled) setFetchedSyntheticParticipants(sp); })
      .catch((err) => console.error("Failed to fetch synthetic participants:", err));
    return () => { cancelled = true; };
  }, [initialSyntheticParticipants, isOpen, partyId]);

  const party = initialParty ?? fetchedParty;
  const syntheticParticipants =
    initialSyntheticParticipants ?? fetchedSyntheticParticipants;

  const world = party ? getWorldConfig(party.world_key) : getWorldConfig("default");
  const aiBg = backgrounds?.get(party?.world_key ?? "default");
  const coverSrc = aiBg?.thumbUrl ?? null;

  // ─── Presence + activity ─────────────────────────────────
  // Use parent's presence when available to avoid a duplicate channel
  // (which can cause the user to disappear from presence on modal close).
  const ownPresence = usePartyPresence({
    partyId: isOpen && !externalPresence ? partyId : null,
    userId,
    displayName,
    username,
  });
  const presence = externalPresence ?? ownPresence;

  const feedNameMap = useMemo(() => {
    const map = new Map<string, string>();
    presence.participants.forEach((p) => map.set(p.userId, p.displayName));
    return map;
  }, [presence.participants]);

  const { events } = usePartyActivityFeed(
    isOpen ? partyId : "",
    feedNameMap
  );

  const roomSprint = useRoomSprint(events, presence.participants);
  const { missions: activeMissions, isLoading: activeMissionsLoading } = useActiveMissions();

  // ─── Form state ────────────────────────────────────────────
  const [selectedMissionId, setSelectedMissionId] = useState<string | null>(null);
  const [freshDuration, setFreshDuration] = useState(25);
  const [isJoining, setIsJoining] = useState(false);
  const [showMissionPicker, setShowMissionPicker] = useState(false);
  const [formStep, setFormStep] = useState<1 | 2>(1);
  const commitmentType: CommitmentType = "personal";

  // Reset form state when modal opens
  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedMissionId(null);
      setFreshDuration(25);
      setIsJoining(false);
      setShowMissionPicker(false);
      setFormStep(1);
    }
  }, [isOpen]);

  const selectedMission = useMemo(
    () => activeMissions.find((mission) => mission.path.id === selectedMissionId) ?? null,
    [activeMissions, selectedMissionId],
  );
  const selectedMissionArea = selectedMission ? getMissionPrimaryArea(selectedMission.path) : null;
  const selectedMissionDomain =
    selectedMissionArea?.detail ?? selectedMissionArea?.label ?? null;
  const selectedMissionSummary = selectedMission
    ? getMissionProgressSummary(selectedMission.progress)
    : null;

  // ─── Computed sprint info ─────────────────────────────────
  const durationSec = freshDuration * 60;

  const buttonLabel = "Join Session";

  // ─── Handlers ──────────────────────────────────────────────
  const handleMissionSelect = useCallback((missionId: string) => {
    setSelectedMissionId(missionId);
    setShowMissionPicker(false);
  }, []);

  const handleContinueWithoutMission = useCallback(() => {
    setSelectedMissionId(null);
    setShowMissionPicker(false);
  }, []);

  const handleJoin = useCallback(async () => {
    if (!userId || isJoining) return;
    setIsJoining(true);

    try {
      await joinParty(partyId, userId, displayName);

      const config: JoinConfig = {
        missionId: selectedMission?.path.id ?? null,
        missionTitle: selectedMission?.path.title ?? null,
        missionDomain: selectedMissionDomain,
        durationSec,
        autoStart: true,
        commitmentType,
        musicAutoPlay: false,
      };

      if (onJoin) {
        onJoin(config);
      } else {
        sessionStorage.setItem("fp_join_config", JSON.stringify(config));
        router.push(`/environment/${partyId}`);
      }
      onClose();
    } catch (err) {
      console.error("[JoinRoomModal] join failed:", err);
      setIsJoining(false);
    }
  }, [
    userId,
    isJoining,
    partyId,
    displayName,
    selectedMission,
    selectedMissionDomain,
    durationSec,
    commitmentType,
    onJoin,
    onClose,
    router,
  ]);

  // ─── Modal plumbing ────────────────────────────────────────
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);


  useEffect(() => {
    if (!isOpen) return;
    previousActive.current = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
      previousActive.current?.focus();
    };
  }, [isOpen]);

  if (!isOpen || !mounted || typeof document === "undefined") return null;

  const content = (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-label="Join session"
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ zIndex: 40 }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-shell-900/40 backdrop-blur-[4px]"
        aria-hidden
      />

      {/* Modal panel — dead center */}
      <div
        className="relative w-full max-w-[520px] overflow-visible rounded-xl"
        style={{
          background: "rgba(15,35,24,0.94)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "var(--shadow-xl)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {partyLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          </div>
        ) : (
          <>
            <JoinRoomHeader
              party={party}
              world={world}
              coverSrc={coverSrc}
              focusingCount={roomSprint.focusingCount}
              hasActiveSprint={roomSprint.hasActiveSprint}
              remainingSeconds={roomSprint.remainingSeconds}
              syntheticParticipants={syntheticParticipants}
            />

            {/* Divider */}
            <div className="mx-5 mt-4 border-t border-white/[0.06]" />

            {/* ── Fixed-height form body — both steps always mounted ── */}
            <div className="relative" style={{ height: 168 }}>

              {/* ── STEP 1: Mission selection ────────────────── */}
              <div
                className="absolute inset-0 flex flex-col transition-opacity duration-200"
                style={{
                  opacity: formStep === 1 ? 1 : 0,
                  pointerEvents: formStep === 1 ? "auto" : "none",
                }}
              >
                <div className="px-5 pt-4">
                  <label className="mb-2 block text-sm font-semibold text-white">
                    What mission are you working on?
                  </label>

                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowMissionPicker((open) => !open)}
                      className="flex w-full items-center gap-2 rounded-full py-2.5 pl-4 pr-10 text-left text-sm text-white outline-none ring-0 ring-white/0 transition-all hover:border-white/12 focus:ring-1 focus:ring-white/12"
                      style={{
                        background: "rgba(255,255,255,0.06)",
                        border: "1px solid rgba(255,255,255,0.08)",
                      }}
                    >
                      <span
                        className={`min-w-0 flex-1 truncate ${selectedMission ? "text-white" : "text-white/35"}`}
                      >
                        {selectedMission
                          ? selectedMission.path.title
                          : "Select an active mission (optional)"}
                      </span>
                    </button>
                    <span
                      className="absolute right-9 top-1/2 h-5 w-px -translate-y-1/2"
                      style={{ background: "rgba(255,255,255,0.08)" }}
                      aria-hidden
                    />
                    <button
                      type="button"
                      onClick={() => setShowMissionPicker((open) => !open)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer rounded p-1 text-white/30 transition hover:text-white/60"
                      aria-label="Browse active missions"
                    >
                      <Target size={16} />
                    </button>

                    {/* Mission picker dropdown */}
                    {showMissionPicker && (
                      <div
                        className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-xl shadow-lg"
                        style={{
                          background: "rgba(15,35,24,0.95)",
                          backdropFilter: "blur(16px)",
                          WebkitBackdropFilter: "blur(16px)",
                          border: "1px solid rgba(255,255,255,0.08)",
                        }}
                      >
                        {activeMissionsLoading ? (
                          <div className="flex items-center justify-center px-4 py-4">
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/[0.24] border-t-white/[0.72]" />
                          </div>
                        ) : (
                          <MissionSelectionPicker
                            missions={activeMissions}
                            selectedMissionId={selectedMissionId}
                            accentColor={world.accentColor}
                            onSelectMission={(mission) => handleMissionSelect(mission.path.id)}
                            onSelectNone={handleContinueWithoutMission}
                          />
                        )}
                      </div>
                    )}
                  </div>

                  {selectedMission && (
                    <p className="mt-2 text-2xs text-white/35">
                      {selectedMissionArea?.detail ?? selectedMissionArea?.label}
                      {" · "}
                      {selectedMissionSummary}
                    </p>
                  )}
                </div>

                {/* Footer */}
                <div className="mt-auto flex items-center justify-end gap-3 px-5 pb-5">
                  <Button
                    variant="cta"
                    size="sm"
                    onClick={() => { setShowMissionPicker(false); setFormStep(2); }}
                  >
                    Continue
                  </Button>
                </div>
              </div>

              {/* ── STEP 2: Duration + join ─────────────────── */}
              <div
                className="absolute inset-0 flex flex-col transition-opacity duration-200"
                style={{
                  opacity: formStep === 2 ? 1 : 0,
                  pointerEvents: formStep === 2 ? "auto" : "none",
                }}
              >
                <div className="px-5 pt-4">
                  <label className="mb-2 block text-sm font-semibold text-white">
                    Sprint duration
                  </label>
                  <DurationPills
                    value={freshDuration}
                    onChange={setFreshDuration}
                    options={SPRINT_DURATION_OPTIONS}
                  />
                </div>

                {/* Footer */}
                <div className="mt-auto flex items-center justify-between px-5 pb-5">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setFormStep(1)}
                  >
                    Back
                  </Button>
                  <Button
                    variant="cta"
                    size="sm"
                    onClick={handleJoin}
                    disabled={isJoining}
                    loading={isJoining}
                  >
                    {isJoining ? "Joining..." : buttonLabel}
                  </Button>
                </div>
              </div>
            </div>

          </>
        )}
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
