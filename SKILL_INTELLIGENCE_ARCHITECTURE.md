# Skill Intelligence Architecture

**The system that makes SkillGap the authority on AI skills.**

---

## The Core Insight

SkillGap already has a mature signal intelligence pipeline:
- 5 sources monitored every 15 minutes (Reddit, HN, RSS, YouTube velocity, internal)
- LLM-powered topic classification (GPT-4o-mini → canonical topic taxonomy)
- Heat scoring with decay (signal count × velocity × source diversity × content availability)
- Heat-driven content discovery (hot topics trigger YouTube search + evaluation)
- Content lake with semantic search (embeddings, quality scores, editorial evaluation)
- Weekly calibration (heat → performance correlation validation)

**Everything currently runs through topics.** Signals classify into topics. Topics get heat scores. Hot topics drive discovery.

**Skills and topics are separate systems.** A signal about "Cursor getting new AI features" classifies to the `cursor` topic, gets heat. But it never reaches the `ai-code-generation` skill, never signals that Technical Building is accelerating, never shows up as market context on a user's skill profile.

**The architecture is one bridge away from being a skills intelligence engine.** We don't rebuild the pipeline. We bridge topics to skills, layer skill-specific aggregation, and add synthesis.

---

## Architecture Overview

```
EXISTING PIPELINE (don't touch):
Sources → fp_signals → Topic Clustering → fp_topic_clusters → Heat Engine → Hot Topics → Discovery

NEW LAYER (build on top):
fp_topic_clusters ──→ fp_topic_skill_map ──→ fp_skill_market_state
                                                      │
fp_user_skills ──→ fp_practitioner_snapshots ──→──────┤
                                                      │
                                              fp_skill_intelligence
                                                      │
                                    ┌─────────────────┼─────────────────┐
                                    ▼                 ▼                 ▼
                              Product Feed    Public Dashboard    Skills Index
```

Three new pipelines, five new tables, zero changes to existing infrastructure.

---

## Layer 1: The Topic-to-Skill Bridge

### Table: `fp_topic_skill_map`

Maps canonical topics to skills. This is the keystone — the bridge that lets topic-level signal intelligence flow to skills.

```sql
CREATE TABLE fp_topic_skill_map (
  topic_slug TEXT NOT NULL REFERENCES fp_topic_taxonomy(slug),
  skill_slug TEXT NOT NULL REFERENCES fp_skills(slug),
  strength NUMERIC(3,2) NOT NULL DEFAULT 0.5
    CHECK (strength >= 0 AND strength <= 1),
  -- How this topic relates to the skill:
  --   direct: the topic IS the skill in practice (e.g., "prompt-engineering" topic → "prompt-engineering" skill)
  --   applied: the topic is a tool/technique that develops the skill (e.g., "cursor" topic → "ai-code-generation" skill)
  --   contextual: the topic provides background relevant to the skill (e.g., "transformers" topic → "prompt-engineering" skill)
  relationship TEXT NOT NULL DEFAULT 'applied'
    CHECK (relationship IN ('direct', 'applied', 'contextual')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (topic_slug, skill_slug)
);

CREATE INDEX idx_topic_skill_map_skill ON fp_topic_skill_map(skill_slug);
```

**Why static, not LLM-derived per signal:**
- Topics are already LLM-classified. Re-classifying every signal against skills is redundant and expensive.
- A static mapping is editorially controllable — you decide that "cursor" maps to "ai-code-generation" with strength 0.9, not the LLM.
- When the taxonomy changes (new skills added, old ones deprecated), you update the mapping once.
- The mapping is small (~200-400 rows for 40 skills × ~100 topics). Easy to maintain.

**Strength semantics:**
- `1.0` — direct mapping (topic IS the skill: `prompt-engineering` → `prompt-engineering`)
- `0.7-0.9` — strong applied mapping (topic is a primary tool for the skill: `cursor` → `ai-code-generation`)
- `0.4-0.6` — moderate mapping (topic develops the skill indirectly: `react` → `ai-code-generation`)
- `0.1-0.3` — weak contextual mapping (topic provides background: `transformers` → `prompt-engineering`)

**Seed data approach:** Generate the initial mapping programmatically using GPT-4o-mini:
- Input: all topic slugs + all skill slugs with descriptions
- Output: structured JSON with (topic, skill, strength, relationship) tuples
- Human review before committing to the table
- Stored as a seed file: `supabase/seed_topic_skill_map.sql`

---

## Layer 2: Skill Market State

### Table: `fp_skill_market_state`

The current state of each skill in the market. Computed daily. This is what the product reads — one row per skill, always current.

