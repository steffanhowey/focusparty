# Skillgap.ai — Complete Project Context

## What This Product Is

Skillgap.ai is an always-on, AI-native learning environment where professionals close the gap between their current skills and what the AI-driven market demands. Users join themed rooms, do timed focus sprints alongside others, consume AI-curated YouTube content during breaks, and track their skill progression over time.

Think of it as: Duolingo's daily habit loop + Focusmate's social accountability + AI coaching + live, curated learning content — all in one product.

The product is live and functional at focusparty.com (rebranding to Skillgap.ai is pending). The codebase still uses "FocusParty" internally — all database tables are prefixed `fp_`, the repo is called `focusparty`.

## Tech Stack

- **Framework:** Next.js 16 (App Router) on Vercel (serverless functions, 60s timeout)
- **Database:** Supabase (PostgreSQL), auth via magic link OTP, realtime via Supabase Channels
- **Storage:** Supabase Storage (buckets: avatars, room-backgrounds)
- **AI/LLM:** OpenAI (`openai@^6.27.0`) — `gpt-4o-mini` for all chat completions, `gpt-image-1` for image generation
- **Content Source:** YouTube Data API v3 (10,000 unit daily quota)
- **Transcripts:** `youtube-caption-extractor` npm package
- **CSS:** Tailwind CSS v4
- **DnD:** `@dnd-kit/core` + `@dnd-kit/sortable`
- **Icons:** `lucide-react`
- **Cron:** Vercel Cron (13 scheduled jobs in `vercel.json`)

## Core User Experience

### The Room

Users join persistent rooms (called "parties" internally — `fp_parties`). Each room has a theme/world (vibe-coding, writer-room, etc.), an AI host personality, and configurable sprint settings. There are 5 hardcoded rooms: Focus Room (default), Vibe Coding, Writer Room, YC Build Party, Gentle Start. Auto-generated rooms can also be created by the content intelligence engine (see below).

### The Sprint Cycle

1. **Setup** — User selects a task/goal and sprint duration (15/25/50/75 min)
2. **Breathing** — Optional 3-breath centering ritual
3. **Sprint** — Timed deep work with countdown timer, ambient music, participant presence
4. **Break** — User watches a curated YouTube video (3/5/10 min). Categories: Learning, Reset, Reflect, Move
5. **Review** — Post-sprint reflection (mood, productivity)
6. **Repeat** — Multiple sprints per session

The break experience is central to the learning proposition. Users pick a category, pick a duration, browse curated video cards, and watch in a draggable overlay with a custom player chrome (TV knob channel changer, scrub bar, play/pause, notes toggle). Breaks are lean-back-and-absorb — not structured homework.

### Social Layer

- Real-time participant presence via Supabase Channels (avatars, status, goals, break activity)
- Activity feed (sprints started/completed, goals declared/shipped, check-ins, high fives)
- AI host sends contextual messages at key moments (sprint start, midpoint, near-end, review)
- Room state engine computes ambient mood (quiet → warming up → focused → flowing → cooling down)

### Synthetic Users

AI-generated participants that create ambient activity in rooms. They set goals, complete sprints, and share status updates. Solves the cold-start problem. Runs every 2 minutes via cron. Each room has a synthetic roster with configurable archetype mix (coder, founder, writer, gentle).

## Content Intelligence Engine

This is the major backend system built across 7 engineering sprints. It automates the path from "something is trending in the AI world" to "there's curated learning content about it in the break experience."

### The Pipeline (runs autonomously via 13 Vercel cron jobs)

**Stage 1: Signal Collection** (every 15 min)
- 5 collectors: Reddit (11 subreddits), Hacker News (Algolia API), RSS (14 feeds), YouTube velocity detection, internal user demand signals
- Raw signals stored in `fp_signals`

**Stage 2: Topic Intelligence** (hourly)
- Canonical topic taxonomy (`fp_topic_taxonomy`) with hierarchy, categories, aliases
- LLM-powered signal clustering groups signals into topics
- Heat scoring formula: `(signalCount × 0.25 + velocity × 0.30 + sourceDiversity × 0.25 + contentCount × 0.20) × decayFactor`
- Topics transition through states: cold → emerging → hot → cooling
- Stored in `fp_topic_clusters`

**Stage 3: Discovery** (every 6h scheduled + every 2h hot-topic-triggered)
- YouTube API searches by world-specific queries and curated channel lists
- Hot-topic discovery targets trending topics specifically
- Duration filter: 2–15 min videos only
- Safety blocklist filtering
- Results stored in `fp_break_content_candidates`

**Stage 4: Evaluation** (2x daily)
- GPT-4o-mini with Structured Outputs scores each candidate on 7 dimensions: relevance (0.30), engagement (0.20), content_density (0.20), creator_authority (0.10), freshness (0.10), novelty (0.10) + mandatory safety score
- Hard gates: safety < 50 = reject, relevance < 40 = reject
- AI identifies best segments (3/5/10 min) with exact start timestamps
- AI assigns canonical topic tags
- Transcript fetched and cached (`fp_break_content_transcripts`)
- Results stored in `fp_break_content_scores`

