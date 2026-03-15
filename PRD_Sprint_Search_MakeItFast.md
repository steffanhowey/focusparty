# Sprint A: "Make It Fast" — Search Speed & Two-Phase Architecture

## Goal

Search results appear in < 300ms for any query that has cached paths. Path generation happens in the background, never blocking the user. When no cached results exist, the user sees a real-time generation card instead of a silent spinner.

## Context

Read `SEARCH_AUDIT.md` for the full analysis. This sprint implements the P0 findings:
- Two-phase response architecture (instant cache + async generation)
- Parallel YouTube API calls
- Generation status polling endpoint
- Frontend: instant results + GenerationCard for async feedback
- Increased cache result limit from 3 to 12

## Important: Follow all conventions in CLAUDE.md

- Use CSS variables for colors (`var(--color-*)`)
- Use `<Button>` from `@/components/ui/Button`, `<Card>` from `@/components/ui/Card`
- Never hardcode hex values or Tailwind color defaults
- Strict TypeScript. All exported functions need explicit param/return types.
- Use `camelCase` for functions, `PascalCase` for types/interfaces.

---

## Step 1: Parallelize YouTube API Calls

**File:** `lib/learn/curriculumGenerator.ts`

**What:** The YouTube fallback (lines ~253-266) runs 3 search queries sequentially in a `for` loop. Change to `Promise.allSettled`.

**Current code (around line 253):**
```typescript
for (const q of queries) {
  try {
    const results = await searchVideos(q, {
      maxResults: 8,
      videoDuration: "medium",
      order: "relevance",
    });
    results.forEach((r: { videoId: string }) =>
      allVideoIds.add(r.videoId)
    );
  } catch {
    // Continue with other queries
  }
}
```

**Replace with:**
```typescript
const searchResults = await Promise.allSettled(
  queries.map((q) =>
    searchVideos(q, {
      maxResults: 8,
      videoDuration: "medium",
      order: "relevance",
    })
  )
);

for (const result of searchResults) {
  if (result.status === "fulfilled") {
    result.value.forEach((r: { videoId: string }) =>
      allVideoIds.add(r.videoId)
    );
  }
}
```

**No other changes in this file for this step.**

---

## Step 2: New API Route — Generation Status

**Create:** `app/api/learn/search/generate/route.ts`

This endpoint starts path generation and returns a generation ID. A second call with that ID checks status.

```typescript
import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@/lib/supabase/admin";
import { generateAndCachePath, mapPathRow } from "@/lib/learn/pathGenerator";
import type { LearningPath } from "@/lib/types";

/**
 * In-memory generation tracker.
 * Maps generation_id → { status, path?, error? }
 *
 * NOTE: This works because Vercel serverless functions share memory
 * within a single warm instance. For multi-instance, we'd use a DB row,
 * but for current scale this is fine. Entries auto-expire after 5 minutes.
 */
interface GenerationEntry {
  status: "generating" | "completed" | "failed";
  query: string;
  path: LearningPath | null;
  error: string | null;
  created_at: number;
}

const generations = new Map<string, GenerationEntry>();

// Clean up entries older than 5 minutes
function cleanupGenerations(): void {
  const cutoff = Date.now() - 5 * 60 * 1000;
  for (const [id, entry] of generations) {
    if (entry.created_at < cutoff) generations.delete(id);
  }
}

/**
 * POST /api/learn/search/generate
 * Body: { query: string }
 *
 * Starts async path generation. Returns a generation_id to poll.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const body = await request.json();
  const query = (body.query ?? "").trim();

  if (!query) {
    return NextResponse.json({ error: "Query required" }, { status: 400 });
  }

  cleanupGenerations();

  const generationId = `gen_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  generations.set(generationId, {
    status: "generating",
    query,
    path: null,
    error: null,
    created_at: Date.now(),
  });

  // Fire and forget — don't await
  generateAndCachePath(query)
    .then((path) => {
      const entry = generations.get(generationId);
      if (entry) {
        entry.status = path ? "completed" : "failed";
        entry.path = path;
        if (!path) entry.error = "Not enough content for this topic";
      }
    })
    .catch((err) => {
      const entry = generations.get(generationId);
      if (entry) {
        entry.status = "failed";
        entry.error = err instanceof Error ? err.message : "Generation failed";
      }
    });

  return NextResponse.json({
    generation_id: generationId,
    status: "generating",
    query,
  });
}

