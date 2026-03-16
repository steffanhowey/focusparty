# Phase 2: Skill Receipts — Surgical Implementation Plan

**Purpose:** When a user completes a learning path, they see a "skill receipt" — a display of specific skills they demonstrated, at what fluency level, whether they leveled up, and what it means for their skill graph. This is the moment where abstract learning becomes concrete professional identity.

**Read first:** `SKILLS_IMPLEMENTATION_PLAN.md` (Phase 2 section for DB schema), `CLAUDE.md` (dev standards), `STRATEGY_Foundation.md` (skill graph vision).

**Critical rule:** NEVER use Supabase MCP tools — the MCP is connected to the wrong project. Always provide SQL for the user to copy/paste manually.

---

## The Emotional Design: Why This Moment Matters

### The User's Internal State at Path Completion

The person who just completed a learning path is in a specific emotional state. Understanding it is the difference between a feature they glance at and one that changes how they see themselves.

**What just happened:** They spent 30-60 focused minutes watching, building, reflecting. They completed 2-4 hands-on missions with real AI tools. They submitted work and got AI feedback. The last task was likely a solo challenge — the hardest thing they've done in this path.

**What they feel:**

1. **Relief + accomplishment.** "I did it." They finished something. In a world where most tutorials get abandoned at the 15-minute mark, completion itself is an achievement. This feeling is fleeting — it peaks in the first 3-5 seconds after the final task.

2. **Uncertainty about what it means.** "But am I actually better?" They watched things, they did things, but the connection between activity and capability is fuzzy. Most learning platforms leave people here — "You completed a course!" — which feels hollow because completion is not competence.

3. **Desire for validation.** "Tell me this mattered." They want proof that the time they invested produced something real. Not a certificate that says "you showed up" but evidence that says "you can now do X."

4. **Nascent identity shift.** "Maybe I'm the kind of person who..." This is the fragile, powerful moment where a marketer starts to see themselves as "someone who can prompt engineer" or a developer starts to see themselves as "someone who can design with AI." The skill receipt either reinforces this shift or lets it dissolve.

5. **Forward momentum.** "What's next?" The completion high creates a brief window of motivation. If we channel it — "here's where you are, here's where you could go" — they continue. If we waste it on confetti and a generic "nice job," the window closes.

### The Emotional Design Principle

The skill receipt must accomplish one thing: **transform activity into identity.**

"You completed a path" is activity. "You demonstrated Prompt Engineering at the Practicing level" is identity. The skill receipt is the bridge.

---

## Service Blueprint: Every Touchpoint

### Trigger: Final Item Completion

The user completes the last task in the path. The `useLearnProgress` hook detects `items_completed >= items_total`. The PATCH endpoint at `app/api/learn/paths/[id]/route.ts` sets `status: "completed"`.

**Current behavior (what exists today):**
1. PATCH sets `completed_at` timestamp
2. Increments `completion_count` on `fp_learning_paths`
3. Fire-and-forget: creates `fp_achievements` row with share_slug
4. Client sees `isCompleted = true`, renders completion celebration
5. Shows: "Path Complete" header, AchievementCard (title, items, time, topics), share buttons, recommended paths

**New behavior (what Phase 2 adds):**
1. (Existing) PATCH sets `completed_at` timestamp
2. (Existing) Increments `completion_count`
3. (Existing) Creates `fp_achievements` row
4. **(NEW) Server-side: calculate skill receipt data**
   - Load path's `fp_skill_tags` (which skills this path develops)
   - For each skill: snapshot current `fp_user_skills` state (the "before")
   - Upsert `fp_user_skills`: increment paths_completed, recalculate avg_score, reassess fluency_level
   - Compare before/after: detect level-ups
   - Return skill receipt payload alongside the progress update
5. **(NEW) Client-side: render skill receipt in completion screen**
   - Skill receipt appears between AchievementCard and share buttons
   - Staggered animation: receipt fades in after the card (600ms delay)
   - Each skill row animates in sequence (100ms stagger per skill)
   - Level-ups get a subtle glow pulse animation

### Data Flow Diagram

```
User completes final item
  │
  ├─ Client: PATCH /api/learn/paths/:id
  │    body: { item_completed: "...", item_state: {...} }
  │
  ├─ Server: detect all items complete
  │    │
  │    ├─ (existing) set status = "completed", completed_at
  │    ├─ (existing) increment completion_count
  │    ├─ (existing) insert fp_achievements
  │    │
  │    └─ (NEW) calculateSkillReceipt(userId, pathId, itemStates)
  │         │
  │         ├─ SELECT skill_tags for this path (fp_skill_tags JOIN fp_skills)
  │         ├─ SELECT current user_skills for these skills (fp_user_skills)
  │         │   → snapshot as "before" state
  │         │
  │         ├─ For each tagged skill:
  │         │   ├─ Count "do" tasks in this path with evaluations
  │         │   ├─ Calculate avg score from those evaluations
  │         │   ├─ UPSERT fp_user_skills:
  │         │   │   paths_completed += 1
  │         │   │   missions_completed += do_task_count
  │         │   │   avg_score = weighted recalculation
  │         │   │   fluency_level = assessFluencyLevel(new_totals)
  │         │   │   last_demonstrated_at = now()
  │         │   └─ Snapshot as "after" state
  │         │
  │         └─ Return SkillReceiptPayload
  │              { path, skills: [{ skill, before, after, leveled_up, missions_in_path, avg_score_in_path }] }
  │
  ├─ Server response:
  │    { progress: {...}, skill_receipt: {...} }
  │
  └─ Client: render completion screen with skill receipt
       │
       ├─ AchievementCard (existing, unchanged)
       ├─ SkillReceipt (NEW component)
       │    ├─ Header: "Skills Developed"
       │    ├─ Skill rows with before/after fluency
       │    ├─ Level-up highlight animation
       │    └─ "View your skill profile" link (disabled until Phase 3)
       ├─ Share buttons (existing, slightly repositioned)
       └─ Recommended paths (existing, unchanged)
```

