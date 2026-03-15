# Learn > Practice > Apply Loop — Engineering Prompt

## Context

The Learn experience has learning paths with sequenced content (videos + articles). But it's passive — watch, watch, watch, done. That's YouTube with better ordering.

This prompt adds **Practice items** into learning paths, creating a Learn → Practice → Learn → Practice → Apply loop. Practice items are interleaved between content items and include: comprehension checks, guided tool challenges (with direct links to real AI tools), and paste-back exercises with AI evaluation.

The scaffolding system (`lib/scaffolding/generator.ts`) already generates practice data per video: `PracticeExercise` with `tools: string[]`, `ComprehensionCheck[]`, `PreWatchChallenge`, and `discussionQuestion`. This data is stored on `fp_content_lake.scaffolding` as JSONB. We're surfacing it in the right context.

Read `CLAUDE.md` for project conventions. Then read these files:

- `lib/scaffolding/generator.ts` (426 lines) — Scaffolding types: `Scaffolding`, `PracticeExercise`, `ComprehensionCheck`, `PreWatchChallenge`, `KeyMoment`. The `PracticeExercise` has `tools: string[]`, `instructions: string[]`, `starterCode: string | null`, `successCriteria: string`.
- `lib/learn/pathGenerator.ts` (400+ lines) — `generateLearningPath()`, system prompt, Structured Outputs schema
- `lib/learn/contentLake.ts` (129 lines) — `searchContentLake()` returns items with `scaffolding` JSONB
- `lib/types.ts` — `PathItem` (line ~721), `LearningPath` (line ~750), `ContentLakeItem` (line ~670 — has `scaffolding: Scaffolding | null`)
- `app/(learn)/learn/paths/[id]/page.tsx` (237 lines) — learning environment
- `components/learn/ContentViewer.tsx` (47 lines) — routes to video/article viewer
- `components/learn/PathSidebar.tsx` (225 lines) — navigation sidebar
- `lib/useLearnProgress.ts` (185 lines) — progress tracking hook

---

## Step 1: Extend the Path Item Model

The current `PathItem` only supports `content_type: 'video' | 'article'`. Extend it to also support practice items.

### Update `lib/types.ts`

```typescript
/** Content types in a learning path */
export type PathItemType = 'video' | 'article' | 'practice';

/** Practice item types */
export type PracticeType = 'comprehension' | 'tool_challenge' | 'paste_back' | 'reflection';

/** An AI tool referenced in practice exercises */
export interface AiTool {
  name: string;           // display name: "Claude", "Cursor", "v0"
  slug: string;           // identifier: "claude", "cursor", "v0"
  url: string;            // direct link: "https://claude.ai/new"
  icon: string | null;    // optional icon URL or lucide icon name
  description: string;    // 1-line: "AI assistant for analysis, writing, and code"
  category: 'assistant' | 'code_editor' | 'design' | 'platform' | 'other';
}

/** A practice item in a learning path */
export interface PracticeItem {
  type: PracticeType;
  title: string;                        // "Test your understanding" or "Build a RAG query"
  prompt: string;                       // the main challenge/question text
  instructions: string[] | null;        // step-by-step for tool challenges
  tools: AiTool[] | null;              // linked tools for tool challenges
  starter_code: string | null;         // starter code for paste-back exercises
  success_criteria: string | null;     // what "done" looks like
  estimated_minutes: number;
  allows_text_input: boolean;          // true for paste-back and reflection
  ai_evaluation: boolean;             // true if GPT evaluates the user's response
}

/** Extended path item that supports content AND practice */
export interface PathItem {
  content_id: string;                  // UUID from content lake, or generated UUID for practice items
  content_type: PathItemType;          // 'video' | 'article' | 'practice'
  title: string;
  creator_name: string;                // empty string for practice items
  source_url: string;                  // empty string for practice items
  thumbnail_url: string | null;
  duration_seconds: number;
  quality_score: number;               // 0 for practice items
  section: 'foundations' | 'applied' | 'advanced';
  position: number;
  connective_text: string;
  practice: PracticeItem | null;       // populated only when content_type === 'practice'
}
```

This keeps backward compatibility — existing paths with only video/article items still work (practice = null).

---

## Step 2: AI Tool Registry

Create `lib/learn/toolRegistry.ts` — a registry of AI tools that can be referenced in practice items.