```sql
CREATE TABLE fp_skill_market_state (
  skill_slug TEXT PRIMARY KEY REFERENCES fp_skills(slug),

  -- Trend indicators (derived from topic heat)
  trend_direction TEXT NOT NULL DEFAULT 'stable'
    CHECK (trend_direction IN ('rising', 'stable', 'declining', 'emerging')),
  trend_velocity NUMERIC(6,3) NOT NULL DEFAULT 0,
  heat_score NUMERIC(6,3) NOT NULL DEFAULT 0,
  heat_score_7d_ago NUMERIC(6,3) NOT NULL DEFAULT 0,
  heat_score_30d_ago NUMERIC(6,3) NOT NULL DEFAULT 0,

  -- Signal landscape
  signal_count_7d INTEGER NOT NULL DEFAULT 0,
  signal_count_30d INTEGER NOT NULL DEFAULT 0,
  source_diversity INTEGER NOT NULL DEFAULT 0,
  top_signal_sources TEXT[] NOT NULL DEFAULT '{}',

  -- Function spread (which professional functions are engaging with this skill)
  function_spread TEXT[] NOT NULL DEFAULT '{}',

  -- Practitioner data (from fp_user_skills aggregation)
  practitioner_count INTEGER NOT NULL DEFAULT 0,
  practitioner_distribution JSONB NOT NULL DEFAULT '{"exploring":0,"practicing":0,"proficient":0,"advanced":0}',
  new_practitioners_7d INTEGER NOT NULL DEFAULT 0,
  completions_7d INTEGER NOT NULL DEFAULT 0,
  avg_paths_to_practicing NUMERIC(4,1),
  completion_rate NUMERIC(5,2),

  -- Computed scores
  demand_supply_gap NUMERIC(5,2),  -- positive = more demand than supply
  market_percentile INTEGER,        -- 0-100, relative rank among all skills

  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**How `heat_score` is computed for a skill:**

```
skill_heat = Σ (topic_heat × mapping_strength) / Σ mapping_strength
             for all topics mapped to this skill
```

This is a weighted average. A skill mapped to three topics (cursor at 0.9, copilot at 0.7, coding-assistant at 0.5) gets a heat score that reflects all three, weighted by mapping strength.

**How `trend_direction` is determined:**

```
velocity = (heat_score - heat_score_7d_ago) / heat_score_7d_ago

if heat_score_30d_ago == 0 and heat_score > 0.3:
  trend = "emerging"
elif velocity > 0.2:
  trend = "rising"
elif velocity < -0.2:
  trend = "declining"
else:
  trend = "stable"
```

**How `demand_supply_gap` works:**

```
demand_proxy = heat_score × 100    -- normalized to 0-100
supply_proxy = (practitioners at practicing+ / total platform users) × 100
gap = demand_proxy - supply_proxy  -- positive = undersupplied skill
```

A skill with high heat but few practitioners has a large positive gap — that's the most valuable insight we produce. "This skill is in demand but few people have it."

---

### Table: `fp_practitioner_snapshots`

Daily aggregation of user skill data. This creates the time-series that makes trend analysis possible.

```sql
CREATE TABLE fp_practitioner_snapshots (
  snapshot_date DATE NOT NULL,
  skill_slug TEXT NOT NULL REFERENCES fp_skills(slug),

  total_practitioners INTEGER NOT NULL DEFAULT 0,
  distribution JSONB NOT NULL DEFAULT '{"exploring":0,"practicing":0,"proficient":0,"advanced":0}',
  new_starts_7d INTEGER NOT NULL DEFAULT 0,
  completions_7d INTEGER NOT NULL DEFAULT 0,
  level_ups_7d INTEGER NOT NULL DEFAULT 0,
  avg_score NUMERIC(5,2),
  paths_with_skill INTEGER NOT NULL DEFAULT 0,

  PRIMARY KEY (snapshot_date, skill_slug)
);

CREATE INDEX idx_practitioner_snapshots_skill ON fp_practitioner_snapshots(skill_slug, snapshot_date DESC);
```

**Why daily snapshots, not real-time:**
- Practitioner data changes slowly (people complete paths in hours/days, not seconds)
- Snapshots create a time-series for trend analysis without expensive live queries
- 40 skills × 365 days = 14,600 rows/year — trivial storage

---

## Layer 3: Intelligence Synthesis

### Table: `fp_skill_intelligence`

LLM-synthesized insights that combine external signals with practitioner data. This is the editorial intelligence — the POVs that make SkillGap the authority.

```sql
CREATE TABLE fp_skill_intelligence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Scope: skill-specific or cross-cutting
  skill_slug TEXT REFERENCES fp_skills(slug),  -- NULL for cross-cutting insights
  domain_slug TEXT REFERENCES fp_skill_domains(slug),  -- NULL for skill-specific

  -- Insight classification
  insight_type TEXT NOT NULL
    CHECK (insight_type IN (
      'trend_shift',       -- a skill is accelerating or declining
      'emerging_skill',    -- a new skill is appearing in signals
      'convergence',       -- a skill is spreading across functions
      'skill_gap',         -- demand-supply mismatch detected
      'market_signal',     -- external event impacts skill relevance
      'practitioner_insight', -- pattern detected in how people learn
      'weekly_digest'      -- weekly summary across all skills
    )),

  -- Content
  headline TEXT NOT NULL,         -- "Research Synthesis demand surges 180% — practitioners lag behind"
  analysis TEXT NOT NULL,         -- 2-3 paragraph explanation with evidence
  evidence JSONB NOT NULL DEFAULT '[]',  -- array of { source, claim, data_point }

  -- Scoring
  confidence INTEGER NOT NULL CHECK (confidence >= 0 AND confidence <= 100),
  impact_score INTEGER NOT NULL CHECK (impact_score >= 0 AND impact_score <= 100),

  -- Targeting
  function_relevance TEXT[] NOT NULL DEFAULT '{}',

  -- Recommendations
  recommendations JSONB NOT NULL DEFAULT '[]',  -- array of { action, target_audience, priority }

  -- Lifecycle
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'archived')),
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,

  -- Linkback to source data
  source_signals JSONB DEFAULT '[]',  -- signal IDs that contributed
  source_snapshot_date DATE           -- which practitioner snapshot was used
);

