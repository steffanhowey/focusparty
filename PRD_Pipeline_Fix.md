# Content Pipeline Structural Fix — Engineering Prompt

## Context

The content pipeline has a fundamental throughput imbalance: shelves drain faster than they fill. 60 shelf buckets need ~43 items/day to replace TTL-expired content, but evaluation is capped at 60/day and only ~18-24 make it through scoring + threshold. The shelves are permanently in deficit.

This is NOT a bug fix. It's 3 structural changes that fix the root cause.

Read `CLAUDE.md` first for project conventions. Then read these files before writing any code:
- `lib/breaks/discovery.ts` (286 lines)
- `lib/breaks/scoring.ts` (366 lines)
- `lib/breaks/shelf.ts` (399 lines)
- `lib/breaks/evaluateBatch.ts` (266 lines)
- `lib/breaks/worldBreakProfiles.ts` (687 lines)
- `lib/breaks/freshness.ts` (48 lines)
- `app/api/breaks/discover/route.ts` (98 lines)
- `app/api/breaks/evaluate/route.ts` (65 lines)
- `app/api/breaks/refresh-shelf/route.ts` (71 lines)
- `vercel.json`

---

## Fix 1: Kill the 3-Stage Cron — Use the Chained Pipeline

### The Problem
Discovery runs at :00 every 6h. Evaluation runs at 3am/3pm. Shelf refresh runs at 4am. This creates a 10-22 hour latency from discovery to shelf. The function `discoverAndPromote()` already exists in `discovery.ts` (line 220-228) and chains all three stages — but it's only used for manual POST triggers, not crons.

### What to Do

**Step 1: Replace the 3 separate cron endpoints with a single unified pipeline endpoint.**

Create `app/api/pipeline/run/route.ts`:
- GET handler (cron-triggered): Runs the full pipeline for ONE world (the least-recently-discovered one via `pickNextWorldKey()` at discovery.ts line 254). Processes ALL 4 categories for that world. For each category: discover → evaluate all pending for that world+category → promote to shelf. This means each cron invocation fully processes one world end-to-end.
- POST handler (manual trigger): Accepts optional `worldKey` (or `"all"`) and optional `category`. If `worldKey === "all"`, runs all worlds × all categories. If specific world, runs that world's categories. Uses `discoverAndPromote()` (discovery.ts line 220) or `discoverAndPromoteAll()` (line 234).
- Both handlers must complete within 55 seconds (Vercel 60s timeout with 5s buffer). Add a `startTime` check before each world+category iteration — if elapsed > 50s, stop and log what was skipped.

**Step 2: Update `vercel.json` cron schedule.**

Remove these three crons:
- `/api/breaks/discover` (currently `0 */6 * * *`)
- `/api/breaks/evaluate` (currently `0 3,15 * * *`)
- `/api/breaks/refresh-shelf` (currently `0 4 * * *`)

Add this single cron:
- `/api/pipeline/run` at `0 */3 * * *` (every 3 hours = 8 runs/day, each processes 1 world = each world gets ~1.6 full pipeline runs/day)

Keep these existing crons unchanged:
- `/api/breaks/scaffold` (currently `0 4,16 * * *`)
- `/api/breaks/discover-hot` (currently `15 */2 * * *`)
- `/api/synthetics/tick` and all other non-pipeline crons

**Step 3: Update `discoverAndPromote()` in `discovery.ts` (line 220-228).**

Currently it calls:
1. `discoverCandidates(worldKey, category)`
2. `evaluatePendingCandidates(worldKey, 30, category)`
3. `refreshShelf(worldKey, category)`

Change step 2's limit from 30 to 100 (this connects to Fix 2 below). Also add error handling so that if discovery fails, evaluation still runs on any existing pending candidates, and if evaluation fails, shelf refresh still runs to expire stale content.