```typescript
export const AI_TOOLS: Record<string, AiTool> = {
  claude: {
    name: 'Claude',
    slug: 'claude',
    url: 'https://claude.ai/new',
    icon: null,
    description: 'AI assistant for analysis, writing, and code',
    category: 'assistant',
  },
  chatgpt: {
    name: 'ChatGPT',
    slug: 'chatgpt',
    url: 'https://chat.openai.com',
    icon: null,
    description: 'OpenAI\'s conversational AI assistant',
    category: 'assistant',
  },
  cursor: {
    name: 'Cursor',
    slug: 'cursor',
    url: 'https://cursor.sh',
    icon: null,
    description: 'AI-powered code editor built on VS Code',
    category: 'code_editor',
  },
  v0: {
    name: 'v0',
    slug: 'v0',
    url: 'https://v0.dev',
    icon: null,
    description: 'AI UI component generator by Vercel',
    category: 'design',
  },
  replit: {
    name: 'Replit',
    slug: 'replit',
    url: 'https://replit.com',
    icon: null,
    description: 'Browser-based IDE with AI coding assistant',
    category: 'platform',
  },
  midjourney: {
    name: 'Midjourney',
    slug: 'midjourney',
    url: 'https://www.midjourney.com',
    icon: null,
    description: 'AI image generation',
    category: 'design',
  },
  copilot: {
    name: 'GitHub Copilot',
    slug: 'copilot',
    url: 'https://github.com/features/copilot',
    icon: null,
    description: 'AI pair programmer in your editor',
    category: 'code_editor',
  },
  notebooklm: {
    name: 'NotebookLM',
    slug: 'notebooklm',
    url: 'https://notebooklm.google.com',
    icon: null,
    description: 'AI-powered research and note-taking by Google',
    category: 'assistant',
  },
};

/** Resolve tool names from scaffolding (freeform strings) to AiTool objects */
export function resolveTools(toolNames: string[]): AiTool[] {
  return toolNames
    .map(name => {
      const normalized = name.toLowerCase().replace(/[^a-z0-9]/g, '');
      // Fuzzy match against registry
      const match = Object.values(AI_TOOLS).find(tool =>
        normalized.includes(tool.slug) ||
        tool.name.toLowerCase().replace(/[^a-z0-9]/g, '').includes(normalized) ||
        normalized.includes(tool.name.toLowerCase().replace(/[^a-z0-9]/g, ''))
      );
      return match || null;
    })
    .filter((t): t is AiTool => t !== null);
}
```

This registry is easily extensible. When we add referral tracking later, each tool gets a `referralUrl` field.

---

## Step 3: Update Path Generator to Include Practice Items

Modify `lib/learn/pathGenerator.ts` to interleave practice items between content items.

### Approach: Post-Processing (not AI generation)

Do NOT ask the AI to generate practice items during path sequencing. The scaffolding data already exists on the content lake items. Instead, after the AI sequences the content items, post-process the path to insert practice items between them.

**Logic (add after the existing post-processing in `generateLearningPath()`):**

```typescript
function interleavesPractice(contentItems: PathItem[], allContentData: ContentSearchResult[]): PathItem[] {
  const result: PathItem[] = [];
  const contentLookup = new Map(allContentData.map(c => [c.id, c]));

  let practiceCounter = 0;

  for (let i = 0; i < contentItems.length; i++) {
    const item = contentItems[i];
    result.push(item);

    // After every content item, check if it has scaffolding and insert practice
    const contentData = contentLookup.get(item.content_id);
    const scaffolding = contentData?.scaffolding;

    if (!scaffolding) continue;

    // Decide which type of practice to insert based on position in the path
    const isEndOfSection = i === contentItems.length - 1 ||
      contentItems[i + 1]?.section !== item.section;

    if (isEndOfSection && scaffolding.exercise) {
      // End of section: insert a tool challenge or paste-back exercise
      const tools = resolveTools(scaffolding.exercise.tools || []);
      const hasTool = tools.length > 0;

      const practiceItem: PathItem = {
        content_id: `practice-${practiceCounter++}`,
        content_type: 'practice',
        title: hasTool
          ? `Practice: ${scaffolding.exercise.prompt.slice(0, 60)}`
          : `Exercise: ${scaffolding.exercise.prompt.slice(0, 60)}`,
        creator_name: '',
        source_url: '',
        thumbnail_url: null,
        duration_seconds: (scaffolding.exercise.estimatedMinutes || 10) * 60,
        quality_score: 0,
        section: item.section,
        position: item.position + 0.5,
        connective_text: 'Now put what you just learned into practice.',
        practice: {
          type: hasTool ? 'tool_challenge' : 'paste_back',
          title: hasTool ? 'Tool Challenge' : 'Practice Exercise',
          prompt: scaffolding.exercise.prompt,
          instructions: scaffolding.exercise.instructions,
          tools: hasTool ? tools : null,
          starter_code: scaffolding.exercise.starterCode,
          success_criteria: scaffolding.exercise.successCriteria,
          estimated_minutes: scaffolding.exercise.estimatedMinutes || 10,
          allows_text_input: !hasTool,
          ai_evaluation: !hasTool,
        },
      };
      result.push(practiceItem);

    } else if (i > 0 && i % 2 === 1 && scaffolding.comprehensionChecks?.length) {
      // After every 2nd content item (mid-section): insert a comprehension check
      const check = scaffolding.comprehensionChecks[0];

      const practiceItem: PathItem = {
        content_id: `practice-${practiceCounter++}`,
        content_type: 'practice',
        title: 'Check Your Understanding',
        creator_name: '',
        source_url: '',
        thumbnail_url: null,
        duration_seconds: 120, // 2 min
        quality_score: 0,
        section: item.section,
        position: item.position + 0.5,
        connective_text: 'Quick check before we move on.',
        practice: {
          type: 'comprehension',
          title: 'Check Your Understanding',
          prompt: check.question,
          instructions: null,
          tools: null,
          starter_code: null,
          success_criteria: check.answer, // The AI evaluator uses this as the reference
          estimated_minutes: 2,
          allows_text_input: true,
          ai_evaluation: true,
        },
      };
      result.push(practiceItem);
    }
  }

  // Re-assign sequential position numbers
  result.forEach((item, idx) => {
    item.position = idx;
  });

  return result;
}
```

