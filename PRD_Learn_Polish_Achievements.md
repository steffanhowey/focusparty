# Learn Experience Polish + Achievement System — Engineering Prompt

## Philosophy

The learning environment is functional. Now make it world-class. Every screen should feel intentional, clean, and premium. Strip anything that doesn't earn its place. Then build the achievement system that makes people want to share their progress.

The test: when someone completes a learning path, they should feel so good about it that they screenshot the completion card and post it on LinkedIn. That's the bar.

Read `CLAUDE.md` for project conventions and `.claude/rules/ui-components.md` for design system rules. Then read these files before any changes:

- `app/(learn)/learn/paths/[id]/page.tsx` (237 lines) — learning environment
- `components/learn/LearnPage.tsx` (143 lines) — Learn home
- `components/learn/PathCard.tsx` (184 lines) — path card
- `components/learn/PathSidebar.tsx` (225 lines) — navigation sidebar
- `components/learn/LearnVideoPlayer.tsx` (159 lines) — video player
- `components/learn/ArticleViewer.tsx` (108 lines) — article display
- `components/learn/AiTutor.tsx` (174 lines) — AI tutor (being removed)
- `components/learn/ContinueLearning.tsx` (72 lines) — in-progress paths
- `components/learn/PathPreview.tsx` (236 lines) — DEAD CODE, delete
- `lib/useLearnProgress.ts` (185 lines) — progress hook
- `lib/useLearnSearch.ts` (104 lines) — search hook
- `lib/types.ts` — LearningPath (line ~718), LearningProgress, PathItem

---

## Part 1: Strip Bloat

### 1.1 Delete Dead Code

- **Delete `components/learn/PathPreview.tsx`** — never imported anywhere. Dead code from an abandoned flow.
- **Remove `topicFilters` and `toggleTopic` from `useLearnSearch.ts`** — returned but never used. The topic pills set the query directly, which is the correct behavior.
- **Remove any imports of the deleted/cleaned code** from other files.

### 1.2 Remove AI Tutor (For Now)

The AI Tutor (`AiTutor.tsx`, 174 lines) adds a floating chat panel to the learning environment. Remove it from the learning environment page. Reasons:

- It's a distraction in a focused learning environment. The user is here to watch and read, not chat.
- The responses are generic (limited context — just item titles, no transcripts).
- It adds visual complexity (floating button, modal overlay, message list).
- It will come back later as a much better feature — with transcript context, exercise checking, and deeper integration. But right now it's half-baked and pulls attention from the content.

**What to do:**
- Remove the `<AiTutor>` component render from `app/(learn)/learn/paths/[id]/page.tsx`
- Don't delete `AiTutor.tsx` or `app/api/learn/tutor/route.ts` — just disconnect them from the UI. They'll be reintroduced later.

### 1.3 Simplify the Learning Environment Layout

With the tutor removed, the learning environment becomes cleaner: just the content viewer and the path sidebar.

Audit the layout for unnecessary elements:
- Remove any empty bottom panel space where the tutor was
- Make the content viewer take up more vertical space
- Ensure the sidebar doesn't take up too much width — content is king, sidebar is navigation

### 1.4 Fix ArticleViewer External Link

`ArticleViewer.tsx` (108 lines) currently has a "Read Full Article" button that opens `source_url` in a new tab. This breaks the "no external links" rule from the UX rewire.

Fix: Remove the external link button. Instead, display:
- Title, creator, published date (keep)
- The full description/summary from the content lake (expand to show all of it, not truncated)
- Estimated read time (keep, but fix the calculation — use `article_word_count` from the content lake if available, otherwise fall back to the duration_seconds estimate)
- A "Mark as Complete" button (keep)

For now, the article experience is: read the summary, then mark complete. It's not ideal (we don't have full article text in the content lake yet), but it's better than sending users to an external site. Later, when we store full article text, we can render it inline.

If the summary is very short (< 100 characters), show an informational note: "Full article available at [source name]" with the source name (not URL) as plain text. The user can Google it if they want, but we don't link out.

---

## Part 2: Polish the Learning Environment

### 2.1 Item Transitions

When a user completes an item and advances to the next one, the transition should feel smooth and intentional. Currently there's an "Up Next" card — audit its design:

- The transition card should appear with a subtle animation (fade in, slight slide up)
- Show the next item's title, format icon (video/article), creator, and duration
- Show the connective text from the path ("Now that you understand X, this next piece shows Y in practice")
- Two buttons: "Continue" (primary, prominent) and "Back to path" (ghost, subtle)
- If it was the LAST item, this is where the completion celebration triggers instead (see Part 3)

