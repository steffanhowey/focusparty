import {
  BookOpen,
  Wind,
  Lightbulb,
  PersonStanding,
  type LucideIcon,
} from "lucide-react";

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
    color: "#8C55EF",
    subtitle: "Watch something useful",
    feedLabel: "learning",
  },
  {
    id: "reset",
    label: "Reset",
    icon: Wind,
    color: "#5CC2EC",
    subtitle: "Clear your head",
    feedLabel: "reset",
  },
  {
    id: "reflect",
    label: "Reflect",
    icon: Lightbulb,
    color: "#F5C54E",
    subtitle: "Reconnect to what matters",
    feedLabel: "reflection",
  },
  {
    id: "move",
    label: "Move",
    icon: PersonStanding,
    color: "#5BC682",
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
