// ─── Article Discovery Pipeline ──────────────────────────────
// Reads RSS signals from fp_signals and creates article
// candidates in fp_article_candidates for evaluation.

import { createClient } from "@/lib/supabase/admin";

/**
 * Discover new articles from RSS signals that haven't been
 * processed into article candidates yet.
 * Returns the number of new candidates created.
 */
export async function discoverArticlesFromSignals(
  limit = 40
): Promise<{ discovered: number; errors: number }> {
  const supabase = createClient();

  // Fetch RSS signals not yet in article candidates
  const { data: signals, error: fetchErr } = await supabase
    .from("fp_signals")
    .select("id, source_id, source_url, title, summary, raw_data, created_at")
    .eq("source", "rss")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (fetchErr || !signals?.length) {
    if (fetchErr) console.error("[learn/articleDiscovery] fetch error:", fetchErr);
    return { discovered: 0, errors: fetchErr ? 1 : 0 };
  }

  // Check which source_ids already exist
  const sourceIds = signals.map((s) => s.source_id);
  const { data: existing } = await supabase
    .from("fp_article_candidates")
    .select("source_id")
    .in("source_id", sourceIds);

  const existingSet = new Set((existing ?? []).map((e) => e.source_id));
  const newSignals = signals.filter((s) => !existingSet.has(s.source_id));

  if (newSignals.length === 0) {
    console.log("[learn/articleDiscovery] No new signals to process");
    return { discovered: 0, errors: 0 };
  }

  let discovered = 0;
  let errors = 0;

  for (const signal of newSignals) {
    try {
      // Extract article metadata from signal
      const rawData = signal.raw_data as Record<string, unknown> | null;
      const feedLabel = (rawData?.feed_label as string) ?? null;
      const author = (rawData?.author as string) ?? null;
      const publishedAt = (rawData?.published_at as string) ?? signal.created_at;

      // Attempt to fetch full article text
      let fullText: string | null = null;
      let wordCount: number | null = null;

      if (signal.source_url) {
        try {
          fullText = await fetchArticleText(signal.source_url);
          if (fullText) {
            wordCount = fullText.split(/\s+/).length;
          }
        } catch (err) {
          console.warn(
            `[learn/articleDiscovery] Failed to fetch article text for "${signal.title}":`,
            err
          );
          // Continue with summary only — still worth evaluating
        }
      }

      const { error: insertErr } = await supabase
        .from("fp_article_candidates")
        .insert({
          source: "rss",
          source_url: signal.source_url ?? `signal:${signal.source_id}`,
          source_id: signal.source_id,
          feed_label: feedLabel,
          title: signal.title,
          summary: signal.summary,
          full_text: fullText,
          word_count: wordCount,
          author,
          published_at: publishedAt,
          signal_id: signal.id,
          status: "pending",
        });

      if (insertErr) {
        if (insertErr.code === "23505") {
          // Duplicate — skip silently
          continue;
        }
        console.error("[learn/articleDiscovery] insert error:", insertErr);
        errors++;
        continue;
      }

      discovered++;
    } catch (err) {
      console.error(
        `[learn/articleDiscovery] error processing "${signal.title}":`,
        err
      );
      errors++;
    }
  }

  console.log(
    `[learn/articleDiscovery] Done: ${discovered} discovered, ${errors} errors`
  );
  return { discovered, errors };
}

/**
 * Fetch and extract article text from a URL.
 * Uses a lightweight approach: fetch HTML, strip tags.
 * Returns null if the fetch fails or content is too short.
 */
async function fetchArticleText(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "SkillGap-Bot/1.0 (content-indexer)",
        Accept: "text/html",
      },
    });
    clearTimeout(timeout);

    if (!response.ok) return null;

    const html = await response.text();

    // Simple HTML-to-text extraction
    const text = html
      // Remove script/style blocks
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      // Remove HTML tags
      .replace(/<[^>]+>/g, " ")
      // Decode common entities
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, " ")
      // Collapse whitespace
      .replace(/\s+/g, " ")
      .trim();

    // Too short — likely a paywall or error page
    if (text.length < 200) return null;

    // Cap at ~10K words
    return text.slice(0, 50000);
  } catch {
    return null;
  }
}
