// ─── Signal Service ──────────────────────────────────────────
// Creates signal records in fp_signals from various sources.
// Signals feed into the topic clustering and heat scoring pipeline.

import { createClient } from "@/lib/supabase/admin";
import type { BreakContentCandidate } from "@/lib/types";

// ─── Types ──────────────────────────────────────────────────

export interface Signal {
  id: string;
  source: string;
  sourceId: string | null;
  sourceUrl: string | null;
  title: string;
  summary: string | null;
  engagementScore: number;
  rawData: Record<string, unknown>;
  topicClusterId: string | null;
  processed: boolean;
  createdAt: string;
}

// ─── Signal creation ────────────────────────────────────────

/**
 * Create a signal from a YouTube discovery (pre-evaluation, weaker signal).
 * Fire-and-forget — failures are logged but never block the caller.
 */
export async function createSignalFromDiscovery(video: {
  videoId: string;
  title: string;
  creator: string;
  viewCount?: number;
  publishedAt?: string;
}): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("fp_signals").insert({
    source: "youtube",
    source_id: video.videoId,
    source_url: `https://www.youtube.com/watch?v=${video.videoId}`,
    title: video.title,
    summary: null,
    engagement_score: 0,
    raw_data: {
      creator: video.creator,
      view_count: video.viewCount ?? 0,
      published_at: video.publishedAt ?? null,
      origin: "discovery",
    },
    processed: false,
  });

  if (error) {
    // Duplicate source_id is fine — skip silently
    if (error.code === "23505") return;
    console.warn("[topics/signalService] discovery signal insert failed:", error);
  }
}

/**
 * Create a signal from an evaluated candidate (strong signal, with topics).
 * Fire-and-forget — failures are logged but never block the caller.
 */
export async function createSignalFromEvaluation(
  candidate: BreakContentCandidate,
  topics: string[],
  tasteScore: number
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("fp_signals").insert({
    source: "youtube",
    source_id: candidate.external_id,
    source_url: candidate.video_url,
    title: candidate.title,
    summary: (candidate.description ?? "").slice(0, 300),
    engagement_score: Math.min(1, Math.max(0, tasteScore / 100)),
    raw_data: {
      creator: candidate.creator ?? null,
      view_count: candidate.view_count ?? 0,
      like_count: candidate.like_count ?? 0,
      taste_score: tasteScore,
      topics,
      world_key: candidate.world_key,
      origin: "evaluation",
    },
    processed: false,
  });

  if (error) {
    // Duplicate is fine — the discovery signal may already exist
    if (error.code === "23505") return;
    console.warn("[topics/signalService] evaluation signal insert failed:", error);
  }
}
