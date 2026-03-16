# Phase 4: Skill-Aware Curriculum Generation — Surgical Implementation Plan

**Purpose:** The curriculum generator reads the user's skill profile and uses it to personalize every generated path. Paths build on what users already know, focus on skills they're developing, and surface recommendations based on skill gaps. This is where the three-axis model (Skills × Functions × Fluency) starts producing genuinely personalized learning.

**Read first:** `PHASE3_SKILL_PROFILE.md` (skill profile data model), `CLAUDE.md` (dev standards), `STRATEGY_Foundation.md` (skill graph vision).

**Critical rule:** NEVER use Supabase MCP tools — the MCP is connected to the wrong project. Always provide SQL for the user to copy/paste manually.

**Depends on:** Phase 3 complete (fp_user_skills populated, skill profile API working).

---

## The Emotional Design: Why Personalization Matters Here

### The Problem We're Solving

Right now, every user who searches "prompt engineering" gets the same path. A marketer who's never touched prompt engineering gets the same content as an engineer who's completed three prompt engineering paths and is solidly Practicing. The engineer's path wastes their time re-teaching basics. The marketer's path might be too advanced. Neither feels like the platform *knows* them.

With Phases 1-3 complete, we have the data to fix this. Every user has a skill profile — skills they've demonstrated, fluency levels they've earned, paths they've completed. Phase 4 feeds that data into the generator so that the platform produces paths *for this specific person* at *this specific moment* in their skill development.

### The Three Personalization Moments

**Moment 1: Path generation.** When the LLM designs a curriculum, it now knows: "This person is Practicing in Prompt Engineering and Exploring in Data Storytelling. Don't re-teach prompt basics. Build on what they know. Focus missions on the skill gap." The generated path feels like it was written by a tutor who's been watching their progress.

**Moment 2: Discovery recommendations.** When the user opens the Learn page without a search query, the platform can now answer: "Based on your skill profile, here are the highest-leverage paths for you right now." Not generic popular paths — personalized gap-closing paths. Skills they're one path away from leveling up. Domains they haven't explored yet. Adjacent skills that leverage what they already know.

**Moment 3: Post-completion next steps.** When the user finishes a path and sees their skill receipt, the recommended paths below are now skill-aware: "You just leveled up in Prompt Engineering. Here are paths that build on that skill." The momentum from completion flows directly into the next relevant experience.

### The Emotional Design Principle

Personalization must feel like **quiet competence, not surveillance.** The user should think "this path is exactly what I needed" — not "the system is tracking everything about me." The adaptation is invisible in its mechanics but obvious in its quality. The path just *fits*. That's the feeling.

---

## Architecture Overview

### What Changes

```
BEFORE (Phases 1-3):
  User searches → Generator gets function + fluency → LLM designs generic-ish path
  Completion → Skill receipt → Profile updates → User sees skills page

AFTER (Phase 4):
  User searches → Generator gets function + fluency + SKILL PROFILE → LLM designs personalized path
  Completion → Skill receipt → Profile updates → RECOMMENDATIONS update → User sees targeted next paths
  Discovery → SKILL-BASED RECOMMENDATIONS → User sees highest-leverage paths
```

### Data Flow for Skill-Aware Generation

```
User triggers generation (search or "Build Path")
  │
  ├─ Client: POST /api/learn/search/generate
  │    body: { query, function, fluency, secondary_functions }
  │    (unchanged — user_id extracted from auth on server)
  │
  ├─ Server (generate route):
  │    │
  │    ├─ (existing) Extract userFunction, userFluency from body
  │    │
  │    ├─ (NEW) Load user's skill profile from fp_user_skills
  │    │   → Array of { skill_slug, skill_name, fluency_level, paths_completed }
  │    │
  │    └─ generateAndCachePath(query, {
  │         userFunction, userFluency, secondaryFunctions,
  │         userSkills  ← NEW PARAMETER
  │       })
  │         │
  │         ├─ buildAdaptedPromptContext(fn, fluency, secondary, userSkills)
  │         │   → adaptationBlock now includes SKILL CONTEXT section
  │         │
  │         └─ generateCurriculum(query, { ...options, userSkills })
  │             → System prompt now includes skill awareness instructions
  │             → LLM designs path that builds on existing skills
  │
  └─ Response: same shape (generation_id for polling)
```

### Data Flow for Skill-Based Recommendations