---

## Implementation: Step-by-Step

### Step 1: Database Migration

**File:** `supabase/migrations/20260324_create_user_skills.sql`

Provide this SQL for the user to run manually:

```sql
-- ═══════════════════════════════════════════════════════════════
-- User Skills — the skill graph data store
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE fp_user_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  skill_id UUID NOT NULL REFERENCES fp_skills(id),
  -- Current assessed fluency level for this skill
  fluency_level TEXT NOT NULL DEFAULT 'exploring'
    CHECK (fluency_level IN ('exploring', 'practicing', 'proficient', 'advanced')),
  -- Number of paths completed that developed this skill
  paths_completed INT NOT NULL DEFAULT 0,
  -- Total missions completed for this skill
  missions_completed INT NOT NULL DEFAULT 0,
  -- Average evaluation score across missions for this skill (weighted cumulative)
  avg_score NUMERIC(5,2) DEFAULT NULL,
  -- Total number of scored missions (for weighted avg recalculation)
  total_scored_missions INT NOT NULL DEFAULT 0,
  -- Timestamps
  first_demonstrated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_demonstrated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, skill_id)
);

CREATE INDEX idx_user_skills_user ON fp_user_skills(user_id);
CREATE INDEX idx_user_skills_skill ON fp_user_skills(skill_id);
CREATE INDEX idx_user_skills_fluency ON fp_user_skills(user_id, fluency_level);

-- RLS: users can read their own skill data; server writes via admin client
ALTER TABLE fp_user_skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_skills_select" ON fp_user_skills
  FOR SELECT USING (auth.uid() = user_id);

-- No INSERT/UPDATE policies for RLS — server uses admin client (service role)
-- This prevents client-side manipulation of skill data
```

**Why `total_scored_missions`?** The existing plan had `avg_score` recalculated from scratch each time. That requires querying all historical evaluations across all paths. By storing `total_scored_missions`, we can do an O(1) weighted average update: `new_avg = (old_avg * old_count + new_scores_sum) / (old_count + new_scores_count)`. This is critical for performance as users complete dozens of paths.

**Why no INSERT/UPDATE RLS policies?** Skill data is written exclusively by the server (admin client) during path completion. Users should never be able to directly modify their own skill levels. The SELECT policy lets the client read skill data for display.

### Step 2: TypeScript Types

**File:** `lib/types/skills.ts` — add to existing file:

```typescript
/** A user's progress on a specific skill. Stored in fp_user_skills. */
export interface UserSkill {
  id: string;
  user_id: string;
  skill_id: string;
  fluency_level: SkillFluency;
  paths_completed: number;
  missions_completed: number;
  avg_score: number | null;
  total_scored_missions: number;
  first_demonstrated_at: string;
  last_demonstrated_at: string;
}

/** A single skill's before/after state in a skill receipt. */
export interface SkillReceiptEntry {
  /** The skill with domain info */
  skill: {
    slug: string;
    name: string;
    domain_slug: string;
    domain_name: string;
    domain_icon: string;
  };
  /** Relevance to this path (primary skills weighted more in display) */
  relevance: 'primary' | 'secondary';
  /** User's fluency BEFORE this path completion */
  before: {
    fluency_level: SkillFluency;
    paths_completed: number;
  };
  /** User's fluency AFTER this path completion */
  after: {
    fluency_level: SkillFluency;
    paths_completed: number;
  };
  /** Whether this path caused a level-up */
  leveled_up: boolean;
  /** How many "do" tasks in this path contributed to this skill */
  missions_in_path: number;
  /** Average score from this path's missions (null if no scored missions) */
  avg_score_in_path: number | null;
}

/** The full skill receipt for a completed path. */
export interface SkillReceipt {
  path: {
    id: string;
    title: string;
    completed_at: string;
  };
  /** Skills developed, primary skills first */
  skills: SkillReceiptEntry[];
  /** Whether this is the user's first ever skill receipt (triggers special messaging) */
  is_first_receipt: boolean;
}
```

### Step 3: Skill Assessment Logic

**File:** Create `lib/skills/assessment.ts`

