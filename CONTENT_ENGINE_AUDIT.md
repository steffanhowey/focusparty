# Content Intelligence & Signal Detection System — Audit Report

**Date:** 2026-03-13
**Auditor:** Claude (automated codebase audit)
**Scope:** All content discovery, ingestion, scoring, and surfacing systems in SkillGap

---

## Executive Summary

- **A sophisticated 3-stage content pipeline exists** (discover → evaluate → shelf) powered by YouTube Data API v3 + GPT-4o-mini, running on Vercel Cron. It discovers YouTube videos, scores them with AI editorial personas, and promotes winners to a living shelf of 5-8 items per (world, category, duration) bucket.
- **YouTube is the sole external content source.** No Reddit, HN, Twitter, RSS, or any other signal source is integrated. Content discovery is entirely YouTube search + channel-targeted queries.
- **AI is deeply embedded** across 8+ distinct use cases: content evaluation, room blueprint generation, host messages, synthetic coworker status, avatar/background image generation, and goal/task suggestions. All use GPT-4o-mini (chat) or gpt-image-1 (images).
- **Personalization exists but is early-stage.** A taste profile engine tracks per-user topic weights from engagement signals (completed/abandoned breaks), with decay and personalized content ordering. However, it's not yet wired into all content surfaces.
- **No trend detection, topic clustering, or cross-source signal aggregation exists.** Topics are assigned per-video by the AI evaluator (3-5 tags) but there's no system-level trend analysis, heat mapping, or viral detection.

---

## Detailed Findings

### 1. Signal Collection & Monitoring

**What exists:**
- YouTube Data API v3 is the sole signal source for content discovery
- Channel-targeted searches (curated list of ~15-20 channels across worlds)
- Topic-based searches (2 random queries per run from world break profiles)
- User engagement signals: `started`, `completed`, `abandoned`, `extended` events tracked in `fp_break_engagement`
- Room activity monitoring for synthetic presence (every 2 minutes)

**How it works:**
- Discovery runs every 6 hours via Vercel Cron (`/api/breaks/discover`)
- Each run picks the world with the oldest discovery timestamp (`pickNextWorldKey()`)
- Executes 2 topic queries + 1 channel search per world/category
- Results filtered by duration (4-20 min), safety blocklist, and deduplication

**Limitations:**
- Single source dependency (YouTube only)
- No real-time signal detection — purely cron-driven at fixed 6h intervals
- No monitoring of social signals (Twitter/X mentions, Reddit discussions, HN posts)
- No RSS feed ingestion for blogs, newsletters, or podcasts
- World rotation means each world gets discovered roughly once per 30h (5 worlds × 6h)

**Key files:**
- `lib/breaks/discovery.ts` — Core discovery engine (272 lines)
- `lib/breaks/youtubeClient.ts` — YouTube API wrapper (153 lines)
- `lib/breaks/worldBreakProfiles.ts` — Search queries, channels, editorial personas
- `lib/breaks/contentSafety.ts` — Pre-screening blocklist (181 lines)
- `app/api/breaks/discover/route.ts` — Cron endpoint

---

### 2. YouTube Integration

**What exists:**
- **Search endpoint** (`youtube/v3/search`): Topic + channel queries with `part=snippet`, `type=video`, `videoEmbeddable=true`, `safeSearch=strict`
- **Video details endpoint** (`youtube/v3/videos`): `part=snippet,contentDetails,statistics` for duration, view/like/comment counts
- **Transcript extraction**: `youtube-caption-extractor` npm package for fetching captions
- **Creator catalog**: Hardcoded in `worldBreakProfiles.ts` per world — each world has 3-6 channels with `channelId`, `label`, and optional `query`
- **Metadata stored per video**: title, description, creator, video_url, thumbnail_url, duration_seconds, published_at, view_count, like_count, comment_count
- **Segment identification**: AI identifies best 3/5/10-min segments with exact start timestamps and labels

**How it works:**
- `searchVideos()` costs 100 quota units per call (capped at 10 results)
- `getVideoDetails()` costs 1 quota unit per video (batched up to 50)
- Transcripts are optionally fetched during evaluation for content density assessment
- Videos are embedded via standard YouTube iframe (video_url stored as `youtube.com/watch?v=`)
- Segments include start time in seconds — used to cue the player to specific timestamps

