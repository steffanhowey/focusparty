# PRD: Function + Fluency Path Adaptation

**Status:** Draft
**Author:** Steffan Howey
**Date:** 2026-03-15
**Depends on:** PRD_Onboarding.md (function + fluency must be collected before paths can adapt)
**Informed by:** Simulated design collaboration with product leaders from Duolingo, Daily, and Skillshare

---

## 1. Problem

The strategy calls the function × fluency model the core personalization axis — "from the same content lake, fundamentally different learning experiences." Today, a marketer and an engineer searching "prompt engineering" get the same path: same tools, same mission framing, same success criteria, same scaffolding depth.

The curriculum generator (`lib/learn/curriculumGenerator.ts`) already produces Watch → Do → Check → Reflect paths with four scaffolding levels and AI evaluation. The tool registry, content lake, and progress tracking all work. What's missing is the connection between the user's profile (captured in onboarding) and the generation engine.

This isn't new infrastructure. It's better instructions to gpt-4o-mini and the plumbing to pass profile data through to generation and evaluation.

---

## 2. Design Principles

1. **Adapt what the user feels, leave what works alone.** The path structure (modules, task types, scaffolding progression) is proven. Adapt the five dimensions that change the user's experience: tool selection, mission framing, success criteria, scaffolding depth, and content selection.

2. **Calibrate, don't constrain.** Function-to-tool mapping is a preference, not a wall. A marketer can still get a Cursor mission if the topic demands it. The 70/30 rule: 70% of missions use the function's primary tools, 30% introduce adjacent tools for cross-functional stretch.

3. **The path should feel authored, not algorithmed.** Over-personalizing makes paths feel incoherent. Each path should read like a curriculum designed by an expert in that function — not a generic template with variables swapped in.

4. **Fluency sets the floor, not the ceiling.** An Exploring user starts with heavy guidance and progresses toward independence within the path. An Advanced user starts independent and reaches solo challenges. The progression still exists — the starting point shifts.

5. **Ship evaluation with generation.** The AI feedback on mission submissions must be function + fluency aware from day one. The evaluation IS the learning. A generic "good job" message undermines the entire adaptation.

---

## 3. What Exists Today

**Curriculum generator** (`lib/learn/curriculumGenerator.ts`, 890 lines):
- Takes: query string, optional `userRole` and `userGoal` (passed as hints to LLM, not structurally used)
- Generates embedding → searches content lake (pgvector) → falls back to YouTube API → calls gpt-4o-mini with JSON schema → post-processes → stores in `fp_learning_paths`
- Outputs: 3-5 module paths with Watch → Do → Check → Reflect tasks
- Scaffolding: `guided` → `scaffolded` → `independent` → `solo` (position-based, not fluency-based)
- Difficulty: single `difficulty_level` field (beginner/intermediate/advanced), not connected to user profile

**Tool registry** (`lib/learn/toolRegistry.ts`):
- 8 tools across 4 categories: coding (Cursor, v0, Replit, Copilot), general (Claude, ChatGPT), design (Midjourney), research (NotebookLM)
- Category exists but no function-to-tool mapping

**Content lake** (`lib/learn/contentLake.ts`):
- Semantic search via pgvector with quality scoring
- Content types: video, article, practice
- Quality scores (0-100), topic tags, creator attribution
- No function-aware filtering

**AI evaluation** (in path progress tracking):
- `ItemState.evaluation` with quality (nailed_it/good/needs_iteration) + feedback + criteria results
- Evaluation prompt does not currently receive function or fluency context

**Profile data** (from onboarding PRD):
- `fp_profiles.primary_function` — engineering, marketing, design, product, data_analytics, sales_revenue, operations
- `fp_profiles.secondary_functions` — array of up to 2 additional functions
- `fp_profiles.fluency_level` — exploring, practicing, proficient, advanced

---

## 4. The Five Adaptation Dimensions

### 4.1 Tool Selection