```
User opens Learn page (no search query)
  │
  ├─ Client: GET /api/learn/search (existing discovery flow)
  │    + GET /api/learn/recommendations (NEW endpoint)
  │
  ├─ Server (recommendations):
  │    │
  │    ├─ Load user's skill profile
  │    ├─ Load skill taxonomy
  │    ├─ Calculate skill gaps:
  │    │   1. Skills at Exploring with 1 path (one more → Practicing)
  │    │   2. Skills relevant to user's function they haven't started
  │    │   3. Skills in adjacent domains
  │    ├─ Find cached paths that develop those skills (via fp_skill_tags)
  │    └─ Return ranked recommendations with reasoning
  │
  └─ Client: renders "Recommended for you" section above discovery grid
```

---

## Implementation: Step-by-Step

### Step 1: Load User Skills in Generation Route

**File:** `app/api/learn/search/generate/route.ts`

The generation route already extracts `userFunction` and `userFluency` from the request body. Now it also loads the user's skill profile before calling `generateAndCachePath`.

Add authentication check and skill loading at the top of the POST handler, after parsing the body:

```typescript
// After parseBody, before dedup check:

// Load user's skill profile for personalization
import { createClient } from '@/lib/supabase/server';
import type { UserSkill } from '@/lib/types/skills';

let userSkills: Array<{ slug: string; name: string; fluency_level: string; paths_completed: number }> = [];

try {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    const { data: skillRows } = await admin
      .from('fp_user_skills')
      .select(`
        fluency_level,
        paths_completed,
        skill_id
      `)
      .eq('user_id', user.id);

    if (skillRows?.length) {
      // Resolve skill slugs from taxonomy
      const { getSkills } = await import('@/lib/skills/taxonomy');
      const allSkills = await getSkills();
      const skillMap = new Map(allSkills.map(s => [s.id, s]));

      userSkills = skillRows
        .map((row: Record<string, unknown>) => {
          const skill = skillMap.get(row.skill_id as string);
          if (!skill) return null;
          return {
            slug: skill.slug,
            name: skill.name,
            fluency_level: row.fluency_level as string,
            paths_completed: row.paths_completed as number,
          };
        })
        .filter(Boolean) as typeof userSkills;
    }
  }
} catch (err) {
  // Silent fail — personalization is enhancement, not critical
  console.warn('[learn/search/generate] Failed to load user skills:', err);
}
```

Then pass `userSkills` to `generateAndCachePath`:

```typescript
// Update the fire-and-forget call:
const generationPromise = generateAndCachePath(query, {
  userFunction: userFunction ?? undefined,
  userFluency: userFluency ?? undefined,
  secondaryFunctions,
  userSkills,  // ← NEW
})
```

### Step 2: Thread User Skills Through the Generator

**File:** `lib/learn/pathGenerator.ts`

Update the `generateAndCachePath` (or `generateAndCacheCurriculum`) function signature to accept and pass through `userSkills`:

```typescript
// Update the options type to include userSkills:
interface GenerateOptions {
  userFunction?: ProfessionalFunction;
  userFluency?: FluencyLevel;
  secondaryFunctions?: ProfessionalFunction[];
  userSkills?: Array<{ slug: string; name: string; fluency_level: string; paths_completed: number }>;
}
```

Pass `userSkills` through to `generateCurriculum`:

```typescript
// In the call to generateCurriculum:
const result = await generateCurriculum(query, {
  userFunction: options?.userFunction,
  userFluency: options?.userFluency,
  secondaryFunctions: options?.secondaryFunctions,
  userSkills: options?.userSkills,  // ← NEW
});
```

**File:** `lib/learn/curriculumGenerator.ts`

Update the `generateCurriculum` options type:

```typescript
export async function generateCurriculum(
  query: string,
  options?: {
    userRole?: string;
    userGoal?: string;
    maxItems?: number;
    userFunction?: ProfessionalFunction;
    userFluency?: FluencyLevel;
    secondaryFunctions?: ProfessionalFunction[];
    userSkills?: Array<{ slug: string; name: string; fluency_level: string; paths_completed: number }>;
  }
): Promise<GenerateCurriculumResult> {
```

Pass `userSkills` to the adaptation engine:

```typescript
// Line ~167, update the buildAdaptedPromptContext call:
const adaptation = options?.userFunction && options?.userFluency
  ? buildAdaptedPromptContext(
      options.userFunction,
      options.userFluency,
      options.secondaryFunctions,
      options.userSkills,  // ← NEW
    )
  : null;
```

### Step 3: Update Adaptation Engine with Skill Context

**File:** `lib/learn/adaptationEngine.ts`

This is the core change. The adaptation engine now accepts user skills and includes a SKILL CONTEXT section in the prompt block.

Update the function signature:

```typescript
export function buildAdaptedPromptContext(
  fn: ProfessionalFunction,
  fluency: FluencyLevel,
  secondaryFunctions?: ProfessionalFunction[],
  userSkills?: Array<{ slug: string; name: string; fluency_level: string; paths_completed: number }>,
): AdaptationContext {
```