### 2.2 Progress Bar in Top Bar

The top bar of the learning environment should have a thin, elegant progress bar that fills as items are completed. This gives constant visual feedback of advancement without being intrusive.

- Thin bar (2-3px height) spanning the full width of the top bar
- Fills left to right based on `items_completed / items_total`
- Use the accent color with a subtle gradient
- Animate the fill when an item is completed (smooth width transition, ~300ms)
- Show text: "3 of 8 complete" right-aligned, small text

### 2.3 Active Item Highlight in Sidebar

When the user is viewing an item, the sidebar should clearly indicate which item is active:

- Active item: slightly brighter background, left border accent line (2px), bolder text
- Completed items: check icon in accent color, slightly muted text
- Upcoming items: circle outline, muted text
- Ensure clicking a sidebar item scrolls the content viewer smoothly (not a jarring page jump)

### 2.4 Section Completion Milestones

When a user completes all items in a section (e.g., all Foundations items), show a brief, subtle celebration:

- A small toast or inline message: "Foundations complete ✓ — moving to Applied"
- Auto-dismisses after 3 seconds
- This creates mini-milestones within the path, making longer paths feel less daunting

---

## Part 3: The Completion Celebration

This is the most important screen in the entire product. When someone completes a learning path, they need to feel like they accomplished something real.

### 3.1 Completion Screen

Replace the current minimal Trophy + congratulations with a full-screen celebration:

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│              ✦ Path Complete ✦                      │
│                                                     │
│    ┌───────────────────────────────────────────┐    │
│    │                                           │    │
│    │         [ACHIEVEMENT CARD]                │    │
│    │                                           │    │
│    │    Mastering RAG Pipelines                │    │
│    │    ━━━━━━━━━━━━━━━━━━━━━━━                │    │
│    │                                           │    │
│    │    8 resources completed                  │    │
│    │    2h 34min invested                      │    │
│    │    Topics: RAG, Embeddings, Vector DBs    │    │
│    │                                           │    │
│    │    Completed March 14, 2026               │    │
│    │                                           │    │
│    │    SkillGaps.ai                           │    │
│    └───────────────────────────────────────────┘    │
│                                                     │
│    [Share Achievement]     [Continue Learning]       │
│                                                     │
│    ─────────────────────────────────────────────    │
│                                                     │
│    Recommended next:                                │
│    ┌──────────┐  ┌──────────┐                      │
│    │ PathCard  │  │ PathCard  │                      │
│    └──────────┘  └──────────┘                      │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Elements:**

1. **"Path Complete" header** — large, celebratory. Can use a subtle animation (fade in, scale up). No confetti — keep it premium, not childish. A subtle particle effect or a glow is fine.

2. **Achievement Card** — this is the shareable unit. It's a self-contained card that looks good as a screenshot AND as a generated social image. Design it like a premium certificate:
   - Clean, dark background with subtle gradient or border glow
   - Path title in large text
   - Stats: items completed, time invested, topics covered
   - Completion date
   - Skillgap branding (small, tasteful — bottom corner)
   - This card is also what gets rendered as the OG image for social sharing (see Step 3.3)

3. **"Share Achievement" button** — opens a share menu:
   - "Copy link" — copies a shareable URL to the achievement (see Step 3.2)
   - "Share to LinkedIn" — opens LinkedIn share with pre-filled text + URL
   - "Share to X/Twitter" — opens Twitter share with pre-filled text + URL
   - "Download image" — downloads the achievement card as a PNG

4. **"Continue Learning" button** — returns to `/learn`

5. **"Recommended next" section** — show 2 PathCards for related topics. Query learning paths that share topics with the completed path but haven't been started by this user. If none found, show popular paths.

### 3.2 Shareable Achievement URL

Create `app/(learn)/learn/achievements/[id]/page.tsx` — a public page for a completed learning path.

When a user completes a path, create a record in a new `fp_achievements` table:

```sql
CREATE TABLE fp_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  path_id UUID NOT NULL REFERENCES fp_learning_paths(id),
  progress_id UUID REFERENCES fp_learning_progress(id),
  path_title TEXT NOT NULL,
  path_topics TEXT[] DEFAULT '{}',
  items_completed INTEGER NOT NULL,
  time_invested_seconds INTEGER NOT NULL,
  difficulty_level TEXT,
  completed_at TIMESTAMPTZ DEFAULT now(),
  share_slug TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_achievements_user ON fp_achievements (user_id);
CREATE INDEX idx_achievements_slug ON fp_achievements (share_slug);
```