**What changes:** Missions prefer tools relevant to the user's function. A marketer gets ChatGPT and Claude missions. An engineer gets Cursor and Copilot missions. Cross-functional tools appear as stretch opportunities.

**Implementation:**

Create `lib/learn/functionToolPreferences.ts`:

```typescript
export const FUNCTION_TOOL_PREFERENCES: Record<string, {
  primary: string[];    // Strongly preferred — 70% of missions
  secondary: string[];  // Available for stretch — 30% of missions
}> = {
  engineering:    { primary: ["cursor", "copilot", "claude"], secondary: ["chatgpt", "v0", "replit"] },
  marketing:      { primary: ["chatgpt", "claude", "notebooklm"], secondary: ["midjourney", "v0"] },
  design:         { primary: ["v0", "midjourney", "claude"], secondary: ["cursor", "chatgpt"] },
  product:        { primary: ["claude", "chatgpt", "notebooklm"], secondary: ["v0", "cursor"] },
  data_analytics: { primary: ["claude", "chatgpt", "replit"], secondary: ["cursor", "notebooklm"] },
  sales_revenue:  { primary: ["chatgpt", "claude", "notebooklm"], secondary: ["v0"] },
  operations:     { primary: ["chatgpt", "claude"], secondary: ["replit", "notebooklm", "cursor"] },
};
```

**Fluency modifier:** Exploring users get simpler tools first (ChatGPT before Claude, v0 before Cursor). Advanced users get the full stack with no ordering preference.

**Passed to LLM as:** "This learner's preferred tools are [primary list]. Use these for most missions. You may also use [secondary list] when the learning objective benefits from cross-functional exposure. For this fluency level, prefer simpler tools in early modules."

---

### 4.2 Mission Framing

**What changes:** The same underlying skill gets framed as work the user actually does. Mission objectives, context, steps, and ready-to-paste prompts all use the vocabulary and deliverables of the user's function.

**Implementation:**

Create `lib/learn/functionContexts.ts` — one context block per function (~150-200 words each):