Add the skill context block after the existing adaptation block construction. Insert it before the closing `───────` line:

```typescript
  // Build skill context if user has demonstrated skills
  let skillContextBlock = "";
  if (userSkills && userSkills.length > 0) {
    const skillLines = userSkills
      .sort((a, b) => {
        // Sort by fluency (highest first) for readability
        const order: Record<string, number> = { advanced: 3, proficient: 2, practicing: 1, exploring: 0 };
        return (order[b.fluency_level] ?? 0) - (order[a.fluency_level] ?? 0);
      })
      .map(s => `- ${s.name}: ${s.fluency_level} (${s.paths_completed} path${s.paths_completed !== 1 ? 's' : ''} completed)`)
      .join("\n");

    // Identify strong skills (practicing+) and developing skills (exploring)
    const strongSkills = userSkills.filter(s => s.fluency_level !== 'exploring');
    const developingSkills = userSkills.filter(s => s.fluency_level === 'exploring');

    let guidanceLines: string[] = [];

    if (strongSkills.length > 0) {
      guidanceLines.push(
        `- BUILD ON existing ${strongSkills.map(s => s.name).join(", ")} skills — reference concepts they already know, skip introductory explanations for these`
      );
    }

    if (developingSkills.length > 0) {
      guidanceLines.push(
        `- FOCUS missions on developing ${developingSkills.map(s => s.name).join(", ")} — these are growth areas`
      );
    }

    guidanceLines.push(
      "- CONNECT new concepts to skills they've already demonstrated when possible",
      "- DO NOT re-teach fundamentals of skills they're Practicing or above",
      "- CALIBRATE difficulty: missions should stretch their current level, not repeat it"
    );

    skillContextBlock = `

SKILL CONTEXT — THE LEARNER'S CURRENT CAPABILITIES:
${skillLines}

When designing this path:
${guidanceLines.join("\n")}`;
  }
```

Then insert `skillContextBlock` into the adaptation block. Find the line that builds `adaptationBlock` and add it before the closing divider:

```typescript
  const adaptationBlock = `
───────────────────────────────────────────
ADAPTATION CONTEXT — FOLLOW THESE INSTRUCTIONS
───────────────────────────────────────────

TARGET LEARNER: ${functionCtx.label} professional at the "${fluencyCtx.label}" fluency level.
${secondaryNote}

FUNCTION PERSPECTIVE:
${functionCtx.perspective}

MISSION FRAMING:
${functionCtx.missionFraming}

SUCCESS CRITERIA:
${functionCtx.successCriteriaGuidance}

SCAFFOLDING DEPTH (${fluencyCtx.scaffoldingDepth}):
${fluencyCtx.promptGuidance}

LEARNER BACKGROUND:
${fluencyCtx.expectedPriorKnowledge}
${skillContextBlock}

PREFERRED TOOLS (use these in missions when possible):
${toolNames.length > 0 ? toolNames.map((n, i) => `${i + 1}. ${n}`).join("\n") : "Use any appropriate AI tool."}

TOPICS TO DE-PRIORITIZE:
${functionCtx.avoidTopics.length > 0 ? functionCtx.avoidTopics.join(", ") : "None"}

IMPORTANT: Every aspect of this path — tool selection, mission framing, success criteria, scaffolding depth, and content emphasis — must be adapted for a ${functionCtx.label} professional at the ${fluencyCtx.label} level. Do NOT produce generic content.
───────────────────────────────────────────`;
```

**Why this placement?** The SKILL CONTEXT sits between LEARNER BACKGROUND (which describes their general fluency level) and PREFERRED TOOLS (which is about mechanics). Skills are about *what they know*; tools are about *what they use*. This ordering lets the LLM build a coherent mental model: who they are (function) → how much they know (fluency) → what specific skills they have (skill context) → what tools to use (tools).

### Step 4: Skill-Based Recommendations Engine

**File:** Create `lib/skills/recommendations.ts`