CREATE INDEX idx_skill_intelligence_status ON fp_skill_intelligence(status, published_at DESC);
CREATE INDEX idx_skill_intelligence_skill ON fp_skill_intelligence(skill_slug, status);
CREATE INDEX idx_skill_intelligence_type ON fp_skill_intelligence(insight_type, status);
```

**Insight lifecycle:**
1. Generated by weekly synthesis pipeline → status `draft`
2. High-confidence insights (≥80) auto-publish → status `published`
3. Lower-confidence insights queued for editorial review
4. Expired insights → status `archived` (cleanup cron)

---

### Table: `fp_skill_index_entries`

Monthly AI Skills Index publications. The flagship public intelligence product.

```sql
CREATE TABLE fp_skill_index_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period TEXT NOT NULL UNIQUE,  -- '2026-03', '2026-04', etc.

  -- Rankings
  overall_rankings JSONB NOT NULL,  -- array of { skill_slug, rank, heat_score, delta_rank, trend }
  domain_rankings JSONB NOT NULL,   -- { domain_slug: [same structure] }
  function_rankings JSONB NOT NULL, -- { function: [same structure] }

  -- Key findings
  top_insights JSONB NOT NULL,      -- array of { headline, analysis, evidence }
  emerging_skills TEXT[] NOT NULL DEFAULT '{}',
  declining_skills TEXT[] NOT NULL DEFAULT '{}',

  -- Practitioner data
  platform_stats JSONB NOT NULL,    -- { total_practitioners, paths_completed, avg_fluency, ... }
  biggest_gaps JSONB NOT NULL,      -- array of { skill_slug, gap_score, demand, supply }

  -- Meta
  methodology_version TEXT NOT NULL DEFAULT '1.0',
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at TIMESTAMPTZ
);
```

---

## Pipeline 1: Skill Heat Computation (Daily Cron)

**Route:** `app/api/skills/compute-heat/route.ts`
**Schedule:** Daily at 1am UTC (after analytics aggregation at 2am — wait, analytics runs at 2am, so this should be 3am or run before at 1am)
**Actually:** Daily at 3:30am UTC (after analytics aggregate at 2am, before any user-facing refresh)

**Logic:**

```typescript
// lib/skills/skillHeatEngine.ts

/**
 * Compute skill heat scores from topic heat + practitioner data.
 * Runs daily. Pure computation — no LLM calls.
 */
