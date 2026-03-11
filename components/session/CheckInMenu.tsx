"use client";

import { type RefObject, useEffect, useRef, useState } from "react";
import { TrendingUp, Rocket, RotateCcw, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { MenuItem } from "@/components/ui/MenuItem";

interface CheckInMenuProps {
  isOpen: boolean;
  onClose: () => void;
  /** Ref to the wrapper that includes the trigger button — clicks inside won't close */
  wrapperRef: RefObject<HTMLDivElement | null>;
  onCheckIn: (action: string, message?: string) => void;
}

const ICON = { size: 14, strokeWidth: 1.8 } as const;

export function CheckInMenu({
  isOpen,
  onClose,
  wrapperRef,
  onCheckIn,
}: CheckInMenuProps) {
  const [showInput, setShowInput] = useState(false);
  const [message, setMessage] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset state when menu closes
  useEffect(() => {
    if (!isOpen) {
      setShowInput(false);
      setMessage("");
    }
  }, [isOpen]);

  // Auto-focus text input when revealed
  useEffect(() => {
    if (showInput) inputRef.current?.focus();
  }, [showInput]);

  // Click-outside and Escape to close (same pattern as MusicPopover)
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

  const handleQuickAction = (action: string) => {
    onCheckIn(action);
  };

  const handleSubmitUpdate = () => {
    const trimmed = message.trim();
    if (!trimmed) return;
    onCheckIn("update", trimmed);
  };

  return (
    <div
      className="absolute bottom-full left-1/2 mb-3 -translate-x-1/2 rounded-xl border border-[var(--color-border-default)] p-3 shadow-2xl"
      style={{
        background: "rgba(10,10,10,0.85)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        zIndex: 40,
        minWidth: 240,
        textShadow: "0 1px 4px rgba(0,0,0,0.5)",
        boxShadow:
          "0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06)",
      }}
      role="dialog"
      aria-label="Check in"
    >
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
        Check In
      </p>

      <div className="flex flex-col gap-0.5">
        <MenuItem
          icon={<TrendingUp {...ICON} className="text-[#5BC682]" />}
          onClick={() => handleQuickAction("progress")}
        >
          Making progress
        </MenuItem>

        <MenuItem
          icon={<Rocket {...ICON} className="text-[#F59E0B]" />}
          onClick={() => handleQuickAction("ship")}
        >
          Shipped something
        </MenuItem>

        <MenuItem
          icon={<RotateCcw {...ICON} className="text-[#F5C54E]" />}
          onClick={() => handleQuickAction("reset")}
        >
          Need a reset
        </MenuItem>
      </div>

      {/* Divider */}
      <div className="my-2 border-t border-[var(--color-border-subtle)]" />

      {!showInput ? (
        <MenuItem
          icon={<MessageSquare {...ICON} className="text-[#5CC2EC]" />}
          onClick={() => setShowInput(true)}
        >
          Share update
        </MenuItem>
      ) : (
        <div className="flex gap-1.5">
          <input
            ref={inputRef}
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSubmitUpdate();
            }}
            placeholder="What did you work on?"
            maxLength={120}
            className="flex-1 rounded-lg border border-[var(--color-border-default)] bg-white/[0.06] px-2.5 py-1.5 text-xs text-white placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-accent-primary)]/50 focus:outline-none"
          />
          <Button
            variant="primary"
            size="xs"
            onClick={handleSubmitUpdate}
            disabled={!message.trim()}
            className="rounded-lg"
          >
            Post
          </Button>
        </div>
      )}
    </div>
  );
}
