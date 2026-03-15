# PRD: SkillGap.ai Onboarding

**Status:** Draft
**Author:** Steffan Howey
**Date:** 2026-03-15
**Informed by:** Simulated design collaboration with product leaders from Linear, Duolingo, and Skillshare

---

## 1. Problem

Users sign up for SkillGap because they're anxious about falling behind on AI. The current onboarding asks them to set a username and generate an avatar — then drops them into a room with no context. There's no bridge between "I'm scared about AI" and "I know exactly what to do next."

The strategy calls for a two-axis personalization model (professional function × fluency level) that drives everything — path adaptation, room recommendations, mission scaffolding, credential framing. None of this can work until onboarding collects these two inputs.

**The onboarding's job:** Transform anxiety into agency in under 3 minutes, then deliver a first learning win within 40 minutes.

---

## 2. Design Principles

1. **Answer the user's question first.** They came with "What should I learn?" Function and fluency selection aren't data collection — they're how the user tells the product what they need.

2. **Every step feels like progress, not paperwork.** Each interaction visibly changes what the user sees. No step should feel like a form.

3. **Value before identity.** Users see their personalized first path before being asked for a username or avatar. Commitment builds after they see what the product will do for them.

4. **Opinionated defaults over open-ended choices.** Show one recommended path, not a grid. Make a strong choice. Let power users override.

5. **The first session is part of onboarding.** The wizard sets up the guided first session. The guided first session delivers the first win and introduces the social layer. Onboarding ends after the first mission — not when the wizard closes.

---

## 3. What Exists Today

**Current 3-step flow** (in `app/onboard/page.tsx`):
- Step 0: Display name + @username
- Step 1: AI avatar generation
- Step 2: Welcome screen → creates a default room → redirects to `/session`

**What's missing:**
- No function selection (Engineering, Marketing, Design, etc.)
- No fluency assessment (Exploring → Advanced)
- No personalized path recommendation
- No guided first experience after the wizard
- No post-first-path room introduction

**Database:** `fp_profiles` has `onboarding_completed` boolean but no columns for function or fluency. Auth callback already checks this flag and redirects to `/onboard` if false.

---

## 4. New Onboarding Flow

### Overview

The new flow has two phases:

**Phase A — The Wizard** (4 screens, <90 seconds)
1. Function selection → "What kind of work do you do?"
2. Fluency assessment → "Where are you with AI right now?"
3. Path recommendation → "Here's where you start"
4. Username → "Pick a handle" (one field, skippable)

**Phase B — Guided First Experience** (in-product, 30-40 minutes)
5. Path landing with soft guidance
6. First mission completion → celebration moment
7. Post-path → room introduction bridge

The wizard runs between auth callback and the main product. Phase B happens inside the normal product UI with temporary onboarding-specific guidance that fades after the first path.

---

### Step 1: Function Selection

**Screen title:** "What kind of work do you do?"

**Layout:** Clean grid of 7 function cards + 1 multi-select option. Each card has an icon and a label. No descriptions needed — the labels are self-explanatory for professionals.

| Function | Icon concept |
|----------|-------------|
| Engineering | Code brackets `</>` |
| Marketing | Megaphone |
| Design | Pen tool |
| Product | Layers/roadmap |
| Data & Analytics | Chart/graph |
| Sales & Revenue | Handshake |
| Operations | Gear/workflow |
| Multiple / Founder | Grid/mosaic |

**Behavior:**
- Single tap selects primary function → advances to Step 2
- Tapping "Multiple / Founder" opens a multi-select view: "Pick all that apply (up to 3), then star your primary"
- Multi-select requires starring exactly one as primary before advancing
- The primary function drives default recommendations; secondaries expand the pool

**Visual feedback:** When a function is selected, a subtle visual shift confirms the product is adapting. This could be an accent color change, an icon animation, or a brief "personalizing..." transition.

**Data stored:**
- `primary_function`: enum (engineering, marketing, design, product, data_analytics, sales_revenue, operations)
- `secondary_functions`: array of enums (0-2 additional functions)

---

### Step 2: Fluency Assessment

**Screen title:** "Where are you with AI right now?"

**Layout:** Four vertically-stacked cards, each with a level name and a concrete anchor description. The descriptions are mirrors — users should recognize themselves immediately.