```typescript
/**
 * Skill-based path recommendations.
 *
 * Given a user's skill profile and function, recommends the highest-leverage
 * learning paths. Three recommendation strategies, blended:
 *
 * 1. LEVEL-UP CANDIDATES: Skills where the user is 1 path away from
 *    advancing to the next fluency level. Highest priority because
 *    the reward is immediate and visible.
 *
 * 2. FUNCTION GAP FILL: Skills relevant to the user's function that
 *    they haven't started yet. These are the "you should know this"
 *    recommendations.
 *
 * 3. DOMAIN EXPANSION: Skills in domains the user hasn't explored yet,
 *    prioritized by relevance to their function. These are the
 *    "broaden your capabilities" recommendations.
 */

import { createClient as createAdminClient } from '@/lib/supabase/admin';
import { getSkills, getSkillDomains, getSkillsWithDomains } from '@/lib/skills/taxonomy';
import { assessFluencyLevel, fluencyIndex } from '@/lib/skills/assessment';
import type { SkillFluency, UserSkill } from '@/lib/types/skills';
import type { LearningPath } from '@/lib/types';
import { mapPathRow } from '@/lib/learn/pathGenerator';

// ─── Types ──────────────────────────────────────────────────

export interface SkillRecommendation {
  /** The recommended skill to develop */
  skill: {
    slug: string;
    name: string;
    domain_name: string;
  };
  /** Why this skill is recommended */
  reason: 'level_up' | 'function_gap' | 'domain_expansion';
  /** Human-readable explanation */
  reason_text: string;
  /** Priority score (higher = more recommended, 0-100) */
  priority: number;
  /** Paths that develop this skill (up to 3) */
  paths: LearningPath[];
}

// ─── Thresholds (from assessment.ts) ────────────────────────
// These mirror the fluency progression rules.
// A user at exploring with 1 path needs 1 more path to potentially reach practicing.
// A user at practicing with 3 paths needs 1 more to potentially reach proficient (if score >= 70).

function pathsUntilNextLevel(current: { fluency_level: SkillFluency; paths_completed: number; avg_score: number | null }): number | null {
  const { fluency_level, paths_completed, avg_score } = current;
  const score = avg_score ?? 0;

  if (fluency_level === 'exploring') {
    // Need 2 paths + score >= 50 to reach practicing
    return Math.max(0, 2 - paths_completed);
  }
  if (fluency_level === 'practicing') {
    // Need 4 paths + score >= 70 to reach proficient
    if (score < 70 && paths_completed >= 4) return null; // Score-gated, can't just add paths
    return Math.max(0, 4 - paths_completed);
  }
  if (fluency_level === 'proficient') {
    // Need 6 paths + score >= 80 to reach advanced
    if (score < 80 && paths_completed >= 6) return null;
    return Math.max(0, 6 - paths_completed);
  }
  return null; // Already advanced
}

// ─── Main Recommendation Function ───────────────────────────

/**
 * Generate skill-based recommendations for a user.
 *
 * @param userId - The authenticated user's ID
 * @param userFunction - The user's primary function (for relevance ranking)
 * @param limit - Max total recommendations to return (default 6)
 */
export async function getSkillRecommendations(
  userId: string,
  userFunction: string | null,
  limit: number = 6
): Promise<SkillRecommendation[]> {
  const admin = createAdminClient();

  // Load data in parallel
  const [allSkillsWithDomains, userSkillsResult] = await Promise.all([
    getSkillsWithDomains(),
    admin.from('fp_user_skills').select('*').eq('user_id', userId),
  ]);

  const userSkillMap = new Map(
    (userSkillsResult.data ?? []).map((s: UserSkill) => [s.skill_id, s])
  );

  const recommendations: SkillRecommendation[] = [];

  // ── Strategy 1: Level-Up Candidates ─────────────────────
  for (const skill of allSkillsWithDomains) {
    const userSkill = userSkillMap.get(skill.id);
    if (!userSkill) continue;

    const pathsNeeded = pathsUntilNextLevel({
      fluency_level: userSkill.fluency_level as SkillFluency,
      paths_completed: userSkill.paths_completed,
      avg_score: userSkill.avg_score,
    });

    if (pathsNeeded !== null && pathsNeeded <= 2 && pathsNeeded > 0) {
      const nextLevel = userSkill.fluency_level === 'exploring' ? 'Practicing'
        : userSkill.fluency_level === 'practicing' ? 'Proficient'
        : 'Advanced';

      recommendations.push({
        skill: {
          slug: skill.slug,
          name: skill.name,
          domain_name: skill.domain.name,
        },
        reason: 'level_up',
        reason_text: `${pathsNeeded} more path${pathsNeeded !== 1 ? 's' : ''} to reach ${nextLevel}`,
        priority: 90 - (pathsNeeded * 10), // 1 path away = 80, 2 paths = 70
        paths: [],
      });
    }
  }

  // ── Strategy 2: Function Gap Fill ───────────────────────
  if (userFunction) {
    for (const skill of allSkillsWithDomains) {
      const userSkill = userSkillMap.get(skill.id);
      if (userSkill) continue; // Already started

      // Check if skill is relevant to user's function
      const isRelevant = skill.relevant_functions.length === 0 ||
        skill.relevant_functions.includes(userFunction);
      if (!isRelevant) continue;

      recommendations.push({
        skill: {
          slug: skill.slug,
          name: skill.name,
          domain_name: skill.domain.name,
        },
        reason: 'function_gap',
        reason_text: `Key skill for ${userFunction.replace('_', ' ')} professionals`,
        priority: 50 + (skill.relevant_functions.length === 0 ? 0 : 10), // Function-specific > universal
        paths: [],
      });
    }
  }

  // ── Strategy 3: Domain Expansion ────────────────────────
  const activeDomainIds = new Set(
    allSkillsWithDomains
      .filter(s => userSkillMap.has(s.id))
      .map(s => s.domain_id)
  );

  for (const skill of allSkillsWithDomains) {
    if (activeDomainIds.has(skill.domain_id)) continue; // Already active in this domain
    if (userSkillMap.has(skill.id)) continue; // Already started

    // Only recommend the "entry" skill for each unexplored domain (sort_order = 0 or 1)
    if (skill.sort_order > 1) continue;

    recommendations.push({
      skill: {
        slug: skill.slug,
        name: skill.name,
        domain_name: skill.domain.name,
      },
      reason: 'domain_expansion',
      reason_text: `Explore ${skill.domain.name}`,
      priority: 30,
      paths: [],
    });
  }

  // ── Sort by priority, deduplicate, limit ────────────────
  const seen = new Set<string>();
  const sorted = recommendations
    .sort((a, b) => b.priority - a.priority)
    .filter(r => {
      if (seen.has(r.skill.slug)) return false;
      seen.add(r.skill.slug);
      return true;
    })
    .slice(0, limit);

  // ── Load paths for each recommendation ──────────────────
  if (sorted.length > 0) {
    const skillSlugs = sorted.map(r => r.skill.slug);
    const allSkills = await getSkills();
    const slugToId = new Map(allSkills.map(s => [s.slug, s.id]));

    const skillIds = skillSlugs
      .map(slug => slugToId.get(slug))
      .filter(Boolean) as string[];

    if (skillIds.length > 0) {
      // Load paths tagged with these skills
      const { data: tagRows } = await admin
        .from('fp_skill_tags')
        .select('path_id, skill_id')
        .in('skill_id', skillIds)
        .eq('relevance', 'primary');

      if (tagRows?.length) {
        const pathIds = [...new Set(tagRows.map(t => t.path_id))];

        const { data: pathRows } = await admin
          .from('fp_learning_paths')
          .select('*')
          .in('id', pathIds.slice(0, 30))
          .order('completion_count', { ascending: false });

        if (pathRows?.length) {
          // Map paths to skills
          const skillToPathIds = new Map<string, string[]>();
          for (const tag of tagRows) {
            const existing = skillToPathIds.get(tag.skill_id) ?? [];
            existing.push(tag.path_id);
            skillToPathIds.set(tag.skill_id, existing);
          }

          const pathMap = new Map(
            pathRows.map(row => [row.id as string, mapPathRow(row)])
          );

          // Attach paths to recommendations
          for (const rec of sorted) {
            const skillId = slugToId.get(rec.skill.slug);
            if (!skillId) continue;
            const recPathIds = skillToPathIds.get(skillId) ?? [];
            rec.paths = recPathIds
              .map(id => pathMap.get(id))
              .filter(Boolean)
              .slice(0, 3) as LearningPath[];
          }
        }
      }
    }
  }

  // Filter out recommendations with no paths (nothing to offer)
  return sorted.filter(r => r.paths.length > 0);
}
```