**Call this function** at the end of `generateLearningPath()`, after the existing post-processing merges AI selections with metadata:

```typescript
// After existing logic that produces `items: PathItem[]`:
const withPractice = interleavesPractice(items, contentItems);
// Update counts
const estimatedDuration = withPractice.reduce((sum, item) => sum + item.duration_seconds, 0);
// Return with practice items included
```

**Update `items_total`** — the path now has more items (content + practice). The `items` JSONB on `fp_learning_paths` stores all of them. The progress tracker counts all items equally.

---

## Step 4: Practice Viewer Components

### `components/learn/PracticeViewer.tsx` — The main practice renderer

Routes to the correct sub-component based on `practice.type`:

```typescript
interface PracticeViewerProps {
  item: PathItem;
  onComplete: () => void;
  isCompleted: boolean;
}
```

### `components/learn/ComprehensionPractice.tsx`

For `type === 'comprehension'`:

```
┌─────────────────────────────────────────────────┐
│                                                 │
│  Check Your Understanding                       │
│                                                 │
│  [The comprehension question text]              │
│                                                 │
│  ┌─────────────────────────────────────────┐    │
│  │ Your answer...                          │    │
│  │                                         │    │
│  │                                         │    │
│  └─────────────────────────────────────────┘    │
│                                                 │
│  [Check My Answer]                              │
│                                                 │
│  ┌─ AI Feedback ──────────────────────────┐     │
│  │ "Good understanding! You correctly     │     │
│  │  identified X. One nuance to add..."   │     │
│  └────────────────────────────────────────┘     │
│                                                 │
│  [Mark Complete]                                │
│                                                 │
└─────────────────────────────────────────────────┘
```

- Text area for user's answer (4-6 rows)
- "Check My Answer" button → calls AI evaluation endpoint
- Shows AI feedback inline (green border for good, yellow for needs improvement)
- "Mark Complete" button appears after checking (or user can skip: "Skip → Mark Complete" in muted text)
- Don't block progression — practice is encouraged, not required

### `components/learn/ToolChallengePractice.tsx`

For `type === 'tool_challenge'`:

```
┌─────────────────────────────────────────────────┐
│                                                 │
│  Tool Challenge                                 │
│                                                 │
│  [Challenge prompt text]                        │
│                                                 │
│  Steps:                                         │
│  1. Open Claude and start a new conversation    │
│  2. Write a system prompt that...               │
│  3. Test it with this example input...          │
│  4. Iterate until it handles edge cases         │
│                                                 │
│  ┌─ Tool ────────────────────────────────┐      │
│  │  🤖 Claude                            │      │
│  │  AI assistant for analysis and code   │      │
│  │                [Open Claude →]         │      │
│  └───────────────────────────────────────┘      │
│                                                 │
│  Success looks like:                            │
│  "[success criteria text]"                      │
│                                                 │
│  [I've completed this challenge ✓]              │
│                                                 │
└─────────────────────────────────────────────────┘
```