```typescript
/**
 * Skill assessment — determines skill fluency level from accumulated data.
 *
 * Fluency progression thresholds:
 *   exploring:  0-1 paths, any score
 *   practicing: 2+ paths, avg score >= 50
 *   proficient: 4+ paths, avg score >= 70
 *   advanced:   6+ paths, avg score >= 80
 *
 * These are deliberately generous to start. We tighten them once
 * we have real usage data showing natural progression curves.
 *
 * Design philosophy: fluency should feel earned but not punishing.
 * A user who completes 4 paths and consistently scores 70+ has genuinely
 * demonstrated proficiency. The thresholds reward both persistence
 * (paths_completed) and quality (avg_score).
 */

import type { SkillFluency } from '@/lib/types/skills';

interface SkillProgress {
  paths_completed: number;
  avg_score: number | null;
}

/** Determine fluency level from accumulated progress data. */
export function assessFluencyLevel(progress: SkillProgress): SkillFluency {
  const { paths_completed, avg_score } = progress;
  const score = avg_score ?? 0;

  if (paths_completed >= 6 && score >= 80) return 'advanced';
  if (paths_completed >= 4 && score >= 70) return 'proficient';
  if (paths_completed >= 2 && score >= 50) return 'practicing';
  return 'exploring';
}

/** Human-readable label for a fluency level. */
export function fluencyLabel(level: SkillFluency): string {
  const labels: Record<SkillFluency, string> = {
    exploring: 'Exploring',
    practicing: 'Practicing',
    proficient: 'Proficient',
    advanced: 'Advanced',
  };
  return labels[level];
}

/** Numeric index for comparing fluency levels (higher = more fluent). */
export function fluencyIndex(level: SkillFluency): number {
  const order: Record<SkillFluency, number> = {
    exploring: 0,
    practicing: 1,
    proficient: 2,
    advanced: 3,
  };
  return order[level];
}

/**
 * Calculate updated average score using weighted cumulative method.
 * Avoids needing to re-query all historical evaluations.
 *
 * Formula: new_avg = (old_avg * old_count + new_sum) / (old_count + new_count)
 */
export function recalculateAvgScore(
  currentAvg: number | null,
  currentCount: number,
  newScores: number[]
): { avg_score: number; total_count: number } {
  if (newScores.length === 0) {
    return { avg_score: currentAvg ?? 0, total_count: currentCount };
  }

  const oldSum = (currentAvg ?? 0) * currentCount;
  const newSum = newScores.reduce((a, b) => a + b, 0);
  const totalCount = currentCount + newScores.length;
  const newAvg = (oldSum + newSum) / totalCount;

  return {
    avg_score: Math.round(newAvg * 100) / 100,
    total_count: totalCount,
  };
}
```

### Step 4: Skill Receipt Calculator (Core Logic)

**File:** Create `lib/skills/receiptCalculator.ts`

This is the heart of Phase 2. It runs server-side during path completion.

```typescript
/**
 * Skill receipt calculator.
 *
 * Given a completed path and the user's submission data, computes the
 * skill receipt: which skills were developed, before/after fluency levels,
 * and whether any level-ups occurred. Also upserts fp_user_skills.
 *
 * Called from the path completion handler (PATCH /api/learn/paths/:id).
 * Uses the admin client — never called from the browser.
 */

import { createClient as createAdminClient } from '@/lib/supabase/admin';
import { getSkillsWithDomains } from '@/lib/skills/taxonomy';
import { assessFluencyLevel, recalculateAvgScore } from '@/lib/skills/assessment';
import type { SkillReceipt, SkillReceiptEntry, UserSkill } from '@/lib/types/skills';
import type { ItemState } from '@/lib/types/learning';

interface ReceiptInput {
  userId: string;
  pathId: string;
  pathTitle: string;
  completedAt: string;
  /** The item_states JSONB from fp_learning_progress */
  itemStates: Record<string, ItemState>;
  /** The path's items array (to identify which items are "do" tasks) */
  pathItems: Array<{
    item_id?: string;
    task_type: string;
    mission?: { objective?: string };
  }>;
}

/**
 * Calculate and persist the skill receipt for a completed path.
 *
 * Steps:
 * 1. Load skill tags for this path
 * 2. Snapshot current user_skills (before state)
 * 3. Extract mission scores from item_states
 * 4. Upsert fp_user_skills with updated data
 * 5. Return the receipt with before/after comparison
 *
 * Fails gracefully — returns null on any error. Path completion
 * should never be blocked by a skill receipt failure.
 */
export async function calculateSkillReceipt(
  input: ReceiptInput
): Promise<SkillReceipt | null> {
  try {
    const admin = createAdminClient();

    // ── 1. Load skill tags for this path ──────────────────────
    const { data: tagRows, error: tagErr } = await admin
      .from('fp_skill_tags')
      .select('skill_id, relevance')
      .eq('path_id', input.pathId);

    if (tagErr || !tagRows?.length) {
      console.log('[skill-receipt] No skill tags for path, skipping receipt');
      return null;
    }

    // Load full skill info
    const allSkills = await getSkillsWithDomains();
    const skillMap = new Map(allSkills.map(s => [s.id, s]));

    // ── 2. Snapshot current user skills (before state) ────────
    const skillIds = tagRows.map(t => t.skill_id);

    const { data: existingSkills } = await admin
      .from('fp_user_skills')
      .select('*')
      .eq('user_id', input.userId)
      .in('skill_id', skillIds);

    const existingMap = new Map(
      (existingSkills ?? []).map((s: UserSkill) => [s.skill_id, s])
    );

    // Check if this is the user's first ever receipt
    const { count: totalUserSkills } = await admin
      .from('fp_user_skills')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', input.userId);

    const isFirstReceipt = (totalUserSkills ?? 0) === 0;

    // ── 3. Extract mission scores from item_states ────────────
    // Find all "do" tasks and their evaluation scores
    const missionScores: number[] = [];
    let missionCount = 0;

    for (const item of input.pathItems) {
      if (item.task_type !== 'do') continue;

      const itemId = item.item_id;
      if (!itemId) continue;

      const state = input.itemStates[itemId];
      if (!state?.completed) continue;

      missionCount++;

      // Extract score from evaluation if present
      if (state.evaluation) {
        // The evaluation object has different shapes depending on task type
        // For "do" tasks (tool challenges), the evaluate endpoint stores quality
        // but the evaluator.ts returns a score (0-100)
        const eval_ = state.evaluation as Record<string, unknown>;
        if (typeof eval_.score === 'number') {
          missionScores.push(eval_.score);
        } else if (eval_.quality === 'nailed_it') {
          missionScores.push(90);
        } else if (eval_.quality === 'good') {
          missionScores.push(70);
        } else if (eval_.quality === 'needs_iteration') {
          missionScores.push(45);
        }
      }
    }

    // ── 4. Upsert fp_user_skills ──────────────────────────────
    const receiptEntries: SkillReceiptEntry[] = [];

    for (const tag of tagRows) {
      const skill = skillMap.get(tag.skill_id);
      if (!skill) continue;

      const existing = existingMap.get(tag.skill_id);

      // Before state
      const before = {
        fluency_level: existing?.fluency_level ?? 'exploring' as const,
        paths_completed: existing?.paths_completed ?? 0,
      };

      // Calculate new values
      const newPathsCompleted = (existing?.paths_completed ?? 0) + 1;
      const newMissionsCompleted = (existing?.missions_completed ?? 0) + missionCount;

      const { avg_score: newAvg, total_count: newTotalScored } = recalculateAvgScore(
        existing?.avg_score ?? null,
        existing?.total_scored_missions ?? 0,
        missionScores
      );

      const newFluency = assessFluencyLevel({
        paths_completed: newPathsCompleted,
        avg_score: missionScores.length > 0 ? newAvg : (existing?.avg_score ?? null),
      });

      // After state
      const after = {
        fluency_level: newFluency,
        paths_completed: newPathsCompleted,
      };

      // Upsert
      const now = new Date().toISOString();
      const upsertData = {
        user_id: input.userId,
        skill_id: tag.skill_id,
        fluency_level: newFluency,
        paths_completed: newPathsCompleted,
        missions_completed: newMissionsCompleted,
        avg_score: missionScores.length > 0 ? newAvg : (existing?.avg_score ?? null),
        total_scored_missions: newTotalScored,
        last_demonstrated_at: now,
        updated_at: now,
        ...(existing ? {} : { first_demonstrated_at: now }),
      };

      const { error: upsertErr } = await admin
        .from('fp_user_skills')
        .upsert(upsertData, { onConflict: 'user_id,skill_id' });

      if (upsertErr) {
        console.error('[skill-receipt] upsert error:', upsertErr);
        // Continue processing other skills — don't fail the whole receipt
      }

      // Build receipt entry
      const leveledUp = after.fluency_level !== before.fluency_level;

      receiptEntries.push({
        skill: {
          slug: skill.slug,
          name: skill.name,
          domain_slug: skill.domain.slug,
          domain_name: skill.domain.name,
          domain_icon: skill.domain.icon,
        },
        relevance: tag.relevance as 'primary' | 'secondary',
        before,
        after,
        leveled_up: leveledUp,
        missions_in_path: missionCount,
        avg_score_in_path: missionScores.length > 0
          ? Math.round(missionScores.reduce((a, b) => a + b, 0) / missionScores.length * 100) / 100
          : null,
      });
    }

    // Sort: primary skills first, then by whether they leveled up
    receiptEntries.sort((a, b) => {
      if (a.relevance !== b.relevance) return a.relevance === 'primary' ? -1 : 1;
      if (a.leveled_up !== b.leveled_up) return a.leveled_up ? -1 : 1;
      return 0;
    });

    return {
      path: {
        id: input.pathId,
        title: input.pathTitle,
        completed_at: input.completedAt,
      },
      skills: receiptEntries,
      is_first_receipt: isFirstReceipt,
    };
  } catch (error) {
    console.error('[skill-receipt] Failed to calculate receipt:', error);
    return null;
  }
}
```

