# Skills System — Implementation Plan

**Goal:** Make skills the primary organizing concept in SkillGap.ai. Skills × Functions × Fluency becomes the three-axis model. Functions remain as context, fluency remains as depth, but skills become the primary axis that everything else revolves around.

**Read first:** `STRATEGY_Foundation.md` (the full product strategy), `CLAUDE.md` (dev standards and critical warnings).

**Critical rule:** NEVER use Supabase MCP tools (execute_sql, apply_migration, etc.) — the MCP is connected to the wrong project. Always provide SQL for the user to copy/paste manually.

---

## Current State of the Codebase

### What exists today

The platform has a working two-axis adaptation system: **Functions** (7 professional domains) × **Fluency** (4 levels). This is wired into curriculum generation but has no concept of discrete skills.

**Onboarding types** (`lib/onboarding/types.ts`):
- `ProfessionalFunction`: `"engineering" | "marketing" | "design" | "product" | "data_analytics" | "sales_revenue" | "operations"`
- `FluencyLevel`: `"exploring" | "practicing" | "proficient" | "advanced"`

**Adaptation engine** (`lib/learn/adaptationEngine.ts`):
- `buildAdaptedPromptContext(fn, fluency, secondaryFunctions?)` → returns `AdaptationContext` with `adaptationBlock` string, `preferredToolSlugs`, `toolNames`
- Composes from `functionContexts.ts` (7 function definitions with perspective, missionFraming, successCriteriaGuidance) and `fluencyContexts.ts` (4 levels with scaffoldingDepth, promptGuidance, missionComplexity)

**Curriculum generator** (`lib/learn/curriculumGenerator.ts`):
- Entry: `generateCurriculum(query, options?)` — options include `userFunction`, `userFluency`, `secondaryFunctions`
- Searches content lake → builds adapted system prompt → calls GPT-4o-mini with structured output → post-processes into `LearningPath`
- Stores `adapted_for_function` and `adapted_for_fluency` on cached paths in DB

**Curriculum prompt** (`lib/learn/curriculumPrompt.ts`):
- `CURRICULUM_SYSTEM_PROMPT` — defines task types (watch/do/check/reflect), progressive scaffolding model, module structure
- `CURRICULUM_SCHEMA` — JSON schema for structured output. No skill fields exist yet.

**Evaluator** (`lib/learn/evaluator.ts`):
- `evaluateSubmission({ submission, objective, successCriteria })` → returns `{ score, feedback, strengths, improvements }`
- No skill assessment dimension exists yet

**Learning types** (`lib/types/learning.ts`):
- `LearningPath` — has `topics: string[]`, `difficulty_level`, `items`, `modules`. No skill fields.
- `PathItem` — has `task_type`, `mission`, `check`, `reflection`. No skill tagging.
- `ItemState` — has `evaluation` with `quality` ("nailed_it" | "good" | "needs_iteration"). No skill assessment.
- `CurriculumModule` — has `title`, `description`, `task_count`. No skill metadata.

**Database** (17 migrations, 20260306–20260322):
- `fp_profiles` — has `primary_function`, `secondary_functions` (JSONB), `fluency_level`. No skill columns.
- `fp_learning_paths` — exists in DB (referenced by `fp_generation_status` FK) but CREATE TABLE not in migrations (created earlier or externally). Has `adapted_for_function`, `adapted_for_fluency`.
- `fp_learning_progress` — tracks per-path progress with `item_states` JSONB containing evaluations.
- NO skill tables exist: no `fp_skill_domains`, no `fp_skills`, no `fp_user_skills`, no `fp_skill_tags`.

### What needs to be built

Six phases, each independently useful. Build them in order — each phase depends on the previous one. Phases 1-5 build the skills system into the product. Phase 6 turns the accumulated data into public intelligence that establishes SkillGap as the authority on AI skills.

---

## Phase 1: Skill Taxonomy & Data Model

**Goal:** Define the canonical skill taxonomy in the database and tag every learning path with the skills it develops.

### 1A. Database Tables

Create a single migration file. Provide the SQL to the user to run manually.

**Migration name:** `20260323_create_skill_taxonomy.sql`

```sql
-- ═══════════════════════════════════════════════════════════════
-- Skill Taxonomy Tables
-- ═══════════════════════════════════════════════════════════════

-- Skill Domains: 8 high-level categories of capability
CREATE TABLE fp_skill_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,          -- e.g. 'writing-communication'
  name TEXT NOT NULL,                  -- e.g. 'Writing & Communication'
  description TEXT NOT NULL,           -- 1-2 sentence description
  icon TEXT NOT NULL DEFAULT 'star',   -- lucide-react icon name
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Skills: 40-60 discrete, assessable capabilities within domains
CREATE TABLE fp_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id UUID NOT NULL REFERENCES fp_skill_domains(id),
  slug TEXT UNIQUE NOT NULL,          -- e.g. 'prompt-engineering'
  name TEXT NOT NULL,                  -- e.g. 'Prompt Engineering'
  description TEXT NOT NULL,           -- What this skill is
  -- Which functions this skill is most relevant to (empty = universal)
  relevant_functions TEXT[] DEFAULT '{}',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_skills_domain ON fp_skills(domain_id);
CREATE INDEX idx_skills_slug ON fp_skills(slug);

-- Skill tags on learning paths: which skills a path develops
CREATE TABLE fp_skill_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  path_id UUID NOT NULL,              -- FK to fp_learning_paths(id)
  skill_id UUID NOT NULL REFERENCES fp_skills(id),
  -- How central this skill is to the path
  relevance TEXT NOT NULL DEFAULT 'primary'
    CHECK (relevance IN ('primary', 'secondary')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(path_id, skill_id)
);

CREATE INDEX idx_skill_tags_path ON fp_skill_tags(path_id);
CREATE INDEX idx_skill_tags_skill ON fp_skill_tags(skill_id);

-- RLS
ALTER TABLE fp_skill_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE fp_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE fp_skill_tags ENABLE ROW LEVEL SECURITY;

-- All three are publicly readable (reference data)
CREATE POLICY "skill_domains_read" ON fp_skill_domains
  FOR SELECT USING (true);

CREATE POLICY "skills_read" ON fp_skills
  FOR SELECT USING (true);

CREATE POLICY "skill_tags_read" ON fp_skill_tags
  FOR SELECT USING (true);
```