- Challenge prompt in large text
- Numbered instruction steps
- Tool card with: name, description, prominent "Open [Tool] →" button (opens in new tab — this is the ONE place external links are allowed, because the user is intentionally going to practice)
- If multiple tools, show multiple tool cards
- Success criteria in a highlighted callout
- Self-report completion button: "I've completed this challenge ✓"
- No text input needed — the user practices in the external tool and self-reports

**Tool card styling:** Use `<Card>` from `@/components/ui/Card`. Tool name in bold, description in muted text. The "Open [Tool] →" button uses `<Button>` with variant `primary`. The `→` indicates it opens externally. Subtle external-link icon next to the button.

### `components/learn/PasteBackPractice.tsx`

For `type === 'paste_back'`:

```
┌─────────────────────────────────────────────────┐
│                                                 │
│  Practice Exercise                              │
│                                                 │
│  [Exercise prompt text]                         │
│                                                 │
│  Steps:                                         │
│  1. [instruction 1]                             │
│  2. [instruction 2]                             │
│  3. [instruction 3]                             │
│                                                 │
│  ┌─ Starter Code (if provided) ──────────┐      │
│  │  SELECT embedding <=> $1              │      │
│  │  FROM fp_content_lake                 │      │
│  │  ORDER BY embedding <=> $1            │      │
│  │  LIMIT 10;                     [Copy] │      │
│  └───────────────────────────────────────┘      │
│                                                 │
│  ┌─────────────────────────────────────────┐    │
│  │ Paste your work here...                 │    │
│  │                                         │    │
│  │                                         │    │
│  └─────────────────────────────────────────┘    │
│                                                 │
│  [Check My Work]                                │
│                                                 │
│  ┌─ AI Feedback ──────────────────────────┐     │
│  │ "Your implementation is solid. The     │     │
│  │  similarity query is correct. Consider │     │
│  │  adding a WHERE clause to filter..."   │     │
│  └────────────────────────────────────────┘     │
│                                                 │
│  [Mark Complete]                                │
│                                                 │
└─────────────────────────────────────────────────┘
```

- Exercise prompt
- Instruction steps
- Starter code block with copy button (if `starter_code` exists) — use a monospace font, subtle dark background
- Text area for pasting their work (8-10 rows, monospace font for code)
- "Check My Work" → AI evaluation endpoint
- AI feedback inline
- "Mark Complete" after checking

---

## Step 5: AI Practice Evaluation Endpoint

Create `app/api/learn/practice/evaluate/route.ts`:

```typescript
// POST body: {
//   practice_type: PracticeType,
//   prompt: string,         // the original question/challenge
//   user_response: string,  // what the user wrote
//   success_criteria: string | null,  // the reference answer or criteria
//   path_topics: string[],  // for context
// }

// System prompt for evaluation:
const systemPrompt = `You are a supportive learning coach evaluating a student's practice response.

Rules:
- Be encouraging but honest. If they got it right, say so clearly. If they missed something, explain what and why.
- Keep feedback to 2-4 sentences. Don't write essays.
- Reference specific parts of their response ("You correctly identified X" or "The part about Y needs refinement").
- If their response shows misunderstanding, gently redirect without being condescending.
- End with one actionable suggestion for improvement, or affirmation if they nailed it.
- Never say "Great job!" without substance. Always explain WHY it's good or what to improve.`;

// Use GPT-4o-mini, plain chat completion (NOT Structured Outputs — natural feedback text)
// Temperature: 0.5 (slightly creative for natural-sounding feedback)
// Max tokens: 256