### Step 5: Recommendations API Endpoint

**File:** Create `app/api/learn/recommendations/route.ts`

```typescript
/**
 * GET /api/learn/recommendations
 *
 * Returns personalized skill-based path recommendations for the
 * authenticated user. Based on their skill profile, function, and
 * the available path library.
 *
 * Query params:
 *   limit (optional, default 6, max 12)
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@/lib/supabase/admin';
import { getSkillRecommendations } from '@/lib/skills/recommendations';

export async function GET(request: Request): Promise<Response> {
  // Auth check
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Parse limit
  const url = new URL(request.url);
  const limit = Math.min(12, Math.max(1, parseInt(url.searchParams.get('limit') ?? '6', 10)));

  // Load user's function for relevance ranking
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from('fp_profiles')
    .select('primary_function')
    .eq('id', user.id)
    .single();

  const userFunction = (profile?.primary_function as string) ?? null;

  try {
    const recommendations = await getSkillRecommendations(user.id, userFunction, limit);
    return NextResponse.json({ recommendations });
  } catch (error) {
    console.error('[learn/recommendations] Error:', error);
    return NextResponse.json({ recommendations: [] });
  }
}
```

### Step 6: Client-Side Recommendations Hook

**File:** Create `lib/useSkillRecommendations.ts`