```typescript
export async function discoverAndPromote(worldKey: string, category?: string): Promise<{
  discovered: number;
  evaluated: number;
  promoted: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let discovered = 0, evaluated = 0, promoted = 0;

  const categories = category ? [category] : ALL_CATEGORIES;

  for (const cat of categories) {
    try {
      const disc = await discoverCandidates(worldKey, cat);
      discovered += disc.inserted;
    } catch (e) {
      errors.push(`Discovery failed for ${worldKey}/${cat}: ${e}`);
    }

    try {
      const evalResult = await evaluatePendingCandidates(worldKey, 100, cat);
      evaluated += evalResult.evaluated;
    } catch (e) {
      errors.push(`Evaluation failed for ${worldKey}/${cat}: ${e}`);
    }

    try {
      const shelfResult = await refreshShelf(worldKey, cat);
      promoted += shelfResult.promoted;
    } catch (e) {
      errors.push(`Shelf refresh failed for ${worldKey}/${cat}: ${e}`);
    }
  }

  return { discovered, evaluated, promoted, errors };
}
```

**Do NOT delete the old route files** (`app/api/breaks/discover/route.ts`, `evaluate/route.ts`, `refresh-shelf/route.ts`). Keep them as manual-trigger endpoints (their POST handlers are useful for admin). Just remove them from vercel.json crons.

---

## Fix 2: Raise Evaluation Throughput with Category-Fair Queuing

### The Problem
`evaluatePendingCandidates()` in `evaluateBatch.ts` (line 32) fetches up to `limit` (default 10, cron passes 30) candidates ordered by `discovered_at ASC` — oldest first, no partitioning. This means whichever category discovers first eats all slots. Learning content monopolizes evaluation because it has the most queries and channels.

### What to Do

**Step 1: Add category-fair queuing to `evaluatePendingCandidates()` in `evaluateBatch.ts`.**

Instead of fetching `limit` candidates globally, fetch proportionally across categories:

```typescript
// At the top of evaluatePendingCandidates(), after the worldKey/category check:
// If category is specified, just fetch that category's candidates (existing behavior).
// If category is NOT specified (evaluating a whole world), do fair queuing:

const categories = category ? [category] : ['learning', 'reset', 'reflect', 'move'];
const perCategoryLimit = Math.ceil(limit / categories.length);

let allCandidates: typeof candidates = [];
for (const cat of categories) {
  const { data } = await supabaseAdmin
    .from('fp_break_content_candidates')
    .select('*')
    .eq('status', 'pending')
    .eq('category', cat)
    .match(worldKey ? { world_key: worldKey } : {})
    .order('discovered_at', { ascending: true })
    .limit(perCategoryLimit);

  if (data) allCandidates.push(...data);
}
// Then process allCandidates instead of the single query result
```

This ensures each category gets at least `limit/4` evaluation slots per run, even if learning has 10x more pending candidates.

**Step 2: Raise the default limit.**

In `evaluateBatch.ts`, change the default parameter from `limit = 10` (line 32) to `limit = 50`. The caller in `discoverAndPromote()` will pass 100 (from Fix 1), but the default should also be reasonable for direct calls.

GPT-4o-mini evaluation calls take ~1-2 seconds each. With transcript prefetching (already batched at lines 78-90), 100 candidates can be processed in ~60-90 seconds. Since the unified pipeline processes one world at a time (4 categories × ~25 candidates each), this is well within Vercel's timeout when called per-category.

**Step 3: Add a timeout guard in the evaluation loop.**

In `evaluateBatch.ts`, add a startTime check inside the for-loop (around line 115):

```typescript
const startTime = Date.now();
const EVAL_TIMEOUT_MS = 45_000; // 45s safety margin

for (let i = 0; i < candidates.length; i++) {
  if (Date.now() - startTime > EVAL_TIMEOUT_MS) {
    console.log(`[evaluateBatch] Timeout after ${i} candidates, stopping`);
    break;
  }
  // ... existing evaluation logic
}
```

---

## Fix 3: Smart TTL — Don't Expire What You Can't Replace

### The Problem
`shelf.ts` expires ALL items older than 7 days (line 110-129), regardless of whether there's replacement content. When the pipeline can't keep up, this creates empty buckets and users see blank breaks.

### What to Do

**Step 1: Make TTL conditional on bucket health.**

In `refreshShelf()` in `shelf.ts`, modify the expiration logic (currently around lines 110-129). Before expiring, check how many items the bucket currently has and how many promotable candidates exist:

```typescript
// For each duration bucket, BEFORE expiring:
for (const duration of DURATIONS) {
  const currentItems = existingShelfItems.filter(i => i.duration_minutes === duration);
  const expiredItems = currentItems.filter(i => {
    const age = Date.now() - new Date(i.promoted_at).getTime();
    return age > SHELF_TTL_DAYS * 24 * 60 * 60 * 1000 && !i.pinned;
  });

  // Only expire if bucket will still have >= SHELF_PER_DURATION_MIN items after expiration
  // OR if there are enough promotable candidates to replace them
  const promotableCount = promotableCandidates.filter(c =>
    c.duration_bucket === duration
  ).length;

  const afterExpiry = currentItems.length - expiredItems.length;
  const afterPromotion = afterExpiry + promotableCount;

  if (afterPromotion >= SHELF_PER_DURATION_MIN) {
    // Safe to expire — we have replacements
    // Run existing expiration logic for this bucket
  } else if (afterExpiry >= SHELF_PER_DURATION_MIN) {
    // We'll still have enough without expiring — expire only the excess
    const canExpire = Math.max(0, currentItems.length - SHELF_PER_DURATION_MIN);
    // Expire only the oldest `canExpire` items
  } else {
    // Bucket is thin. Don't expire anything. Log a warning.
    console.warn(`[shelf] Skipping expiration for ${worldKey}/${category}/${duration}min — bucket would drop below ${SHELF_PER_DURATION_MIN}`);
  }
}
```

**Step 2: Add an extended TTL for thin buckets.**

Add a constant: `SHELF_TTL_EXTENDED_DAYS = 21` (3 weeks). Items in buckets below `SHELF_PER_DURATION_MIN` use the extended TTL instead of the standard 7-day TTL. This prevents permanent zombie content while still allowing stale items to eventually cycle out.

**Step 3: Add a cross-world fallback for empty buckets.**

In `app/api/breaks/content/route.ts` (the endpoint that serves content to users), add fallback logic: if the requested world+category+duration returns 0 items, fall back to the `default` world for the same category+duration. This is a safety net — users should never see an empty break.

```typescript
// After the main query returns:
if (!items || items.length === 0) {
  // Fallback to default world
  const { data: fallbackItems } = await supabaseAdmin
    .from('fp_break_content_items')
    .select('*')
    .eq('world_key', 'default')
    .eq('category', category)
    .gte('duration_minutes', minDuration)
    .lte('duration_minutes', maxDuration)
    .order('taste_score', { ascending: false })
    .limit(5);

  if (fallbackItems && fallbackItems.length > 0) {
    items = fallbackItems;
    console.log(`[content] Fallback to default world for ${worldKey}/${category}`);
  }
}
```

---

## Fix 4 (Secondary): YouTube Duration Filter Mismatch

### The Problem
`discovery.ts` line 14 sets `MIN_DURATION = 120` (2 min), but the YouTube API search uses `videoDuration: "medium"` which returns videos 4-20 minutes. This means 2-4 minute videos are never discovered, starving the 3-minute shelf buckets.

### What to Do

In `lib/breaks/youtubeClient.ts`, find where the YouTube search is called with `videoDuration: "medium"`. Add a SECOND search call for short videos (`videoDuration: "short"`, which returns videos under 4 minutes) when the target category or duration hints need short content.

Actually — the simpler fix: in `discovery.ts`, after the YouTube API returns results, the duration filter (lines 128-133) already filters by MIN_DURATION/MAX_DURATION. The problem is upstream — YouTube's `medium` filter never returns sub-4-min videos. So:

**Option A (simpler):** Change `MIN_DURATION` from 120 to 240 (4 min) to match reality. Accept that 3-minute shelf buckets will contain 4-5 minute clips that get segment-curated down to 3 minutes by the AI evaluation (which already identifies 3-min segments with timestamps — see scoring.ts line 140).

**Option B (more content):** Add an additional YouTube search per category with `videoDuration: "short"` to capture sub-4-min content. This costs 1 extra API call per category per discovery run (~20 extra calls per full pipeline run, well within quota).

Go with Option A — it's simpler and the segment curation already handles this. Update `MIN_DURATION = 240` in discovery.ts line 14.

---

## Fix 5 (Secondary): Non-Learning Categories Need Differentiated Queries

### The Problem
`worldBreakProfiles.ts` defines category profiles (reset/reflect/move) at lines 91-247 with their own queries and channels. BUT these are shared identically across all 5 worlds. `vibe-coding/reset` and `gentle-start/reset` search the exact same queries. This means cross-world content provides zero variety in non-learning categories.