```typescript
export const FUNCTION_CONTEXTS: Record<string, {
  description: string;      // Who this professional is
  deliverables: string[];   // What they produce
  vocabulary: string[];     // Terms to use naturally
  framingExamples: string[]; // 3-4 example mission objectives
}> = {
  engineering: {
    description: "A software engineer who builds and ships products. They think in systems, value clean code, and care about performance, reliability, and developer experience.",
    deliverables: ["working code", "components", "APIs", "tests", "PRs", "technical documentation"],
    vocabulary: ["ship", "refactor", "debug", "scaffold", "deploy", "iterate", "edge case"],
    framingExamples: [
      "Build a React component that [does X] using AI-assisted development",
      "Refactor this function to handle edge cases using AI suggestions",
      "Write integration tests for an API endpoint with AI-generated test cases",
      "Debug a production error using AI-powered error analysis",
    ],
  },
  marketing: {
    description: "A marketing professional who creates campaigns, content, and growth strategies. They think in audiences, channels, and conversion. They care about brand voice, engagement, and measurable outcomes.",
    deliverables: ["campaign briefs", "content calendars", "ad copy", "audience personas", "email sequences", "analytics reports"],
    vocabulary: ["audience", "conversion", "engagement", "brand voice", "campaign", "funnel", "CTA"],
    framingExamples: [
      "Create a content calendar for [audience] using AI to generate topic clusters",
      "Write 5 ad copy variations for a product launch with AI-powered A/B framing",
      "Build an audience persona using AI-assisted research synthesis",
      "Develop an email sequence that adapts messaging per funnel stage",
    ],
  },
  design: {
    description: "A designer who creates visual and interactive experiences. They think in systems, hierarchy, and user flows. They care about craft, consistency, and communicating through visual design.",
    deliverables: ["prototypes", "wireframes", "design systems", "component libraries", "visual concepts", "user flows"],
    vocabulary: ["prototype", "iterate", "visual hierarchy", "design system", "component", "interaction", "layout"],
    framingExamples: [
      "Generate 3 distinct landing page concepts from a single creative brief",
      "Build an interactive prototype using AI-generated components",
      "Create a color palette and type system for a brand using AI exploration",
      "Design a user onboarding flow with AI-assisted wireframing",
    ],
  },
  product: {
    description: "A product manager who defines what gets built and why. They think in user problems, prioritization, and outcomes. They synthesize research, write specs, and align teams.",
    deliverables: ["PRDs", "user stories", "competitive analyses", "roadmaps", "research summaries", "stakeholder presentations"],
    vocabulary: ["user problem", "hypothesis", "prioritize", "spec", "trade-off", "outcome", "stakeholder"],
    framingExamples: [
      "Write a PRD for a new feature using AI to structure requirements",
      "Synthesize 5 user interview transcripts into actionable insights",
      "Generate a competitive analysis comparing 3 products in your space",
      "Draft user stories with acceptance criteria using AI-assisted spec writing",
    ],
  },
  data_analytics: {
    description: "A data professional who turns information into decisions. They think in patterns, statistical significance, and storytelling with data. They care about accuracy, clarity, and actionable insights.",
    deliverables: ["dashboards", "reports", "data models", "visualizations", "insight summaries", "SQL queries"],
    vocabulary: ["query", "visualization", "insight", "trend", "segment", "correlation", "pipeline"],
    framingExamples: [
      "Explore a dataset using natural language querying with AI",
      "Build a dashboard summary that tells a story a non-technical stakeholder can act on",
      "Write SQL queries to answer business questions using AI-assisted generation",
      "Create an automated weekly report with AI-generated insight highlights",
    ],
  },
  sales_revenue: {
    description: "A sales professional who builds relationships and closes deals. They think in pipeline stages, objection handling, and value communication. They care about personalization, speed, and conversion.",
    deliverables: ["outreach emails", "proposals", "competitive intelligence briefs", "call prep notes", "pipeline analyses", "presentation decks"],
    vocabulary: ["prospect", "outreach", "pipeline", "objection", "value prop", "close", "follow-up"],
    framingExamples: [
      "Research a prospect company and generate a personalized outreach email",
      "Build a competitive intelligence brief comparing your product to 2 alternatives",
      "Generate a proposal with pricing options and ROI projections",
      "Create call prep notes synthesizing all available prospect information",
    ],
  },
  operations: {
    description: "An operations professional who makes systems run smoothly. They think in processes, efficiency, and scalability. They care about automation, reliability, and reducing manual work.",
    deliverables: ["process documents", "automation workflows", "vendor evaluations", "SOPs", "efficiency reports", "workflow diagrams"],
    vocabulary: ["workflow", "automate", "SOP", "bottleneck", "optimize", "scale", "handoff"],
    framingExamples: [
      "Map an existing manual process and identify automation opportunities with AI",
      "Build an automated workflow for [recurring task] using AI tools",
      "Create a vendor evaluation matrix using AI-assisted research",
      "Write an SOP that includes AI-powered decision points",
    ],
  },
};
```

**Passed to LLM as:** The function context block is inserted directly into the system prompt. The LLM is instructed: "Frame every mission as work this professional would actually do. Use their vocabulary. Reference their deliverables. The learner should read the mission and think 'this is about my job.'"

---

### 4.3 Success Criteria

**What changes:** Criteria count, complexity, and evaluation tone scale with fluency level.

**Implementation:**

Create `lib/learn/fluencyContexts.ts`:

```typescript
export const FLUENCY_CONTEXTS: Record<string, {
  description: string;
  criteriaGuidance: string;
  evaluationTone: string;
  promptCompleteness: string;
}> = {
  exploring: {
    description: "Brand new to AI tools. Needs encouragement, clear wins, and zero assumptions about prior knowledge.",
    criteriaGuidance: "2-3 simple, binary criteria. Focus on 'did you complete the task?' not 'how well?' Example: 'Generated at least 3 content ideas using the provided prompt.'",
    evaluationTone: "Warm and encouraging. Celebrate what they accomplished. Be specific about what went right. If suggesting improvements, frame as 'next time you could try...' not 'you missed...'",
    promptCompleteness: "Provide complete, ready-to-paste prompts. Include every detail. The user should be able to copy-paste and get a result without modification.",
  },
  practicing: {
    description: "Has tried AI tools a few times but isn't consistent. Needs structure with increasing room for their own choices.",
    criteriaGuidance: "3-4 moderate criteria. Mix completion criteria with one quality criterion. Example: 'Calendar includes 5+ ideas AND each idea has a target audience specified.'",
    evaluationTone: "Supportive but specific. Acknowledge what works, then give one concrete suggestion for improvement. 'Your copy is engaging — to sharpen it, try adding a specific metric or proof point.'",
    promptCompleteness: "Provide partial prompts with blanks for the user to fill in. Include the structure but leave room for personalization. '[Your product] + [target audience] + [key benefit]'",
  },
  proficient: {
    description: "Uses AI regularly and is comfortable with prompting. Wants depth, efficiency, and production-quality output.",
    criteriaGuidance: "4-5 specific criteria including quality and professional standards. Example: 'Output is structured for stakeholder presentation, includes data-backed recommendations, and addresses at least one counterargument.'",
    evaluationTone: "Direct and analytical. Treat as a peer review. 'The structure is solid. The competitive section would be stronger with pricing comparison — that's usually the first question stakeholders ask.'",
    promptCompleteness: "Provide the objective and a prompt skeleton. The user writes their own prompt. 'Write a prompt that accomplishes [objective] — consider what context and constraints to include.'",
  },
  advanced: {
    description: "Built custom workflows, taught others, or integrated AI via APIs. Wants frontiers, edge cases, and challenges that push expertise.",
    criteriaGuidance: "2-3 expert-level criteria focused on originality, efficiency, or teaching value. Example: 'Approach demonstrates a technique not covered in the module content. Output is reusable as a template for the team.'",
    evaluationTone: "Collegial and challenging. 'Interesting approach using chain-of-thought for the competitive analysis. Have you considered structured output with JSON schema? Might give you more consistent results across runs.'",
    promptCompleteness: "Provide the goal only. No prompt, no steps. 'Accomplish [objective]. Choose your own tools and approach.'",
  },
};
```

---

### 4.4 Scaffolding Depth

**What changes:** The guidance level progression within a path shifts based on fluency. Exploring users start guided and end scaffolded. Advanced users start independent and end solo.

**Implementation:**

The scaffolding matrix, passed to the LLM:

```typescript
export const SCAFFOLDING_MATRIX: Record<string, Record<string, GuidanceLevel>> = {
  exploring:  { "1": "guided",      "2": "guided",      "3": "scaffolded",   "4": "scaffolded",   "5": "scaffolded"   },
  practicing: { "1": "guided",      "2": "scaffolded",  "3": "scaffolded",   "4": "independent",  "5": "independent"  },
  proficient: { "1": "scaffolded",  "2": "independent", "3": "independent",  "4": "solo",         "5": "solo"         },
  advanced:   { "1": "independent", "2": "solo",        "3": "solo",         "4": "solo",         "5": "solo"         },
};
```

**What each level means concretely:**

| Level | Prompt provided | Steps | Starter code | Success guidance |
|-------|----------------|-------|--------------|-----------------|
| guided | Complete, ready to paste | Numbered, detailed | Yes, if applicable | Explicit criteria + example output |
| scaffolded | Partial, with blanks | Bullet points, high-level | Template/skeleton | Criteria listed, no example |
| independent | Objective only | Goal description only | None | Criteria listed |
| solo | Challenge statement | None | None | Self-assessment questions |

