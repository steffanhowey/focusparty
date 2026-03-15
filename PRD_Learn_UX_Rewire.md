# Learn UX Rewire — Engineering Prompt

## What's Wrong

The Learn page currently shows individual video/article cards from the content lake. Clicking a card opens YouTube in a new tab. This is fundamentally wrong. We are not building a content browser. We are building a structured learning environment.

**The rule: every card the user sees on the Learn page is a learning path. Clicking it takes them into the learning environment. No exceptions. No links to YouTube. No individual content items as cards.**

Read `CLAUDE.md` for project conventions. Then read these files before writing any code:

- `components/learn/LearnPage.tsx` (182 lines) — the page we're rewriting
- `components/learn/ContentCard.tsx` (167 lines) — being replaced with PathCard
- `lib/learn/pathGenerator.ts` (347 lines) — `generateLearningPath()` at line 52
- `lib/learn/contentLake.ts` (129 lines) — `searchContentLake()` at line 72, `getContentByTopics()` at line 47
- `lib/learn/embeddings.ts` (198 lines) — `generateEmbedding()` at line 25
- `app/api/learn/paths/route.ts` (202 lines) — POST generates path, GET lists user paths
- `app/api/learn/search/route.ts` (62 lines) — current search endpoint (will be replaced)
- `lib/useLearnSearch.ts` (97 lines) — current search hook (will be rewritten)
- `lib/types.ts` — `LearningPath` at line ~718, `ContentSearchResult` at line 691
- The learning environment page at `app/(learn)/learn/paths/[id]/page.tsx` or `app/(hub)/learn/paths/[id]/page.tsx` — wherever Phase 2 put it

---

## The New Mental Model

The user sees **learning path cards** everywhere on the Learn page:

1. **Before search (discovery):** Pre-generated paths for popular topics, trending topics, and the user's interests. These are cards. Click one → learning environment.

2. **After search:** The system generates 2-4 learning paths from the search results. These are cards. Click one → learning environment.

3. **Continue learning:** In-progress paths the user has started. These are cards. Click one → learning environment.

Every entry point is a card. Every card is a path. Every click goes to the learning environment. That's the entire interaction model.

---

## Step 1: Pre-Generate Discovery Paths

Create `app/api/learn/discover/route.ts` — a cron endpoint that pre-generates learning paths for popular topics so the home page always has content.

**GET handler (cron):**

```typescript
// 1. Get a list of seed topics to generate paths for.
//    Sources (in priority order):
//    a. Top topics from fp_topic_taxonomy ordered by heat or usage
//    b. Hardcoded popular seeds as fallback:
const SEED_QUERIES = [
  'prompt engineering fundamentals',
  'building RAG pipelines',
  'AI agents and tool use',
  'fine-tuning large language models',
  'vector databases for AI',
  'AI coding assistants and workflows',
  'machine learning for beginners',
  'building AI-powered apps with Next.js',
  'LLM evaluation and testing',
  'AI product strategy',
  'open source AI models',
  'AI safety and ethics',
];

// 2. For each seed query:
//    a. Check if a cached path already exists (query match in fp_learning_paths where is_cached = true)
//    b. If no cached path OR cached path is older than 7 days: generate a new one
//    c. Generate embedding → search content lake → call generateLearningPath()
//    d. Save with is_cached = true
//    e. Respect a 50s timeout guard — stop generating if approaching Vercel limit

// 3. Return: { generated: number, skipped: number (already cached), errors: string[] }
```

**Add to `vercel.json`:**
```json
{ "path": "/api/learn/discover", "schedule": "0 5 * * *" }
```

Runs daily at 5 AM UTC. As the content lake grows, these paths get richer automatically.

**POST handler (manual trigger):**
Accepts `{ queries?: string[] }` to generate specific paths on demand. Useful for admin seeding.

---

## Step 2: New Search Flow — Search Returns Paths, Not Content

### Rewrite `app/api/learn/search/route.ts`

The search endpoint currently returns raw `ContentLakeItem[]`. Rewrite it to return `LearningPath[]`.

**New GET handler:**

