"use client";

import { type RefObject, useEffect } from "react";
import { Play, Pause, Volume2, VolumeX, Loader2 } from "lucide-react";
import { VIBES, VIBE_ICONS, type VibeId, type MusicStatus } from "@/lib/musicConstants";

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

  return (
    <div
      className="absolute bottom-full left-1/2 mb-3 -translate-x-1/2 rounded-xl border border-[var(--color-border-default)] p-3 shadow-2xl"
      style={{
        background: "rgba(13,14,32,0.45)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        zIndex: 40,
        minWidth: 260,
      }}
      role="dialog"
      aria-label="Music player"
    >
      {/* Vibe section */}
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
        Vibe
      </p>

      <div className="flex flex-col gap-1">
        {VIBES.map((vibe) => {
          const isActive = activeVibe === vibe.id;
          const Icon = VIBE_ICONS[vibe.id];
          return (
            <button
              key={vibe.id}
              type="button"
              onClick={() => onSelectVibe(vibe.id)}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-colors ${
                isActive
                  ? "bg-[var(--color-accent-primary)]/20 text-white ring-1 ring-[var(--color-accent-primary)]/40"
                  : "text-[var(--color-text-secondary)] hover:bg-white/[0.06] hover:text-white"
              }`}
            >
              <Icon size={14} strokeWidth={1.8} className="flex-shrink-0" />
              <span className="text-xs font-medium">{vibe.label}</span>
            </button>
          );
        })}
      </div>

      {/* Divider */}
      <div className="my-2.5 border-t border-[var(--color-border-subtle)]" />

      {/* Transport controls */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onTogglePlayPause}
          disabled={isLoading}
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-white transition-colors hover:bg-white/10 disabled:opacity-50"
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isLoading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : isPlaying ? (
            <Pause size={16} fill="currentColor" />
          ) : (
            <Play size={16} fill="currentColor" />
          )}
        </button>

        <button
          type="button"
          onClick={() => onSetVolume(volume === 0 ? 50 : 0)}
          className="flex h-6 w-6 flex-shrink-0 items-center justify-center text-[var(--color-text-tertiary)] transition-colors hover:text-white"
          aria-label={volume === 0 ? "Unmute" : "Mute"}
        >
          {volume === 0 ? <VolumeX size={14} /> : <Volume2 size={14} />}
        </button>

        <input
          type="range"
          min={0}
          max={100}
          value={volume}
          onChange={(e) => onSetVolume(Number(e.target.value))}
          className="music-volume-slider h-1 flex-1 cursor-pointer appearance-none rounded-full bg-white/20 accent-[var(--color-accent-primary)]"
          aria-label="Volume"
        />

        <span className="w-7 text-right text-[11px] tabular-nums text-[var(--color-text-tertiary)]">
          {volume}
        </span>
      </div>

      {/* Error message */}
      {isError && (
        <p className="mt-2 text-[11px] text-[var(--color-coral-700)]">
          Unable to load audio. Try another vibe.
        </p>
      )}
    </div>
  );
}
