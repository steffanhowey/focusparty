# Onboarding + Personalization — Engineering Prompt

## Context

The Learn experience is live with semantic search, AI-generated learning paths, and progress tracking. The onboarding flow exists (`app/onboard/page.tsx`, 419 lines) as a 3-step wizard: identity (display name + username) → avatar → welcome. User profiles live in `fp_profiles` with `onboarding_completed` flag. Taste profiles (`lib/breaks/tasteProfile.ts`, 302 lines) track per-user per-topic weights from break engagement.

This prompt adds **two new onboarding steps** that capture the user's role and learning goals, then wires that data through the entire experience — Learn search, path generation, Room recommendations, AI host/tutor, and the Learn home screen — so the product feels tailored from first login.

Read `CLAUDE.md` for project conventions. Then read these files before writing any code:

- `app/onboard/page.tsx` (419 lines) — existing onboarding wizard
- `lib/useProfile.ts` (88 lines) — Profile interface at line 7, `useProfile()` hook
- `lib/supabase/middleware.ts` (101 lines) — onboarding redirect logic at line 55
- `lib/breaks/tasteProfile.ts` (302 lines) — taste weight system, `updateTasteProfile()` at line 63, `personalizeContentOrder()` at line 281
- `lib/learn/pathGenerator.ts` (347 lines) — `generateLearningPath()` at line 52, system prompt
- `app/api/learn/paths/route.ts` (202 lines) — POST handler generates paths
- `app/api/learn/search/route.ts` (62 lines) — GET semantic search
- `components/learn/LearnPage.tsx` (182 lines) — Learn home page with search
- `lib/types.ts` (783 lines) — `Profile` interface at around line 21, `LearningPath` at line 718
- `lib/hostPrompt.ts` (117 lines) — AI host message generation

---

## Step 1: Extend the Profile Schema

Add new columns to `fp_profiles`. Provide this SQL for the user to run manually in Supabase (do NOT use Supabase MCP):

```sql
ALTER TABLE fp_profiles
  ADD COLUMN IF NOT EXISTS current_role TEXT,
  ADD COLUMN IF NOT EXISTS target_goal TEXT,
  ADD COLUMN IF NOT EXISTS experience_level TEXT DEFAULT 'intermediate',
  ADD COLUMN IF NOT EXISTS learning_topics TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS onboarding_version INTEGER DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_profiles_role ON fp_profiles (current_role);
```

Column definitions:
- `current_role` — what the user does today. One of a predefined list (see Step 2).
- `target_goal` — what they want to achieve. Free text, 1 sentence. Examples: "Transition into AI engineering", "Build AI features into my SaaS product", "Stay current on AI developments".
- `experience_level` — self-assessed: `'beginner'` | `'intermediate'` | `'advanced'`. Defaults to intermediate.
- `learning_topics` — 2-4 topic slugs from canonical taxonomy, selected during onboarding.
- `onboarding_version` — tracks which version of onboarding this user completed (so we can prompt existing users to fill in new fields later). Set to `2` for users who complete the new onboarding.

---

## Step 2: Add Onboarding Steps

Modify `app/onboard/page.tsx` to add two new steps BETWEEN the current identity step (Step 0) and avatar step (Step 1). The new flow becomes:

**Step 0: Identity** (existing — display name + username)
**Step 1: Role & Goal** (NEW)
**Step 2: Learning Topics** (NEW)
**Step 3: Avatar** (existing — AI avatar generation)
**Step 4: Welcome** (existing — only for new users)

### Step 1: Role & Goal

**Layout:** A clean card with two inputs.

**"What's your current role?"** — A grid of role options, each as a selectable card/pill. When selected, it highlights. Options:

```typescript
const ROLE_OPTIONS = [
  { value: 'software-engineer', label: 'Software Engineer', icon: Code },
  { value: 'product-manager', label: 'Product Manager', icon: Lightbulb },
  { value: 'data-scientist', label: 'Data / ML Engineer', icon: BarChart3 },
  { value: 'designer', label: 'Designer', icon: Palette },
  { value: 'founder', label: 'Founder / Entrepreneur', icon: Rocket },
  { value: 'student', label: 'Student', icon: GraduationCap },
  { value: 'career-changer', label: 'Changing Careers', icon: ArrowRightLeft },
  { value: 'other', label: 'Other', icon: User },
] as const;
```

Use icons from `lucide-react`. Single-select. Required to proceed.

**"What do you want to achieve?"** — A text input with placeholder: "e.g. Learn to build AI-powered apps, transition into ML engineering, stay current on AI trends". Max 200 characters. Optional but encouraged — show a subtle hint: "This helps us personalize your experience."

**"How would you describe your AI/tech experience?"** — Three large selectable cards, horizontal:
- **Beginner** — "I'm just getting started"
- **Intermediate** — "I have some experience"
- **Advanced** — "I'm looking to go deeper"

Default: Intermediate (pre-selected). Single-select.

**Continue button** at the bottom. Disabled until role is selected.

### Step 2: Learning Topics

**Layout:** A card with a grid of topic pills.

**"What do you want to learn first?"** — Show 12-16 topic pills, personalized based on the role they just selected. The user picks 2-4 (enforce min 2, max 4 with a counter: "Pick 2-4 topics").

**Topic pills per role:**

Generate the pill options based on role. Each role gets a curated list that mixes role-specific topics with universally popular ones:

```typescript
const TOPIC_SUGGESTIONS: Record<string, string[]> = {
  'software-engineer': [
    'ai-agents', 'rag', 'prompt-engineering', 'llm-apis',
    'fine-tuning', 'ai-coding-tools', 'vector-databases',
    'ml-ops', 'ai-security', 'open-source-models',
    'web-development', 'system-design'
  ],
  'product-manager': [
    'ai-product-strategy', 'prompt-engineering', 'ai-agents',
    'ai-ux-design', 'llm-apis', 'ai-ethics',
    'product-analytics', 'ai-for-non-engineers',
    'startup-strategy', 'user-research', 'rag', 'ai-tools'
  ],
  'data-scientist': [
    'fine-tuning', 'rag', 'ml-ops', 'vector-databases',
    'llm-evaluation', 'open-source-models', 'ai-agents',
    'prompt-engineering', 'data-engineering',
    'deep-learning', 'nlp', 'computer-vision'
  ],
  'designer': [
    'ai-ux-design', 'ai-tools', 'prompt-engineering',
    'ai-image-generation', 'ai-product-strategy',
    'creative-ai', 'prototyping', 'design-systems',
    'ai-for-non-engineers', 'ai-ethics', 'rag', 'ai-agents'
  ],
  'founder': [
    'ai-product-strategy', 'ai-agents', 'startup-strategy',
    'rag', 'llm-apis', 'prompt-engineering',
    'ai-coding-tools', 'fundraising', 'growth',
    'ai-tools', 'open-source-models', 'ai-security'
  ],
  'student': [
    'prompt-engineering', 'ai-agents', 'rag',
    'python', 'llm-apis', 'ai-coding-tools',
    'deep-learning', 'open-source-models', 'career-development',
    'fine-tuning', 'web-development', 'data-engineering'
  ],
  'career-changer': [
    'ai-for-non-engineers', 'prompt-engineering', 'ai-tools',
    'ai-coding-tools', 'career-development', 'python',
    'llm-apis', 'ai-agents', 'rag',
    'web-development', 'data-engineering', 'ai-product-strategy'
  ],
  'other': [
    'prompt-engineering', 'ai-agents', 'ai-tools',
    'rag', 'llm-apis', 'ai-product-strategy',
    'open-source-models', 'ai-coding-tools',
    'fine-tuning', 'ai-ethics', 'career-development', 'ai-for-non-engineers'
  ],
};
```

