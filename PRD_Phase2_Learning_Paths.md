# Phase 2: Learning Paths — Engineering Prompt

## Context

Phase 1 is live: `fp_content_lake` has 43+ items with pgvector embeddings, semantic search works via `search_content_lake` RPC, the Learn page renders with search, topic pills, type tabs, and content cards. Article ingestion runs every 6h via `/api/learn/ingest-articles`.

Phase 2 transforms the search results from a flat list of cards into **structured learning paths** — AI-sequenced content with sections (foundations → applied → advanced), a focused learning environment, progress tracking, and an AI tutor.

Read `CLAUDE.md` for project conventions. Then read these files before writing any code:

- `components/learn/LearnPage.tsx` (183 lines) — current search UI
- `components/learn/ContentCard.tsx` (167 lines) — current result cards
- `lib/learn/contentLake.ts` (129 lines) — content lake queries, `searchContentLake()` at line 72
- `lib/learn/embeddings.ts` (198 lines) — `generateEmbedding()` at line 25
- `lib/useLearnSearch.ts` (97 lines) — search hook
- `app/api/learn/search/route.ts` (62 lines) — search API
- `lib/types.ts` — `ContentLakeItem` (line 670), `ContentSearchResult` (line 691)
- `lib/hostPrompt.ts` (117 lines) — AI host generation pattern (reuse for tutor)
- `components/environment/BreakVideoOverlay.tsx` — `BreakVideoOverlayProps` interface (line 15)
- `LEARN_EXPERIENCE_BLUEPRINT.md` — full product spec (Part 1.2, 1.3 are the UX targets)

---

## Step 1: Database Tables