export async function computeSkillHeatScores(): Promise<{ updated: number }> {
  // 1. Load topic-to-skill mappings
  const mappings = await loadTopicSkillMap();

  // 2. Load current topic cluster heat scores
  const topicHeat = await loadTopicClusterHeat();

  // 3. Load previous skill market state (for trend calculation)
  const previousState = await loadSkillMarketState();

  // 4. Load practitioner snapshots (today's, 7d ago, 30d ago)
  const practitionerData = await loadPractitionerData();

  // 5. For each skill: compute heat, trend, gap
  for (const skill of allSkills) {
    const mappedTopics = mappings.get(skill.slug) ?? [];

    // Weighted average of mapped topic heat scores
    let weightedHeatSum = 0;
    let weightSum = 0;
    let signalCount7d = 0;
    let signalCount30d = 0;
    const sources = new Set<string>();

    for (const { topicSlug, strength } of mappedTopics) {
      const topic = topicHeat.get(topicSlug);
      if (!topic) continue;

      weightedHeatSum += topic.heatScore * strength;
      weightSum += strength;
      signalCount7d += topic.signalCount; // approximate
      // Track unique sources
      for (const src of topic.topSignalSources ?? []) sources.add(src);
    }

    const heatScore = weightSum > 0 ? weightedHeatSum / weightSum : 0;

    // Trend calculation
    const prev = previousState.get(skill.slug);
    const heat7dAgo = prev?.heat_score_7d_ago ?? 0;
    const heat30dAgo = prev?.heat_score_30d_ago ?? 0;

    const velocity = heat7dAgo > 0
      ? (heatScore - heat7dAgo) / heat7dAgo
      : heatScore > 0.3 ? 1 : 0;

    let trendDirection: string;
    if (heat30dAgo === 0 && heatScore > 0.3) trendDirection = 'emerging';
    else if (velocity > 0.2) trendDirection = 'rising';
    else if (velocity < -0.2) trendDirection = 'declining';
    else trendDirection = 'stable';

    // Practitioner metrics
    const pData = practitionerData.get(skill.slug);
    const practisingPlus = (pData?.practicing ?? 0) + (pData?.proficient ?? 0) + (pData?.advanced ?? 0);
    const totalPlatformUsers = await getTotalActiveUsers(); // cached
    const supplyProxy = totalPlatformUsers > 0 ? (practisingPlus / totalPlatformUsers) * 100 : 0;
    const demandProxy = heatScore * 100;
    const gap = demandProxy - supplyProxy;

    // Upsert to fp_skill_market_state
    await upsertSkillMarketState(skill.slug, {
      trend_direction: trendDirection,
      trend_velocity: velocity,
      heat_score: heatScore,
      heat_score_7d_ago: prev?.heat_score ?? 0, // today becomes tomorrow's 7d_ago
      heat_score_30d_ago: heat7dAgo,             // rolling window
      signal_count_7d: signalCount7d,
      source_diversity: sources.size,
      practitioner_count: pData?.total ?? 0,
      practitioner_distribution: pData?.distribution ?? {},
      new_practitioners_7d: pData?.newStarts7d ?? 0,
      completions_7d: pData?.completions7d ?? 0,
      demand_supply_gap: gap,
      // market_percentile computed after all skills updated
    });
  }

  // 6. Compute percentiles (rank all skills by heat)
  await computeMarketPercentiles();

  return { updated: allSkills.length };
}
```

**Key design decisions:**
- Runs AFTER topic heat is recalculated (hourly heat engine) and analytics aggregation (2am).
- Uses rolling window for 7d/30d historical heat (not separate snapshots — the previous day's `heat_score` becomes tomorrow's `heat_score_7d_ago` via shift logic).
- Percentiles computed in a second pass after all skills are updated.
- No LLM calls. Pure math. Fast. Deterministic.

---

## Pipeline 2: Practitioner Aggregation (Daily Cron)

**Route:** `app/api/skills/aggregate-practitioners/route.ts`
**Schedule:** Daily at 3am UTC (after analytics, before heat computation)

**Logic:**

```typescript
// lib/skills/practitionerAggregation.ts

/**
 * Snapshot practitioner skill data for trend analysis.
 * One row per skill per day.
 */
export async function aggregatePractitionerData(): Promise<{ skills: number }> {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  // 1. Aggregate fp_user_skills by skill_slug
  //    COUNT(*), GROUP BY fluency_level
  const { data: skillCounts } = await adminClient
    .from('fp_user_skills')
    .select('skill_slug, fluency_level');

  // Group by skill
  const bySkill = new Map<string, Record<string, number>>();
  for (const row of skillCounts ?? []) {
    const dist = bySkill.get(row.skill_slug) ?? { exploring: 0, practicing: 0, proficient: 0, advanced: 0 };
    dist[row.fluency_level] = (dist[row.fluency_level] ?? 0) + 1;
    bySkill.set(row.skill_slug, dist);
  }

  // 2. For each skill: new starts (first receipt in 7d), completions (paths completed in 7d with this skill tag)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // New starts: fp_user_skills where created_at >= 7d ago
  const { data: newStarts } = await adminClient
    .from('fp_user_skills')
    .select('skill_slug')
    .gte('created_at', sevenDaysAgo);

  const startsBySkill = new Map<string, number>();
  for (const row of newStarts ?? []) {
    startsBySkill.set(row.skill_slug, (startsBySkill.get(row.skill_slug) ?? 0) + 1);
  }

  // Completions: fp_learning_progress completed in 7d, joined with fp_skill_tags
  const { data: recentCompletions } = await adminClient
    .from('fp_learning_progress')
    .select('path_id')
    .eq('status', 'completed')
    .gte('completed_at', sevenDaysAgo);

  const completedPathIds = (recentCompletions ?? []).map(r => r.path_id);

  let completionsBySkill = new Map<string, number>();
  if (completedPathIds.length > 0) {
    const { data: skillTags } = await adminClient
      .from('fp_skill_tags')
      .select('skill_slug')
      .in('path_id', completedPathIds);

    for (const row of skillTags ?? []) {
      completionsBySkill.set(row.skill_slug, (completionsBySkill.get(row.skill_slug) ?? 0) + 1);
    }
  }

  // 3. Level-ups: fp_user_skills where updated_at >= 7d ago AND fluency changed
  //    (approximation: count updates in last 7d)
  const { data: recentUpdates } = await adminClient
    .from('fp_user_skills')
    .select('skill_slug')
    .gte('updated_at', sevenDaysAgo)
    .gt('path_count', 1); // at least 2 paths = likely leveled up at some point

  const levelUpsBySkill = new Map<string, number>();
  for (const row of recentUpdates ?? []) {
    levelUpsBySkill.set(row.skill_slug, (levelUpsBySkill.get(row.skill_slug) ?? 0) + 1);
  }

  // 4. Count paths per skill
  const { data: pathCounts } = await adminClient
    .from('fp_skill_tags')
    .select('skill_slug');

  const pathsBySkill = new Map<string, number>();
  for (const row of pathCounts ?? []) {
    pathsBySkill.set(row.skill_slug, (pathsBySkill.get(row.skill_slug) ?? 0) + 1);
  }

  // 5. Write snapshots
  const allSlugs = new Set([...bySkill.keys(), ...startsBySkill.keys()]);

  for (const slug of allSlugs) {
    const dist = bySkill.get(slug) ?? { exploring: 0, practicing: 0, proficient: 0, advanced: 0 };
    const total = Object.values(dist).reduce((a, b) => a + b, 0);

    await adminClient
      .from('fp_practitioner_snapshots')
      .upsert({
        snapshot_date: today,
        skill_slug: slug,
        total_practitioners: total,
        distribution: dist,
        new_starts_7d: startsBySkill.get(slug) ?? 0,
        completions_7d: completionsBySkill.get(slug) ?? 0,
        level_ups_7d: levelUpsBySkill.get(slug) ?? 0,
        paths_with_skill: pathsBySkill.get(slug) ?? 0,
      }, { onConflict: 'snapshot_date,skill_slug' });
  }

  return { skills: allSlugs.size };
}
```

---

## Pipeline 3: Intelligence Synthesis (Weekly Cron)

**Route:** `app/api/skills/synthesize/route.ts`
**Schedule:** Weekly, Monday 6am UTC
**Also supports:** POST for manual trigger (editorial team can force a synthesis run)

This is the crown jewel. It's where raw data becomes editorial intelligence.

**Logic:**

```typescript
// lib/skills/intelligenceSynthesis.ts

