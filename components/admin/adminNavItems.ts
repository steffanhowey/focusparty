"use client";

import {
  LayoutDashboard,
  Users,
  DoorOpen,
  Image,
  Activity,
  Bot,
  Settings,
  type LucideIcon,
} from "lucide-react";

export const ADMIN_NAV_ITEMS: Array<{
  id: string;
  href: string;
  label: string;
  icon: LucideIcon;
}> = [
  { id: "dashboard", href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { id: "users", href: "/admin/users", label: "Users", icon: Users },
  { id: "rooms", href: "/admin/rooms", label: "Rooms", icon: DoorOpen },
  { id: "backgrounds", href: "/admin/backgrounds", label: "Backgrounds", icon: Image },
  { id: "activity", href: "/admin/activity", label: "Activity", icon: Activity },
  { id: "synthetics", href: "/admin/synthetics", label: "Synthetics", icon: Bot },
  { id: "settings", href: "/admin/settings", label: "Settings", icon: Settings },
];

/** Set of hrefs that support client-side tab switching. */
export const ADMIN_NAV_HREFS = new Set(ADMIN_NAV_ITEMS.map((item) => item.href));
