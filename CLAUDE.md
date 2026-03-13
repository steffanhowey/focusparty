# SkillGap.ai — Development Standards

## Critical: Supabase MCP
- NEVER use Supabase MCP tools (execute_sql, apply_migration, etc.) — the MCP is connected to the WRONG project (Inflow, not SkillGap)
- Always provide SQL in chat for the user to copy/paste and run themselves

## What This Project Is

SkillGap.ai is an always-on, AI-native learning environment where professionals close the gap between their current skills and what the AI-driven market demands. Users join themed rooms, do timed focus sprints alongside others, consume AI-curated learning content during breaks, and track their skill progression over time.

Think of it as: Duolingo's daily habit loop + Focusmate's social accountability + AI coaching + live, curated learning content — all in one product.

The product is live and functional. We are now building toward a fully automated content intelligence engine that detects trending AI topics, ingests quality YouTube content, generates learning scaffolding, and auto-creates learning rooms — with minimal human intervention.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Runtime | Vercel (serverless functions) |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth (magic link OTP) |
| Realtime | Supabase Channels |
| Storage | Supabase Storage (buckets: avatars, room-backgrounds) |
| AI/LLM | OpenAI (openai@^6.27.0) — gpt-4o-mini for chat, gpt-image-1 for images |
| Content Source | YouTube Data API v3 |
| Transcripts | youtube-caption-extractor npm package |
| CSS | Tailwind CSS v4 |
| DnD | @dnd-kit/core + @dnd-kit/sortable |
| Icons | lucide-react |
| Cron | Vercel Cron (configured in vercel.json) |

## Architecture Overview

### Core Systems

**Rooms & Sessions** — Users join persistent rooms (called "parties" internally — `fp_parties`). Each room has a theme/world (vibe-coding, writer-room, etc.), an AI host personality, and configurable sprint settings. Users do timed focus sprints, take breaks with curated content, and track goals.

**Content Pipeline** — A 3-stage automated pipeline that discovers YouTube videos, scores them with AI, and promotes winners to an active shelf of break content per room:

1. **Discovery** (`lib/breaks/discovery.ts`) — YouTube API searches by topic and channel, runs every 6h via cron
2. **Evaluation** (`lib/breaks/scoring.ts`) — AI scoring with 7 weighted dimensions using GPT-4o-mini + Structured Outputs, runs 2x daily
3. **Shelf Management** (`lib/breaks/shelf.ts`) — Promotes evaluated content to active shelf, applies engagement feedback, expires stale content

**AI Host** — Each room has an AI host that sends contextual messages at key moments (sprint start, breaks, reflections). Configured per room via host personality profiles.

**Synthetic Users** — AI-generated participants that create ambient activity in rooms. They set goals, complete sprints, and share status updates. Solves the cold-start problem. Runs every 2 minutes via cron.

**Room Factory** — AI-powered room blueprint generation. Takes an archetype + topic + audience and generates a complete room configuration (world config, host config, synthetic config, break profile, visual profile). Currently admin-initiated only.

**Taste Profiles** — Per-user topic preference learning. Tracks engagement signals (completed/abandoned breaks) and adjusts per-topic weights with decay. Used for personalized content ordering.

### What We're Building Next

A Content Intelligence Engine that automates the path from "something is trending in the AI world" to "there's a live learning room about it with curated content and exercises." The key new systems:

1. **Topic Intelligence Layer** — Canonical topic taxonomy, topic clustering, heat scoring
2. **Multi-Source Signal Collection** — Reddit, HN, RSS, enhanced YouTube signals, internal user signals
3. **Learning Scaffolding Generation** — AI-generated exercises, practice prompts, and discussion questions per video
4. **Auto Room Generation** — Hot topic + quality content = auto-generated learning room, queued for editorial review
5. **Editorial Dashboard** — Admin tools for reviewing auto-generated content and monitoring pipeline health

## Database Conventions

