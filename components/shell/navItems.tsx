"use client";

/**
 * Shared nav config for Hub sidebar and session menu drawer.
 * Parties is the app home. Icons: PartyPopper (parties), Flame (progress), Settings.
 */

import { Flame, ListTodo, PartyPopper, Settings, type LucideIcon } from "lucide-react";

const NAV_ICON_SIZE = 20;

export const NAV_ITEMS: Array<{
  id: string;
  href: string;
  label: string;
  icon: LucideIcon;
}> = [
  { id: "party", href: "/party", label: "Parties", icon: PartyPopper },
  { id: "tasks", href: "/tasks", label: "Tasks", icon: ListTodo },
  { id: "progress", href: "/progress", label: "Progress", icon: Flame },
  { id: "settings", href: "/settings", label: "Settings", icon: Settings },
];

/** Set of hrefs that support client-side tab switching (no server round-trip). */
export const CLIENT_NAV_HREFS = new Set(NAV_ITEMS.map((item) => item.href));

/** Render a nav icon with consistent size (for sidebar/drawer). */
export function NavIcon({ icon: Icon }: { icon: LucideIcon }) {
  return <Icon size={NAV_ICON_SIZE} strokeWidth={1.8} className="shrink-0" />;
}
