import type { AchievementSummary } from "@/lib/types";
import type { SkillReceipt, SkillReceiptEntry } from "@/lib/types/skills";

export interface EvidenceFocusSkill {
  name: string;
  domain: string;
  fluencyLevel: SkillReceiptEntry["after"]["fluency_level"];
  relevance: SkillReceiptEntry["relevance"];
  leveledUp: boolean;
  beforeLevel: SkillReceiptEntry["before"]["fluency_level"];
  afterLevel: SkillReceiptEntry["after"]["fluency_level"];
}

export interface EvidencePreviewTheme {
  surface: string;
  accent: string;
  chipSurface: string;
  chipText: string;
}

const PREVIEW_THEMES: EvidencePreviewTheme[] = [
  {
    surface:
      "linear-gradient(135deg, color-mix(in srgb, var(--sg-white) 78%, var(--sg-sage-100) 22%) 0%, color-mix(in srgb, var(--sg-white) 86%, var(--sg-cream-50) 14%) 100%)",
    accent: "var(--sg-forest-500)",
    chipSurface: "color-mix(in srgb, var(--sg-white) 62%, var(--sg-sage-100) 38%)",
    chipText: "var(--sg-shell-700)",
  },
  {
    surface:
      "linear-gradient(135deg, color-mix(in srgb, var(--sg-white) 76%, var(--sg-teal-100) 24%) 0%, color-mix(in srgb, var(--sg-white) 88%, var(--sg-sage-100) 12%) 100%)",
    accent: "var(--sg-teal-500)",
    chipSurface: "color-mix(in srgb, var(--sg-white) 66%, var(--sg-teal-100) 34%)",
    chipText: "var(--sg-shell-700)",
  },
  {
    surface:
      "linear-gradient(135deg, color-mix(in srgb, var(--sg-white) 76%, var(--sg-cream-50) 24%) 0%, color-mix(in srgb, var(--sg-white) 88%, var(--sg-gold-50) 12%) 100%)",
    accent: "var(--sg-gold-600)",
    chipSurface: "color-mix(in srgb, var(--sg-white) 72%, var(--sg-cream-50) 28%)",
    chipText: "var(--sg-shell-700)",
  },
];

function hashSeed(seed: string): number {
  let hash = 0;

  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) | 0;
  }

  return Math.abs(hash);
}

function formatTopicLabel(topic: string): string {
  return topic
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function joinReadable(values: string[]): string {
  if (values.length === 0) return "";
  if (values.length === 1) return values[0];
  if (values.length === 2) return `${values[0]} and ${values[1]}`;

  return `${values.slice(0, -1).join(", ")}, and ${values[values.length - 1]}`;
}

export function formatEvidenceDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatEvidenceShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function formatEvidenceDuration(seconds: number): string {
  if (seconds < 60) return "<1m";

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);

  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }

  return `${minutes}m`;
}

export function getEvidenceFocusSkills(
  receipt: SkillReceipt | null | undefined,
  limit = 3,
): EvidenceFocusSkill[] {
  const skills = receipt?.skills ?? [];
  const primary = skills.filter((entry) => entry.relevance === "primary");
  const selected = (primary.length > 0 ? primary : skills).slice(0, limit);

  return selected.map((entry) => ({
    name: entry.skill.name,
    domain: entry.skill.domain_name,
    fluencyLevel: entry.after.fluency_level,
    relevance: entry.relevance,
    leveledUp: entry.leveled_up,
    beforeLevel: entry.before.fluency_level,
    afterLevel: entry.after.fluency_level,
  }));
}

export function getEvidenceTopics(
  achievement: AchievementSummary,
  receipt: SkillReceipt | null | undefined,
  limit = 3,
): string[] {
  const focusSkills = getEvidenceFocusSkills(receipt, limit).map(
    (entry) => entry.name,
  );

  if (focusSkills.length > 0) {
    return focusSkills;
  }

  return achievement.path_topics.slice(0, limit).map(formatTopicLabel);
}

export function getEvidenceSummary(
  achievement: AchievementSummary,
  receipt: SkillReceipt | null | undefined,
  compact = false,
): string {
  const focusSkills = getEvidenceTopics(achievement, receipt, 2);

  if (compact) {
    if (focusSkills.length > 0) {
      return `Completed work showing ${joinReadable(focusSkills)}.`;
    }

    return "Completed work captured from the mission.";
  }

  if (focusSkills.length > 0) {
    return `Completed the work for this mission and captured clear proof in ${joinReadable(focusSkills)}.`;
  }

  return "Completed the work for this mission and captured the finished artifact.";
}

export function getEvidencePreviewTitle(
  achievement: AchievementSummary,
  receipt: SkillReceipt | null | undefined,
): string {
  const focusSkill = getEvidenceTopics(achievement, receipt, 1)[0];

  if (focusSkill) {
    return focusSkill;
  }

  return "Finished work";
}

export function getEvidenceSupportLine(
  achievement: AchievementSummary,
  receipt: SkillReceipt | null | undefined,
): string {
  const focusSkills = getEvidenceTopics(achievement, receipt, 2);

  if (focusSkills.length > 0) {
    return `Built through completed work in ${joinReadable(focusSkills)}.`;
  }

  return "Built through completed mission work.";
}

export function getEvidencePreviewTheme(seed: string): EvidencePreviewTheme {
  return PREVIEW_THEMES[hashSeed(seed) % PREVIEW_THEMES.length]!;
}

export function getStrengthenedSummary(
  receipt: SkillReceipt | null | undefined,
): string {
  const skills = receipt?.skills ?? [];
  if (skills.length === 0) {
    return "Capability detail will show here once the work maps cleanly to tracked skills.";
  }

  const leveledUpCount = skills.filter((entry) => entry.leveled_up).length;

  if (leveledUpCount > 0) {
    return leveledUpCount === 1
      ? "1 capability moved forward in this work."
      : `${leveledUpCount} capabilities moved forward in this work.`;
  }

  return skills.length === 1
    ? "1 tracked capability was practiced in this work."
    : `${skills.length} tracked capabilities were practiced in this work.`;
}