### What to Do

In `worldBreakProfiles.ts`, add world-specific query overrides for non-learning categories. The structure already supports this through `getEditorialPersona()` (line 551) which merges category and world personas. Add a similar pattern for queries:

For each world, add 2-3 extra queries per non-learning category that match that world's audience:
- `vibe-coding/reset` → add: "developer meditation", "programmer stress relief", "screen break exercises for coders"
- `yc-build/reflect` → add: "founder journaling", "startup reflection practice", "founder mental health"
- `gentle-start/move` → add: "gentle morning stretches", "low energy desk exercises", "mindful movement for beginners"
- `writer-room/reflect` → add: "writer's block journaling", "creative reflection prompts", "writing mindfulness"

Add these as `categoryQueryOverrides` on each world's break profile config object. In `pickQueries()` (line 603), merge the category's base queries with any world-specific overrides before picking random ones.

---

## Fix 6 (Secondary): Empty Shelf Fallback in Break UI

### The Problem
When a shelf bucket is empty, the break content API returns nothing and users see a blank break flyout. There's no fallback.

### What to Do

This is partially handled by Fix 3's cross-world fallback. But also add a **last-resort fallback** in the API: if even the default world has nothing for a category, return items from ANY category in the user's world. Something is always better than nothing during a break.

In `app/api/breaks/content/route.ts`, after the cross-world fallback:

```typescript
if (!items || items.length === 0) {
  // Last resort: any content from user's world
  const { data: anyItems } = await supabaseAdmin
    .from('fp_break_content_items')
    .select('*')
    .eq('world_key', worldKey)
    .gte('duration_minutes', minDuration)
    .lte('duration_minutes', maxDuration)
    .order('taste_score', { ascending: false })
    .limit(5);

  items = anyItems || [];
  if (items.length > 0) {
    console.log(`[content] Last-resort fallback: any category for ${worldKey}`);
  }
}
```

---

## Pipeline Health Endpoint

Create `app/api/pipeline/status/route.ts` — a health check that returns the current state of the pipeline:

```typescript
// GET /api/pipeline/status
// Returns:
{
  shelves: {
    [worldKey]: {
      [category]: {
        [duration]: { count: number, oldest_days: number, health: "ok"|"thin"|"empty" }
      }
    }
  },
  pending: {
    total: number,
    by_world: { [worldKey]: number },
    by_category: { [category]: number },
    oldest_pending_hours: number
  },
  evaluated: {
    last_24h: number,
    promotable: number  // scored but not yet on shelf
  },
  pipeline_runs: {
    last_run: string,  // ISO timestamp
    last_world: string,
    results: { discovered: number, evaluated: number, promoted: number }
  }
}
```

Query `fp_break_content_candidates` (status='pending'), `fp_break_content_scores` (for evaluated counts), `fp_break_content_items` (for shelf counts), and `fp_pipeline_events` (for last run info, if that table exists — otherwise just log it).

---

## Validation Checklist

After implementing, verify:

1. **Unified pipeline runs end-to-end**: Hit `POST /api/pipeline/run` with `{"worldKey": "default"}` and confirm it discovers, evaluates, AND promotes in one call. Check logs for all three stages.

2. **Category-fair queuing works**: Seed 100 pending candidates (80 learning, 5 reset, 5 reflect, 10 move). Run evaluation with limit=40. Confirm each category gets ~10 slots, not learning getting 40.

3. **Smart TTL preserves thin buckets**: Find a shelf bucket with < 5 items. Manually set one item's `promoted_at` to 8 days ago. Run shelf refresh. Confirm it was NOT expired.

4. **Cross-world fallback works**: Empty a shelf bucket for `vibe-coding/learning/5min`. Hit the content API for that bucket. Confirm it returns `default/learning/5min` content instead of nothing.

5. **Timeout guards work**: The evaluation loop should log "Timeout after N candidates" if it exceeds 45s. The pipeline endpoint should log skipped worlds if it exceeds 50s.

6. **Cron schedule is correct**: `vercel.json` should have the unified `/api/pipeline/run` at `0 */3 * * *` and the old 3 crons should be removed.

7. **Old endpoints still work manually**: `POST /api/breaks/discover`, `POST /api/breaks/evaluate`, `POST /api/breaks/refresh-shelf` should all still function for admin/debugging use.
