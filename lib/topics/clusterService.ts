// ─── Topic Clustering Service ────────────────────────────────
// LLM-powered service that classifies raw signals into topic
// clusters using GPT-4o-mini with Structured Outputs.

import OpenAI from "openai";
import { createClient } from "@/lib/supabase/admin";
import { getTopics, formatTaxonomyForPrompt, createTopic } from "./taxonomy";

// ─── OpenAI singleton ───────────────────────────────────────

let _openai: OpenAI | null = null;
function getClient(): OpenAI {
  if (!_openai) _openai = new OpenAI();
  return _openai;
}

// ─── Types ──────────────────────────────────────────────────

export interface ClusteringResult {
  processed: number;
  clustered: number;
  newClusters: number;
  newTopics: number;
  errors: number;
}

interface SignalRow {
  id: string;
  source: string;
  source_id: string | null;
  title: string;
  summary: string | null;
  raw_data: Record<string, unknown>;
}

// ─── Core functions ─────────────────────────────────────────

/**
 * Process a batch of unprocessed signals.
 * 1. Fetch unprocessed signals
 * 2. Send to LLM with taxonomy context
 * 3. LLM assigns each signal to a topic
 * 4. Create/update topic clusters
 * 5. Mark signals as processed
 */
export async function processSignalBatch(
  limit = 50
): Promise<ClusteringResult> {
  const supabase = createClient();

  // 1. Fetch unprocessed signals
  const { data: signals, error: fetchErr } = await supabase
    .from("fp_signals")
    .select("id, source, source_id, title, summary, raw_data")
    .eq("processed", false)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (fetchErr) {
    console.error("[topics/clusterService] fetch error:", fetchErr);
    return { processed: 0, clustered: 0, newClusters: 0, newTopics: 0, errors: 1 };
  }

  if (!signals || signals.length === 0) {
    console.log("[topics/clusterService] No unprocessed signals");
    return { processed: 0, clustered: 0, newClusters: 0, newTopics: 0, errors: 0 };
  }

  console.log(`[topics/clusterService] Processing ${signals.length} signals`);

  // 2. Load taxonomy for prompt
  const topics = await getTopics();
  const taxonomyPrompt = formatTaxonomyForPrompt(topics);

  // Process in chunks of 50
  const chunks: SignalRow[][] = [];
  for (let i = 0; i < signals.length; i += 50) {
    chunks.push(signals.slice(i, i + 50) as SignalRow[]);
  }

  let totalProcessed = 0;
  let totalClustered = 0;
  let totalNewClusters = 0;
  let totalNewTopics = 0;
  let totalErrors = 0;

  for (const chunk of chunks) {
    try {
      const result = await classifySignalChunk(chunk, taxonomyPrompt, supabase);
      totalProcessed += result.processed;
      totalClustered += result.clustered;
      totalNewClusters += result.newClusters;
      totalNewTopics += result.newTopics;
    } catch (err) {
      console.error("[topics/clusterService] chunk error:", err);
      totalErrors++;
    }
  }

  console.log(
    `[topics/clusterService] Done: ${totalProcessed} processed, ${totalClustered} clustered, ${totalNewClusters} new clusters, ${totalNewTopics} new topics`
  );

  return {
    processed: totalProcessed,
    clustered: totalClustered,
    newClusters: totalNewClusters,
    newTopics: totalNewTopics,
    errors: totalErrors,
  };
}

/**
 * Classify a chunk of signals using GPT-4o-mini.
 */