The `share_slug` is a short, URL-friendly string (e.g., `steffan-rag-pipelines-a3f8`). Generate it from: first name + path topic + 4 random chars.

**API endpoint: `app/api/learn/achievements/route.ts`**

**POST** — Create achievement on path completion. Called automatically when `items_completed === items_total` in the progress PATCH handler (extend `app/api/learn/paths/[id]/route.ts`).

```typescript
// In the PATCH handler, after detecting completion:
if (items_completed >= items_total && !existingProgress.completed_at) {
  // Create achievement
  const shareSlug = generateShareSlug(userProfile.display_name, path.topics);
  await supabaseAdmin
    .from('fp_achievements')
    .insert({
      user_id: user.id,
      path_id: pathId,
      progress_id: progressId,
      path_title: path.title,
      path_topics: path.topics,
      items_completed,
      time_invested_seconds: existingProgress.time_invested_seconds + (time_delta_seconds || 0),
      difficulty_level: path.difficulty_level,
      share_slug: shareSlug,
    });
}
```

**GET** — Fetch user's achievements. For the skill profile page.

**The public page** (`app/(learn)/learn/achievements/[id]/page.tsx`):

Renders the achievement card (same design as the completion screen) in a clean, shareable layout. No sidebar, no nav — just the card, centered, with the Skillgap branding. This is what gets linked on social media.

Important: this page is PUBLIC. No auth required to view. The user's display name and achievement data are visible. Don't show email or private data.

### 3.3 Social Meta Tags / OG Image

For the achievement page, generate proper Open Graph meta tags so the link preview looks good on LinkedIn/Twitter:

```tsx
export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const achievement = await fetchAchievement(params.id);

  return {
    title: `${achievement.path_title} — Completed on SkillGaps`,
    description: `${achievement.items_completed} resources completed in ${formatDuration(achievement.time_invested_seconds)}. Topics: ${achievement.path_topics.join(', ')}.`,
    openGraph: {
      title: `I completed "${achievement.path_title}" on SkillGaps`,
      description: `${achievement.items_completed} resources · ${formatDuration(achievement.time_invested_seconds)} invested`,
      type: 'article',
      // OG image: either a static template or a dynamic image via Vercel OG
    },
    twitter: {
      card: 'summary_large_image',
      title: `I completed "${achievement.path_title}" on SkillGaps`,
    },
  };
}
```

**Bonus (if time permits):** Use Vercel's `@vercel/og` to generate a dynamic OG image that renders the achievement card server-side. This means LinkedIn and Twitter previews show the actual achievement card, not a generic image. This is a huge boost for social sharing — the preview IS the achievement.

---

## Part 4: Skill Profile Page

Create `app/(hub)/learn/profile/page.tsx` — the user's learning profile.

This is the long-term home for all their achievements and skill growth. It should feel like a professional portfolio of capabilities.

### Layout

```
┌─────────────────────────────────────────────────────┐
│  [Avatar]  Steffan's Learning Profile               │
│            5 paths completed · 12h invested          │
│            Learning since March 2026                 │
│                                                     │
│  ─────────────────────────────────────────────────  │
│                                                     │
│  Skills                                             │
│                                                     │
│  RAG Pipelines        ████████████████░  90%        │
│  2 paths · 4h invested                              │
│                                                     │
│  Prompt Engineering   ████████████░░░░  70%         │
│  1 path · 2h invested                               │
│                                                     │
│  AI Agents            ████████░░░░░░░░  45%         │
│  1 path · 1.5h invested (in progress)               │
│                                                     │
│  ─────────────────────────────────────────────────  │
│                                                     │
│  Achievements                                       │
│                                                     │
│  ┌──────────────┐  ┌──────────────┐                │
│  │ Achievement   │  │ Achievement   │               │
│  │ card mini     │  │ card mini     │               │
│  └──────────────┘  └──────────────┘                │
│                                                     │
│  ─────────────────────────────────────────────────  │
│                                                     │
│  Learning Activity                                  │
│  [Simple activity log or streak display]            │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Skill Bars

Computed from learning progress data:

```typescript
// For each topic the user has engaged with:
// 1. Count completed paths that include this topic
// 2. Sum time invested across those paths
// 3. Factor in path difficulty (advanced paths = more skill)
// 4. Compute a 0-100 skill level