**Limitations:**
- No YouTube Channels API usage (no subscriber counts, no channel-level metadata)
- No YouTube Captions API (relies on npm package that may break)
- No auto-trimming or clip extraction — just timestamp cueing
- No playlist API integration
- Creator catalog is entirely manual (hardcoded channel IDs)
- No mechanism to discover new creators — only searches within known channels or by topic keywords
- YouTube API daily quota (10,000 units) could become a bottleneck at scale

**Key files:**
- `lib/breaks/youtubeClient.ts` — API client (search + video details)
- `lib/breaks/transcript.ts` — Caption fetching and formatting
- `lib/breaks/worldBreakProfiles.ts` — Channel catalog and search queries
- `lib/youtube.ts` — URL extraction and thumbnail helpers

---

### 3. Content Curation & Scoring

**What exists:**
- **AI taste scoring engine** using GPT-4o-mini with Structured Outputs
- **7 weighted dimensions**: relevance (0.30), engagement (0.20), content density (0.20), creator authority (0.10), freshness (0.10), novelty (0.10), + mandatory safety score
- **Editorial personas** per world + category with voice prompts, reject/prefer patterns
- **Creator authority boosts**: Named creators get additive score bonuses (15-20 points)
- **Freshness bonuses**: +20 (<24h), +10 (<72h), +5 (<7d), -10 (>30d for low-authority creators)
- **Hard gates**: Safety score < 50 = reject, Relevance < 40 = reject
- **Engagement feedback loop**: Shelf items adjusted by completion rate (+10 if >70% completion, -15 if >60% abandonment)
- **User taste profiles**: Per-topic weights learned from engagement, with decay

**How it works:**
1. Candidates enter as `status: "pending"` from discovery
2. Evaluation cron (2x daily) processes up to 30 candidates per run
3. Each candidate scored via single GPT-4o-mini call with full editorial context
4. Server-side freshness + creator boosts applied on top of AI scores
5. Shelf refresh (daily) promotes candidates scoring >= 55 to active shelf
6. Engagement signals continuously adjust shelf item scores

**Limitations:**
- Evaluation is sequential (no parallelism) — 30 candidates × ~2s each = ~60s per batch
- No A/B testing of editorial personas or scoring weights
- Creator authority is binary (boost or no boost) — no gradient of authority
- Topic tags are AI-generated but not validated against a taxonomy
- Personalization (taste profiles) is built but unclear if it's fully wired to content ordering on the frontend
- No collaborative filtering (users who liked X also liked Y)
- No content diversity enforcement beyond max 2 per creator per bucket

**Key files:**
- `lib/breaks/scoring.ts` — AI evaluation engine (339 lines)
- `lib/breaks/evaluateBatch.ts` — Batch processor
- `lib/breaks/shelf.ts` — Shelf management and promotion (397 lines)
- `lib/breaks/freshness.ts` — Freshness dimension + bonus computation
- `lib/breaks/tasteProfile.ts` — User preference learning (238 lines)
- `lib/breaks/worldBreakProfiles.ts` — Editorial personas and creator boosts

---

### 4. Topic/Trend Detection

**What exists:**
- **Per-video topic tagging**: AI assigns 3-5 lowercase hyphenated tags during evaluation (e.g., "react-hooks", "system-design", "creative-coding")
- **Topic-based personalization**: User taste profiles track per-topic weights
- **Freshness scoring**: Recent content gets score boosts, creating a weak trend signal

**How it works:**
- Topics are extracted by GPT-4o-mini as part of the evaluation prompt
- Stored in `topics` field on both `fp_break_content_scores` and `fp_break_content_items`
- Taste profiles use these topics to personalize ordering

**Limitations:**
- **No trend detection system exists.** No clustering, no heat mapping, no virality tracking
- **No cross-content topic analysis** — topics are assigned independently per video
- **No NLP or keyword extraction** beyond AI evaluation — no embedding-based similarity
- **No topic taxonomy** — tags are freeform, potentially inconsistent across evaluations
- **No "trending now" signal** — no mechanism to detect when a topic suddenly gains multiple high-quality videos
- **No external trend signals** (Google Trends, Twitter trending, HN front page, etc.)

