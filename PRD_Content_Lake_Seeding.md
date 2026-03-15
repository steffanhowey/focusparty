# Content Lake Seeding: Fill the Learn Product with AI Content

## The Problem

The content lake (`fp_content_lake`) has 43 videos — ALL wellness/break content (desk stretches, mindfulness, yoga). Zero content about AI tools, prompt engineering, fine tuning, RAG, coding with AI, or any topic relevant to the Learn product. Every search returns "Not enough content" because there's literally nothing to find.

The Learn product is dead until the lake has content. This is the #1 blocker.

## What To Build

A single API endpoint: `POST /api/admin/seed-content-lake`. When called, it searches YouTube for AI/learning topics, scores the results with AI, generates scaffolding, and indexes winners to the content lake with embeddings. One endpoint, one call, hundreds of quality AI learning videos in the lake.

Read these files before starting:
- `lib/breaks/youtubeClient.ts` — YouTube search + video details (reuse `searchVideos`, `getVideoDetails`)
- `lib/breaks/scoring.ts` — AI evaluation engine (reuse the scoring pattern but with a learning-focused persona)
- `lib/breaks/contentSafety.ts` — SAFETY_PROMPT (include in all evaluations)
- `lib/learn/embeddings.ts` — `generateEmbedding`, `buildSearchText`, `indexVideoToContentLake`
- `lib/scaffolding/generator.ts` — `generateScaffolding` (generates exercises, comprehension checks, etc.)
- `lib/breaks/transcript.ts` — `getTranscript` (fetches YouTube captions)

Also read `CLAUDE.md` for project conventions.

---

## Step 1: Define the Learning Topic Queries

**New file: `lib/learn/seedTopics.ts`**

This file contains the search queries that will fill the content lake. These should cover the core topics the Learn product serves.

```typescript
// ─── Learn Content Seed Topics ────────────────────────────────
// YouTube search queries for seeding the content lake with
// AI/learning content. Organized by category.

export interface SeedCategory {
  slug: string;
  label: string;
  queries: string[];
  /** Specific YouTube channels known for quality content in this area */
  channelIds?: string[];
}

export const SEED_CATEGORIES: SeedCategory[] = [
  {
    slug: 'prompt-engineering',
    label: 'Prompt Engineering',
    queries: [
      'prompt engineering tutorial 2025',
      'advanced prompt engineering techniques',
      'system prompt design best practices',
      'chain of thought prompting tutorial',
      'prompt engineering for developers',
    ],
  },
  {
    slug: 'ai-coding',
    label: 'AI-Assisted Coding',
    queries: [
      'cursor AI coding tutorial',
      'cursor composer tutorial 2025',
      'github copilot tutorial',
      'AI pair programming workflow',
      'vscode AI coding tools',
      'coding with AI assistants',
    ],
  },
  {
    slug: 'ai-agents',
    label: 'AI Agents',
    queries: [
      'building AI agents tutorial',
      'AI agent frameworks 2025',
      'autonomous AI agents explained',
      'LangChain agents tutorial',
      'CrewAI tutorial',
      'AI agent architecture',
    ],
  },
  {
    slug: 'rag',
    label: 'RAG & Vector Databases',
    queries: [
      'RAG tutorial retrieval augmented generation',
      'vector database tutorial 2025',
      'building RAG applications',
      'pinecone vector database tutorial',
      'RAG with LangChain',
      'embeddings tutorial for beginners',
    ],
  },
  {
    slug: 'fine-tuning',
    label: 'Fine-Tuning & Training',
    queries: [
      'fine tuning LLM tutorial',
      'fine tuning GPT tutorial',
      'LoRA fine tuning explained',
      'fine tuning open source models',
      'custom AI model training',
    ],
  },
  {
    slug: 'ai-tools',
    label: 'AI Tools & Platforms',
    queries: [
      'Claude AI tutorial',
      'ChatGPT advanced features tutorial',
      'v0 dev tutorial vercel',
      'replit AI agent tutorial',
      'NotebookLM tutorial',
      'AI tools for productivity 2025',
    ],
  },
  {
    slug: 'ai-for-business',
    label: 'AI for Business & Product',
    queries: [
      'AI for product managers',
      'using AI for business strategy',
      'AI automation workflows',
      'AI for non-technical professionals',
      'AI use cases for business 2025',
    ],
  },
  {
    slug: 'ai-fundamentals',
    label: 'AI Fundamentals',
    queries: [
      'how large language models work explained',
      'transformer architecture explained simply',
      'AI fundamentals for developers 2025',
      'machine learning basics tutorial',
      'neural networks explained visually',
    ],
  },
  {
    slug: 'no-code-ai',
    label: 'No-Code AI',
    queries: [
      'no code AI app building tutorial',
      'build AI apps without coding',
      'AI automation no code tools',
      'make.com AI automation tutorial',
      'zapier AI features tutorial',
    ],
  },
  {
    slug: 'ai-design',
    label: 'AI for Design',
    queries: [
      'midjourney tutorial 2025',
      'AI UI design workflow',
      'AI for UX designers',
      'generative AI design tools',
      'AI image generation for professionals',
    ],
  },
];
```

