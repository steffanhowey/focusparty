import type {
  AchievementRecord,
  AchievementSummary,
  SkillReceipt,
} from "@/lib/types";

export const ACHIEVEMENT_SUMMARY_SELECT =
  "id, path_id, path_title, path_topics, items_completed, time_invested_seconds, difficulty_level, completed_at, share_slug";

export const ACHIEVEMENT_RECORD_SELECT = `${ACHIEVEMENT_SUMMARY_SELECT}, user_id, progress_id, skill_receipt`;

/** Generate a URL-friendly achievement share slug. */
export function generateAchievementShareSlug(
  displayName: string | null,
  topics: string[],
): string {
  const namePart = (displayName ?? "learner")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 12);

  const topicPart = (topics[0] ?? "skill")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 20);

  const rand = Math.random().toString(36).slice(2, 6);
  return `${namePart}-${topicPart}-${rand}`;
}

/** Map a raw achievement row to a public summary. */
export function mapAchievementSummaryRow(
  row: Record<string, unknown>,
): AchievementSummary {
  return {
    id: row.id as string,
    path_id: row.path_id as string,
    path_title: row.path_title as string,
    path_topics: (row.path_topics as string[]) ?? [],
    items_completed: (row.items_completed as number) ?? 0,
    time_invested_seconds: (row.time_invested_seconds as number) ?? 0,
    difficulty_level: (row.difficulty_level as string) ?? null,
    completed_at: row.completed_at as string,
    share_slug: row.share_slug as string,
  };
}

/** Map a raw achievement row to the full record used on public pages. */
export function mapAchievementRecordRow(
  row: Record<string, unknown>,
): AchievementRecord {
  return {
    ...mapAchievementSummaryRow(row),
    user_id: row.user_id as string,
    progress_id: (row.progress_id as string) ?? null,
    skill_receipt: (row.skill_receipt as SkillReceipt) ?? null,
  };
}

/** Format invested time for UI and metadata. */
export function formatAchievementDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const remainderMinutes = minutes % 60;
  return remainderMinutes ? `${hours}h ${remainderMinutes}m` : `${hours}h`;
}

/** Format a completion date in a human-readable way. */
export function formatAchievementDate(
  date: string,
  variant: "long" | "short" = "long",
): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: variant === "long" ? "long" : "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Count how many skills leveled up in a receipt. */
export function getAchievementLevelUpCount(
  receipt: SkillReceipt | null | undefined,
): number {
  return receipt?.skills.filter((entry) => entry.leveled_up).length ?? 0;
}

/** Return primary skills first for card headlines and social previews. */
export function getAchievementHighlightedSkills(
  receipt: SkillReceipt | null | undefined,
  limit = 3,
): string[] {
  if (!receipt?.skills?.length) return [];

  const sorted = [...receipt.skills].sort((a, b) => {
    if (a.relevance === "primary" && b.relevance !== "primary") return -1;
    if (a.relevance !== "primary" && b.relevance === "primary") return 1;
    if (a.leveled_up && !b.leveled_up) return -1;
    if (!a.leveled_up && b.leveled_up) return 1;
    return 0;
  });

  return sorted.slice(0, limit).map((entry) => entry.skill.name);
}

/** Resolve the public site URL for metadata and OG images. */
export function getSiteUrl(): string {
  const value =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.VERCEL_PROJECT_PRODUCTION_URL ??
    process.env.VERCEL_URL;

  if (!value) return "https://skillgap.ai";
  return value.startsWith("http") ? value : `https://${value}`;
}
