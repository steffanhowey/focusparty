"use client";

import {
  LayoutDashboard,
  Users,
  Image,
  Activity,
  Bot,
  Settings,
  Gauge,
  ClipboardCheck,
  Flame,
  Film,
  UserCircle,
  BarChart3,
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
  { id: "practice", href: "/admin/rooms", label: "Practice", icon: Users },
  { id: "pipeline", href: "/admin/pipeline", label: "Pipeline", icon: Gauge },
  { id: "review", href: "/admin/review", label: "Review Queue", icon: ClipboardCheck },
  { id: "topics", href: "/admin/topics", label: "Topics", icon: Flame },
  { id: "content", href: "/admin/content", label: "Content", icon: Film },
  { id: "creators", href: "/admin/creators", label: "Creators", icon: UserCircle },
  { id: "analytics", href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { id: "backgrounds", href: "/admin/backgrounds", label: "Backgrounds", icon: Image },
  { id: "activity", href: "/admin/activity", label: "Activity", icon: Activity },
  { id: "synthetics", href: "/admin/synthetics", label: "Synthetics", icon: Bot },
  { id: "settings", href: "/admin/settings", label: "Settings", icon: Settings },
];

/** Set of hrefs that support client-side tab switching. */
export const ADMIN_NAV_HREFS = new Set(ADMIN_NAV_ITEMS.map((item) => item.href));