**Key files:**
- `lib/breaks/scoring.ts` (topic extraction in evaluation prompt, lines 141-142)
- `lib/breaks/tasteProfile.ts` (topic-based personalization)

---

### 5. Room Generation

**What exists:**
- **AI-powered Room Factory**: Generates complete room blueprints from archetype + topic + audience input
- **5 room archetypes**: coder, writer, founder, gentle, custom
- **6-domain blueprint**: world config, host config, synthetic config, break profile, visual profile, discovery config
- **5 hardcoded worlds**: default, vibe-coding, writer-room, yc-build, gentle-start (each fully configured)
- **Blueprint storage**: `fp_room_blueprints` table with draft/approved/provisioned status
- **Admin wizard**: Step-by-step room creation UI with blueprint preview and provisioning
- **Room DNA caching**: In-memory cache of room configs loaded from blueprints

**How it works:**
1. Admin selects archetype + provides room details
2. GPT-4o-mini generates a complete blueprint using reference world as context
3. Blueprint stored as draft in `fp_room_blueprints`
4. Admin reviews, optionally regenerates, then provisions
5. Provisioning creates `fp_parties` row, generates invite code, caches DNA

**Limitations:**
- **No auto-generation of learning scaffolding** — no exercises, prompts, or discussion questions generated from video content
- **No learning path construction** — rooms don't have progressive curricula
- **Room ↔ content matching is world-level only** — no fine-grained topic matching between room themes and specific content
- **AI host gets generic trigger-based context** — no deep understanding of the room's current content or topic
- **No room analytics** — no tracking of which rooms retain users or produce better outcomes
- **Blueprint generation is single-shot** — no iterative refinement or feedback loop

**Key files:**
- `lib/roomFactory/blueprintPrompt.ts` — Prompt construction + JSON schema (494 lines)
- `lib/roomFactory/provision.ts` — Provisioning logic (260 lines)
- `app/api/admin/rooms/generate-blueprint/route.ts` — Blueprint generation endpoint
- `app/api/admin/rooms/provision/route.ts` — Provisioning endpoint
- `lib/roomDna.ts` — Room config caching
- `lib/worlds.ts` — Hardcoded world configurations
- `lib/hosts.ts` — Host personality configurations
- `components/admin/rooms/CreateRoomWizard.tsx` — Admin UI (571 lines)

---

### 6. Data Models & Storage

**Database:** Supabase (PostgreSQL). All tables prefixed `fp_`. Project ID: `lipdyycqbuvibgxcckjd`.

#### Content & Break Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `fp_break_content_candidates` | Raw YouTube video candidates | source, external_id, world_key, category, title, description, creator, video_url, thumbnail_url, duration_seconds, published_at, view_count, like_count, comment_count, status (pending/evaluated/promoted/rejected) |
| `fp_break_content_scores` | AI evaluation results | candidate_id (FK), world_key, taste_score, relevance_score, engagement_score, content_density, creator_authority, freshness_score, novelty_score, segments (JSONB), best_duration, topics (JSONB), editorial_note, evaluated_at |
| `fp_break_content_items` | Active shelf content | room_world_key, category, title, description, video_url, thumbnail_url, source_name, duration_seconds, status (active/expired), pinned, expires_at, taste_score, editorial_note, segments (JSONB), best_duration, topics (JSONB), sort_order, candidate_id |
| `fp_break_engagement` | User break interactions | content_item_id (FK), user_id (FK), event_type (started/completed/abandoned/extended), elapsed_seconds |
| `fp_user_taste_profiles` | Per-user topic preferences | user_id, world_key, topic, weight (-1.0 to 1.0), interactions, updated_at |

#### Room & Party Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `fp_parties` | Room definitions | name, character, status (waiting/active/completed), world_key, host_personality, max_participants, persistent, invite_code, blueprint_id |
| `fp_party_participants` | Room membership | party_id (FK), user_id (FK), role, joined_at |
| `fp_room_blueprints` | AI-generated room configs | archetype, room_name, room_description, topic, audience, world_config (JSONB), host_config (JSONB), synthetic_config (JSONB), break_profile (JSONB), visual_profile (JSONB), discovery_config (JSONB), status (draft/approved/provisioned), generation_model, created_by |
| `fp_room_background_jobs` | Background gen jobs | world_key, prompt_text, prompt_hash, status (pending/generating/completed/failed), candidates_count |
| `fp_room_background_assets` | Generated background images | world_key, job_id (FK), storage_path, public_url, status (candidate/approved/active/archived), dimensions, time_of_day_state |