async function classifySignalChunk(
  signals: SignalRow[],
  taxonomyPrompt: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
): Promise<{ processed: number; clustered: number; newClusters: number; newTopics: number }> {
  // Format signals for the prompt
  const signalList = signals.map((s) => ({
    id: s.id,
    source: s.source,
    title: s.title,
    summary: s.summary ?? (s.raw_data as Record<string, unknown>)?.creator ?? "",
  }));

  const response = await getClient().chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.2,
    max_tokens: 2000,
    messages: [
      {
        role: "system",
        content: `You are a topic classification engine for an AI learning platform. You will receive a batch of signals (content titles, descriptions, URLs) from various sources (YouTube, Reddit, HN, blogs).

Your job:
1. Classify each signal into one or more topics from the provided taxonomy
2. If a signal doesn't match any existing topic, suggest a new topic

Be specific. If a signal is about "Cursor's new multi-file editing feature", classify it as "cursor" (tool), not "ai-pair-programming" (technique). Assign the MOST SPECIFIC matching topic.

Available topics:
${taxonomyPrompt}`,
      },
      {
        role: "user",
        content: JSON.stringify({ signals: signalList }),
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "signal_classification",
        strict: true,
        schema: {
          type: "object",
          properties: {
            classifications: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  signal_id: { type: "string" },
                  topic_slugs: {
                    type: "array",
                    items: { type: "string" },
                    description: "1-3 canonical topic slugs from the taxonomy",
                  },
                  confidence: {
                    type: "number",
                    description: "0-1 confidence in the classification",
                  },
                  reasoning: {
                    type: "string",
                    description: "Brief explanation of the classification",
                  },
                },
                required: ["signal_id", "topic_slugs", "confidence", "reasoning"],
                additionalProperties: false,
              },
            },
            suggested_new_topics: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  slug: { type: "string" },
                  name: { type: "string" },
                  category: {
                    type: "string",
                    enum: ["tool", "technique", "concept", "role", "platform"],
                  },
                  parent_slug: { type: "string", description: "Parent topic slug if applicable" },
                  reasoning: { type: "string" },
                },
                required: ["slug", "name", "category", "parent_slug", "reasoning"],
                additionalProperties: false,
              },
            },
          },
          required: ["classifications", "suggested_new_topics"],
          additionalProperties: false,
        },
      },
    },
  });

  const text = response.choices[0]?.message?.content;
  if (!text) {
    throw new Error("[topics/clusterService] Empty AI response");
  }

  const parsed = JSON.parse(text) as {
    classifications: {
      signal_id: string;
      topic_slugs: string[];
      confidence: number;
      reasoning: string;
    }[];
    suggested_new_topics: {
      slug: string;
      name: string;
      category: string;
      parent_slug: string;
      reasoning: string;
    }[];
  };

  // Create any suggested new topics first
  let newTopics = 0;
  for (const suggestion of parsed.suggested_new_topics ?? []) {
    try {
      await createTopic({
        slug: suggestion.slug,
        name: suggestion.name,
        category: suggestion.category,
        parentId: undefined, // We'd need to look up parent by slug, skip for now
        status: "pending",
      });
      newTopics++;
      console.log(`[topics/clusterService] Created pending topic: ${suggestion.slug}`);
    } catch {
      // Duplicate — ignore
    }
  }

  // Process each classification
  let clustered = 0;
  let newClusters = 0;

  for (const classification of parsed.classifications) {
    const signal = signals.find((s) => s.id === classification.signal_id);
    if (!signal) continue;

    // For each topic slug, find or create a cluster
    const primarySlug = classification.topic_slugs[0];
    if (!primarySlug) {
      // No topic assigned — just mark as processed
      await supabase
        .from("fp_signals")
        .update({ processed: true })
        .eq("id", signal.id);
      continue;
    }

    // Look up topic ID
    const { data: topic } = await supabase
      .from("fp_topic_taxonomy")
      .select("id")
      .eq("slug", primarySlug)
      .single();

    if (!topic) {
      // Topic slug doesn't exist in taxonomy — mark processed, skip
      await supabase
        .from("fp_signals")
        .update({ processed: true })
        .eq("id", signal.id);
      continue;
    }

    // Find existing active cluster for this topic
    const { data: existingCluster } = await supabase
      .from("fp_topic_clusters")
      .select("id")
      .eq("topic_id", topic.id)
      .neq("status", "cold")
      .single();

    let clusterId: string;

    if (existingCluster) {
      clusterId = existingCluster.id;
      // Update last_signal_at
      await supabase
        .from("fp_topic_clusters")
        .update({
          last_signal_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", clusterId);
    } else {
      // Create new cluster
      const { data: newCluster, error: clusterErr } = await supabase
        .from("fp_topic_clusters")
        .insert({
          topic_id: topic.id,
          heat_score: 0,
          signal_count: 0,
          status: "emerging",
          first_seen_at: new Date().toISOString(),
          last_signal_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (clusterErr) {
        // Unique constraint — another request created it. Try to fetch it.
        const { data: retry } = await supabase
          .from("fp_topic_clusters")
          .select("id")
          .eq("topic_id", topic.id)
          .neq("status", "cold")
          .single();

        if (retry) {
          clusterId = retry.id;
        } else {
          console.error("[topics/clusterService] cluster create failed:", clusterErr);
          await supabase
            .from("fp_signals")
            .update({ processed: true })
            .eq("id", signal.id);
          continue;
        }
      } else {
        clusterId = newCluster.id;
        newClusters++;
      }
    }

    // Assign signal to cluster and mark processed
    await supabase
      .from("fp_signals")
      .update({
        topic_cluster_id: clusterId,
        processed: true,
      })
      .eq("id", signal.id);

    clustered++;
  }

  // Mark any unclassified signals as processed too
  const classifiedIds = new Set(parsed.classifications.map((c) => c.signal_id));
  for (const signal of signals) {
    if (!classifiedIds.has(signal.id)) {
      await supabase
        .from("fp_signals")
        .update({ processed: true })
        .eq("id", signal.id);
    }
  }

  return {
    processed: signals.length,
    clustered,
    newClusters,
    newTopics,
  };
}