### Step 5: Update Path Completion Handler

**File:** `app/api/learn/paths/[id]/route.ts` — modify the PATCH handler

Find the block that starts with `if (completedCount >= pathItems.length && !existing.completed_at)` (currently around line 217). Replace the entire completion block with:

```typescript
    // Check if path is complete
    if (completedCount >= pathItems.length && !existing.completed_at) {
      updates.status = "completed";
      updates.completed_at = new Date().toISOString();

      // Increment completion_count on path (fire-and-forget)
      admin
        .from("fp_learning_paths")
        .update({
          completion_count: (pathRow.completion_count ?? 0) + 1,
        })
        .eq("id", id)
        .then(() => {});

      // Auto-create achievement (fire-and-forget)
      const totalTime =
        (existing.time_invested_seconds ?? 0) +
        (body.time_delta_seconds ?? 0);
      const rand = Math.random().toString(36).slice(2, 6);
      const topicSlug = ((pathRow.topics as string[]) ?? [])[0]
        ?.toLowerCase()
        .replace(/[^a-z0-9-]/g, "")
        .slice(0, 20) ?? "skill";
      const shareSlug = `${topicSlug}-${rand}`;

      admin
        .from("fp_achievements")
        .insert({
          user_id: user.id,
          path_id: id,
          progress_id: existing.id,
          path_title: pathRow.title,
          path_topics: pathRow.topics ?? [],
          items_completed: completedCount,
          time_invested_seconds: totalTime,
          difficulty_level: pathRow.difficulty_level ?? "intermediate",
          share_slug: shareSlug,
        })
        .then(() => {});

      // ── NEW: Calculate skill receipt ──────────────────────
      const { calculateSkillReceipt } = await import('@/lib/skills/receiptCalculator');
      skillReceipt = await calculateSkillReceipt({
        userId: user.id,
        pathId: id,
        pathTitle: pathRow.title as string,
        completedAt: updates.completed_at,
        itemStates: updates.item_states as Record<string, ItemState>,
        pathItems: pathItems as Array<{
          item_id?: string;
          task_type: string;
          mission?: { objective?: string };
        }>,
      });
    }
```