| Level | Anchor text |
|-------|------------|
| **Exploring** | "I've heard about AI tools but haven't really used them for work yet." |
| **Practicing** | "I've tried tools like ChatGPT or Copilot a few times, but I'm not consistent." |
| **Proficient** | "I use AI tools regularly in my workflow and I'm comfortable with prompting." |
| **Advanced** | "I've built custom workflows, integrated APIs, or taught others to use AI tools." |

**Behavior:**
- Single tap selects a level → advances to Step 3
- No "Skip" option (this is essential for personalization), but there IS a subtle "I'm not sure" link that defaults to Practicing and shows a note: "No worries — we'll adjust as you go"

**Visual feedback:** After selection, a brief transition that feels like the product calibrating. Not a loading spinner — something purposeful.

**Data stored:**
- `fluency_level`: enum (exploring, practicing, proficient, advanced)

---

### Step 3: Path Recommendation

**Screen title:** "Here's where you start"

**Layout:** One hero path card, prominent. Below it, a compact "Also for you" section with 2-3 additional paths.

**Hero path card contains:**
- Path title (adapted to function, e.g., "AI-Powered Content Creation" for Marketing/Exploring)
- Time estimate (e.g., "35 min")
- Module count (e.g., "4 modules")
- One-line description: "You'll learn to [specific outcome] using [specific tool]"
- Ambient social proof line: "12 others are learning this right now" (synthetic or real count)

**CTAs:**
- **Primary:** "Start learning" → saves onboarding data, completes wizard, navigates to the path page
- **Secondary (text link):** "Browse more paths" → saves onboarding data, completes wizard, navigates to `/learn`

**"Also for you" section:**
- 2-3 compact path cards (title + time only)
- If user selected multiple functions, these should include paths from secondary functions
- Tapping one replaces the hero recommendation

**Path selection logic:**
- Cold start: Editorial picks — 28 hand-curated "best first paths" (7 functions × 4 fluency levels)
- Over time: Algorithm selects path with highest first-path completion rate for that function × fluency combination
- Trending paths get a boost if they match the user's function

**Data stored:**
- `recommended_first_path_id`: UUID (for tracking recommendation → completion rates)

---

### Step 4: Username (Condensed)

**Screen title:** "Pick a handle"

**Layout:** Single input field with `@` prefix. Auto-suggested from display name (captured at signup). Real-time availability check (existing behavior from current onboarding).

**Behavior:**
- Display name is already captured from signup (first_name + last_name) — do NOT re-ask
- Username auto-suggested, editable
- "Skip for now" link available — generates a temporary handle (e.g., `user_[random6]`) that can be changed in settings
- AI avatar generates automatically in the background from username — no separate step

**CTA:** "Let's go" → completes onboarding, navigates to the path selected in Step 3 (or `/learn` if they chose "Browse more paths")

**What happens on completion:**
- `onboarding_completed` set to `true`
- Avatar generation triggered asynchronously (via existing `/api/avatar/generate`)
- User lands on their first path page with Phase B guidance active

---

### Step 5-7: Guided First Experience (Phase B)

Phase B is not a wizard — it's contextual guidance within the normal product UI. It's controlled by a `first_session_state` field that tracks progress through three moments.

#### Moment 1: Path Landing (Step 5)

When the user lands on their first path page:
- A soft highlight or tooltip on the "Start" button: "Your first module takes about 8 minutes"
- The page is the normal path detail page — no special onboarding chrome. The tooltip is the only addition.

#### Moment 2: First Mission Completion (Step 6)

When the user completes their first hands-on mission (submits a practice output):
- A brief, warm celebration. Not confetti — something that matches SkillGap's professional tone.
- Message: "You just [built/created/wrote] your first [artifact] with AI. This is how it starts."
- This is the emotional peak of onboarding. The anxiety-to-agency transformation should feel complete here.

**Data stored:**
- `first_mission_completed_at`: timestamptz

#### Moment 3: Room Bridge (Step 7)

When the user completes their first full path OR returns for their second session (whichever comes first):
- A non-blocking prompt surfaces: "Want to practice with others? [N] people are learning [topic] right now."
- One tap to enter the recommended domain room (based on primary function)
- Dismissable — if they're not ready, it doesn't come back for 3 sessions

**Data stored:**
- `room_bridge_shown_at`: timestamptz
- `room_bridge_dismissed`: boolean

