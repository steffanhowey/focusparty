"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useRef, useState, useEffect } from "react";
import { ChevronDown, ChevronUp, CreditCard, Settings, LogOut, LogIn } from "lucide-react";
import { Logo } from "./Logo";
import { MenuItem } from "@/components/ui/MenuItem";
import { useAuth } from "@/components/providers/AuthProvider";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { useDiscoverableParties } from "@/lib/useDiscoverableParties";
import { getCanonicalRoomEntryRoute } from "@/lib/appRoutes";
import {
  getLaunchRoomCatalogEntries,
  getPartyLaunchRoomKey,
  isPartyLaunchVisible,
} from "@/lib/launchRooms";
import type { PartyWithCount } from "@/lib/parties";

import { CLIENT_NAV_HREFS, NAV_ITEMS, NavIcon } from "./navItems";
import { PLAN_LABELS, STUB_PLAN } from "@/lib/constants";

const SIDEBAR_WIDTH_EXPANDED = "w-56";
const SIDEBAR_WIDTH_RAILS = "w-14 md:w-18";
const RAILS_INSET_X = "px-2 md:px-4";

/** Shared vertical rhythm tokens (used in both expanded and rails). */
const NAV_ITEM_GAP = "gap-1.5";
const BOTTOM_PAD = "pb-5";
const DEFAULT_QUICK_ROOM_COUNT = 3;
const COWORKING_LABEL = "Cowork";
const ROOMS_TRAILING_SLOT_CLASS = "ml-auto flex w-6 shrink-0 justify-end";
const ROOMS_SUBMENU_RIGHT_PAD_CLASS = "pr-[calc(0.75rem+0.625rem)]";
const ROOMS_PRESENCE_SLOT_CLASS =
  "ml-auto flex w-14 shrink-0 justify-end text-right text-[11px] text-[var(--sg-shell-400)] tabular-nums";

interface SidebarProps {
  collapsed?: boolean;
  onNavClick?: (href: string) => void;
}

interface SidebarQuickRoom {
  key: string;
  href: string;
  name: string;
  presenceLabel: string | null;
}

const PROFILE_MENU_STYLE = {
  background: "var(--sg-white)",
  border: "1px solid var(--sg-shell-border)",
};

