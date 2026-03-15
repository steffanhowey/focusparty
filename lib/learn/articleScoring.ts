// ─── Article Scoring Engine ──────────────────────────────────
// Uses GPT-4o-mini with Structured Outputs to evaluate article
// candidates for the content lake. Follows the same patterns
// as lib/breaks/scoring.ts.

import OpenAI from "openai";
import { createClient } from "@/lib/supabase/admin";
import { SAFETY_PROMPT } from "@/lib/breaks/contentSafety";
import { getTopics, formatTaxonomyForPrompt } from "@/lib/topics/taxonomy";
import { indexArticleToContentLake } from "./embeddings";

// ─── OpenAI singleton ───────────────────────────────────────

let _openai: OpenAI | null = null;
function getClient(): OpenAI {
  if (!_openai) _openai = new OpenAI();
  return _openai;
}

// ─── Score weights ──────────────────────────────────────────

const WEIGHTS = {
  relevance: 0.3,
  depth: 0.25,
  clarity: 0.2,
  authority: 0.15,
  freshness: 0.1,
} as const;

// ─── Types ──────────────────────────────────────────────────

interface ArticleEvalResult {
  relevance: number;
  depth: number;
  clarity: number;
  authority: number;
  freshness: number;
  safety: number;
  topics: string[];
  editorialNote: string;
  reject: boolean;
}

interface ArticleBatchResult {
  evaluated: number;
  rejected: number;
  indexed: number;
  errors: number;
}

// ─── Evaluation ─────────────────────────────────────────────

const ARTICLE_SYSTEM_PROMPT = `You are an editorial evaluator for SkillGap.ai, an AI-native learning platform for ambitious tech workers (25–35, engineers/founders/designers).

Your job: evaluate articles for inclusion in the platform's learning content library. You are scoring articles — not videos.

Score each dimension 0–100:
- relevance: How relevant is this to AI, software engineering, or professional skills for tech workers?
- depth: How deeply does the article explore its topic? Does it go beyond surface-level?
- clarity: How well-written is it? Is the structure clear, the logic sound, the examples concrete?
- authority: Is the author/publication credible for this topic?
- freshness: How timely is this content? Is it about current tools/techniques or evergreen?
- safety: Does the content meet safety standards? (see safety rules below)

${SAFETY_PROMPT}

Also assign 2–5 topic slugs from the canonical taxonomy provided.`;

/**
 * Evaluate a batch of pending article candidates.
 * Scores with GPT-4o-mini, rejects low-quality, indexes passing articles.
 */