/**
 * GET /api/learn/search/generate?id=gen_xxx
 *
 * Poll generation status. Returns the path when complete.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const generationId = url.searchParams.get("id");

  if (!generationId) {
    return NextResponse.json({ error: "Generation ID required" }, { status: 400 });
  }

  const entry = generations.get(generationId);
  if (!entry) {
    return NextResponse.json({ error: "Generation not found or expired" }, { status: 404 });
  }

  if (entry.status === "completed" && entry.path) {
    // Clean up after successful retrieval
    generations.delete(generationId);
    return NextResponse.json({
      status: "completed",
      path: entry.path,
    });
  }

  if (entry.status === "failed") {
    generations.delete(generationId);
    return NextResponse.json({
      status: "failed",
      error: entry.error,
    });
  }

  return NextResponse.json({
    status: "generating",
  });
}
```

**Important notes:**
- In-memory Map works for current scale (single Vercel instance). If you need durability later, replace with a DB table row.
- The POST handler returns immediately (~10ms). The actual generation runs in the background.
- Entries auto-expire after 5 minutes to prevent memory leaks.

---

## Step 3: Rewrite Search Route — Instant Cache Response

**File:** `app/api/learn/search/route.ts`

**What:** The search route should NEVER call `generateAndCachePath` directly. It should return cached results instantly and tell the frontend to start async generation if needed.

**Replace the entire file with:**

```typescript
import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@/lib/supabase/admin";
import { mapPathRow, mapProgressRow } from "@/lib/learn/pathGenerator";
import type { LearningPath, LearningProgress } from "@/lib/types";

/**
 * GET /api/learn/search?q=...&limit=12
 *
 * Two-phase search architecture:
 * - Returns cached results INSTANTLY (< 300ms target)
 * - If results are thin, signals the frontend to start async generation
 * - NEVER blocks on path generation
 */
export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim();
  const limit = Math.min(
    Number(url.searchParams.get("limit") ?? 12),
    20
  );

  const admin = createAdminClient();

  // ─── Fetch user's in-progress paths (if authenticated) ────
  let inProgress: { path: LearningPath; progress: LearningProgress }[] = [];
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data: progressRows } = await admin
        .from("fp_learning_progress")
        .select("*, fp_learning_paths(*)")
        .eq("user_id", user.id)
        .eq("status", "in_progress")
        .order("last_activity_at", { ascending: false })
        .limit(4);

      for (const row of progressRows ?? []) {
        const pathData = row.fp_learning_paths;
        if (!pathData) continue;
        inProgress.push({
          path: mapPathRow(pathData as unknown as Record<string, unknown>),
          progress: mapProgressRow(row as unknown as Record<string, unknown>),
        });
      }
    }
  } catch {
    // Auth check failed — continue without in-progress
  }

  // ─── No query: discovery mode ─────────────────────────────
  if (!query) {
    const { data: discoveryRows } = await admin
      .from("fp_learning_paths")
      .select("*")
      .eq("is_cached", true)
      .order("view_count", { ascending: false })
      .limit(limit);

    const discovery = (discoveryRows ?? []).map((r) =>
      mapPathRow(r as unknown as Record<string, unknown>)
    );

    return NextResponse.json({
      discovery,
      in_progress: inProgress,
      query: null,
      should_generate: false,
    });
  }

  // ─── With query: instant cache search ─────────────────────
  try {
    const normalizedQuery = query.toLowerCase();

    // Search cached paths — increased limit, fuzzy match on query
    const { data: cachedRows } = await admin
      .from("fp_learning_paths")
      .select("*")
      .eq("is_cached", true)
      .ilike("query", `%${normalizedQuery}%`)
      .order("view_count", { ascending: false })
      .limit(limit);

    const results = (cachedRows ?? []).map((r) =>
      mapPathRow(r as unknown as Record<string, unknown>)
    );

    // Signal the frontend: should it start background generation?
    // Generate if we have fewer than 3 quality results
    const shouldGenerate = results.length < 3;

    return NextResponse.json({
      discovery: results,
      in_progress: inProgress,
      query,
      should_generate: shouldGenerate,
    });
  } catch (error) {
    console.error("[learn/search] error:", error);
    return NextResponse.json(
      { error: "Search failed" },
      { status: 500 }
    );
  }
}
```

**Key changes:**
- Removed `generateAndCachePath` import and the 45-second `Promise.race`
- Added `should_generate` boolean to response — frontend uses this to decide whether to call the generate endpoint
- Increased cache limit from 3 to `limit` (default 12)
- Response time drops from 0.5–45s to ~50-100ms

---

## Step 4: Rewrite `useLearnSearch` Hook — Two-Phase Pattern

**File:** `lib/useLearnSearch.ts`

**What:** The hook now handles two phases: instant search results + optional background generation with polling.

**Replace the entire file with:**

```typescript
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { LearningPath, LearningProgress } from "./types";