```typescript
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q')?.trim();
  const limit = Math.min(parseInt(searchParams.get('limit') || '6'), 10);

  // NO QUERY: Return pre-generated discovery paths
  if (!query) {
    const { data: discoveryPaths } = await supabaseAdmin
      .from('fp_learning_paths')
      .select('*')
      .eq('is_cached', true)
      .order('view_count', { ascending: false })
      .limit(limit);

    // Also get user's in-progress paths if authenticated
    let inProgress: any[] = [];
    const supabaseServer = await createClient();
    const { data: { user } } = await supabaseServer.auth.getUser();
    if (user) {
      const { data: progress } = await supabaseAdmin
        .from('fp_learning_progress')
        .select('*, path:fp_learning_paths(*)')
        .eq('user_id', user.id)
        .eq('status', 'in_progress')
        .order('last_activity_at', { ascending: false })
        .limit(3);
      inProgress = progress || [];
    }

    return NextResponse.json({
      discovery: (discoveryPaths || []).map(mapPathRow),
      in_progress: inProgress.map(p => ({
        path: mapPathRow(p.path),
        progress: mapProgressRow(p),
      })),
      query: null,
    });
  }

  // WITH QUERY: Check for cached paths first, then generate on the fly
  // 1. Look for existing cached paths whose query or topics match
  const { data: cachedPaths } = await supabaseAdmin
    .from('fp_learning_paths')
    .select('*')
    .eq('is_cached', true)
    .ilike('query', `%${query}%`)
    .order('view_count', { ascending: false })
    .limit(3);

  // 2. Also do a topic-based match: find paths whose topics overlap with the query's intent
  //    Generate embedding for the query
  const embedding = await generateEmbedding(query);

  // 3. Search the content lake to see if we have enough content for a fresh path
  const { data: searchResults } = await searchContentLake(embedding, { limit: 20 });
  const viable = (searchResults || []).filter((r: any) => r.similarity > 0.15);

  // 4. If we have cached paths that match, return them
  //    If we also have enough content (>= 4 items), generate a fresh personalized path too
  const results: LearningPath[] = [];

  // Add cached matches
  if (cachedPaths?.length) {
    results.push(...cachedPaths.map(mapPathRow));
  }

  // Generate a fresh path if we have content and don't already have 3+ cached matches
  if (viable.length >= 4 && results.length < 3) {
    try {
      // Get user context for personalization (optional)
      let userContext;
      const supabaseServer = await createClient();
      const { data: { user } } = await supabaseServer.auth.getUser();
      if (user) {
        const { data: profile } = await supabaseAdmin
          .from('fp_profiles')
          .select('current_role, target_goal, experience_level, learning_topics')
          .eq('id', user.id)
          .single();
        if (profile) {
          userContext = {
            role: profile.current_role,
            goal: profile.target_goal,
            experience_level: profile.experience_level,
            topics: profile.learning_topics,
          };
        }
      }

      const generated = await generateLearningPath(query, viable, userContext);

      // Save it
      const { data: saved } = await supabaseAdmin
        .from('fp_learning_paths')
        .insert({
          title: generated.title,
          description: generated.description,
          query: query.toLowerCase().trim(),
          topics: generated.topics,
          difficulty_level: generated.difficulty_level,
          estimated_duration_seconds: generated.estimated_duration_seconds,
          items: generated.items,
          sections: generated.sections,
          ai_model: 'gpt-4o-mini',
          generation_tokens: generated.generation_tokens,
          is_cached: true,
        })
        .select()
        .single();

      if (saved) {
        // Put the fresh path first — it's personalized
        results.unshift(mapPathRow(saved));
      }
    } catch (err) {
      console.error('[learn/search] Path generation failed:', err);
      // Still return cached paths if generation fails
    }
  }

  // If we have nothing at all, return a helpful message
  if (results.length === 0) {
    return NextResponse.json({
      discovery: [],
      in_progress: [],
      query,
      message: 'Not enough content on this topic yet. Try a broader search or check back soon — our content lake is growing daily.',
    });
  }

  return NextResponse.json({
    discovery: results,
    in_progress: [],
    query,
  });
}
```

**Key behavior:**
- No query → return pre-generated discovery paths + user's in-progress paths
- With query → check cache for matching paths, generate a fresh personalized path if content exists, return all matches
- The response shape is always `{ discovery: LearningPath[], in_progress: [...], query }` — consistent whether browsing or searching

---

## Step 3: Create PathCard Component

Create `components/learn/PathCard.tsx` — replaces ContentCard entirely.

This card represents a learning path. It shows:

```
┌─────────────────────────────────────────┐
│  [Thumbnail / gradient based on topic]  │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  difficulty badge    item count │    │
│  └─────────────────────────────────┘    │
├─────────────────────────────────────────┤
│  Path Title                             │
│  1-line description...                  │
│                                         │
│  ⏱ ~2h 30min  ·  8 resources           │
│                                         │
│  [topic pill] [topic pill] [topic pill] │
│                                         │
│  Sections: Foundations → Applied →       │
│  Advanced                               │
└─────────────────────────────────────────┘
```

**Props:**
```typescript
interface PathCardProps {
  path: LearningPath;
  progress?: LearningProgress | null; // if user has started this path
  onClick: (pathId: string) => void;
}
```

**Design details:**
- The thumbnail area: use the first video item's YouTube thumbnail if available. If no video items, use a gradient background based on the primary topic (generate a subtle color from the topic slug hash).
- Difficulty badge: colored pill — green for beginner, blue for intermediate, purple for advanced.
- Item count: "8 resources" or "5 videos, 3 articles" for more detail.
- Duration: format `estimated_duration_seconds` as "~Xh Ymin" or "~Xmin" if under an hour.
- Topic pills: show up to 3 from `path.topics`, same style as the existing TopicFilters pills.
- Section preview: a subtle text line showing section names → → → to hint at the structure.
- If `progress` is provided: show a progress bar and "X/Y completed" instead of the section preview. Different visual state for in-progress paths.
- **Click handler:** `onClick(path.id)` — the parent navigates to `/learn/paths/${path.id}`.
- **No external links anywhere.** No YouTube links. No "open in new tab." Clicking the card = entering the learning environment.

**Styling:** Use `<Card>` from `@/components/ui/Card`. CSS variables for colors. `<Button>` not needed — the whole card is the click target with hover state (subtle border color change or shadow lift).

---

## Step 4: Rewrite LearnPage

Rewrite `components/learn/LearnPage.tsx` completely. The old version showed a grid of ContentCards. The new version shows a grid of PathCards.

**Layout:**

```
┌──────────────────────────────────────────────────┐
│  What do you want to learn?                      │
│  [Search bar]                                    │
│  [topic pills: prompt-engineering, rag, ...]     │
├──────────────────────────────────────────────────┤
│                                                  │
│  Continue Learning (if user has in-progress)     │
│  ┌──────────┐  ┌──────────┐                     │
│  │ PathCard  │  │ PathCard  │  ← with progress   │
│  │ 4/8 done │  │ 2/12 done│     bars             │
│  └──────────┘  └──────────┘                     │
│                                                  │
│  Explore (or "Results for [query]")              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │ PathCard  │  │ PathCard  │  │ PathCard  │     │
│  └──────────┘  └──────────┘  └──────────┘      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │ PathCard  │  │ PathCard  │  │ PathCard  │     │
│  └──────────┘  └──────────┘  └──────────┘      │
│                                                  │
└──────────────────────────────────────────────────┘
```

**Behavior:**

1. **On mount (no query):** Fetch `GET /api/learn/search` (no query param). Displays:
   - "Continue Learning" section if user has in-progress paths (from `in_progress` in response)
   - "Explore" section with pre-generated discovery paths (from `discovery` in response)

2. **On search:** Fetch `GET /api/learn/search?q=[query]`. Shows a loading state while the path generates (~3-5s for fresh generation). Displays:
   - "Results for [query]" section header
   - PathCards for the returned paths
   - If generating, show a skeleton/shimmer card with text: "Building a learning path for [query]..."

3. **Topic pill click:** Sets the query to the topic slug (converted to readable text) and triggers a search. Same as typing the topic and searching.

4. **Card click:** Navigate to `/learn/paths/${path.id}`. That's it.

**Remove:**
- `ContentCard.tsx` is no longer used on the Learn page. Don't delete the file yet (it might be used elsewhere), but remove all imports from LearnPage.
- The "Videos / Articles" type tabs — these don't make sense when showing paths.
- Any external link behavior.

### Rewrite `lib/useLearnSearch.ts`

The hook now returns paths, not content items:

```typescript
interface UseLearnSearchReturn {
  query: string;
  setQuery: (q: string) => void;
  discoveryPaths: LearningPath[];
  inProgressPaths: { path: LearningPath; progress: LearningProgress }[];
  isLoading: boolean;
  error: string | null;
  message: string | null; // "Not enough content..." message
  hasSearched: boolean;
  topicFilters: string[];
  toggleTopic: (slug: string) => void;
}
```