Create two new tables. Provide the SQL for the user to run manually in Supabase (do NOT use Supabase MCP — it's connected to the wrong project).

### `fp_learning_paths`

```sql
CREATE TABLE fp_learning_paths (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  query TEXT NOT NULL,
  topics TEXT[] DEFAULT '{}',
  difficulty_level TEXT DEFAULT 'intermediate',
  estimated_duration_seconds INTEGER DEFAULT 0,
  items JSONB NOT NULL DEFAULT '[]',
  sections JSONB NOT NULL DEFAULT '{}',
  ai_model TEXT DEFAULT 'gpt-4o-mini',
  generation_tokens INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  view_count INTEGER DEFAULT 0,
  start_count INTEGER DEFAULT 0,
  completion_count INTEGER DEFAULT 0,
  is_cached BOOLEAN DEFAULT false
);

CREATE INDEX idx_learning_paths_query ON fp_learning_paths (query);
CREATE INDEX idx_learning_paths_topics ON fp_learning_paths USING gin (topics);
CREATE INDEX idx_learning_paths_cached ON fp_learning_paths (is_cached) WHERE is_cached = true;
```

The `items` JSONB stores an ordered array:
```typescript
interface PathItem {
  content_id: string;       // UUID from fp_content_lake
  content_type: 'video' | 'article';
  title: string;
  creator_name: string;
  source_url: string;
  thumbnail_url: string | null;
  duration_seconds: number;
  quality_score: number;
  section: 'foundations' | 'applied' | 'advanced';
  position: number;         // order within section
  connective_text: string;  // AI-generated text bridging from previous item
}
```

The `sections` JSONB stores:
```typescript
interface PathSections {
  foundations: { title: string; description: string; item_count: number };
  applied: { title: string; description: string; item_count: number };
  advanced: { title: string; description: string; item_count: number };
}
```

### `fp_learning_progress`

```sql
CREATE TABLE fp_learning_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  path_id UUID NOT NULL REFERENCES fp_learning_paths(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ DEFAULT now(),
  last_activity_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  current_item_index INTEGER DEFAULT 0,
  items_completed INTEGER DEFAULT 0,
  items_total INTEGER NOT NULL,
  time_invested_seconds INTEGER DEFAULT 0,
  item_states JSONB DEFAULT '{}',
  status TEXT DEFAULT 'in_progress',
  UNIQUE(user_id, path_id)
);

CREATE INDEX idx_learning_progress_user ON fp_learning_progress (user_id);
CREATE INDEX idx_learning_progress_status ON fp_learning_progress (status);
```

The `item_states` JSONB tracks per-item completion:
```typescript
interface ItemStates {
  [contentId: string]: {
    completed: boolean;
    completed_at?: string;
    time_spent_seconds?: number;
  };
}
```

---

## Step 2: Learning Path Generator

Create `lib/learn/pathGenerator.ts`.

This is the core AI system that transforms search results into a structured learning path.

### Function: `generateLearningPath(query, contentItems)`

**Input:**
- `query: string` — the user's search query
- `contentItems: ContentSearchResult[]` — 8-20 items from semantic search (already sorted by combined_score)

**Process:**

1. **Intent parsing + path sequencing in a single GPT-4o-mini call.** Don't make two separate calls — combine them. The prompt gives the AI the query + the content items (title, creator, description snippet, content_type, quality_score, duration) and asks it to:
   - Classify difficulty level for the overall path (beginner / intermediate / advanced)
   - Select the best 8-12 items from the input list (don't use all of them — pick the best)
   - Assign each selected item to a section (foundations / applied / advanced)
   - Order items within each section (conceptual before practical, shorter before longer)
   - Generate a path title (creative, specific — NOT "Learning Path for [query]")
   - Generate a 1-2 sentence path description
   - Generate connective text for each item (1 sentence bridging from the previous item — what this item adds)
   - Generate section titles and descriptions

2. **Use OpenAI Structured Outputs** — follow the exact pattern from `lib/breaks/scoring.ts`:

```typescript
const response = await openai.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ],
  response_format: {
    type: 'json_schema',
    json_schema: {
      name: 'learning_path',
      strict: true,
      schema: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          difficulty_level: { type: 'string', enum: ['beginner', 'intermediate', 'advanced'] },
          sections: {
            type: 'object',
            properties: {
              foundations: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  description: { type: 'string' }
                },
                required: ['title', 'description'],
                additionalProperties: false
              },
              applied: { /* same structure */ },
              advanced: { /* same structure */ }
            },
            required: ['foundations', 'applied', 'advanced'],
            additionalProperties: false
          },
          selected_items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                content_id: { type: 'string' },
                section: { type: 'string', enum: ['foundations', 'applied', 'advanced'] },
                position: { type: 'number' },
                connective_text: { type: 'string' }
              },
              required: ['content_id', 'section', 'position', 'connective_text'],
              additionalProperties: false
            }
          }
        },
        required: ['title', 'description', 'difficulty_level', 'sections', 'selected_items'],
        additionalProperties: false
      }
    }
  }
});
```

3. **Post-process:** Merge the AI's selection with the full content metadata from the input items. Calculate `estimated_duration_seconds` by summing all selected items' durations. Count items per section.

4. **Fail gracefully.** If the AI call fails, return a simple fallback: all input items in a single "Explore" section, ordered by quality_score descending, with generic connective text.

**System prompt guidance:**

```
You are a learning path architect. Given a search query and a set of learning resources (videos and articles), select and sequence the best resources into a structured learning path.

Rules:
- Select 8-12 of the best items. Quality over quantity. Don't include filler.
- Foundations section: conceptual overviews, introductions, "what is X" content. 2-4 items.
- Applied section: practical tutorials, how-tos, demonstrations. 3-5 items.
- Advanced section: deep dives, edge cases, advanced techniques. 2-3 items.
- If there aren't enough items for all sections, use fewer sections. A 5-item path with 2 sections is better than a 12-item path with filler.
- Within sections, order: shorter before longer, broader before narrower, video before article (for variety).
- Connective text should be 1 sentence, natural, and explain what this item adds that the previous didn't cover.
- Path title should be specific and engaging, not generic. "Mastering RAG: From Concept to Production" not "RAG Learning Path".
- Mix content types (video and article) when possible for variety.
```

**Return type:**

```typescript
interface GeneratedPath {
  title: string;
  description: string;
  difficulty_level: 'beginner' | 'intermediate' | 'advanced';
  topics: string[];
  estimated_duration_seconds: number;
  items: PathItem[];
  sections: PathSections;
  generation_tokens: number;
}
```

---

## Step 3: Path API Routes

### `app/api/learn/paths/route.ts`

**POST** — Generate a learning path from a search query.

```typescript
// 1. Parse body: { query: string }
// 2. Generate embedding for query (reuse generateEmbedding from lib/learn/embeddings.ts)
// 3. Search content lake (reuse searchContentLake from lib/learn/contentLake.ts)
//    - limit: 20 (give the AI more than it needs, so it can select the best)
//    - similarity threshold: 0.15 (lower than search page's 0.2, to get more candidates)
// 4. If < 4 results, return error: "Not enough content on this topic yet. Try a broader search."
// 5. Check cache: look for existing fp_learning_paths where query is similar
//    - Exact match on lowercase trimmed query: serve cached path
//    - For now, only exact match. Fuzzy/semantic cache matching is a future optimization.
// 6. If no cache hit: call generateLearningPath(query, results)
// 7. Insert into fp_learning_paths with is_cached = true
// 8. Return the path
```

**GET** — Get user's learning paths (in progress and completed).

```typescript
// 1. Get authenticated user from Supabase auth
// 2. Query fp_learning_progress joined with fp_learning_paths
//    - Filter by user_id
//    - Order by last_activity_at DESC
// 3. Return { in_progress: [...], completed: [...] }
```

### `app/api/learn/paths/[id]/route.ts`

**GET** — Get a specific learning path with user's progress.

```typescript
// 1. Fetch path from fp_learning_paths by id
// 2. If user is authenticated, fetch their fp_learning_progress for this path
// 3. Increment view_count on the path
// 4. Return { path, progress: progress || null }
```

**PATCH** — Update user's progress on a path.

```typescript
// Body: { item_index?: number, item_completed?: string (content_id), time_delta_seconds?: number }
//
// 1. Get authenticated user
// 2. Upsert fp_learning_progress:
//    - If no existing progress: INSERT with items_total from path, increment start_count on path
//    - If existing: UPDATE
// 3. If item_completed provided:
//    - Update item_states JSONB: set completed = true, completed_at = now()
//    - Increment items_completed
//    - If items_completed === items_total: set status = 'completed', completed_at = now(), increment completion_count on path
// 4. If item_index provided: update current_item_index
// 5. If time_delta_seconds provided: add to time_invested_seconds
// 6. Always update last_activity_at = now()
// 7. Return updated progress
```

---

## Step 4: Learning Path Types

Add to `lib/types.ts` (after the existing Content Lake types around line 716):

```typescript
/** Learning path item — a single resource in a sequenced path */
export interface PathItem {
  content_id: string;
  content_type: ContentLakeType;
  title: string;
  creator_name: string;
  source_url: string;
  thumbnail_url: string | null;
  duration_seconds: number;
  quality_score: number;
  section: 'foundations' | 'applied' | 'advanced';
  position: number;
  connective_text: string;
}

/** Section metadata for a learning path */
export interface PathSection {
  title: string;
  description: string;
  item_count: number;
}

/** Section map for a learning path */
export interface PathSections {
  foundations: PathSection;
  applied: PathSection;
  advanced: PathSection;
}

/** A complete learning path */
export interface LearningPath {
  id: string;
  title: string;
  description: string;
  query: string;
  topics: string[];
  difficulty_level: 'beginner' | 'intermediate' | 'advanced';
  estimated_duration_seconds: number;
  items: PathItem[];
  sections: PathSections;
  view_count: number;
  start_count: number;
  completion_count: number;
  created_at: string;
}

/** User progress through a learning path */
export interface LearningProgress {
  id: string;
  user_id: string;
  path_id: string;
  started_at: string;
  last_activity_at: string;
  completed_at: string | null;
  current_item_index: number;
  items_completed: number;
  items_total: number;
  time_invested_seconds: number;
  item_states: Record<string, { completed: boolean; completed_at?: string; time_spent_seconds?: number }>;
  status: 'in_progress' | 'completed' | 'abandoned';
}
```

---

## Step 5: Search → Path Generation UI

Modify the LearnPage to support path generation alongside regular search.

### Update `components/learn/LearnPage.tsx`

When the user searches, they currently see a grid of ContentCards. Add a **"Generate Learning Path" button** above the results grid. When clicked, it calls `POST /api/learn/paths` with the current query and shows a loading state while the path generates (~3-5 seconds).

The flow becomes:
1. User types query → debounced search → content cards appear (instant, existing behavior)
2. Above the cards, a prominent CTA: "Create a learning path for [query]" with a sparkle/wand icon
3. User clicks → loading state ("Building your learning path...") → path preview appears
4. Path preview replaces the content cards with a structured view

### Create `components/learn/PathPreview.tsx`

This renders the generated learning path in a preview/card format. Based on the UX mockup in the blueprint (Part 1.2):

```
┌─────────────────────────────────────────────────────┐
│  [Path Title]                                       │
│  ~[duration] · [difficulty] · [item count] resources│
│  Topics: [pill] [pill] [pill]                       │
│                                                     │
│  "[description]"                                    │
│                                                     │
│  ┌─ FOUNDATIONS ([count] items, [time]) ──────────┐ │
│  │ 1. ▶ [title] · [creator] · [duration]         │ │
│  │    "[connective_text]"                         │ │
│  │ 2. 📄 [title] · [creator] · [read time]      │ │
│  │    "[connective_text]"                         │ │
│  └────────────────────────────────────────────────┘ │
│                                                     │
│  ┌─ APPLIED ([count] items, [time]) ─────────────┐ │
│  │ 3. ▶ [title] · [creator] · [duration]         │ │
│  │    "[connective_text]"                         │ │
│  │ ...                                            │ │
│  └────────────────────────────────────────────────┘ │
│                                                     │
│  ┌─ ADVANCED ([count] items, [time]) ────────────┐ │
│  │ ...                                            │ │
│  └────────────────────────────────────────────────┘ │
│                                                     │
│  [Start Learning]              [Back to Search]     │
└─────────────────────────────────────────────────────┘
```

- Each item shows a format icon (▶ for video, 📄 for article), title, creator, and duration/read-time
- Connective text in a lighter/italic style below each item
- Sections are collapsible
- "Start Learning" navigates to the learning environment page
- "Back to Search" returns to the content card grid

**Styling:** Follow the design system in `.claude/rules/ui-components.md`. Use `<Card>` from `@/components/ui/Card`. Use CSS variables for colors — never hardcode hex. Use `<Button>` from `@/components/ui/Button` with variant `cta` for "Start Learning" and variant `ghost` for "Back to Search".

---

## Step 6: The Learning Environment Page

Create `app/(learn)/learn/paths/[id]/page.tsx` — this is the focused learning experience.

### Layout

Three sections:
1. **Top bar** — path title, progress indicator (X/Y items), back button
2. **Main area** — split: Content Viewer (left, ~70% width) + Path Sidebar (right, ~30% width)
3. **Bottom panel** — AI Tutor chat (collapsible, starts collapsed)

### Content Viewer

Create `components/learn/ContentViewer.tsx` — adapts based on the current item's `content_type`:

**For videos (`content_type === 'video'`):**
- Render a YouTube embed using the same approach as `BreakVideoOverlay.tsx`. BUT — do NOT reuse BreakVideoOverlay directly. It has too much break-specific logic (engagement tracking, TV knob channel changer, break duration handling). Instead:
- Create a simpler `LearnVideoPlayer.tsx` that embeds YouTube via iframe with:
  - The video URL from `source_url` (extract video ID, construct embed URL)
  - Standard YouTube player controls (no custom chrome needed — this isn't a break, the user has full control)
  - A "Mark as Complete" button below the player
  - Auto-detect video end via YouTube iframe API `onStateChange` → prompt to advance

**For articles (`content_type === 'article'`):**
- Create `components/learn/ArticleViewer.tsx`
- Render the article in a clean reader view. For now, since we don't store full article text in the content lake, show:
  - Title, creator, published date, estimated read time
  - Description/summary from the content lake
  - A prominent "Read Full Article" button that opens `source_url` in a new tab
  - A "Mark as Complete" button
- Future improvement: store full article text in content lake and render inline

### Path Sidebar

Create `components/learn/PathSidebar.tsx`:

- Vertical list of all items in the path, grouped by section
- Section headers (Foundations / Applied / Advanced) as collapsible groups
- Each item shows:
  - Status icon: ✓ (completed, green), → (current, highlighted), ○ (upcoming, muted)
  - Format icon (▶ or 📄)
  - Title (truncated)
  - Duration
- Clicking any item jumps to it (sets current_item_index)
- Current item is highlighted with a subtle background color
- Completed items have a strikethrough or muted style

### Progress Tracking

Create `lib/useLearnProgress.ts` hook:

```typescript
function useLearnProgress(pathId: string) {
  // 1. Fetch progress from GET /api/learn/paths/[id] on mount
  // 2. Track current item index in state
  // 3. Provide functions:
  //    - completeItem(contentId: string) — PATCH to mark item complete
  //    - advanceToItem(index: number) — PATCH to update current_item_index
  //    - addTime(seconds: number) — PATCH to increment time_invested_seconds (debounced, every 30s)
  // 4. Return: { progress, currentItem, completeItem, advanceToItem, isCompleted, percentComplete }
}
```

Progress is persisted via PATCH `/api/learn/paths/[id]` on every state change. Debounce time tracking to avoid excessive API calls.

### Auto-Advance

When the user completes an item (clicks "Mark as Complete" or video ends):
1. Mark the item as completed (update progress)
2. Show a transition card: "Up next: [next item title] — [connective text]" with a "Continue" button
3. On "Continue", advance to the next item
4. If it was the last item, show a completion card: "Path complete! You've learned [topics]. [time] invested."

### AI Tutor (minimal first version)

Create `components/learn/AiTutor.tsx`:

- Collapsible panel at the bottom of the learning environment
- Toggle button: "Ask the AI Tutor" (collapsed) → chat panel (expanded)
- Simple chat interface: text input + message history
- Each message sent to `POST /api/learn/tutor` (new endpoint)

Create `app/api/learn/tutor/route.ts`:

```typescript
// POST body: { path_id, current_item_index, message }
// 1. Fetch the learning path (for context: topic, current item, previous items)
// 2. Build system prompt with tutor personality:
//    "You are an AI learning tutor. The student is working through a learning path on [topics].
//     They are currently on item [N]: '[title]' by [creator].
//     Previous items covered: [list of completed item titles].
//     Answer their question concisely. Reference specific content from the path when relevant.
//     Keep responses under 3 sentences unless they ask for more detail."
// 3. Call GPT-4o-mini (NOT Structured Outputs — plain chat completion for natural conversation)
// 4. Return { response: string }
```

Follow the fail-gracefully pattern from `hostPrompt.ts` — return a safe fallback message on any error.

---

## Step 7: Wire Up Navigation

### Learn Page → Path

When "Start Learning" is clicked on the PathPreview:
1. Navigate to `/learn/paths/[id]`
2. The path page fetches the path and creates a progress record (if the user is authenticated)
3. If the user is NOT authenticated, still show the path but with a prompt: "Sign in to track your progress"

### Path → Learn Page

Back button in the learning environment top bar returns to `/learn` with the previous search query preserved (pass as query param or use a simple state store).

### My Paths

On the Learn home page (`LearnPage.tsx`), add a section above the search bar (when user is authenticated):

```
┌──────────────────────────────────────────┐
│  Continue Learning                       │
│  ┌──────────┐  ┌──────────┐             │
│  │ Path 1   │  │ Path 2   │             │
│  │ 4/8 done │  │ 2/12 done│             │
│  └──────────┘  └──────────┘             │
└──────────────────────────────────────────┘
```

Create `components/learn/ContinueLearning.tsx` — fetches `GET /api/learn/paths` for the current user, shows in-progress paths as small cards with progress bars.

---

## Step 8: Responsive Design

The learning environment should work on both desktop and mobile:

**Desktop (>= 1024px):** Content viewer (left 70%) + Path sidebar (right 30%) side by side. AI tutor at bottom.

**Tablet (768-1023px):** Content viewer full width. Path sidebar becomes a collapsible drawer on the right (toggle button).

**Mobile (< 768px):** Content viewer full width. Path sidebar is a bottom sheet (swipe up to see path). AI tutor accessed via a floating button.

Use Tailwind responsive classes (`lg:`, `md:`) for the layout breakpoints. The main grid:

```tsx
<div className="flex flex-col lg:flex-row h-full">
  <div className="flex-1 min-w-0">
    <ContentViewer item={currentItem} onComplete={handleComplete} />
  </div>
  <div className="w-full lg:w-80 xl:w-96 border-l border-[var(--color-border)]">
    <PathSidebar path={path} progress={progress} onSelectItem={handleSelectItem} />
  </div>
</div>
```

---

## Validation Checklist

After implementing, verify:

1. **Path generation works:** Search "prompt engineering" on the Learn page. Click "Generate Learning Path." Confirm a structured path appears with sections, items, connective text, and metadata within 5 seconds.

2. **Path caching works:** Generate the same path query twice. The second time should return instantly (cache hit, no AI call).

3. **Learning environment renders:** Click "Start Learning." Confirm the content viewer shows the first item, the sidebar shows all items with correct status icons, and the top bar shows progress.

4. **Video playback works:** Navigate to a video item. Confirm YouTube embed loads and plays. Confirm "Mark as Complete" button works.

5. **Article view works:** Navigate to an article item. Confirm title, description, and "Read Full Article" link render correctly.

6. **Progress persists:** Complete 2 items, close the tab, reopen the path. Confirm progress is restored (2 items completed, current position correct).

7. **Auto-advance works:** Complete an item. Confirm the transition card appears with the next item's info. Click Continue. Confirm it advances.

8. **AI tutor responds:** Open the tutor panel. Ask "What is this video about?" Confirm a contextual response referencing the current path item.

9. **My paths works:** Generate and start a path. Return to the Learn home page. Confirm "Continue Learning" section shows the in-progress path with correct progress.

10. **Path with few results:** Search for a very niche topic that returns < 4 content lake items. Confirm a friendly error message instead of a broken path.

11. **Mobile responsive:** Resize browser to mobile width. Confirm the path sidebar collapses and the content viewer fills the width.

12. **TypeScript clean:** Run `npx tsc --noEmit` — zero type errors.
