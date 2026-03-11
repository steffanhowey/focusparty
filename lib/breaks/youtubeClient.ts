// ─── YouTube Data API v3 Client ─────────────────────────────
// Thin wrapper for content discovery. Uses native fetch.
// Requires YOUTUBE_API_KEY in environment.

const YT_BASE = "https://www.googleapis.com/youtube/v3";

function getApiKey(): string {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new Error("[youtube] YOUTUBE_API_KEY not set");
  return key;
}

// ─── Types ──────────────────────────────────────────────────

export interface YTSearchResult {
  videoId: string;
  title: string;
  description: string;
  channelTitle: string;
  publishedAt: string;
  thumbnailUrl: string;
}

export interface YTVideoDetails {
  videoId: string;
  title: string;
  description: string;
  channelTitle: string;
  publishedAt: string;
  thumbnailUrl: string;
  durationSeconds: number;
  viewCount: number;
  likeCount: number;
  commentCount: number;
}

// ─── Search ─────────────────────────────────────────────────

interface SearchOptions {
  maxResults?: number;
  publishedAfter?: string; // ISO 8601
  videoDuration?: "short" | "medium" | "long";
  order?: "relevance" | "viewCount" | "date";
  channelId?: string; // Restrict to a specific channel
}

/**
 * Search YouTube for videos matching a query.
 * Costs 100 quota units per call.
 */
export async function searchVideos(
  query: string,
  options: SearchOptions = {}
): Promise<YTSearchResult[]> {
  const params = new URLSearchParams({
    part: "snippet",
    type: "video",
    q: query,
    maxResults: String(options.maxResults ?? 10),
    order: options.order ?? "relevance",
    videoEmbeddable: "true",
    key: getApiKey(),
  });

  if (options.channelId) {
    params.set("channelId", options.channelId);
  }
  if (options.publishedAfter) {
    params.set("publishedAfter", options.publishedAfter);
  }
  if (options.videoDuration) {
    params.set("videoDuration", options.videoDuration);
  }

  const res = await fetch(`${YT_BASE}/search?${params}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`[youtube] search failed (${res.status}): ${text}`);
  }

  const data = await res.json();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data.items ?? []).map((item: any) => ({
    videoId: item.id?.videoId ?? "",
    title: item.snippet?.title ?? "",
    description: item.snippet?.description ?? "",
    channelTitle: item.snippet?.channelTitle ?? "",
    publishedAt: item.snippet?.publishedAt ?? "",
    thumbnailUrl:
      item.snippet?.thumbnails?.medium?.url ??
      item.snippet?.thumbnails?.default?.url ??
      "",
  }));
}

// ─── Video Details ──────────────────────────────────────────

/**
 * Fetch full details (duration, stats) for a list of video IDs.
 * Costs 1 quota unit per video.
 * Max 50 IDs per call.
 */
export async function getVideoDetails(
  videoIds: string[]
): Promise<YTVideoDetails[]> {
  if (videoIds.length === 0) return [];

  const params = new URLSearchParams({
    part: "snippet,contentDetails,statistics",
    id: videoIds.slice(0, 50).join(","),
    key: getApiKey(),
  });

  const res = await fetch(`${YT_BASE}/videos?${params}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`[youtube] videos failed (${res.status}): ${text}`);
  }

  const data = await res.json();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data.items ?? []).map((item: any) => ({
    videoId: item.id ?? "",
    title: item.snippet?.title ?? "",
    description: item.snippet?.description ?? "",
    channelTitle: item.snippet?.channelTitle ?? "",
    publishedAt: item.snippet?.publishedAt ?? "",
    thumbnailUrl:
      item.snippet?.thumbnails?.medium?.url ??
      item.snippet?.thumbnails?.default?.url ??
      "",
    durationSeconds: parseDuration(item.contentDetails?.duration ?? ""),
    viewCount: parseInt(item.statistics?.viewCount ?? "0", 10),
    likeCount: parseInt(item.statistics?.likeCount ?? "0", 10),
    commentCount: parseInt(item.statistics?.commentCount ?? "0", 10),
  }));
}

// ─── Helpers ────────────────────────────────────────────────

/** Parse ISO 8601 duration (PT4M13S) → seconds */
function parseDuration(iso: string): number {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const h = parseInt(match[1] ?? "0", 10);
  const m = parseInt(match[2] ?? "0", 10);
  const s = parseInt(match[3] ?? "0", 10);
  return h * 3600 + m * 60 + s;
}
