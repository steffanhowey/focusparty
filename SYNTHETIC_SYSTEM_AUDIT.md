# FocusParty Synthetic User System — Complete Technical Audit

> Generated March 2026. This document covers every aspect of how synthetic (AI-simulated) participants work in FocusParty — from the data model to the tick engine, AI message generation, visual display, and all integration points.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [The Synthetic Pool](#2-the-synthetic-pool)
3. [The Engine — Core Logic](#3-the-engine--core-logic)
4. [AI Status Message Generation](#4-ai-status-message-generation)
5. [Tick Triggers — When Synthetics Activate](#5-tick-triggers--when-synthetics-activate)
6. [Synthetic Presence — How They Appear in Rooms](#6-synthetic-presence--how-they-appear-in-rooms)
7. [Activity Feed — How Events Display](#7-activity-feed--how-events-display)
8. [Celebration Effects — Avatar Visuals](#8-celebration-effects--avatar-visuals)
9. [Reciprocal High-Fives](#9-reciprocal-high-fives)
10. [Room Discovery — Synthetic Counts](#10-room-discovery--synthetic-counts)
11. [Constants & Tuning Parameters](#11-constants--tuning-parameters)
12. [State Machine](#12-state-machine)
13. [File Map](#13-file-map)
14. [Known Issues & Design Decisions](#14-known-issues--design-decisions)

---

## 1. Architecture Overview

Synthetics are **stateless, event-driven simulated participants**. There is no persistent "synthetic_users" table — their presence is derived entirely from events in `fp_activity_events`. The system has four layers:

```
POOL (42 curated personas)
  → ENGINE (stateless tick evaluator)
    → DATABASE (fp_activity_events with actor_type="synthetic")
      → DISPLAY (realtime feed + avatar celebrations + participant list)
```

**Key principle:** Synthetics use the exact same `fp_activity_events` table as real users. The only difference is `actor_type = "synthetic"` and `user_id = null`. Their identity lives in `payload.synthetic_id`.

---

## 2. The Synthetic Pool

**File:** `lib/synthetics/pool.ts`

### Types

```typescript
type SyntheticArchetype = "coder" | "writer" | "founder" | "gentle";

type SyntheticEventType =
  | "participant_joined"
  | "session_started"
  | "sprint_completed"
  | "session_completed"
  | "participant_left"
  | "check_in"
  | "high_five";

interface SyntheticParticipant {
  id: string;                          // e.g., "syn-kai"
  handle: string;                      // e.g., "kai"
  displayName: string;                 // e.g., "Kai"
  avatarUrl: string;                   // Supabase storage URL (AI-generated)
  archetype: SyntheticArchetype;
  preferredWorldKeys: string[];        // e.g., ["vibe-coding", "default", "yc-build"]
  activityBias: Record<SyntheticEventType, number>;  // relative weights
}
```

### Pool Inventory (42 synthetics)

**Wave 1 — 12 synthetics:**

| ID | Name | Archetype | Preferred Worlds | Sprint Bias | Notable |
|----|------|-----------|-----------------|-------------|---------|
| syn-kai | Kai | coder | vibe-coding, default, yc-build | 1.5 | |
| syn-rio | Rio | coder | vibe-coding, default | 1.4 | |
| syn-dev | Dev | coder | vibe-coding, yc-build, default | 1.6 | High sprint |
| syn-sage | Sage | writer | writer-room, default, gentle-start | 1.3 | |
| syn-ellis | Ellis | writer | writer-room, default | 1.2 | |
| syn-wren | Wren | writer | writer-room, gentle-start, default | 1.4 | |
| syn-ava | Ava | founder | yc-build, default, vibe-coding | 1.5 | High start (1.4) |
| syn-noor | Noor | founder | yc-build, default | 1.3 | |
| syn-quinn | Quinn | founder | yc-build, vibe-coding, default | 1.6 | |
| syn-lux | Lux | gentle | gentle-start, default, writer-room | 1.2 | High join (1.1) |
| syn-sol | Sol | gentle | gentle-start, default | 1.1 | |
| syn-fern | Fern | gentle | gentle-start, writer-room, default | 1.3 | |

**Wave 2 — 30 synthetics:**

Coders (8): Jax, Rune, Kit, Nova, Hex, Taz, Byte, Pixel
- Sprint bias range: 1.3–1.8 (Hex highest at 1.8)

Writers (8): Muse, Reed, Lyra, Poe, Clio, Bly, Ink, Vale
- Sprint bias range: 1.1–1.4

Founders (7): Blaze, Zara, Ash, Cruz, Onyx, Tai, Rox
- Sprint bias range: 1.3–1.7 (Onyx highest)
- Lowest leave bias (0.5–0.8) — founders stick around

Gentle (7): Haze, Dove, Elm, Rue, Cove, Jade, Zeph
- Sprint bias range: 1.0–1.2
- Highest join bias (1.0–1.2)

### Universal Biases (all 42 synthetics)
- `check_in: 0.8`
- `high_five: 0.3`

### World Keys
- `default` — general co-working
- `vibe-coding` — coding and building
- `writer-room` — writing and editing
- `yc-build` — startup building
- `gentle-start` — calm, low-pressure focus

---

## 3. The Engine — Core Logic

**File:** `lib/synthetics/engine.ts`

### 3.1 runTick() — Main Entry Point

```typescript
async function runTick(targetPartyId?: string): Promise<TickResult>
```

Orchestration flow:
1. **Fetch active rooms** — `SELECT * FROM fp_parties WHERE status IN ('waiting', 'active')`
2. **Optionally filter** to `targetPartyId`
3. **Fetch recent events** for each room (last 20 events within 2-hour window)
4. **Backfill phase** — for rooms with no synthetic events in last 30 min, insert backdated "people were already here" events
5. **Re-fetch events** (to include backfill)
6. **Generate proposals** via `generateTickEvents()` — 1 event per room, max 4 globally
7. **AI enrichment** — enrich "update" check-ins with `gpt-4o-mini` generated messages
8. **Insert proposals** into `fp_activity_events`
9. **Return results**

### 3.2 generateTickEvents() — Event Selection Algorithm

Per room (shuffled order):

1. **Ratio cap** — skip room if synthetic live events >= 40% of total live events (requires >= 8 live events, excludes backdated)
2. **Room state computation** — derive ambient state from recent events
3. **Flowing skip** — if room state is "flowing", 60% chance to skip entirely (real users driving)
4. **Candidate filtering** — synthetics whose `preferredWorldKeys` includes this room's `world_key` (+ 15% miss chance for cross-pollination)
5. **State derivation** — build implicit state per synthetic from event history
6. **Valid transitions** — per-candidate based on current state (see State Machine section)
7. **Weight adjustment** — multiply by room state bias, boost high-fives 3x if sprint finisher present
8. **Weighted random selection** — pick one event from all options
9. **Payload generation** — check_in gets action/message, high_five gets target resolution

### 3.3 generateCheckInPayload() — Check-In Distribution

```
45% → { action: "progress" }           → "Making progress" celebration
25% → { action: "ship", task_title }   → "Shipped [task]" celebration
30% → { action: "update", message }    → AI-generated status message
```

Ship tasks are archetype-specific:
- **Coder:** "a new component", "a bug fix", "an API endpoint", "a refactor", "a test suite"
- **Writer:** "a blog draft", "a chapter outline", "an edit pass", "a content brief", "a newsletter"
- **Founder:** "a pitch update", "a landing page", "a feature spec", "a growth experiment", "investor notes"
- **Gentle:** "a journal entry", "a study guide", "a design sketch", "a mood board", "a reading list"

### 3.4 Room State Biases

| Event Type | Quiet | Warming Up | Focused | Flowing | Cooling Down |
|------------|-------|------------|---------|---------|-------------|
| participant_joined | 1.5 | 1.0 | 0.5 | 0.7 | 0.4 |
| session_started | 1.3 | 1.4 | 1.0 | 0.7 | 0.8 |
| sprint_completed | 1.0 | 1.2 | 1.5 | 0.7 | 0.8 |
| session_completed | 1.0 | 1.0 | 1.0 | 0.7 | 1.3 |
| participant_left | 1.0 | 0.3 | 0.3 | 0.7 | 1.5 |
| check_in | 1.0 | 1.2 | 1.3 | 0.7 | 0.8 |
| high_five | 1.0 | 1.2 | 1.5 | 1.2 | 0.8 |

### 3.5 High-Five Target Resolution

1. Extract real users from recent events (non-synthetic, with user_id)
2. Track sprint completions within last 5 minutes
3. If sprint finishers exist → prefer them as targets
4. Otherwise → random real user
5. Skip high-fives entirely if no real users present

### 3.6 Backfill System

When a room has no synthetic events in the last 30 minutes:
- Pick 1-3 synthetics with world affinity
- Generate backdated events (5-45 minutes ago):
  - Always: `participant_joined`
  - 70% chance: `session_started`
- Events marked with `payload.backdated = true` (excluded from ratio cap)

### 3.7 insertSyntheticEvent() — Database Insertion

```typescript
INSERT INTO fp_activity_events {
  party_id,
  session_id: null,
  user_id: null,
  actor_type: "synthetic",
  event_type,
  body: syntheticDisplayName,
  payload: { synthetic_id, synthetic_handle, ...eventSpecificFields },
  created_at
}
```

---

## 4. AI Status Message Generation

**File:** `lib/synthetics/statusMessages.ts`

### When It Fires

Only when the engine generates a check_in with `action: "update"` (30% of check_ins). The `enrichProposalsWithAI()` function runs after event generation, before insertion.

### AI Prompt Design

**System prompt:**
```
You are roleplaying as {displayName}, {archetypeDescription}.
They are working in a "{worldLabel}" themed co-working room.

Generate a brief, natural status update (8-15 words) that this person
would type to share what they're working on right now.

RULES:
- Sound like a real person — casual, lowercase is fine, no corporate speak
- Be specific to what this archetype actually does day-to-day
- No exclamation marks, no emojis, don't start with "just"
- Vary the structure — don't always start with a verb
- Never repeat or closely paraphrase these recent messages:
  [dedup list of last 3 synthetic update messages]
```

**User prompt:**
```
Recent room activity:
- Kai shipped a bug fix
- Ava is making progress
- Host: "Solid momentum in here."
```

**Model:** `gpt-4o-mini`, temperature 0.9, max 64 tokens, structured JSON output

### Archetype Context Descriptions

- **coder:** "a software developer — mentions code, debugging, components, APIs, refactoring, tests, deploys"
- **writer:** "a writer — mentions drafts, paragraphs, outlines, editing, finding the right words, chapters"
- **founder:** "a startup founder — mentions product, customers, metrics, pitches, experiments, shipping features"
- **gentle:** "someone doing calm, reflective work — mentions journaling, studying, sketching, organizing, planning"

### Fallback System

On any AI error, `pickFallbackMessage(archetype)` returns:
- 80% chance: archetype-specific pool (7 messages each)
- 20% chance: generic pool (7 messages)

**Coder fallbacks:** "Refactoring this module, almost clean", "Tests are green, moving on", "This edge case is tricky but getting there", "Got the API endpoint working finally", "Debugging a weird state issue", "Cleaning up these type errors one by one", "Pushed a fix, reviewing the diff now"

**Writer fallbacks:** "Found the thread for this section", "Cutting the fluff, tightening the draft", "Reading back what I wrote yesterday", "Reworking the opening, not quite right yet", "Outline is solid, filling in the gaps now", "This paragraph finally clicks", "Editing mode — trimming everything by half"

**Founder fallbacks:** "Mapping out the next sprint priorities", "Reviewing customer feedback notes", "Simplifying the onboarding flow", "Landing page copy is almost there", "Running through the pitch one more time", "Metrics dashboard is looking cleaner", "Scoping the MVP down to what matters"

**Gentle fallbacks:** "Settling into a good rhythm", "Taking it one step at a time", "Organizing my notes from earlier", "Working through this at my own pace", "Making a little progress, feels good", "Tidying up my workspace and thoughts", "Focused on one small thing right now"

**Generic fallbacks:** "Deep in flow right now", "Making steady progress", "Almost done with this chunk", "Hit a groove, keeping going", "Wrapping up a tricky section", "Feeling productive today", "One more push then break"

---

## 5. Tick Triggers — When Synthetics Activate

### 5.1 Client-Side Trigger (During Sprints)

**File:** `app/environment/[id]/page.tsx`

When a user is in a sprint, a `useEffect` fires ticks every 45 seconds:

```typescript
useEffect(() => {
  if (phase !== "sprint") return;
  const tick = () =>
    fetch("/api/synthetics/tick", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ partyId }),
    }).catch(() => {});
  tick(); // Fire immediately on sprint start
  const id = setInterval(tick, 45_000);
  return () => clearInterval(id);
}, [phase, partyId]);
```

- **Frequency:** Every 45 seconds
- **Scope:** Single room (the user's current party)
- **Trigger:** Only during `phase === "sprint"`

### 5.2 Server-Side Cron (Always Running)

**File:** `vercel.json`

```json
{ "path": "/api/synthetics/tick", "schedule": "*/2 * * * *" }
```

- **Frequency:** Every 2 minutes
- **Scope:** All active rooms (`status IN ('waiting', 'active')`)
- **Method:** GET request (Vercel cron uses GET)

### 5.3 API Route

**File:** `app/api/synthetics/tick/route.ts`

- **POST** — client-triggered, accepts optional `{ partyId }` body
- **GET** — cron-triggered, evaluates all rooms
- Both call `runTick()` and return `{ ok: true, inserted: [...] }`
- No auth guard (fire-and-forget pattern)

### 5.4 Reaction Endpoint

**File:** `app/api/synthetics/react/route.ts`

- **POST** — for reciprocal high-fives from synthetics
- Uses admin Supabase client (bypasses RLS)
- Inserts `{ actor_type: "synthetic", user_id: null, ... }` into `fp_activity_events`

---

## 6. Synthetic Presence — How They Appear in Rooms

### 6.1 Presence Derivation

**File:** `lib/parties.ts` — `getActiveSyntheticPresence()`

Presence is **derived from events**, not stored:

```sql
SELECT party_id, event_type, payload
FROM fp_activity_events
WHERE actor_type = 'synthetic'
  AND party_id IN (...)
  AND created_at >= (now - 2 hours)
ORDER BY created_at ASC
```

For each synthetic, replay events to determine state:
- `participant_joined` → "joined"
- `session_started` / `sprint_completed` → "in_session"
- `session_completed` → "joined"
- `participant_left` → "absent"

Return synthetics in "joined" or "in_session" state as `SyntheticPresenceInfo`:
```typescript
{ id, displayName, avatarUrl, handle }
```

### 6.2 Polling in Environment

**File:** `lib/useEnvironmentParty.ts`

- Initial fetch on mount (parallel with party data)
- Polls `getSyntheticParticipants(partyId)` every **30 seconds**
- Visibility-aware: pauses when tab is hidden, resumes + immediate refresh on tab return

### 6.3 Participant List Construction

**File:** `app/environment/[id]/page.tsx`

Participants are combined in order: **Host → Real Users → Synthetics**

```typescript
const participantInfos = useMemo(() => {
  const host = { id: "host", displayName: hostConfig.hostName, participantType: "host" };
  const real = presence.participants.map(p => ({ ...p, participantType: "real" }));
  const synthetic = syntheticParticipants.map(sp => ({
    id: sp.id,
    displayName: sp.displayName,
    username: sp.handle,
    avatarUrl: sp.avatarUrl,
    participantType: "synthetic",
    archetype: SYNTHETIC_POOL.find(s => s.id === sp.id)?.archetype,
  }));
  return [host, ...real, ...synthetic];
}, [presence.participants, userId, syntheticParticipants, hostConfig]);
```

---

## 7. Activity Feed — How Events Display

### 7.1 Realtime Subscription

**File:** `lib/usePartyActivityFeed.ts`

Subscribes to all INSERTs on `fp_activity_events` for the current party (no actor_type filter):

```typescript
.on("postgres_changes", {
  event: "INSERT",
  schema: "public",
  table: "fp_activity_events",
  filter: `party_id=eq.${partyId}`,
})
```

Events are enriched with display text via `eventDisplayText()` and appended to the feed (capped at 150 events).

### 7.2 Display Name Resolution

For synthetic events: `event.user_id` is null, so the name falls back to `event.body` (which contains the synthetic's displayName, set by the engine).

### 7.3 Event Display Text

**File:** `lib/presence.ts` — `eventDisplayText()`

| Event Type | Display Format |
|------------|---------------|
| check_in (progress) | "{name} is making progress" |
| check_in (ship) | "{name} shipped {task_title}" |
| check_in (reset) | "{name} is taking a reset" |
| check_in (update) | "{name}: {message}" |
| high_five | "{name} high-fived {target_display_name}" |
| sprint_completed | "{name} completed a sprint" |
| participant_joined | "{name} joined the party" |
| participant_left | "{name} left the party" |
| session_started | "{name} started a session" |
| session_completed | "{name} finished their session" |

### 7.4 Feed UI Rendering

**File:** `lib/activityEventRender.ts`

Each event maps to an icon + color + label:

| Action | Icon | Color |
|--------|------|-------|
| check_in (progress) | TrendingUp | #5BC682 (green) |
| check_in (ship) | Rocket | #F59E0B (amber) |
| check_in (reset) | RotateCcw | #F5C54E (yellow) |
| check_in (update) | MessageSquare | #5CC2EC (blue) |
| high_five | Hand | #F59E0B (amber) |
| sprint_completed | CheckCircle2 | #5BC682 (green) |
| participant_joined | UserPlus | #888888 (gray) |
| participant_left | UserMinus | #888888 (gray) |

---

## 8. Celebration Effects — Avatar Visuals

### 8.1 Celebration Processing

**File:** `app/environment/[id]/page.tsx`

A `useEffect` watches `feedEvents.length`. When new events arrive:

- **check_in:** Target = `event.payload.synthetic_id` (for synthetics) or `event.user_id` (for real users). Color/text based on action.
- **high_five:** Target = `event.payload.target_user_id`. Color = amber, text = "High five!"
- **sprint_completed:** Target = synthetic_id or user_id. Color = green, text = "Sprint complete!"

Each celebration auto-clears after **2 seconds**.

Anti-double-fire: own check-ins and own-targeted reciprocal high-fives are skipped (already handled optimistically).

### 8.2 Visual Components

**Avatar glow:** `fp-burst-glow` CSS animation (1.4s ease-out) with `--burst-color` variable

**Particle burst:** `AvatarCelebration` component — 8 radial particles at 45-degree intervals expanding outward (1.2s, staggered 30ms delays) + expanding ring (1.4s)

**Floating status text:** Pill above avatar with dark background, colored text, truncated to 120px max-width. Animates via `fp-status-float` (2s ease-out upward).

### 8.3 What Users Actually See

When a synthetic does a check_in with `action: "update"` and AI-generated message "Debugging a weird state issue":
1. The synthetic's avatar glows blue (#5CC2EC) for 1.4 seconds
2. 8 blue particles burst outward
3. A small pill floats above the avatar reading "Debugging a weird state issue" for 2 seconds
4. The momentum feed shows: "Dev: Debugging a weird state issue" with a MessageSquare icon

---

## 9. Reciprocal High-Fives

**File:** `app/environment/[id]/page.tsx` — `handleHighFive()`

When a user high-fives a synthetic:

1. **Log user's high-five** to DB immediately
2. **Check if target is synthetic** via `SYNTHETIC_POOL.find()`
3. **Archetype-aware probability:**
   - Gentle: 90% chance to high-five back
   - Founder: 75% chance
   - Coder/Writer: 65% chance
4. **Natural delay:** 2-5 seconds (random)
5. **Optimistic celebration:** Amber glow + "High five!" on user's own avatar
6. **Persist:** POST to `/api/synthetics/react` (fire-and-forget)

The reciprocal high-five appears in the activity feed for all participants.

---

## 10. Room Discovery — Synthetic Counts

**File:** `components/party/RoomCard.tsx`

Room cards display:
- **AvatarCluster:** Up to 3 synthetic avatar images (overlapping), with `+N` overflow badge
- **Participant count:** Real users + synthetics combined
- Synthetic presence derived from `listDiscoverableParties()` which calls `getActiveSyntheticPresence()` for all rooms in batch

---

## 11. Constants & Tuning Parameters

| Constant | Value | Purpose |
|----------|-------|---------|
| MAX_EVENTS_PER_ROOM | 2 | Max events generated per room per tick |
| MAX_EVENTS_GLOBAL | 4 | Max events total per tick across all rooms |
| SYNTHETIC_RATIO_CAP | 0.4 | Skip room if synthetic >= 40% of live events |
| RECENT_WINDOW_MS | 2 hours | Event query window |
| RECENT_LIMIT | 20 | Max recent events fetched per room |
| BACKFILL_WINDOW_MS | 30 min | Check synthetic activity recency |
| BACKFILL_MIN_AGO_MS | 5 min | Minimum backdate age |
| BACKFILL_MAX_AGO_MS | 45 min | Maximum backdate age |
| BACKFILL_MAX_EVENTS | 3 | Max synthetics to backfill per room |
| WORLD_AFFINITY_MISS_CHANCE | 0.15 | 15% chance to appear in non-preferred worlds |
| Client tick interval | 45 seconds | During sprint phase |
| Cron tick interval | 2 minutes | Always running |
| Synthetic poll interval | 30 seconds | Presence refresh in environment |
| Celebration duration | 2 seconds | Auto-clear timeout |
| High-five cooldown | 30 seconds | Per-target cooldown |
| Reciprocal high-five delay | 2-5 seconds | Natural reaction time |
| Min live events for ratio cap | 8 | Small rooms aren't throttled |

---

## 12. State Machine

Synthetic state is **implicit** — derived by replaying events chronologically:

```
ABSENT (default, no events)
  │
  ├── participant_joined ──→ JOINED
  │                            │
  │                            ├── session_started ──→ IN_SESSION
  │                            │                         │
  │                            │                         ├── sprint_completed ──→ IN_SESSION (stays)
  │                            │                         ├── check_in ──→ IN_SESSION (stays)
  │                            │                         ├── high_five ──→ IN_SESSION (stays)
  │                            │                         ├── session_completed ──→ JOINED
  │                            │                         └── participant_left ──→ ABSENT
  │                            │
  │                            ├── participant_left ──→ ABSENT
  │                            │   (only if joined > 15 min ago)
  │                            │
  │                            └── session_started ──→ IN_SESSION
  │
  └── (stays ABSENT until join event)
```

**Valid transitions per state:**

| From State | Can Do | Weight Source |
|-----------|--------|-------------|
| absent | participant_joined | activityBias.participant_joined |
| joined | session_started | activityBias.session_started |
| joined | participant_left (if >15 min) | activityBias.participant_left |
| in_session | sprint_completed | activityBias.sprint_completed |
| in_session | session_completed | activityBias.session_completed |
| in_session | check_in | activityBias.check_in |
| in_session | high_five | activityBias.high_five |

---

## 13. File Map

| File | Role |
|------|------|
| `lib/synthetics/pool.ts` | 42 synthetic personas with archetypes, biases, world affinities |
| `lib/synthetics/engine.ts` | Core engine: tick evaluation, event generation, backfill, AI enrichment |
| `lib/synthetics/statusMessages.ts` | AI status message generation (gpt-4o-mini) + fallback pools |
| `app/api/synthetics/tick/route.ts` | Tick API (POST for client, GET for cron) |
| `app/api/synthetics/react/route.ts` | Reaction API (reciprocal high-fives) |
| `lib/parties.ts` | `getActiveSyntheticPresence()` — derives presence from events |
| `lib/useEnvironmentParty.ts` | Polls synthetic presence every 30s |
| `lib/usePartyActivityFeed.ts` | Realtime subscription to all activity events |
| `lib/presence.ts` | `eventDisplayText()` — human-readable event descriptions |
| `lib/activityEventRender.ts` | Maps events to icons, colors, labels for UI |
| `app/environment/[id]/page.tsx` | Tick trigger, celebration effects, reciprocal high-fives, participant list |
| `components/environment/EnvironmentParticipants.tsx` | Renders all participants with celebrations |
| `components/environment/AvatarCelebration.tsx` | Burst + ring animation component |
| `components/environment/ParticipantCard.tsx` | Popup card with stats + high-five button |
| `components/party/RoomCard.tsx` | Avatar cluster display for room discovery |
| `lib/supabase/admin.ts` | Admin client (service role key, bypasses RLS) |
| `vercel.json` | Cron schedule for synthetic ticks |

---

## 14. Known Issues & Design Decisions

### Recent Fixes (March 2026)

1. **Ratio cap was poisoned by backfill events** — backdated events counted against the 40% synthetic ratio, blocking all subsequent live events. Fixed by excluding `payload.backdated === true` from the ratio calculation and requiring 8+ live events before the cap applies.

2. **Backfill volume reduced** — `BACKFILL_MAX_EVENTS` lowered from 5 to 3 (generates 1-3 synthetic lifecycles instead of 1-5).

3. **AI-generated status messages added** — "update" check-ins now enriched with `gpt-4o-mini` generated messages instead of picking from 7 static strings. Fallback pools expanded to 35 archetype-aware messages.

4. **"update" frequency doubled** — roll distribution changed from 60/25/15 to 45/25/30 (progress/ship/update).

### Design Decisions

- **No dedicated synthetics table** — presence derived from events. This means synthetic state is always consistent with the activity feed and no sync issues.
- **Client-side tick (45s) + server cron (2min)** — dual approach ensures activity during sprints (responsive) and between sprints (reliable baseline).
- **Admin Supabase client for all engine operations** — bypasses RLS since synthetics have `user_id = null`.
- **Reciprocal high-fives are client-initiated** — the environment page handles the probability and delay, then persists via API. This gives immediate optimistic feedback.
- **Celebrations are ephemeral (2s)** — they're noticeable but not intrusive. The momentum feed provides persistent history.
- **World affinity with 15% miss chance** — keeps rooms feeling natural (coders in coding rooms) while allowing organic cross-pollination.

### Current Logging

The engine logs to server console:
```
[synthetics/tick] target=abc123 activeRooms=3 matched=1 room=abc123 status=waiting world=vibe-coding
[synthetics/tick] backfill inserted=4
[synthetics/tick] proposals=1 types=check_in
[synthetic-status] AI generated for Dev: "Debugging a weird state issue"
[synthetics/tick] done — total inserted=5 events=participant_joined,session_started,...,check_in
```