// ─── Types ──────────────────────────────────────────────────

interface PathWithProgress {
  path: LearningPath;
  progress: LearningProgress;
}

type GenerationStatus = "idle" | "generating" | "completed" | "failed";

interface UseLearnSearchReturn {
  query: string;
  setQuery: (q: string) => void;
  discoveryPaths: LearningPath[];
  inProgressPaths: PathWithProgress[];
  isLoading: boolean;
  error: string | null;
  message: string | null;
  hasSearched: boolean;
  setQueryFromTopic: (slug: string) => void;
  /** Whether a fresh path is being generated in the background */
  generationStatus: GenerationStatus;
}

// ─── Constants ──────────────────────────────────────────────

const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 30; // 60 seconds max

// ─── Hook ───────────────────────────────────────────────────

/**
 * Two-phase search hook:
 * 1. Instant cache search — returns in < 300ms
 * 2. Background generation — polls for new path if cache was thin
 */
export function useLearnSearch(): UseLearnSearchReturn {
  const [query, setQuery] = useState("");
  const [discoveryPaths, setDiscoveryPaths] = useState<LearningPath[]>([]);
  const [inProgressPaths, setInProgressPaths] = useState<PathWithProgress[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [generationStatus, setGenerationStatus] = useState<GenerationStatus>("idle");

  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pollRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pollCountRef = useRef(0);
  const activeGenerationRef = useRef<string | null>(null);

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearTimeout(pollRef.current);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const setQueryFromTopic = useCallback((slug: string) => {
    const readable = slug.replace(/-/g, " ");
    setQuery(readable);
  }, []);

  // ─── Phase 2: Poll for generation result ────────────────

  const pollGeneration = useCallback((generationId: string) => {
    if (pollRef.current) clearTimeout(pollRef.current);
    pollCountRef.current = 0;
    activeGenerationRef.current = generationId;

    const poll = () => {
      // Stop if generation was superseded by a new query
      if (activeGenerationRef.current !== generationId) return;

      pollCountRef.current++;
      if (pollCountRef.current > MAX_POLL_ATTEMPTS) {
        setGenerationStatus("failed");
        return;
      }

      fetch(`/api/learn/search/generate?id=${generationId}`)
        .then((res) => res.json())
        .then((data) => {
          // Stop if generation was superseded
          if (activeGenerationRef.current !== generationId) return;

          if (data.status === "completed" && data.path) {
            setDiscoveryPaths((prev) => {
              // Add new path at the beginning, deduplicate
              const existingIds = new Set(prev.map((p) => p.id));
              if (existingIds.has(data.path.id)) return prev;
              return [data.path, ...prev];
            });
            setGenerationStatus("completed");
            activeGenerationRef.current = null;
          } else if (data.status === "failed") {
            setGenerationStatus("failed");
            activeGenerationRef.current = null;
          } else {
            // Still generating — poll again
            pollRef.current = setTimeout(poll, POLL_INTERVAL_MS);
          }
        })
        .catch(() => {
          // Network error — try again
          pollRef.current = setTimeout(poll, POLL_INTERVAL_MS);
        });
    };

    pollRef.current = setTimeout(poll, POLL_INTERVAL_MS);
  }, []);

  // ─── Phase 1: Instant search + trigger generation ───────

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const delay = query.trim() ? 500 : 0;

    debounceRef.current = setTimeout(() => {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());

      setIsLoading(true);
      setError(null);
      setMessage(null);
      setGenerationStatus("idle");

      // Cancel any in-flight generation polling
      activeGenerationRef.current = null;
      if (pollRef.current) clearTimeout(pollRef.current);

      fetch(`/api/learn/search?${params}`)
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then((data) => {
          setDiscoveryPaths(data.discovery ?? []);
          setInProgressPaths(data.in_progress ?? []);
          if (data.message) setMessage(data.message);
          if (query.trim()) setHasSearched(true);

          // Phase 2: Start background generation if needed
          if (data.should_generate && query.trim()) {
            setGenerationStatus("generating");

            fetch("/api/learn/search/generate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ query: query.trim() }),
            })
              .then((res) => res.json())
              .then((genData) => {
                if (genData.generation_id) {
                  pollGeneration(genData.generation_id);
                }
              })
              .catch(() => {
                setGenerationStatus("failed");
              });
          }
        })
        .catch((err) => {
          setError(err.message);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }, delay);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, pollGeneration]);

  return {
    query,
    setQuery,
    discoveryPaths,
    inProgressPaths,
    isLoading,
    error,
    message,
    hasSearched,
    setQueryFromTopic,
    generationStatus,
  };
}
```

**Key changes:**
- Added `generationStatus` state: `idle | generating | completed | failed`
- Phase 1: fetch from `/api/learn/search` returns instantly with cached results
- Phase 2: if `should_generate` is true, POST to `/api/learn/search/generate`, then poll every 2 seconds
- Polling is cancelled when query changes (new search supersedes old generation)
- New path slides into `discoveryPaths` array when generation completes

---

## Step 5: Add GenerationCard Component

**Create:** `components/learn/GenerationCard.tsx`

This card appears in the search results grid while a path is being generated. It communicates that the AI is building something custom.

```typescript
"use client";

