# Phase 5: Skills Surfaced in the UI

**Goal:** Skills become visible at the moments they're useful — never as decoration, never as a primary interface, always as context that helps users make better decisions about what to learn next.

**Depends on:** Phases 1-4 (taxonomy, receipts, profile, skill-aware curriculum)

---

## Design Philosophy

Skills are an **output of action**, not a feature users obsess over. The user never thinks "I need to go manage my skills." They complete a path, their skill profile updates. They browse paths, skill context helps them pick. They finish a session, a receipt shows what grew.

Three rules govern every intervention in this phase:

1. **Contextual, not decorative.** Skill tags appear where they help a decision (picking a path, understanding progress). They don't appear where they'd be noise (room chat, top-nav badges, profile headers).

2. **Existing components, existing patterns.** Every new UI element uses components from `components/ui/`, colors from CSS variables, and layout patterns from adjacent features. Nothing gets recreated or mimicked.

3. **Data first, UI second.** The biggest gap isn't visual — it's that `skill_tags` exist in `fp_skill_tags` but no read-side API joins them. Fix the pipe, then the UI is trivial.

---

## What We're NOT Doing

The master plan's Phase 5 included five sub-sections. Three are deferred based on the principle that skills are output of action, not a primary feature:

| Original Item | Decision | Reason |
|---------------|----------|--------|
| 5A: Skill tags on path cards | **YES** | Helps users pick paths. Contextual. |
| 5B: Browse by Skill | **TRIMMED** | No separate "By Skill" mode toggle. Instead, skill pills on cards are tappable and filter the grid. Same result, no new paradigm. |
| 5C: Update Onboarding | **DEFERRED** | User hasn't done anything yet. Skills are output of action. Onboarding already captures function + fluency, which is sufficient for Phase 4 personalization. |
| 5D: Skill Context in Rooms | **DEFERRED** | Rooms are a separate system with their own complexity. Skill-aware room hosts belong in a dedicated rooms phase. |
| 5E: Shareable Skill Profile | **DEFERRED** | Growth Engine territory. The SkillProfilePage already exists at `/skills`. Making it public with OG images is valuable but is a distribution feature, not a core experience feature. |

**What remains is surgical:** plumb `skill_tags` through the read APIs, then surface them in four precise locations.

---

## The Four Interventions

### Intervention 1: Plumb `skill_tags` Through the Data Layer

**Problem:** `fp_skill_tags` stores which skills each path develops. The `LearningPath` type already has an optional `skill_tags` field. But no API endpoint populates it.

**Solution:** Add a `loadSkillTagsForPaths` utility and call it in the two places that return paths to the client.

**New file:** `lib/skills/pathSkillTags.ts`

```typescript
import { adminClient } from "@/lib/supabase/admin";

interface PathSkillTag {
  skill_slug: string;
  skill_name: string;
  domain_name: string;
  relevance: "primary" | "secondary";
}

/**
 * Load skill tags for a batch of learning paths.
 * Returns a map of path_id → skill tags (primary first, max 3 per path).
 */
export async function loadSkillTagsForPaths(
  pathIds: string[],
): Promise<Map<string, PathSkillTag[]>> {
  if (pathIds.length === 0) return new Map();

  const { data, error } = await adminClient
    .from("fp_skill_tags")
    .select(`
      path_id,
      skill_slug,
      relevance,
      fp_skills!inner ( name, fp_skill_domains!inner ( name ) )
    `)
    .in("path_id", pathIds)
    .order("relevance", { ascending: true }); // primary first

  if (error || !data) return new Map();

  const map = new Map<string, PathSkillTag[]>();

  for (const row of data) {
    const tags = map.get(row.path_id) ?? [];
    if (tags.length >= 3) continue; // cap at 3 tags per path

    tags.push({
      skill_slug: row.skill_slug,
      skill_name: (row as any).fp_skills.name,
      domain_name: (row as any).fp_skills.fp_skill_domains.name,
      relevance: row.relevance,
    });
    map.set(row.path_id, tags);
  }

  return map;
}
```

**Modified files:**

1. **`app/api/learn/search/route.ts`** — After fetching discovery/search paths, call `loadSkillTagsForPaths` with all path IDs and merge tags onto each path object before returning.

2. **`app/api/learn/paths/[id]/route.ts`** (GET handler) — After loading the single path, call `loadSkillTagsForPaths([pathId])` and merge onto the path before returning.