---

## 5. Database Changes

### New columns on `fp_profiles`:

```sql
-- Function + Fluency (core personalization axis)
ALTER TABLE fp_profiles
  ADD COLUMN primary_function TEXT CHECK (primary_function IN (
    'engineering', 'marketing', 'design', 'product',
    'data_analytics', 'sales_revenue', 'operations'
  )),
  ADD COLUMN secondary_functions TEXT[] DEFAULT '{}',
  ADD COLUMN fluency_level TEXT CHECK (fluency_level IN (
    'exploring', 'practicing', 'proficient', 'advanced'
  ));

-- Onboarding tracking
ALTER TABLE fp_profiles
  ADD COLUMN recommended_first_path_id UUID,
  ADD COLUMN first_mission_completed_at TIMESTAMPTZ,
  ADD COLUMN room_bridge_shown_at TIMESTAMPTZ,
  ADD COLUMN room_bridge_dismissed BOOLEAN DEFAULT false;

-- Indexes for personalization queries
CREATE INDEX idx_profiles_primary_function ON fp_profiles(primary_function);
CREATE INDEX idx_profiles_fluency_level ON fp_profiles(fluency_level);
```

### Editorial picks table:

```sql
CREATE TABLE fp_onboarding_picks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  function TEXT NOT NULL,
  fluency_level TEXT NOT NULL,
  path_topic TEXT NOT NULL,
  display_title TEXT NOT NULL,
  display_description TEXT NOT NULL,
  time_estimate_min INTEGER NOT NULL,
  module_count INTEGER NOT NULL,
  tool_names TEXT[] DEFAULT '{}',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(function, fluency_level, sort_order)
);
```

---

## 6. Existing User Migration

Users who completed onboarding before this system exists need a soft re-onboarding prompt.

**Trigger:** On next login after feature ships, if `primary_function IS NULL`.

**Experience:** A modal (not a full-page wizard): "We've added something new. Tell us what you do and we'll personalize everything for you." Shows Steps 1-3 in a condensed modal flow. Dismissable — but resurfaces once per week until completed (max 3 times, then stops).

**Data:** Add `function_prompt_dismissed_count` to track dismissals.

---

## 7. Files to Create / Modify

### New files:
- `app/onboard/steps/FunctionStep.tsx` — Function selection grid
- `app/onboard/steps/FluencyStep.tsx` — Fluency assessment cards
- `app/onboard/steps/PathRecommendationStep.tsx` — First path recommendation
- `app/onboard/steps/UsernameStep.tsx` — Condensed username (refactored from current step 0)
- `lib/onboarding/picks.ts` — Editorial pick fetching and recommendation logic
- `lib/onboarding/types.ts` — Onboarding-specific type definitions
- `components/onboarding/GuidedFirstSession.tsx` — Phase B contextual guidance overlay
- `components/onboarding/FunctionMigrationModal.tsx` — Existing user re-onboarding

### Modified files:
- `app/onboard/page.tsx` — Restructure from 3 steps to 4 new steps
- `app/(auth)/callback/route.ts` — No changes needed (already checks `onboarding_completed`)
- `lib/useProfile.ts` — Add function/fluency fields to Profile interface
- `lib/learn/curriculumGenerator.ts` — Accept function + fluency inputs (separate PR)

### Remove:
- Avatar step from onboarding wizard (move to automatic generation on username save)

---

## 8. Edge Cases

| Scenario | Handling |
|----------|---------|
| User bounces mid-wizard | Store progress per-step. Resume on return. `onboarding_completed` stays false until Step 4 completes. |
| User taps "I'm not sure" on fluency | Default to Practicing. Show "Adjust anytime" banner on first path page. |
| User skips username | Generate temp handle (`user_[random6]`). Show soft prompt in settings after first session. |
| Multi-function user (founder) | Primary function drives hero path recommendation. Secondary functions populate "Also for you" section. Cap at 3 total functions. |
| No editorial pick exists for function × fluency | Fall back to the most popular path for that function at any fluency level. Log the gap for editorial review. |
| User selects "Start learning" but the path doesn't exist yet | Path recommendation step only shows paths that exist in the system. Editorial picks are pre-validated. |
| Existing user with no function data | Soft modal prompt on next login. Dismissable. Resurfaces weekly, max 3 times. |

---

## 9. Metrics