/**
 * Synthesize skill intelligence from market state + practitioner data.
 * Produces editorial insights with evidence and recommendations.
 * Uses GPT-4o-mini with structured output.
 */
export async function synthesizeWeeklyIntelligence(): Promise<{
  insights: number;
  autoPublished: number;
}> {
  // 1. Load all skill market states
  const marketStates = await loadAllSkillMarketStates();

  // 2. Load practitioner snapshot time-series (last 30 days)
  const snapshots = await loadPractitionerTimeSeries(30);

  // 3. Load recent signals (last 7 days) with topic-to-skill mapping
  const recentSignals = await loadRecentSkillSignals(7);

  // 4. Load previous week's published insights (to avoid repetition)
  const previousInsights = await loadRecentInsights(7);

  // 5. Compose the synthesis prompt
  const prompt = buildSynthesisPrompt({
    marketStates,
    snapshots,
    recentSignals,
    previousInsights,
  });

  // 6. Call GPT-4o-mini with structured output
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'skill_intelligence',
        strict: true,
        schema: INTELLIGENCE_SCHEMA,
      },
    },
    messages: [
      { role: 'system', content: SYNTHESIS_SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ],
    temperature: 0.7, // some creativity for editorial voice
  });

  const insights = JSON.parse(response.choices[0].message.content);

  // 7. Score and store each insight
  let autoPublished = 0;
  for (const insight of insights.insights) {
    const status = insight.confidence >= 80 ? 'published' : 'draft';
    if (status === 'published') autoPublished++;

    await adminClient
      .from('fp_skill_intelligence')
      .insert({
        skill_slug: insight.skill_slug || null,
        domain_slug: insight.domain_slug || null,
        insight_type: insight.type,
        headline: insight.headline,
        analysis: insight.analysis,
        evidence: insight.evidence,
        confidence: insight.confidence,
        impact_score: insight.impact_score,
        function_relevance: insight.function_relevance,
        recommendations: insight.recommendations,
        status,
        published_at: status === 'published' ? new Date().toISOString() : null,
        expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 2 weeks
        source_snapshot_date: new Date().toISOString().split('T')[0],
      });
  }

  return { insights: insights.insights.length, autoPublished };
}
```

**The Synthesis System Prompt:**

```
You are the editorial intelligence engine for SkillGap.ai, the leading platform for
AI skill development. You analyze signal data from across the AI landscape combined
with practitioner skill development data to produce authoritative insights about
AI skills trends.

Your insights are published to professionals, L&D leaders, and the broader market.
They must be:
- SPECIFIC: cite numbers, percentages, time periods. Never vague.
- EVIDENCE-BASED: every claim backed by data from the provided context.
- ACTIONABLE: every insight includes what professionals should do about it.
- OPINIONATED: take a clear position. "This skill matters because..." not "This skill might matter."
- NOVEL: don't repeat what was said last week. Find the new angle.

