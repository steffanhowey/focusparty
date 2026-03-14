// ─── YouTube Transcript Fetcher ─────────────────────────────
// Fetches timestamped captions from YouTube videos and formats
// them for LLM consumption. Also parses chapter markers from
// video descriptions. Persists transcripts to database for
// reuse by scaffolding generator and evaluation pipeline.

import { getSubtitles, type Subtitle } from "youtube-caption-extractor";
import { createClient } from "@/lib/supabase/admin";

// ─── Types ──────────────────────────────────────────────────

export interface TranscriptSegment {
  start: number; // seconds
  dur: number; // seconds
  text: string;
}

export interface Chapter {
  time: number; // seconds
  label: string;
}

export interface TranscriptResult {
  videoId: string;
  language: string;
  source: "youtube_captions" | "youtube_timedtext" | "manual";
  fullText: string;
  segments: TranscriptSegment[];
  wordCount: number;
  durationSeconds: number | null;
}

// ─── Persistent transcript fetching ─────────────────────────

/**
 * Fetch transcript for a YouTube video.
 * Checks persistent cache first, then tries multiple sources.
 * Stores result for future use by scaffolding generator.
 */
export async function getTranscript(
  videoId: string,
  options?: { language?: string; forceRefresh?: boolean }
): Promise<TranscriptResult | null> {
  const language = options?.language ?? "en";

  // 1. Check cache unless forced refresh
  if (!options?.forceRefresh) {
    const cached = await loadCachedTranscript(videoId, language);
    if (cached) return cached;
  }

  // 2. Try youtube-caption-extractor (existing method)
  const segments = await fetchTranscript(videoId);
  if (segments && segments.length > 0) {
    const result = buildTranscriptResult(videoId, segments, language, "youtube_captions");
    await persistTranscript(result);
    return result;
  }

  // 3. Try YouTube timedtext API fallback
  const timedtextSegments = await fetchTimedtext(videoId, language);
  if (timedtextSegments && timedtextSegments.length > 0) {
    const result = buildTranscriptResult(videoId, timedtextSegments, language, "youtube_timedtext");
    await persistTranscript(result);
    return result;
  }

  // 4. No captions available
  console.log(`[breaks/transcript] No transcript available for ${videoId}`);
  return null;
}

/**
 * Fetch transcripts for a batch of videos.
 * Used by evaluation batch to prefetch all transcripts.
 */
export async function getTranscriptBatch(
  videoIds: string[]
): Promise<Map<string, TranscriptResult>> {
  const results = new Map<string, TranscriptResult>();
  if (videoIds.length === 0) return results;

  // 1. Batch-load all cached transcripts in one query
  const supabase = createClient();
  const { data: cached } = await supabase
    .from("fp_break_content_transcripts")
    .select("*")
    .in("video_id", videoIds)
    .eq("language", "en");

  const cachedSet = new Set<string>();
  for (const row of cached ?? []) {
    cachedSet.add(row.video_id);
    results.set(row.video_id, {
      videoId: row.video_id,
      language: row.language,
      source: row.source as TranscriptResult["source"],
      fullText: row.full_text,
      segments: (row.segments ?? []) as TranscriptSegment[],
      wordCount: row.word_count,
      durationSeconds: row.duration_seconds,
    });
  }

  // 2. Fetch missing transcripts individually
  const missing = videoIds.filter((id) => !cachedSet.has(id));
  for (const videoId of missing) {
    try {
      const result = await getTranscript(videoId);
      if (result) {
        results.set(videoId, result);
      }
    } catch (err) {
      console.warn(`[breaks/transcript] batch fetch failed for ${videoId}:`, err);
    }
  }

  return results;
}

// ─── Formatting for LLM contexts ───────────────────────────

/**
 * Format transcript for scoring prompt.
 * Head+tail truncation: first half + last half of word budget.
 */
export function formatTranscriptForScoring(
  result: TranscriptResult,
  maxWords = 3000
): string {
  const words = result.fullText.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return result.fullText;

  const half = Math.floor(maxWords / 2);
  const head = words.slice(0, half).join(" ");
  const tail = words.slice(-half).join(" ");
  return `${head}\n\n[... middle of transcript omitted (${words.length - maxWords} words) ...]\n\n${tail}`;
}

/**
 * Format transcript for scaffolding prompt.
 * Three-part truncation: first 2000 + 1000 middle + 1000 last words.
 */