3. **`lib/learn/pathGenerator.ts`** (`mapPathRow` function) — Add `skill_tags: undefined` to the mapped object so the field exists (populated by API layer, not the mapper).

**Pattern to follow:** The existing `mapPathRow` in `pathGenerator.ts` maps DB rows to `LearningPath` objects. Skill tags are a join concern, so they're loaded separately and merged at the API layer — same pattern as `in_progress` paths that merge progress data.

**Important:** The join query needs the `fp_skills` → `fp_skill_domains` relationship. Verify this foreign key exists in the migration. The migration `20260323_create_skill_taxonomy.sql` should have `fp_skills.domain_id REFERENCES fp_skill_domains(id)`.

---

### Intervention 2: Skill Pills on PathCard

**Current state:** PathCard shows title, duration, difficulty badge, and progress bar. No skill context.

**After:** 1-2 small skill pills appear below the title/meta line, giving users a preview of what they'll develop.

**Modified file:** `components/learn/PathCard.tsx`

**Visual spec:**

```
┌─ PathCard ──────────────────────────────────┐
│                                              │
│  [PathCover image, 200px]                   │
│  [Difficulty badge]        [Progress bar]   │
│                                              │
├──────────────────────────────────────────────┤
│  Path Title Here                             │
│  ~30min · 40% complete                       │
│  [Prompt Engineering] [Technical Building]   │  ← NEW: skill pills
│                                              │
└──────────────────────────────────────────────┘
```

**Implementation:**

```tsx
// Inside PathCard, after the meta <p> tag (line 85-88):

{path.skill_tags && path.skill_tags.length > 0 && (
  <div className="mt-1.5 flex flex-wrap gap-1">
    {path.skill_tags
      .filter((t) => t.relevance === "primary")
      .slice(0, 2)
      .map((tag) => (
        <span
          key={tag.skill_slug}
          className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
          style={{
            background: "var(--color-bg-hover)",
            color: "var(--color-text-secondary)",
          }}
        >
          {tag.skill_name}
        </span>
      ))}
  </div>
)}
```

**Design decisions:**

- **Only primary skills.** Secondary skills add noise. The user sees the 1-2 most important skills this path develops.
- **Max 2 pills.** More than 2 clutters the card. Paths rarely have more than 2 primary skills anyway.
- **Neutral color.** These are path attributes, not user fluency levels. Use `bg-hover` + `text-secondary` — the same treatment as the difficulty badge background. NOT FluencyBadge colors (those represent user state, not path metadata).
- **Not clickable (yet).** Phase 5 keeps these as static context. If browse-by-skill is added later, these become tappable filter triggers.
- **Graceful absence.** `skill_tags` is optional on `LearningPath`. Old paths without tags simply don't show pills. No empty state needed.

---

### Intervention 3: Skill Pills in SearchDropdown ResultRow

**Current state:** ResultRow shows thumbnail, difficulty badge, title, duration, module count.

**After:** Skill pills appear inline with the meta text, giving search results skill context.

**Modified file:** `components/learn/SearchDropdown.tsx`

**Visual spec:**

```
┌─ ResultRow ──────────────────────────────────────────┐
│  [Thumb]  Beginner                                   │
│           Path Title Here                       [→]  │
│           ~30min · 3 modules                         │
│           [Prompt Engineering] [Data Analysis]       │  ← NEW
└──────────────────────────────────────────────────────┘
```

**Implementation:** Add after the duration/module meta `<p>` tag in `ResultRow` (after line 185):

```tsx
{path.skill_tags && path.skill_tags.length > 0 && (
  <div className="mt-1 flex flex-wrap gap-1">
    {path.skill_tags
      .filter((t) => t.relevance === "primary")
      .slice(0, 2)
      .map((tag) => (
        <span
          key={tag.skill_slug}
          className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium"
          style={{
            background: "var(--color-bg-hover)",
            color: "var(--color-text-tertiary)",
          }}
        >
          {tag.skill_name}
        </span>
      ))}
  </div>
)}
```

**Design decisions:**

- **Slightly smaller than PathCard pills.** `px-1.5` instead of `px-2`. Dropdown rows are compact; pills must not compete with the title.
- **Tertiary text color.** One step lighter than the PathCard pills (`text-tertiary` vs `text-secondary`). In the dropdown, the title and difficulty need to dominate. Skill pills are supplementary.
- **Same filter: primary only, max 2.**