**IMPORTANT:** Also declare `skillReceipt` near the top of the handler (before the completion check), and include it in the response:

```typescript
// Near top of PATCH handler, after existing variable declarations:
let skillReceipt: SkillReceipt | null = null;

// ... existing code ...

// In the response (replace the existing return):
return NextResponse.json({
  progress: mapProgressRow(updated!),
  ...(evaluation ? { evaluation } : {}),
  ...(skillReceipt ? { skill_receipt: skillReceipt } : {}),
});
```

Add the imports at the top of the file:

```typescript
import type { SkillReceipt } from '@/lib/types/skills';
import type { ItemState } from '@/lib/types/learning';
```

### Step 6: Skill Receipt API Endpoint (for re-fetching)

**File:** Create `app/api/learn/skill-receipt/[pathId]/route.ts`

The completion handler returns the receipt inline, but we also need a standalone endpoint for when the user revisits a completed path or refreshes the page.

```typescript
/**
 * GET /api/learn/skill-receipt/:pathId
 *
 * Returns the skill receipt for a completed path.
 * Reconstructs the receipt from stored fp_user_skills data.
 * This is the "read" version — the "write" happens during path completion.
 */

import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { getSkillsWithDomains } from '@/lib/skills/taxonomy';
import type { SkillReceiptEntry, UserSkill } from '@/lib/types/skills';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ pathId: string }> }
): Promise<Response> {
  const { pathId } = await params;

  // Auth check
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();

  // Verify path is completed by this user
  const { data: progress } = await admin
    .from('fp_learning_progress')
    .select('completed_at, path_id')
    .eq('user_id', user.id)
    .eq('path_id', pathId)
    .eq('status', 'completed')
    .single();

  if (!progress?.completed_at) {
    return NextResponse.json({ error: 'Path not completed' }, { status: 404 });
  }

  // Load path info
  const { data: pathRow } = await admin
    .from('fp_learning_paths')
    .select('id, title')
    .eq('id', pathId)
    .single();

  if (!pathRow) {
    return NextResponse.json({ error: 'Path not found' }, { status: 404 });
  }

  // Load skill tags for this path
  const { data: tagRows } = await admin
    .from('fp_skill_tags')
    .select('skill_id, relevance')
    .eq('path_id', pathId);

  if (!tagRows?.length) {
    return NextResponse.json({ skill_receipt: null });
  }

  // Load full skill info
  const allSkills = await getSkillsWithDomains();
  const skillMap = new Map(allSkills.map(s => [s.id, s]));

  // Load user's current skill data
  const skillIds = tagRows.map(t => t.skill_id);
  const { data: userSkills } = await admin
    .from('fp_user_skills')
    .select('*')
    .eq('user_id', user.id)
    .in('skill_id', skillIds);

  const userSkillMap = new Map(
    (userSkills ?? []).map((s: UserSkill) => [s.skill_id, s])
  );

  // Build receipt entries (after-only, since we can't reconstruct "before" state)
  const entries: SkillReceiptEntry[] = [];

  for (const tag of tagRows) {
    const skill = skillMap.get(tag.skill_id);
    if (!skill) continue;

    const userSkill = userSkillMap.get(tag.skill_id);
    const currentFluency = userSkill?.fluency_level ?? 'exploring';
    const currentPaths = userSkill?.paths_completed ?? 0;

    // For the re-fetch endpoint, we approximate "before" by subtracting 1 path
    // This is an approximation — the real before/after is only accurate at completion time
    const approxBeforePaths = Math.max(0, currentPaths - 1);
    const approxBeforeFluency = currentPaths <= 1 ? 'exploring' : currentFluency;

    entries.push({
      skill: {
        slug: skill.slug,
        name: skill.name,
        domain_slug: skill.domain.slug,
        domain_name: skill.domain.name,
        domain_icon: skill.domain.icon,
      },
      relevance: tag.relevance as 'primary' | 'secondary',
      before: {
        fluency_level: approxBeforeFluency as 'exploring' | 'practicing' | 'proficient' | 'advanced',
        paths_completed: approxBeforePaths,
      },
      after: {
        fluency_level: currentFluency as 'exploring' | 'practicing' | 'proficient' | 'advanced',
        paths_completed: currentPaths,
      },
      leveled_up: false, // Can't reliably reconstruct — only accurate at completion time
      missions_in_path: 0, // Not stored per-path; zero for re-fetches
      avg_score_in_path: null, // Not stored per-path
    });
  }

  // Sort: primary first
  entries.sort((a, b) => a.relevance === 'primary' ? -1 : 1);

  return NextResponse.json({
    skill_receipt: {
      path: {
        id: pathId,
        title: pathRow.title,
        completed_at: progress.completed_at,
      },
      skills: entries,
      is_first_receipt: false, // Re-fetches are never the first
    },
  });
}
```

### Step 7: Client-Side — Update useLearnProgress Hook

**File:** `lib/useLearnProgress.ts`

The hook needs to store the skill receipt when it comes back from the PATCH response.

Add to the hook's state:

```typescript
const [skillReceipt, setSkillReceipt] = useState<SkillReceipt | null>(null);
```

In the `completeItem` function, after the PATCH call succeeds, check for the receipt:

```typescript
// After the PATCH response is parsed:
if (data.skill_receipt) {
  setSkillReceipt(data.skill_receipt);
}
```

Also add a fetch for the receipt when loading a completed path (for page refreshes):