interface SkillLevel {
  topic: string;
  level: number; // 0-100
  paths_completed: number;
  paths_in_progress: number;
  time_invested_seconds: number;
}

// Simple formula:
// level = min(100, paths_completed * 25 + (paths_in_progress * 10) + (time_hours * 5))
// Adjust multipliers so that:
// - 1 beginner path = ~30%
// - 2 intermediate paths = ~60%
// - 3+ paths including advanced = ~85-100%
```

The skill bars use the accent color, with a subtle gradient for visual interest. Each bar shows the topic name, percentage, and summary stats (paths completed, time invested).

### Achievements Grid

Shows all completed achievements as mini cards — smaller versions of the achievement card from the completion screen. Each links to the full achievement page. Ordered by completion date (newest first).

### Learning Activity

Simple, not overbuilt:
- "Currently working on: [path title] — X/Y items"
- "Completed [path title] on [date]"
- Or a weekly streak indicator (simple dots for days this week, filled = learned something)

Don't build a complex activity feed — just enough to show recent engagement.

### Profile Link

The skill profile should have a shareable URL: `skillgap.ai/learn/profile/[username]`. This is the public version — shows skills, achievements, and stats. No private data. This becomes the professional asset users share on LinkedIn or put in their portfolio.

Create `app/(learn)/learn/profile/[username]/page.tsx` for the public view.

---

## Part 5: Navigation Integration

### Add "My Profile" to Learn

In the Learn page or sidebar, add a link to the user's profile:
- If in the sidebar nav: add "Profile" under "Learn"
- Or: add a small "View your profile →" link in the ContinueLearning section header

### Add Achievement Count Badge

On the Learn nav item in the sidebar, optionally show a badge with the user's achievement count (like a notification badge). This is a subtle but motivating element — it grows as they learn.

---

## Part 6: Recommended Next Paths

On the completion screen and on the skill profile page, recommend next paths:

```typescript
// Find paths that:
// 1. Share at least 1 topic with the just-completed path
// 2. Haven't been completed by this user
// 3. Haven't been started by this user (or show in-progress ones differently)
// 4. Order by: topic overlap count DESC, view_count DESC

const { data: recommended } = await supabaseAdmin
  .from('fp_learning_paths')
  .select('*')
  .eq('is_cached', true)
  .overlaps('topics', completedPath.topics)
  .not('id', 'in', `(${completedPathIds.join(',')})`)
  .order('view_count', { ascending: false })
  .limit(4);
```

Show as PathCards — same component, consistent UX.

---

## Validation Checklist

1. **Bloat removed:** PathPreview.tsx deleted. AI Tutor disconnected from learning environment (component and API still exist but not rendered). ArticleViewer has no external links. Unused topicFilters state removed from search hook.

2. **Learning environment feels clean:** Content viewer + sidebar only. No floating buttons, no bottom panels. Content has maximum space.

3. **Progress bar works:** Thin accent bar in top bar fills as items complete. Animates smoothly on completion.

4. **Item transitions are smooth:** Completing an item shows a transition card with the next item's details + connective text. Fade/slide animation. "Continue" button advances.

5. **Section milestones trigger:** Completing all Foundations items shows a brief "Foundations complete ✓" toast.

6. **Completion celebration is impactful:** Finishing the last item shows the full-screen celebration with the achievement card, share buttons, and recommended next paths. No generic Trophy + text.

7. **Achievement is created automatically:** Check `fp_achievements` after completing a path. Record exists with correct stats and share_slug.

8. **Share URL works publicly:** Open the achievement URL in incognito. Confirm the achievement card renders without auth. Confirm OG meta tags are set for social previews.

9. **Share buttons work:** "Copy link" copies the URL. "Share to LinkedIn" opens LinkedIn with pre-filled content. "Share to X" opens Twitter compose.

10. **Skill profile renders:** Navigate to the profile page. Confirm skill bars show correct topics and levels computed from completed paths. Confirm achievements grid shows completed achievements.

11. **Recommended paths appear:** On completion screen and profile page, confirm related paths show as PathCards.

12. **No external links in Learn:** Audit every component in `components/learn/`. Zero `target="_blank"`. Zero `href` pointing outside the app. Every click stays in the Skillgap experience.

13. **TypeScript clean:** `npx tsc --noEmit` — zero errors.

14. **Mobile responsive:** Completion screen, skill profile, and achievement page all render cleanly on mobile.
