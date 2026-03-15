# Skillgap.ai — The Learn Experience: Complete Product Blueprint

## The Big Picture

Skillgap.ai becomes two distinct experiences under one roof:

**Rooms** — drop-in, timer-driven focus sessions with curated break content. The value is ritual, accountability, and ambient learning. You show up, you focus, you absorb something during the break, you go again. This exists today and needs refinement, not reinvention.

**Learn** — intent-driven, search-powered, personalized learning. "I'm a product manager and I want to understand AI agents." The system finds the best content across the internet, validates quality through multiple independent signals, sequences it into a learning path, and creates an environment to work through it. This is the new product surface.

They share infrastructure (content ingestion, AI evaluation, topic taxonomy, the room UX primitives) but have different triggers, different user states of mind, and different success metrics.

---

## Part 1: The User Journey

### 1.1 Entry Points

**Primary: The Learn Tab**
A top-level navigation item alongside Rooms. When clicked, the user sees a search-first experience — a prominent search bar with the prompt "What do you want to learn?" Below it: trending topics (powered by your heat engine), popular learning paths (most-started by other users), and personalized suggestions (based on their taste profile and past activity).

**Secondary: Room-to-Learn Bridge**
After a break in a Room, a subtle prompt: "Want to go deeper on [topic from the video they just watched]?" One tap opens a pre-populated Learn search for that topic. This is the bridge between passive break consumption and active learning intent. It's also a natural discovery mechanism — users find Learn through Rooms.

**Tertiary: Direct URL / Share**
Every learning path has a shareable URL: `skillgap.ai/learn/building-rag-pipelines`. When someone shares this on Twitter or Slack, new users land directly in the Learn experience. This is the growth loop — learning paths become the shareable unit, not the app itself.

**Quaternary: Onboarding**
New user signup flow asks: "What's your current role?" and "What do you want to learn next?" The answers seed their first learning path and personalize their home screen. They see immediate value before they've done anything.

### 1.2 The Search Experience

The search is the heart of Learn. It needs to feel like the user asked a brilliant friend "what should I study to learn X?" and got back a curated, thoughtful answer — not a list of 10 blue links.

**What the user types:**
Could be broad ("prompt engineering") or specific ("how to fine-tune Llama 3 on custom data") or career-oriented ("I'm a data analyst transitioning to ML engineering"). The system handles all three.

**What happens behind the scenes (< 3 seconds):**

1. **Intent parsing** — GPT-4o-mini classifies the query: topic search, skill path, career transition, or specific technique. It extracts: primary topic, subtopics, implied skill level, format preferences if any.

2. **Content retrieval** — Semantic search (pgvector) against the content lake finds the 30-50 most relevant indexed items. Hybrid ranking combines vector similarity + quality score + freshness + signal confidence. This returns in milliseconds.

3. **Gap detection** — The system checks: do we have enough high-quality content for this topic? If the content lake is thin (< 8 items, or nothing recent), it fires a real-time YouTube API search + web search to supplement. Results get evaluated and indexed on the fly — improving the system for future users.

4. **Path generation** — GPT-4o-mini takes the top 8-15 content items and sequences them into a structured learning path. It determines: what's foundational (watch/read first), what's applied (practice), what's advanced (go deeper). It generates connective text between items: "Now that you understand the basics of embeddings, this next video shows how to implement them in production."

5. **Response assembly** — The learning path is rendered with: estimated total time, difficulty level, topic tags, content items with format indicators (video/article/exercise), creator attribution, and quality confidence scores.

**What the user sees:**

Not a search results page. A **learning path** — titled, described, and structured.

```
┌─────────────────────────────────────────────────────┐
│  Building RAG Pipelines                             │
│  ~2.5 hours · Intermediate · 12 resources           │
│  Topics: RAG, Vector Databases, Embeddings, LLMs    │
│                                                      │
│  "A structured path from understanding what RAG      │
│   is to building a production pipeline."             │
│                                                      │
│  ┌─ FOUNDATIONS (35 min) ─────────────────────────┐  │
│  │ 1. ▶ What is RAG? [video, 8 min]              │  │
│  │    Fireship · 94% quality · 2 days ago         │  │
│  │                                                │  │
│  │ 2. 📄 RAG Explained [article, 12 min read]    │  │
│  │    Chip Huyen · 91% quality · 1 week ago       │  │
│  │                                                │  │
│  │ 3. ▶ Embeddings Crash Course [video, 15 min]  │  │
│  │    3Blue1Brown · 97% quality · 3 months ago    │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  ┌─ APPLIED (55 min) ────────────────────────────┐  │
│  │ 4. ▶ Build RAG with Supabase [video, 20 min] │  │
│  │    Supabase · 88% quality · 5 days ago        │  │
│  │                                                │  │
│  │ 5. 🔨 Practice: Build Your First RAG Query    │  │
│  │    AI-generated exercise · 20 min             │  │
│  │                                                │  │
│  │ 6. 📄 Production RAG Patterns [article]       │  │
│  │    LangChain blog · 85% quality · 2 weeks ago │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  ┌─ ADVANCED (60 min) ───────────────────────────┐  │
│  │ 7. ▶ Advanced Retrieval Strategies [video]    │  │
│  │ 8. 📄 Evaluating RAG Quality [article]        │  │
│  │ 9. 🔨 Practice: Optimize Your Pipeline        │  │
│  │ 10. ▶ RAG at Scale [video]                    │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  [Start Learning]        [Save for Later]            │
│                                                      │
│  👥 4 others learning this right now                 │
└─────────────────────────────────────────────────────┘
```

