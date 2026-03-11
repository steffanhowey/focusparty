// ─── YouTube Transcript Fetcher ─────────────────────────────
// Fetches timestamped captions from YouTube videos and formats
// them for LLM consumption. Also parses chapter markers from
// video descriptions. Gracefully returns null on failure —
// transcript enrichment is optional, not required.

import { getSubtitles, type Subtitle } from "youtube-caption-extractor";

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

// ─── Fetch transcript ───────────────────────────────────────

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

// ─── Helpers ────────────────────────────────────────────────

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