### 1B. Seed Data

Create a seed file at `supabase/seed_skills.sql` with the initial taxonomy. The 8 domains and ~40 starting skills:

**Domains:**

| slug | name |
|------|------|
| writing-communication | Writing & Communication |
| technical-building | Technical Building |
| data-analysis | Data & Analysis |
| visual-design | Visual & Design |
| strategy-planning | Strategy & Planning |
| workflow-automation | Workflow Automation |
| persuasion-sales | Persuasion & Sales |
| operations-execution | Operations & Execution |

**Skills (starter set — 5-6 per domain):**

*Writing & Communication:*
- `prompt-engineering` — Prompt Engineering
- `ai-assisted-writing` — AI-Assisted Writing
- `content-strategy` — Content Strategy with AI
- `tone-calibration` — Tone & Voice Calibration
- `email-generation` — Email Generation & Outreach

*Technical Building:*
- `ai-code-generation` — AI Code Generation
- `ai-debugging` — AI-Assisted Debugging
- `ai-testing` — AI-Powered Testing
- `full-stack-ai` — Full-Stack AI Development
- `api-integration` — API Integration & Tooling

*Data & Analysis:*
- `data-exploration` — AI Data Exploration
- `data-visualization` — AI-Powered Visualization
- `data-storytelling` — Data Storytelling
- `automated-analysis` — Automated Analysis
- `insight-generation` — Insight Generation

*Visual & Design:*
- `ai-image-direction` — AI Image Direction
- `ui-prototyping` — AI UI Prototyping
- `design-iteration` — Rapid Design Iteration
- `visual-systems` — Visual System Design
- `brand-ai` — Brand Direction with AI

*Strategy & Planning:*
- `research-synthesis` — Research Synthesis
- `scenario-modeling` — Scenario Modeling
- `competitive-analysis` — Competitive Analysis with AI
- `roadmap-generation` — AI Roadmap Generation
- `decision-frameworks` — Decision Framework Building

*Workflow Automation:*
- `process-mapping` — AI Process Mapping
- `no-code-automation` — No-Code AI Automation
- `tool-integration` — Tool Integration & Chaining
- `workflow-optimization` — Workflow Optimization
- `task-automation` — Task Automation

*Persuasion & Sales:*
- `ai-prospecting` — AI-Powered Prospecting
- `proposal-generation` — Proposal Generation
- `pitch-development` — Pitch Development
- `messaging-optimization` — Messaging Optimization
- `account-research` — Account Research with AI

*Operations & Execution:*
- `sop-generation` — SOP & Documentation Generation
- `project-ai` — AI Project Management
- `vendor-evaluation` — Vendor Evaluation with AI
- `process-improvement` — AI Process Improvement
- `operational-reporting` — Operational Reporting

### 1C. TypeScript Types

Create `lib/types/skills.ts`:

```typescript
/** A high-level skill domain (8 total). */
export interface SkillDomain {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  sort_order: number;
}

/** A discrete, assessable skill within a domain. */
export interface Skill {
  id: string;
  domain_id: string;
  slug: string;
  name: string;
  description: string;
  /** Functions this skill is most relevant to (empty = universal) */
  relevant_functions: string[];
  sort_order: number;
}

/** A skill tag on a learning path. */
export interface SkillTag {
  id: string;
  path_id: string;
  skill_id: string;
  relevance: 'primary' | 'secondary';
}

/** Skill with its domain info joined. Used in UI. */
export interface SkillWithDomain extends Skill {
  domain: SkillDomain;
}

/** Fluency level for a specific skill. Same 4 levels as global fluency. */
export type SkillFluency = 'exploring' | 'practicing' | 'proficient' | 'advanced';
```

Export from `lib/types/index.ts` alongside existing type exports.

### 1D. Skill Data Access

Create `lib/skills/taxonomy.ts`:

```typescript
/**
 * Skill taxonomy data access.
 * Loads and caches the canonical skill domains and skills from Supabase.
 */

import { createClient as createAdminClient } from '@/lib/supabase/admin';
import type { SkillDomain, Skill, SkillWithDomain } from '@/lib/types/skills';

let _domains: SkillDomain[] | null = null;
let _skills: Skill[] | null = null;
let _cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/** Load all skill domains, cached. */
export async function getSkillDomains(): Promise<SkillDomain[]> {
  if (_domains && Date.now() - _cacheTime < CACHE_TTL) return _domains;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('fp_skill_domains')
    .select('*')
    .order('sort_order');
  if (error) throw error;
  _domains = data as SkillDomain[];
  _cacheTime = Date.now();
  return _domains;
}

/** Load all skills, cached. */
export async function getSkills(): Promise<Skill[]> {
  if (_skills && Date.now() - _cacheTime < CACHE_TTL) return _skills;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('fp_skills')
    .select('*')
    .order('sort_order');
  if (error) throw error;
  _skills = data as Skill[];
  _cacheTime = Date.now();
  return _skills;
}

/** Get skills with their domain info joined. */
export async function getSkillsWithDomains(): Promise<SkillWithDomain[]> {
  const [domains, skills] = await Promise.all([getSkillDomains(), getSkills()]);
  const domainMap = new Map(domains.map(d => [d.id, d]));
  return skills
    .map(s => ({ ...s, domain: domainMap.get(s.domain_id)! }))
    .filter(s => s.domain); // safety
}

/** Get skills relevant to a specific function. Returns all universal + function-relevant. */
export async function getSkillsForFunction(fn: string): Promise<Skill[]> {
  const skills = await getSkills();
  return skills.filter(
    s => s.relevant_functions.length === 0 || s.relevant_functions.includes(fn)
  );
}

/** Find a skill by slug. */
export async function getSkillBySlug(slug: string): Promise<Skill | null> {
  const skills = await getSkills();
  return skills.find(s => s.slug === slug) ?? null;
}

/** Get skill tags for a learning path. */
export async function getSkillTagsForPath(pathId: string): Promise<SkillWithDomain[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('fp_skill_tags')
    .select('skill_id')
    .eq('path_id', pathId);
  if (error || !data?.length) return [];

  const allSkills = await getSkillsWithDomains();
  const taggedIds = new Set(data.map(t => t.skill_id));
  return allSkills.filter(s => taggedIds.has(s.id));
}

/** Invalidate the cache (call after seeding or updating taxonomy). */
export function invalidateSkillCache(): void {
  _domains = null;
  _skills = null;
  _cacheTime = 0;
}
```

### 1E. Update Curriculum Generator to Tag Skills

This is the integration point. When the curriculum generator creates a path, it should also output which skills the path develops.

**Step 1: Update `CURRICULUM_SCHEMA` in `lib/learn/curriculumPrompt.ts`**

Add a `skills` array to the top-level schema output:

```typescript
// Add to CURRICULUM_SCHEMA.properties:
skills: {
  type: "array" as const,
  items: {
    type: "object" as const,
    properties: {
      skill_slug: { type: "string" as const },
      relevance: {
        type: "string" as const,
        enum: ["primary", "secondary"],
      },
    },
    required: ["skill_slug", "relevance"] as const,
    additionalProperties: false,
  },
},

// Add "skills" to CURRICULUM_SCHEMA.required array
```

**Step 2: Update `CURRICULUM_SYSTEM_PROMPT` in `lib/learn/curriculumPrompt.ts`**

Add a section about skill tagging to the system prompt:

```
SKILL TAGGING:
Every path develops 2-4 specific skills. Tag each path with the skills it develops.
- "primary": The main skill(s) this path is designed to build (1-2 max)
- "secondary": Skills that are practiced but not the main focus (1-2 max)

Available skill slugs: [SKILL_SLUGS_PLACEHOLDER]

Select skills that match what the learner will actually DO in the missions, not just what they'll read about.
```

**Step 3: Update `generateCurriculum()` in `lib/learn/curriculumGenerator.ts`**

Before building the user prompt, load the skill taxonomy and inject available slugs:

```typescript
// After building the adaptation context, before the LLM call:
const { getSkills } = await import('@/lib/skills/taxonomy');
const allSkills = await getSkills();
const skillSlugList = allSkills.map(s => `${s.slug} (${s.name})`).join(', ');

// Replace SKILL_SLUGS_PLACEHOLDER in system prompt with actual slugs
systemPrompt = systemPrompt.replace('[SKILL_SLUGS_PLACEHOLDER]', skillSlugList);
```

After the LLM call succeeds and the path is cached to `fp_learning_paths`, write skill tags:

```typescript
// After the path is inserted into fp_learning_paths:
if (raw.skills && Array.isArray(raw.skills)) {
  const skillRows = [];
  for (const tag of raw.skills) {
    const skill = allSkills.find(s => s.slug === tag.skill_slug);
    if (skill) {
      skillRows.push({
        path_id: pathId,
        skill_id: skill.id,
        relevance: tag.relevance,
      });
    }
  }
  if (skillRows.length > 0) {
    await supabase.from('fp_skill_tags').insert(skillRows);
  }
}
```

**Step 4: Update `LearningPath` type in `lib/types/learning.ts`**

```typescript
// Add to LearningPath interface:
/** Skills this path develops */
skill_tags?: Array<{
  skill_slug: string;
  skill_name: string;
  domain_name: string;
  relevance: 'primary' | 'secondary';
}>;
```

### 1F. Backfill Script

Create `scripts/backfill-skill-tags.ts` — a script that can be run to tag existing learning paths with skills using GPT-4o-mini. It should:

1. Load all paths from `fp_learning_paths` that have no entries in `fp_skill_tags`
2. For each, call GPT-4o-mini with the path title, description, topics, and the full skill slug list
3. Insert the returned tags into `fp_skill_tags`
4. Log progress and handle errors gracefully
5. Process in batches of 10 to respect rate limits

This follows the same pattern as `lib/breaks/scoring.ts` — batch AI evaluation with structured output.

### 1G. API Endpoint

Create `app/api/skills/route.ts`:

```typescript
// GET /api/skills — returns the full taxonomy
// Returns: { domains: SkillDomain[], skills: SkillWithDomain[] }
```

Create `app/api/skills/[slug]/route.ts`:

```typescript
// GET /api/skills/:slug — returns a single skill with its paths
// Returns: { skill: SkillWithDomain, paths: LearningPath[] }
```

### Verification for Phase 1

- [ ] Taxonomy tables exist with seed data
- [ ] `getSkills()` and `getSkillDomains()` return data
- [ ] New paths generated via curriculum generator have skill tags
- [ ] `/api/skills` returns the full taxonomy
- [ ] Backfill script works on existing paths

---

## Phase 2: Skill Receipts on Path Completion

**Goal:** When a user completes a learning path, they see a "skill receipt" — a display of specific skills they demonstrated and at what fluency level.

**Depends on:** Phase 1 (skill taxonomy + tagging)

### 2A. User Skills Table

**Migration name:** `20260324_create_user_skills.sql`

```sql
-- User skill progress — the skill graph data store
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
  -- Average evaluation score across missions for this skill
  avg_score NUMERIC(5,2) DEFAULT NULL,
  -- Timestamps
  first_demonstrated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_demonstrated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, skill_id)
);

CREATE INDEX idx_user_skills_user ON fp_user_skills(user_id);
CREATE INDEX idx_user_skills_skill ON fp_user_skills(skill_id);
CREATE INDEX idx_user_skills_fluency ON fp_user_skills(user_id, fluency_level);

-- RLS: users can read/write their own skill data
ALTER TABLE fp_user_skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_skills_select" ON fp_user_skills
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "user_skills_insert" ON fp_user_skills
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_skills_update" ON fp_user_skills
  FOR UPDATE USING (auth.uid() = user_id);
```

### 2B. Skill Assessment Logic

Create `lib/skills/assessment.ts`:

```typescript
/**
 * Skill assessment — determines skill fluency level from path completion data.
 *
 * Fluency progression rules:
 * - exploring: 0-1 paths completed for this skill
 * - practicing: 2-3 paths completed, avg score >= 50
 * - proficient: 4-5 paths completed, avg score >= 70
 * - advanced: 6+ paths completed, avg score >= 80
 *
 * These thresholds are deliberately low to start. We can tighten them
 * once we have real usage data.
 */

import type { SkillFluency } from '@/lib/types/skills';

interface SkillProgress {
  paths_completed: number;
  missions_completed: number;
  avg_score: number | null;
}

/** Determine fluency level from progress data. */
export function assessFluencyLevel(progress: SkillProgress): SkillFluency {
  const { paths_completed, avg_score } = progress;
  const score = avg_score ?? 0;

  if (paths_completed >= 6 && score >= 80) return 'advanced';
  if (paths_completed >= 4 && score >= 70) return 'proficient';
  if (paths_completed >= 2 && score >= 50) return 'practicing';
  return 'exploring';
}
```

### 2C. Update Path Completion Flow

Find the existing path completion handler (likely in `app/api/learn/progress/route.ts` or similar). When a path is marked as completed:

1. Load the path's skill tags from `fp_skill_tags`
2. For each tagged skill, upsert into `fp_user_skills`:
   - Increment `paths_completed`
   - Recalculate `missions_completed` from the path's do-task evaluations
   - Recalculate `avg_score` from all mission evaluations for this skill
   - Reassess `fluency_level` using `assessFluencyLevel()`
   - Update timestamps
3. Return the skill receipt data alongside the completion response

### 2D. Skill Receipt API

Create `app/api/learn/skill-receipt/[pathId]/route.ts`:

```typescript
// GET /api/learn/skill-receipt/:pathId
// Returns the skill receipt for a completed path.
// Response shape:
// {
//   path: { id, title, completed_at },
//   skills: [
//     {
//       skill: { slug, name, domain_name },
//       before: { fluency_level, paths_completed },
//       after: { fluency_level, paths_completed },
//       missions_in_path: number,
//       avg_score_in_path: number,
//       leveled_up: boolean,
//     }
//   ]
// }
```

### 2E. Skill Receipt UI Component

Create `components/learn/SkillReceipt.tsx`:

- Shows after path completion (below or replacing the current completion message)
- Displays each skill developed with before/after fluency level
- Highlights level-ups with animation
- Shows mission count and average score per skill
- Design: use grayscale base with color only for level-ups (per design system rules)
- Must use `<Card>` from `components/ui/Card`, CSS variables for colors

### Verification for Phase 2

- [ ] `fp_user_skills` table exists
- [ ] Completing a path writes skill progress to `fp_user_skills`
- [ ] Skill receipt endpoint returns correct before/after data
- [ ] Skill receipt UI renders on path completion
- [ ] Multiple path completions correctly accumulate skill progress

---

