# Learn System: Cleanup + Architecture Fix

## Context

The Learn system has 5,300 lines across 32 files. It has dead code, duplicated logic, backward compatibility tax from two competing data models, and — most critically — a search flow that requires content to be pre-indexed before it can build a path. This means any topic not already in the content lake returns "Not enough content." That's broken.

This prompt does two things in one pass:
1. **Clean up** — delete dead code, consolidate duplicates, kill backward compat, simplify
2. **Fix search** — make the curriculum generator work with raw YouTube results directly so ANY search works in <5 seconds, no pre-indexing required

Read `CLAUDE.md` for project conventions before starting.

---

## Part 1: Delete Dead Code

### 1a. Delete AiTutor

Delete these files entirely:
- `components/learn/AiTutor.tsx` (174 lines) — never imported, never rendered
- `app/api/learn/tutor/route.ts` (if it exists) — serves the dead component

Search the codebase for any remaining imports of `AiTutor` and remove them. There should be none — it was never wired in.

### 1b. Delete promptBuilder.ts

Delete `lib/learn/promptBuilder.ts` (49 lines). Its logic is duplicated inside `curriculumGenerator.ts` (the `buildToolPrompts` function at ~line 587). The curriculum generator's version is more complete — it uses content context and guidance levels.

Search for any imports of `buildToolPrompt` from `@/lib/learn/promptBuilder` and remove them. If `PracticeViewer.tsx` imports it, update it to inline the simple string construction or use a local helper — do NOT import from curriculumGenerator.

### 1c. Delete practiceInterleaver.ts

Verify `lib/learn/practiceInterleaver.ts` is already deleted. If it still exists, delete it. Search for any imports of `interleavePractice` and remove them.

---

## Part 2: Consolidate Duplicates

### 2a. Consolidate generateShareSlug

`generateShareSlug()` is copy-pasted in two files:
- `app/api/learn/paths/[id]/route.ts`
- `app/api/learn/achievements/route.ts`

Create a single utility:

**New file: `lib/learn/utils.ts`**

```typescript
import { customAlphabet } from 'nanoid';

const nanoid = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 10);

/** Generate a URL-safe share slug for achievements */
export function generateShareSlug(): string {
  return nanoid();
}

/** Format seconds into human-readable duration */
export function formatDuration(seconds: number): string {
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return remainMins > 0 ? `${hrs}h ${remainMins}m` : `${hrs}h`;
}
```

Update both route files to import from `@/lib/learn/utils` instead of defining their own copy. Check if `nanoid` is already a dependency — if not, install it: `npm install nanoid`.

### 2b. Consolidate buildSearchText

`buildSearchText()` exists in `lib/learn/embeddings.ts`. Check if `lib/breaks/scoring.ts` or any other breaks file has a duplicate. If so, have the breaks code import from `lib/learn/embeddings.ts`, or move the function to a shared location like `lib/learn/utils.ts`.

---

## Part 3: Kill Backward Compatibility

The codebase supports two data models simultaneously:
- **Old:** `PathItem` with `section` (foundations/applied/advanced), `practice: PracticeItem | null`, `PathSections`
- **New:** `PathItem` with `task_type`, `module_index`, `mission`, `check`, `reflection`, `CurriculumModule[]`

This causes parallel logic everywhere — `mapPathRow` has fallbacks, `PathSidebar` renders both structures, every component checks for both shapes. Pick one model and commit.

### 3a. Clean up mapPathRow in pathGenerator.ts

The current `mapPathRow` (lines 15-51) has defensive fallbacks for old data. Since we're moving forward with the new model, simplify it. Any old paths in the database will get the defaults — that's fine.

Replace the items mapping (lines 16-27) with:

```typescript
const items = ((row.items as LearningPath['items']) ?? []).map((item, idx) => ({
  ...item,
  item_id: item.item_id ?? `item-${idx}`,
  task_type: item.task_type ?? 'watch',
  module_index: item.module_index ?? 0,
  mission: item.mission ?? null,
  check: item.check ?? null,
  reflection: item.reflection ?? null,
  content_id: item.content_id ?? null,
  content_type: item.content_type ?? null,
  creator_name: item.creator_name ?? null,
  source_url: item.source_url ?? null,
  thumbnail_url: item.thumbnail_url ?? null,
  quality_score: item.quality_score ?? null,
}));
```

Remove the `practice: item.practice ?? null` line. The old `practice` field is dead.

### 3b. Clean up PathSidebar.tsx

`PathSidebar.tsx` (316 lines) has parallel rendering logic for `modules` vs `sections`. Remove the sections codepath entirely. The sidebar should only render modules. If a path doesn't have modules (legacy data), create a single default module from all items.