// Return: { feedback: string, quality: 'strong' | 'good' | 'needs_work' }
// The quality field determines the feedback card's border color:
// 'strong' = green, 'good' = blue, 'needs_work' = yellow
```

Quality assessment: include in the prompt that the AI should also output a single-word quality assessment. Parse it from the response or use a simple heuristic based on the feedback content.

Actually — use Structured Outputs for this so we get clean data:

```typescript
response_format: {
  type: 'json_schema',
  json_schema: {
    name: 'practice_feedback',
    strict: true,
    schema: {
      type: 'object',
      properties: {
        feedback: { type: 'string' },
        quality: { type: 'string', enum: ['strong', 'good', 'needs_work'] },
      },
      required: ['feedback', 'quality'],
      additionalProperties: false,
    },
  },
}
```

---

## Step 6: Update ContentViewer to Route Practice Items

Modify `components/learn/ContentViewer.tsx` (47 lines) to handle the new practice content type:

```typescript
export function ContentViewer({ item, onComplete, isCompleted }: ContentViewerProps) {
  if (item.content_type === 'video') {
    return <LearnVideoPlayer item={item} onComplete={onComplete} isCompleted={isCompleted} />;
  }
  if (item.content_type === 'article') {
    return <ArticleViewer item={item} onComplete={onComplete} isCompleted={isCompleted} />;
  }
  if (item.content_type === 'practice' && item.practice) {
    return <PracticeViewer item={item} onComplete={onComplete} isCompleted={isCompleted} />;
  }
  return null;
}
```

---

## Step 7: Update PathSidebar for Practice Items

Modify `components/learn/PathSidebar.tsx` (225 lines) to show practice items differently from content items:

- Practice items get a different icon: a pencil/edit icon for exercises, a chat icon for comprehension, a wrench icon for tool challenges
- Practice items show estimated time: "~10 min" or "~2 min"
- Practice items have a slightly different visual treatment — maybe a subtle accent background or left border to distinguish them from content items
- Label: "Practice" badge next to the title, similar to how content items show "Video" or "Article"

---

## Step 8: Update Progress Tracking

Practice items count toward path completion just like content items. The existing progress tracking in `useLearnProgress.ts` and the PATCH endpoint should work without changes because practice items are just `PathItem` objects with `content_type === 'practice'`.

However, for practice items with `ai_evaluation: true`, optionally track the evaluation result in `item_states`:

```typescript
// Extended item state for practice items:
interface PracticeItemState {
  completed: boolean;
  completed_at?: string;
  time_spent_seconds?: number;
  evaluation_quality?: 'strong' | 'good' | 'needs_work';  // NEW
  user_response?: string;  // NEW — what they wrote (for their own reference)
}
```

This lets the skill profile show not just "completed" but "completed with strong understanding." Don't gate progression on evaluation quality — all completions count equally. The quality data is for the user's own profile and for future analytics.

---

## Step 9: Practice is Encouraged, Not Required

Critical UX rule: **practice items should never block progression.** The user can always skip a practice item and move to the next content item. Show a "Skip" option (muted text, not prominent) alongside "Mark Complete."

If they skip, the item is still marked as completed (so the progress bar advances and they don't get stuck). But skipped practice items don't contribute to evaluation quality in the skill profile.

The transition card after a practice item should acknowledge their work:
- If they completed with AI evaluation: "Nice work! Let's keep going."
- If they skipped: "No worries — you can come back to practice anytime. Moving on."

---

## Validation Checklist

1. **Practice items appear in generated paths:** Generate a path for "prompt engineering." Confirm practice items are interleaved between content items — comprehension checks mid-section, tool challenges or exercises at section ends.

2. **PathSidebar shows practice items distinctly:** Practice items have different icons and "Practice" badge. They're visually distinguishable from video/article items.

3. **Comprehension check works:** Navigate to a comprehension practice item. Type an answer. Click "Check My Answer." Confirm AI feedback appears with a quality indicator (green/blue/yellow border). Click "Mark Complete."

4. **Tool challenge works:** Navigate to a tool challenge. Confirm tool card shows with name, description, and "Open [Tool] →" button. Confirm clicking the button opens the tool in a new tab. Click "I've completed this challenge."

5. **Paste-back exercise works:** Navigate to a paste-back practice item. Confirm starter code shows with copy button (if provided). Paste text into the input. Click "Check My Work." Confirm AI feedback appears. Click "Mark Complete."

6. **Skip works:** On any practice item, click "Skip." Confirm the item is marked complete and the path advances to the next item.

7. **Progress counts practice items:** A path with 8 content items + 4 practice items = 12 total. The progress bar and completion tracking use 12 as the denominator.

8. **Existing paths still work:** Paths generated before this change (no practice items) should render and function identically — no regressions. `practice: null` on old PathItems causes no errors.

9. **Tool links ONLY on tool challenges:** The "Open [Tool] →" button is the ONLY external link in the entire Learn experience. It appears ONLY on tool challenge practice items. No other component links externally.

10. **AI evaluation feedback is constructive:** Submit a wrong answer to a comprehension check. Confirm feedback explains the gap without being condescending. Submit a good answer. Confirm feedback affirms specifically what was right.

11. **Path generation doesn't break on content without scaffolding:** If a content item has `scaffolding: null`, no practice item is inserted after it. The path still works.

12. **TypeScript clean:** `npx tsc --noEmit` — zero errors.

13. **Mobile responsive:** Practice items render cleanly on mobile. Text areas are full-width. Tool cards stack vertically.