**Key design principles for search results:**

- **Never show a list of results.** Always show a structured path. Even if the user typed a vague query, the AI sequences the results into something that has a beginning, middle, and end. This is the core differentiator from YouTube search.
- **Show quality confidence visually.** The percentage quality score, sourced from multi-signal validation, builds trust. Users learn to trust the system's curation.
- **Mix content formats intentionally.** A good learning path alternates: watch something → read something → practice something. Variety prevents fatigue and reinforces learning through multiple modalities.
- **Show freshness prominently.** "2 days ago" on a video about a trending topic is a powerful signal. It tells the user: this platform has the latest.
- **Show social proof.** "4 others learning this right now" is the bridge to the social layer. It makes learning feel less solitary.

### 1.3 The Learning Environment

Once the user clicks "Start Learning," they enter the learning environment. This is a focused, distraction-free space — similar in spirit to the Room environment but oriented around progression through a path rather than timed sprints.

**Layout:**

```
┌────────────────────────────────────────────────────────────┐
│  ← Back to Learn    Building RAG Pipelines    3/12 done   │
│━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━│
│                                                            │
│  ┌─────────────────────────────────────┐  ┌────────────┐  │
│  │                                     │  │ PATH       │  │
│  │                                     │  │            │  │
│  │          CONTENT VIEWER             │  │ ✓ 1. What  │  │
│  │                                     │  │   is RAG?  │  │
│  │   (video player / article reader    │  │            │  │
│  │    / exercise workspace)            │  │ ✓ 2. RAG   │  │
│  │                                     │  │   Explained│  │
│  │                                     │  │            │  │
│  │                                     │  │ → 3. Embed │  │
│  │                                     │  │   Crash    │  │
│  │                                     │  │   Course   │  │
│  │                                     │  │            │  │
│  │                                     │  │ ○ 4. Build │  │
│  │                                     │  │   RAG...   │  │
│  │                                     │  │            │  │
│  │                                     │  │ ○ 5. Prac- │  │
│  │                                     │  │   tice...  │  │
│  └─────────────────────────────────────┘  └────────────┘  │
│                                                            │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 💬 AI Tutor: "The key insight here is that          │   │
│  │ embeddings convert meaning into geometry — similar   │   │
│  │ things are nearby in vector space."                  │   │
│  │                                                      │   │
│  │ [Ask a question...]                                  │   │
│  └─────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────┘
```

**Content Viewer** — adapts to format:
- **Video:** YouTube embed with your existing custom chrome (scrub bar, key moment markers, play/pause). Exactly what you have in BreakVideoOverlay, reused.
- **Article:** Clean reader view. Pull the article's content (already indexed in your content lake), render in a comfortable reading layout. Estimated reading time, progress indicator.
- **AI-Generated Exercise:** Interactive workspace. The exercise prompt, a code editor or text input area, hints, and a "Check My Work" button that uses GPT-4o-mini to evaluate the user's response. This is where the scaffolding system pays off — the exercise generator you already built produces exactly this.

**Path Sidebar** — the learning path as a vertical checklist. Shows completed items (✓), current item (→), and upcoming items (○). Clicking any item jumps to it. Collapsible sections for Foundations / Applied / Advanced.

**AI Tutor** — a persistent chat panel at the bottom. Context-aware: it knows what the user is currently watching/reading, where they are in the path, and what they've already covered. The user can ask questions ("What's the difference between cosine similarity and dot product?") and get answers that reference the content they've been consuming. This uses the same GPT-4o-mini patterns you already have for the AI host — but with a tutor personality instead of a host personality.

**Key UX decisions:**

- **No timer by default.** Learn is self-paced. The user works through content at their own speed. BUT — there's an optional "Focus Mode" toggle that activates a sprint timer, turning the learning environment into something closer to a Room. This is for users who want the accountability structure while learning.
- **Auto-advance with confirmation.** When a video ends or the user finishes reading, the system suggests the next item: "Ready for the next step? → Embeddings Crash Course (15 min)". One click to continue. No dead ends.
- **Notes are persistent.** The notes panel (which you already have) travels with the learning path. Notes taken during item 2 are visible when reviewing later. Notes become the user's personal study guide.
- **Progress saves automatically.** Close the tab, come back tomorrow, pick up exactly where you left off. The path state persists in the database.

### 1.4 Progression and Skill Tracking

This is what makes Learn feel like a product, not a search engine. The user needs to feel like they're getting somewhere.

**Per-Path Progression:**
- Completion percentage (3/12 items = 25%)
- Time invested ("You've spent 47 minutes on this path")
- Estimated time remaining
- Completion badge when all items are done

**Skill Profile (the long game):**
Every learning path maps to topics from your canonical taxonomy. As the user completes paths, their skill profile grows:

```
┌─────────────────────────────────────────────────┐
│  Your Skills                                    │
│                                                 │
│  RAG Pipelines          ████████████░░  85%     │
│  Completed: Building RAG Pipelines              │
│  Last studied: 2 days ago                       │
│                                                 │
│  Prompt Engineering      █████████░░░░  65%     │
│  In progress: Advanced Prompting Techniques     │
│  3/10 items complete                            │
│                                                 │
│  AI Agents               ███░░░░░░░░░  20%     │
│  Started: Building AI Agents with Tool Use      │
│  1/8 items complete                             │
│                                                 │
│  Suggested next:                                │
│  → Fine-Tuning LLMs (trending, matches your     │
│    profile)                                     │
│  → Vector Databases Deep Dive (builds on your   │
│    RAG knowledge)                               │
└─────────────────────────────────────────────────┘
```

**Skill levels** are computed from:
- Path completion (did you finish the content?)
- Exercise results (did you get the practice right?)
- Recency (skills decay if not practiced — gentle decay, not punitive)
- Depth (multiple paths on the same topic stack)

**Streaks and Habits:**
- Daily learning streak (borrowed from Duolingo — it works because it creates commitment)
- Weekly learning time goal (user-set: "I want to learn 3 hours/week")
- Gentle nudges, not punishments: "You're 15 minutes from your weekly goal"

**What NOT to build (yet):**
- Certificates or credentials. Too early. The value needs to be felt internally first.
- Leaderboards. Competition can be motivating but also alienating. Save for later.
- Assessments or tests. The exercises are the assessment. Don't add exam pressure to a learning product.

### 1.5 The Social Layer

This is where Rooms and Learn converge — and where Skillgap becomes something no one else has.

**Passive social: "Others learning this"**
On every learning path, show how many others are currently working through it. "12 people learned this path this week." This creates social proof and reduces the loneliness of self-directed learning.

**Active social: Live Learning Sessions**
When 3+ people are actively working through the same learning path (or overlapping topics), the system can offer: "3 others are learning RAG right now. Want to join a live session?"

Clicking this creates a temporary Room — with a timer, the AI host, the learning path's content as break material, and the other learners as participants. This is the magic intersection: the accountability and social energy of Rooms, focused on the specific topic someone chose to learn. It's a study group that forms on demand.

**Discussion threads per path:**
Each learning path has a simple discussion area. Users can post questions or insights. The AI tutor can participate (flagged as AI). This creates community around topics and makes the learning paths feel alive — not static.

**Peer recommendations:**
"People who completed Building RAG Pipelines also learned: Vector Databases Deep Dive, AI Agents with Tool Use." Standard collaborative filtering, but applied to learning paths instead of products.

---

## Part 2: The Content System

### 2.1 The Content Lake

The content lake is the foundation. It's a unified index of learning resources from multiple sources, each evaluated for quality and tagged with topics.

**Content types and sources:**

| Type | Source | Ingestion Method | Quality Signal |
|------|--------|-----------------|----------------|
| Video | YouTube | YouTube API search + channel monitoring | Transcript AI eval + view velocity + like ratio + cross-platform mentions |
| Article | Tech blogs, newsletters | RSS feed polling (50-100 feeds) | Full-text AI eval + social shares + HN/Reddit mentions |
| Documentation | Official docs sites | Targeted web scraping on index updates | Source authority (official = high trust) + freshness |
| AI-Generated | Internal | Generated on-demand for gap-filling | N/A — quality controlled by prompt engineering + user feedback |

**What gets stored per content item:**

```
- id (UUID)
- source_type: "video" | "article" | "documentation" | "ai_generated" | "podcast"
- external_id (YouTube video ID, article URL, etc.)
- title
- description / summary
- body_text (full transcript or article text — for AI evaluation and semantic search)
- embedding (pgvector — for semantic search)
- url
- thumbnail_url
- creator_name
- creator_id (FK to fp_creators)
- duration_seconds (video) or estimated_read_time_seconds (article)
- published_at
- discovered_at
- topics[] (canonical topic slugs from taxonomy)
- quality_score (composite: AI eval + signal confidence)
- signal_count (how many independent signals reference this content)
- signal_sources[] (which sources: "youtube", "reddit", "hn", "rss", "internal")
- freshness_score
- difficulty_level: "beginner" | "intermediate" | "advanced"
- format_metadata (JSONB — format-specific data like segments for video, word count for articles)
- scaffolding (JSONB — exercises, key moments, comprehension checks)
- status: "pending" | "evaluated" | "approved" | "rejected"
```

### 2.2 Multi-Signal Quality Validation

This is the quality engine. Each content item accumulates signals from multiple independent sources, and the composite quality score reflects convergent validation.

**Signal types and what they mean:**

| Signal Source | What It Tells You | Collection Method | Cost |
|--------------|-------------------|-------------------|------|
| YouTube metrics | Audience reception (views, likes, comments) | YouTube API | Part of existing quota |
| Reddit mentions | Community trust, real-world usage | Reddit API (free tier, 100 req/min) | Free |
| Hacker News | Technical credibility, cutting-edge relevance | HN Algolia API (no rate limit) | Free |
| RSS/Newsletter mentions | Authority endorsement | RSS polling | Free |
| Internal engagement | User validation (completion rates, ratings) | Your own database | Free |
| AI evaluation | Content quality, learning value, safety | GPT-4o-mini | ~$0.01/item |