- All tables are prefixed with `fp_`
- Column names use `snake_case`
- UUIDs for primary keys (`gen_random_uuid()`)
- Timestamps use `TIMESTAMPTZ` with `DEFAULT now()`
- `JSONB` for flexible/nested data
- Supabase admin client: `lib/supabase/admin.ts` (service role key)
- Always add appropriate indexes for columns used in WHERE clauses and JOINs

### Key Tables

**Content & Breaks:**
- `fp_break_content_candidates` — Raw YouTube video candidates from discovery
- `fp_break_content_scores` — AI evaluation results (taste_score, 7 dimension scores, topics, segments)
- `fp_break_content_items` — Active shelf content served to users during breaks
- `fp_break_engagement` — User break interaction events (started, completed, abandoned, extended)
- `fp_user_taste_profiles` — Per-user per-topic preference weights

**Topic Intelligence (new):**
- `fp_topic_taxonomy` — Canonical topic list with hierarchy, categories, and aliases
- `fp_signals` — Raw signal events from all sources (YouTube, Reddit, HN, RSS, internal)
- `fp_topic_clusters` — Active topic clusters with heat scores and status

**Rooms:**
- `fp_parties` — Room definitions (name, world_key, host_personality, status)
- `fp_party_participants` — Room membership
- `fp_room_blueprints` — AI-generated room configs (draft/approved/provisioned)
- `fp_room_background_jobs` / `fp_room_background_assets` — Background image generation

**Sessions & Activity:**
- `fp_sessions` — Focus sessions
- `fp_session_sprints` — Sprints within sessions
- `fp_session_goals` — Session goals
- `fp_activity_events` — Activity feed (user/host/system/synthetic actors)
- `fp_notes` — Quick session notes

**Tasks & Goals:**
- `fp_tasks` — Global task system
- `fp_projects` — Task projects
- `fp_goals` — Long-term goals

## Code Conventions

### File Naming
- `lib/` files: `camelCase.ts` (e.g. `youtubeClient.ts`, `heatEngine.ts`)
- Route directories: `kebab-case` (e.g. `app/api/breaks/refresh-shelf/route.ts`)
- Component files: `PascalCase.tsx` (e.g. `CreateRoomWizard.tsx`)
- Test files: not currently present — but if writing tests, use `*.test.ts` co-located with source

### TypeScript
- Strict TypeScript everywhere. All exported functions must have explicit parameter and return types.
- Use `interface` for object shapes, `type` for unions/intersections.
- Avoid `any`. Use `unknown` when type is genuinely unknown and narrow with type guards.

### Functions and Modules
- Functions: `camelCase`
- Types/Interfaces: `PascalCase`
- Constants: `UPPER_SNAKE_CASE` for true constants, `camelCase` for config objects
- Export named functions, not default exports (except for React components/pages)
- Add JSDoc comments to all exported functions

### React / Next.js
- App Router (not Pages Router). All routes in `app/`.
- Server Components by default. Add `'use client'` only when needed.
- API routes use `route.ts` with named exports (`GET`, `POST`, `PATCH`, `DELETE`).
- Cron endpoints are GET handlers triggered by Vercel Cron.

### Design System
- Design system rules (tokens, colors, shadows, components) are defined in `.claude/rules/ui-components.md`
- Color source of truth: `lib/palette.ts` (JS) + `app/globals.css` (CSS custom properties)
- **NEVER** hardcode hex values, Tailwind color defaults, or raw rgba in component files
- **ALWAYS** check existing UI components before writing inline JSX (see `components/ui/`)
- Color philosophy: color = achievement or state only. Everything else is grayscale.

## AI/LLM Patterns

**This is critical. Follow these patterns exactly for any new AI integrations.**

### Pattern: Structured Outputs (GPT-4o-mini)

All LLM calls use OpenAI's Structured Outputs for type-safe responses. See `lib/breaks/scoring.ts` as the canonical example.

```typescript
import OpenAI from 'openai';

const openai = new OpenAI(); // uses OPENAI_API_KEY env var

const response = await openai.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ],
  response_format: {
    type: 'json_schema',
    json_schema: {
      name: 'your_schema_name',
      strict: true,
      schema: {
        type: 'object',
        properties: { /* your schema */ },
        required: [/* required fields */],
        additionalProperties: false
      }
    }
  }
});

const result = JSON.parse(response.choices[0].message.content);
```