---

### Intervention 4: "Skills You'll Develop" in PathSidebar

**Current state:** PathSidebar shows a progress bar at top, then module breakdown with item checklist. No skill context.

**After:** A compact section below the progress bar shows which skills this path develops. For users who have existing skill data, it shows their current level → what they'll develop.

**Modified file:** `components/learn/PathSidebar.tsx`

**Visual spec:**

```
┌─ PathSidebar ────────────────────────────┐
│  Progress: 3/7 items · 43%              │
│  [━━━━━━━━━░░░░░░░░░░]                  │
│                                          │
│  SKILLS                                  │  ← NEW section
│  Prompt Engineering    [Practicing]      │
│  Technical Building    [Exploring]       │
│                                          │
│  ─────────────────────────────────────── │
│                                          │
│  ▾ Module 1: See What's Possible        │
│    ✓ Watch: Introduction to Cursor      │
│    → Do: Your first component           │
│  ...                                     │
└──────────────────────────────────────────┘
```

**Implementation:**

This section needs both path skill_tags (what the path develops) and optionally the user's current fluency in those skills. The path data comes from the existing `useLearnProgress` hook. User skill data needs a lightweight addition.

**Option A (simpler, recommended):** Show skill names + `FluencyBadge` using path-level data only. The FluencyBadge shows the user's *current* level if available from the skill receipt system. Since the path detail page already fetches `skillReceipt` on completion, and `useLearnProgress` could be extended to include skill context:

```tsx
// New section added after progress bar, before modules
// Only renders if path.skill_tags exists and has entries

{path.skill_tags && path.skill_tags.length > 0 && (
  <div className="px-4 pb-3">
    <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
      Skills
    </p>
    <div className="space-y-1.5">
      {path.skill_tags
        .filter((t) => t.relevance === "primary")
        .slice(0, 3)
        .map((tag) => (
          <div
            key={tag.skill_slug}
            className="flex items-center justify-between"
          >
            <span className="text-xs text-[var(--color-text-secondary)]">
              {tag.skill_name}
            </span>
            {/* FluencyBadge only if user has existing skill data */}
            {tag.user_fluency && (
              <FluencyBadge level={tag.user_fluency} size="sm" />
            )}
          </div>
        ))}
    </div>
  </div>
)}
```

**Data shape extension:** The `skill_tags` on `LearningPath` can optionally include `user_fluency` when the API knows the authenticated user:

```typescript
// Extend the existing skill_tags type on LearningPath
skill_tags?: Array<{
  skill_slug: string;
  skill_name: string;
  domain_name: string;
  relevance: "primary" | "secondary";
  user_fluency?: string; // "exploring" | "practicing" | "proficient" | "advanced" | null
}>;
```

The `user_fluency` field is populated in the path detail GET handler (which knows the user) by joining against `fp_user_skills`. For the search/discovery API (which returns many paths), this field is omitted to avoid N+1 queries — it's only needed in the sidebar of the active path.

**Design decisions:**

- **Section header uses "SKILLS"** — matches the sidebar's existing uppercase tracking-wider label pattern (used by "MODULES" or section titles).
- **Max 3 primary skills** — sidebar has more vertical space than cards, so allow one more.
- **FluencyBadge import** from `@/components/skills/FluencyBadge` — reuses the existing component from Phase 3. This is the only place in Phase 5 where user-state color appears, and it's appropriate because the user is actively IN this path.
- **No FluencyBadge if no user data** — for logged-out users or first-time learners, just show skill names. Clean absence, no placeholder.
- **Divider after skills section** — use the existing `border-t border-[var(--color-border-default)]` pattern that separates modules.

---

### Intervention 5: Skill-Filtered Discovery (Tappable Skill Pills)

**This replaces the original "5B: Browse by Skill" from the master plan.**

Instead of a separate mode toggle, skill pills on PathCards become tappable. Tapping one filters the discovery grid to paths tagged with that skill. This gives users browse-by-skill functionality without adding any new UI paradigm.

**Modified files:**

1. **`components/learn/PathCard.tsx`** — Add `onSkillClick` callback prop.
2. **`components/learn/LearnPage.tsx`** — Handle skill filter state, pass callback to PathCards, apply filter to grid.

**PathCard change:**