You produce 5-10 insights per synthesis run, classified by type:
- trend_shift: a skill's market trajectory is changing direction
- emerging_skill: a capability appearing in signals that may warrant a new skill entry
- convergence: a skill traditionally associated with one function is spreading to others
- skill_gap: significant mismatch between market demand and practitioner supply
- market_signal: an external event (tool launch, report, hiring shift) that impacts skill relevance
- practitioner_insight: a pattern in how professionals are developing skills
- weekly_digest: overall summary of the week's skill landscape
```

**The Structured Output Schema:**

```typescript
const INTELLIGENCE_SCHEMA = {
  type: 'object',
  properties: {
    insights: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          skill_slug: { type: ['string', 'null'] },
          domain_slug: { type: ['string', 'null'] },
          type: {
            type: 'string',
            enum: ['trend_shift', 'emerging_skill', 'convergence', 'skill_gap',
                   'market_signal', 'practitioner_insight', 'weekly_digest']
          },
          headline: { type: 'string' },
          analysis: { type: 'string' },
          evidence: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                source: { type: 'string' },
                claim: { type: 'string' },
                data_point: { type: 'string' },
              },
              required: ['source', 'claim', 'data_point'],
              additionalProperties: false,
            }
          },
          confidence: { type: 'integer' },
          impact_score: { type: 'integer' },
          function_relevance: { type: 'array', items: { type: 'string' } },
          recommendations: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                action: { type: 'string' },
                target_audience: { type: 'string' },
                priority: { type: 'string', enum: ['high', 'medium', 'low'] },
              },
              required: ['action', 'target_audience', 'priority'],
              additionalProperties: false,
            }
          },
        },
        required: ['type', 'headline', 'analysis', 'evidence', 'confidence',
                   'impact_score', 'function_relevance', 'recommendations'],
        additionalProperties: false,
      }
    }
  },
  required: ['insights'],
  additionalProperties: false,
};
```

---

## Pipeline 4: Monthly Skills Index (Monthly Cron)

**Route:** `app/api/skills/publish-index/route.ts`
**Schedule:** First Monday of each month at 7am UTC
**Also supports:** POST for manual trigger

**Logic:**

1. Load all `fp_skill_market_state` rows
2. Load previous month's index entry (for delta calculation)
3. Load `fp_practitioner_snapshots` for the month (30 daily snapshots)
4. Load published `fp_skill_intelligence` from the month
5. Rank all skills by composite score: `heat × 0.4 + velocity × 0.3 + gap × 0.3`
6. Generate per-domain and per-function rankings
7. Call GPT-4o-mini to produce narrative analysis of the month's key findings
8. Write to `fp_skill_index_entries`

**Output format:** Designed for public consumption. The index entry is a self-contained document that can be rendered as a webpage, exported as PDF, or fed to an API.

---

## Product Feed: How Intelligence Reaches Users

The intelligence layer doesn't just produce reports. It actively shapes the product experience through four integration points.

### Feed Point 1: Skill Profile Market Context

**Where:** SkillProfilePage (`components/skills/SkillProfilePage.tsx`)
**Data source:** `fp_skill_market_state`

Each skill on the user's profile shows market context:

```
Prompt Engineering  [Practicing]  ▲ Rising
"Demand up 40% this quarter. You're in the top 35% of practitioners."
```

**Implementation:**
- New API endpoint: `GET /api/skills/market-state` — returns all skill market states (cached 1 hour)
- SkillCard component gets optional `marketState` prop
- Trend indicator: ▲ Rising (green), ● Stable (gray), ▼ Declining (amber), ✦ Emerging (cyan)
- Percentile shown only if user has the skill at Practicing+

### Feed Point 2: Intelligence-Weighted Recommendations

**Where:** SkillRecommendations (`components/learn/SkillRecommendations.tsx`)
**Data source:** `fp_skill_market_state` → `recommendations.ts`

The existing recommendation engine (Phase 4) has three strategies: level_up, function_gap, domain_expansion. Add a fourth:

```typescript
// New strategy: market_demand
// Priority boost for skills with rising heat and high demand-supply gap
if (marketState.trend_direction === 'rising' && marketState.demand_supply_gap > 20) {
  priority += 15; // boost in recommendation ranking
  reason = 'market_demand';
  reason_text = `${skill.name} demand is surging — ${marketState.practitioner_count} practitioners and growing`;
}
```

New reason badge: `TrendingUp` icon, gold color, label "In demand"

### Feed Point 3: Learn Page Trending Section

**Where:** LearnPage discovery mode (`components/learn/LearnPage.tsx`)
**Data source:** `fp_skill_market_state` where `trend_direction = 'rising'`

A new section in discovery mode (above or alongside SkillRecommendations):

```
TRENDING SKILLS THIS WEEK
[Research Synthesis ▲] [Workflow Automation ▲] [AI Code Generation ▲]
```

Clicking a trending skill pill sets the skillFilter (Intervention 5 from Phase 5), filtering the grid to paths tagged with that skill.

**Implementation:**
- New hook: `useSkillTrends()` — fetches `GET /api/skills/market-state?trending=true`
- Returns skills sorted by `trend_velocity DESC` where `trend_direction IN ('rising', 'emerging')`
- Max 5 pills. Horizontal scrollable on mobile.

### Feed Point 4: Weekly Intelligence Digest

**Where:** New component in Learn page or Progress dashboard
**Data source:** `fp_skill_intelligence` where `status = 'published'` and `insight_type = 'weekly_digest'`

A weekly insight card that appears in the user's experience:

```
┌─ THIS WEEK IN AI SKILLS ────────────────────────────┐
│                                                      │
│  Research Synthesis demand surges 180%               │
│                                                      │
│  "Job postings requiring AI research capabilities    │
│   grew 180% YoY. Only 12% of practitioners on       │
│   SkillGap have demonstrated Practicing-level        │
│   fluency. This is the largest gap we've tracked."   │
│                                                      │
│  [Start a Research Synthesis path →]                 │
│                                                      │
└──────────────────────────────────────────────────────┘
```

**Implementation:**
- New API: `GET /api/skills/intelligence/latest?type=weekly_digest&limit=1`
- New component: `components/learn/WeeklyInsight.tsx`
- Shows in discovery mode, below trending pills, above path grid
- Dismissable per session (localStorage)
- Links to a relevant learning path for the highlighted skill

---

## Public Intelligence Products

### Product 1: Skills Pulse Dashboard

**Route:** `app/(public)/pulse/page.tsx` (public, no auth required)
**Data source:** `fp_skill_market_state`, `fp_practitioner_snapshots`, `fp_skill_intelligence`

A real-time, public-facing dashboard. The Bloomberg Terminal of AI skills.

**Sections:**
1. **Skill Rankings** — All skills ranked by heat score with trend indicators
2. **Trending Now** — Skills with highest velocity this week
3. **Biggest Gaps** — Skills where demand far exceeds practitioner supply
4. **Function Heatmap** — Grid of skills × functions showing where activity concentrates
5. **Recent Insights** — Published intelligence items
6. **Practitioner Growth** — Total practitioners, weekly growth, fluency distribution

**SEO value:** Public pages indexed by Google. "AI skills trends" → SkillGap Pulse. Every skill name + "trend" becomes a long-tail keyword.

### Product 2: Monthly AI Skills Index

**Route:** `app/(public)/index/[period]/page.tsx`
**Data source:** `fp_skill_index_entries`

Monthly publication page. Designed for sharing and citation.

**Sections:**
1. **Overall Rankings** — Top 20 skills by composite score, with delta from previous month
2. **Key Findings** — 3-5 headline insights with evidence
3. **Domain Deep-Dives** — Per-domain rankings and analysis
4. **Emerging Skills** — New entries to the taxonomy
5. **Methodology** — How we measure (transparency builds trust)

**OG image:** Auto-generated card showing "AI Skills Index — March 2026" with top 5 skills. Designed for LinkedIn sharing.

### Product 3: Skill Detail Pages

**Route:** `app/(public)/skills/[slug]/page.tsx`
**Data source:** `fp_skills`, `fp_skill_market_state`, `fp_practitioner_snapshots`, `fp_skill_intelligence`

Deep pages per skill. This is the "16Personalities depth" applied to skills.

**Sections:**
1. **Overview** — What this skill is, why it matters now
2. **Market State** — Trend direction, heat score, demand-supply gap
3. **Fluency Levels** — What each level (Exploring → Advanced) actually looks like in practice
4. **Practitioner Data** — How many people are developing this skill, fluency distribution
5. **Related Skills** — Adjacencies (skills that overlap in micro-skills)
6. **Learning Paths** — Top-rated paths that develop this skill
7. **Recent Intelligence** — Published insights about this skill
8. **30-Day Trend** — Heat score time series chart

**SEO value:** "Prompt Engineering skill" → SkillGap skill page. Every skill name becomes an indexed authority page.

---

## Cron Schedule (Updated)

| Job | Route | Schedule | Pipeline |
|-----|-------|----------|----------|
| Signal Collection | `/api/signals/collect` | Every 15 min | Existing |
| Topic Clustering | `/api/topics/cluster` | Hourly | Existing |
| Content Discovery | `/api/pipeline/run` | Every 3h | Existing |
| Hot Topic Discovery | `/api/breaks/discover-hot` | Every 2h | Existing |
| Analytics Aggregate | `/api/analytics/aggregate` | Daily 2am | Existing |
| **Practitioner Aggregation** | `/api/skills/aggregate-practitioners` | **Daily 3am** | **NEW** |
| **Skill Heat Computation** | `/api/skills/compute-heat` | **Daily 3:30am** | **NEW** |
| **Intelligence Synthesis** | `/api/skills/synthesize` | **Weekly Mon 6am** | **NEW** |
| **Skills Index Publish** | `/api/skills/publish-index` | **Monthly 1st Mon 7am** | **NEW** |
| **Intelligence Cleanup** | `/api/skills/cleanup` | **Weekly Sun 4am** | **NEW** |

**Execution order matters:** Analytics (2am) → Practitioner Aggregation (3am) → Skill Heat (3:30am). Each pipeline depends on the previous one's output.

---

## Data Flow Summary

```
Every 15 min:  Sources → fp_signals
Every hour:    fp_signals → fp_topic_clusters (LLM classification + heat)
Daily 3am:     fp_user_skills → fp_practitioner_snapshots
Daily 3:30am:  fp_topic_clusters + fp_topic_skill_map + fp_practitioner_snapshots → fp_skill_market_state
Weekly Mon:    fp_skill_market_state + fp_practitioner_snapshots + fp_signals → fp_skill_intelligence
Monthly 1st:   fp_skill_market_state + fp_skill_intelligence + fp_practitioner_snapshots → fp_skill_index_entries