Remove `typeFilter` / `setTypeFilter` — not relevant for paths.

The API call changes from `/api/learn/search?q=...&type=...` to just `/api/learn/search?q=...`.

Debounce stays at 300ms but consider increasing to 500ms since path generation takes longer than content search. Show a loading skeleton during generation.

---

## Step 5: Loading States

Path generation takes 3-5 seconds (embedding generation + content lake search + GPT-4o-mini call). The loading state needs to feel intentional, not broken.

**While generating:**
Show 1-2 skeleton PathCards with a shimmer animation and text: "Building your learning path..." — this communicates that the system is doing real work, not just loading.

**Implementation:**
Create `components/learn/PathCardSkeleton.tsx` — same dimensions as PathCard but with animated placeholder blocks for title, description, and topic pills. Use Tailwind's `animate-pulse` on gray placeholder divs.

---

## Step 6: Topic Pills Trigger Path Search

The topic pills below the search bar (`prompt-engineering`, `rag`, `ai-agents`, etc.) should behave identically to typing that topic and searching. When clicked:

1. Set the search query to the topic's readable name (e.g., "prompt engineering")
2. Trigger the search flow
3. Show loading skeletons → then path results

This means clicking "rag" shows paths about RAG. Clicking "ai-agents" shows paths about AI agents. Every pill is a one-tap entry into a structured learning experience.

---

## Step 7: Update the Content Lake Stats Display

The current LearnPage shows stats like "43 videos, 12 articles" on mount. Replace this with path-relevant stats:

```typescript
// Instead of content lake stats, show:
// - Total learning paths available
// - Total learning hours across all paths
// - Number of topics covered

const { data: pathStats } = await supabaseAdmin
  .from('fp_learning_paths')
  .select('id, estimated_duration_seconds, topics')
  .eq('is_cached', true);

const stats = {
  paths: pathStats?.length || 0,
  totalHours: Math.round((pathStats?.reduce((sum, p) => sum + (p.estimated_duration_seconds || 0), 0) || 0) / 3600),
  topics: new Set(pathStats?.flatMap(p => p.topics || []) || []).size,
};
```

Display subtly below the search hero: "12 learning paths · 24 hours of content · 8 topics" — or hide entirely until the numbers are meaningful.

---

## Step 8: Cleanup

- Remove the "Videos / Articles" type filter tabs from LearnPage
- Remove imports of `ContentCard` from LearnPage (keep the file in case it's used in admin)
- Remove `typeFilter` and `setTypeFilter` from the search hook
- Remove any `target="_blank"` or external link behavior from Learn components
- Make sure the PathCard's `onClick` uses Next.js `router.push()` (from `next/navigation`) for client-side navigation to `/learn/paths/[id]`

---

## Validation Checklist

1. **Discovery paths load on mount:** Open `/learn` fresh. Confirm PathCards appear (not ContentCards, not video thumbnails linking to YouTube). Each card shows: title, description, duration, resource count, difficulty badge, topic pills.

2. **No external links:** Click every card. Confirm every click navigates to `/learn/paths/[id]` — never to YouTube, never to an external URL, never opens a new tab.

3. **Search generates paths:** Type "prompt engineering" in the search bar. Confirm a loading skeleton appears, then 1-3 PathCards appear within 5 seconds.

4. **Topic pills work:** Click the "rag" pill. Confirm it triggers search and shows RAG-related path cards.

5. **Continue Learning shows in-progress paths:** Start a path, go back to `/learn`. Confirm "Continue Learning" section shows the in-progress path with a progress bar.

6. **Empty state works:** Search for something with no content (e.g., "underwater basket weaving"). Confirm a friendly message appears, not a broken page.

7. **Card click → learning environment:** Click a PathCard. Confirm it navigates to the learning environment page where the user can watch videos and work through the path.

8. **No YouTube links anywhere on /learn:** Inspect the page. There should be zero `<a>` tags pointing to youtube.com. Zero `target="_blank"` attributes. Zero external navigation.

9. **Path generation with few results:** If the content lake has < 4 items matching a query, confirm a helpful message instead of an empty/broken grid.

10. **Pre-generation cron works:** Hit `POST /api/learn/discover` manually. Confirm it generates cached paths for seed topics.

11. **TypeScript clean:** Run `npx tsc --noEmit` — zero type errors.

12. **Mobile responsive:** PathCards should render as a single column on mobile, 2 columns on tablet, 3 on desktop.