```typescript
// In the initial data fetch, after detecting isCompleted:
if (progressData.status === 'completed') {
  fetch(`/api/learn/skill-receipt/${pathId}`)
    .then(res => res.json())
    .then(data => {
      if (data.skill_receipt) setSkillReceipt(data.skill_receipt);
    })
    .catch(() => {}); // Silent fail — receipt is enhancement, not critical
}
```

Return `skillReceipt` from the hook.

### Step 8: Skill Receipt UI Component

**File:** Create `components/learn/SkillReceipt.tsx`

```typescript
'use client';

/**
 * SkillReceipt — displays skills developed after path completion.
 *
 * Design principles:
 * - Grayscale base, color only for level-ups and fluency indicators
 * - Professional tone — this is a credential, not a game achievement
 * - Staggered animations for each skill row
 * - Responsive: stacks cleanly on mobile
 */

import { Card } from '@/components/ui/Card';
import { fluencyLabel } from '@/lib/skills/assessment';
import type { SkillReceipt as SkillReceiptType, SkillReceiptEntry } from '@/lib/types/skills';
import type { SkillFluency } from '@/lib/types/skills';
import { ArrowRight, Sparkles, TrendingUp } from 'lucide-react';

// ─── Fluency color mapping ─────────────────────────────────
// Color = achievement or state. Each fluency level gets a semantic color.
// Uses CSS variables from the design system.

const FLUENCY_COLORS: Record<SkillFluency, string> = {
  exploring: 'var(--color-text-tertiary)',    // Gray — just starting
  practicing: 'var(--color-cyan-700)',         // Cyan — actively building
  proficient: 'var(--color-green-700)',        // Green — solid capability
  advanced: 'var(--color-violet-700)',         // Violet — mastery
};

// ─── Fluency Level Indicator ────────────────────────────────

function FluencyBadge({
  level,
  size = 'default',
}: {
  level: SkillFluency;
  size?: 'sm' | 'default';
}) {
  const color = FLUENCY_COLORS[level];
  const label = fluencyLabel(level);
  const textSize = size === 'sm' ? 'text-[10px]' : 'text-xs';
  const padding = size === 'sm' ? 'px-1.5 py-0.5' : 'px-2 py-0.5';

  return (
    <span
      className={`${textSize} ${padding} rounded-full font-medium inline-flex items-center`}
      style={{
        color,
        background: `color-mix(in srgb, ${color} 12%, transparent)`,
        border: `1px solid color-mix(in srgb, ${color} 25%, transparent)`,
      }}
    >
      {label}
    </span>
  );
}

// ─── Skill Row ──────────────────────────────────────────────

function SkillRow({
  entry,
  index,
}: {
  entry: SkillReceiptEntry;
  index: number;
}) {
  const { skill, before, after, leveled_up, relevance } = entry;

  return (
    <div
      className="flex items-center gap-3 py-3 animate-fade-in"
      style={{
        animationDelay: `${600 + index * 120}ms`,
        animationFillMode: 'backwards',
      }}
    >
      {/* Skill info (left) */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-[var(--color-text-primary)] truncate">
            {skill.name}
          </span>
          {relevance === 'primary' && (
            <span className="text-[10px] px-1 py-px rounded bg-[var(--color-bg-hover)] text-[var(--color-text-tertiary)] uppercase tracking-wider font-medium shrink-0">
              Primary
            </span>
          )}
        </div>
        <span className="text-xs text-[var(--color-text-tertiary)]">
          {skill.domain_name}
        </span>
      </div>

      {/* Fluency progression (right) */}
      <div className="flex items-center gap-2 shrink-0">
        <FluencyBadge level={before.fluency_level} size="sm" />
        <ArrowRight
          size={12}
          className="text-[var(--color-text-tertiary)]"
        />
        <div className="relative">
          <FluencyBadge level={after.fluency_level} />
          {leveled_up && (
            <span
              className="absolute -top-1 -right-1 animate-pulse"
              style={{ color: 'var(--color-gold-700)' }}
            >
              <Sparkles size={10} />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────

interface SkillReceiptProps {
  receipt: SkillReceiptType;
}

export default function SkillReceipt({ receipt }: SkillReceiptProps) {
  const { skills, is_first_receipt } = receipt;

  if (skills.length === 0) return null;

  const hasLevelUp = skills.some(s => s.leveled_up);

  return (
    <div
      className="w-full max-w-md animate-fade-in"
      style={{ animationDelay: '400ms', animationFillMode: 'backwards' }}
    >
      <Card className="overflow-hidden">
        {/* Accent bar — uses green for level-up, default accent otherwise */}
        <div
          className="h-0.5"
          style={{
            background: hasLevelUp
              ? 'linear-gradient(to right, var(--color-green-700), var(--color-gold-700))'
              : 'var(--color-border-default)',
          }}
        />

        <div className="p-5 space-y-1">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp
                size={14}
                style={{ color: hasLevelUp ? 'var(--color-green-700)' : 'var(--color-text-tertiary)' }}
              />
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                Skills Developed
              </h3>
            </div>
            {hasLevelUp && (
              <span
                className="text-[10px] font-semibold uppercase tracking-widest animate-fade-in"
                style={{ color: 'var(--color-gold-700)', animationDelay: '800ms' }}
              >
                Level Up
              </span>
            )}
          </div>

          {/* First receipt message */}
          {is_first_receipt && (
            <p
              className="text-xs text-[var(--color-text-tertiary)] animate-fade-in"
              style={{ animationDelay: '500ms', animationFillMode: 'backwards' }}
            >
              Your skill profile is starting to take shape.
            </p>
          )}

          {/* Divider */}
          <div
            className="h-px !mt-3"
            style={{ background: 'var(--color-border-default)' }}
          />

          {/* Skill rows */}
          <div className="divide-y divide-[var(--color-border-default)]">
            {skills.map((entry, i) => (
              <SkillRow key={entry.skill.slug} entry={entry} index={i} />
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}
```

