"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Clock, Users, Sparkles } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useNotification } from "@/components/providers/NotificationProvider";
import { createParty } from "@/lib/parties";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { WORLD_CONFIGS, type WorldConfig, type WorldKey } from "@/lib/worlds";
import { getHostConfig } from "@/lib/hosts";
import { SPRINT_DURATION_OPTIONS } from "@/lib/constants";

const WORLD_KEYS: WorldKey[] = [
  "vibe-coding",
  "writer-room",
  "yc-build",
  "gentle-start",
  "default",
];

const PARTICIPANT_OPTIONS = [3, 5, 8, 10] as const;

interface CreatePartyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreatePartyModal({ isOpen, onClose }: CreatePartyModalProps) {
  const router = useRouter();
  const { showToast } = useNotification();
  const { userId, displayName, requireAuth } = useCurrentUser();

  // Step state
  const [step, setStep] = useState<"world" | "details">("world");
  const [selectedWorld, setSelectedWorld] = useState<WorldConfig | null>(null);

  // Detail fields
  const [name, setName] = useState("");
  const [duration, setDuration] = useState(25);
  const [maxParticipants, setMaxParticipants] = useState(5);
  const [creating, setCreating] = useState(false);

  const handleSelectWorld = (world: WorldConfig) => {
    setSelectedWorld(world);
    setName(`${displayName}'s ${world.label}`);
    setDuration(world.defaultSprintLength);
    setMaxParticipants(Math.min(world.targetRoomSize, 10));
    setStep("details");
  };

  const handleBack = () => {
    setStep("world");
  };

  const handleClose = () => {
    setStep("world");
    setSelectedWorld(null);
    setName("");
    setCreating(false);
    onClose();
  };

  const canSubmit = name.trim().length > 0 && selectedWorld;

  const handleCreate = async () => {
    if (!canSubmit || creating) return;
    if (!requireAuth()) return;

    setCreating(true);

    try {
      const party = await createParty(
        {
          creator_id: userId!,
          name: name.trim(),
          character: "ember",
          planned_duration_min: duration,
          max_participants: maxParticipants,
          world_key: selectedWorld.worldKey,
          host_personality: selectedWorld.hostPersonality,
        },
        displayName
      );

      handleClose();
      router.push(`/rooms/${party.id}`);
    } catch {
      showToast({
        type: "error",
        title: "Failed to create room",
        message: "Please try again.",
      });
      setCreating(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose}>
      {step === "world" ? (
        <div>
          <h2
            className="mb-1 text-xl font-bold text-white"
          >
            Choose your environment
          </h2>
          <p className="mb-5 text-sm text-[var(--color-text-secondary)]">
            Each environment has its own host, pace, and personality.
          </p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {WORLD_KEYS.map((key) => {
              const world = WORLD_CONFIGS[key];
              const host = getHostConfig(world.hostPersonality);

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleSelectWorld(world)}
                  className="cursor-pointer rounded-md border border-[var(--color-border-default)] bg-[var(--color-bg-elevated)] p-4 text-left transition-all duration-150 hover:border-transparent"
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor =
                      world.accentColor;
                    (e.currentTarget as HTMLElement).style.boxShadow =
                      `0 0 0 1px ${world.accentColor}40`;
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor =
                      "var(--color-border-default)";
                    (e.currentTarget as HTMLElement).style.boxShadow = "none";
                  }}
                >
                  {/* Accent bar */}
                  <div
                    className="mb-3 h-1 w-8 rounded-full"
                    style={{ background: world.accentColor }}
                  />

                  {/* Label */}
                  <h3
                    className="text-sm font-semibold text-white"
                  >
                    {world.label}
                  </h3>

                  {/* Description */}
                  <p className="mt-1 text-xs leading-relaxed text-[var(--color-text-secondary)]">
                    {world.description}
                  </p>

                  {/* Meta row */}
                  <div className="mt-3 flex items-center gap-3 text-2xs text-[var(--color-text-tertiary)]">
                    <span className="flex items-center gap-1">
                      <Clock size={10} />
                      {world.defaultSprintLength}m
                    </span>
                    <span className="flex items-center gap-1">
                      <Sparkles size={10} />
                      {host.hostName}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users size={10} />
                      {world.targetRoomSize}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div>
          {/* Back + title */}
          <div className="mb-5">
            <Button
              variant="ghost"
              size="xs"
              leftIcon={<ArrowLeft size={14} />}
              onClick={handleBack}
              className="mb-3"
            >
              Change environment
            </Button>

            {selectedWorld && (
              <div className="flex items-center gap-2">
                <div
                  className="h-2 w-2 rounded-full"
                  style={{ background: selectedWorld.accentColor }}
                />
                <h2
                  className="text-xl font-bold text-white"
                >
                  {selectedWorld.label}
                </h2>
              </div>
            )}
          </div>

          <div className="space-y-5">
            {/* Room name */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--color-text-secondary)]">
                Room name
              </label>
              <input
                type="text"
                placeholder="e.g. Morning Focus Club"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                autoFocus
                className="h-11 w-full rounded-md border border-[var(--color-border-default)] bg-white/[0.06] px-4 text-sm text-white outline-none placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-border-focus)]"
              />
            </div>

            {/* Sprint duration */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--color-text-secondary)]">
                Sprint duration
              </label>
              <div className="flex flex-wrap gap-1.5">
                {SPRINT_DURATION_OPTIONS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDuration(d)}
                    className="cursor-pointer rounded-full px-3.5 py-1.5 text-xs font-medium transition-all duration-150"
                    style={{
                      background:
                        d === duration
                          ? selectedWorld?.accentColor ??
                            "var(--color-accent-primary)"
                          : "transparent",
                      color:
                        d === duration
                          ? "white"
                          : "var(--color-text-tertiary)",
                      border:
                        d === duration
                          ? "none"
                          : "1px solid var(--color-border-default)",
                    }}
                  >
                    {d}m
                  </button>
                ))}
              </div>
            </div>

            {/* Max participants */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--color-text-secondary)]">
                Max participants
              </label>
              <div className="flex flex-wrap gap-1.5">
                {PARTICIPANT_OPTIONS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setMaxParticipants(n)}
                    className="cursor-pointer rounded-full px-3.5 py-1.5 text-xs font-medium transition-all duration-150"
                    style={{
                      background:
                        n === maxParticipants
                          ? selectedWorld?.accentColor ??
                            "var(--color-accent-primary)"
                          : "transparent",
                      color:
                        n === maxParticipants
                          ? "white"
                          : "var(--color-text-tertiary)",
                      border:
                        n === maxParticipants
                          ? "none"
                          : "1px solid var(--color-border-default)",
                    }}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* Create button */}
            <Button
              variant="cta"
              fullWidth
              loading={creating}
              onClick={handleCreate}
              disabled={!canSubmit}
              className="mt-2"
              style={{
                background:
                  selectedWorld?.accentColor ?? "var(--color-accent-primary)",
              }}
            >
              Create room
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
