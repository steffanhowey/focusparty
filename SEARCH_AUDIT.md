# SkillGap.ai Search Experience — Senior Engineering Audit

**Reviewer:** Staff Engineer perspective (Search & Discovery)
**Date:** March 15, 2026
**Scope:** Full search pipeline audit — backend architecture, frontend UX, perceived performance, and information architecture

---

## Executive Summary

SkillGap.ai has a genuinely novel product concept: generative learning paths built on-demand from real content. The curriculum generation engine is sophisticated — task-first design, progressive scaffolding, structured AI outputs — this is strong work.

But the search experience wrapping it fundamentally misunderstands what "search" means for this product. You've built a **generation endpoint** and called it search. The result is a system that feels slow, offers no sense of control to the user, and throws away the most valuable asset you have: every path you've already generated.

The core issue isn't speed optimization. It's **architectural identity**. You need to separate three things that are currently tangled into one API call: **(1) searching what exists, (2) generating what doesn't, and (3) discovering what's trending.** Right now they're all mashed into `GET /api/learn/search`, and the user experience suffers for it.

Here's what needs to change, in priority order.

---

## Finding #1: You Don't Have Search — You Have a Slot Machine

### The Problem

When a user types "React hooks" and hits enter, here's what actually happens:

1. Fuzzy `ilike` match on the `query` column of `fp_learning_paths` (limit 3)
2. If < 3 results, kick off **full path generation** — embedding, YouTube API (3 sequential calls), GPT-4o-mini curriculum design, post-processing, caching
3. Race that against a 45-second timeout
4. Return whatever you have

The user sees a spinner for anywhere from 500ms to 45 seconds. They have no idea what's happening. They can't tell if it's searching, generating, or broken. There's no progressive feedback, no partial results, no indication of progress.

This is a slot machine, not a search engine. The user pulls the lever and waits.

### Why This Matters

Search is the highest-intent moment in your product. Someone typed a query — they're telling you exactly what they want to learn. The experience at this moment determines whether they become a user or bounce. At Google, we measured this obsessively: every 100ms of additional latency on search results costs measurable engagement. You're adding **5-45 seconds**.

### The Fix: Two-Phase Response Architecture

**Phase 1 — Instant results (target: < 300ms)**

Return everything you already have. Right now. Don't generate anything.

```
GET /api/learn/search?q=react+hooks

Response (< 300ms):
{
  results: [...cached paths matching "react hooks"],
  result_count: 4,
  generation_status: "started",  // or "not_needed" if results >= 6
  generation_id: "gen_abc123"
}
```

