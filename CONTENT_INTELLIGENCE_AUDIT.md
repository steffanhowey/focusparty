# SkillGap.ai Content Intelligence Audit

**Question:** How do we become the hub for the absolute latest in AI — the way Matt Berman is always first to cover news — and how do we make sure we're not just passing YouTube links along?

---

## What You Actually Have (It's More Than You Think)

I went through every file in the content intelligence stack. Here's the honest assessment: **the machinery is 90% built.** You have signal collection from 5 sources running every 15 minutes. You have GPT-powered topic clustering running hourly. You have a heat score engine that tracks what's trending. You have scaffolding generation that turns videos into structured learning experiences.

But here's the problem: **these systems don't talk to each other in the ways that matter.** You have two independent pipelines operating in parallel:

**Pipeline A: The Break Content Pipeline (the old system)**
- Discovers YouTube videos per "world" (vibe-coding, writer-room, etc.)
- Scores them with 7-dimension AI evaluation
- Promotes winners to break content shelves
- Generates learning scaffolding per video
- Rotates through hardcoded worlds on a schedule

**Pipeline B: The Topic Intelligence Engine (the new system)**
- Collects signals from Reddit, HN, RSS, YouTube velocity
- Clusters signals into canonical topics with GPT
- Calculates heat scores per topic
- Tracks emerging/hot/cooling/cold status

**Pipeline C: The Learning Path Generator (the user-facing system)**
- Takes a user search query
- Searches the content lake (vector similarity)
- Falls back to live YouTube search if lake is thin
- GPT designs a curriculum with missions, checks, reflections
- Caches the result

Here's what's broken: **Pipeline B detects that "Claude Code" is hot right now, but Pipeline A doesn't know or care — it's still rotating through vibe-coding.** And **Pipeline C generates paths on-demand from whatever it finds, with no awareness of what's trending or what the intelligence engine has learned.**

The content lake (`fp_content_lake`) is the intended bridge between these systems, but it's sparsely populated. Videos only get indexed there through two paths: (1) the break pipeline promotes scored candidates, and (2) the curriculum generator does fire-and-forget background indexing of YouTube results. Neither path is driven by the intelligence engine's heat signals.

---

## The Two Core Problems

### Problem 1: You're Not Discovery-Driven, You're Schedule-Driven

The break content pipeline discovers new content by rotating through hardcoded world profiles every 6 hours. Each world has fixed search queries and fixed channel lists in `worldBreakProfiles.ts`. This means:

- If "Claude Code" drops tomorrow and it's not in any world's search queries, **you don't find it**
- If a brand new creator publishes the best tutorial in the space, **you don't find them** (hardcoded channel lists)
- If a topic explodes on Reddit and HN overnight, **you don't react** — you wait for the next scheduled rotation

Meanwhile, the signals pipeline IS collecting this data. Reddit, HN, and RSS feeds are telling you exactly what's hot right now. But that intelligence just sits in `fp_topic_clusters` with heat scores that nothing acts on.

The YouTube velocity collector is close to the right idea — it watches channels for videos that are getting views fast. But it's limited to channels you've already hardcoded, and it only creates signals. It doesn't trigger discovery or content lake indexing.

### Problem 2: You're a YouTube Curator, Not a Knowledge Holder

Right now, when a user searches for "prompt engineering," here's what they get: a curriculum built from YouTube videos, with AI-generated missions layered on top. The missions are good — the tool challenges, the comprehension checks, the reflections. But the underlying knowledge structure is **entirely derived from whatever YouTube videos happened to be in the content lake or came back from a live search.**

You're not synthesizing knowledge. You're decorating YouTube embeds with AI-generated exercises. If the YouTube videos are wrong, your curriculum is wrong. If the best explanation of a topic is in an Anthropic blog post or a research paper, you'll never find it because you're not indexing those sources into the content lake.

The RSS collector pulls from 22 feeds including OpenAI, Anthropic, Google AI, Hugging Face, etc. But those signals just feed the heat engine — they don't get indexed as content that could be used in learning paths. An Anthropic blog post about a new Claude feature becomes a signal that says "Claude is trending" but never becomes actual learning material.

---

## The Architecture You Need

### Concept: The Knowledge Graph

Stop thinking of content as "YouTube videos we curate." Start thinking of it as **knowledge objects** — atomic units of understanding that can come from any source and get composed into learning experiences.

A knowledge object has:
- **Core concept** — what it teaches (mapped to canonical topic)
- **Source material** — could be a YouTube video, blog post, documentation page, research paper, tweet thread
- **Structured scaffolding** — AI-generated learning structure (already built!)
- **Freshness** — when it was published, how current is it
- **Quality signals** — editorial score, engagement data, completion rates
- **Relationships** — prerequisite concepts, related topics, advanced followups

Right now your content lake stores items with quality scores and topics, which is a start. But it's missing: multi-source diversity, freshness-driven rotation, and heat-aware discovery.