---

### 4.5 Content Selection

**What changes:** When multiple content items cover the same concept, prefer function-specific ones if available. Timestamp cueing for videos selects segments most relevant to the user's function.

**Implementation:**
- Content search remains function-agnostic (the lake is already quality-curated)
- After search results return, the LLM receives function context and is instructed: "When choosing which content segments to include, prefer segments that demonstrate concepts using [function] examples. If a video has both a general explanation and a [function]-specific demo, use the specific demo."
- This is the lowest-priority adaptation — ships last, can be omitted from Sprint 1

---

## 5. System Prompt Architecture

The generator's system prompt becomes layered:

### Layer 1: Base Context (static, ~800 tokens)
- What SkillGap is, who the learner is, the learning philosophy
- The Watch → Do → Check → Reflect structure
- Output schema requirements
- Content attribution rules
- `SAFETY_PROMPT` from `lib/breaks/contentSafety.ts` (required in all LLM calls per CLAUDE.md)

### Layer 2: Function Context (swapped per function, ~200 tokens)
- Professional description, deliverables, vocabulary
- Tool preferences (primary + secondary)
- 3-4 example mission framings
- Instruction: "Frame every mission as work this professional would actually do"

### Layer 3: Fluency Context (swapped per fluency, ~200 tokens)
- Scaffolding matrix for this level
- Criteria guidance (count, complexity, examples)
- Prompt completeness rules
- Evaluation tone description
- Instruction: "Calibrate challenge and guidance to this level"

### Layer 4: Topic Context (dynamic per request, ~1500 tokens)
- The query
- Available content summaries from the lake
- Available tools from the registry
- Any topic-specific constraints

**Total:** ~2,700 tokens for the system prompt, leaving ample room for content summaries within gpt-4o-mini's context window.

---

## 6. Data Flow

### Generation Flow (updated)

```
User searches "prompt engineering"
  ↓
GET /api/learn/search → check cache for (query, function, fluency)
  ↓ (cache miss)
POST /api/learn/search/generate
  ↓
Fetch user profile → extract primary_function + fluency_level
  ↓
generateCurriculum(query, {
  userFunction: "marketing",
  userFluency: "exploring"
})
  ↓
Content lake search (function-agnostic)
  ↓
Build system prompt: base + functionContexts["marketing"] + fluencyContexts["exploring"]
  ↓
Call gpt-4o-mini with adapted prompt
  ↓
Post-process: validate tool selections, map content IDs, build prompts
  ↓
Store in fp_learning_paths with adapted_for_function + adapted_for_fluency
  ↓
Return to user
```

### Evaluation Flow (updated)

```
User submits mission output (text or screenshot)
  ↓
PATCH /api/learn/paths/[id] with submission data
  ↓
Fetch user profile → extract function + fluency
  ↓
Build evaluation prompt with:
  - SAFETY_PROMPT from lib/breaks/contentSafety.ts (hard requirement per CLAUDE.md)
  - Mission success criteria
  - Function context (evaluate as work from this domain)
  - Fluency context (calibrate expectations and tone)
  ↓
Call gpt-4o-mini → structured evaluation response
  ↓
Store in item_states[item_id].evaluation
  ↓
Return feedback to user
```

---

## 7. Database Changes

### Modified columns on `fp_learning_paths`:

```sql
ALTER TABLE fp_learning_paths
  ADD COLUMN adapted_for_function TEXT,
  ADD COLUMN adapted_for_fluency TEXT;

-- Update cache lookup index
CREATE INDEX idx_paths_cache_adapted
  ON fp_learning_paths(query, adapted_for_function, adapted_for_fluency)
  WHERE is_cached = true;
```

### Updated cache logic:

The existing dedup/cache check in the generate route changes from:
```sql
WHERE query = $1 AND is_cached = true
```
to:
```sql
WHERE query = $1
  AND adapted_for_function = $2
  AND adapted_for_fluency = $3
  AND is_cached = true
```