Each pill shows: topic label (human-readable, from your topic taxonomy if available — otherwise convert slug to title case). Selected pills get a highlighted border + check icon. Unselected pills are muted.

**"Trending right now" badge** — mark 2-3 of the pills as trending based on your heat engine data. Query `/api/topics/trending` (if it exists) or hardcode the top 3 for now. Gives the user social proof for their picks.

**Continue button** — disabled until 2+ topics are selected. Shows counter: "2 of 2-4 selected".

### Save onboarding data

When the user completes Step 2 (or when they hit Continue to proceed to avatar), save the role, goal, experience_level, and learning_topics to `fp_profiles`:

```typescript
await supabaseAdmin
  .from('fp_profiles')
  .update({
    current_role: selectedRole,
    target_goal: goalText || null,
    experience_level: selectedLevel,
    learning_topics: selectedTopics,
    onboarding_version: 2,
  })
  .eq('id', userId);
```

### Seed the taste profile

After saving the profile, seed the user's taste profile with their selected topics. This gives them personalized content from their very first session:

Create a helper function in `lib/breaks/tasteProfile.ts`:

```typescript
/** Seed taste profile from onboarding topic selections */
export async function seedTasteProfile(
  userId: string,
  topics: string[],
  experienceLevel: 'beginner' | 'intermediate' | 'advanced'
): Promise<void> {
  const baseWeight = experienceLevel === 'beginner' ? 0.3 : experienceLevel === 'intermediate' ? 0.4 : 0.5;

  const rows = topics.map(topic => ({
    user_id: userId,
    world_key: 'global', // Use 'global' for Learn-context taste profiles (not room-specific)
    topic,
    weight: baseWeight,
    interactions: 1,
    updated_at: new Date().toISOString(),
  }));

  await supabaseAdmin
    .from('fp_user_taste_profiles')
    .upsert(rows, { onConflict: 'user_id,world_key,topic' });
}
```

Call this after saving the profile in the onboarding flow. The `world_key = 'global'` distinguishes Learn taste preferences from room-specific break preferences.

### Re-onboarding for existing users

Existing users have `onboarding_version = 1` (or NULL). When they next log in, the middleware should detect this and optionally prompt them (NOT force redirect — that would be disruptive). Two approaches:

**Option A (recommended): Soft prompt.** Add a banner on the Learn page and Room page: "Tell us about your learning goals to get personalized recommendations. [Set up →]" Links to `/onboard?step=role`. The onboard page checks the URL param and starts at the role step, skipping identity/avatar.

**Option B: In-page modal.** On first visit to Learn after the feature ships, show a modal with the role + topics steps. Dismissible, but shown once.

Go with Option A. Add the banner logic to `LearnPage.tsx`:

```typescript
// At the top of LearnPage, after loading profile:
const { profile } = useProfile();
const needsPersonalization = profile && (!profile.current_role || !profile.learning_topics?.length);
```

If `needsPersonalization` is true, render a subtle banner above the search bar with a CTA to `/onboard?step=role`.

---

## Step 3: Update the Profile Type

In `lib/useProfile.ts`, extend the `Profile` interface (line 7):

```typescript
export interface Profile {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  avatar_seed: string | null;
  avatar_style_version: number | null;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  onboarding_completed: boolean;
  // NEW — personalization fields
  current_role: string | null;
  target_goal: string | null;
  experience_level: string | null;
  learning_topics: string[] | null;
  onboarding_version: number | null;
}
```

Update `PROFILE_COLUMNS` (line 20) to include the new columns:

```typescript
const PROFILE_COLUMNS = 'id, username, display_name, avatar_url, avatar_seed, avatar_style_version, email, first_name, last_name, onboarding_completed, current_role, target_goal, experience_level, learning_topics, onboarding_version';
```

---

## Step 4: Personalize Path Generation

This is the highest-impact change. The path generator already works — we just need to give it user context.

### Update `generateLearningPath()` in `lib/learn/pathGenerator.ts`

