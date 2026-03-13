"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { UserPlus, ChevronDown, Check, DoorOpen } from "lucide-react";
import { InvitePopover } from "@/components/session/InvitePopover";
import { listDiscoverableParties, joinParty, type PartyWithCount } from "@/lib/parties";
import type { JoinConfig } from "@/components/party/JoinRoomModal";
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
  displayName: string;
}

export function EnvironmentHeader({
  roomName,
  inviteCode,
  currentPartyId,
  userId,
  displayName,
}: EnvironmentHeaderProps) {
  const router = useRouter();
  const inviteWrapperRef = useRef<HTMLDivElement>(null);
  const [inviteOpen, setInviteOpen] = useState(false);

  // ─── Party switcher state ─────────────────────────────
  const switcherRef = useRef<HTMLDivElement>(null);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [parties, setParties] = useState<PartyWithCount[]>([]);
  const [backgrounds, setBackgrounds] = useState<Map<string, ActiveBackground>>(new Map());
  const hasFetchedRef = useRef(false);
  const [initialLoading, setInitialLoading] = useState(false);

  // Prefetch parties eagerly on mount so data is ready when user clicks
  useEffect(() => {
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;
    const timeState = getUserTimeState();
    Promise.all([
      listDiscoverableParties(),
      getAllActiveBackgrounds(timeState),
    ])
      .then(([p, bg]) => {
        setParties(p);
        setBackgrounds(bg);
      })
      .catch((err) => console.error("Failed to prefetch party switcher data:", err));
  }, []);

  // On open: show cached data immediately, refresh in background
  useEffect(() => {
    if (!switcherOpen) return;
    let cancelled = false;

    // If we've never fetched yet, show loading state
    if (!hasFetchedRef.current) {
      setInitialLoading(true);
      hasFetchedRef.current = true;
    }

    const timeState = getUserTimeState();
    Promise.all([
      listDiscoverableParties(),
      getAllActiveBackgrounds(timeState),
    ])
      .then(([p, bg]) => {
        if (!cancelled) {
          setParties(p);
          setBackgrounds(bg);
        }
      })
      .catch((err) => console.error("Failed to load party switcher data:", err))
      .finally(() => {
        if (!cancelled) setInitialLoading(false);
      });
    return () => { cancelled = true; };
  }, [switcherOpen]);

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
    async (partyId: string) => {
      setSwitcherOpen(false);
      if (partyId === currentPartyId) return;

      // Ensure participant record exists so the room page
      // doesn't show the join modal as if we're a new visitor.
      if (userId) {
        try {
          await joinParty(partyId, userId, displayName);
        } catch (err) {
          console.error("Failed to pre-join room:", err);
        }

        // Store a minimal join config so the environment page
        // skips the join modal and enters the countdown directly.
        const config: JoinConfig = {
          taskId: null,
          goalId: null,
          goalText: "",
          durationSec: 25 * 60,
          autoStart: false,
          commitmentType: "personal",
          musicAutoPlay: false,
        };
        sessionStorage.setItem("fp_join_config", JSON.stringify(config));
      }

      router.push(`/environment/${partyId}`);
    },
    [currentPartyId, userId, displayName, router]
  );

  const showLoading = initialLoading && parties.length === 0;

  return (
    <header className="relative z-10 -ml-24 flex items-center gap-3 py-4 pl-4 pr-4">
      {/* Room name + party switcher */}
      <div ref={switcherRef} className="relative">
        <button
          type="button"
          onClick={() => userId && setSwitcherOpen((o) => !o)}
          className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-white transition-colors ${userId ? "cursor-pointer hover:bg-white/15" : ""}`}
          style={{ border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.08)" }}
          aria-expanded={switcherOpen}
          aria-haspopup="listbox"
          aria-label="Switch room"
        >
          <DoorOpen size={15} strokeWidth={2} />
          {roomName}
          {userId && (
            <ChevronDown
              size={14}
              strokeWidth={2}
              className={`text-white/40 transition-transform duration-200 ${switcherOpen ? "rotate-180" : ""}`}
            />
          )}
        </button>

        {/* Party switcher dropdown */}
        {switcherOpen && (
          <div
            className="absolute left-0 top-full mt-2 overflow-y-auto rounded-xl border border-white/[0.08]"
            style={{
              background: "rgba(10,10,10,0.90)",
              backdropFilter: "blur(24px)",
              WebkitBackdropFilter: "blur(24px)",
              boxShadow: "var(--shadow-float)",
              zIndex: 40,
              width: 280,
              maxHeight: "min(420px, calc(100vh - 100px))",
              animation: "fp-dropdown-enter 0.18s cubic-bezier(0.16, 1, 0.3, 1) forwards",
              transformOrigin: "top left",
            }}
            role="listbox"
            aria-label="Switch room"
          >
            {/* Section title */}
            <p className="px-3 pt-2.5 pb-1 text-2xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
              Available Rooms
            </p>

            {/* Loading skeleton — matches party row layout for zero shift */}
            {showLoading && (
              <div className="pb-2">
                {[0, 1].map((i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-2.5">
                    <div className="h-11 w-11 shrink-0 animate-pulse rounded-md bg-white/[0.06]" />
                    <div className="flex flex-1 flex-col gap-1.5">
                      <div className="h-3.5 w-24 animate-pulse rounded bg-white/[0.06]" />
                      <div className="h-2.5 w-16 animate-pulse rounded bg-white/[0.04]" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Empty */}
            {!showLoading && parties.length === 0 && (
              <p className="px-4 py-5 text-center text-xs text-[var(--color-text-tertiary)]">
                No other active rooms
              </p>
            )}

            {/* Party list */}
            {!showLoading &&
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
                      {/* Thumbnail — gradient placeholder behind image prevents flash */}
                      <div
                        className="h-11 w-11 shrink-0 overflow-hidden rounded-md"
                        style={{ background: world.placeholderGradient }}
                      >
                        {switcherThumb && (
                          <Image
                            src={switcherThumb}
                            alt={p.name}
                            width={44}
                            height={44}
                            className="h-full w-full object-cover"
                          />
                        )}
                      </div>
                      {/* Text */}
                      <div className="min-w-0 flex-1 text-left">
                        <p className={`truncate text-sm font-medium ${isCurrent ? "text-white" : "text-[var(--color-text-secondary)]"}`}>
                          {p.name}
                        </p>
                        <p className="truncate text-2xs text-[var(--color-text-tertiary)]">
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