#### Session & Activity Tables

| Table | Purpose |
|-------|---------|
| `fp_sessions` | Focus sessions |
| `fp_session_sprints` | Sprints within sessions |
| `fp_session_goals` | Session goals |
| `fp_activity_events` | Activity feed (user/host/system/synthetic actors) |
| `fp_notes` | Quick session notes |
| `fp_commitments` | Accountability commitments |

#### Task & Project Tables

| Table | Purpose |
|-------|---------|
| `fp_tasks` | Global task system |
| `fp_projects` | Task projects |
| `fp_labels` | Task labels |
| `fp_task_labels` | Task-label junction |
| `fp_goals` | Long-term goals |

#### User Tables

| Table | Purpose |
|-------|---------|
| `fp_profiles` | User profiles (avatar, timezone, plan) |

#### Relationships

```
fp_break_content_candidates
  └── fp_break_content_scores (candidate_id → candidates.id)
  └── fp_break_content_items (candidate_id → candidates.id)
       └── fp_break_engagement (content_item_id → items.id)

fp_user_taste_profiles (user_id → auth.users.id)

fp_parties
  ├── fp_party_participants (party_id → parties.id)
  ├── fp_room_blueprints (blueprint_id → blueprints.id)
  └── fp_activity_events (party_id → parties.id)

fp_room_background_jobs
  └── fp_room_background_assets (job_id → jobs.id)
```

---

### 7. Background Jobs & Pipelines

All jobs run via **Vercel Cron** (configured in `vercel.json`):

| Cron Route | Schedule | Purpose | Trigger |
|------------|----------|---------|---------|
| `/api/breaks/discover` | `0 */6 * * *` (every 6h) | YouTube discovery for next world × all categories | Vercel Cron |
| `/api/breaks/evaluate` | `0 3,15 * * *` (2x daily) | AI scoring of up to 30 pending candidates | Vercel Cron (GET) or manual (POST) |
| `/api/breaks/refresh-shelf` | `0 4 * * *` (daily 4am UTC) | Promote evaluated candidates, expire stale, rebalance shelf | Vercel Cron |
| `/api/synthetics/tick` | `*/2 * * * *` (every 2 min) | Synthetic coworker presence and activity | Vercel Cron |
| `/api/backgrounds/rotate` | `0 6 * * *` (daily 6am UTC) | Rotate room background images | Vercel Cron |

**Chained pipeline:** `discoverAndPromote()` chains discovery → evaluation → shelf refresh in a single call for manual/POST triggers, bypassing the 12-24h delay between separate cron stages.

**Event-driven:** Engagement events (`/api/breaks/engagement`) fire on user break interactions and feed into taste profile updates.

**No message queues, no pub/sub, no webhooks** for content pipeline events.

**Key files:**
- `vercel.json` — Cron schedule configuration
- `app/api/breaks/discover/route.ts`
- `app/api/breaks/evaluate/route.ts`
- `app/api/breaks/refresh-shelf/route.ts`
- `app/api/synthetics/tick/route.ts`
- `app/api/backgrounds/rotate/route.ts`

---

### 8. AI/LLM Usage

**Provider:** OpenAI (sole provider). Package: `openai@^6.27.0`.

| Use Case | Model | Endpoint | Frequency | Est. Tokens/Call |
|----------|-------|----------|-----------|------------------|
| Content evaluation | gpt-4o-mini | Structured Outputs | ~60/day (30 × 2 batches) | ~2,000 |
| Room blueprint generation | gpt-4o-mini | Structured Outputs | On-demand (admin) | ~4,000 |
| Host messages | gpt-4o-mini | Structured Outputs | Per trigger (5-6 per session) | ~500-800 |
| Synthetic status messages | gpt-4o-mini | Chat | Per "update" action (~30% of check-ins) | ~400 |
| Avatar generation | gpt-image-1 | Image generation | 1 per user signup | N/A (image) |
| Background generation | gpt-image-1 | Image generation | 3-5 per job (on-demand) | N/A (image) |
| Goal/task suggestions | gpt-4o-mini | Structured Outputs | On-demand (user) | ~300-400 |

