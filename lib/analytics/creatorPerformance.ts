// ─── Creator Performance Analytics ──────────────────────────
// Analyzes how each creator's content performs with users and
// adjusts authority scores based on engagement data.
// Auto-applies authority updates (bounded ±0.1, purely additive).

import { createClient } from "@/lib/supabase/admin";
import type { ScoreCalibration, CalibrationRecommendation } from "@/lib/types";

// Current creator authority weights (mirrored from lib/creators/catalog.ts)
const CURRENT_AUTHORITY_WEIGHTS: Record<string, number> = {
  subscriberReach: 0.3,
  viewPerformance: 0.3,
  uploadConsistency: 0.2,
  topicAlignment: 0.2,
};

// Blend ratio: how much performance data influences authority
const PERFORMANCE_BLEND = 0.2; // 80% existing + 20% performance

export interface CreatorPerformanceEntry {
  channelId: string;
  channelName: string;
  contentCount: number;
  avgEngagement: number;
  currentAuthority: number;
  authorityDelta: number;
  topVideos: Array<{ videoId: string; engagement: number }>;
  bottomVideos: Array<{ videoId: string; engagement: number }>;
}

// ─── Core analysis ──────────────────────────────────────────

/**
 * Analyze creator performance and adjust authority scores.
 * Auto-applies because adjustments are bounded (±0.1) and additive.
 */
export async function analyzeCreatorPerformance(): Promise<{
  creatorsAnalyzed: number;
  authorityUpdates: number;
}> {
  const supabase = createClient();

  // Get all creators with content on shelf
  const { data: shelfItems } = await supabase
    .from("fp_break_content_items")
    .select("candidate_id")
    .eq("status", "active")
    .not("candidate_id", "is", null);

  if (!shelfItems || shelfItems.length === 0) {
    return { creatorsAnalyzed: 0, authorityUpdates: 0 };
  }

  // Get candidate details for channel_id mapping
  const candidateIds = [...new Set(shelfItems.map((i) => i.candidate_id))];
  const { data: candidates } = await supabase
    .from("fp_break_content_candidates")
    .select("id, channel_id, external_id")
    .in("id", candidateIds)
    .not("channel_id", "is", null);

  if (!candidates || candidates.length === 0) {
    return { creatorsAnalyzed: 0, authorityUpdates: 0 };
  }

  // Group candidates by channel
  const channelVideos = new Map<string, string[]>();
  for (const c of candidates) {
    if (!c.channel_id) continue;
    const videos = channelVideos.get(c.channel_id) ?? [];
    videos.push(c.external_id);
    channelVideos.set(c.channel_id, videos);
  }

  // Get performance data for all videos
  const allVideoIds = [...new Set(candidates.map((c) => c.external_id))];
  const { data: perfData } = await supabase
    .from("fp_content_performance")
    .select("video_id, engagement_score, starts")
    .in("video_id", allVideoIds)
    .gt("starts", 0);

  if (!perfData || perfData.length === 0) {
    await saveCalibrationResult(0, 0, []);
    return { creatorsAnalyzed: channelVideos.size, authorityUpdates: 0 };
  }

  // Compute per-video average engagement
  const videoEngagement = new Map<string, { total: number; count: number }>();
  for (const p of perfData) {
    const existing = videoEngagement.get(p.video_id) ?? { total: 0, count: 0 };
    existing.total += Number(p.engagement_score);
    existing.count++;
    videoEngagement.set(p.video_id, existing);
  }

  // Compute per-channel average engagement and authority adjustments
  let authorityUpdates = 0;
  const recommendations: CalibrationRecommendation[] = [];

  for (const [channelId, videoIds] of channelVideos) {
    const videoEngagements: number[] = [];
    for (const vid of videoIds) {
      const eng = videoEngagement.get(vid);
      if (eng && eng.count > 0) {
        videoEngagements.push(eng.total / eng.count);
      }
    }

    if (videoEngagements.length === 0) continue;

    const avgEngagement = videoEngagements.reduce((s, v) => s + v, 0) / videoEngagements.length;

    // Performance boost: centered at 0.5 engagement, bounded to ±0.1
    const performanceBoost = (avgEngagement - 0.5) * 0.2;
    const clampedBoost = Math.max(-0.1, Math.min(0.1, performanceBoost));

    if (Math.abs(clampedBoost) < 0.01) continue; // Skip negligible changes

    // Get current authority
    const { data: creator } = await supabase
      .from("fp_creators")
      .select("authority_score, channel_name")
      .eq("channel_id", channelId)
      .single();

    if (!creator) continue;

    const currentAuthority = creator.authority_score ?? 0.5;
    const newAuthority = Math.max(
      0,
      Math.min(1, (1 - PERFORMANCE_BLEND) * currentAuthority + PERFORMANCE_BLEND * (currentAuthority + clampedBoost))
    );

    // Auto-apply the update
    const { error: updateError } = await supabase
      .from("fp_creators")
      .update({
        authority_score: Math.round(newAuthority * 10000) / 10000,
        updated_at: new Date().toISOString(),
      })
      .eq("channel_id", channelId);

    if (!updateError) {
      authorityUpdates++;
      if (Math.abs(clampedBoost) >= 0.03) {
        recommendations.push({
          dimension: channelId,
          currentWeight: currentAuthority,
          recommendedWeight: newAuthority,
          reason: `${creator.channel_name}: avg engagement ${avgEngagement.toFixed(3)} → authority ${currentAuthority.toFixed(3)} → ${newAuthority.toFixed(3)} (${clampedBoost > 0 ? "+" : ""}${clampedBoost.toFixed(3)})`,
        });
      }
    }
  }

  await saveCalibrationResult(channelVideos.size, authorityUpdates, recommendations);

  return { creatorsAnalyzed: channelVideos.size, authorityUpdates };
}