**Composite quality score formula:**

```
quality_score = (
  ai_evaluation_score × 0.35 +
  signal_confidence × 0.25 +
  freshness_score × 0.15 +
  creator_authority × 0.15 +
  internal_engagement × 0.10
)

Where signal_confidence = f(signal_count, source_diversity, sentiment)
- 0 signals: 0.3 (AI eval only, low confidence)
- 1-2 signals from 1 source: 0.5
- 3-5 signals from 2+ sources: 0.7
- 6+ signals from 3+ sources: 0.9
- Negative sentiment reduces signal_confidence by 0.2
```

The key insight: a video with AI score 65 and 6 positive signals from 3 sources (quality_score ~72) ranks higher than a video with AI score 80 and 0 signals (quality_score ~68). The signals provide real-world validation that AI evaluation alone cannot.

**Signal entity resolution:**
The hardest technical problem is matching signals to content. When someone on Reddit says "that Fireship video about RAG was great," the system needs to link that to a specific video in the content lake.

Resolution approach:
1. Extract entities from signal text: creator name, topic keywords, content title fragments
2. Fuzzy match against content lake: creator name + topic overlap + temporal proximity
3. GPT-4o-mini disambiguation for ambiguous matches (batch, cheap)
4. Confidence threshold: only link if match confidence > 0.7

This doesn't need to be perfect. Even 60-70% resolution rate provides valuable signal boosting. Unmatched signals still contribute to topic heat scores.

### 2.3 Content Beyond YouTube

YouTube remains the primary content source, but the system expands to include articles and documentation.

**Article Ingestion Pipeline:**