Add an optional `userContext` parameter:

```typescript
export interface PathUserContext {
  role: string | null;
  goal: string | null;
  experience_level: string | null;
  topics: string[] | null;
}

export async function generateLearningPath(
  query: string,
  contentItems: ContentSearchResult[],
  userContext?: PathUserContext
): Promise<GeneratedPath> {
```

Modify the system prompt (around line 33-44) to include user context when available:

```typescript
let systemPrompt = `You are a learning path architect. Given a search query and a set of learning resources...`; // existing prompt

if (userContext?.role || userContext?.goal || userContext?.experience_level) {
  systemPrompt += `\n\nLearner context:`;
  if (userContext.role) systemPrompt += `\n- Current role: ${userContext.role}`;
  if (userContext.goal) systemPrompt += `\n- Learning goal: ${userContext.goal}`;
  if (userContext.experience_level) systemPrompt += `\n- Experience level: ${userContext.experience_level}`;
  systemPrompt += `\n\nAdapt the path for this learner:`;
  systemPrompt += `\n- If beginner: prioritize conceptual overviews and gentle introductions in Foundations. More items in Foundations, fewer in Advanced.`;
  systemPrompt += `\n- If intermediate: balance theory and practice. Standard distribution across sections.`;
  systemPrompt += `\n- If advanced: fewer basics, more applied and advanced content. Can skip obvious fundamentals.`;
  systemPrompt += `\n- Tailor connective text to speak to someone in their role. A PM learning RAG should get business-relevant framing. An engineer should get implementation-focused framing.`;
}
```

### Update `POST /api/learn/paths` in `app/api/learn/paths/route.ts`

After generating the embedding and fetching search results, fetch the user's profile and pass context to the generator:

```typescript
// After line where search results are fetched:
let userContext: PathUserContext | undefined;

// Get authenticated user (optional — unauthenticated users get generic paths)
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

// Pass to generator:
const generated = await generateLearningPath(query, filtered, userContext);
```

**Important:** Path caching must account for user context. Two users with different roles searching the same query should get different paths. Update the cache lookup:

```typescript
// Modify cache check to include role + experience_level:
const cacheKey = `${query.toLowerCase().trim()}|${userContext?.role || 'none'}|${userContext?.experience_level || 'intermediate'}`;

const { data: cached } = await supabaseAdmin
  .from('fp_learning_paths')
  .select('*')
  .eq('query', query.toLowerCase().trim())
  .eq('is_cached', true)
  .limit(1)
  .maybeSingle();

// For now, exact query match only. In the future, cache per role+level combo.
// If the cached path was generated for a different role, regenerate.
```

Actually — the simplest approach for now: **don't cache personalized paths.** Only cache paths for unauthenticated users (generic). Authenticated users always get a fresh personalized path. GPT-4o-mini is fast (~2-3s) and cheap (~$0.001/path). At your current scale, this is fine. Add smarter caching later when it matters.

```typescript
// Only check cache for unauthenticated users:
if (!user) {
  const { data: cached } = await supabaseAdmin
    .from('fp_learning_paths')
    .select('*')
    .eq('query', query.toLowerCase().trim())
    .eq('is_cached', true)
    .limit(1)
    .maybeSingle();

  if (cached) {
    return NextResponse.json({ path: mapPathRow(cached), cached: true });
  }
}
```

---

## Step 5: Personalize the Learn Home Page

Modify `components/learn/LearnPage.tsx` (182 lines) to show personalized content when the user has a profile.

### "Suggested for You" section

Above the search bar (or below the "Continue Learning" section if they have in-progress paths), add a "Suggested for You" row. This shows 3-5 topic cards based on the user's `learning_topics` from their profile:

```typescript
// Fetch suggested content on mount if user has learning_topics
useEffect(() => {
  if (profile?.learning_topics?.length) {
    fetch(`/api/learn/search?topics=${profile.learning_topics.join(',')}&limit=6`)
      .then(r => r.json())
      .then(data => setSuggestedContent(data.items));
  }
}, [profile?.learning_topics]);
```