## Phase 3: Skill Profile Page

**Goal:** Users can see their personal skill profile — a visualization of all skills they've developed, organized by domain, with fluency levels and progress over time.

**Depends on:** Phase 2 (user skills data)

### 3A. Skill Profile API

Create `app/api/skills/profile/route.ts`:

```typescript
// GET /api/skills/profile
// Returns the authenticated user's full skill profile.
// Response shape:
// {
//   domains: [
//     {
//       domain: SkillDomain,
//       skills: [
//         {
//           skill: Skill,
//           fluency_level: SkillFluency,
//           paths_completed: number,
//           missions_completed: number,
//           avg_score: number | null,
//           last_demonstrated_at: string,
//         }
//       ],
//       // Aggregate stats for the domain
//       total_skills_started: number,
//       avg_fluency: number, // numeric representation for visualization
//     }
//   ],
//   summary: {
//     total_skills: number,
//     skills_at_exploring: number,
//     skills_at_practicing: number,
//     skills_at_proficient: number,
//     skills_at_advanced: number,
//   }
// }
```

### 3B. Skill Profile Page

Create the route at `app/(hub)/skills/page.tsx` (consistent with existing hub routes: `app/(hub)/learn/page.tsx`, `app/(hub)/practice/page.tsx`, `app/(hub)/profile/page.tsx`, etc.).

**Layout:**
- Hero section: summary stats (total skills, distribution across fluency levels)
- Domain sections: each domain as a collapsible section with its skills
- Each skill: name, fluency level indicator (4-dot or progress bar), paths completed, last active
- Skills with no progress shown dimmed (these are "undiscovered" skills)
- CTA on undiscovered skills: "Start a path" linking to a search filtered by that skill

**Components to create:**
- `components/skills/SkillProfilePage.tsx` — the page component
- `components/skills/SkillDomainSection.tsx` — a domain with its skills
- `components/skills/SkillFluencyBadge.tsx` — reusable fluency level indicator
- `components/skills/SkillCard.tsx` — individual skill display

**Design rules:**
- Follow existing patterns in `components/learn/LearnPage.tsx` for page structure
- Use `<Card>` for skill cards
- Fluency colors: exploring = neutral, practicing/proficient/advanced = earned colors (check `lib/palette.ts`)
- No hardcoded hex values — use CSS variables

### 3C. Navigation Integration

Add "Skills" to the hub navigation in `components/shell/navItems.tsx`. The nav items are defined in the `NAV_ITEMS` array. Add Skills after Learn:

```typescript
// In NAV_ITEMS array, after the "learn" entry:
{ id: "skills", href: "/skills", label: "Skills", icon: Gem },
```

Import `Gem` (or `Layers`, `Hexagon` — pick the best fit) from `lucide-react`.

### Verification for Phase 3

- [ ] `/api/skills/profile` returns correct data
- [ ] Skills page renders with domain sections
- [ ] Undiscovered skills appear dimmed
- [ ] Fluency badges show correct levels
- [ ] Navigation includes Skills link

---

## Phase 4: Skill-Aware Curriculum Generation

**Goal:** The curriculum generator uses the user's existing skill profile to personalize paths — recommending skills they're weakest in, avoiding re-teaching skills they've mastered, and showing skill adjacencies.

**Depends on:** Phase 3 (skill profile data)

### 4A. Update Adaptation Engine

Modify `lib/learn/adaptationEngine.ts` to accept and use skill context:

```typescript
// New function signature:
export function buildAdaptedPromptContext(
  fn: ProfessionalFunction,
  fluency: FluencyLevel,
  secondaryFunctions?: ProfessionalFunction[],
  userSkills?: Array<{ slug: string; fluency_level: SkillFluency }>,
): AdaptationContext
```

Add a `SKILL CONTEXT` section to the adaptation block:

```
SKILL CONTEXT:
The learner has demonstrated fluency in these skills:
- Prompt Engineering: Practicing
- AI Code Generation: Exploring
- Research Synthesis: Proficient

When designing this path:
- Build on their existing Prompt Engineering skills — don't re-teach basics
- Focus missions on skills they're still developing
- Connect new concepts to skills they already have
```

### 4B. Skill-Based Path Recommendations

Create `lib/skills/recommendations.ts`:

```typescript
/**
 * Recommend learning paths based on a user's skill profile.
 *
 * Strategy:
 * 1. Find skills where user is exploring/practicing — these are growth opportunities
 * 2. Find skills they haven't started that are relevant to their function
 * 3. Rank by: relevance to function > market trend > gap size
 * 4. Return top-N as recommended paths
 */
```

### 4C. Skill Adjacency Data

This is the foundation for the "career bridge" feature described in the strategy. Add a `micro_skills` JSONB column to `fp_skills` that lists the atomic sub-capabilities of each skill. Skills with overlapping micro-skills are "adjacent."

**Migration name:** `20260325_add_skill_micro_skills.sql`

```sql
ALTER TABLE fp_skills ADD COLUMN micro_skills JSONB DEFAULT '[]';

-- Example: prompt-engineering might have micro_skills:
-- ["iterative refinement", "context management", "output formatting",
--  "chain-of-thought", "system prompts", "few-shot examples"]
```

Create `lib/skills/adjacency.ts`:

```typescript
/**
 * Calculate skill adjacency based on micro-skill overlap.
 *
 * Two skills are adjacent if they share >= 30% of their micro-skills.
 * Adjacency percentage = shared_micro_skills / union_micro_skills * 100
 *
 * This powers the "You're 70% of the way to X" feature in the skill graph.
 */
```

### Verification for Phase 4

- [ ] Curriculum generator adapts based on user's existing skills
- [ ] Paths don't re-teach mastered skills
- [ ] Skill recommendations endpoint returns relevant suggestions
- [ ] Adjacency calculation works for skills with overlapping micro-skills

---

## Phase 5: Skills Woven Into Everything

**Goal:** Skills become visible and useful throughout the entire product — on path cards, in browse/search, in onboarding, and in rooms.

**Depends on:** Phases 1-4

### 5A. Skill Tags on Path Cards

Update the learning path card component (find it in `components/learn/`) to show skill tags:

- Show 1-2 primary skill badges on each path card
- Use `SkillFluencyBadge` component from Phase 3
- Clicking a skill badge filters to paths for that skill

### 5B. Browse by Skill

Add a skill-based browsing mode to the Learn page:

- Toggle between "All Paths" and "By Skill" views
- By Skill view: shows skill domains as sections, skills within each, and path counts
- Clicking a skill shows all paths tagged with that skill
- Filter by function still works within skill browse

### 5C. Update Onboarding

After the user selects their function and fluency level, add an optional step:

- "What skills are you most interested in developing?"
- Show skills relevant to their selected function
- Pre-select the most common 2-3 for that function
- Store selections in `fp_profiles` as `priority_skills` JSONB
- Use these to personalize the first path recommendation

### 5D. Skill Context in Rooms

When a user is in a room and the AI host knows their skill profile:

- Reference their skill development in check-ins: "Working on Prompt Engineering today?"
- Connect people in the room who are developing similar skills
- Surface skill-relevant paths during breaks

### 5E. Shareable Skill Profile

Create a public skill profile page at `/profile/[username]/skills`:

- Shows the user's skill graph (domains, skills, fluency levels)
- Links to completed paths as evidence
- Designed for LinkedIn sharing (og:image generation)
- Respects privacy settings (user can toggle public/private)

### Verification for Phase 5

- [ ] Path cards show skill tags
- [ ] Browse-by-skill mode works on Learn page
- [ ] Onboarding captures skill preferences
- [ ] Room AI host references user skills
- [ ] Public skill profile page renders and is shareable

---

## Implementation Notes

### Patterns to Follow

- **AI calls:** Follow `lib/breaks/scoring.ts` for structured output pattern. Always use `gpt-4o-mini`, `response_format: { type: 'json_schema' }`, and include `SAFETY_PROMPT`.
- **Cron jobs:** Follow `app/api/breaks/discover/route.ts` pattern. GET handler, log start/end, add to `vercel.json`.
- **DB operations:** Follow `lib/breaks/shelf.ts` for Supabase patterns. Use admin client from `lib/supabase/admin.ts`.
- **Types:** Put in `lib/types/`, use `interface` for object shapes, `type` for unions. Named exports.
- **Components:** Check `components/ui/` first. Use `<Button>`, `<Card>`, `<MenuItem>`. CSS variables for colors. No hardcoded hex.
- **API routes:** `route.ts` with named exports. Return proper error responses.

### Files That Will Be Modified

| File | Changes |
|------|---------|
| `lib/types/learning.ts` | Add `skill_tags` to `LearningPath` |
| `lib/learn/curriculumPrompt.ts` | Add skills to schema + system prompt |
| `lib/learn/curriculumGenerator.ts` | Load skills, inject into prompt, write tags after caching |
| `lib/learn/adaptationEngine.ts` | Accept + use skill context (Phase 4) |
| `lib/learn/evaluator.ts` | Accept skill context for skill-aware evaluation (Phase 4) |
| `lib/onboarding/types.ts` | No changes in Phase 1-3 |
| `components/shell/navItems.tsx` | Add Skills nav item (Phase 3) |
| `components/learn/LearnPage.tsx` | Add skill tags to path cards, browse-by-skill (Phase 5) |

### New Files to Create

| File | Phase |
|------|-------|
| `lib/types/skills.ts` | 1 |
| `lib/skills/taxonomy.ts` | 1 |
| `lib/skills/assessment.ts` | 2 |
| `lib/skills/recommendations.ts` | 4 |
| `lib/skills/adjacency.ts` | 4 |
| `app/api/skills/route.ts` | 1 |
| `app/api/skills/[slug]/route.ts` | 1 |
| `app/api/skills/profile/route.ts` | 3 |
| `app/api/learn/skill-receipt/[pathId]/route.ts` | 2 |
| `app/(hub)/skills/page.tsx` | 3 |
| `components/skills/SkillProfilePage.tsx` | 3 |
| `components/skills/SkillDomainSection.tsx` | 3 |
| `components/skills/SkillFluencyBadge.tsx` | 3 |
| `components/skills/SkillCard.tsx` | 3 |
| `components/learn/SkillReceipt.tsx` | 2 |
| `scripts/backfill-skill-tags.ts` | 1 |
| `supabase/seed_skills.sql` | 1 |
| `lib/skills/intelligence.ts` | 6 |
| `lib/skills/reportGenerator.ts` | 6 |
| `app/api/skills/intelligence/compute/route.ts` | 6 |
| `app/api/skills/index/route.ts` | 6 |
| `app/api/skills/benchmark/route.ts` | 6 |
| `app/(marketing)/pulse/page.tsx` | 6 |
| `app/(marketing)/taxonomy/page.tsx` | 6 |
| `components/pulse/PulsePage.tsx` | 6 |
| `components/pulse/SkillTrendCard.tsx` | 6 |
| `components/pulse/FunctionFilter.tsx` | 6 |
| `components/pulse/MomentumBadge.tsx` | 6 |

