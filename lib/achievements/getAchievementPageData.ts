import { cache } from "react";
import { createClient as createAdminClient } from "@/lib/supabase/admin";
import {
  ACHIEVEMENT_RECORD_SELECT,
  mapAchievementRecordRow,
} from "@/lib/achievements/achievementModel";
import type { AchievementPageData } from "@/lib/types";

/** Uncached loader used by the cached page helper and regression tests. */
export async function loadAchievementPageData(
  id: string,
): Promise<AchievementPageData | null> {
  const admin = createAdminClient();

  let achievementRow: Record<string, unknown> | null = null;

  const byShareSlug = await admin
    .from("fp_achievements")
    .select(ACHIEVEMENT_RECORD_SELECT)
    .eq("share_slug", id)
    .single();

  achievementRow = (byShareSlug.data as Record<string, unknown>) ?? null;

  if (!achievementRow) {
    const byId = await admin
      .from("fp_achievements")
      .select(ACHIEVEMENT_RECORD_SELECT)
      .eq("id", id)
      .single();

    achievementRow = (byId.data as Record<string, unknown>) ?? null;
  }

  if (!achievementRow) return null;

  const achievement = mapAchievementRecordRow(achievementRow);

  const { data: profile } = await admin
    .from("fp_profiles")
    .select("display_name, first_name")
    .eq("id", achievement.user_id)
    .single();

  const profileRow = (profile as Record<string, unknown> | null) ?? null;
  const userName =
    (profileRow?.display_name as string | null) ??
    (profileRow?.first_name as string | null) ??
    "A learner";

  return {
    achievement,
    user_name: userName,
  };
}

/** Cached public achievement loader for pages, metadata, and OG routes. */
export const getAchievementPageData = cache(loadAchievementPageData);