### Pattern: Fail-Gracefully

All AI calls must return safe defaults on error. Never let an LLM failure crash the pipeline.

```typescript
try {
  const result = await callLLM(/* ... */);
  return result;
} catch (error) {
  console.error('LLM call failed:', error);
  return DEFAULT_SAFE_RESPONSE;
}
```

### Pattern: Cost Management
- Use `gpt-4o-mini` for all chat completions (cheapest capable model)
- Batch processing: cap items per batch (e.g. 30 candidates per evaluation run)
- Cooldowns: rate-limit per-room and per-entity AI calls (see host messages: 480-720s cooldown)
- Cache: don't re-evaluate content that's already been scored unless explicitly requested

### Pattern: Safety

All content evaluation prompts must include the `SAFETY_PROMPT` constant from `lib/breaks/contentSafety.ts`. This is a hard requirement — never skip safety instructions in evaluation prompts.

## Cron Jobs

All background jobs run via Vercel Cron. Configured in `vercel.json`. Each is a serverless function.

| Cron | Route | Schedule | Purpose |
|------|-------|----------|---------|
| Content Discovery | `/api/breaks/discover` | Every 6h | YouTube search for next world |
| Content Evaluation | `/api/breaks/evaluate` | 2x daily (3am, 3pm UTC) | AI score up to 30 pending candidates |
| Shelf Refresh | `/api/breaks/refresh-shelf` | Daily 4am UTC | Promote evaluated content, expire stale |
| Topic Clustering | `/api/topics/cluster` | Hourly | Process signals, update heat scores |
| Synthetic Tick | `/api/synthetics/tick` | Every 2 min | Synthetic user presence and activity |
| Background Rotate | `/api/backgrounds/rotate` | Daily 6am UTC | Rotate room background images |

### Adding New Cron Jobs
1. Create the route file: `app/api/your-job/route.ts`
2. Implement a GET handler (Vercel Cron calls GET)
3. Optionally implement POST for manual triggers with parameters
4. Add to `vercel.json` cron configuration
5. Log start/end times and results for debugging

## Content Pipeline Deep Dive

### Discovery Flow (`lib/breaks/discovery.ts`)
1. `pickNextWorldKey()` — selects the world with the oldest discovery timestamp
2. For each category in that world: executes 2 topic queries + 1 channel search
3. YouTube results filtered by: duration (4-20 min), safety blocklist, deduplication
4. Results saved to `fp_break_content_candidates` with status: `'pending'`

### Evaluation Flow (`lib/breaks/scoring.ts`)
1. Fetches up to 30 pending candidates
2. Each candidate scored via single GPT-4o-mini call with editorial persona context
3. Returns 7 dimension scores: relevance (0.30), engagement (0.20), content_density (0.20), creator_authority (0.10), freshness (0.10), novelty (0.10), + mandatory safety score
4. Server-side freshness + creator authority boosts applied on top
5. Hard gates: safety < 50 = reject, relevance < 40 = reject
6. AI also identifies best segments (3/5/10-min) with exact start timestamps
7. AI assigns topic tags (currently freeform, being migrated to canonical taxonomy)

### Shelf Flow (`lib/breaks/shelf.ts`)
1. Promotes candidates scoring >= 55 to active shelf (`fp_break_content_items`)
2. Each shelf bucket: (world_key, category, duration) holds 5-8 items
3. Max 2 items per creator per bucket
4. Items expire after 7 days (TTL)
5. Engagement feedback: +10 if >70% completion rate, -15 if >60% abandonment rate

### World Break Profiles (`lib/breaks/worldBreakProfiles.ts`)
Each world has:
- Search queries per category (topic keywords)
- Channel list (hardcoded YouTube channel IDs with labels)
- Editorial persona with voice prompt, reject/prefer patterns
- Creator authority boosts (named creators get additive score bonuses)

## Key Directories

