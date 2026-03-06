"use client";

/**
 * Shared nav config for Hub sidebar and session menu drawer.
 * Icons chosen from Lucide for clarity and product fit:
 * - LayoutDashboard: overview at a glance (vs generic Home)
 * - Flame: progress and streaks (session history)
 * - PartyPopper: on-brand for Focus Party / social / invite
 * - Settings: universal settings recognition
 */

import { LayoutDashboard, Flame, PartyPopper, Settings, type LucideIcon } from "lucide-react";

const NAV_ICON_SIZE = 20;

export const NAV_ITEMS: Array<{
  id: string;
  href: string;
  label: string;
  icon: LucideIcon;
}> = [
  { id: "dashboard", href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "progress", href: "/progress", label: "Progress", icon: Flame },
  { id: "party", href: "/party", label: "Parties", icon: PartyPopper },
  { id: "settings", href: "/settings", label: "Settings", icon: Settings },
];

/** Render a nav icon with consistent size (for sidebar/drawer). */
export function NavIcon({ icon: Icon }: { icon: LucideIcon }) {
  return <Icon size={NAV_ICON_SIZE} strokeWidth={1.8} className="shrink-0" />;
}