import { Sparkles, Loader2, CheckCircle, AlertCircle } from "lucide-react";

type GenerationStatus = "generating" | "completed" | "failed";

interface GenerationCardProps {
  status: GenerationStatus;
  query: string;
}

/**
 * Visual card shown in the search results grid while a fresh path
 * is being generated in the background. Reframes "loading" as
 * "building something for you."
 */
export function GenerationCard({ status, query }: GenerationCardProps) {
  if (status === "completed") return null;

  return (
    <div className="relative rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] p-5 flex flex-col items-center justify-center text-center min-h-[220px] overflow-hidden">
      {/* Subtle animated gradient background */}
      {status === "generating" && (
        <div className="absolute inset-0 opacity-[0.03]">
          <div
            className="absolute inset-0 animate-pulse"
            style={{
              background:
                "linear-gradient(135deg, var(--color-accent-primary), var(--color-cyan-700), var(--color-accent-primary))",
              backgroundSize: "200% 200%",
            }}
          />
        </div>
      )}

      <div className="relative z-10 space-y-3">
        {status === "generating" && (
          <>
            <div className="mx-auto w-10 h-10 rounded-full bg-[var(--color-bg-hover)] flex items-center justify-center">
              <Sparkles
                size={20}
                className="text-[var(--color-accent-primary)]"
              />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-[var(--color-text-primary)]">
                Building a custom path
              </p>
              <p className="text-xs text-[var(--color-text-tertiary)] max-w-[200px]">
                Curating content and designing missions for &ldquo;{query}&rdquo;
              </p>
            </div>
            <Loader2
              size={16}
              className="mx-auto text-[var(--color-text-tertiary)] animate-spin"
            />
          </>
        )}

        {status === "failed" && (
          <>
            <div className="mx-auto w-10 h-10 rounded-full bg-[var(--color-bg-hover)] flex items-center justify-center">
              <AlertCircle
                size={20}
                className="text-[var(--color-text-tertiary)]"
              />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-[var(--color-text-primary)]">
                Couldn&apos;t generate a path
              </p>
              <p className="text-xs text-[var(--color-text-tertiary)] max-w-[200px]">
                Not enough quality content found. Try a different search.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
```

---

## Step 6: Update LearnPage — Show Instant Results + GenerationCard

**File:** `components/learn/LearnPage.tsx`

**What:** Use the new `generationStatus` from the hook. Show cached results immediately. Show GenerationCard in the grid when generating.

**Replace the entire file with:**

```typescript
"use client";

import { useRouter } from "next/navigation";
import { Search, Layers } from "lucide-react";
import { useLearnSearch } from "@/lib/useLearnSearch";
import { PathCard } from "./PathCard";
import { PathCardSkeletonGrid } from "./PathCardSkeleton";
import { TopicFilters } from "./TopicFilters";
import { ContinueLearning } from "./ContinueLearning";
import { GenerationCard } from "./GenerationCard";

// Popular topics shown as quick filters before search
const POPULAR_TOPICS = [
  "prompt-engineering",
  "rag",
  "ai-agents",
  "fine-tuning",
  "nextjs",
  "react",
  "vector-databases",
  "langchain",
  "cursor",
  "supabase",
  "openai-api",
  "system-design",
];

/**
 * Main Learn page component.
 * Two-phase search: instant cached results + async generation.
 */
export function LearnPage() {
  const router = useRouter();
  const {
    query,
    setQuery,
    discoveryPaths,
    inProgressPaths,
    isLoading,
    error,
    message,
    hasSearched,
    setQueryFromTopic,
    generationStatus,
  } = useLearnSearch();

  const handleCardClick = (pathId: string) => {
    router.push(`/learn/paths/${pathId}`);
  };

  const showGenerationCard =
    hasSearched &&
    (generationStatus === "generating" || generationStatus === "failed");

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      {/* Continue Learning */}
      {inProgressPaths.length > 0 && (
        <ContinueLearning paths={inProgressPaths} />
      )}

      {/* Hero */}
      <div className="text-center space-y-3">
        <h1 className="text-3xl font-bold text-[var(--color-text-primary)]">
          What do you want to learn?
        </h1>
        <p className="text-[var(--color-text-tertiary)] text-sm">
          AI-curated learning paths from the best creators across the internet
        </p>
      </div>

      {/* Search Input */}
      <div className="relative max-w-2xl mx-auto">
        <Search
          size={18}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)]"
        />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search topics, skills, or keywords..."
          className="w-full pl-11 pr-4 py-3 rounded-xl text-sm bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-border-focus)] transition-colors"
        />
        {isLoading && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-[var(--color-text-tertiary)] border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Topic Quick Filters */}
      <div className="max-w-2xl mx-auto">
        <TopicFilters
          topics={POPULAR_TOPICS}
          selected={[]}
          onToggle={setQueryFromTopic}
        />
      </div>

      {/* Error */}
      {error && (
        <p className="text-center text-sm text-[var(--color-coral-700)]">
          {error}
        </p>
      )}

      {/* Results Header */}
      {hasSearched && !isLoading && (
        <div className="flex items-center gap-2 text-xs text-[var(--color-text-tertiary)]">
          <Layers size={14} />
          <span>
            {discoveryPaths.length} learning path
            {discoveryPaths.length !== 1 ? "s" : ""} for &ldquo;{query}&rdquo;
            {generationStatus === "generating" && " · generating more..."}
          </span>
        </div>
      )}

      {/* Results Grid */}
      {isLoading ? (
        <PathCardSkeletonGrid count={3} />
      ) : discoveryPaths.length > 0 || showGenerationCard ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {discoveryPaths.map((path) => (
            <PathCard key={path.id} path={path} onClick={handleCardClick} />
          ))}
          {showGenerationCard && (
            <GenerationCard status={generationStatus} query={query} />
          )}
        </div>
      ) : hasSearched ? (
        <div className="text-center py-16 space-y-2">
          <Search
            size={32}
            className="mx-auto text-[var(--color-text-tertiary)] opacity-40"
          />
          <p className="text-sm text-[var(--color-text-tertiary)]">
            {message ??
              "No learning paths found. Try a broader search or different topic."}
          </p>
        </div>
      ) : (
        <div className="text-center py-16 space-y-2">
          <p className="text-sm text-[var(--color-text-tertiary)]">
            Loading learning paths...
          </p>
        </div>
      )}
    </div>
  );
}
```

**Key changes from original:**
- Imports and uses `GenerationCard`
- Uses `generationStatus` from hook
- Shows "generating more..." in results header during generation
- Shows `GenerationCard` as last item in grid during generation
- Cached results appear immediately — no more full-grid skeleton for searches

---

## Step 7: Verification Checklist

After all changes, verify:

1. **`npx tsc --noEmit`** — zero TypeScript errors
2. **Search with cached topic** (e.g. "react") — results appear in < 300ms, no generation card
3. **Search with novel topic** (e.g. "quantum computing with qiskit") — cached results (if any) appear instantly, GenerationCard shows "Building a custom path...", card disappears when path slides into grid
4. **Rapid query changes** — type "re" → "rea" → "react" quickly — only the final query triggers generation, earlier polls are cancelled
5. **Generation failure** — if topic has zero content, GenerationCard shows failure state gracefully
6. **Discovery mode** (empty query) — works exactly as before, no generation card
7. **Topic pill click** — works as before, triggers search with readable topic name
8. **No console errors** in browser dev tools

## Files Modified

| File | Action |
|------|--------|
| `lib/learn/curriculumGenerator.ts` | Edit: parallel YouTube calls |
| `app/api/learn/search/route.ts` | Rewrite: instant cache only, no generation |
| `app/api/learn/search/generate/route.ts` | **New**: async generation + polling endpoint |
| `lib/useLearnSearch.ts` | Rewrite: two-phase with generation polling |
| `components/learn/GenerationCard.tsx` | **New**: generation progress card |
| `components/learn/LearnPage.tsx` | Rewrite: uses generation status + card |

## Files NOT Modified

- `lib/learn/pathGenerator.ts` — no changes needed
- `lib/learn/embeddings.ts` — no changes needed
- `lib/learn/contentLake.ts` — no changes needed
- `components/learn/PathCard.tsx` — no changes needed
- `components/learn/PathCardSkeleton.tsx` — no changes needed