```typescript
'use client';

/**
 * Hook to fetch skill-based path recommendations.
 * Used on the Learn page to show "Recommended for you" section.
 */

import { useState, useEffect } from 'react';
import type { LearningPath } from './types';

export interface SkillRecommendation {
  skill: {
    slug: string;
    name: string;
    domain_name: string;
  };
  reason: 'level_up' | 'function_gap' | 'domain_expansion';
  reason_text: string;
  priority: number;
  paths: LearningPath[];
}

interface UseSkillRecommendationsReturn {
  recommendations: SkillRecommendation[];
  isLoading: boolean;
}

export function useSkillRecommendations(): UseSkillRecommendationsReturn {
  const [recommendations, setRecommendations] = useState<SkillRecommendation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch('/api/learn/recommendations?limit=6')
      .then(res => res.ok ? res.json() : { recommendations: [] })
      .then(data => setRecommendations(data.recommendations ?? []))
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  return { recommendations, isLoading };
}
```

### Step 7: Recommendations UI Component

**File:** Create `components/learn/SkillRecommendations.tsx`

```typescript
'use client';

/**
 * Skill-based recommendation cards for the Learn page.
 *
 * Shows personalized path recommendations based on the user's skill profile.
 * Three recommendation types, each with a distinct visual treatment:
 * - Level-up: highlighted, most prominent (you're almost there)
 * - Function gap: standard weight (you should know this)
 * - Domain expansion: subtle (broaden your capabilities)
 */

import { Card } from '@/components/ui/Card';
import { FluencyBadge } from '@/components/skills/FluencyBadge';
import { Button } from '@/components/ui/Button';
import { TrendingUp, Target, Compass, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { SkillRecommendation } from '@/lib/useSkillRecommendations';
import type { LearningPath } from '@/lib/types';

// ─── Reason config ──────────────────────────────────────────

const REASON_CONFIG: Record<string, {
  icon: typeof TrendingUp;
  label: string;
  color: string;
}> = {
  level_up: {
    icon: TrendingUp,
    label: 'Level up',
    color: 'var(--color-green-700)',
  },
  function_gap: {
    icon: Target,
    label: 'Key skill',
    color: 'var(--color-cyan-700)',
  },
  domain_expansion: {
    icon: Compass,
    label: 'Explore',
    color: 'var(--color-text-tertiary)',
  },
};

// ─── Recommendation Card ────────────────────────────────────

function RecommendationCard({
  rec,
  index,
}: {
  rec: SkillRecommendation;
  index: number;
}) {
  const router = useRouter();
  const config = REASON_CONFIG[rec.reason] ?? REASON_CONFIG.function_gap;
  const Icon = config.icon;
  const topPath = rec.paths[0];

  if (!topPath) return null;

  return (
    <Card
      className="p-4 space-y-3 animate-fade-in cursor-pointer transition-colors hover:bg-[var(--color-bg-hover)]"
      style={{
        animationDelay: `${index * 100}ms`,
        animationFillMode: 'backwards',
      }}
      onClick={() => router.push(`/learn/paths/${topPath.id}`)}
    >
      {/* Reason badge */}
      <div className="flex items-center gap-1.5">
        <Icon size={12} style={{ color: config.color }} />
        <span
          className="text-[10px] font-semibold uppercase tracking-wider"
          style={{ color: config.color }}
        >
          {config.label}
        </span>
      </div>

      {/* Skill + reasoning */}
      <div className="space-y-0.5">
        <h4 className="text-sm font-medium text-[var(--color-text-primary)] leading-snug">
          {rec.skill.name}
        </h4>
        <p className="text-xs text-[var(--color-text-tertiary)]">
          {rec.reason_text}
        </p>
      </div>

      {/* Top path */}
      <div className="flex items-center justify-between pt-1">
        <p className="text-xs text-[var(--color-text-secondary)] truncate pr-2">
          {topPath.title}
        </p>
        <ArrowRight size={12} className="text-[var(--color-text-tertiary)] shrink-0" />
      </div>
    </Card>
  );
}

// ─── Main Component ─────────────────────────────────────────

interface SkillRecommendationsProps {
  recommendations: SkillRecommendation[];
}

export function SkillRecommendations({ recommendations }: SkillRecommendationsProps) {
  if (recommendations.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-[var(--color-text-secondary)]">
        Recommended for you
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {recommendations.slice(0, 6).map((rec, i) => (
          <RecommendationCard key={rec.skill.slug} rec={rec} index={i} />
        ))}
      </div>
    </div>
  );
}
```