Find the conditional that checks for `path.modules` vs `path.sections` and replace it:

```typescript
const modules = path.modules?.length
  ? path.modules
  : [{ index: 0, title: path.title, description: '', task_count: path.items.length, duration_seconds: path.estimated_duration_seconds }];
```

Then remove all `sections`-based rendering code.

### 3c. Remove old types from lib/types.ts

Remove the `@deprecated` tags and the old types if nothing imports them:
- Remove `PracticeType` (if no file imports it)
- Remove `PracticeItem` (if no file imports it)
- Remove `PathSections` (if no file imports it — the sidebar may still reference it, so check)

If `PracticeViewer.tsx` still imports `PracticeItem`, leave it for now — it'll be cleaned up when PracticeViewer is refactored (separate task, not this prompt).

---

## Part 4: Fix the Search Architecture

This is the critical fix. The curriculum generator currently requires content to be in the content lake before it can build a path. This means novel topics fail. The fix: **accept raw YouTube results directly**.

### 4a. Add a lightweight content type for raw YouTube results

In `lib/types.ts`, add:

```typescript
/** A YouTube video result not yet indexed in the content lake */
export interface RawVideoResult {
  video_id: string;
  title: string;
  description: string;
  channel_title: string;
  thumbnail_url: string;
  duration_seconds: number;
  view_count: number;
  published_at: string;
}
```

### 4b. Rewrite the curriculum generator's content sourcing

**File: `lib/learn/curriculumGenerator.ts`**

The current `generateCurriculum` function (starting around line 216) does this:
1. Generate embedding → search content lake → filter by similarity
2. If thin → gap-fill (search YouTube, score each, embed each, upsert each, re-search)
3. Build curriculum from content lake results

Replace this with a cleaner two-source approach:

```typescript
export async function generateCurriculum(
  query: string,
  options?: {
    userRole?: string;
    userGoal?: string;
  }
): Promise<LearningPath> {
  // 1. Try the content lake first (fast path for known topics)
  let contentForCurriculum: ContentForCurriculum[] = [];

  try {
    const embedding = await generateEmbedding(query);
    const lakeResults = await searchContentLake(embedding, { limit: 15 });
    const relevant = lakeResults.filter((r) => r.similarity > 0.3);

    if (relevant.length >= 3) {
      // Fast path: enough in the lake, use it
      contentForCurriculum = relevant.map(lakeItemToContent);
      console.log(`[curriculum] Using ${relevant.length} lake items for "${query}"`);
    }
  } catch (err) {
    console.error('[curriculum] Lake search failed:', err);
  }

  // 2. If lake is thin, search YouTube directly (works for ANY topic)
  if (contentForCurriculum.length < 3) {
    console.log(`[curriculum] Lake thin for "${query}" — searching YouTube directly`);

    try {
      const { searchVideos, getVideoDetails } = await import('@/lib/breaks/youtubeClient');

      // Search YouTube with multiple query variations for better coverage
      const queries = [
        `${query} tutorial`,
        `${query} explained`,
        `learn ${query}`,
      ];

      const allVideoIds = new Set<string>();
      for (const q of queries) {
        try {
          const results = await searchVideos(q, {
            maxResults: 8,
            videoDuration: 'medium',
            order: 'relevance',
          });
          results.forEach((r) => allVideoIds.add(r.videoId));
        } catch {
          // Continue with other queries
        }
      }

      if (allVideoIds.size > 0) {
        const videos = await getVideoDetails([...allVideoIds].slice(0, 15));
        const validVideos = videos.filter(
          (v) => v.durationSeconds >= 120 && v.durationSeconds <= 2400
        );

        contentForCurriculum = validVideos.map((v) => ({
          id: v.videoId,
          title: v.title,
          content_type: 'video' as const,
          creator_name: v.channelTitle,
          description: v.description,
          source_url: `https://youtube.com/watch?v=${v.videoId}`,
          thumbnail_url: v.thumbnailUrl,
          duration_seconds: v.durationSeconds,
          quality_score: estimateQuality(v),
          topics: [],
          has_scaffolding: false,
          scaffolding_exercise: null,
        }));

        console.log(`[curriculum] Found ${contentForCurriculum.length} YouTube videos for "${query}"`);

        // Background: index these to the content lake for next time
        // Fire-and-forget — don't block the response
        indexYouTubeResultsAsync(validVideos, query).catch((err) =>
          console.error('[curriculum] Background indexing failed:', err)
        );
      }
    } catch (err) {
      console.error('[curriculum] YouTube search failed:', err);
    }
  }

  // 3. If we still don't have enough, give up gracefully
  if (contentForCurriculum.length < 2) {
    throw new Error(`Not enough content for "${query}" (found ${contentForCurriculum.length})`);
  }

  // 4. Generate the curriculum from whatever content we have
  return buildCurriculumFromContent(query, contentForCurriculum, options);
}
```

### 4c. Define the unified content interface

This is what the curriculum builder works with — whether the content came from the lake or raw YouTube:

```typescript
/** Unified content representation for curriculum building */
interface ContentForCurriculum {
  id: string;
  title: string;
  content_type: 'video' | 'article';
  creator_name: string;
  description: string;
  source_url: string;
  thumbnail_url: string | null;
  duration_seconds: number;
  quality_score: number;
  topics: string[];
  has_scaffolding: boolean;
  scaffolding_exercise: {
    prompt: string;
    tools: string[];
    has_starter_code: boolean;
  } | null;
}