export async function evaluateArticleBatch(
  limit = 20
): Promise<ArticleBatchResult> {
  const supabase = createClient();

  // Fetch pending article candidates
  const { data: candidates, error: fetchErr } = await supabase
    .from("fp_article_candidates")
    .select("*")
    .eq("status", "pending")
    .order("discovered_at", { ascending: true })
    .limit(limit);

  if (fetchErr || !candidates?.length) {
    if (fetchErr) console.error("[learn/articleScoring] fetch error:", fetchErr);
    return { evaluated: 0, rejected: 0, indexed: 0, errors: 0 };
  }

  // Load taxonomy
  let taxonomyPrompt = "";
  try {
    const topics = await getTopics();
    taxonomyPrompt = formatTaxonomyForPrompt(topics);
  } catch {
    console.warn("[learn/articleScoring] Taxonomy unavailable, using freeform");
  }

  let evaluated = 0;
  let rejected = 0;
  let indexed = 0;
  let errors = 0;
  const startTime = Date.now();

  for (const candidate of candidates) {
    // Timeout guard — 45s max
    if (Date.now() - startTime > 45_000) {
      console.log("[learn/articleScoring] Timeout, stopping");
      break;
    }

    try {
      const result = await evaluateArticle(candidate, taxonomyPrompt);

      if (result.reject || result.safety < 50 || result.relevance < 40) {
        await supabase
          .from("fp_article_candidates")
          .update({ status: "rejected", evaluated_at: new Date().toISOString() })
          .eq("id", candidate.id);
        rejected++;
        console.log(
          `[learn/articleScoring] REJECTED "${candidate.title}" — ${result.editorialNote}`
        );
        continue;
      }

      // Compute weighted score
      const qualityScore = Math.round(
        result.relevance * WEIGHTS.relevance +
          result.depth * WEIGHTS.depth +
          result.clarity * WEIGHTS.clarity +
          result.authority * WEIGHTS.authority +
          result.freshness * WEIGHTS.freshness
      );

      // Update candidate with scores
      await supabase
        .from("fp_article_candidates")
        .update({
          status: "evaluated",
          quality_score: qualityScore,
          relevance_scores: {
            relevance: result.relevance,
            depth: result.depth,
            clarity: result.clarity,
            authority: result.authority,
            freshness: result.freshness,
            safety: result.safety,
          },
          topics: result.topics,
          editorial_note: result.editorialNote,
          evaluated_at: new Date().toISOString(),
        })
        .eq("id", candidate.id);

      evaluated++;

      // Index to content lake if quality passes threshold
      if (qualityScore >= 55) {
        try {
          await indexArticleToContentLake({
            id: candidate.id,
            source_url: candidate.source_url,
            source_id: candidate.source_id,
            feed_label: candidate.feed_label,
            title: candidate.title,
            summary: candidate.summary,
            full_text: candidate.full_text,
            word_count: candidate.word_count,
            author: candidate.author,
            published_at: candidate.published_at,
            quality_score: qualityScore,
            relevance_scores: {
              relevance: result.relevance,
              depth: result.depth,
              clarity: result.clarity,
              authority: result.authority,
              freshness: result.freshness,
            },
            topics: result.topics,
            editorial_note: result.editorialNote,
          });

          await supabase
            .from("fp_article_candidates")
            .update({ status: "indexed" })
            .eq("id", candidate.id);

          indexed++;
        } catch (err) {
          console.warn("[learn/articleScoring] indexing failed:", err);
        }
      }

      console.log(
        `[learn/articleScoring] SCORED "${candidate.title}" → ${qualityScore}`
      );
    } catch (err) {
      console.error(
        `[learn/articleScoring] error on "${candidate.title}":`,
        err
      );
      errors++;
    }
  }

  console.log(
    `[learn/articleScoring] Done: ${evaluated} evaluated, ${rejected} rejected, ${indexed} indexed, ${errors} errors`
  );
  return { evaluated, rejected, indexed, errors };
}

/**
 * Evaluate a single article candidate with GPT-4o-mini.
 */
async function evaluateArticle(
  candidate: {
    title: string;
    summary: string | null;
    full_text: string | null;
    author: string | null;
    feed_label: string | null;
    published_at: string | null;
  },
  taxonomyPrompt: string
): Promise<ArticleEvalResult> {
  const contentPreview = candidate.full_text
    ? candidate.full_text.slice(0, 3000)
    : candidate.summary ?? "";

  const userPrompt = `Evaluate this article for inclusion in SkillGap.ai's learning library.

TITLE: ${candidate.title}
AUTHOR: ${candidate.author ?? "Unknown"}
SOURCE: ${candidate.feed_label ?? "Unknown"}
PUBLISHED: ${candidate.published_at ?? "Unknown"}

CONTENT PREVIEW:
${contentPreview}

${taxonomyPrompt ? `\nCANONICAL TOPICS (assign 2-5 from this list):\n${taxonomyPrompt}` : ""}`;

  const response = await getClient().chat.completions.create({
    model: "gpt-4o-mini",
    max_tokens: 600,
    temperature: 0.3,
    messages: [
      { role: "system", content: ARTICLE_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "article_evaluation",
        strict: true,
        schema: {
          type: "object",
          properties: {
            relevance: { type: "number" },
            depth: { type: "number" },
            clarity: { type: "number" },
            authority: { type: "number" },
            freshness: { type: "number" },
            safety: { type: "number" },
            topics: { type: "array", items: { type: "string" } },
            editorial_note: { type: "string" },
            reject: { type: "boolean" },
          },
          required: [
            "relevance",
            "depth",
            "clarity",
            "authority",
            "freshness",
            "safety",
            "topics",
            "editorial_note",
            "reject",
          ],
          additionalProperties: false,
        },
      },
    },
  });

  const parsed = JSON.parse(response.choices[0].message.content ?? "{}");
  return {
    relevance: parsed.relevance ?? 0,
    depth: parsed.depth ?? 0,
    clarity: parsed.clarity ?? 0,
    authority: parsed.authority ?? 0,
    freshness: parsed.freshness ?? 0,
    safety: parsed.safety ?? 100,
    topics: parsed.topics ?? [],
    editorialNote: parsed.editorial_note ?? "",
    reject: parsed.reject ?? false,
  };
}