```tsx
interface PathCardProps {
  path: LearningPath;
  progress?: LearningProgress | null;
  onClick: (pathId: string) => void;
  onSkillClick?: (skillSlug: string, skillName: string) => void; // NEW
}

// In the skill pills render:
<span
  key={tag.skill_slug}
  className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium cursor-pointer transition-colors hover:bg-[var(--color-bg-active)] hover:text-[var(--color-text-primary)]"
  style={{
    background: "var(--color-bg-hover)",
    color: "var(--color-text-secondary)",
  }}
  onClick={(e) => {
    e.stopPropagation(); // Don't trigger card click
    onSkillClick?.(tag.skill_slug, tag.skill_name);
  }}
>
  {tag.skill_name}
</span>
```

**LearnPage change:**

Add a `skillFilter` state alongside the existing `category` and `sort` states:

```typescript
const [skillFilter, setSkillFilter] = useState<{ slug: string; name: string } | null>(null);
```

When a skill pill is tapped:
1. Set `skillFilter` to the clicked skill.
2. Filter the discovery grid to only paths where `skill_tags` includes that slug.
3. Show a filter chip at the top of the grid: `"Showing paths for: Prompt Engineering" [×]`.
4. Clearing the chip (or clicking the same skill again) resets the filter.

**Filter chip visual:**

```
┌─ Grid header ────────────────────────────────────────┐
│  Learning Paths                    [Category ▾] [Sort ▾] │
│  Filtered by: Prompt Engineering  [×]                    │  ← NEW
│                                                          │
│  [PathCard] [PathCard] [PathCard]                       │
│  [PathCard] [PathCard]                                  │
└──────────────────────────────────────────────────────────┘
```

**Filter chip implementation:**

```tsx
{skillFilter && (
  <div className="flex items-center gap-2">
    <span className="text-xs text-[var(--color-text-tertiary)]">
      Filtered by:
    </span>
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium cursor-pointer transition-colors hover:bg-[var(--color-bg-active)]"
      style={{
        background: "var(--color-bg-hover)",
        color: "var(--color-text-secondary)",
      }}
      onClick={() => setSkillFilter(null)}
    >
      {skillFilter.name}
      <X size={12} />
    </span>
  </div>
)}
```

**Filtering logic:**

```typescript
// In the grid render, after category and sort filtering:
const filteredPaths = displayPaths.filter((path) => {
  // Existing category filter...
  if (!pathMatchesCategory(path, category)) return false;

  // NEW: skill filter
  if (skillFilter && !path.skill_tags?.some((t) => t.skill_slug === skillFilter.slug)) {
    return false;
  }

  return true;
});
```

**Design decisions:**

- **Client-side filtering only.** Skill tags are already on the path objects from Intervention 1. No additional API call needed.
- **Skill filter clears when category changes.** Prevents confusing multi-filter states. One active filter type at a time.
- **Skill filter clears when user searches.** Search mode is a different context.
- **No skill filter dropdown.** Users discover skills by seeing them on cards, not by browsing a skill directory. This keeps skills as an emergent concept.
- **`e.stopPropagation()`** prevents the card click from firing when tapping a pill. Critical UX detail.

---

## Implementation Steps

### Step 1: Create `loadSkillTagsForPaths` utility

**New file:** `lib/skills/pathSkillTags.ts`

- Exports `loadSkillTagsForPaths(pathIds: string[]): Promise<Map<string, PathSkillTag[]>>`
- Queries `fp_skill_tags` with join to `fp_skills` and `fp_skill_domains`
- Caps at 3 tags per path (primary first)
- Handles empty input, query errors gracefully (returns empty Map)

**Also exports** `loadSkillTagsForPathWithUser(pathId: string, userId: string): Promise<PathSkillTag[]>`
- Same join but also left-joins `fp_user_skills` for the given user
- Returns tags with optional `user_fluency` field populated
- Used by path detail GET handler only

### Step 2: Wire skill tags into search/discovery API

**Modified file:** `app/api/learn/search/route.ts`

After fetching discovery paths and search results:

```typescript
// Collect all path IDs
const allPathIds = [...discoveryPaths, ...searchResults].map(p => p.id);

// Load skill tags in one batch query
const skillTagMap = await loadSkillTagsForPaths(allPathIds);

// Merge onto paths
for (const path of [...discoveryPaths, ...searchResults]) {
  path.skill_tags = skillTagMap.get(path.id) ?? [];
}
```