**Cost management:**
- All chat uses gpt-4o-mini (cheapest capable model)
- Avatar images at "low" quality
- Background images at "medium" quality
- Host messages have per-room cooldowns (480-720s)
- Synthetic status messages have per-entity cooldowns (8-20 min)
- Content evaluation capped at 30/batch
- Fail-gracefully pattern: all AI calls return safe defaults on error

**Prompts:** All prompts use Structured Outputs (JSON Schema) for type safety. Editorial personas include detailed voice prompts, reject/prefer patterns, and mandatory safety instructions appended to every evaluation.

**Key files:**
- `lib/breaks/scoring.ts` — Content evaluation prompt
- `lib/roomFactory/blueprintPrompt.ts` — Blueprint generation prompt
- `lib/hostPrompt.ts` — Host message prompt
- `lib/synthetics/statusMessages.ts` — Synthetic status prompt
- `lib/breaks/contentSafety.ts` — Safety prompt (SAFETY_PROMPT constant)
- `app/api/avatar/generate/route.ts` — Avatar generation
- `app/api/backgrounds/generate/route.ts` — Background generation
- `app/api/goals/suggest-next/route.ts` — Task suggestion
- `app/api/goals/breakdown/route.ts` — Goal breakdown

---

### 9. Admin/Editorial Tools

**What exists:**
- **Admin dashboard** at `/admin/rooms` with room listing, filtering, and creation wizard
- **Room creation wizard** (`CreateRoomWizard.tsx`, 571 lines): 4-step flow (archetype → details → blueprint review → done)
- **Room detail modal** for viewing individual room configuration
- **Stats endpoint** (`/api/admin/stats`): total users, active sessions, active parties, content inventory
- **Activity endpoint** (`/api/admin/activity`): activity logs
- **Users management** (`/api/admin/users`): user listing and detail
- **Background management** (`/api/admin/backgrounds`): asset listing
- **Synthetics status** (`/api/admin/synthetics/status`): synthetic engine health
- **Manual content evaluation trigger**: `POST /api/breaks/evaluate` with `{worldKey, category, limit}`
- **Admin auth**: Simple secret-based (`ADMIN_SECRET` env var)

**Limitations:**
- **No content review dashboard** — no UI to browse candidates, approve/reject, or manage the shelf
- **No editorial queue** — content flows from pending → evaluated → promoted automatically; no human-in-the-loop step
- **No content performance dashboard** — no aggregate view of completion rates, abandonment, or engagement metrics
- **No pipeline health monitoring** — no alerting if discovery fails, evaluation errors spike, or shelves go empty
- **No A/B testing controls** — no way to experiment with different personas, scoring weights, or shelf strategies
- **No content moderation queue** — safety is automated (blocklist + AI) with no manual review escalation

**Key files:**
- `app/(admin)/admin/rooms/page.tsx`
- `components/admin/rooms/RoomsView.tsx` (216 lines)
- `components/admin/rooms/CreateRoomWizard.tsx` (571 lines)
- `components/admin/rooms/RoomDetailModal.tsx`
- `app/api/admin/stats/route.ts`
- `app/api/admin/activity/route.ts`

---

### 10. Infrastructure

**Hosting:** Vercel (Next.js App Router)
- All cron jobs via Vercel Cron
- API routes as serverless functions
- Image processing via `sharp` (background resizing/WebP conversion)

**Database:** Supabase (PostgreSQL)
- Auth via magic link OTP
- Realtime via Supabase channels
- Storage buckets: `avatars`, `room-backgrounds`
- Admin client: `lib/supabase/admin.ts` (service role key)

**External APIs:**
| Service | Purpose | Auth | Quota/Cost |
|---------|---------|------|------------|
| YouTube Data API v3 | Video search + details | API key | 10,000 units/day |
| OpenAI Chat (gpt-4o-mini) | Content eval, host msgs, blueprints, suggestions | API key | ~$0.15/1M input tokens |
| OpenAI Images (gpt-image-1) | Avatar + background generation | API key | ~$0.04-0.08/image |
| GitHub API | Issue/PR sync for sprints | OAuth token | 5,000 req/hr |
| youtube-caption-extractor (npm) | Transcript fetching | None (scraping) | Unreliable |

