"use client";

import { type RefObject, useEffect } from "react";
import { Play, Pause, Volume2, VolumeX, Loader2 } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { MenuItem } from "@/components/ui/MenuItem";
import { VIBES, VIBE_ICONS, type VibeId, type MusicStatus, VIBES_MAP } from "@/lib/musicConstants";

interface MusicPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  /** Ref to the wrapper that includes the trigger button — clicks inside won't close */
  wrapperRef: RefObject<HTMLDivElement | null>;
  activeVibe: VibeId | null;
  onSelectVibe: (vibeId: VibeId) => void;
  isPlaying: boolean;
  onTogglePlayPause: () => void;
  volume: number;
  onSetVolume: (volume: number) => void;
  status: MusicStatus;
  /** When true, vibe selection is hidden — the room controls the vibe. */
  roomControlled?: boolean;
}

export function MusicPopover({
  isOpen,
  onClose,
  wrapperRef,
  activeVibe,
  onSelectVibe,
  isPlaying,
  onTogglePlayPause,
  volume,
  onSetVolume,
  status,
  roomControlled,
}: MusicPopoverProps) {
  // Click-outside and Escape to close (same pattern as TimerDropdown)
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [isOpen, onClose, wrapperRef]);

  if (!isOpen) return null;

  const isLoading = status === "loading";
  const isError = status === "error";

  // Look up the active vibe config for the label
  const activeVibeConfig = activeVibe ? VIBES_MAP[activeVibe] : null;
  const ActiveVibeIcon = activeVibe ? VIBE_ICONS[activeVibe] : null;

  return (
    <div
      className="absolute bottom-full left-1/2 mb-3 -translate-x-1/2 rounded-xl border border-[var(--color-border-default)] p-3 shadow-lg"
      style={{
        background: "rgba(15,35,24,0.65)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        zIndex: 40,
        minWidth: 260,
        boxShadow: "var(--shadow-float)",
      }}
      role="dialog"
      aria-label="Music player"
    >
      {roomControlled ? (
        /* Room-controlled: show vibe label as informational, no selector */
        activeVibeConfig && ActiveVibeIcon ? (
          <div className="mb-2.5 flex items-center gap-2.5 px-1">
            <ActiveVibeIcon size={14} strokeWidth={1.8} className="flex-shrink-0 text-[var(--color-text-secondary)]" />
            <span className="text-xs font-medium text-[var(--color-text-secondary)]">
              {activeVibeConfig.label}
            </span>
          </div>
        ) : null
      ) : (
        /* User-controlled: full vibe selector */
        <>
          <p className="mb-2 text-2xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
            Vibe
          </p>

          <div className="flex flex-col gap-1">
            {VIBES.map((vibe) => {
              const isActive = activeVibe === vibe.id;
              const Icon = VIBE_ICONS[vibe.id];
              return (
                <MenuItem
                  key={vibe.id}
                  icon={<Icon size={14} strokeWidth={1.8} />}
                  active={isActive}
                  onClick={() => onSelectVibe(vibe.id)}
                >
                  {vibe.label}
                </MenuItem>
              );
            })}
          </div>

          {/* Divider */}
          <div className="my-2.5 border-t border-[var(--color-border-subtle)]" />
        </>
      )}

      {/* Transport controls */}
      <div className="flex items-center gap-2">
        <IconButton
          variant="ghost"
          size="sm"
          icon={
            isLoading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : isPlaying ? (
              <Pause size={16} fill="currentColor" />
            ) : (
              <Play size={16} fill="currentColor" />
            )
          }
          onClick={onTogglePlayPause}
          disabled={isLoading}
          className="shrink-0 text-white"
          aria-label={isPlaying ? "Pause" : "Play"}
        />

        <IconButton
          variant="ghost"
          size="xs"
          icon={volume === 0 ? <VolumeX size={14} /> : <Volume2 size={14} />}
          onClick={() => onSetVolume(volume === 0 ? 50 : 0)}
          className="shrink-0"
          aria-label={volume === 0 ? "Unmute" : "Mute"}
        />

        <input
          type="range"
          min={0}
          max={100}
          value={volume}
          onChange={(e) => onSetVolume(Number(e.target.value))}
          className="music-volume-slider h-1 flex-1 cursor-pointer appearance-none rounded-full bg-white/20 accent-[var(--sg-forest-400)]"
          aria-label="Volume"
        />

        <span className="w-7 text-right text-2xs tabular-nums text-[var(--color-text-tertiary)]">
          {volume}
        </span>
      </div>

      {/* Error message */}
      {isError && (
        <p className="mt-2 text-2xs text-[var(--color-coral-700)]">
          {roomControlled
            ? "Unable to load audio. Try refreshing."
            : "Unable to load audio. Try another vibe."}
        </p>
      )}
    </div>
  );
}