This adds one query to the search API but it's batched (single SELECT with IN clause), so the performance impact is minimal.

### Step 3: Wire skill tags into path detail API

**Modified file:** `app/api/learn/paths/[id]/route.ts` (GET handler)

After loading the path, before returning:

```typescript
// Load skill tags with user fluency context
const userId = /* extract from auth if available */;
if (userId) {
  path.skill_tags = await loadSkillTagsForPathWithUser(path.id, userId);
} else {
  const tagMap = await loadSkillTagsForPaths([path.id]);
  path.skill_tags = tagMap.get(path.id) ?? [];
}
```

### Step 4: Add skill pills to PathCard

**Modified file:** `components/learn/PathCard.tsx`

- Add optional `onSkillClick` prop to `PathCardProps`
- Add skill pill rendering after the meta `<p>` tag
- Primary skills only, max 2, neutral color styling
- Pills are tappable if `onSkillClick` is provided
- `e.stopPropagation()` on pill click

### Step 5: Add skill pills to SearchDropdown ResultRow

**Modified file:** `components/learn/SearchDropdown.tsx`

- Add skill pills after the duration meta in `ResultRow`
- Primary skills only, max 2, tertiary color (lighter than PathCard)
- Not tappable (dropdown context, clicking navigates to path)

### Step 6: Add skills section to PathSidebar

**Modified file:** `components/learn/PathSidebar.tsx`

- Import `FluencyBadge` from `@/components/skills/FluencyBadge`
- Add "SKILLS" section between progress bar and module list
- Show up to 3 primary skills with optional FluencyBadge
- Separated from modules by existing border pattern

### Step 7: Add skill filter to LearnPage

**Modified file:** `components/learn/LearnPage.tsx`

- Add `skillFilter` state
- Pass `onSkillClick` to each PathCard in the grid
- Add filter chip rendering above the grid when `skillFilter` is set
- Apply skill filter in the grid filtering logic
- Clear skill filter when category changes or user searches
- Import `X` from lucide-react for the clear button

---

## Files Summary

| File | Action | What Changes |
|------|--------|-------------|
| `lib/skills/pathSkillTags.ts` | **NEW** | `loadSkillTagsForPaths`, `loadSkillTagsForPathWithUser` |
| `app/api/learn/search/route.ts` | MODIFY | Batch-load and merge skill tags onto returned paths |
| `app/api/learn/paths/[id]/route.ts` | MODIFY | Load skill tags (with user fluency) onto path detail |
| `components/learn/PathCard.tsx` | MODIFY | Add skill pills, `onSkillClick` prop |
| `components/learn/SearchDropdown.tsx` | MODIFY | Add skill pills to `ResultRow` |
| `components/learn/PathSidebar.tsx` | MODIFY | Add "Skills" section with FluencyBadge |
| `components/learn/LearnPage.tsx` | MODIFY | Add `skillFilter` state, filter chip, grid filtering |

**1 new file, 5 modified files.** No new pages. No new routes. No new hooks. The entire phase is plumbing existing data to existing surfaces.

---

## Verification

- [ ] Discovery grid paths show 1-2 skill pills below title
- [ ] Search dropdown results show skill pills
- [ ] Path sidebar shows "Skills" section with FluencyBadge for authenticated users
- [ ] Tapping a skill pill on a PathCard filters the grid
- [ ] Filter chip appears and is clearable
- [ ] Old paths without skill_tags render normally (no empty states, no broken layouts)
- [ ] Performance: search API latency doesn't increase by more than ~50ms from the batch skill tag query
- [ ] All colors use CSS variables (no hardcoded hex)
- [ ] All pill styling is consistent (same border-radius, font-size, padding)

---

## What Comes After

Once Phase 5 is live:

- **Shareable skill profile** (original 5E) — public URL at `/profile/[username]/skills` with OG image. This is a Growth Engine feature, not core experience.
- **Room skill context** (original 5D) — AI host references user's skill development. Belongs in a rooms-focused phase.
- **Skill-aware onboarding** (original 5C) — After users have used the platform and skill data proves valuable, *then* consider asking new users about skill interests during onboarding. Let the data prove the value first.
- **Phase 6: Authority Engine** — aggregation pipeline, AI Skills Index, trend intelligence.