// ─── Reporting ──────────────────────────────────────────────

/**
 * Get per-creator performance report.
 */
export async function getCreatorPerformanceReport(
  channelId?: string
): Promise<CreatorPerformanceEntry[]> {
  const supabase = createClient();

  // Get creators
  let creatorQuery = supabase
    .from("fp_creators")
    .select("channel_id, channel_name, authority_score")
    .eq("opted_out", false)
    .order("authority_score", { ascending: false })
    .limit(50);

  if (channelId) {
    creatorQuery = creatorQuery.eq("channel_id", channelId);
  }

  const { data: creators } = await creatorQuery;
  if (!creators || creators.length === 0) return [];

  const entries: CreatorPerformanceEntry[] = [];

  for (const creator of creators) {
    // Get candidates for this channel
    const { data: candidates } = await supabase
      .from("fp_break_content_candidates")
      .select("external_id")
      .eq("channel_id", creator.channel_id)
      .limit(100);

    if (!candidates || candidates.length === 0) {
      entries.push({
        channelId: creator.channel_id,
        channelName: creator.channel_name,
        contentCount: 0,
        avgEngagement: 0,
        currentAuthority: creator.authority_score,
        authorityDelta: 0,
        topVideos: [],
        bottomVideos: [],
      });
      continue;
    }

    const videoIds = candidates.map((c) => c.external_id);
    const { data: perfData } = await supabase
      .from("fp_content_performance")
      .select("video_id, engagement_score")
      .in("video_id", videoIds)
      .gt("starts", 0);

    if (!perfData || perfData.length === 0) {
      entries.push({
        channelId: creator.channel_id,
        channelName: creator.channel_name,
        contentCount: candidates.length,
        avgEngagement: 0,
        currentAuthority: creator.authority_score,
        authorityDelta: 0,
        topVideos: [],
        bottomVideos: [],
      });
      continue;
    }

    // Average engagement per video
    const videoMap = new Map<string, number[]>();
    for (const p of perfData) {
      const arr = videoMap.get(p.video_id) ?? [];
      arr.push(Number(p.engagement_score));
      videoMap.set(p.video_id, arr);
    }

    const videoAvgs = [...videoMap.entries()].map(([vid, scores]) => ({
      videoId: vid,
      engagement: scores.reduce((s, v) => s + v, 0) / scores.length,
    }));

    const avgEngagement = videoAvgs.reduce((s, v) => s + v.engagement, 0) / videoAvgs.length;
    const performanceBoost = Math.max(-0.1, Math.min(0.1, (avgEngagement - 0.5) * 0.2));

    const sorted = [...videoAvgs].sort((a, b) => b.engagement - a.engagement);

    entries.push({
      channelId: creator.channel_id,
      channelName: creator.channel_name,
      contentCount: candidates.length,
      avgEngagement: Math.round(avgEngagement * 10000) / 10000,
      currentAuthority: creator.authority_score,
      authorityDelta: Math.round(performanceBoost * 10000) / 10000,
      topVideos: sorted.slice(0, 3),
      bottomVideos: sorted.slice(-3).reverse(),
    });
  }

  return entries;
}

// ─── Internal ───────────────────────────────────────────────

async function saveCalibrationResult(
  sampleSize: number,
  updates: number,
  recommendations: CalibrationRecommendation[]
): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase.from("fp_score_calibrations").insert({
    calibration_type: "creator_authority",
    sample_size: sampleSize,
    correlation: null,
    current_weights: CURRENT_AUTHORITY_WEIGHTS,
    recommended_weights: null,
    recommendations,
    auto_applied: updates > 0,
  });

  if (error) {
    console.error("[analytics/creatorPerformance] save error:", error);
  }
}