---

## Phase 6: The Authority Engine — Skills Intelligence Layer

**Goal:** Transform SkillGap's internal skill data into public intelligence products that establish SkillGap as the definitive authority on AI skills. This phase turns the platform's behavioral data into the world's most cited source of AI skills intelligence.

**Depends on:** Phases 1-3 minimum (taxonomy + user skills + profile). Phases 4-5 enrich the data but aren't blockers.

**Full strategic context:** Read the "The Authority Play: Becoming the Keeper of AI Skills" section in `STRATEGY_Foundation.md`.

### 6A. Aggregation Pipeline

Build the data aggregation layer that powers all intelligence products. This runs as a cron job that computes anonymized, aggregated skill metrics.

**Migration name:** `20260326_create_skill_intelligence.sql`

```sql
-- Aggregated skill intelligence — powers the Index, Pulse, and Reports
CREATE TABLE fp_skill_intelligence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Time bucket for this snapshot
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  period_type TEXT NOT NULL CHECK (period_type IN ('daily', 'weekly', 'monthly')),
  -- Skill being tracked
  skill_id UUID NOT NULL REFERENCES fp_skills(id),
  -- Aggregated metrics (all anonymized, no PII)
  metrics JSONB NOT NULL DEFAULT '{}',
  -- Computed at
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(period_type, period_start, skill_id)
);

CREATE INDEX idx_skill_intel_period ON fp_skill_intelligence(period_type, period_start);
CREATE INDEX idx_skill_intel_skill ON fp_skill_intelligence(skill_id);

-- Function-level breakdowns
CREATE TABLE fp_skill_intelligence_by_function (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intelligence_id UUID NOT NULL REFERENCES fp_skill_intelligence(id) ON DELETE CASCADE,
  function_slug TEXT NOT NULL,
  metrics JSONB NOT NULL DEFAULT '{}',
  UNIQUE(intelligence_id, function_slug)
);

-- RLS: intelligence data is publicly readable (it's aggregated/anonymized)
ALTER TABLE fp_skill_intelligence ENABLE ROW LEVEL SECURITY;
ALTER TABLE fp_skill_intelligence_by_function ENABLE ROW LEVEL SECURITY;

CREATE POLICY "skill_intel_read" ON fp_skill_intelligence
  FOR SELECT USING (true);

CREATE POLICY "skill_intel_fn_read" ON fp_skill_intelligence_by_function
  FOR SELECT USING (true);
```

**Metrics JSONB shape:**

```typescript
interface SkillIntelligenceMetrics {
  // Activity metrics
  total_learners: number;          // unique users who worked on this skill
  new_learners: number;            // first-time learners in this period
  paths_completed: number;         // paths completed developing this skill
  missions_completed: number;      // do-task completions for this skill

  // Fluency distribution
  fluency_distribution: {
    exploring: number;             // count at each level
    practicing: number;
    proficient: number;
    advanced: number;
  };

  // Performance metrics
  avg_score: number | null;        // average mission evaluation score
  avg_time_to_complete_hours: number | null; // avg hours to complete a path

  // Progression metrics
  level_ups: number;               // users who advanced a fluency level
  avg_paths_to_level_up: number | null; // avg paths needed to advance

  // Trend signals
  growth_rate: number;             // % change vs previous period
  momentum_score: number;          // composite trend indicator (0-100)
}
```

Create `lib/skills/intelligence.ts`:

```typescript
/**
 * Skill intelligence aggregation engine.
 *
 * Computes anonymized, aggregated metrics from fp_user_skills data.
 * Runs as a daily cron job. Requires minimum 10 users per metric
 * to publish (privacy threshold).
 *
 * Pattern: follows lib/breaks/scoring.ts for batch processing.
 */
```

Create cron endpoint `app/api/skills/intelligence/compute/route.ts`:
- GET handler triggered by Vercel Cron (daily at 5am UTC)
- Computes daily, weekly (on Mondays), and monthly (on 1st) snapshots
- Privacy threshold: metrics require minimum 10 distinct users to be included
- Logs computation time and row counts

Add to `vercel.json` cron config.

### 6B. The AI Skills Index API

Create `app/api/skills/index/route.ts`:

```typescript
// GET /api/skills/index
// Public endpoint — no auth required.
// Returns the current AI Skills Index: ranked skills with trend data.
//
// Response shape:
// {
//   as_of: string,                // ISO timestamp
//   period: 'monthly',
//   rankings: [
//     {
//       rank: number,
//       skill: { slug, name, domain_name },
//       momentum_score: number,     // 0-100 composite trend
//       growth_rate: number,        // % change month-over-month
//       total_learners: number,     // anonymized count
//       fluency_distribution: { exploring, practicing, proficient, advanced },
//       // Per-function breakdown
//       by_function: [
//         { function: string, learners: number, avg_fluency: number }
//       ],
//       trend: 'surging' | 'growing' | 'stable' | 'declining',
//     }
//   ],
//   highlights: [
//     // AI-generated editorial insights (2-3 sentences each)
//     { title: string, insight: string, skill_slugs: string[] }
//   ],
// }
```