Unadapted paths (generated before this feature) have `NULL` for both columns and continue to be served to unauthenticated users or users without a function set.

---

## 8. Files to Create / Modify

### New files:
- `lib/learn/functionContexts.ts` — Function context blocks (descriptions, deliverables, vocabulary, framing examples)
- `lib/learn/functionToolPreferences.ts` — Function-to-tool preference mapping
- `lib/learn/fluencyContexts.ts` — Fluency context blocks (scaffolding, criteria, tone, prompt completeness)
- `lib/learn/adaptationEngine.ts` — Composes the adapted system prompt from layers; single entry point for the adaptation logic

### Modified files:
- `lib/learn/curriculumGenerator.ts` — Accept `userFunction` + `userFluency` options; use `adaptationEngine` to build the system prompt; add adapted columns on insert
- `app/api/learn/search/generate/route.ts` — Fetch user profile, pass function + fluency to generator, update cache key
- `app/api/learn/search/route.ts` — Update cache lookup to include function + fluency
- `app/api/learn/paths/[id]/route.ts` — Pass function + fluency to evaluation prompt (PATCH handler)

### Not modified:
- `lib/types.ts` — No type changes needed; `LearningPath` already has optional fields
- `lib/learn/contentLake.ts` — Content search stays function-agnostic
- `lib/learn/toolRegistry.ts` — Tool registry stays as-is; preferences live in the new module
- `app/(learn)/learn/paths/[id]/page.tsx` — UI doesn't change; adaptation is invisible to the frontend

---

## 9. Editorial Picks (Onboarding Integration)

The onboarding PRD requires 28 pre-generated paths (7 functions × 4 fluency levels) for the "Here's where you start" recommendation. These must be generated with the adaptation layer active.

**Process:**
1. Define 7 seed topics — one high-value starting topic per function (e.g., "AI-assisted coding" for engineering, "AI content creation" for marketing)
2. For each topic, generate 4 adapted paths (one per fluency level) using the adaptation engine
3. Store with `is_cached = true` and `source = 'editorial'`
4. Reference in `fp_onboarding_picks` table (from onboarding PRD)

**Seed topics (draft — Steffan to approve):**

| Function | Seed topic |
|----------|-----------|
| Engineering | "AI-assisted coding with Cursor" |
| Marketing | "AI-powered content creation" |
| Design | "Rapid prototyping with AI" |
| Product | "Writing PRDs with AI" |
| Data & Analytics | "AI-powered data exploration" |
| Sales & Revenue | "AI for prospecting and outreach" |
| Operations | "Automating workflows with AI" |

---

## 10. Edge Cases

| Scenario | Handling |
|----------|---------|
| User has no function set (unauthenticated or pre-onboarding) | Generate unadapted path. Serve from unadapted cache. No function/fluency context in system prompt. |
| User changes fluency level | New paths generate at new level. Existing in-progress paths stay unchanged. |
| User has multiple functions | Use primary_function for generation. Secondary functions could influence "recommended next paths" after completion (future enhancement). |
| Content lake has no results for query | Falls back to YouTube API search (existing behavior). Adaptation still applies to mission framing and scaffolding. |
| Generated path has tool not in user's preference list | Allow it — the LLM is instructed to prefer, not require. Log for monitoring. |
| Two users with same query + function + fluency | Serve from cache. Same path is appropriate — the adaptation is at the function/fluency level, not per-individual. |
| Editorial pick topic doesn't generate well for a specific combination | Flag for editorial review. Fall back to the function's most popular path at any fluency level. |

---

## 11. Metrics

### Adaptation effectiveness:

