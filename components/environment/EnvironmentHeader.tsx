"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { UserPlus, ChevronDown, Check } from "lucide-react";
import { InvitePopover } from "@/components/session/InvitePopover";
import { getUserActiveParties, type Party } from "@/lib/parties";
import { getWorldConfig } from "@/lib/worlds";
import {
  getAllActiveBackgrounds,
  type ActiveBackground,
} from "@/lib/roomBackgrounds";
import { getUserTimeState } from "@/lib/timeOfDay";

interface EnvironmentHeaderProps {
  roomName: string;
  inviteCode: string | null;
  currentPartyId: string;
  userId: string | null;
}

export function EnvironmentHeader({
  roomName,
  inviteCode,
  currentPartyId,
  userId,
}: EnvironmentHeaderProps) {
  const router = useRouter();
  const inviteWrapperRef = useRef<HTMLDivElement>(null);
  const [inviteOpen, setInviteOpen] = useState(false);

  // ─── Party switcher state ─────────────────────────────
  const switcherRef = useRef<HTMLDivElement>(null);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [parties, setParties] = useState<Party[]>([]);
  const [partiesLoading, setPartiesLoading] = useState(false);
  const [backgrounds, setBackgrounds] = useState<Map<string, ActiveBackground>>(new Map());

  // Fetch parties each time the dropdown opens
  useEffect(() => {
    if (!switcherOpen || !userId) return;
    let cancelled = false;
    setPartiesLoading(true);
    const timeState = getUserTimeState();
    Promise.all([
      getUserActiveParties(userId),
      getAllActiveBackgrounds(timeState),
    ])
      .then(([p, bg]) => {
        if (!cancelled) {
          setParties(p);
          setBackgrounds(bg);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setPartiesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [switcherOpen, userId]);

  // Prefetch routes + background images once parties are loaded
  useEffect(() => {
    if (parties.length === 0) return;
    for (const p of parties) {
      if (p.id === currentPartyId) continue;
      router.prefetch(`/environment/${p.id}`);
      // Warm the browser image cache for AI backgrounds
      const aiBg = backgrounds.get(p.world_key);
      if (aiBg?.publicUrl) {
        const img = new window.Image();
        img.src = aiBg.publicUrl;
      }
    }
  }, [parties, backgrounds, currentPartyId, router]);

  // Click-outside + Escape to close switcher
  useEffect(() => {
    if (!switcherOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (
        switcherRef.current &&
        !switcherRef.current.contains(e.target as Node)
      ) {
        setSwitcherOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSwitcherOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [switcherOpen]);

  const handleSelectParty = useCallback(
    (partyId: string) => {
      if (partyId !== currentPartyId) {
        router.push(`/environment/${partyId}`);
      }
      setSwitcherOpen(false);
    },
    [currentPartyId, router]
  );

  return (
    <header className="relative z-10 -ml-24 flex items-center gap-3 py-4 pl-4 pr-4">
      {/* Room name + party switcher */}
      <div ref={switcherRef} className="relative">
        <button
          type="button"
          onClick={() => userId && setSwitcherOpen((o) => !o)}
          className={`flex items-center gap-1.5 text-lg font-semibold text-white ${userId ? "cursor-pointer rounded-lg px-1 -ml-1 transition-colors hover:bg-white/[0.06]" : ""}`}
          aria-expanded={switcherOpen}
          aria-haspopup="listbox"
          aria-label="Switch room"
        >
          {roomName}
          {userId && (
            <ChevronDown
              size={15}
              strokeWidth={2}
              className={`text-white/40 transition-transform duration-200 ${switcherOpen ? "rotate-180" : ""}`}
            />
          )}
        </button>

        {/* Party switcher dropdown */}
        {switcherOpen && (
          <div
            className="absolute left-0 top-full mt-2 overflow-hidden rounded-lg border border-[var(--color-border-default)] shadow-2xl"
            style={{
              background: "rgba(10,10,10,0.95)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              zIndex: 40,
              width: 280,
            }}
            role="listbox"
            aria-label="Switch room"
          >
            {/* Section title */}
            <p className="px-3 pt-2.5 pb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
              Available Rooms
            </p>

            {/* Loading */}
            {partiesLoading && (
              <div className="flex items-center justify-center py-6">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-transparent" />
              </div>
            )}

            {/* Empty */}
            {!partiesLoading && parties.length === 0 && (
              <p className="px-4 py-5 text-center text-xs text-[var(--color-text-tertiary)]">
                No other active rooms
              </p>
            )}

            {/* Party list */}
            {!partiesLoading &&
              parties.map((p, i) => {
                const isCurrent = p.id === currentPartyId;
                const world = getWorldConfig(p.world_key);
                const switcherThumb = backgrounds.get(p.world_key)?.thumbUrl ?? null;
                return (
                  <div key={p.id}>
                    {i > 0 && (
                      <div className="border-t border-white/[0.06]" />
                    )}
                    <button
                      type="button"
                      role="option"
                      aria-selected={isCurrent}
                      onClick={() => handleSelectParty(p.id)}
                      className={`flex w-full cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors ${
                        isCurrent
                          ? "bg-white/[0.04]"
                          : "hover:bg-white/[0.04]"
                      }`}
                    >
                      {/* Thumbnail */}
                      {switcherThumb ? (
                        <Image
                          src={switcherThumb}
                          alt={p.name}
                          width={44}
                          height={44}
                          className="h-11 w-11 shrink-0 rounded-md object-cover"
                        />
                      ) : (
                        <div
                          className="h-11 w-11 shrink-0 rounded-md"
                          style={{ background: world.placeholderGradient }}
                        />
                      )}
                      {/* Text */}
                      <div className="min-w-0 flex-1 text-left">
                        <p className={`truncate text-sm font-medium ${isCurrent ? "text-white" : "text-[var(--color-text-secondary)]"}`}>
                          {p.name}
                        </p>
                        <p className="truncate text-[11px] text-[var(--color-text-tertiary)]">
                          {world.description}
                        </p>
                      </div>
                      {/* Check for current */}
                      {isCurrent && (
                        <Check
                          size={14}
                          strokeWidth={2}
                          className="shrink-0 text-white/50"
                        />
                      )}
                    </button>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Invite button + popover */}
      <div ref={inviteWrapperRef} className="relative">
        <button
          type="button"
          onClick={() => setInviteOpen((v) => !v)}
          className="flex cursor-pointer items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/15"
          style={{ border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.08)" }}
          aria-label="Invite to party"
          aria-expanded={inviteOpen}
        >
          <UserPlus size={15} strokeWidth={2} />
          Invite
        </button>

        <InvitePopover
          isOpen={inviteOpen}
          onClose={() => setInviteOpen(false)}
          wrapperRef={inviteWrapperRef}
          inviteCode={inviteCode}
          position="below"
          align="right"
        />
      </div>
    </header>
  );
}