### Primary funnel:

| Step | Metric | Target |
|------|--------|--------|
| Signup → Wizard complete | Onboarding completion rate | >85% |
| Wizard complete → Path start (24h) | First path start rate | >60% |
| Path start → Mission complete | First mission completion rate | >70% |
| Mission complete → Day 7 return | Day 7 retention | >40% |

**Net:** ~14% of signups become active weekly users.

### Secondary:

| Metric | Target | Why it matters |
|--------|--------|---------------|
| Room entry within 14 days | >25% of path completers | Measures solo → social bridge |
| Function distribution | No function >40% of users | Ensures we're not accidentally a dev-only product |
| Fluency accuracy (self-report vs. behavior) | >70% alignment | Validates the anchored self-assessment approach |
| Time to complete wizard | <90 seconds median | Wizard should be fast |
| "I'm not sure" rate on fluency | <15% | If higher, anchor descriptions need rewriting |

### Tracking events:

```
onboarding_step_viewed      { step: 1|2|3|4, function?: string }
onboarding_step_completed   { step: 1|2|3|4, selection: string, duration_ms: number }
onboarding_function_selected { primary: string, secondaries: string[] }
onboarding_fluency_selected  { level: string, used_not_sure: boolean }
onboarding_path_recommended  { path_id: string, path_title: string, position: 'hero'|'also' }
onboarding_path_accepted     { path_id: string, was_hero: boolean }
onboarding_completed         { total_duration_ms: number, steps_completed: number }
first_mission_completed      { path_id: string, minutes_since_onboard: number }
room_bridge_shown            { room_id: string, days_since_onboard: number }
room_bridge_accepted         { room_id: string }
room_bridge_dismissed        { dismissal_count: number }
```

---

## 10. Implementation Sequence

### Sprint 1: Database + Wizard Shell
- Run migration to add columns to `fp_profiles`
- Create `fp_onboarding_picks` table with seed data (28 editorial picks)
- Restructure `app/onboard/page.tsx` to support new 4-step flow
- Build FunctionStep and FluencyStep components

### Sprint 2: Recommendation + Username
- Build PathRecommendationStep with editorial pick fetching
- Build condensed UsernameStep (refactored from current step 0)
- Remove avatar step from wizard, make avatar generation automatic
- Wire up full wizard flow end-to-end

### Sprint 3: Guided First Experience
- Build GuidedFirstSession overlay component
- Implement the three moments (path landing tooltip, mission celebration, room bridge)
- Add tracking events across all steps

### Sprint 4: Existing User Migration
- Build FunctionMigrationModal
- Add login-time check for `primary_function IS NULL`
- Implement dismissal logic and weekly resurface

### Sprint 5: Measure + Iterate
- Verify funnel metrics against targets
- A/B test fluency anchor descriptions
- Tune path recommendation algorithm as completion data accumulates
- Replace editorial picks with data-driven recommendations where data is sufficient

---

## 11. Out of Scope (For Now)

- **Fluency assessment quiz** — Self-placement with anchors is sufficient for v1. A behavioral assessment (e.g., "show me what you know") could replace it in v2 once we have enough data to calibrate.
- **Function inference from behavior** — Detecting function from search/browse patterns. Valuable but complex. Start with explicit selection.
- **Onboarding A/B testing infrastructure** — Use feature flags and event tracking for now. Formal experimentation framework is a platform investment.
- **Team onboarding flow** — When a team admin invites members, the onboarding could pre-fill function based on the invite context. Deferred to the team workspace feature.

---

## 12. Open Questions

1. **Should the wizard be full-page or modal?** Current recommendation: full-page (matches current onboarding pattern, gives each step room to breathe). But a modal could feel lighter for returning users doing migration.

2. **Where does the "Live: N practicing now" indicator first appear?** Current recommendation: it appears in the top nav immediately after wizard completion, but the room bridge CTA doesn't surface until post-first-path. The indicator builds ambient awareness before the explicit push.

3. **Should we offer a "tour" option?** Some products offer a quick product tour. Current recommendation: no — the guided first experience IS the tour, just embedded in real work instead of fake walkthrough screens.

4. **How do we handle the 28 editorial picks?** Current recommendation: seed from strategy doc examples (the path examples in the Learning Path Taxonomy section map cleanly to function × fluency). Steffan curates and approves before shipping.