**No separate background workers, no Redis, no message queues.** Everything runs as Vercel serverless functions triggered by cron or HTTP requests.

**Key files:**
- `vercel.json` — Cron configuration
- `next.config.ts` — Image remote patterns, rewrites
- `package.json` — All dependencies
- `.env.local` — API keys and secrets

---

## Tech Stack Summary

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16.1.6 (App Router) |
| Runtime | Vercel (serverless) |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth (magic link OTP) |
| Realtime | Supabase Channels |
| Storage | Supabase Storage (avatars, room-backgrounds) |
| AI/LLM | OpenAI (gpt-4o-mini, gpt-image-1) |
| Content Source | YouTube Data API v3 |
| Transcripts | youtube-caption-extractor (npm) |
| Image Processing | sharp |
| Work Integration | GitHub API (OAuth) |
| Cron | Vercel Cron |
| CSS | Tailwind CSS v4 |
| DnD | @dnd-kit/core + @dnd-kit/sortable |
| Icons | lucide-react |

---

## Gap Analysis

### Completely Missing (Not Built)

| Gap | Impact |
|-----|--------|
| **Multi-source signal aggregation** (Reddit, HN, Twitter, RSS, blogs) | YouTube-only creates a content monoculture; missing text-based content entirely |
| **Trend/heat detection** across sources | No way to surface "what's hot right now" in tech |
| **Topic clustering/taxonomy** | Freeform tags are inconsistent; no hierarchy or semantic grouping |
| **Learning scaffolding generation** | Rooms have content but no exercises, prompts, or discussion questions |
| **Content review/moderation dashboard** | No human-in-the-loop for content quality beyond automated scoring |
| **Pipeline health monitoring/alerting** | No alerts if cron fails, shelf goes empty, or API quota exhausts |
| **Collaborative filtering** ("users like you watched...") | Personalization is per-user only, no cross-user signal |
| **Content analytics dashboard** | No aggregate view of what's performing, what's being abandoned |
| **Podcast/audio content support** | Only YouTube video; no Spotify, Apple Podcasts, or audio-first content |
| **Blog/article content support** | No text-based content ingestion or display |
| **Newsletter/RSS aggregation** | No curated text feeds |
| **Google Trends / external trend APIs** | No external validation of topic heat |

### Partially Built (Exists But Incomplete)

| Feature | What Exists | What's Missing |
|---------|-------------|----------------|
| **Personalization** | Taste profiles track per-topic weights from engagement | Not clearly wired to all content surfaces; no collaborative filtering; no onboarding preference capture |
| **Creator catalog** | Hardcoded channels per world (~15-20 total) | No dynamic creator discovery, no creator-level analytics, no subscriber/authority metrics |
| **Admin tools** | Room creation wizard + stats/activity endpoints | No content management UI, no shelf editor, no evaluation queue review |
| **Content matching** | World-level matching (content → room via world_key) | No fine-grained topic-to-room matching, no cross-room content sharing intelligence |
| **Transcript analysis** | Captions fetched for evaluation context | No full-text search on transcripts, no embedding-based similarity, no concept extraction |
| **Room Factory** | Complete blueprint generation from archetype | No iterative refinement, no performance feedback loop, no auto-tuning based on room success |

### Built But Needs Improvement

| Feature | Current State | Improvement Needed |
|---------|--------------|-------------------|
| **Discovery cadence** | Every 6h, one world per run | Could parallelize across worlds; could run more frequently for high-activity worlds |
| **Evaluation throughput** | 30 candidates/batch, 2x daily | Could process more aggressively; transcript analysis is optional (should be default) |
| **Safety screening** | Regex blocklist + AI safety score | Blocklist could miss novel harmful content; no image/thumbnail safety screening |
| **Shelf diversity** | Max 2 per creator, 7-day TTL | No topic diversity enforcement; could cluster similar content |
| **Engagement feedback** | Completion/abandonment adjusts shelf scores | Very coarse signal (+10/-15); no nuanced learning from partial watch patterns |
| **youtube-caption-extractor dependency** | npm scraping package | Unreliable; could break without warning; should have fallback or official API |
| **Cost management** | gpt-4o-mini everywhere, reasonable cooldowns | No budget caps, no cost tracking, no automatic throttling if spend spikes |