export function Sidebar({ collapsed = false, onNavClick }: SidebarProps) {
  const pathname = usePathname();
  const { authState, signOut } = useAuth();
  const { displayName: rawDisplayName, username, avatarUrl } = useCurrentUser();
  const { parties, loading: roomsLoading } = useDiscoverableParties();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [roomsOpen, setRoomsOpen] = useState(true);
  const profileRef = useRef<HTMLDivElement>(null);

  const displayName = rawDisplayName
    .split(/[\s._-]+/)
    .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
  const planLabel = PLAN_LABELS[STUB_PLAN];

  const activeId =
    NAV_ITEMS.find(
      (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
    )?.id ?? null;

  const quickRooms = useMemo<SidebarQuickRoom[]>(() => {
    const launchRoomPartyByKey = new Map<string, PartyWithCount>();

    for (const party of parties) {
      if (!party.persistent || !isPartyLaunchVisible(party)) continue;
      const roomKey = getPartyLaunchRoomKey(party);
      if (!roomKey || launchRoomPartyByKey.has(roomKey)) continue;
      launchRoomPartyByKey.set(roomKey, party);
    }

    return getLaunchRoomCatalogEntries().map((room) => {
      const party = launchRoomPartyByKey.get(room.key) ?? null;
      const participantCount =
        typeof party?.participant_count === "number" && party.participant_count > 0
          ? party.participant_count
          : null;

      return {
        key: room.key,
        href: party ? getCanonicalRoomEntryRoute(party) : "/rooms",
        name: room.name,
        presenceLabel: roomsLoading
          ? null
          : participantCount !== null
            ? `${participantCount} live`
            : "Open",
      };
    });
  }, [parties, roomsLoading]);

  useEffect(() => {
    if (!profileMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [profileMenuOpen]);

  useEffect(() => {
    if (pathname === "/rooms" || pathname.startsWith("/rooms/")) {
      setRoomsOpen(true);
    }
  }, [pathname]);

  const isAuthenticated = authState === "authenticated";
  const isRoomsRoute = pathname === "/rooms" || pathname.startsWith("/rooms/");

  const handleNavHref = (
    event: React.MouseEvent<HTMLAnchorElement>,
    href: string,
  ) => {
    if (!onNavClick || !CLIENT_NAV_HREFS.has(href)) return;
    event.preventDefault();
    onNavClick(href);
  };

  const profileMenuItems = (
    <>
      <MenuItem
        size="default"
        icon={<CreditCard size={18} strokeWidth={1.8} />}
        onClick={() => {
          setProfileMenuOpen(false);
          if (onNavClick) onNavClick("/settings");
        }}
        className="text-[var(--sg-shell-900)]"
      >
        Plans & Billing
      </MenuItem>
      <MenuItem
        size="default"
        icon={<Settings size={18} strokeWidth={1.8} />}
        onClick={() => {
          setProfileMenuOpen(false);
          if (onNavClick) onNavClick("/settings");
        }}
        className="text-[var(--sg-shell-900)]"
      >
        Settings
      </MenuItem>
      {isAuthenticated ? (
        <MenuItem
          size="default"
          icon={<LogOut size={18} strokeWidth={1.8} />}
          danger
          onClick={() => {
            setProfileMenuOpen(false);
            signOut();
          }}
        >
          Sign out
        </MenuItem>
      ) : (
        <Link
          href="/login"
          onClick={() => setProfileMenuOpen(false)}
          className="flex w-full items-center gap-3 px-3 py-2 text-sm font-medium text-[var(--sg-forest-500)] transition-colors hover:bg-[var(--sg-shell-100)]"
        >
          <LogIn size={18} strokeWidth={1.8} />
          <span>Sign in</span>
        </Link>
      )}
    </>
  );

  const sidebarWidth = collapsed ? SIDEBAR_WIDTH_RAILS : SIDEBAR_WIDTH_EXPANDED;
  const asideClass = `${sidebarWidth} relative z-[var(--z-card)] flex h-screen flex-shrink-0 flex-col overflow-visible transition-[width] duration-200 ease-out`;

  return (
    <aside className={`${asideClass}`} style={{ background: "var(--sg-shell-50)", borderRight: "1px solid var(--sg-shell-border)" }}>
      {collapsed ? (
        <div className={`flex min-h-0 flex-1 flex-col ${RAILS_INSET_X} pt-4`}>
          <nav className={`flex shrink-0 flex-col items-center ${NAV_ITEM_GAP}`}>
            {NAV_ITEMS.map((item) => {
              const isActive = activeId === item.id;
              const displayLabel =
                item.id === "rooms" ? COWORKING_LABEL : item.label;
              return (
                <a
                  key={item.id}
                  href={item.href}
                  onClick={(e) => {
                    if (onNavClick) {
                      e.preventDefault();
                      onNavClick(item.href);
                    }
                  }}
                  className={`flex h-10 min-h-10 w-10 min-w-10 shrink-0 items-center justify-center rounded-lg border-l-2 transition-all duration-150 ${isActive ? "border-[var(--sg-forest-500)] bg-[var(--sg-forest-500)]/8" : "border-transparent"}`}
                  style={{
                    color: isActive ? "var(--sg-shell-900)" : "var(--sg-shell-500)",
                  }}
                  aria-current={isActive ? "page" : undefined}
                  title={displayLabel}
                >
                  <NavIcon icon={item.icon} />
                </a>
              );
            })}
          </nav>
          <div ref={profileRef} className={`relative mt-auto flex shrink-0 flex-col items-center gap-3 ${BOTTOM_PAD}`}>
            {profileMenuOpen && (
              <div
                className="absolute bottom-full left-1/2 z-[var(--z-dropdown)] mb-1 w-48 -translate-x-1/2 overflow-hidden rounded-lg shadow-lg"
                style={PROFILE_MENU_STYLE}
              >
                {profileMenuItems}
              </div>
            )}
            <button
              type="button"
              onClick={() => setProfileMenuOpen((o) => !o)}
              className="flex shrink-0"
              aria-expanded={profileMenuOpen}
              aria-haspopup="true"
              aria-label="Profile menu"
              title={username ? `@${username}` : `${displayName} · ${planLabel}`}
            >
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  alt=""
                  className="h-9 w-9 shrink-0 rounded-full object-cover"
                  style={{ border: "1px solid var(--sg-shell-border)" }}
                />
              ) : (
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-semibold"
                  style={{
                    background: "var(--sg-shell-100)",
                    border: "1px solid var(--sg-shell-border)",
                    color: "var(--sg-shell-900)",
                    fontSize: 14,
                  }}
                >
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex h-14 shrink-0 items-center px-4">
            <Logo href="/missions" height={22} maxWidth={120} />
          </div>
          <nav className={`flex flex-col ${NAV_ITEM_GAP} px-3 pt-2`}>
            {NAV_ITEMS.map((item) => {
              const isActive = activeId === item.id;
              const displayLabel =
                item.id === "rooms" ? COWORKING_LABEL : item.label;

              if (item.id === "rooms") {
                return (
                  <div key={item.id} className="-mx-3">
                    <button
                      type="button"
                      onClick={() => setRoomsOpen((open) => !open)}
                      className={`flex h-12 w-full cursor-pointer items-center gap-3 border-l-2 px-[calc(0.75rem+0.625rem)] text-left transition-all duration-150 ${
                        isActive ? "border-[var(--sg-forest-500)] bg-[var(--sg-forest-500)]/8" : "border-transparent"
                      }`}
                      style={{
                        color: isActive ? "var(--sg-shell-900)" : "var(--sg-shell-500)",
                      }}
                      aria-expanded={roomsOpen}
                      aria-controls="sidebar-rooms-quickstart"
                    >
                      <NavIcon icon={item.icon} />
                      <span className="min-w-0 flex-1 text-sm font-medium">
                        {displayLabel}
                      </span>
                      <span className={ROOMS_TRAILING_SLOT_CLASS}>
                        <ChevronDown
                          size={16}
                          strokeWidth={1.8}
                          className={`transition-transform duration-150 ${
                            roomsOpen ? "rotate-180" : ""
                          }`}
                        />
                      </span>
                    </button>

                    {roomsOpen ? (
                      <div
                        id="sidebar-rooms-quickstart"
                        className="ml-7 mt-1 flex flex-col gap-0.5 border-l border-[var(--sg-shell-border)] pl-3"
                      >
                        {quickRooms.slice(0, DEFAULT_QUICK_ROOM_COUNT).map((room) => {
                          return (
                            <Link
                              key={room.key}
                              href={room.href}
                              onClick={(event) => handleNavHref(event, room.href)}
                              className={`flex min-h-8 items-center gap-2 rounded-md pl-2 text-xs transition-colors hover:bg-[var(--sg-shell-100)] ${ROOMS_SUBMENU_RIGHT_PAD_CLASS}`}
                              style={{
                                color: "var(--sg-shell-600)",
                              }}
                            >
                              <span className="min-w-0 flex-1 truncate">
                                {room.name}
                              </span>
                              {room.presenceLabel !== null ? (
                                <span className={ROOMS_PRESENCE_SLOT_CLASS}>
                                  {room.presenceLabel}
                                </span>
                              ) : (
                                <span className={ROOMS_PRESENCE_SLOT_CLASS}>
                                  <span
                                    className="h-3 w-10 animate-pulse rounded-full"
                                    style={{
                                      background: "var(--sg-shell-200)",
                                    }}
                                  />
                                </span>
                              )}
                            </Link>
                          );
                        })}

                        <a
                          href="/rooms"
                          onClick={(event) => handleNavHref(event, "/rooms")}
                          className={`mt-1 flex min-h-8 items-center rounded-md pl-2 text-xs font-medium transition-colors hover:bg-[var(--sg-shell-100)] ${ROOMS_SUBMENU_RIGHT_PAD_CLASS} ${
                            isRoomsRoute ? "bg-[var(--sg-shell-100)]" : ""
                          }`}
                          style={{
                            color: isRoomsRoute
                              ? "var(--sg-shell-900)"
                              : "var(--sg-shell-600)",
                          }}
                        >
                          View all
                        </a>
                      </div>
                    ) : null}
                  </div>
                );
              }

              return (
                <a
                  key={item.id}
                  href={item.href}
                  onClick={(event) => handleNavHref(event, item.href)}
                  className={`-mx-3 flex h-12 items-center gap-3 border-l-2 px-[calc(0.75rem+0.625rem)] transition-all duration-150 ${isActive ? "border-[var(--sg-forest-500)] bg-[var(--sg-forest-500)]/8" : "border-transparent"}`}
                  style={{
                    color: isActive ? "var(--sg-shell-900)" : "var(--sg-shell-500)",
                  }}
                  aria-current={isActive ? "page" : undefined}
                >
                  <NavIcon icon={item.icon} />
                  <span className="text-sm font-medium">
                    {displayLabel}
                  </span>
                </a>
              );
            })}
          </nav>
          <div ref={profileRef} className={`relative mt-auto flex flex-col gap-3 ${BOTTOM_PAD} px-3`}>
            {profileMenuOpen && (
              <div
                className="absolute bottom-full left-0 right-0 z-[var(--z-dropdown)] mb-2 overflow-hidden rounded-lg shadow-lg"
                style={PROFILE_MENU_STYLE}
              >
                {profileMenuItems}
              </div>
            )}
            <button
              type="button"
              onClick={() => setProfileMenuOpen((o) => !o)}
              className="flex w-full items-center gap-3 rounded-lg py-1.5 pl-1 pr-2"
              aria-expanded={profileMenuOpen}
              aria-haspopup="true"
              aria-label="Profile menu"
            >
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  alt=""
                  className="h-9 w-9 shrink-0 rounded-full object-cover"
                  style={{ border: "1px solid var(--sg-shell-border)" }}
                />
              ) : (
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-semibold"
                  style={{
                    background: "var(--sg-shell-100)",
                    border: "1px solid var(--sg-shell-border)",
                    color: "var(--sg-shell-900)",
                    fontSize: 14,
                  }}
                >
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1 text-left">
                <p className="truncate text-sm font-medium text-[var(--sg-shell-900)]">
                  {displayName}
                </p>
                <p className="truncate text-xs font-medium text-[var(--sg-shell-500)]">
                  {username ? `@${username}` : planLabel}
                </p>
              </div>
              <span className="shrink-0 text-[var(--sg-shell-500)]">
                {profileMenuOpen ? <ChevronUp size={16} strokeWidth={2} /> : <ChevronDown size={16} strokeWidth={2} />}
              </span>
            </button>
          </div>
        </>
      )}
    </aside>
  );
}
