import type { SkillReceipt } from "./skills";

/** Public achievement summary used in UI and route responses. */
export interface AchievementSummary {
  id: string;
  path_id: string;
  path_title: string;
  path_topics: string[];
  items_completed: number;
  time_invested_seconds: number;
  difficulty_level: string | null;
  completed_at: string;
  share_slug: string;
}

/** Full achievement row used for public credential pages. */
export interface AchievementRecord extends AchievementSummary {
  user_id: string;
  progress_id: string | null;
  skill_receipt: SkillReceipt | null;
}

/** Public page payload for a shareable achievement. */
export interface AchievementPageData {
  achievement: AchievementRecord;
  user_name: string;
}