### Step 9: Wire Receipt into Completion Screen

**File:** `app/(learn)/learn/paths/[id]/page.tsx`

Add the import at the top:

```typescript
import SkillReceipt from '@/components/learn/SkillReceipt';
```

In the completion celebration section (the `isCompleted` branch, currently around line 422), insert the SkillReceipt between the AchievementCard and the share buttons:

```tsx
{isCompleted ? (
  <div className="flex flex-col items-center py-12 px-4 sm:px-8 gap-10">
    {/* Header — existing, unchanged */}
    <div className="text-center space-y-2 animate-fade-in">
      <p className="text-sm font-semibold uppercase tracking-widest"
        style={{ color: "var(--color-accent-primary)" }}>
        Path Complete
      </p>
      <h2 className="text-2xl sm:text-3xl font-bold text-[var(--color-text-primary)]">
        Congratulations!
      </h2>
    </div>

    {/* Achievement Card — existing, unchanged */}
    <div className="animate-fade-in" style={{ animationDelay: "200ms" }}>
      <AchievementCard
        path={path}
        itemsCompleted={progress?.items_completed ?? path.items.length}
        timeInvested={progress?.time_invested_seconds ?? 0}
        completedAt={progress?.completed_at ?? new Date().toISOString()}
      />
    </div>

    {/* ── NEW: Skill Receipt ─────────────────────────────── */}
    {skillReceipt && (
      <SkillReceipt receipt={skillReceipt} />
    )}

    {/* Share + Continue buttons — existing, unchanged */}
    {/* ... rest of completion UI ... */}
  </div>
)}
```

The `skillReceipt` variable comes from the `useLearnProgress` hook (Step 7).

---

## Visual Design Specification

### Layout (Completion Screen, Top to Bottom)

```
┌─────────────────────────────────────────────┐
│              PATH COMPLETE                   │
│            Congratulations!                  │
│                                              │
│  ┌───────────────────────────────────────┐   │
│  │ ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬ accent bar ▬▬▬▬▬  │   │
│  │  PATH COMPLETE                        │   │
│  │  Build AI-Powered Landing Pages       │   │
│  │  ─────────────────────────────────    │   │
│  │  Resources        Time invested       │   │
│  │  8 completed      38 min              │   │
│  │                                       │   │
│  │  Topics: [AI] [Design] [Prototyping]  │   │
│  │                                       │   │
│  │  Completed Mar 15  •  SkillGap.ai     │   │
│  └───────────────────────────────────────┘   │
│                                              │  ← AchievementCard (existing)
│  ┌───────────────────────────────────────┐   │
│  │ ▬ (green/gold if level-up, gray if not│   │
│  │                                       │   │
│  │  ↗ Skills Developed       LEVEL UP    │   │
│  │  Your skill profile is starting...    │   │
│  │  ─────────────────────────────────    │   │
│  │                                       │   │
│  │  Prompt Engineering    PRIMARY        │   │
│  │  Writing & Communication              │   │
│  │  [Exploring] → [Practicing] ✨        │   │
│  │  ─────────────────────────────────    │   │
│  │                                       │   │
│  │  AI UI Prototyping                    │   │
│  │  Visual & Design                      │   │
│  │  [Exploring] → [Exploring]            │   │
│  │                                       │   │
│  └───────────────────────────────────────┘   │
│                                              │  ← SkillReceipt (NEW)
│     [Share Achievement]  [Continue Learning]  │
│                                              │
│  ─────────────────────────────────────────   │
│  Recommended next                            │
│  ┌──────────┐  ┌──────────┐                  │
│  │ Path Card │  │ Path Card │                 │
│  └──────────┘  └──────────┘                  │
└─────────────────────────────────────────────┘
```

### Animation Sequence

| Element | Delay | Duration | Animation |
|---------|-------|----------|-----------|
| "Path Complete" header | 0ms | 300ms | fade-in + slide-up |
| AchievementCard | 200ms | 300ms | fade-in + slide-up |
| SkillReceipt card | 400ms | 300ms | fade-in + slide-up |
| "Skills Developed" header | 500ms | 200ms | fade-in |
| First skill row | 600ms | 200ms | fade-in |
| Second skill row | 720ms | 200ms | fade-in |
| Level-up badge pulse | 900ms | continuous | subtle pulse |
| Share buttons | 800ms | 200ms | fade-in |
| Recommended paths | 1000ms | 200ms | fade-in |

The stagger creates a "reveal" effect — the user's eyes follow a natural top-to-bottom reading flow, with each new piece of information appearing just as they finish processing the previous one.

### Fluency Badge Colors

| Level | Text Color | Background | Border | Semantic |
|-------|-----------|------------|--------|----------|
| Exploring | `--color-text-tertiary` | 12% opacity | 25% opacity | Neutral gray — just starting |
| Practicing | `--color-cyan-700` | 12% opacity | 25% opacity | Cool blue — actively building |
| Proficient | `--color-green-700` | 12% opacity | 25% opacity | Green — solid, verified |
| Advanced | `--color-violet-700` | 12% opacity | 25% opacity | Violet — mastery |

### Level-Up Treatment

