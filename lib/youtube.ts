// ─── YouTube Helpers ─────────────────────────────────────────

/** Extract the video ID from a YouTube URL (watch, embed, or short link). */
export function extractYouTubeId(url: string): string | null {
  const match = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([^&?/]+)/
  );
  return match?.[1] ?? null;
}

/**
 * Return a public YouTube thumbnail URL for a video URL,
 * or `null` if the URL isn't a recognised YouTube link.
 * Uses `mqdefault` (320 × 180) — good balance of size and quality.
 */
export function getYouTubeThumbnail(videoUrl: string): string | null {
  const id = extractYouTubeId(videoUrl);
  return id ? `https://img.youtube.com/vi/${id}/mqdefault.jpg` : null;
}