export function formatTranscriptForScaffolding(
  result: TranscriptResult,
  maxWords = 4000
): string {
  const words = result.fullText.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return result.fullText;

  const head = words.slice(0, 2000).join(" ");
  const middleStart = Math.floor(words.length / 2) - 500;
  const middle = words.slice(Math.max(0, middleStart), Math.max(0, middleStart) + 1000).join(" ");
  const tail = words.slice(-1000).join(" ");
  return `${head}\n\n[... transcript continues ...]\n\n${middle}\n\n[... transcript continues ...]\n\n${tail}`;
}

// ─── Legacy fetch (unchanged) ───────────────────────────────

/**
 * Fetch timestamped captions for a YouTube video.
 * Returns null if captions are unavailable or fetch fails.
 */
export async function fetchTranscript(
  videoId: string
): Promise<TranscriptSegment[] | null> {
  try {
    const subtitles = await getSubtitles({ videoID: videoId, lang: "en" });

    if (!subtitles || subtitles.length === 0) return null;

    return subtitles.map((s: Subtitle) => ({
      start: parseFloat(s.start) || 0,
      dur: parseFloat(s.dur) || 0,
      text: decodeHTMLEntities(s.text),
    }));
  } catch (err) {
    console.log(
      `[breaks/transcript] Could not fetch transcript for ${videoId}:`,
      (err as Error).message ?? err
    );
    return null;
  }
}

// ─── Format for LLM ────────────────────────────────────────

/**
 * Format transcript segments into a compact timestamped text
 * suitable for LLM context. Groups segments into ~30-second
 * windows and truncates to maxChars.
 *
 * Output format:
 *   [0:00] Welcome to this video about React Server Components...
 *   [0:32] First, let's understand the problem they solve...
 */
export function formatTranscriptForLLM(
  segments: TranscriptSegment[],
  maxChars = 6000
): string {
  if (segments.length === 0) return "";

  const totalDuration = segments[segments.length - 1].start + segments[segments.length - 1].dur;

  // For long videos (>12 min), trim outer 10% to skip intro/outro padding
  let filtered = segments;
  if (totalDuration > 720) {
    const trimStart = totalDuration * 0.08;
    const trimEnd = totalDuration * 0.92;
    filtered = segments.filter(
      (s) => s.start >= trimStart && s.start <= trimEnd
    );
    // Fallback if filtering removed everything
    if (filtered.length === 0) filtered = segments;
  }

  // Group into ~30-second windows
  const lines: string[] = [];
  let windowStart = filtered[0].start;
  let windowText = "";
  const WINDOW_SEC = 30;

  for (const seg of filtered) {
    if (seg.start - windowStart >= WINDOW_SEC && windowText) {
      lines.push(`[${formatTimestamp(windowStart)}] ${windowText.trim()}`);
      windowStart = seg.start;
      windowText = "";
    }
    windowText += " " + seg.text;
  }
  // Flush remaining
  if (windowText.trim()) {
    lines.push(`[${formatTimestamp(windowStart)}] ${windowText.trim()}`);
  }

  // Join and truncate to maxChars
  let result = lines.join("\n");
  if (result.length > maxChars) {
    result = result.slice(0, maxChars);
    // Cut at last complete line
    const lastNewline = result.lastIndexOf("\n");
    if (lastNewline > maxChars * 0.8) {
      result = result.slice(0, lastNewline);
    }
    result += "\n[... transcript truncated]";
  }

  return result;
}

// ─── Chapter parser ─────────────────────────────────────────

/**
 * Extract YouTube chapters from a video description.
 * Chapters are formatted as "0:00 Introduction" or "2:15 - Core Concepts".
 * Returns empty array if no valid chapters found.
 */
export function parseChapters(description: string | null): Chapter[] {
  if (!description) return [];

  const regex = /^(\d{1,2}:\d{2}(?::\d{2})?)\s+[-–—]?\s*(.+)$/gm;
  const chapters: Chapter[] = [];
  let match;

  while ((match = regex.exec(description)) !== null) {
    const timeStr = match[1];
    const label = match[2].trim();
    const time = parseTimestamp(timeStr);
    if (time !== null) {
      chapters.push({ time, label });
    }
  }

  // YouTube requires first chapter at 0:00 and at least 3 chapters
  if (chapters.length < 3) return [];
  if (chapters[0].time !== 0) return [];

  return chapters;
}

/**
 * Format chapters for LLM context.
 * Output: "0:00 Introduction\n2:15 Core Concepts\n..."
 */