When `leveled_up: true`:
- Gold accent bar at top of card (`--color-gold-700` to `--color-green-700` gradient)
- "LEVEL UP" text in gold, top-right of header
- Sparkle icon on the leveled-up skill's "after" badge
- Sparkle uses subtle pulse animation (CSS `animate-pulse`)

When no level-up:
- Neutral border at top of card
- No special indicators
- Still shows before/after fluency (even "Exploring → Exploring" is meaningful — it tells the user "you've now practiced this skill in 1 path")

### First Receipt Treatment

When `is_first_receipt: true`:
- Subheader text: "Your skill profile is starting to take shape."
- This only shows once — the first time they complete a path that has skill tags.
- It signals: something new is happening, your work is being tracked in a new way.

---

## Edge Cases

### Path has no skill tags
The curriculum generator should always produce skill tags (Phase 1 added this). But for paths generated before Phase 1, or if the backfill hasn't run yet, `fp_skill_tags` may be empty. In this case, `calculateSkillReceipt` returns `null`, and the completion screen renders without the SkillReceipt component. The existing AchievementCard still shows. No error, no empty state.

### User completes the same path twice
Progress records are unique per user+path. The current system doesn't allow re-completing a path (once `status: "completed"`, the PATCH handler won't re-trigger completion logic because of the `!existing.completed_at` guard). If this changes in the future, the receipt calculator handles it gracefully — it upserts, so paths_completed increments again.

### Path has only "watch" and "check" tasks (no "do" missions)
Mission scores come from "do" tasks only. If a path has no "do" tasks, `missionScores` will be empty and `missions_in_path` will be 0. The skill still gets recorded with `paths_completed += 1` but no score data. Assessment will progress based on path count alone (exploring → practicing at 2 paths regardless of score if score is null). This is correct — watching and checking still demonstrates exposure to a skill.

### Evaluation data has inconsistent shapes
The `item_states.evaluation` object has different shapes depending on how the evaluation was performed (via the evaluate API endpoint vs. the evaluator.ts direct call). The receipt calculator handles both: it checks for `score` (numeric, 0-100) first, then falls back to quality strings (`nailed_it` → 90, `good` → 70, `needs_iteration` → 45). This mapping is approximate but sufficient for fluency assessment.

### Database error during upsert
If any single skill upsert fails, the calculator logs the error and continues with the remaining skills. The receipt may be partial, but it won't be empty (unless all upserts fail, which would indicate a systemic issue). The path completion itself is never blocked by a receipt failure.

### Race condition: two paths completed simultaneously
The upsert uses `ON CONFLICT (user_id, skill_id)` which is atomic at the row level. If two concurrent completions both try to update the same skill, one will win and the other will overwrite. The `paths_completed` increment could be off by one in extreme cases. This is acceptable — fluency assessment is not a precise instrument, and off-by-one on a threshold check is negligible.

---

## Order of Operations

1. **Provide migration SQL** to user → they run it to create `fp_user_skills`
2. **Create `lib/types/skills.ts` additions** (UserSkill, SkillReceiptEntry, SkillReceipt types)
3. **Create `lib/skills/assessment.ts`** (fluency assessment + weighted avg calculator)
4. **Create `lib/skills/receiptCalculator.ts`** (core receipt logic)
5. **Modify `app/api/learn/paths/[id]/route.ts`** (wire receipt into completion handler)
6. **Create `app/api/learn/skill-receipt/[pathId]/route.ts`** (re-fetch endpoint)
7. **Modify `lib/useLearnProgress.ts`** (store receipt in hook state, fetch on reload)
8. **Create `components/learn/SkillReceipt.tsx`** (UI component)
9. **Modify `app/(learn)/learn/paths/[id]/page.tsx`** (wire component into completion screen)

### Verification Checklist

- [ ] `fp_user_skills` table exists with correct schema
- [ ] Completing a path that has skill tags creates/updates `fp_user_skills` rows
- [ ] Skill receipt appears in the PATCH response when a path is completed
- [ ] The completion screen shows the SkillReceipt component with correct data
- [ ] Before/after fluency levels display correctly
- [ ] Level-up is detected and visually highlighted when fluency changes
- [ ] Re-fetching a completed path loads the skill receipt (page refresh works)
- [ ] Paths without skill tags complete normally without errors (graceful null)
- [ ] Multiple path completions accumulate skill progress correctly
- [ ] FluencyBadge colors match the design system (CSS variables, no hardcoded hex)
- [ ] Animations play in correct sequence with proper stagger timing
- [ ] Mobile layout stacks cleanly (test at 375px width)

---

## Files Created / Modified

| Action | File | What Changes |
|--------|------|-------------|
| CREATE | `supabase/migrations/20260324_create_user_skills.sql` | New table |
| MODIFY | `lib/types/skills.ts` | Add UserSkill, SkillReceiptEntry, SkillReceipt interfaces |
| CREATE | `lib/skills/assessment.ts` | Fluency assessment logic + weighted avg |
| CREATE | `lib/skills/receiptCalculator.ts` | Core receipt calculation + fp_user_skills upsert |
| MODIFY | `app/api/learn/paths/[id]/route.ts` | Wire receipt into completion handler |
| CREATE | `app/api/learn/skill-receipt/[pathId]/route.ts` | Standalone receipt endpoint |
| MODIFY | `lib/useLearnProgress.ts` | Store receipt in state, fetch on reload |
| CREATE | `components/learn/SkillReceipt.tsx` | Receipt UI component |
| MODIFY | `app/(learn)/learn/paths/[id]/page.tsx` | Wire SkillReceipt into completion screen |

**Total: 4 new files, 4 modified files.**
