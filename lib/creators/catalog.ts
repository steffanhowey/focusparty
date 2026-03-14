// ─── Dynamic Creator Catalog ────────────────────────────────
// Manages a database-backed catalog of YouTube creators.
// Tracks channel stats, topic specialties, authority scores,
// and opt-out status. Runs alongside (not replacing) the
// hardcoded channel lists in worldBreakProfiles.ts.

import { createClient } from "@/lib/supabase/admin";
import { getChannelDetails } from "@/lib/breaks/youtubeClient";

// ─── Types ──────────────────────────────────────────────────

export interface Creator {
  id: string;
  channelId: string;
  channelName: string;
  channelUrl: string | null;
  subscriberCount: number;
  avgViewsPerVideo: number;
  totalVideos: number;
  topicSpecialties: string[];
  authorityScore: number;
  partnershipStatus: "auto" | "indexed" | "partner" | "premium" | "opted-out";
  discoverySource: "seed" | "pipeline" | "signal" | "manual";
  lastVideoAt: string | null;
  lastCheckedAt: string | null;
  optedOut: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── CRUD ───────────────────────────────────────────────────

/**
 * Get all active (non-opted-out) creators, optionally filtered.
 */
export async function getCreators(filters?: {
  partnership?: string;
  topic?: string;
  minAuthority?: number;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<Creator[]> {
  const supabase = createClient();
  let query = supabase
    .from("fp_creators")
    .select("*")
    .eq("opted_out", false)
    .order("authority_score", { ascending: false });

  if (filters?.partnership) {
    query = query.eq("partnership_status", filters.partnership);
  }
  if (filters?.topic) {
    query = query.contains("topic_specialties", [filters.topic]);
  }
  if (filters?.minAuthority) {
    query = query.gte("authority_score", filters.minAuthority);
  }
  if (filters?.search) {
    query = query.ilike("channel_name", `%${filters.search}%`);
  }
  if (filters?.offset) {
    query = query.range(filters.offset, filters.offset + (filters?.limit ?? 50) - 1);
  }
  query = query.limit(filters?.limit ?? 50);

  const { data, error } = await query;
  if (error) {
    console.error("[creators/catalog] getCreators error:", error);
    return [];
  }

  return (data ?? []).map(rowToCreator);
}

/**
 * Get a single creator by YouTube channel ID.
 */
export async function getCreatorByChannelId(
  channelId: string
): Promise<Creator | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("fp_creators")
    .select("*")
    .eq("channel_id", channelId)
    .single();

  if (error || !data) return null;
  return rowToCreator(data);
}

/**
 * Get or create a creator record from a YouTube channel ID.
 * If the channel isn't in the catalog, creates it with minimal data.
 * Safe for fire-and-forget usage — never throws.
 */
export async function ensureCreator(
  channelId: string,
  meta?: {
    channelName?: string;
    discoverySource?: "pipeline" | "signal" | "manual";
    partnershipStatus?: "auto" | "indexed";
  }
): Promise<Creator | null> {
  if (!channelId) return null;

  const supabase = createClient();

  // Check if exists
  const { data: existing } = await supabase
    .from("fp_creators")
    .select("*")
    .eq("channel_id", channelId)
    .single();

  if (existing) return rowToCreator(existing);

  // Create new entry
  const channelName = meta?.channelName ?? "Unknown";
  const { data: inserted, error } = await supabase
    .from("fp_creators")
    .insert({
      channel_id: channelId,
      channel_name: channelName,
      channel_url: `https://www.youtube.com/channel/${channelId}`,
      discovery_source: meta?.discoverySource ?? "pipeline",
      partnership_status: meta?.partnershipStatus ?? "auto",
    })
    .select()
    .single();

  if (error) {
    // Handle race condition — another request might have inserted first
    if (error.code === "23505") {
      const { data: raced } = await supabase
        .from("fp_creators")
        .select("*")
        .eq("channel_id", channelId)
        .single();
      return raced ? rowToCreator(raced) : null;
    }
    console.error("[creators/catalog] ensureCreator insert error:", error);
    return null;
  }

  return inserted ? rowToCreator(inserted) : null;
}

/**
 * Update a creator's topic specialties.
 * Merges new topics into the existing array (deduplicates).
 */
export async function updateCreatorTopics(
  channelId: string,
  topics: string[]
): Promise<void> {
  if (!channelId || topics.length === 0) return;

  const supabase = createClient();
  const { data: existing } = await supabase
    .from("fp_creators")
    .select("topic_specialties")
    .eq("channel_id", channelId)
    .single();

  if (!existing) return;

  const currentTopics = (existing.topic_specialties ?? []) as string[];
  const merged = [...new Set([...currentTopics, ...topics])];

  await supabase
    .from("fp_creators")
    .update({
      topic_specialties: merged,
      updated_at: new Date().toISOString(),
    })
    .eq("channel_id", channelId);
}

/**
 * Get all channel IDs for creators specializing in a specific topic.
 * Used by hot-topic discovery to find relevant channels.
 */
export async function getChannelsForTopic(
  topicSlug: string
): Promise<{ channelId: string; channelName: string }[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("fp_creators")
    .select("channel_id, channel_name")
    .eq("opted_out", false)
    .contains("topic_specialties", [topicSlug])
    .order("authority_score", { ascending: false })
    .limit(10);

  if (error) {
    console.error("[creators/catalog] getChannelsForTopic error:", error);
    return [];
  }

  return (data ?? []).map((r) => ({
    channelId: r.channel_id,
    channelName: r.channel_name,
  }));
}

/**
 * Opt out a creator. Sets opted_out = true and removes their content
 * from active shelves. Content remains in candidates/scores for data
 * integrity but is excluded from future discovery and serving.
 */
export async function optOutCreator(
  channelId: string,
  reason?: string
): Promise<void> {
  const supabase = createClient();

  // Mark creator as opted out
  await supabase
    .from("fp_creators")
    .update({
      opted_out: true,
      partnership_status: "opted-out",
      notes: reason ? `Opted out: ${reason}` : "Opted out",
      updated_at: new Date().toISOString(),
    })
    .eq("channel_id", channelId);

  // Remove their content from active shelves
  const { data: activeItems } = await supabase
    .from("fp_break_content_items")
    .select("id")
    .eq("status", "active");

  if (!activeItems || activeItems.length === 0) return;

  // Get candidate IDs for this creator's channel
  const { data: candidates } = await supabase
    .from("fp_break_content_candidates")
    .select("id")
    .eq("channel_id", channelId);

  if (!candidates || candidates.length === 0) return;

  const candidateIds = candidates.map((c) => c.id);

  // Expire shelf items linked to those candidates
  await supabase
    .from("fp_break_content_items")
    .update({ status: "expired" })
    .eq("status", "active")
    .in("candidate_id", candidateIds);

  console.log(`[creators/catalog] Opted out creator ${channelId}, removed content from shelves`);
}

/**
 * Recalculate authority scores for all creators.
 * Authority = subscriber reach (0.30) + avg views (0.30) +
 *             upload consistency (0.20) + topic alignment (0.20)
 */
export async function recalculateAuthorityScores(): Promise<{ updated: number }> {
  const supabase = createClient();
  const { data: creators } = await supabase
    .from("fp_creators")
    .select("*")
    .eq("opted_out", false);

  if (!creators || creators.length === 0) return { updated: 0 };

  let updated = 0;
  for (const creator of creators) {
    const subscriberReach = normalize(creator.subscriber_count ?? 0, 1000, 1000000);
    const viewPerformance = normalize(creator.avg_views_per_video ?? 0, 1000, 100000);
    const topicSpecialties = (creator.topic_specialties ?? []) as string[];
    const topicAlignment = Math.min(1, topicSpecialties.length / 5);

    // Upload consistency: estimate from total videos and channel age
    const uploadConsistency = creator.total_videos
      ? Math.min(1, creator.total_videos / 50)
      : 0;

    const authority =
      subscriberReach * 0.3 +
      viewPerformance * 0.3 +
      uploadConsistency * 0.2 +
      topicAlignment * 0.2;

    const score = Math.round(authority * 100) / 100;

    if (Math.abs(score - (creator.authority_score ?? 0)) > 0.01) {
      await supabase
        .from("fp_creators")
        .update({
          authority_score: score,
          updated_at: new Date().toISOString(),
        })
        .eq("id", creator.id);
      updated++;
    }
  }

  return { updated };
}

/**
 * Refresh channel stats for creators that haven't been checked recently.
 * Processes a small batch per run to stay within API budget.
 */
export async function refreshCreatorStats(options?: {
  staleAfterDays?: number;
  batchSize?: number;
}): Promise<{ refreshed: number; errors: number }> {
  const staleAfterDays = options?.staleAfterDays ?? 7;
  const batchSize = options?.batchSize ?? 10;

  const supabase = createClient();
  const staleDate = new Date();
  staleDate.setDate(staleDate.getDate() - staleAfterDays);

  const { data: staleCreators } = await supabase
    .from("fp_creators")
    .select("channel_id")
    .eq("opted_out", false)
    .or(`last_checked_at.is.null,last_checked_at.lt.${staleDate.toISOString()}`)
    .order("last_checked_at", { ascending: true, nullsFirst: true })
    .limit(batchSize);

  if (!staleCreators || staleCreators.length === 0) {
    return { refreshed: 0, errors: 0 };
  }

  const channelIds = staleCreators.map((c) => c.channel_id);
  let refreshed = 0;
  let errors = 0;

  try {
    const details = await getChannelDetails(channelIds);
    const now = new Date().toISOString();

    for (const detail of details) {
      const { error } = await supabase
        .from("fp_creators")
        .update({
          channel_name: detail.title,
          subscriber_count: detail.subscriberCount,
          total_videos: detail.videoCount,
          channel_url: `https://www.youtube.com/channel/${detail.channelId}`,
          last_checked_at: now,
          raw_data: {
            total_view_count: detail.viewCount,
            fetched_at: now,
          },
          updated_at: now,
        })
        .eq("channel_id", detail.channelId);

      if (error) {
        console.error(`[creators/catalog] refresh error for ${detail.channelId}:`, error);
        errors++;
      } else {
        refreshed++;
      }
    }
  } catch (err) {
    console.error("[creators/catalog] refreshCreatorStats failed:", err);
    errors = channelIds.length;
  }

  console.log(`[creators/catalog] Refreshed ${refreshed} creators, ${errors} errors`);
  return { refreshed, errors };
}

// ─── Helpers ────────────────────────────────────────────────

/** Normalize a value to 0–1 range. */
function normalize(value: number, min: number, max: number): number {
  return Math.min(1, Math.max(0, (value - min) / (max - min)));
}

/** Convert a database row to a Creator object. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToCreator(row: any): Creator {
  return {
    id: row.id,
    channelId: row.channel_id,
    channelName: row.channel_name,
    channelUrl: row.channel_url,
    subscriberCount: row.subscriber_count ?? 0,
    avgViewsPerVideo: row.avg_views_per_video ?? 0,
    totalVideos: row.total_videos ?? 0,
    topicSpecialties: (row.topic_specialties ?? []) as string[],
    authorityScore: row.authority_score ?? 0,
    partnershipStatus: row.partnership_status ?? "auto",
    discoverySource: row.discovery_source ?? "pipeline",
    lastVideoAt: row.last_video_at,
    lastCheckedAt: row.last_checked_at,
    optedOut: row.opted_out ?? false,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
