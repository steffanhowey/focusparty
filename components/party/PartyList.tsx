"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { PartyPopper } from "lucide-react";
import { createParty } from "@/lib/parties";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { useNotification } from "@/components/providers/NotificationProvider";

export function PartyList() {
  const router = useRouter();
  const { showToast } = useNotification();
  const { userId, displayName, requireAuth } = useCurrentUser();
  const [creating, setCreating] = useState(false);
  const [headerSlot, setHeaderSlot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setHeaderSlot(document.getElementById("hub-header-action"));
  }, []);

  const handleCreateParty = () => {
    if (creating) return;
    if (!requireAuth()) return;

    setCreating(true);

    // Navigate immediately — party creation fires in background
    router.push("/session");

    createParty(
      {
        creator_id: userId!,
        name: `${displayName}'s Party`,
        character: "ember",
        planned_duration_min: 25,
        max_participants: 3,
        status: "active",
      },
      displayName
    );
  };

  const joinButton = (
    <button
      type="button"
      onClick={handleCreateParty}
      disabled={creating}
      className="flex h-10 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full px-4 sm:px-5 disabled:cursor-not-allowed disabled:opacity-50"
      style={{
        background: "var(--color-accent-primary)",
        color: "white",
      }}
    >
      <PartyPopper size={18} strokeWidth={1.8} className="shrink-0" />
      <span className="hidden text-sm font-semibold sm:inline">
        {creating ? "Joining..." : "Join Party"}
      </span>
    </button>
  );

  return <>{headerSlot && createPortal(joinButton, headerSlot)}</>;
}