### The Three Capabilities You Need

**Capability 1: Heat-Driven Discovery**

When the intelligence engine detects a hot topic, it should automatically trigger targeted content discovery for that topic — not wait for a scheduled rotation.

Flow:
```
fp_topic_clusters (heat >= 0.6, content_count < 5)
  → trigger discovery for that specific topic
  → YouTube search with topic-specific queries
  → RSS/blog content indexing for that topic
  → Score and index results into content lake
  → Content lake grows precisely where demand is
```

This means the content lake becomes self-healing. When "Claude Code" explodes and users start searching for it, the system has already been discovering and indexing content since the signal appeared hours ago.

**Capability 2: Multi-Source Content Indexing**

The content lake needs to index more than YouTube videos. Blog posts from your RSS feeds are some of the best learning material in the space. Anthropic's documentation, OpenAI's cookbooks, Vercel's guides — these are primary sources.

Flow:
```
RSS signals (source_url present, engagement >= 0.3)
  → fetch article content (already have source URLs)
  → AI scoring: is this tutorial/educational content?
  → Generate embedding + scaffolding
  → Index to fp_content_lake as content_type: "article"
  → Available for curriculum generation
```

The content lake already supports `content_type: "article"` with `article_word_count` and the embeddings infrastructure handles it. The indexing function `indexArticleToContentLake` exists in `embeddings.ts`. What's missing is the pipeline that feeds articles from RSS signals into it.

**Capability 3: Proactive Path Pre-Generation**

Don't wait for users to search for trending topics. When a topic goes hot, pre-generate a learning path and cache it so the first person who searches gets instant results.

Flow:
```
fp_topic_clusters (status transitions to "hot")
  → check: does a quality cached path exist for this topic?
  → if not: generate curriculum from content lake
  → cache in fp_learning_paths with is_cached=true
  → appears instantly in search results + discovery page
```

This is where the "Matt Berman speed" comes from. He publishes fast because he's watching signals. You can do the same thing — but instead of publishing a reaction video, you publish a structured learning path with curated content and hands-on missions. And you can do it at 3am automatically.

---

## Implementation Plan: 4 Phases

### Phase 1: Wire Heat to Discovery (The Connection)

**Problem:** Heat engine and discovery engine are disconnected.
**Fix:** When hourly clustering detects a hot/emerging topic with thin content, auto-trigger discovery.

New file: `lib/learn/heatDrivenDiscovery.ts`

This module:
1. Queries `fp_topic_clusters` for topics with `heat_score >= 0.5` AND `content_count < 5`
2. For each under-served hot topic:
   - Generates 3 YouTube search queries from the topic name + aliases
   - Runs YouTube search (parallelize!)
   - Scores results with `seedScorer.ts` (the learning-specific scorer)
   - Indexes quality videos to `fp_content_lake`
3. Updates `content_count` on the cluster

New cron: runs after topic clustering (hourly), or piggybacks on the existing cluster cron.

**Cost:** ~300 YouTube API quota units per hot topic. With 2-3 hot topics at a time, that's ~900/hour max. Currently using ~8000/day, quota is 10,000. Tight but workable. Longer term: request quota increase.

### Phase 2: Index Articles from Signals (Multi-Source)

**Problem:** RSS/blog signals create heat data but not learning content.
**Fix:** Route high-quality article signals into the content lake.

New file: `lib/learn/articleIndexer.ts`

This module:
1. Queries `fp_signals` where `source IN ('rss', 'reddit', 'hacker_news')` AND `processed = true` AND `source_url IS NOT NULL`
2. Filters: engagement_score >= 0.4, has topic_cluster_id
3. For each candidate article URL:
   - Check if already in content lake (dedup on source_url)
   - Fetch article text (use existing web fetching or a simple extraction)
   - AI scoring: is this educational content? (quick GPT-4o-mini call)
   - If yes: generate embedding, index to `fp_content_lake` as article
4. Updates signal with `content_indexed = true`

New cron: 2x daily (after signal collection has run several times).

**Important:** This makes blog posts from Anthropic, OpenAI, Vercel etc. available as learning material in curriculum generation. When a user searches "Claude Code," they might get the official Anthropic docs alongside a YouTube tutorial — and the curriculum stitches them together into a coherent learning path.

### Phase 3: Proactive Path Pre-Generation (Speed)

**Problem:** First search for a trending topic is slow (generates from scratch).
**Fix:** Pre-generate paths for hot topics so they're cached before anyone searches.

New file: `lib/learn/proactiveGenerator.ts`

This module:
1. Queries `fp_topic_clusters` where `status = 'hot'` OR `heat_score >= 0.7`
2. For each hot topic:
   - Check: does `fp_learning_paths` have a cached path with this topic AND created in last 7 days?
   - If no: call `generateAndCacheCurriculum(topic.name)`
   - Tag the path with `generation_source: 'proactive'` and `topic_slug`
