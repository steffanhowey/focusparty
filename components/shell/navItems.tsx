"use client";

/**
 * Shared nav config for Hub sidebar and session menu drawer.
 * Mission-first hub shell:
 * Missions → Progress → Rooms.
 */

import {
  PanelsTopLeft,
  Target,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

const NAV_ICON_SIZE = 20;

export const NAV_ITEMS: Array<{
  id: string;
  href: string;
  label: string;
  icon: LucideIcon;
}> = [
  { id: "missions", href: "/missions", label: "Missions", icon: Target },
  { id: "progress", href: "/progress", label: "Progress", icon: TrendingUp },
  { id: "rooms", href: "/rooms", label: "Rooms", icon: PanelsTopLeft },
];

/** Set of hrefs that support client-side tab switching (no server round-trip). */
export const CLIENT_NAV_HREFS = new Set([
  ...NAV_ITEMS.map((item) => item.href),
  "/settings",
]);

/** Render a nav icon with consistent size (for sidebar/drawer). */
export function NavIcon({ icon: Icon }: { icon: LucideIcon }) {
  return <Icon size={NAV_ICON_SIZE} strokeWidth={1.8} className="shrink-0" />;
}