1. **RSS Discovery** — Poll 50-100 curated RSS feeds every 30 minutes. Sources: top AI/ML blogs (Simon Willison, Lilian Weng, Chip Huyen, Jay Alammar, Eugene Yan), newsletters (The Batch, TLDR AI, Ben's Bites), official blogs (OpenAI, Anthropic, Google AI, Meta AI), framework blogs (LangChain, LlamaIndex, Hugging Face). Each RSS entry gives you: title, URL, publication date, summary, author.

2. **Content Fetching** — For articles that pass initial relevance screening (title + summary matches active topics), fetch the full article text. Use a readability parser to extract the article body (strip nav, ads, sidebars). Store the clean text.

3. **AI Evaluation** — Same evaluation pipeline as videos, but adapted for text: relevance, content density, clarity, authority, freshness. The evaluator can assess article quality more accurately than video quality because it has the full text rather than just a transcript.

4. **Embedding** — Generate an embedding from title + first 500 words. Store in pgvector column.

5. **Indexing** — Article enters the content lake with source_type = "article", linked to canonical topics, ready for search.

**Documentation Ingestion (Phase 2):**

Official documentation (Supabase docs, OpenAI docs, etc.) is the highest-authority source for "how to" content. Ingest via targeted scraping of documentation sitemaps. Re-ingest when docs update (check monthly). These rank highly for specific technical queries.

**Podcast Ingestion (Phase 3):**

Podcast RSS feeds provide episodes. Use a transcription service (or Whisper API) to get text, then evaluate and index like any other content. Podcasts fill the "deep conversation" niche that videos and articles don't — long-form interviews with practitioners.

### 2.4 AI-Generated Content

When the content lake doesn't have enough material for a topic — or when the user needs practice rather than consumption — the system generates content on demand.

**Types of AI-generated content:**

| Type | When Generated | Template |
|------|---------------|----------|
| Topic Overview | When a learning path needs an introduction that doesn't exist as external content | 500-800 word explainer with key concepts, analogies, and "why this matters" framing |
| Practice Exercise | After every 2-3 consumption items in a learning path | Interactive exercise: prompt, starter code/template, hints, evaluation criteria |
| Guided Walkthrough | When a topic has conceptual content but no practical tutorial | Step-by-step instructions with code samples, referencing official documentation |
| Summary & Synthesis | At the end of a learning path section | Connects what the user just learned, highlights key takeaways, bridges to next section |
| Discussion Questions | After complex topics | Open-ended questions that promote reflection, can be posted to path discussion thread |

**Quality control for AI-generated content:**
- Every generated item is clearly labeled "AI-generated" — no pretending it's from a creator
- Generated exercises go through a self-validation step: the AI generates the exercise, then separately evaluates whether it's solvable and correct
- User feedback loop: thumbs up/down on generated content feeds back into prompt improvement
- Cache generated content: if 10 users search "RAG pipelines" and get the same learning path, the exercises are generated once and reused (with minor personalization)

**Cost per learning path generation:**
- Intent parsing: ~$0.002
- Path sequencing: ~$0.005
- 2-3 AI-generated exercises: ~$0.01
- Connective text between items: ~$0.003
- Total: ~$0.02 per learning path
- At 1,000 paths/day: $20/day

---

## Part 3: Technical Architecture

### 3.1 What You Already Have (and What to Reuse)

| Existing System | Reuse in Learn |
|----------------|---------------|
| Content pipeline (discovery, evaluation, shelf) | Expand to multi-source. Video pipeline stays as-is. Add article + RSS pipelines alongside. |
| Topic taxonomy (`fp_topic_taxonomy`) | Core of Learn's search and categorization. Expand from ~80 to 300+ topics. |
| Signal collection (Reddit, HN, RSS collectors) | Add entity resolution to link signals to specific content items. |
| Heat engine (`fp_topic_clusters`) | Powers trending topics on Learn home screen. |
| Scaffolding generator | Powers AI-generated exercises in learning paths. |
| AI evaluation (scoring.ts) | Adapt for multi-format content (articles, docs, not just video). |
| Taste profiles (`fp_user_taste_profiles`) | Personalize learning path recommendations and search ranking. |
| Creator catalog (`fp_creators`) | Creator attribution and authority scoring across all content types. |
| BreakVideoOverlay component | Reuse for video playback in the learning environment. |
| AI host system (hostPrompt.ts) | Adapt into the AI tutor personality for learning paths. |
| Notes system (`fp_notes`) | Extend to be per-learning-path, not just per-session. |

### 3.2 What's New

**New database tables:**

```sql
-- The unified content lake (evolves from fp_break_content_items)
fp_content_lake (
  id UUID PRIMARY KEY,
  source_type TEXT NOT NULL, -- 'video', 'article', 'documentation', 'ai_generated'
  external_id TEXT,
  title TEXT NOT NULL,
  summary TEXT,
  body_text TEXT, -- full transcript or article body
  embedding VECTOR(1536), -- pgvector for semantic search
  url TEXT,
  thumbnail_url TEXT,
  creator_name TEXT,
  creator_id UUID REFERENCES fp_creators(id),
  duration_seconds INTEGER, -- video duration or reading time
  published_at TIMESTAMPTZ,
  discovered_at TIMESTAMPTZ DEFAULT now(),
  topics TEXT[], -- canonical topic slugs
  quality_score NUMERIC, -- composite multi-signal score
  signal_count INTEGER DEFAULT 0,
  signal_sources TEXT[], -- ['youtube', 'reddit', 'hn']
  freshness_score NUMERIC,
  difficulty_level TEXT, -- 'beginner', 'intermediate', 'advanced'
  format_metadata JSONB, -- format-specific (segments, word_count, etc.)
  scaffolding JSONB,
  status TEXT DEFAULT 'pending'
);

-- Learning paths (generated or curated)
fp_learning_paths (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  query TEXT, -- the original search query that created this
  topics TEXT[],
  difficulty_level TEXT,
  estimated_duration_seconds INTEGER,
  items JSONB, -- ordered array of { content_id, section, position, connective_text }
  sections JSONB, -- { foundations: { title, description }, applied: {...}, advanced: {...} }
  generation_metadata JSONB, -- model used, tokens, generation time
  created_at TIMESTAMPTZ DEFAULT now(),
  view_count INTEGER DEFAULT 0,
  start_count INTEGER DEFAULT 0,
  completion_count INTEGER DEFAULT 0,
  is_cached BOOLEAN DEFAULT false -- reusable for similar queries
);

-- User progress through learning paths
fp_learning_progress (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  path_id UUID REFERENCES fp_learning_paths(id),
  started_at TIMESTAMPTZ DEFAULT now(),
  last_activity_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  current_item_index INTEGER DEFAULT 0,
  items_completed INTEGER DEFAULT 0,
  items_total INTEGER NOT NULL,
  time_invested_seconds INTEGER DEFAULT 0,
  notes JSONB, -- per-item notes
  exercise_results JSONB, -- per-exercise scores/responses
  status TEXT DEFAULT 'in_progress' -- 'in_progress', 'completed', 'abandoned'
);

-- User skill profile (aggregated from learning path completions)
fp_skill_profiles (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  topic_slug TEXT NOT NULL,
  skill_level NUMERIC DEFAULT 0, -- 0-100
  paths_completed INTEGER DEFAULT 0,
  exercises_completed INTEGER DEFAULT 0,
  exercises_correct INTEGER DEFAULT 0,
  time_invested_seconds INTEGER DEFAULT 0,
  last_studied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, topic_slug)
);

-- Signal-to-content resolution (links external signals to content lake items)
fp_signal_resolutions (
  id UUID PRIMARY KEY,
  signal_id UUID REFERENCES fp_signals(id),
  content_id UUID REFERENCES fp_content_lake(id),
  resolution_confidence NUMERIC, -- 0-1
  resolved_by TEXT, -- 'exact_match', 'fuzzy_match', 'ai_match'
  resolved_at TIMESTAMPTZ DEFAULT now()
);

-- Learning path discussions
fp_path_discussions (
  id UUID PRIMARY KEY,
  path_id UUID REFERENCES fp_learning_paths(id),
  user_id UUID REFERENCES auth.users(id),
  content_item_index INTEGER, -- which item in the path this relates to
  message TEXT NOT NULL,
  is_ai BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**New pgvector setup:**

```sql
-- Enable the vector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to content lake
-- Using 1536 dimensions (OpenAI text-embedding-3-small output size)
-- Index for fast similarity search
CREATE INDEX idx_content_lake_embedding ON fp_content_lake
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Semantic search function
CREATE OR REPLACE FUNCTION search_content(
  query_embedding VECTOR(1536),
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 30,
  filter_topics TEXT[] DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  source_type TEXT,
  quality_score NUMERIC,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    cl.id,
    cl.title,
    cl.source_type,
    cl.quality_score,
    1 - (cl.embedding <=> query_embedding) AS similarity
  FROM fp_content_lake cl
  WHERE cl.status = 'approved'
    AND 1 - (cl.embedding <=> query_embedding) > match_threshold
    AND (filter_topics IS NULL OR cl.topics && filter_topics)
  ORDER BY cl.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

### 3.3 New API Routes

```
app/api/learn/
  search/route.ts           — POST: semantic search + path generation
  paths/route.ts            — GET: list user's paths, POST: create/save path
  paths/[id]/route.ts       — GET: path details, PATCH: update progress
  paths/[id]/discuss/route.ts — GET/POST: discussion thread
  skills/route.ts           — GET: user's skill profile
  trending/route.ts         — GET: trending topics for Learn home
  exercise/check/route.ts   — POST: AI evaluation of exercise response

app/api/content/
  ingest/rss/route.ts       — POST: trigger RSS ingestion (cron)
  ingest/articles/route.ts  — POST: fetch + evaluate articles (cron)
  resolve-signals/route.ts  — POST: entity resolution (cron)
  embed/route.ts            — POST: generate embeddings for new content (cron)
```

### 3.4 New Cron Jobs

| Cron | Route | Schedule | Purpose |
|------|-------|----------|---------|
| RSS Ingestion | `/api/content/ingest/rss` | Every 30 min | Poll RSS feeds, discover new articles |
| Article Evaluation | `/api/content/ingest/articles` | Every 2h | Fetch, evaluate, and index new articles |
| Signal Resolution | `/api/content/resolve-signals` | Every 2h | Link signals to content items |
| Embedding Generation | `/api/content/embed` | Every 2h | Generate embeddings for new content |
| Learning Path Cache | `/api/learn/cache-popular` | Daily | Pre-generate paths for trending topics |

### 3.5 Frontend Routes and Components

```
app/
  (learn)/learn/
    page.tsx                    — Learn home (search bar, trending, suggestions)
    search/page.tsx             — Search results / path preview
    paths/[id]/page.tsx         — Learning environment (content viewer + path sidebar)
    profile/page.tsx            — Skill profile and history

components/
  learn/
    SearchBar.tsx               — Prominent search input with suggestions
    LearningPath.tsx            — Path preview card (sections, items, metadata)
    LearningEnvironment.tsx     — Main learning UI (content viewer + sidebar + tutor)
    ContentViewer.tsx            — Format-adaptive content renderer
    VideoViewer.tsx             — Reuses BreakVideoOverlay internals
    ArticleViewer.tsx           — Clean reader view for articles
    ExerciseViewer.tsx          — Interactive practice workspace
    PathSidebar.tsx             — Vertical checklist of path items
    AiTutor.tsx                 — Chat panel with context-aware AI tutor
    SkillProfile.tsx            — Skill bars and progression display
    TrendingTopics.tsx          — Trending topic pills for Learn home
    PathDiscussion.tsx          — Discussion thread per path
```

---

## Part 4: The Growth Flywheel

### 4.1 How the System Gets Smarter

Every interaction makes the content lake richer:

1. **User searches** reveal demand. If 50 people search "AI agents" this week, that's a first-party signal that this topic is hot — independent of Reddit or HN. The system should prioritize discovering and evaluating content on high-demand topics.

2. **User completions** validate quality. If users consistently complete a video (>80% watch time), that's a stronger quality signal than any AI evaluation. Feed this back into the quality score.

3. **User ratings** (simple thumbs up/down on content items) provide direct feedback. Low-rated content gets deprioritized. High-rated content gets boosted.

4. **Learning paths improve through usage.** If users consistently drop off at item 4 in a path, maybe item 4 is bad or the sequencing is wrong. Track per-item drop-off and use it to regenerate better paths.

5. **Exercise feedback.** When users submit exercise responses and get AI evaluation, the results tell you: is this exercise too hard? Too easy? Poorly worded? Use this to improve exercise generation prompts.

### 4.2 How Users Bring Other Users

**Shareable learning paths.** Every path has a clean URL. When someone shares "I just completed this learning path on RAG pipelines — really good" on Twitter/LinkedIn, the link goes to a preview page that shows the path structure, quality scores, and "Start Learning" CTA. The person sharing is implicitly endorsing the platform's curation quality.

**Skill profiles as professional signals.** A user's skill profile ("I've completed 12 learning paths on AI engineering topics, 47 hours invested") becomes a professional asset they want to share. Think LinkedIn badges but backed by actual learning activity, not just a multiple-choice quiz.

**"Learn together" invitations.** When a user starts a learning path, they can invite friends/colleagues: "Hey, let's learn RAG together this week." The invitee signs up, joins the same path, and they can see each other's progress. Social accountability applied to learning.

**Topic-specific landing pages.** SEO play: generate landing pages for popular topics ("Learn Prompt Engineering — Free AI-Curated Path"). These rank for high-intent queries and bring organic traffic directly into the Learn experience.

### 4.3 Room-to-Learn and Learn-to-Room Bridges

These two experiences should feed each other:

**Room → Learn:** During a break, the user watches a video about RAG. After the break, a subtle prompt: "Want to go deeper on RAG? We have a 2.5-hour learning path." The break was the teaser; Learn is the full experience.

**Learn → Room:** After completing a learning path (or partway through), suggest: "Practice what you learned in a live session. Join the AI Engineering room — 3 people focusing right now." The learning path provided knowledge; the Room provides the focused time to apply it.

**Auto-generated Rooms from popular paths:** If a learning path gets 100+ starts in a week, the system can auto-generate a dedicated Room for that topic — with the path's content as break material and a topic-specific AI host. This is your existing auto room generation system, triggered by Learn demand instead of (or in addition to) topic heat.

---

## Part 5: What Could Go Wrong (And How to Prevent It)

### 5.1 Content Quality Risks

**Risk: AI-generated content feels generic or wrong.**
Mitigation: Always label AI content clearly. Gate generated exercises through self-validation. User feedback loop with fast removal of low-rated generated content. Start with generated content as a small percentage (20%) of learning paths, increasing as quality improves.

**Risk: Stale content in learning paths.**
Mitigation: Learning paths have a freshness check. If any item in a path has been superseded by newer, higher-quality content on the same subtopic, flag the path for regeneration. The system knows when new content enters the lake.

**Risk: Low-quality articles getting indexed.**
Mitigation: The RSS feed list is curated (only trusted sources). Article evaluation uses the same AI quality gate as videos. Articles from unknown sources need higher quality scores to be included. Signal validation provides a second check.

### 5.2 UX Risks

**Risk: Learning paths feel like AI slop — generic, formulaic, soulless.**
Mitigation: The path structure should feel hand-curated, not algorithmic. Strong editorial voice in the connective text. Personality in the AI tutor. High-quality content selection (better to have a 6-item path with all great content than a 12-item path with filler). Let users provide feedback and regenerate paths with preferences.

**Risk: Too much choice paralysis on the Learn home screen.**
Mitigation: Lead with trending topics (3-5 maximum) and personalized suggestions (based on their Room activity and taste profile). The search bar is the primary action. Don't show a wall of 50 topics.

**Risk: Users start paths but don't finish them.**
Mitigation: Short paths by default (5-8 items, 1-2 hours). Longer paths broken into sections that feel complete on their own. Progress saves automatically. Gentle re-engagement ("You're 2 items from finishing your RAG path"). No punishment for abandoning — but the skill profile only updates on section completion, creating natural motivation.

### 5.3 Technical Risks

**Risk: pgvector search quality is poor.**
Mitigation: Embedding quality depends on the text you embed. For videos, embed title + description + transcript summary (not full transcript — too noisy). For articles, embed title + first 500 words. Test search quality manually before launching. Tune the similarity threshold (start at 0.7, adjust based on results).

**Risk: YouTube API quota isn't enough for real-time gap-filling.**
Mitigation: Gap-filling should be rare if the content lake is well-stocked. Pre-populate the lake broadly (expand from 5 worlds to 50+ topics). Cache learning paths so the same query doesn't trigger repeated gap-filling. Budget: reserve 2,000 units/day for Learn gap-filling (20 searches), use the rest for the regular pipeline. If this isn't enough, YouTube offers paid quota increases.

**Risk: Learning path generation is too slow (> 5 seconds).**
Mitigation: The expensive step is path generation (1 GPT-4o-mini call, ~2-3 seconds). Content retrieval via pgvector is < 100ms. Pre-cache paths for trending topics (daily cron). For popular queries, serve the cached path instantly. For novel queries, show a loading state with the search results appearing immediately and the path structure assembling in real-time (streaming).

**Risk: The content lake grows too large for pgvector performance.**
Mitigation: pgvector with IVFFlat index handles millions of vectors. At your scale (tens of thousands of content items), this is a non-issue for years. If it ever becomes one, Supabase supports HNSW indexes which are faster for large datasets.

### 5.4 Business Risks

**Risk: Building Learn takes so long that Rooms stagnates.**
Mitigation: Ship incrementally. Layer 1 (search + results) is buildable in 3-4 weeks and provides immediate value. Layer 2 (learning paths + environment) is another 3-4 weeks. Layer 3 (social, progression, skill profiles) is ongoing iteration. Each layer is independently useful.

**Risk: Users want Learn but not Rooms (or vice versa).**
This isn't a risk — it's a feature. Let users choose. Some people want the accountability structure. Some people want self-directed learning. Having both means a wider funnel. The bridge between them (Room → Learn, Learn → Room) converts users from one to the other naturally.

**Risk: Competing with YouTube / Coursera / Skillshare on their turf.**
You're NOT competing with them. YouTube has content but no curation, no paths, no progression. Coursera has structured courses but they're expensive, slow to update, and not personalized. Skillshare has creative courses but no AI, no real-time content, no community. You have: AI curation of the entire internet's best learning content + real-time freshness + multi-signal quality validation + social accountability + personalized paths + progression tracking. That combination doesn't exist anywhere.

---

## Part 6: Implementation Roadmap

### Phase 1: Foundation (Weeks 1-3)
**Goal: Content lake + semantic search working.**

- Enable pgvector on Supabase
- Create `fp_content_lake` table (or evolve existing tables)
- Build embedding pipeline: generate embeddings for all existing evaluated content
- Build the `search_content()` pgvector function
- Build `/api/learn/search` endpoint: takes a query, returns ranked content
- Build basic Learn page with search bar and results list
- Wire up RSS ingestion for 20-30 top AI/tech blogs
- Wire up article evaluation pipeline (reuse scoring.ts patterns)

**What this unlocks:** Users can search for any AI topic and get quality-ranked results from video + articles. No learning paths yet — just better search.

### Phase 2: Learning Paths (Weeks 4-6)
**Goal: AI-generated learning paths with a focused environment.**

- Build path generation: intent parsing → content retrieval → AI sequencing
- Build `fp_learning_paths` and `fp_learning_progress` tables
- Build the learning environment UI: content viewer + path sidebar + progress tracking
- Reuse BreakVideoOverlay for video playback
- Build ArticleViewer for reading view
- Build AI tutor chat panel (adapt host prompt patterns)
- Build auto-advance between path items
- Wire up progress persistence

**What this unlocks:** Users search, get a structured learning path, and work through it in a focused environment. The core Learn experience is live.

### Phase 3: Exercises and Practice (Weeks 7-8)
**Goal: AI-generated practice makes paths interactive.**

- Build ExerciseViewer component (prompt, workspace, hints, check)
- Build `/api/learn/exercise/check` for AI evaluation of responses
- Integrate scaffolding generator into path generation (reuse existing scaffolding system)
- Add exercises at natural points in learning paths (after every 2-3 consumption items)

**What this unlocks:** Learning paths aren't just watching and reading — they include practice. This is the differentiator from YouTube.

### Phase 4: Multi-Signal Quality (Weeks 9-10)
**Goal: Convergent quality validation from multiple sources.**

- Build signal entity resolution pipeline
- Create `fp_signal_resolutions` table
- Update quality_score formula to incorporate signal confidence
- Build signal resolution cron job
- Update search ranking to use composite quality scores

**What this unlocks:** Content quality is validated by multiple independent sources, not just AI evaluation. Search results get dramatically more trustworthy.

### Phase 5: Progression and Social (Weeks 11-14)
**Goal: Skill profiles, streaks, and social learning.**

- Build `fp_skill_profiles` table
- Build skill profile page (topic bars, history, suggestions)
- Build streak tracking and weekly goals
- Build "others learning this" social proof
- Build path discussion threads
- Build Room-to-Learn and Learn-to-Room bridges
- Build shareable path URLs with preview pages

**What this unlocks:** The full Learn experience with progression, social proof, and connection to Rooms. The product flywheel is running.

### Phase 6: Scale and Polish (Ongoing)
- Pre-cache learning paths for trending topics
- Expand RSS feed list to 100+ sources
- Add documentation ingestion
- Podcast ingestion
- Collaborative filtering for path recommendations
- A/B test path generation prompts
- SEO landing pages for popular topics
- Creator notifications when their content is featured

---

## Part 7: Success Metrics

**Leading indicators (track from day 1):**
- Searches per day (demand signal)
- Paths started per day (conversion from search)
- Items completed per path (engagement depth)
- Return rate (% of users who come back to Learn within 7 days)

**Lagging indicators (track from Phase 3+):**
- Paths completed (full completion rate)
- Exercises attempted and passed
- Skill profile growth (topics added, levels increased)
- Room-to-Learn conversion rate (break → learning path)
- Learn-to-Room conversion rate (path → live session)
- Shareable link click-through rate (growth)

**North star metric:**
Weekly learning hours per active user. This measures whether people are actually using Skillgap as their primary learning environment — not just searching once and leaving.

---

## Appendix: Cost Model at Scale

| Component | Per Unit Cost | At 1K DAU | At 10K DAU |
|-----------|-------------|-----------|------------|
| Embeddings (new content) | $0.02/1M tokens | $0.50/day | $0.50/day (same — content ingestion doesn't scale with users) |
| Path generation | $0.02/path | $10/day | $40/day (with caching reducing unique generations) |
| Exercise evaluation | $0.005/check | $5/day | $25/day |
| AI tutor responses | $0.003/response | $6/day | $30/day |
| YouTube API | 10K units free | Sufficient | May need paid quota ($0 - $200/mo) |
| RSS/Reddit/HN | Free | Free | Free |
| Supabase (pgvector + storage) | Usage-based | ~$25/mo | ~$75/mo |
| **Total** | | **~$25/day** | **~$100/day** |

At 10K daily active users with a $10/month subscription (even at 5% conversion to paid), revenue = $50K/month. Costs = ~$3K/month. The unit economics work comfortably.