/** Convert a content lake result to the unified format */
function lakeItemToContent(item: ContentSearchResult): ContentForCurriculum {
  return {
    id: item.id,
    title: item.title,
    content_type: item.content_type,
    creator_name: item.creator_name ?? 'Unknown',
    description: (item.description ?? '').slice(0, 300),
    source_url: item.source_url,
    thumbnail_url: item.thumbnail_url,
    duration_seconds: item.duration_seconds ?? 300,
    quality_score: item.quality_score ?? 50,
    topics: item.topics?.slice(0, 5) ?? [],
    has_scaffolding: !!item.scaffolding,
    scaffolding_exercise: item.scaffolding?.exercise
      ? {
          prompt: item.scaffolding.exercise.prompt?.slice(0, 200) ?? '',
          tools: item.scaffolding.exercise.tools ?? [],
          has_starter_code: !!item.scaffolding.exercise.starterCode,
        }
      : null,
  };
}

/** Estimate quality for a raw YouTube video based on signals */
function estimateQuality(video: { viewCount: number; likeCount: number; durationSeconds: number }): number {
  // Simple heuristic: view count + engagement as quality proxy
  let score = 50; // base
  if (video.viewCount > 100000) score += 15;
  else if (video.viewCount > 10000) score += 10;
  else if (video.viewCount > 1000) score += 5;
  if (video.durationSeconds >= 300 && video.durationSeconds <= 1200) score += 10; // sweet spot
  return Math.min(score, 95);
}
```

### 4d. Background indexing function

This runs AFTER the response is sent. It indexes YouTube results to the content lake so the next search is instant:

```typescript
/** Index YouTube results to the content lake in the background */
async function indexYouTubeResultsAsync(
  videos: Array<{
    videoId: string;
    title: string;
    description: string;
    channelId: string;
    channelTitle: string;
    thumbnailUrl: string;
    publishedAt: string;
    durationSeconds: number;
    viewCount: number;
    likeCount: number;
  }>,
  query: string
): Promise<void> {
  const { scoreForLearning } = await import('@/lib/learn/seedScorer');
  const supabase = (await import('@/lib/supabase/admin')).createClient();

  for (const video of videos.slice(0, 8)) {
    try {
      const score = await scoreForLearning({
        title: video.title,
        description: video.description,
        channelTitle: video.channelTitle,
        durationSeconds: video.durationSeconds,
        viewCount: video.viewCount,
      });

      if (score.rejected || score.quality_score < 40) continue;

      const searchText = buildSearchText({
        title: video.title,
        description: video.description,
        topics: score.topics,
        creator_name: video.channelTitle,
      });
      const embedding = await generateEmbedding(searchText);

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
          embedding: `[${embedding.join(',')}]`,
          embedding_model: 'text-embedding-3-small',
          search_text: searchText,
          scaffolding: null,
          scaffolding_status: 'none',
          status: 'active',
        },
        { onConflict: 'content_type,external_id' }
      );
    } catch (err) {
      console.error(`[curriculum] Background index failed for "${video.title}":`, err);
    }
  }

  console.log(`[curriculum] Background indexing complete for "${query}"`);
}
```

### 4e. Extract the curriculum building into its own function

Move the GPT-4o-mini call and post-processing into `buildCurriculumFromContent()`. This function should take `ContentForCurriculum[]` (not `ContentSearchResult[]`) so it works with both lake and raw YouTube content.

The existing code for building item summaries, calling GPT, and post-processing (currently in `generateCurriculum` from ~line 342 onward) should be moved here. The system prompt and schema stay the same. The only change: instead of passing `ContentSearchResult`, pass `ContentForCurriculum`.

Update the `itemSummaries` building to use the `ContentForCurriculum` fields:

```typescript
const itemSummaries = content.map((item) => ({
  content_id: item.id,
  title: item.title,
  content_type: item.content_type,
  creator: item.creator_name,
  description: item.description,
  quality_score: item.quality_score,
  duration_seconds: item.duration_seconds,
  topics: item.topics,
  has_scaffolding: item.has_scaffolding,
  scaffolding_exercise: item.scaffolding_exercise,
}));
```

### 4f. Remove the old gap-fill code

Delete the entire gap-fill block (lines ~234-333 in the current file). It's replaced by the cleaner two-source approach in step 4b. The old gap-fill was doing YouTube search → score 8 videos → embed 8 videos → upsert 8 → re-search — all synchronously. The new approach doesn't score or embed on the critical path at all.

### 4g. Update the search route for better UX

**File: `app/api/learn/search/route.ts`**

The current search route calls `generateAndCachePath` which can take 5-10 seconds. Add a timeout so the user isn't left hanging:

Find the `generateAndCachePath` call (~line 108) and wrap it:

```typescript
// 2. Generate a fresh path if we don't have enough cached matches
if (results.length < 3) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout

    const freshPath = await Promise.race([
      generateAndCachePath(query),
      new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error('Generation timeout')), 15000)
      ),
    ]);

    clearTimeout(timeout);

    if (freshPath) {
      const existingIds = new Set(results.map((r) => r.id));
      if (!existingIds.has(freshPath.id)) {
        results.unshift(freshPath);
      }
    }
  } catch (err) {
    console.error('[learn/search] Path generation failed or timed out:', err);
  }
}
```

---

## Part 5: Remove Seeding Infrastructure (Optional)

With the search flow fixed to use YouTube directly, the manual seeding infrastructure becomes optional. The content lake fills itself organically from user searches. However, the seed endpoint is still useful for bootstrapping — so don't delete it, just recognize it's an admin utility, not a requirement.

The files to keep but acknowledge as optional:
- `lib/learn/seedTopics.ts` — reference data, fine to keep
- `lib/learn/seedScorer.ts` — used by background indexing, keep
- `app/api/admin/seed-content-lake/route.ts` — admin utility, keep

---

## Part 6: Verify

After all changes:

1. **Type check:** `npx tsc --noEmit` — fix any type errors
2. **Search test (seeded topic):** Search "cursor" → should return results from the lake (fast path, ~3 seconds)
3. **Search test (novel topic):** Search "lovable" → should search YouTube directly, generate curriculum from raw results (~5 seconds)
4. **Search test (obscure topic):** Search "quantum computing AI" → should find YouTube results and build a path
5. **Verify background indexing:** After searching "lovable," check the content lake — the YouTube videos should appear there within 30 seconds
6. **Second search:** Search "lovable" again → should be faster now (content is in the lake)
7. **Dead code check:** `grep -r "AiTutor\|promptBuilder\|interleavePractice\|PathSections" --include="*.ts" --include="*.tsx" lib/ components/ app/` — should return nothing

---

## Summary of Changes

| Action | Files | Lines Removed | Lines Added |
|--------|-------|---------------|-------------|
| Delete AiTutor | AiTutor.tsx, tutor route | ~200 | 0 |
| Delete promptBuilder | promptBuilder.ts | ~50 | 0 |
| Delete practiceInterleaver | practiceInterleaver.ts (if exists) | ~130 | 0 |
| Consolidate shareSlug | utils.ts, 2 route files | ~30 | ~20 |
| Kill backward compat | pathGenerator, PathSidebar, types | ~80 | ~20 |
| Fix search architecture | curriculumGenerator.ts | ~200 (gap-fill) | ~180 (two-source) |
| Add timeout to search | search/route.ts | ~5 | ~15 |
| **Net** | | **~695 removed** | **~235 added** |

Net reduction: **~460 lines**. The codebase gets smaller AND search works for any topic.

---

## What NOT To Do

- Do NOT rewrite PracticeViewer.tsx in this prompt. It's bloated but functional. That's a separate task.
- Do NOT touch the learning path page UI (`paths/[id]/page.tsx`). Also separate.
- Do NOT modify the breaks pipeline (discovery, scoring, shelf). It's for Rooms, not Learn.
- Do NOT delete the seed endpoint or seed topics — they're useful admin utilities.
- Do NOT use Supabase MCP tools. All DB operations go through the admin client in code.
- Do NOT add new features. This is cleanup + architecture fix only.