### Step 8: Wire Recommendations into Learn Page

**File:** `components/learn/LearnPage.tsx` (or wherever the learn hub content lives)

Add the recommendations section above the existing discovery grid. The recommendations only show when the user is in discovery mode (no active search query).

```typescript
// Import at top:
import { useSkillRecommendations } from '@/lib/useSkillRecommendations';
import { SkillRecommendations } from '@/components/learn/SkillRecommendations';

// Inside the component, alongside existing hooks:
const { recommendations, isLoading: recsLoading } = useSkillRecommendations();

// In the JSX, when showing discovery mode (no search query):
// Insert ABOVE the existing discovery grid:
{!searchQuery && recommendations.length > 0 && (
  <SkillRecommendations recommendations={recommendations} />
)}
```

The exact insertion point depends on the Learn page structure. Look for the discovery grid (the section that shows when there's no active search). Insert the `SkillRecommendations` component immediately before it.

### Step 9: Skill-Aware Completion Recommendations

**File:** `app/api/learn/paths/[id]/route.ts` (or wherever post-completion recommended paths are fetched)

Currently, the completion screen shows "Recommended next" paths that are fetched generically. Update this to use skill context.

Look for where `recommendedPaths` are loaded on the client side. In the completion section of `app/(learn)/learn/paths/[id]/page.tsx`, there's a `useEffect` that fetches recommended paths. Update it to also call the recommendations endpoint:

```typescript
// In the completion screen's recommended paths fetch:
// Replace the generic fetch with a skill-aware one:

useEffect(() => {
  if (!isCompleted) return;

  fetch('/api/learn/recommendations?limit=4')
    .then(res => res.ok ? res.json() : { recommendations: [] })
    .then(data => {
      // Extract paths from recommendations, flatten
      const recPaths = (data.recommendations ?? [])
        .flatMap((r: { paths: LearningPath[] }) => r.paths)
        .filter((p: LearningPath) => p.id !== pathId) // Exclude current path
        .slice(0, 4);

      if (recPaths.length > 0) {
        setRecommendedPaths(recPaths);
      } else {
        // Fallback to generic recommendations if skill-based returns nothing
        // (existing logic here)
      }
    })
    .catch(() => {
      // Fallback to existing generic recommendation logic
    });
}, [isCompleted, pathId]);
```

---

## What the LLM Sees (Before vs After)

### Before Phase 4

```
───────────────────────────────────────────
ADAPTATION CONTEXT — FOLLOW THESE INSTRUCTIONS
───────────────────────────────────────────

TARGET LEARNER: Engineering professional at the "practicing" fluency level.

FUNCTION PERSPECTIVE:
Engineers use AI to ship higher-quality code faster...

MISSION FRAMING:
Frame every mission as an engineering task...

SUCCESS CRITERIA:
Code must be production-quality...

SCAFFOLDING DEPTH (Moderate guidance):
Provide partial prompts...

LEARNER BACKGROUND:
Has used at least 1-2 AI tools...

PREFERRED TOOLS:
1. Cursor
2. Claude
...
───────────────────────────────────────────
```

### After Phase 4

```
───────────────────────────────────────────
ADAPTATION CONTEXT — FOLLOW THESE INSTRUCTIONS
───────────────────────────────────────────

TARGET LEARNER: Engineering professional at the "practicing" fluency level.

FUNCTION PERSPECTIVE:
Engineers use AI to ship higher-quality code faster...

MISSION FRAMING:
Frame every mission as an engineering task...

SUCCESS CRITERIA:
Code must be production-quality...

SCAFFOLDING DEPTH (Moderate guidance):
Provide partial prompts...

LEARNER BACKGROUND:
Has used at least 1-2 AI tools...

SKILL CONTEXT — THE LEARNER'S CURRENT CAPABILITIES:
- AI Code Generation: practicing (3 paths completed)
- Prompt Engineering: practicing (2 paths completed)
- AI-Assisted Debugging: exploring (1 path completed)
- API Integration: exploring (1 path completed)

When designing this path:
- BUILD ON existing AI Code Generation, Prompt Engineering skills — reference concepts they already know, skip introductory explanations for these
- FOCUS missions on developing AI-Assisted Debugging, API Integration — these are growth areas
- CONNECT new concepts to skills they've already demonstrated when possible
- DO NOT re-teach fundamentals of skills they're Practicing or above
- CALIBRATE difficulty: missions should stretch their current level, not repeat it

PREFERRED TOOLS:
1. Cursor
2. Claude
...
───────────────────────────────────────────
```

The difference is transformative. The LLM now knows exactly what to build on and what to focus on. A path about "AI debugging" for this user would skip the "what is AI debugging?" introduction and jump straight into advanced debugging patterns, referencing the code generation and prompt engineering skills they already have.

---

## Edge Cases

### User has no skill profile yet (new user)
`userSkills` will be an empty array. The skill context block is skipped entirely. The generator falls back to the existing function + fluency adaptation. No change in behavior for new users.

### User has skills but starts a completely new topic
The skill context still appears in the prompt. The LLM may or may not reference existing skills — that depends on whether there's a natural connection. If someone with Prompt Engineering skills starts a Data Visualization path, the LLM might say "use the same iterative prompting approach you've practiced to refine chart visualizations." Or it might not mention it at all. Both are fine — the context is available but not forcing.

### User has 20+ skills
The skill context block could get long. Cap it at the top 10 skills by fluency level (highest first). Users with 20+ skills are advanced enough that the LLM doesn't need every data point — it needs the signal of their strongest capabilities.

Add this cap in the adaptation engine:

```typescript
// Cap at top 10 skills by fluency to avoid prompt bloat
const cappedSkills = userSkills.slice(0, 10);
```

(The skills are already sorted by fluency descending.)

### Recommendations endpoint returns no results
This happens when a user has no skills (new user) or the path library is thin. The `SkillRecommendations` component returns `null` when the array is empty. The Learn page renders normally without the recommendations section.

### Cached paths don't have skill tags yet
Paths generated before Phase 1 won't have `fp_skill_tags` entries. The recommendations engine only matches paths that have skill tags. Over time, as the backfill script (Phase 1) and new path generation populate tags, recommendations improve. This is acceptable — the system gets better as the data grows.

---

## Order of Operations

1. **Modify `app/api/learn/search/generate/route.ts`** — load user skills, pass to generator
2. **Modify `lib/learn/pathGenerator.ts`** — thread userSkills through options
3. **Modify `lib/learn/curriculumGenerator.ts`** — accept and pass userSkills to adaptation engine
4. **Modify `lib/learn/adaptationEngine.ts`** — add SKILL CONTEXT block to adaptation prompt
5. **Create `lib/skills/recommendations.ts`** — recommendation engine with 3 strategies
6. **Create `app/api/learn/recommendations/route.ts`** — API endpoint
7. **Create `lib/useSkillRecommendations.ts`** — client-side hook
8. **Create `components/learn/SkillRecommendations.tsx`** — recommendation cards UI
9. **Modify `components/learn/LearnPage.tsx`** — wire recommendations into discovery mode
10. **Modify `app/(learn)/learn/paths/[id]/page.tsx`** — skill-aware post-completion recommendations

### Verification Checklist

- [ ] Generating a path with user skills produces a SKILL CONTEXT block in the prompt
- [ ] Generated paths for users with skills are measurably different from paths without skills (compare two generations for the same query — one with skills, one without)
- [ ] The adaptation block doesn't break when userSkills is empty
- [ ] `/api/learn/recommendations` returns ranked recommendations for a user with skills
- [ ] Level-up candidates are prioritized highest in recommendations
- [ ] Learn page shows "Recommended for you" section when user has skills
- [ ] Recommendations disappear when user has no skills (new users)
- [ ] Post-completion recommended paths use skill-aware recommendations
- [ ] Skills cap at 10 in the adaptation prompt (no prompt bloat)
- [ ] The generation route still works for unauthenticated/anonymous requests (graceful fallback)

---

## Files Created / Modified

| Action | File | What Changes |
|--------|------|-------------|
| MODIFY | `app/api/learn/search/generate/route.ts` | Load user skills, pass to generator |
| MODIFY | `lib/learn/pathGenerator.ts` | Thread userSkills through options type |
| MODIFY | `lib/learn/curriculumGenerator.ts` | Accept userSkills, pass to adaptation engine |
| MODIFY | `lib/learn/adaptationEngine.ts` | Add SKILL CONTEXT block to adaptation prompt |
| CREATE | `lib/skills/recommendations.ts` | 3-strategy recommendation engine |
| CREATE | `app/api/learn/recommendations/route.ts` | Recommendations API endpoint |
| CREATE | `lib/useSkillRecommendations.ts` | Client-side recommendations hook |
| CREATE | `components/learn/SkillRecommendations.tsx` | Recommendation cards UI |
| MODIFY | `components/learn/LearnPage.tsx` | Wire recommendations into discovery mode |
| MODIFY | `app/(learn)/learn/paths/[id]/page.tsx` | Skill-aware post-completion recommendations |

**Total: 4 new files, 6 modified files.**