### 6C. The Skills Pulse Dashboard

Create `app/(marketing)/pulse/page.tsx`:

A public-facing, SEO-indexed page showing real-time skill trends. This is a marketing surface — no auth required.

**Layout:**
- Hero: "The AI Skills Pulse" with current date and total learner count
- Top movers: 5 skills with highest momentum_score, with sparkline trend charts
- Skill grid: all skills organized by domain, each showing momentum + growth
- Function filter: toggle to see skills ranked for a specific professional function
- "Start closing the gap" CTA linking to signup/learn

**Components to create:**
- `components/pulse/PulsePage.tsx`
- `components/pulse/SkillTrendCard.tsx` — skill with momentum indicator + sparkline
- `components/pulse/FunctionFilter.tsx`
- `components/pulse/MomentumBadge.tsx` — surging/growing/stable/declining indicator

**Design:**
- Dark theme with accent colors for trend indicators
- Embeddable: include og:image generation for social sharing
- Mobile-responsive
- Fast: SSR with ISR revalidation (revalidate every hour)

### 6D. The Fluency Benchmark API

Create `app/api/skills/benchmark/route.ts`:

```typescript
// GET /api/skills/benchmark
// Authenticated endpoint — returns the user's benchmark vs market.
//
// Response shape:
// {
//   user_skills: [
//     {
//       skill: { slug, name },
//       user_fluency: SkillFluency,
//       user_percentile: number,       // where they rank vs all users
//       market_avg_fluency: number,    // numeric avg (1-4 scale)
//       function_avg_fluency: number,  // avg for their function
//       gap: 'ahead' | 'on_track' | 'behind',
//       recommended_path_id: string | null,
//     }
//   ],
//   summary: {
//     skills_ahead: number,
//     skills_on_track: number,
//     skills_behind: number,
//     top_gap_skill: string,           // highest-leverage skill to develop
//   }
// }
```

### 6E. The Open Taxonomy Page

Create `app/(marketing)/taxonomy/page.tsx`:

A public, SEO-indexed page documenting the full SkillGap AI Skills Taxonomy. This is the "open standard" surface.

**Content:**
- Every domain with its description
- Every skill with its definition, fluency level rubrics, and relevant functions
- Version number and changelog
- "Adopt this taxonomy" section with API endpoint for programmatic access
- Download as JSON/CSV

### 6F. Report Generation Pipeline

Create `lib/skills/reportGenerator.ts`:

```typescript
/**
 * Generates AI-written editorial insights from skill intelligence data.
 *
 * Uses GPT-4o-mini to produce:
 * - Monthly Index highlights (3-5 insights)
 * - Quarterly deep analysis (executive summary + 10-15 findings)
 *
 * All claims must be backed by specific metrics from the intelligence tables.
 * The AI summarizes data — it does not hallucinate findings.
 *
 * Pattern: follows lib/breaks/scoring.ts for structured output.
 */
```

### New Files for Phase 6

| File | Purpose |
|------|---------|
| `lib/skills/intelligence.ts` | Aggregation engine |
| `app/api/skills/intelligence/compute/route.ts` | Daily cron job |
| `app/api/skills/index/route.ts` | Public AI Skills Index API |
| `app/api/skills/benchmark/route.ts` | Authenticated benchmark API |
| `app/(marketing)/pulse/page.tsx` | Public Pulse Dashboard |
| `app/(marketing)/taxonomy/page.tsx` | Open Taxonomy page |
| `components/pulse/PulsePage.tsx` | Pulse page component |
| `components/pulse/SkillTrendCard.tsx` | Trend card |
| `components/pulse/FunctionFilter.tsx` | Function filter |
| `components/pulse/MomentumBadge.tsx` | Trend badge |
| `lib/skills/reportGenerator.ts` | AI report generation |

### Verification for Phase 6

- [ ] Daily cron computes intelligence snapshots
- [ ] Privacy threshold enforced (min 10 users per metric)
- [ ] `/api/skills/index` returns ranked skills with trends
- [ ] Pulse Dashboard renders and is publicly accessible
- [ ] Benchmark API returns user's position vs market
- [ ] Taxonomy page is SEO-indexed with full skill definitions
- [ ] og:image generation works for social sharing

---

### Order of Operations for Phase 1

1. Create the migration SQL → give to user to run
2. Create seed data SQL → give to user to run
3. Create `lib/types/skills.ts`
4. Create `lib/skills/taxonomy.ts`
5. Update `lib/learn/curriculumPrompt.ts` (schema + system prompt)
6. Update `lib/learn/curriculumGenerator.ts` (load skills, inject, write tags)
7. Update `lib/types/learning.ts` (add `skill_tags` to `LearningPath`)
8. Create `app/api/skills/route.ts`
9. Create `app/api/skills/[slug]/route.ts`
10. Create `scripts/backfill-skill-tags.ts`
11. Test: generate a new path, verify skill tags appear
12. Test: run backfill on existing paths
