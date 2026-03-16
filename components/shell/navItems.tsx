"use client";

/**
 * Shared nav config for Hub sidebar and session menu drawer.
 * Practice is the app home. Icons: Users (practice), Target (goals), BarChart3 (stats), Settings.
 */

import { BarChart3, BookOpen, Target, Settings, Users, type LucideIcon } from "lucide-react";

const NAV_ICON_SIZE = 20;

export const NAV_ITEMS: Array<{
  id: string;
  href: string;
  label: string;
  icon: LucideIcon;
}> = [
  { id: "learn", href: "/learn", label: "Learn", icon: BookOpen },
  { id: "practice", href: "/practice", label: "Practice", icon: Users },
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