Product feeds (read on demand):
  Skill Profile → fp_skill_market_state
  Recommendations → fp_skill_market_state
  Learn Page → fp_skill_market_state (trending), fp_skill_intelligence (digest)
  Public Pulse → fp_skill_market_state + fp_practitioner_snapshots + fp_skill_intelligence
  Public Index → fp_skill_index_entries
  Public Skill Pages → fp_skills + fp_skill_market_state + fp_skill_intelligence
```

---

## Implementation Order

### Phase 6A: Data Foundation (Week 1)
1. Migration: create `fp_topic_skill_map`, `fp_skill_market_state`, `fp_practitioner_snapshots`, `fp_skill_intelligence`, `fp_skill_index_entries`
2. Seed script: generate initial `fp_topic_skill_map` entries (GPT-4o-mini + human review)
3. Type definitions in `lib/types/skillIntelligence.ts`

### Phase 6B: Daily Pipelines (Week 1-2)
4. `lib/skills/practitionerAggregation.ts` + cron route
5. `lib/skills/skillHeatEngine.ts` + cron route
6. Verify: run both pipelines manually, check data in tables

### Phase 6C: Product Feed (Week 2)
7. `GET /api/skills/market-state` endpoint (cached)
8. Market context on SkillProfilePage (trend indicator + percentile)
9. `market_demand` strategy in recommendations engine
10. Trending skills pills on Learn page
11. `useSkillTrends` hook

### Phase 6D: Intelligence Synthesis (Week 3)
12. `lib/skills/intelligenceSynthesis.ts` + structured output schema
13. Weekly synthesis cron route
14. `GET /api/skills/intelligence/latest` endpoint
15. WeeklyInsight component on Learn page

### Phase 6E: Public Products (Week 3-4)
16. Skills Pulse Dashboard page (public)
17. Monthly Skills Index page (public)
18. Skill Detail pages (public)
19. OG image generation for sharing
20. SEO optimization (meta tags, structured data)

### Phase 6F: Monthly Index Pipeline (Week 4)
21. `lib/skills/indexPublisher.ts`
22. Monthly cron route
23. Archive + cleanup cron

---

## New Files Summary

| File | Purpose |
|------|---------|
| `lib/types/skillIntelligence.ts` | Types for market state, intelligence, index |
| `lib/skills/topicSkillMap.ts` | Load and query topic-to-skill mappings |
| `lib/skills/skillHeatEngine.ts` | Compute skill heat from topic heat + practitioner data |
| `lib/skills/practitionerAggregation.ts` | Daily snapshot of practitioner skill data |
| `lib/skills/intelligenceSynthesis.ts` | Weekly LLM synthesis of skill intelligence |
| `lib/skills/indexPublisher.ts` | Monthly Skills Index generation |
| `app/api/skills/compute-heat/route.ts` | Daily heat computation cron |
| `app/api/skills/aggregate-practitioners/route.ts` | Daily practitioner snapshot cron |
| `app/api/skills/synthesize/route.ts` | Weekly intelligence synthesis cron |
| `app/api/skills/publish-index/route.ts` | Monthly index publication cron |
| `app/api/skills/cleanup/route.ts` | Weekly expired insight cleanup |
| `app/api/skills/market-state/route.ts` | GET endpoint for product feed |
| `app/api/skills/intelligence/latest/route.ts` | GET latest published insights |
| `components/learn/WeeklyInsight.tsx` | Weekly intelligence digest card |
| `components/learn/TrendingSkills.tsx` | Trending skills pills for Learn page |
| `app/(public)/pulse/page.tsx` | Public Skills Pulse Dashboard |
| `app/(public)/index/[period]/page.tsx` | Public Monthly Skills Index |
| `app/(public)/skills/[slug]/page.tsx` | Public Skill Detail pages |
| `supabase/seed_topic_skill_map.sql` | Initial topic-to-skill mapping seed |

**19 new files, ~5 modified files (SkillProfilePage, recommendations.ts, LearnPage, vercel.json, types).**

---

## What Makes This Iron-Clad

1. **Zero changes to existing infrastructure.** The signal pipeline, topic clustering, heat engine, content discovery — all untouched. We layer on top.

2. **The bridge is elegant.** One table (`fp_topic_skill_map`) connects the entire topic-signal world to the skill world. Every signal that classified into a topic automatically contributes to skill intelligence.

3. **Practitioner data is the moat.** No one else has verified, fluency-graded skill development data at scale. The practitioner snapshots create a time-series that compounds in value every day.

4. **The synthesis produces things no one else can.** "Research Synthesis demand surged 180% this quarter while only 12% of practitioners have reached Practicing level" — that insight requires both external signal data AND internal practitioner data. Only SkillGap has both.

5. **Public products drive acquisition.** The Pulse Dashboard and Skill Detail pages are SEO-indexed authority pages. Every skill name becomes a keyword. Every monthly index becomes citable. The intelligence IS the marketing.

6. **The product gets smarter automatically.** Market state feeds recommendations, trending pills, profile context, and weekly digests. Users experience a product that knows what's happening in AI skills — not because an editor curated it, but because the intelligence engine is always running.
