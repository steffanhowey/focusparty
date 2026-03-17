"use client";

import { type RefObject, useEffect, useState } from "react";
import { Link2, Check, Copy } from "lucide-react";
import { useNotification } from "@/components/providers/NotificationProvider";
import { useCurrentUser } from "@/lib/useCurrentUser";

interface InvitePopoverProps {
  isOpen: boolean;
  onClose: () => void;
  wrapperRef: RefObject<HTMLDivElement | null>;
  inviteCode: string | null;
  /** Open above (default, for bottom action bar) or below (for top header) */
  position?: "above" | "below";
  /** Horizontal alignment: center (default) or right-aligned to trigger */
  align?: "center" | "right";
}

export function InvitePopover({
  isOpen,
  onClose,
  wrapperRef,
  inviteCode,
  position = "above",
  align = "center",
}: InvitePopoverProps) {
  const { showToast } = useNotification();
  const { userId } = useCurrentUser();
  const [copied, setCopied] = useState(false);

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

  // Reset copied state when popover closes
  useEffect(() => {
    if (!isOpen) setCopied(false);
  }, [isOpen]);

  if (!isOpen) return null;

  const joinUrl =
    typeof window !== "undefined" && inviteCode
      ? `${window.location.origin}/i/${inviteCode}${userId ? `?from=${userId}` : ""}`
      : null;

  const handleCopy = async () => {
    if (!joinUrl) return;
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      showToast({
        type: "success",
        title: "Link copied!",
        message: "Share it with friends to invite them.",
        duration: 3000,
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast({
        type: "error",
        title: "Copy failed",
        message: "Your browser blocked clipboard access.",
        duration: 4000,
      });
    }
  };

  return (
    <div
      className={`absolute rounded-xl border border-[var(--color-border-default)] p-3 shadow-lg ${
        position === "below" ? "top-full mt-3" : "bottom-full mb-3"
      } ${align === "right" ? "right-0" : "left-1/2 -translate-x-1/2"}`}
      style={{
        background: "rgba(15,35,24,0.65)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        zIndex: 40,
        minWidth: 280,
        boxShadow: "var(--shadow-float)",
      }}
      role="dialog"
      aria-label="Invite to party"
    >
      {inviteCode && joinUrl ? (
        <>
          <p className="mb-2 text-2xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
            Invite Link
          </p>
          <div className="flex gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg bg-white/[0.06] px-3 py-2">
              <Link2
                size={14}
                className="shrink-0 text-[var(--color-text-tertiary)]"
              />
              <span className="truncate text-xs text-[var(--color-text-secondary)]">
                {typeof window !== "undefined" ? `${window.location.host}/i/${inviteCode}` : ""}
              </span>
            </div>
            <button
              type="button"
              onClick={handleCopy}
              className="flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg bg-[var(--sg-forest-500)] px-3 text-xs font-medium text-white transition-all hover:brightness-110"
            >
              {copied ? (
                <>
                  <Check size={14} />
                  Copied
                </>
              ) : (
                <>
                  <Copy size={14} />
                  Copy
                </>
              )}
            </button>
          </div>
        </>
      ) : (
        <div className="py-2 text-center">
          <p className="text-sm font-medium text-[var(--color-text-secondary)]">
            No active party
          </p>
          <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
            Create a party from the hub to invite friends.
          </p>
        </div>
      )}
    </div>
  );
}