**Stage 5: Scaffolding Generation** (2x daily, after evaluation)
- GPT-4o-mini generates learning scaffolding for each video scoring ≥ 55
- 5 components: pre-watch challenge, key moments with timestamps, comprehension checks, practice exercise with step-by-step instructions, discussion question
- Stored as JSONB in `fp_break_content_scores.scaffolding`
- Cost: ~$0.001-0.003 per video

**Stage 6: Shelf Promotion** (daily)
- Promotes scored + scaffolded candidates to `fp_break_content_items` (the active shelf)
- Each shelf bucket: (world_key × category × duration) holds 5-8 items
- Copies scaffolding data to shelf items during promotion
- Engagement feedback: +10 if >70% completion rate, -15 if >60% abandonment rate
- 7-day TTL, creator diversity enforcement (max 2 per creator per bucket)

**Stage 7: Auto Room Generation** (every 4h)
- When a topic sustains heat ≥ 0.8 for 12+ hours with 3+ scored candidates and 2+ scaffolded, the system auto-generates a complete room blueprint
- 3 LLM calls per room: curriculum sequencing (foundations → applied → advanced), room metadata (creative name, description, skill tags), AI host script with topic-specific personality
- Blueprints enter an editorial review queue — never auto-published
- On approval, provisioned into a live `fp_parties` room
- Room lifecycle management: engagement-based transitions (active → cooling → archived), content refresh, trending badges

### What the Pipeline Produces That Users Currently See

- **Curated break content** with AI quality scores, topic tags, and segment timestamps
- **Key moment markers** on the video scrub bar during breaks (small dots at timestamps where teachable concepts begin — lightweight, non-intrusive)
- **Taste profile personalization** — per-user topic preference learning adjusts content ordering
- **Auto-generated rooms** with curriculum sequences (when approved via admin review queue)

### What the Pipeline Produces That Users Don't Yet See

- **Scaffolding data** (pre-watch challenges, comprehension checks, exercises, discussion questions) — stored in the database but not surfaced in the break UI. The break experience was intentionally simplified after testing showed scaffolding felt like homework during breaks. This data is waiting for the right product surface — likely a separate "deep dive" or "practice" mode distinct from breaks.
- **Creator catalog** with authority scores and partnership tiers
- **Topic heat rankings** and trending signals
- **Room lifecycle analytics** and performance calibration data

## Key Product Decisions Made

1. **Breaks should be lean-back-and-absorb.** We built scaffolding UI (pre-watch cards, post-watch panels with comprehension checks and exercises) and tested it. It felt like homework during what should be a restorative break. We removed it from the break flow. The key moment markers stay because they help navigation without adding friction. The scaffolding data stays in the database for a future "deep dive" learning mode.

2. **YouTube embeds only.** We never download, re-host, or clip YouTube content. All videos served via YouTube's official embed player. Timestamp cueing is fine and encouraged. This is a legal and ethical hard line.

3. **Creator respect.** Every creator is tracked, scored, and credited. Opt-outs are respected immediately. The relationship with creators is a long-term asset.

4. **Human QA is non-negotiable (for now).** Auto-generated rooms go through an editorial review queue before publishing. The auto-approval engine exists (with 8-point criteria, confidence scoring, and kill switch) but starts disabled.

5. **gpt-4o-mini for everything.** Cost awareness is a core constraint. All LLM calls use the cheapest capable model. Batch processing, cooldowns, and caching keep costs under $0.20/day for the full pipeline.

6. **No infrastructure complexity.** No message queues, no Redis, no separate worker infrastructure. Everything runs as Vercel serverless functions. If a function hits the 60s timeout, optimize the function — don't add infrastructure.

## Database

All tables prefixed `fp_`, UUIDs for primary keys, `snake_case` columns, `TIMESTAMPTZ` with `DEFAULT now()`, JSONB for flexible data. Supabase admin client at `lib/supabase/admin.ts`.

### Key Tables

**Content & Breaks:**
- `fp_break_content_candidates` — Raw YouTube candidates from discovery
- `fp_break_content_scores` — AI evaluation results + scaffolding JSONB
- `fp_break_content_transcripts` — Cached video transcripts
- `fp_break_content_items` — Active shelf content served during breaks (with scaffolding)
- `fp_break_engagement` — User break interaction events
- `fp_user_taste_profiles` — Per-user per-topic preference weights
- `fp_scaffolding_events` — Scaffolding interaction tracking

**Topic Intelligence:**
- `fp_topic_taxonomy` — Canonical topics with hierarchy, categories, aliases
- `fp_signals` — Raw signal events from all 5 sources
- `fp_topic_clusters` — Active topic clusters with heat scores

**Rooms:**
- `fp_parties` — Room definitions (name, world_key, host_personality, status, blueprint_id, is_trending, topic_slug, generation_source)
- `fp_party_participants` — Room membership
- `fp_room_blueprints` — AI-generated room configs (curriculum_sequence, content_selection, host scripts, review_status)

