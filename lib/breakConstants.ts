import {
  BookOpen,
  Wind,
  Lightbulb,
  PersonStanding,
  type LucideIcon,
} from "lucide-react";
import { NAVY_500 } from "./palette";

// ─── Break Category Type ─────────────────────────────────────

export type BreakCategory = "learning" | "reset" | "reflect" | "move";

// ─── Category Configuration ──────────────────────────────────

export interface BreakCategoryConfig {
  id: BreakCategory;
  label: string;
  icon: LucideIcon;
  color: string;
  subtitle: string;
  /** Label used in activity feed: "took a {feedLabel} break" */
  feedLabel: string;
}

export const BREAK_CATEGORIES: BreakCategoryConfig[] = [
  {
    id: "learning",
    label: "Learning",
    icon: BookOpen,
    color: NAVY_500,
    subtitle: "Watch something useful",
    feedLabel: "learning",
  },
  {
    id: "reset",
    label: "Reset",
    icon: Wind,
    color: NAVY_500,
    subtitle: "Clear your head",
    feedLabel: "reset",
  },
  {
    id: "reflect",
    label: "Reflect",
    icon: Lightbulb,
    color: NAVY_500,
    subtitle: "Reconnect to what matters",
    feedLabel: "reflection",
  },
  {
    id: "move",
    label: "Move",
    icon: PersonStanding,
    color: NAVY_500,
    subtitle: "Get your body moving",
    feedLabel: "movement",
  },
];

export const BREAK_CATEGORY_MAP: Record<BreakCategory, BreakCategoryConfig> =
  Object.fromEntries(BREAK_CATEGORIES.map((c) => [c.id, c])) as Record<
    BreakCategory,
    BreakCategoryConfig
  >;

/** Map from category id → feed label for activity event rendering */
export const CATEGORY_FEED_LABEL: Record<string, string> = Object.fromEntries(
  BREAK_CATEGORIES.map((c) => [c.id, c.feedLabel])
);
