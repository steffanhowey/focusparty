"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { FlameIcon } from "@/components/ui/FlameIcon";
import { CHARACTERS, SPRINT_DURATION_OPTIONS } from "@/lib/constants";
import { useNotification } from "@/components/providers/NotificationProvider";
import { createParty } from "@/lib/parties";
import { useCurrentUser } from "@/lib/useCurrentUser";
import type { CharacterId } from "@/lib/types";

const CHARACTER_IDS: CharacterId[] = ["ember", "moss", "byte"];
const PARTICIPANT_OPTIONS = [2, 3, 4, 5] as const;

interface CreatePartyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreatePartyModal({ isOpen, onClose }: CreatePartyModalProps) {
  const router = useRouter();
  const { showToast } = useNotification();
  const { userId, displayName, requireAuth } = useCurrentUser();

  const [name, setName] = useState("");
  const [character, setCharacter] = useState<CharacterId>("ember");
  const [duration, setDuration] = useState(25);
  const [maxParticipants, setMaxParticipants] = useState(3);
  const [creating, setCreating] = useState(false);

  const canSubmit = name.trim().length > 0;

  const handleCreate = async () => {
    if (!canSubmit || creating) return;
    if (!requireAuth()) return;

    setCreating(true);

    try {
      const party = await createParty(
        {
          creator_id: userId!,
          name: name.trim(),
          character,
          planned_duration_min: duration,
          max_participants: maxParticipants,
        },
        displayName
      );

      onClose();
      router.push(`/party/${party.id}`);
    } catch {
      showToast({
        type: "error",
        title: "Failed to create party",
        message: "Please try again.",
      });
    } finally {
      setCreating(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create a party">
      <div className="space-y-5">
        {/* Party name */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-[var(--color-text-secondary)]">
            Party name
          </label>
          <input
            type="text"
            placeholder="e.g. Morning Focus Club"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            className="h-11 w-full rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-white/[0.06] px-4 text-sm text-white outline-none placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-border-focus)]"
            style={{ fontFamily: "var(--font-montserrat), sans-serif" }}
          />
        </div>

        {/* Character selection */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-[var(--color-text-secondary)]">
            AI host character
          </label>
          <div className="grid grid-cols-3 gap-2">
            {CHARACTER_IDS.map((cid) => {
              const c = CHARACTERS[cid];
              const selected = cid === character;
              return (
                <button
                  key={cid}
                  type="button"
                  onClick={() => setCharacter(cid)}
                  className="flex cursor-pointer flex-col items-center gap-1.5 rounded-[var(--radius-lg)] border-2 p-3 transition-all duration-150"
                  style={{
                    borderColor: selected ? c.primary : "var(--color-border-default)",
                    background: selected ? `${c.primary}15` : "transparent",
                  }}
                >
                  <FlameIcon character={cid} size={24} />
                  <span
                    className="text-xs font-semibold"
                    style={{ color: selected ? c.primary : "var(--color-text-secondary)" }}
                  >
                    {c.name}
                  </span>
                  <span className="text-[10px] text-[var(--color-text-tertiary)]">
                    {c.tagline}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Duration */}
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
                  background: d === duration ? "var(--color-accent-primary)" : "transparent",
                  color: d === duration ? "white" : "var(--color-text-tertiary)",
                  border: d === duration ? "none" : "1px solid var(--color-border-default)",
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
                  background: n === maxParticipants ? "var(--color-accent-primary)" : "transparent",
                  color: n === maxParticipants ? "white" : "var(--color-text-tertiary)",
                  border: n === maxParticipants ? "none" : "1px solid var(--color-border-default)",
                }}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Submit */}
        <button
          type="button"
          onClick={handleCreate}
          disabled={!canSubmit || creating}
          className="mt-2 h-12 w-full cursor-pointer rounded-full bg-[var(--color-accent-primary)] font-semibold text-white transition-all duration-150 hover:bg-[var(--color-purple-800)] hover:shadow-[var(--shadow-glow-purple)] disabled:cursor-not-allowed disabled:opacity-50"
          style={{ fontFamily: "var(--font-montserrat), sans-serif" }}
        >
          {creating ? "Creating..." : "Create party"}
        </button>
      </div>
    </Modal>
  );
}