**Sessions & Activity:**
- `fp_sessions` — Focus sessions
- `fp_session_sprints` — Sprints within sessions
- `fp_session_goals` — Session goals
- `fp_activity_events` — Activity feed events
- `fp_notes` — Quick session notes

**Creators:**
- `fp_creators` — Dynamic creator catalog with authority scores, topic specialties, partnership status, opt-out handling

**Analytics:**
- `fp_content_performance` — Daily content engagement rollups
- `fp_room_performance` — Daily room session/sprint rollups
- `fp_scoring_config` — Runtime-adjustable scoring weights
- `fp_pipeline_events` — Structured event logging for all cron jobs

## Codebase Structure

**87 API routes**, **142 components**, **131 lib modules**, **13 cron jobs**, **5 hardcoded worlds**, **5 host personalities**.

```
app/
  (admin)/admin/        — 15 admin dashboard pages
  (auth)/               — Login/signup flows
  (hub)/                — User dashboard
  (lobby)/rooms/        — Public room browsing
  (marketing)/          — Marketing homepage
  environment/[id]/     — Party room (main user experience)
  session/              — Solo focus session
  api/                  — 87 API route handlers
    breaks/             — Content pipeline (12 routes)
    topics/             — Topic clustering
    signals/            — Signal collection
    rooms/              — Room auto-generation + lifecycle
    analytics/          — Performance aggregation + calibration
    admin/              — 39 admin data endpoints
    synthetics/         — Synthetic user system
    pipeline/           — Pipeline orchestration (run-all, status)

lib/
  breaks/               — Content pipeline (discovery, scoring, shelf, transcripts, taste profiles)
  signals/              — 5 signal collectors + config
  topics/               — Topic taxonomy, heat engine, clustering
  scaffolding/          — Learning scaffolding generator
  rooms/                — Room auto-generation, eligibility, lifecycle, content selection
  roomFactory/          — Room blueprint generation + provisioning
  synthetics/           — Synthetic user engine
  analytics/            — Performance, calibration, heat validation
  creators/             — Creator catalog
  pipeline/             — Pipeline event logging
  supabase/             — Supabase client (admin + server)

components/
  admin/                — Admin dashboard views
  environment/          — Session environment (background, participants, breaks UI)
  session/              — Session controls (ActionBar, timers, reviews)
  party/                — Room UI (cards, lobby, live feed)
  goals/                — Goal management
  ui/                   — Base components (Button, Card, MenuItem)
```

## AI/LLM Patterns

All LLM calls use OpenAI's Structured Outputs with `gpt-4o-mini`:

```typescript
const response = await openai.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
  response_format: {
    type: 'json_schema',
    json_schema: { name: 'schema_name', strict: true, schema: { /* ... */ } }
  }
});
const result = JSON.parse(response.choices[0].message.content);
```

All AI calls must fail gracefully — return safe defaults on error. Never let an LLM failure crash the pipeline. All content evaluation prompts must include the `SAFETY_PROMPT` constant from `lib/breaks/contentSafety.ts`.

## Admin Dashboard

15 admin pages with real-time data:
- **Pipeline Health** — Job status, alerts, "Run Now" buttons, event timeline
- **Review Queue** — Auto-generated room blueprints (pending/approved/rejected), 4-tab preview
- **Topics Intelligence** — Heat table, topic detail with signals/content/rooms tabs
- **Content Pipeline** — 4-stage funnel, content table with scores and scaffolding status
- **Creator Catalog** — Creator table with authority scores and topic pills
- **Analytics** — Score accuracy, heat accuracy, auto-approval config
- **Rooms, Synthetics, Backgrounds, Users, Settings** — Operational management

## What's Next (Product/GTM Phase)

The 7 engineering sprints are complete. The content intelligence engine runs end-to-end. The next phase is product-facing:

1. **Deep Dive / Practice Mode** — A separate learning experience (distinct from breaks) where scaffolding data is surfaced: structured exercises, comprehension checks, pre-watch challenges. This is where the scaffolding investment pays off.
2. **Creator Partnership Portal** — Public-facing creator pages, partnership tiers, performance dashboards for creators
3. **FocusParty → Skillgap.ai Rebrand** — Domain, UI, copy, identity
4. **Onboarding** — First-run experience, skill assessment, room recommendations
5. **Pricing** — Free tier, Pro tier, team/enterprise

## Common Pitfalls & Constraints

- **Supabase MCP is connected to the WRONG project** (Inflow, not SkillGap). Never use Supabase MCP tools. Always provide SQL in chat for manual execution.
- **YouTube API quota:** 10,000 units/day. Hot-topic discovery budgets 3,000 units. Discovery cron is careful about quota.
- **Vercel 60s timeout:** All serverless functions must complete within 60 seconds. The auto room generator has a 40s timeout guard to leave buffer.
- **Content pipeline runs on Vercel Cron** — locally, nothing runs automatically. Use the `POST /api/pipeline/run-all` endpoint to trigger stages manually during development.
- **The break experience should stay simple.** We tested structured scaffolding in breaks and removed it. Breaks = lean back and absorb. Don't re-add friction to the break flow.