| Metric | How to measure | Target |
|--------|---------------|--------|
| Path completion rate by (function, fluency) | `completion_count / start_count` per adapted path | >25% overall, no combination below 15% |
| Mission evaluation quality distribution | % nailed_it vs good vs needs_iteration per fluency | Exploring: >50% nailed_it. Advanced: even distribution. |
| Time-to-completion vs estimate | `time_invested_seconds / estimated_duration_seconds` | 0.8 - 1.3x (paths feel right-sized) |
| Tool relevance (user feedback) | Post-path survey: "Were the tools in this path relevant to your work?" | >80% yes |
| Cross-function path starts | Users starting paths outside their primary function | >15% of path starts (convergence is working) |

### Cost monitoring:

| Metric | Target |
|--------|--------|
| Unique (query, function, fluency) cache keys | Track growth rate — should plateau as common queries saturate |
| Generation cost per adapted path | Same as unadapted (~$0.02/path with gpt-4o-mini) |
| Cache hit rate | >60% within 30 days of launch |

---

## 12. Implementation Sequence

### Sprint 1: Adaptation Engine + Generator Integration
- Create `functionContexts.ts`, `functionToolPreferences.ts`, `fluencyContexts.ts`
- Create `adaptationEngine.ts` (composes layered system prompt)
- Modify `curriculumGenerator.ts` to accept function + fluency, use adaptation engine
- Add `adapted_for_function` and `adapted_for_fluency` columns to `fp_learning_paths`
- Update cache index

### Sprint 2: API Plumbing + Evaluation
- Modify generate route to fetch user profile and pass function + fluency
- Modify search route to include function + fluency in cache lookup
- Modify path PATCH handler to pass function + fluency to evaluation prompt
- Update evaluation prompt template with fluency-calibrated tone and expectations

### Sprint 3: Editorial Picks + Onboarding Connection
- Define and approve 7 seed topics
- Generate 28 editorial pick paths (7 × 4)
- Populate `fp_onboarding_picks` table
- Wire onboarding Step 3 ("Here's where you start") to serve from editorial picks

### Sprint 4: Measure + Tune
- Instrument all metrics from Section 11
- Run first cohort through adapted paths
- Compare completion rates: adapted vs. unadapted (historical baseline)
- Tune function contexts and fluency calibration based on evaluation distribution
- Adjust tool preferences based on tool relevance feedback

---

## 13. Out of Scope (For Now)

- **Per-individual adaptation** — Adapting based on a specific user's history, not just their function/fluency bucket. Valuable but requires more data. Start with the 28-cell grid.
- **Dynamic fluency adjustment** — Automatically promoting a user from Exploring to Practicing based on path completion patterns. The data model supports it (just update `fluency_level`), but the promotion logic needs its own design.
- **Content lake function tagging** — Tagging content items in the lake with function relevance scores. Would improve Dimension 5 (content selection) but the LLM handles this adequately through prompt instructions.
- **A/B testing adapted vs. unadapted** — Would require serving some users the old experience. Defer to Sprint 4 if metrics look ambiguous.
- **Multi-function path blending** — Generating a single path that explicitly bridges two functions (e.g., "AI for engineers who want to learn marketing"). Complex generation challenge. Defer to v2.

---

## 14. Open Questions

1. **Should unauthenticated users see adapted paths?** Current recommendation: no — they see unadapted paths. Adaptation is a benefit of having a profile. This creates a natural incentive to sign up.

2. **How often should editorial picks be regenerated?** Current recommendation: monthly, or when the content lake has significant new content for a seed topic. Manual trigger, not automated.

3. **Should the path title change per function?** Current recommendation: yes — "Prompt Engineering for Marketers" vs. "Prompt Engineering for Engineers." The title is the first signal that the path is personalized. The LLM generates the title as part of structured output, so this happens naturally.

4. **What about the "I'm not sure" fluency default?** Users who selected "I'm not sure" during onboarding default to Practicing. Should their paths include a soft prompt ("Too easy? Too hard? Adjust your level.") in the first mission? Current recommendation: yes, as a subtle banner on the path page.