3. Limit: max 3 new paths per run (cost control)

New cron: 2x daily, after content lake has been enriched by Phase 1 and 2.

**Result:** When Claude Code is trending and someone searches for it, there's already a high-quality cached path waiting. Instant results. The GenerationCard from Sprint A becomes a rare fallback instead of the default experience.

### Phase 4: Knowledge Synthesis (The Real Differentiator)

**Problem:** Curricula are built from individual content items with no synthesized knowledge layer.
**Fix:** Generate topic knowledge summaries that inform curriculum design.

This is the hardest and most valuable piece. Instead of the curriculum generator seeing "here are 12 YouTube videos about RAG," it sees:

```json
{
  "topic": "retrieval-augmented-generation",
  "knowledge_summary": "RAG combines retrieval systems with LLMs...",
  "key_concepts": [
    { "name": "Vector embeddings", "prerequisite": true },
    { "name": "Chunking strategies", "core": true },
    { "name": "Reranking", "advanced": true }
  ],
  "common_misconceptions": [...],
  "current_state": "New approaches focus on agentic RAG...",
  "best_content_by_concept": { ... }
}
```

This means your curriculum doesn't just sequence videos — it sequences **concepts**, using the best available content (from any source) to teach each one. The AI host can reference the knowledge summary during sprint breaks. The practice missions can be designed around concept gaps rather than video content.

New file: `lib/learn/topicKnowledge.ts`

This module:
- For each canonical topic with sufficient content (>= 5 items in content lake):
  - Pulls all content items with their scaffolding
  - GPT-4o-mini generates a knowledge synthesis: key concepts, prerequisites, progression, misconceptions
  - Stores in a new table `fp_topic_knowledge` or as JSONB on `fp_topic_taxonomy`
  - Refreshed weekly or when significant new content is indexed

The curriculum generator then receives both the content items AND the knowledge synthesis, enabling it to design genuinely intelligent learning paths rather than content playlists.

---

## What This Means For The Product

When this is built, here's what happens when Claude releases a new feature on a Tuesday:

- **Hour 0:** Anthropic publishes blog post. RSS collector picks it up within 15 minutes.
- **Hour 0.5:** HN and Reddit threads appear. Signal collectors pick them up. Topic clustering assigns them to "claude" or creates a new topic.
- **Hour 1:** Heat engine calculates rising heat score. Topic goes from cold → emerging.
- **Hour 2:** YouTubers like Matt Berman, AI Explained, etc. start publishing. YouTube velocity collector detects fast-rising videos on tracked channels.
- **Hour 3:** Heat-driven discovery kicks in. Searches YouTube for the new feature specifically. Indexes 5-8 quality videos + the Anthropic blog post to the content lake.
- **Hour 4:** Proactive generator notices the topic is hot with >= 5 content items. Generates a cached learning path with curriculum, missions, and reflections.
- **Hour 4+:** First user searches for the topic. **Instant results.** A structured learning path with the Anthropic blog post, the best YouTube tutorials, hands-on missions to try the feature, and comprehension checks — all waiting for them.

That's the "Matt Berman speed" but with a fundamentally different value proposition. He tells you what happened. **You teach you how to use it.**

---

## Priority Order

| Phase | Effort | Impact | Why |
|-------|--------|--------|-----|
| **Phase 1** | Medium | Critical | Without this, hot topics have no content. The intelligence engine is generating heat scores that nobody acts on. |
| **Phase 3** | Small | High | Pre-generating paths is 50 lines of code and makes hot topics feel instant. Depends on Phase 1 populating the content lake. |
| **Phase 2** | Medium | High | Multi-source content is the key differentiator from "YouTube curator." Blog posts + docs = primary source material. |
| **Phase 4** | Large | Transformative | Knowledge synthesis is what makes you a knowledge holder, not a content aggregator. But it requires Phases 1-3 to have data. |

---

## One More Thing: You're Not "Just Passing YouTube Along"

Your current curriculum generator already does something most platforms don't — it designs task-first learning paths where videos are support material for hands-on missions. The Watch → Do → Check → Reflect loop is pedagogically sound and genuinely valuable.

But the concern is valid. Right now, if you strip away the AI-generated missions, what's left is a YouTube playlist. The missions are the value, but they're generated on-the-fly from video metadata and scaffolding data.

The way you become a true knowledge holder is:

1. **Multiple sources per topic** — blog posts, docs, videos, not just one format
2. **Synthesized knowledge** — your own understanding of each topic, not just pointers to content
3. **Concept-first curriculum** — design around what needs to be learned, then find the best content to teach each concept
4. **Your own content layer** — the missions, checks, reflections, and knowledge summaries ARE your original content. The videos and articles are references. Your structured learning experience is the product.

The infrastructure to do all of this is 90% built. The remaining 10% is connecting the wires.