Render as a horizontal scrollable row of ContentCards with a header: "Suggested for you" (or more specific: "Because you're learning [topic]").

### Personalized topic pills

The `POPULAR_TOPICS` constant at line 10-23 of LearnPage.tsx currently shows the same 12 topics for everyone. When the user has `learning_topics`, put their selected topics FIRST in the pill list, then fill with popular topics (deduplicated):

```typescript
const topicPills = useMemo(() => {
  const userTopics = profile?.learning_topics || [];
  const popular = POPULAR_TOPICS.filter(t => !userTopics.includes(t.slug));
  return [
    ...userTopics.map(slug => ({ slug, label: slugToLabel(slug) })),
    ...popular,
  ].slice(0, 12);
}, [profile?.learning_topics]);
```

### Search hint personalization

The search bar placeholder currently says something like "Search for any topic..." When the user has a profile, make it more specific:

```typescript
const searchPlaceholder = profile?.current_role
  ? `What do you want to learn, ${profile.display_name?.split(' ')[0] || 'there'}?`
  : 'What do you want to learn?';
```

---

## Step 6: Personalize the AI Tutor

If an AI tutor endpoint exists at `app/api/learn/tutor/route.ts`, update its system prompt to include user context:

```typescript
// Fetch user profile:
const { data: profile } = await supabaseAdmin
  .from('fp_profiles')
  .select('current_role, target_goal, experience_level')
  .eq('id', user.id)
  .single();

let tutorPrompt = `You are an AI learning tutor helping a student work through a learning path on ${pathTopics}.`;

if (profile?.current_role) {
  tutorPrompt += ` The student is a ${profile.current_role}`;
  if (profile.target_goal) tutorPrompt += ` who wants to ${profile.target_goal}`;
  tutorPrompt += '.';
}

if (profile?.experience_level) {
  tutorPrompt += ` Their self-assessed experience level is ${profile.experience_level}.`;
  if (profile.experience_level === 'beginner') {
    tutorPrompt += ' Use clear, jargon-free explanations. Define technical terms when you use them.';
  } else if (profile.experience_level === 'advanced') {
    tutorPrompt += ' You can assume solid technical foundations. Be concise and focus on nuance.';
  }
}
```

If the tutor endpoint doesn't exist yet, skip this — it can be added later.

---

## Step 7: Personalize AI Host Messages in Rooms

Update `lib/hostPrompt.ts` (117 lines) to optionally include the user's learning context.

This is a lighter touch — the host doesn't need to reference the user's profile on every message. But when it's a session-start message or a break-transition message, it can reference their learning goals:

In the function that builds the user prompt (around line 48-55), add:

```typescript
// If we have the active user's profile:
if (userProfile?.learning_topics?.length) {
  userPrompt += `\nThe user is currently learning: ${userProfile.learning_topics.join(', ')}.`;
  userPrompt += ` You can occasionally reference this to make them feel seen, but don't overdo it.`;
}
```

This means the host might say: "Great sprint! Since you're working on RAG pipelines, the break content today has some great pieces on embeddings." Natural, personal, not forced.

The host message generation is called from the room page. Check if the caller already has access to the user profile — if so, pass it through. If not, it may need a lightweight profile fetch. Don't make this a blocking requirement — it's a nice-to-have enhancement.

---

## Step 8: Personalize Room Recommendations

If there's a rooms browsing page (likely `app/(lobby)/rooms/` or similar), add a "Recommended for you" section that filters rooms by the user's learning topics:

```typescript
// Query rooms where the world_key or topic_slug overlaps with user's learning_topics
const { data: recommendedRooms } = await supabaseAdmin
  .from('fp_parties')
  .select('*')
  .eq('status', 'active')
  .overlaps('topic_slug', profile.learning_topics) // if topic_slug exists on fp_parties
  .limit(5);