---

## Step 2: Build the Lightweight Scoring Function

We don't need the full break evaluation pipeline (it's tuned for wellness content with editorial personas). Build a simpler, learning-focused scorer.

**New file: `lib/learn/seedScorer.ts`**

```typescript
// ─── Learn Content Scorer ─────────────────────────────────────
// Lightweight AI evaluation for learning content.
// Uses GPT-4o-mini Structured Outputs.

import OpenAI from 'openai';
import { SAFETY_PROMPT } from '@/lib/breaks/contentSafety';

let _openai: OpenAI | null = null;
function getClient(): OpenAI {
  if (!_openai) _openai = new OpenAI();
  return _openai;
}

export interface LearnScore {
  quality_score: number;     // 0-100 overall quality
  relevance: number;         // 0-100 how relevant to AI/tech learning
  teaching_quality: number;  // 0-100 how well it teaches
  practical_value: number;   // 0-100 how actionable/hands-on
  topics: string[];          // 2-5 topic slugs
  editorial_note: string;    // 1-sentence summary
  rejected: boolean;         // safety or quality reject
  reject_reason: string | null;
}

const SYSTEM_PROMPT = `You are a content evaluator for SkillGap.ai, an AI-native learning platform. Score YouTube videos for their value as learning resources about AI tools, coding, prompt engineering, and related topics.

${SAFETY_PROMPT}

Score each dimension 0-100:
- relevance: Is this about AI, machine learning, AI tools, coding with AI, or a directly related topic? Score 0 if it's off-topic (wellness, lifestyle, etc.)
- teaching_quality: Does it teach clearly? Good structure, explanations, examples?
- practical_value: Can someone DO something after watching? Tutorials and hands-on demos score highest.

Reject if:
- Safety score would be below 50
- Relevance is below 30 (not about AI/tech)
- It's a pure opinion/reaction video with no teaching value
- It's primarily promotional/advertisement content

Topics: assign 2-5 topic slugs from this list: prompt-engineering, ai-coding, cursor, copilot, ai-agents, rag, vector-databases, fine-tuning, llm-fundamentals, ai-tools, claude, chatgpt, v0, replit, midjourney, ai-for-business, ai-automation, no-code-ai, ai-design, machine-learning, neural-networks, transformers, embeddings, api-design, python-ai, javascript-ai, nextjs, react, ai-productivity, developer-tools