export function formatChaptersForLLM(chapters: Chapter[]): string {
  if (chapters.length === 0) return "";
  return chapters
    .map((c) => `${formatTimestamp(c.time)} ${c.label}`)
    .join("\n");
}

// ─── Internal helpers ───────────────────────────────────────

/** Build a TranscriptResult from raw segments. */
function buildTranscriptResult(
  videoId: string,
  segments: TranscriptSegment[],
  language: string,
  source: TranscriptResult["source"]
): TranscriptResult {
  const fullText = segments.map((s) => s.text).join(" ");
  const wordCount = fullText.split(/\s+/).filter(Boolean).length;
  const lastSeg = segments[segments.length - 1];
  const durationSeconds = lastSeg ? Math.ceil(lastSeg.start + lastSeg.dur) : null;

  return { videoId, language, source, fullText, segments, wordCount, durationSeconds };
}

/** Persist transcript to fp_break_content_transcripts. */
async function persistTranscript(result: TranscriptResult): Promise<void> {
  try {
    const supabase = createClient();
    const { error } = await supabase
      .from("fp_break_content_transcripts")
      .upsert(
        {
          video_id: result.videoId,
          language: result.language,
          source: result.source,
          full_text: result.fullText,
          segments: result.segments,
          word_count: result.wordCount,
          duration_seconds: result.durationSeconds,
        },
        { onConflict: "video_id,language" }
      );

    if (error) {
      console.error("[breaks/transcript] persist error:", error);
    }
  } catch (err) {
    console.error("[breaks/transcript] persist failed:", err);
  }
}

/** Load a cached transcript from the database. */
async function loadCachedTranscript(
  videoId: string,
  language: string
): Promise<TranscriptResult | null> {
  try {
    const supabase = createClient();
    const { data } = await supabase
      .from("fp_break_content_transcripts")
      .select("*")
      .eq("video_id", videoId)
      .eq("language", language)
      .single();

    if (!data) return null;

    return {
      videoId: data.video_id,
      language: data.language,
      source: data.source as TranscriptResult["source"],
      fullText: data.full_text,
      segments: (data.segments ?? []) as TranscriptSegment[],
      wordCount: data.word_count,
      durationSeconds: data.duration_seconds,
    };
  } catch {
    return null;
  }
}

/** Fetch transcript via YouTube timedtext API fallback. */
async function fetchTimedtext(
  videoId: string,
  language: string
): Promise<TranscriptSegment[] | null> {
  try {
    const url = `https://www.youtube.com/api/timedtext?v=${encodeURIComponent(videoId)}&lang=${encodeURIComponent(language)}&fmt=srv3`;
    const res = await fetch(url);
    if (!res.ok) return null;

    const xml = await res.text();
    if (!xml || xml.length < 50) return null;

    // Parse <p t="..." d="...">text</p> elements (srv3 format)
    // or <text start="..." dur="...">text</text> elements (classic format)
    const segments: TranscriptSegment[] = [];

    // Try srv3 format first: <p t="milliseconds" d="milliseconds">text</p>
    const pRegex = /<p\s+t="(\d+)"\s+d="(\d+)"[^>]*>([\s\S]*?)<\/p>/g;
    let pMatch;
    while ((pMatch = pRegex.exec(xml)) !== null) {
      const start = parseInt(pMatch[1], 10) / 1000;
      const dur = parseInt(pMatch[2], 10) / 1000;
      const text = decodeHTMLEntities(pMatch[3].replace(/<[^>]+>/g, "").trim());
      if (text) segments.push({ start, dur, text });
    }

    if (segments.length > 0) return segments;

    // Fall back to classic format: <text start="seconds" dur="seconds">text</text>
    const textRegex = /<text\s+start="([\d.]+)"\s+dur="([\d.]+)"[^>]*>([\s\S]*?)<\/text>/g;
    let textMatch;
    while ((textMatch = textRegex.exec(xml)) !== null) {
      const start = parseFloat(textMatch[1]);
      const dur = parseFloat(textMatch[2]);
      const text = decodeHTMLEntities(textMatch[3].replace(/<[^>]+>/g, "").trim());
      if (text) segments.push({ start, dur, text });
    }

    return segments.length > 0 ? segments : null;
  } catch (err) {
    console.log(
      `[breaks/transcript] timedtext fallback failed for ${videoId}:`,
      (err as Error).message ?? err
    );
    return null;
  }
}

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function parseTimestamp(str: string): number | null {
  const parts = str.split(":").map(Number);
  if (parts.some(isNaN)) return null;

  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return null;
}

function decodeHTMLEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}