This means your cache query needs to be better than `ilike` on a single column (see Finding #3), but the principle is: **show what you have immediately**.

**Phase 2 — Background generation (async)**

If you have fewer than ~6 quality results, kick off generation in the background. The frontend polls or uses Server-Sent Events to pick up the new path when it's ready.

```
GET /api/learn/search/status?id=gen_abc123

Response:
{
  status: "completed",  // or "generating" or "failed"
  new_path: { ... }
}
```

The frontend shows the cached results instantly, and when a new path arrives, it slides into the grid with a subtle animation — "Fresh path generated for you" or similar. The user is already browsing, not staring at a spinner.

**Why this works:** You've generated hundreds (maybe thousands) of paths already. Most popular queries will have cached results. The generation path becomes a background enrichment, not the critical path for every request.

---

## Finding #2: Your Cache Is an Attic, Not a Search Index

### The Problem

Your entire "search" over cached paths is this:

```typescript
.ilike("query", `%${normalizedQuery}%`)
.order("view_count", { ascending: false })
.limit(3)
```

This is substring matching on the *generation query string*, sorted by popularity. It has severe limitations:

- **"react hooks"** won't match a path generated for **"useState and useEffect in React"** — even though it's the same topic
- **"AI coding"** won't match **"vibe coding with Cursor"** — even though it's highly relevant
- No semantic understanding whatsoever
- Popularity sort means new, high-quality paths are buried
- Limit of 3 is artificially tiny

You already have embeddings infrastructure (`text-embedding-3-small`). You already have a vector search RPC (`search_content_lake`). But you're not using any of it for path search. You're using `ilike`.

### The Fix: Semantic Path Search

Add embeddings to `fp_learning_paths`. When you cache a path, generate an embedding from `title + description + goal + topics`. Then search paths the same way you search the content lake — vector similarity.

```sql
-- New column on fp_learning_paths
ALTER TABLE fp_learning_paths ADD COLUMN embedding vector(1536);
ALTER TABLE fp_learning_paths ADD COLUMN search_text text;

-- RPC for semantic path search
CREATE FUNCTION search_learning_paths(
  query_embedding vector(1536),
  result_limit int DEFAULT 12
) RETURNS TABLE (
  id uuid,
  similarity float,
  -- ...all path columns
) AS $$
  SELECT
    p.*,
    1 - (p.embedding <=> query_embedding) AS similarity
  FROM fp_learning_paths p
  WHERE p.is_cached = true
    AND p.embedding IS NOT NULL
  ORDER BY p.embedding <=> query_embedding
  LIMIT result_limit;
$$ LANGUAGE sql;
```

Now "react hooks" finds paths about "useState and useEffect" because the embeddings are semantically close. This is the single biggest quality improvement you can make.

**But wait — doesn't embedding generation take ~300ms?**

Yes. So here's the trick: do a fast keyword search AND an embedding search in parallel.

```typescript
// Phase 1: Instant keyword results (< 50ms)
const keywordResults = await admin
  .from("fp_learning_paths")
  .select("*")
  .eq("is_cached", true)
  .textSearch("search_text", query, { type: "websearch" })
  .order("view_count", { ascending: false })
  .limit(6);

// Phase 2: Semantic results (< 400ms, runs in parallel)
const embedding = await generateEmbedding(query);
const semanticResults = await searchLearningPaths(embedding, 12);

// Merge, deduplicate, rank
const merged = mergeAndRank(keywordResults, semanticResults);
```

The user gets keyword hits in ~50ms. Semantic results blend in 300ms later. The UI is already showing content within the first frame.

---

## Finding #3: The Homepage Is a Dead End

### The Problem

When a user lands on `/learn` with no query, they see:

```typescript
const { data: discoveryRows } = await admin
  .from("fp_learning_paths")
  .select("*")
  .eq("is_cached", true)
  .order("view_count", { ascending: false })
  .limit(limit);
```

This is "sort by most viewed" — a single undifferentiated list. No categories, no personalization, no editorial curation, no sense of what's new or trending. It's the equivalent of going to YouTube and seeing a single row of "most watched videos ever."

The topic pills at the top are hardcoded:

```typescript
const POPULAR_TOPICS = [
  "prompt-engineering", "rag", "ai-agents", "fine-tuning",
  "nextjs", "react", "vector-databases", "langchain",
  "cursor", "supabase", "openai-api", "system-design",
];
```

These never change. They don't reflect what's actually popular, what's trending, or what the user has shown interest in.

### The Fix: Structured Discovery Sections

Replace the single list with intentional sections:

1. **Continue Learning** (already exists, good)
2. **Trending This Week** — paths with the highest start_count in the last 7 days
3. **New Paths** — recently generated paths with quality_score > threshold
4. **Recommended For You** — based on topics from completed/in-progress paths (you have taste profiles!)
5. **Browse by Topic** — dynamic topics derived from actual path data, not a hardcoded list

Each section is a separate, fast query. Total page load stays under 200ms because these are all simple DB queries with proper indexes.

The topic pills should be dynamic — pull from `fp_topic_taxonomy` or aggregate from path topics. Show the top 12 by path count or heat score.

---

## Finding #4: Sequential YouTube Calls Are Burning Time and Money

### The Problem

When the content lake is thin for a query, you fire 3 YouTube searches sequentially:

```typescript
const queries = [`${query} tutorial`, `${query} explained`, `learn ${query}`];

for (const q of queries) {
  const results = await searchVideos(q, { maxResults: 8 });
  // ...
}
```

Each call takes 100-600ms. Sequential = 300-1800ms. Plus each costs 100 YouTube API quota units = 300 units per generation.

### The Fix

```typescript
const queries = [`${query} tutorial`, `${query} explained`, `learn ${query}`];

const searchResults = await Promise.allSettled(
  queries.map(q => searchVideos(q, { maxResults: 8, videoDuration: "medium", order: "relevance" }))
);

const allVideoIds = new Set<string>();
for (const result of searchResults) {
  if (result.status === "fulfilled") {
    result.value.forEach(r => allVideoIds.add(r.videoId));
  }
}
```

Time drops from ~1.2s to ~0.4s. Same results. Same quota cost (you're paying per call regardless). This is the lowest-effort, highest-impact backend fix.

---

## Finding #5: No Query Understanding

### The Problem

The user's raw query string goes directly to YouTube API and GPT-4o-mini. There's no normalization, expansion, or understanding layer.

- **Typos:** "recat hooks" → zero results
- **Synonyms:** "AI coding" vs "vibe coding" vs "coding with AI tools" — these are the same intent
- **Ambiguity:** "cursor" — the AI tool or the CSS property? Your product should know.
- **Specificity:** "how do I use cursor to build a react app" → should extract the core intent "cursor + react development"

### The Fix: Lightweight Query Processing

You don't need a massive NLP pipeline. A single GPT-4o-mini call with a tiny schema:

```typescript
const QUERY_UNDERSTANDING_SCHEMA = {
  type: "object",
  properties: {
    normalized_query: { type: "string" },        // Clean, canonical form
    search_queries: {                              // 2-3 variations for search
      type: "array",
      items: { type: "string" }
    },
    canonical_topics: {                            // Map to your taxonomy
      type: "array",
      items: { type: "string" }
    },
    intent: {                                      // What they want
      type: "string",
      enum: ["learn_concept", "build_project", "compare_tools", "solve_problem"]
    },
    difficulty_hint: {                             // Inferred from phrasing
      type: ["string", "null"],
      enum: ["beginner", "intermediate", "advanced", null]
    }
  },
  required: ["normalized_query", "search_queries", "canonical_topics", "intent", "difficulty_hint"],
  additionalProperties: false
};
```

**Cost:** ~0.5 cents per query, ~200ms. Run it in parallel with the cache search — by the time results come back, you also know what the user actually meant.

**But only on cache miss.** If the keyword search already returns 6+ quality results, skip this entirely.

---

## Finding #6: The Loading Experience Communicates Nothing

### The Problem

While the user waits (potentially up to 45 seconds), they see:

```tsx
{isLoading ? (
  <PathCardSkeletonGrid count={3} />
) : ...}
```

Three pulsing gray rectangles. No text, no progress, no indication of what's happening. For a product that's doing something genuinely impressive — building a custom curriculum in real-time — you're hiding all the magic.

### The Fix: Progressive Generation UI

When a search triggers background generation, show a generation card in the results grid:

```
┌─────────────────────────────────┐
│  ✨ Building a custom path...   │
│                                 │
│  "React Hooks"                  │
│                                 │
│  ▸ Finding the best content     │  ← step indicator
│  ○ Designing your curriculum    │
│  ○ Adding practice missions     │
│                                 │
│  ░░░░░░░░░░░░░░░░  ~15 sec     │
│                                 │
└─────────────────────────────────┘
```

This does two things: (1) tells the user something is happening, and (2) reframes the wait as *value creation* rather than *loading*. The user isn't waiting for a search engine — they're watching an AI build them a personalized curriculum. That's worth waiting for.

The generation endpoint can emit progress events:
- `finding_content` → "Finding the best content"
- `designing_curriculum` → "Designing your curriculum"
- `adding_missions` → "Adding practice missions"
- `ready` → card animates into a real PathCard

---

## Finding #7: You're Not Learning From Your Users

### The Problem

Every search, every click, every path start, every completion — these are gold-mine signals that you're collecting in various tables but not feeding back into search quality.

Your search ranking is just `view_count DESC`. A path that 500 people started but 90% abandoned ranks higher than a path that 50 people started and 80% completed.

### The Fix: Quality-Weighted Search Ranking

Define a path quality score that blends signals:

```sql
path_quality = (
  0.3 * completion_rate +           -- % of starters who completed
  0.2 * normalized_start_count +    -- popularity (log-scaled)
  0.2 * avg_time_ratio +            -- actual time / estimated time (engagement proxy)
  0.2 * recency_score +             -- fresher content ranks higher
  0.1 * item_diversity_score        -- paths with do/check/reflect tasks rank higher
)
```

Use this as a secondary ranking signal alongside semantic similarity. A path that's semantically close AND has high completion rate should always beat one that's just popular.

---

## Finding #8: No Typeahead or Search Suggestions

### The Problem

The search input is a plain text box with 500ms debounce. The user types, waits, and hopes. No autocomplete, no suggestions, no indication of what topics have content.

### The Fix: Typeahead from Existing Paths

As the user types, show suggestions from your existing path data:

```
┌─────────────────────────────────┐
│  react h|                       │
├─────────────────────────────────┤
│  🔥 React Hooks                 │  ← 4 paths, trending
│  React + Headless UI            │  ← 2 paths
│  React Hook Form                │  ← 1 path
│  ➕ Generate: "react h..."      │  ← always last option
└─────────────────────────────────┘
```

This is a fast query — `ilike` on path titles or a prefix search on topics. 50ms max. The suggestions serve double duty: they show the user what's available AND they steer them toward cached content (which loads instantly).

The "Generate" option at the bottom makes it clear: if you want something custom, we'll build it for you. But here's what we already have.

---

## Priority Ranking

Here's how I'd sequence these changes, from highest to lowest impact:

| Priority | Finding | Effort | Impact | Why |
|----------|---------|--------|--------|-----|
| **P0** | #1 Two-Phase Response | Medium | Massive | Fixes the core UX problem — users see results in < 300ms instead of 5-45s |
| **P0** | #4 Parallel YouTube | Tiny | High | 3 lines of code, saves 0.5-1.2s on every generation |
| **P1** | #2 Semantic Path Search | Medium | High | 10x improvement in result quality for cached queries |
| **P1** | #6 Generation Progress UI | Medium | High | Transforms "broken loading" into "wow, it's building for me" |
| **P1** | #8 Typeahead | Small | High | Guides users to instant results, reduces generation load |
| **P2** | #3 Homepage Sections | Medium | Medium | Better discovery = more starts, more engagement |
| **P2** | #7 Quality Ranking | Small | Medium | Better results from existing data, no new infrastructure |
| **P3** | #5 Query Understanding | Medium | Medium | Catches edge cases, but semantic search handles most of this |

---

## Recommended Sprint Plan

### Sprint A: "Make It Fast" (P0 items)

**Goal:** Search results appear in < 300ms for any cached query. Generation happens in background.

1. Parallelize YouTube API calls (`Promise.allSettled`)
2. Split search endpoint into two phases: instant cache response + async generation
3. Add polling/SSE endpoint for generation status
4. Frontend: show cached results immediately, add generation card for async path
5. Increase cache result limit from 3 to 12

### Sprint B: "Make It Smart" (P1 items)

**Goal:** Results are semantically relevant. Generation feels intentional.

1. Add embedding column to `fp_learning_paths`, backfill existing paths
2. Build `search_learning_paths` RPC with vector similarity
3. Dual search: keyword (instant) + semantic (300ms) with merge
4. Build GenerationCard component with step-by-step progress
5. Add typeahead suggestions from path titles/topics

### Sprint C: "Make It Personal" (P2 items)

**Goal:** Homepage drives engagement. Results reflect quality, not just popularity.

1. Structured homepage sections (trending, new, recommended, browse by topic)
2. Dynamic topic pills from actual data
3. Path quality score calculation (completion rate, engagement)
4. Quality-weighted ranking in search results

### Sprint D: "Make It Clever" (P3 items)

**Goal:** Handle edge cases. Understand what users really mean.

1. Query understanding layer (GPT-4o-mini, only on cache miss)
2. Typo tolerance in search
3. Related paths / "people also learned" section

---

## One More Thing

Your product does something that almost nobody else does — it generates *personalized curricula with hands-on missions* in real-time. That's remarkable. But right now, the first experience a user has with this power is... a loading spinner.

The biggest mistake would be to optimize the spinner. Instead, restructure the experience so the user never has to wait for generation. Show them what exists. Let them start learning. And when the AI finishes building something custom, slide it in as a delightful bonus — "Hey, we built something just for you."

The generation engine is the moat. But the search experience is the door. Make the door fast and wide open, and the moat will take care of itself.
