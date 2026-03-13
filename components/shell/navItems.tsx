"use client";

/**
 * Shared nav config for Hub sidebar and session menu drawer.
 * Rooms is the app home. Icons: DoorOpen (rooms), Target (goals), BarChart3 (stats), Settings.
 */

import { BarChart3, DoorOpen, Target, Settings, type LucideIcon } from "lucide-react";

const NAV_ICON_SIZE = 20;

export const NAV_ITEMS: Array<{
  id: string;
  href: string;
  label: string;
  icon: LucideIcon;
}> = [
  { id: "rooms", href: "/rooms", label: "Rooms", icon: DoorOpen },
  { id: "goals", href: "/goals", label: "Goals", icon: Target },
  { id: "stats", href: "/stats", label: "Stats", icon: BarChart3 },
  { id: "settings", href: "/settings", label: "Settings", icon: Settings },
];

/** Set of hrefs that support client-side tab switching (no server round-trip). */
export const CLIENT_NAV_HREFS = new Set(NAV_ITEMS.map((item) => item.href));

/** Render a nav icon with consistent size (for sidebar/drawer). */
export function NavIcon({ icon: Icon }: { icon: LucideIcon }) {
  return <Icon size={NAV_ICON_SIZE} strokeWidth={1.8} className="shrink-0" />;
}