Quality score = (relevance * 0.3) + (teaching_quality * 0.4) + (practical_value * 0.3)`;

const SCORE_SCHEMA = {
  type: 'object' as const,
  properties: {
    relevance: { type: 'number' },
    teaching_quality: { type: 'number' },
    practical_value: { type: 'number' },
    topics: { type: 'array', items: { type: 'string' } },
    editorial_note: { type: 'string' },
    rejected: { type: 'boolean' },
    reject_reason: { type: ['string', 'null'] },
  },
  required: ['relevance', 'teaching_quality', 'practical_value', 'topics', 'editorial_note', 'rejected', 'reject_reason'],
  additionalProperties: false,
};

/**
 * Score a video for learning quality using GPT-4o-mini.
 */
export async function scoreForLearning(video: {
  title: string;
  description: string;
  channelTitle: string;
  durationSeconds: number;
  viewCount: number;
}): Promise<LearnScore> {
  const openai = getClient();

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Evaluate this video:
Title: ${video.title}
Channel: ${video.channelTitle}
Duration: ${Math.round(video.durationSeconds / 60)} minutes
Views: ${video.viewCount.toLocaleString()}
Description: ${(video.description ?? '').slice(0, 500)}`,
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'learn_score',
          strict: true,
          schema: SCORE_SCHEMA,
        },
      },
    });

    const raw = JSON.parse(response.choices[0].message.content ?? '{}');
    const quality_score = Math.round(
      raw.relevance * 0.3 + raw.teaching_quality * 0.4 + raw.practical_value * 0.3
    );

    return {
      quality_score,
      relevance: raw.relevance,
      teaching_quality: raw.teaching_quality,
      practical_value: raw.practical_value,
      topics: raw.topics ?? [],
      editorial_note: raw.editorial_note ?? '',
      rejected: raw.rejected ?? false,
      reject_reason: raw.reject_reason ?? null,
    };
  } catch (error) {
    console.error('[learn/seedScorer] scoring failed:', error);
    return {
      quality_score: 0,
      relevance: 0,
      teaching_quality: 0,
      practical_value: 0,
      topics: [],
      editorial_note: 'Scoring failed',
      rejected: true,
      reject_reason: 'scoring_error',
    };
  }
}
```

---

## Step 3: Build the Seeding Endpoint

**New file: `app/api/admin/seed-content-lake/route.ts`**

This endpoint orchestrates the full pipeline: YouTube search → score → index → (optionally) scaffold.

```typescript
import { NextResponse } from 'next/server';
import { searchVideos, getVideoDetails } from '@/lib/breaks/youtubeClient';
import { scoreForLearning } from '@/lib/learn/seedScorer';
import { generateEmbedding, buildSearchText } from '@/lib/learn/embeddings';
import { createClient as createAdminClient } from '@/lib/supabase/admin';
import { SEED_CATEGORIES, type SeedCategory } from '@/lib/learn/seedTopics';

const MIN_DURATION = 120;   // 2 min minimum
const MAX_DURATION = 2400;  // 40 min maximum (longer OK for learning)
const MIN_QUALITY = 50;     // Minimum quality score to index
const RESULTS_PER_QUERY = 8;

/**
 * POST /api/admin/seed-content-lake
 * Body: { categories?: string[], maxPerCategory?: number }
 *
 * Seeds the content lake with AI/learning videos from YouTube.
 * Protected by ADMIN_SECRET header.
 */