```
app/
  (admin)/admin/        — Admin dashboard pages
  api/                  — API routes and cron endpoints
    breaks/             — Content pipeline endpoints
    topics/             — Topic intelligence endpoints (new)
    signals/            — Signal collection endpoints (new)
    rooms/              — Room management endpoints
    admin/              — Admin data endpoints
    synthetics/         — Synthetic user endpoints
    avatar/             — Avatar generation
    backgrounds/        — Background image generation

lib/
  breaks/               — Content pipeline core
    discovery.ts        — YouTube discovery engine
    scoring.ts          — AI evaluation engine
    shelf.ts            — Shelf management
    freshness.ts        — Freshness scoring
    youtubeClient.ts    — YouTube API wrapper
    transcript.ts       — Caption/transcript fetching
    worldBreakProfiles.ts — World configs, channels, personas
    contentSafety.ts    — Safety blocklist and prompts
    tasteProfile.ts     — User preference learning
    evaluateBatch.ts    — Batch evaluation processor
  topics/               — Topic intelligence (new)
    taxonomy.ts         — Topic taxonomy CRUD
    heatEngine.ts       — Heat score calculation
    clusterService.ts   — LLM-powered signal clustering
  signals/              — Signal collection (new)
    redditCollector.ts
    hnCollector.ts
    rssCollector.ts
    youtubeSignalCollector.ts
    internalCollector.ts
    config.ts
  scaffolding/          — Learning scaffolding generation (new)
    generator.ts
  rooms/                — Room auto-generation (new)
    autoGenerator.ts
    lifecycle.ts
  roomFactory/          — Room blueprint generation (existing)
    blueprintPrompt.ts
    provision.ts
  supabase/
    admin.ts            — Supabase admin client (service role)
  hosts.ts              — Host personality configs
  worlds.ts             — Hardcoded world configs
  roomDna.ts            — Room config caching
  hostPrompt.ts         — Host message generation
  synthetics/           — Synthetic user system
    statusMessages.ts

components/
  admin/rooms/          — Admin room management UI
```

## Environment Variables

Key env vars (do not commit values, just know they exist):

- `OPENAI_API_KEY` — OpenAI API access
- `YOUTUBE_API_KEY` — YouTube Data API v3
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon key (client-side)
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role (server-side only)
- `ADMIN_SECRET` — Simple secret for admin endpoint auth
- `CRON_SECRET` — Vercel cron job auth

## Guiding Principles

1. **Extend, don't rewrite.** The existing content pipeline works. New systems layer on top of it. Don't refactor working code unless there's a clear structural reason.
2. **Follow existing patterns.** Before writing any new module, read the equivalent existing module. `scoring.ts` for AI calls. `discovery.ts` for cron jobs. `shelf.ts` for database operations. Match the style.
3. **Fail gracefully.** Every external call (LLM, YouTube API, Supabase) must have error handling that returns a safe default. Pipelines should log errors and continue, not crash.
4. **Keep it simple.** No message queues, no Redis, no separate worker infrastructure. Everything runs as Vercel serverless functions. If a function hits the 60s timeout, optimize the function — don't add infrastructure.
5. **Canonical topics matter.** The topic taxonomy is the backbone of the content intelligence engine. Every piece of content, every signal, every room should reference canonical topics. Freeform tags are being phased out.
6. **Human QA is non-negotiable for now.** Auto-generated rooms go through an editorial review queue before publishing. Never auto-publish a room directly. This will be relaxed over time as confidence grows.
7. **Cost awareness.** Use `gpt-4o-mini` for everything unless there's a specific reason for a larger model. Batch requests. Cache aggressively. Track token usage in logs.
8. **YouTube embeds only.** We never download, re-host, or clip YouTube content. All videos are served via YouTube's official embed player. Timestamp cueing is fine (and encouraged). This is a legal and ethical hard line.
9. **Creator respect.** Every creator room prominently attributes the creator. If a creator requests removal, comply immediately. The relationship with creators is a long-term asset — protect it.
10. **Ship incrementally.** Each system should be independently useful. The topic taxonomy is useful even without signal collection. Signal collection is useful even without auto-room generation. Don't build monoliths.