```

If rooms don't have topic tags yet, this can be deferred. The Room-to-Learn bridge is more important and can work without room-level topic matching — it works at the break content level (which already has topics).

---

## Step 9: Personalize Search Ranking

In `app/api/learn/search/route.ts` (62 lines), after getting semantic search results, boost items that match the user's taste profile:

```typescript
// After searchContentLake returns results:
if (user) {
  const { data: tasteWeights } = await supabaseAdmin
    .from('fp_user_taste_profiles')
    .select('topic, weight')
    .eq('user_id', user.id)
    .eq('world_key', 'global');

  if (tasteWeights?.length) {
    const weightMap = new Map(tasteWeights.map(tw => [tw.topic, tw.weight]));

    // Boost combined_score based on taste profile match
    items = items.map(item => {
      const topicBoost = (item.topics || []).reduce((sum: number, t: string) => {
        return sum + (weightMap.get(t) || 0);
      }, 0);

      return {
        ...item,
        combined_score: (item.combined_score || item.similarity || 0) + (topicBoost * 0.15),
      };
    });

    // Re-sort by boosted score
    items.sort((a, b) => (b.combined_score || 0) - (a.combined_score || 0));
  }
}
```

This means a user who has been engaging with RAG content will see RAG-adjacent results ranked slightly higher. The boost is gentle (0.15 multiplier) — enough to personalize without creating a filter bubble.

---

## Step 10: Profile API Endpoint

Create `app/api/user/profile/route.ts` if it doesn't already exist:

**GET** — Returns the current user's profile (for client-side use beyond the `useProfile` hook).

**PATCH** — Updates profile fields. Used by onboarding and by a future settings/profile page.

```typescript
// PATCH body: Partial<{ current_role, target_goal, experience_level, learning_topics }>
// 1. Get authenticated user
// 2. Validate fields (role must be from ROLE_OPTIONS, experience_level from enum, topics array max 6)
// 3. Update fp_profiles
// 4. If learning_topics changed, call seedTasteProfile() to update taste weights
// 5. Return updated profile
```

---

## Validation Checklist

1. **New onboarding flow works:** Create a new account. Confirm 5 steps: identity → role/goal → topics → avatar → welcome. Confirm all data saves to `fp_profiles`.

2. **Role selection works:** Select "Software Engineer." Confirm the topics step shows engineering-relevant topics (ai-agents, rag, fine-tuning, etc.).

3. **Topics selection works:** Pick 3 topics. Confirm min 2 / max 4 enforcement. Confirm the pills highlight correctly.

4. **Taste profile seeded:** After completing onboarding, check `fp_user_taste_profiles` for the user. Confirm entries exist for each selected topic with `world_key = 'global'`.

5. **Personalized paths:** Search "prompt engineering" as an engineer vs. as a PM (two accounts). Confirm the path titles, descriptions, and item ordering differ — the engineer's path should lean practical/code-heavy, the PM's path should lean strategic/conceptual.

6. **Learn home personalization:** Log in with a completed profile. Confirm "Suggested for you" section shows content matching your selected topics. Confirm your topics appear first in the pill list.

7. **Personalization banner for existing users:** Log in with an account that has `onboarding_version = 1` (or NULL). Confirm a banner appears on the Learn page prompting to set up personalization.

8. **Re-onboarding works:** Click the banner. Confirm it opens onboarding at the role step (skipping identity/avatar). Confirm data saves and banner disappears.

9. **Search ranking boost:** As a user with taste profile weights for "rag", search for a broad term like "AI". Confirm RAG-related results appear slightly higher than they would for a fresh user.

10. **Unauthenticated experience still works:** Open Learn in an incognito window. Confirm search, path generation, and browsing all work without personalization (generic experience, cached paths).

11. **TypeScript clean:** Run `npx tsc --noEmit` — zero type errors.

12. **Mobile responsive:** Complete onboarding on mobile width. Confirm role cards and topic pills wrap correctly and are tappable.