export async function POST(request: Request): Promise<NextResponse> {
  // Auth check
  const authHeader = request.headers.get('x-admin-secret');
  if (authHeader !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const targetCategories: string[] = body.categories ?? SEED_CATEGORIES.map((c) => c.slug);
  const maxPerCategory: number = body.maxPerCategory ?? 15;

  const supabase = createAdminClient();
  const results: Array<{
    category: string;
    searched: number;
    scored: number;
    indexed: number;
    rejected: number;
  }> = [];

  // Get existing video IDs to deduplicate
  const { data: existingRows } = await supabase
    .from('fp_content_lake')
    .select('external_id')
    .eq('content_type', 'video');
  const existingIds = new Set((existingRows ?? []).map((r) => r.external_id));

  for (const cat of SEED_CATEGORIES) {
    if (!targetCategories.includes(cat.slug)) continue;

    console.log(`[seed] Starting category: ${cat.label}`);
    let searched = 0;
    let scored = 0;
    let indexed = 0;
    let rejected = 0;

    // Search YouTube for each query in this category
    const allVideoIds = new Set<string>();

    for (const query of cat.queries) {
      try {
        const searchResults = await searchVideos(query, {
          maxResults: RESULTS_PER_QUERY,
          videoDuration: 'medium', // 4-20 min
          order: 'relevance',
        });
        searched += searchResults.length;

        for (const sr of searchResults) {
          if (!existingIds.has(sr.videoId)) {
            allVideoIds.add(sr.videoId);
          }
        }
      } catch (error) {
        console.error(`[seed] YouTube search failed for "${query}":`, error);
      }
    }

    // Also search for longer videos (medium filter caps at 20min, but tutorials can be longer)
    for (const query of cat.queries.slice(0, 2)) {
      try {
        const longResults = await searchVideos(query, {
          maxResults: 5,
          videoDuration: 'long', // 20+ min
          order: 'viewCount',
        });
        for (const sr of longResults) {
          if (!existingIds.has(sr.videoId)) {
            allVideoIds.add(sr.videoId);
          }
        }
      } catch {
        // Non-critical, continue
      }
    }

    // Get video details for all unique candidates
    const videoIds = [...allVideoIds].slice(0, maxPerCategory * 3); // Fetch 3x to allow for filtering
    if (videoIds.length === 0) {
      results.push({ category: cat.slug, searched, scored, indexed, rejected });
      continue;
    }

    let videos;
    try {
      videos = await getVideoDetails(videoIds);
    } catch (error) {
      console.error(`[seed] Video details failed for ${cat.slug}:`, error);
      results.push({ category: cat.slug, searched, scored, indexed, rejected });
      continue;
    }

    // Filter by duration
    const validVideos = videos.filter(
      (v) => v.durationSeconds >= MIN_DURATION && v.durationSeconds <= MAX_DURATION
    );

    // Score each video (cap at maxPerCategory * 2 to limit API calls)
    const toScore = validVideos.slice(0, maxPerCategory * 2);

    for (const video of toScore) {
      try {
        const score = await scoreForLearning({
          title: video.title,
          description: video.description,
          channelTitle: video.channelTitle,
          durationSeconds: video.durationSeconds,
          viewCount: video.viewCount,
        });
        scored++;

        if (score.rejected || score.quality_score < MIN_QUALITY) {
          rejected++;
          console.log(`[seed] Rejected: "${video.title}" (quality: ${score.quality_score}, reason: ${score.reject_reason ?? 'low_quality'})`);
          continue;
        }

        // Index to content lake with embedding
        const searchText = buildSearchText({
          title: video.title,
          description: video.description,
          topics: score.topics,
          creator_name: video.channelTitle,
        });
        const embedding = await generateEmbedding(searchText);

        const { error } = await supabase.from('fp_content_lake').upsert(
          {
            content_type: 'video',
            external_id: video.videoId,
            source: 'youtube',
            source_url: `https://youtube.com/watch?v=${video.videoId}`,
            title: video.title,
            description: video.description,
            creator_name: video.channelTitle,
            creator_id: video.channelId,
            thumbnail_url: video.thumbnailUrl,
            published_at: video.publishedAt,
            duration_seconds: video.durationSeconds,
            view_count: video.viewCount,
            like_count: video.likeCount,
            quality_score: score.quality_score,
            relevance_scores: {
              relevance: score.relevance,
              teaching_quality: score.teaching_quality,
              practical_value: score.practical_value,
            },
            topics: score.topics,
            editorial_note: score.editorial_note,
            embedding: `[${embedding.join(',')}]`,
            embedding_model: 'text-embedding-3-small',
            search_text: searchText,
            scaffolding: null,
            scaffolding_status: 'none',
            status: 'active',
          },
          { onConflict: 'content_type,external_id' }
        );

        if (error) {
          console.error(`[seed] Upsert failed for "${video.title}":`, error);
        } else {
          indexed++;
          existingIds.add(video.videoId); // Track to avoid re-processing
          console.log(`[seed] Indexed: "${video.title}" (quality: ${score.quality_score}, topics: ${score.topics.join(', ')})`);
        }

        // Stop if we've indexed enough for this category
        if (indexed >= maxPerCategory) break;
      } catch (error) {
        console.error(`[seed] Processing failed for "${video.title}":`, error);
      }
    }

    results.push({ category: cat.slug, searched, scored, indexed, rejected });
    console.log(`[seed] Category ${cat.slug}: searched=${searched} scored=${scored} indexed=${indexed} rejected=${rejected}`);
  }

  const totalIndexed = results.reduce((sum, r) => sum + r.indexed, 0);
  const totalSearched = results.reduce((sum, r) => sum + r.searched, 0);

  return NextResponse.json({
    success: true,
    summary: {
      categories_processed: results.length,
      total_searched: totalSearched,
      total_indexed: totalIndexed,
    },
    categories: results,
  });
}

/**
 * GET /api/admin/seed-content-lake
 * Returns the current state of the content lake.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const authHeader = request.headers.get('x-admin-secret');
  if (authHeader !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { data: stats } = await supabase
    .from('fp_content_lake')
    .select('content_type, topics, quality_score')
    .eq('status', 'active');

  const topicCounts: Record<string, number> = {};
  let total = 0;
  let avgQuality = 0;

  for (const row of stats ?? []) {
    total++;
    avgQuality += row.quality_score ?? 0;
    for (const topic of row.topics ?? []) {
      topicCounts[topic] = (topicCounts[topic] ?? 0) + 1;
    }
  }

  return NextResponse.json({
    total_items: total,
    average_quality: total > 0 ? Math.round(avgQuality / total) : 0,
    topics: Object.entries(topicCounts)
      .sort(([, a], [, b]) => b - a)
      .map(([topic, count]) => ({ topic, count })),
  });
}
```

---

## Step 4: Also Add Real-Time Gap-Filling to the Search Flow

This is critical for long-term health. When someone searches a topic and the lake is thin, instead of returning "not enough content," fill the gap in real-time.

**File: `lib/learn/curriculumGenerator.ts`**

Find the `generateCurriculum` function. After the content lake search and the `filtered.length < 3` check, add a gap-filling block:

```typescript
// After: const filtered = contentItems.filter((r) => r.similarity > 0.3);

// If not enough content, try real-time YouTube gap-fill
if (filtered.length < 3) {
  console.log(`[curriculum] Only ${filtered.length} items for "${query}" — attempting gap-fill`);

  try {
    const { searchVideos, getVideoDetails } = await import('@/lib/breaks/youtubeClient');
    const { scoreForLearning } = await import('@/lib/learn/seedScorer');

    // Search YouTube for this specific topic
    const searchResults = await searchVideos(query, {
      maxResults: 10,
      videoDuration: 'medium',
      order: 'relevance',
    });

    if (searchResults.length > 0) {
      const videoIds = searchResults.map((r) => r.videoId);
      const videos = await getVideoDetails(videoIds);

      // Quick score and index the best ones
      const supabase = (await import('@/lib/supabase/admin')).createClient();

      for (const video of videos.slice(0, 8)) {
        if (video.durationSeconds < 120 || video.durationSeconds > 2400) continue;

        const score = await scoreForLearning({
          title: video.title,
          description: video.description,
          channelTitle: video.channelTitle,
          durationSeconds: video.durationSeconds,
          viewCount: video.viewCount,
        });

        if (score.rejected || score.quality_score < 50) continue;

        // Index to content lake
        const searchText = buildSearchText({
          title: video.title,
          description: video.description,
          topics: score.topics,
          creator_name: video.channelTitle,
        });
        const emb = await generateEmbedding(searchText);

        await supabase.from('fp_content_lake').upsert(
          {
            content_type: 'video',
            external_id: video.videoId,
            source: 'youtube',
            source_url: `https://youtube.com/watch?v=${video.videoId}`,
            title: video.title,
            description: video.description,
            creator_name: video.channelTitle,
            creator_id: video.channelId,
            thumbnail_url: video.thumbnailUrl,
            published_at: video.publishedAt,
            duration_seconds: video.durationSeconds,
            view_count: video.viewCount,
            like_count: video.likeCount,
            quality_score: score.quality_score,
            relevance_scores: {
              relevance: score.relevance,
              teaching_quality: score.teaching_quality,
              practical_value: score.practical_value,
            },
            topics: score.topics,
            editorial_note: score.editorial_note,
            embedding: `[${emb.join(',')}]`,
            embedding_model: 'text-embedding-3-small',
            search_text: searchText,
            scaffolding: null,
            scaffolding_status: 'none',
            status: 'active',
          },
          { onConflict: 'content_type,external_id' }
        );
      }

      // Re-search the content lake now that we've indexed new items
      const newResults = await searchContentLake(embedding, {
        limit: options?.maxItems ?? 20,
      });
      const newFiltered = newResults.filter((r) => r.similarity > 0.25); // slightly lower threshold for fresh content

      if (newFiltered.length >= 3) {
        console.log(`[curriculum] Gap-fill succeeded: ${newFiltered.length} items now available`);
        // Continue with newFiltered instead of filtered
        // (Replace the `filtered` variable reference in the rest of the function)
        filtered.length = 0;
        filtered.push(...newFiltered);
      }
    }
  } catch (gapError) {
    console.error('[curriculum] Gap-fill failed:', gapError);
  }
}

// Original check still stands — if gap-fill also failed, throw
if (filtered.length < 3) {
  throw new Error(`Not enough content for "${query}" (found ${filtered.length})`);
}
```

**IMPORTANT:** The gap-fill code uses dynamic imports (`await import(...)`) to avoid circular dependencies. Make sure to use this pattern, not top-level imports.

**IMPORTANT:** This gap-fill adds ~10-15 seconds to the first search for a new topic. That's OK — it only happens once per topic. Subsequent searches will find the indexed content immediately. Consider showing a "Discovering content for this topic..." loading state on the frontend (future sprint).

---

## Step 5: Trigger the Seed

After building the endpoint, call it to populate the lake. You can test with curl:

```bash
curl -X POST http://localhost:3000/api/admin/seed-content-lake \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: YOUR_ADMIN_SECRET" \
  -d '{"maxPerCategory": 10}'
```

Or seed just one category to test:

```bash
curl -X POST http://localhost:3000/api/admin/seed-content-lake \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: YOUR_ADMIN_SECRET" \
  -d '{"categories": ["ai-coding"], "maxPerCategory": 10}'
```

Check the results:

```bash
curl http://localhost:3000/api/admin/seed-content-lake \
  -H "x-admin-secret: YOUR_ADMIN_SECRET"
```

---

## Step 6: Verify Search Works

After seeding, go to `/learn` and search "fine tuning" or "cursor" or "prompt engineering". You should now see learning paths generated from the newly indexed content.

---

## Timeout Warning

The full seed (10 categories × 10-15 videos each) will hit the Vercel 60s serverless timeout in production. Solutions:

1. **For local dev:** No timeout issue — let it run.
2. **For production:** Seed one category at a time using the `categories` parameter.
3. **Future improvement:** Add a streaming response or background job pattern for bulk seeding.

---

## What NOT To Do

- Do NOT modify the existing break content pipeline. It stays as-is for Rooms.
- Do NOT delete the existing wellness content from the lake. It's still used by the Rooms break shelf.
- Do NOT use Supabase MCP tools. All DB operations go through the admin client in code.
- Do NOT skip the SAFETY_PROMPT in scoring. It's a hard requirement from CLAUDE.md.
- Do NOT use `gpt-4o` for scoring. Use `gpt-4o-mini` — it's fast and cheap enough for batch scoring.
