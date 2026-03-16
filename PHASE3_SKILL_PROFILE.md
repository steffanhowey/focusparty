# Phase 3: Skill Profile Page — Surgical Implementation Plan

**Purpose:** Give users a dedicated page where they see their full skill portfolio — every skill they've developed, organized by domain, with fluency levels, progress indicators, and undiscovered skills that create forward pull. This is the persistent home of the skill graph.

**Read first:** `PHASE2_SKILL_RECEIPTS.md` (skill receipt data model), `SKILLS_IMPLEMENTATION_PLAN.md` (Phase 3 outline), `CLAUDE.md` (dev standards).

**Critical rule:** NEVER use Supabase MCP tools — the MCP is connected to the wrong project. Always provide SQL for the user to copy/paste manually.

**Depends on:** Phase 2 complete (fp_user_skills populated via skill receipts).

---

## The Emotional Design: Why This Page Matters

### The Three Moments Users Arrive Here

**Moment 1: After their first skill receipt.** They just completed a path and saw skills attached to their work for the first time. The receipt said "Your skill profile is starting to take shape." Curiosity pulls them to the nav. They click Skills. They see themselves reflected back — not as a job title, but as a collection of capabilities. Even one or two skills on a mostly-empty canvas is powerful. It says: you've started. The blank spaces aren't shame — they're invitation.

**Moment 2: After their fifth or sixth path.** They've been building for a few weeks. They click Skills and see a portfolio forming. Three domains have activity. One skill just crossed from Exploring to Practicing. They can feel momentum. This is the moment where habit crystallizes — the skill profile becomes the thing they check to feel progress, the way a runner checks their mileage log.

**Moment 3: When deciding what to learn next.** They're browsing, unsure what path to take. The skill profile shows them the answer visually: here are your gaps, here are skills one path away from leveling up, here are entire domains you haven't touched. The page doesn't just reflect — it directs. "You're Exploring in Data Storytelling with 1 path completed. One more path gets you to Practicing." That's a compelling reason to start a specific path right now.

### The Emotional Design Principle

The skill profile must accomplish two things simultaneously: **validate what you've done** and **invite what's next.**

It is not a report card. It is not a leaderboard. It is a mirror that shows your professional capabilities honestly — and a map that shows where you could go from here. The balance between these two is the entire design challenge. Too much validation and it's a trophy case nobody revisits. Too much invitation and it feels like a guilt trip about everything you haven't done.

The solution: **lead with what you've built, then let the undiscovered skills whisper from the margins.**

---

## Service Blueprint

### Data Flow

```
User clicks "Skills" in nav
  │
  ├─ Client: GET /api/skills/profile
  │
  ├─ Server:
  │    ├─ Auth check (get user from session)
  │    ├─ Load full taxonomy (getSkillsWithDomains — cached)
  │    ├─ Load user's fp_user_skills rows
  │    ├─ Join: for each domain, merge user's progress with full skill list
  │    │   → Skills with progress: show fluency level, paths_completed, etc.
  │    │   → Skills without progress: show as "undiscovered" (dimmed)
  │    ├─ Compute summary stats (total started, distribution by fluency)
  │    └─ Return structured response
  │
  └─ Client:
       ├─ Summary hero (stats cards)
       ├─ Domain sections (collapsible, auto-expanded if user has progress)
       │   └─ Skill cards within each domain
       └─ Empty state (if no skills yet → CTA to learn)
```

### Page Architecture

```
/skills (hub page)
  │
  ├─ SkillProfilePage (client component — components/skills/SkillProfilePage.tsx)
  │   ├─ Loading state (spinner, matches ProgressDashboard pattern)
  │   ├─ Empty state (no skills yet → compelling CTA)
  │   └─ Full state:
  │       ├─ Summary hero (4 stat cards in grid)
  │       ├─ Domain sections (one per domain that has ANY skills in taxonomy)
  │       │   └─ SkillDomainSection (collapsible)
  │       │       ├─ Domain header (icon + name + progress indicator)
  │       │       └─ Skill grid (2-col on mobile, 3-col on desktop)
  │       │           └─ SkillCard (individual skill)
  │       │               ├─ Active: name + fluency badge + paths count
  │       │               └─ Undiscovered: name + dimmed "Start" CTA
  │       └─ Footer CTA ("Explore learning paths")
  │
  └─ API: /api/skills/profile (GET)
```

---

## Implementation: Step-by-Step

### Step 1: Skill Profile API

**File:** Create `app/api/skills/profile/route.ts`

```typescript
/**
 * GET /api/skills/profile
 *
 * Returns the authenticated user's full skill profile.
 * Merges the complete skill taxonomy with the user's fp_user_skills data
 * to produce a domain-organized view showing both active and undiscovered skills.
 */

import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { getSkillDomains, getSkills } from '@/lib/skills/taxonomy';
import { fluencyIndex } from '@/lib/skills/assessment';
import type { SkillFluency, UserSkill } from '@/lib/types/skills';

export async function GET(): Promise<Response> {
  // Auth check
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();

  // Load taxonomy and user skills in parallel
  const [domains, skills, userSkillsResult] = await Promise.all([
    getSkillDomains(),
    getSkills(),
    admin
      .from('fp_user_skills')
      .select('*')
      .eq('user_id', user.id),
  ]);

  const userSkillMap = new Map(
    (userSkillsResult.data ?? []).map((s: UserSkill) => [s.skill_id, s])
  );

  // Build domain-organized response
  const domainSections = domains.map(domain => {
    const domainSkills = skills
      .filter(s => s.domain_id === domain.id)
      .map(skill => {
        const userSkill = userSkillMap.get(skill.id);
        return {
          skill: {
            id: skill.id,
            slug: skill.slug,
            name: skill.name,
            description: skill.description,
            relevant_functions: skill.relevant_functions,
          },
          // User progress (null if undiscovered)
          progress: userSkill ? {
            fluency_level: userSkill.fluency_level as SkillFluency,
            paths_completed: userSkill.paths_completed,
            missions_completed: userSkill.missions_completed,
            avg_score: userSkill.avg_score,
            last_demonstrated_at: userSkill.last_demonstrated_at,
          } : null,
        };
      })
      // Sort: active skills first (by fluency desc), then undiscovered
      .sort((a, b) => {
        if (a.progress && !b.progress) return -1;
        if (!a.progress && b.progress) return 1;
        if (a.progress && b.progress) {
          return fluencyIndex(b.progress.fluency_level) - fluencyIndex(a.progress.fluency_level);
        }
        return 0;
      });

    const activeSkills = domainSkills.filter(s => s.progress);
    const avgFluency = activeSkills.length > 0
      ? activeSkills.reduce((sum, s) => sum + fluencyIndex(s.progress!.fluency_level), 0) / activeSkills.length
      : 0;

    return {
      domain: {
        id: domain.id,
        slug: domain.slug,
        name: domain.name,
        description: domain.description,
        icon: domain.icon,
      },
      skills: domainSkills,
      active_count: activeSkills.length,
      total_count: domainSkills.length,
      avg_fluency: Math.round(avgFluency * 100) / 100,
    };
  });

  // Summary stats
  const allUserSkills = userSkillsResult.data ?? [];
  const summary = {
    total_skills_started: allUserSkills.length,
    total_skills_available: skills.length,
    skills_at_exploring: allUserSkills.filter((s: UserSkill) => s.fluency_level === 'exploring').length,
    skills_at_practicing: allUserSkills.filter((s: UserSkill) => s.fluency_level === 'practicing').length,
    skills_at_proficient: allUserSkills.filter((s: UserSkill) => s.fluency_level === 'proficient').length,
    skills_at_advanced: allUserSkills.filter((s: UserSkill) => s.fluency_level === 'advanced').length,
    total_paths_completed: allUserSkills.reduce((sum: number, s: UserSkill) => sum + s.paths_completed, 0),
  };

  return NextResponse.json({ domains: domainSections, summary });
}
```

### Step 2: Navigation Integration

**File:** `components/shell/navItems.tsx`

Add Skills to the nav. Place it after Learn (position 2), before Practice.

```typescript
import { BarChart3, BookOpen, Sparkles, Target, Settings, Users, type LucideIcon } from "lucide-react";
```

Update the `NAV_ITEMS` array:

```typescript
export const NAV_ITEMS: Array<{
  id: string;
  href: string;
  label: string;
  icon: LucideIcon;
}> = [
  { id: "learn", href: "/learn", label: "Learn", icon: BookOpen },
  { id: "skills", href: "/skills", label: "Skills", icon: Sparkles },
  { id: "practice", href: "/practice", label: "Practice", icon: Users },
  { id: "goals", href: "/goals", label: "Goals", icon: Target },
  { id: "stats", href: "/stats", label: "Stats", icon: BarChart3 },
  { id: "settings", href: "/settings", label: "Settings", icon: Settings },
];
```

**Why Sparkles?** The original plan suggested `Gem` but that doesn't exist in lucide-react. `Sparkles` communicates growth/achievement and is already imported in SkillReceipt.tsx. It's distinctive from the other nav icons (none of which use particle/sparkle shapes).

### Step 3: Hub Page Route

**File:** Create `app/(hub)/skills/page.tsx`

```typescript
import { SkillProfilePage } from '@/components/skills/SkillProfilePage';

export default function SkillsPage() {
  return <SkillProfilePage />;
}
```

Minimal page wrapper — follows the pattern of other hub pages (e.g., `app/(hub)/stats/page.tsx` renders `<ProgressDashboard />`).

### Step 4: Data Hook

**File:** Create `lib/useSkillProfile.ts`

```typescript
'use client';

/**
 * Hook to fetch and manage the user's skill profile data.
 * Follows the same pattern as useUserProgress.
 */

import { useState, useEffect } from 'react';
import type { SkillFluency } from '@/lib/types/skills';

// ─── Types (API response shapes) ────────────────────────────

export interface SkillProfileSkill {
  skill: {
    id: string;
    slug: string;
    name: string;
    description: string;
    relevant_functions: string[];
  };
  progress: {
    fluency_level: SkillFluency;
    paths_completed: number;
    missions_completed: number;
    avg_score: number | null;
    last_demonstrated_at: string;
  } | null;
}

export interface SkillProfileDomain {
  domain: {
    id: string;
    slug: string;
    name: string;
    description: string;
    icon: string;
  };
  skills: SkillProfileSkill[];
  active_count: number;
  total_count: number;
  avg_fluency: number;
}

export interface SkillProfileSummary {
  total_skills_started: number;
  total_skills_available: number;
  skills_at_exploring: number;
  skills_at_practicing: number;
  skills_at_proficient: number;
  skills_at_advanced: number;
  total_paths_completed: number;
}

interface UseSkillProfileReturn {
  domains: SkillProfileDomain[];
  summary: SkillProfileSummary | null;
  isLoading: boolean;
  error: string | null;
}

export function useSkillProfile(): UseSkillProfileReturn {
  const [domains, setDomains] = useState<SkillProfileDomain[]>([]);
  const [summary, setSummary] = useState<SkillProfileSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/skills/profile')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        setDomains(data.domains ?? []);
        setSummary(data.summary ?? null);
      })
      .catch(err => setError(err.message))
      .finally(() => setIsLoading(false));
  }, []);

  return { domains, summary, isLoading, error };
}
```

### Step 5: Shared FluencyBadge Component

The skill receipt already has a FluencyBadge. Extract it to a shared location so both the receipt and the profile page can use it.

**File:** Create `components/skills/FluencyBadge.tsx`

```typescript
'use client';

/**
 * Reusable fluency level badge.
 * Color = achievement state. Each fluency level maps to a semantic color.
 */

import { fluencyLabel } from '@/lib/skills/assessment';
import type { SkillFluency } from '@/lib/types/skills';

const FLUENCY_COLORS: Record<SkillFluency, string> = {
  exploring: 'var(--color-text-tertiary)',
  practicing: 'var(--color-cyan-700)',
  proficient: 'var(--color-green-700)',
  advanced: 'var(--color-violet-700)',
};

interface FluencyBadgeProps {
  level: SkillFluency;
  size?: 'sm' | 'default' | 'lg';
}

export function FluencyBadge({ level, size = 'default' }: FluencyBadgeProps) {
  const color = FLUENCY_COLORS[level];
  const label = fluencyLabel(level);

  const sizeClasses: Record<string, string> = {
    sm: 'text-[10px] px-1.5 py-0.5',
    default: 'text-xs px-2 py-0.5',
    lg: 'text-xs px-2.5 py-1',
  };

  return (
    <span
      className={`${sizeClasses[size]} rounded-full font-medium inline-flex items-center`}
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
```

After creating this, update `components/learn/SkillReceipt.tsx` to import `FluencyBadge` from `@/components/skills/FluencyBadge` instead of its inline definition.

### Step 6: SkillCard Component

**File:** Create `components/skills/SkillCard.tsx`

```typescript
'use client';

/**
 * Individual skill display within a domain section.
 *
 * Two states:
 * - Active: has user progress → shows fluency badge + paths count
 * - Undiscovered: no progress → dimmed with subtle "Explore" action
 *
 * Design principle: active skills feel solid and earned.
 * Undiscovered skills are visible but quiet — invitation, not guilt.
 */

import { Card } from '@/components/ui/Card';
import { FluencyBadge } from '@/components/skills/FluencyBadge';
import type { SkillProfileSkill } from '@/lib/useSkillProfile';
import { BookOpen } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface SkillCardProps {
  data: SkillProfileSkill;
}

export function SkillCard({ data }: SkillCardProps) {
  const router = useRouter();
  const { skill, progress } = data;
  const isActive = progress !== null;

  if (isActive) {
    return (
      <Card className="p-3.5 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h4 className="text-sm font-medium text-[var(--color-text-primary)] leading-snug">
            {skill.name}
          </h4>
          <FluencyBadge level={progress.fluency_level} size="sm" />
        </div>
        <div className="flex items-center gap-3 text-xs text-[var(--color-text-tertiary)]">
          <span>{progress.paths_completed} path{progress.paths_completed !== 1 ? 's' : ''}</span>
          {progress.missions_completed > 0 && (
            <>
              <span>&middot;</span>
              <span>{progress.missions_completed} mission{progress.missions_completed !== 1 ? 's' : ''}</span>
            </>
          )}
        </div>
      </Card>
    );
  }

  // Undiscovered skill
  return (
    <button
      type="button"
      onClick={() => router.push(`/learn?q=${encodeURIComponent(skill.name)}`)}
      className="w-full text-left rounded-md p-3.5 space-y-1 transition-colors cursor-pointer"
      style={{
        background: 'transparent',
        border: '1px dashed var(--color-border-default)',
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-medium text-[var(--color-text-tertiary)]">
          {skill.name}
        </h4>
        <BookOpen size={12} className="text-[var(--color-text-tertiary)] opacity-50" />
      </div>
      <p className="text-[10px] text-[var(--color-text-tertiary)] opacity-60">
        Start exploring
      </p>
    </button>
  );
}
```

**Design decisions:**

- Active skills use `<Card>` with solid border (earned, permanent feel)
- Undiscovered skills use a dashed border on a plain button (invitation, not a card — they haven't earned the card yet)
- Clicking an undiscovered skill navigates to `/learn?q=skill_name` which pre-fills the search with that skill topic
- No empty state text like "You haven't started this" — the dashed border and dimmed text communicate this visually without words

### Step 7: SkillDomainSection Component

**File:** Create `components/skills/SkillDomainSection.tsx`

```typescript
'use client';

/**
 * A collapsible section for one skill domain.
 * Shows domain name, progress indicator, and skill cards.
 *
 * Auto-expanded if the user has any active skills in this domain.
 * Collapsed if all skills are undiscovered (to avoid overwhelming the page).
 */

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { SkillCard } from '@/components/skills/SkillCard';
import type { SkillProfileDomain } from '@/lib/useSkillProfile';

interface SkillDomainSectionProps {
  domain: SkillProfileDomain;
  /** Animation delay for staggered entrance */
  index: number;
}

export function SkillDomainSection({ domain, index }: SkillDomainSectionProps) {
  const hasActivity = domain.active_count > 0;
  const [isExpanded, setIsExpanded] = useState(hasActivity);

  return (
    <div
      className="animate-fade-in"
      style={{ animationDelay: `${index * 80}ms`, animationFillMode: 'backwards' }}
    >
      {/* Domain header (clickable to toggle) */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between gap-3 py-3 cursor-pointer group"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
            {domain.domain.name}
          </h3>
          {/* Progress indicator */}
          <span className="text-xs text-[var(--color-text-tertiary)] shrink-0">
            {domain.active_count}/{domain.total_count}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Mini progress bar */}
          <div
            className="w-16 h-1 rounded-full overflow-hidden"
            style={{ background: 'var(--color-bg-hover)' }}
          >
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${(domain.active_count / domain.total_count) * 100}%`,
                background: hasActivity
                  ? 'var(--color-accent-primary)'
                  : 'transparent',
              }}
            />
          </div>

          <ChevronDown
            size={14}
            className={`text-[var(--color-text-tertiary)] transition-transform duration-200 ${
              isExpanded ? 'rotate-180' : ''
            }`}
          />
        </div>
      </button>

      {/* Skill cards grid */}
      {isExpanded && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pb-4">
          {domain.skills.map(skill => (
            <SkillCard key={skill.skill.slug} data={skill} />
          ))}
        </div>
      )}
    </div>
  );
}
```

**Design decisions:**

- Domains with activity auto-expand; empty domains start collapsed
- Progress bar is subtle (16px × 1px) — communicates ratio without dominating
- Chevron rotates on expand/collapse for clear affordance
- Grid is 1-col mobile, 2-col tablet, 3-col desktop — matches the density of 5-6 skills per domain
- 80ms stagger between domain sections creates a smooth cascading entrance

### Step 8: Main Profile Page Component

**File:** Create `components/skills/SkillProfilePage.tsx`

```typescript
'use client';

/**
 * Skill Profile Page — the persistent home of the user's skill graph.
 *
 * Layout follows the ProgressDashboard pattern:
 * - Summary stats grid at top
 * - Sections below with consistent spacing
 *
 * No page-level padding — HubShell provides px-4/px-5/px-6.
 * No explicit max-width — uses the shell's content area.
 */

import { Sparkles, TrendingUp, Award, Layers } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useSkillProfile } from '@/lib/useSkillProfile';
import { SkillDomainSection } from '@/components/skills/SkillDomainSection';
import { useRouter } from 'next/navigation';

// ─── Stats Card (matches progress/StatsCard pattern) ────────

function SkillStatCard({
  label,
  value,
  sublabel,
  icon,
}: {
  label: string;
  value: string | number;
  sublabel?: string;
  icon: React.ReactNode;
}) {
  return (
    <Card variant="default" className="p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-[var(--color-text-secondary)]">{label}</p>
          <p className="mt-1 text-2xl font-bold text-white">{value}</p>
          {sublabel && (
            <p className="mt-0.5 text-xs text-[var(--color-text-tertiary)]">
              {sublabel}
            </p>
          )}
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-bg-hover)] text-[var(--color-text-secondary)]">
          {icon}
        </div>
      </div>
    </Card>
  );
}

// ─── Empty State ────────────────────────────────────────────

function EmptyState() {
  const router = useRouter();

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
      <div
        className="flex h-12 w-12 items-center justify-center rounded-full"
        style={{ background: 'var(--color-bg-hover)' }}
      >
        <Sparkles size={20} className="text-[var(--color-text-tertiary)]" />
      </div>
      <div className="space-y-1.5">
        <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
          Your skill profile starts here
        </h3>
        <p className="text-sm text-[var(--color-text-secondary)] max-w-sm">
          Complete learning paths to discover your skills. Each path develops specific AI capabilities and tracks your fluency.
        </p>
      </div>
      <Button
        variant="primary"
        size="sm"
        onClick={() => router.push('/learn')}
      >
        Start a learning path
      </Button>
    </div>
  );
}

// ─── Loading State ──────────────────────────────────────────

function LoadingState() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-text-tertiary)] border-t-transparent" />
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────

export function SkillProfilePage() {
  const { domains, summary, isLoading, error } = useSkillProfile();

  if (isLoading) return <LoadingState />;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-sm text-[var(--color-text-secondary)]">{error}</p>
      </div>
    );
  }

  if (!summary || summary.total_skills_started === 0) {
    return <EmptyState />;
  }

  // Determine the "strongest fluency" for the hero
  const highestFluency =
    summary.skills_at_advanced > 0 ? 'Advanced' :
    summary.skills_at_proficient > 0 ? 'Proficient' :
    summary.skills_at_practicing > 0 ? 'Practicing' :
    'Exploring';

  return (
    <div className="space-y-6">
      {/* Subtitle */}
      <div>
        <p className="text-sm text-[var(--color-text-secondary)]">
          Your AI skill portfolio
        </p>
      </div>

      {/* Summary Stats Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SkillStatCard
          label="Skills"
          value={summary.total_skills_started}
          sublabel={`of ${summary.total_skills_available}`}
          icon={<Sparkles size={18} />}
        />
        <SkillStatCard
          label="Paths"
          value={summary.total_paths_completed}
          sublabel="completed"
          icon={<Award size={18} />}
        />
        <SkillStatCard
          label="Practicing+"
          value={summary.skills_at_practicing + summary.skills_at_proficient + summary.skills_at_advanced}
          sublabel="skills"
          icon={<TrendingUp size={18} />}
        />
        <SkillStatCard
          label="Domains"
          value={domains.filter(d => d.active_count > 0).length}
          sublabel={`of ${domains.length}`}
          icon={<Layers size={18} />}
        />
      </div>

      {/* Fluency Distribution (compact inline bar) */}
      {summary.total_skills_started > 1 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-[var(--color-text-secondary)]">
            Fluency Distribution
          </h3>
          <div className="flex gap-1 h-2 rounded-full overflow-hidden bg-[var(--color-bg-hover)]">
            {summary.skills_at_advanced > 0 && (
              <div
                className="h-full rounded-full"
                style={{
                  width: `${(summary.skills_at_advanced / summary.total_skills_started) * 100}%`,
                  background: 'var(--color-violet-700)',
                  minWidth: '4px',
                }}
              />
            )}
            {summary.skills_at_proficient > 0 && (
              <div
                className="h-full rounded-full"
                style={{
                  width: `${(summary.skills_at_proficient / summary.total_skills_started) * 100}%`,
                  background: 'var(--color-green-700)',
                  minWidth: '4px',
                }}
              />
            )}
            {summary.skills_at_practicing > 0 && (
              <div
                className="h-full rounded-full"
                style={{
                  width: `${(summary.skills_at_practicing / summary.total_skills_started) * 100}%`,
                  background: 'var(--color-cyan-700)',
                  minWidth: '4px',
                }}
              />
            )}
            {summary.skills_at_exploring > 0 && (
              <div
                className="h-full rounded-full"
                style={{
                  width: `${(summary.skills_at_exploring / summary.total_skills_started) * 100}%`,
                  background: 'var(--color-text-tertiary)',
                  minWidth: '4px',
                  opacity: 0.4,
                }}
              />
            )}
          </div>
          {/* Legend */}
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {summary.skills_at_advanced > 0 && (
              <span className="flex items-center gap-1.5 text-xs text-[var(--color-text-tertiary)]">
                <span className="w-2 h-2 rounded-full" style={{ background: 'var(--color-violet-700)' }} />
                Advanced ({summary.skills_at_advanced})
              </span>
            )}
            {summary.skills_at_proficient > 0 && (
              <span className="flex items-center gap-1.5 text-xs text-[var(--color-text-tertiary)]">
                <span className="w-2 h-2 rounded-full" style={{ background: 'var(--color-green-700)' }} />
                Proficient ({summary.skills_at_proficient})
              </span>
            )}
            {summary.skills_at_practicing > 0 && (
              <span className="flex items-center gap-1.5 text-xs text-[var(--color-text-tertiary)]">
                <span className="w-2 h-2 rounded-full" style={{ background: 'var(--color-cyan-700)' }} />
                Practicing ({summary.skills_at_practicing})
              </span>
            )}
            {summary.skills_at_exploring > 0 && (
              <span className="flex items-center gap-1.5 text-xs text-[var(--color-text-tertiary)]">
                <span className="w-2 h-2 rounded-full" style={{ background: 'var(--color-text-tertiary)', opacity: 0.4 }} />
                Exploring ({summary.skills_at_exploring})
              </span>
            )}
          </div>
        </div>
      )}

      {/* Domain Sections */}
      <div>
        <h3 className="mb-3 text-sm font-medium text-[var(--color-text-secondary)]">
          Skill Domains
        </h3>
        <div className="divide-y divide-[var(--color-border-default)]">
          {domains.map((domain, i) => (
            <SkillDomainSection key={domain.domain.slug} domain={domain} index={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
```

**Design decisions:**

- **No max-width constraint.** Follows the ProgressDashboard pattern (full-width within shell) rather than the Profile pattern (max-w-3xl). The skill profile has more horizontal content (3-col grids) that benefits from the extra space.
- **Stats cards match StatsCard exactly** — same layout, same Card variant, same typography hierarchy. Visual consistency with the stats page.
- **Fluency distribution bar** only shows when 2+ skills exist. Single-skill profiles don't need a distribution. The bar uses the same color mapping as FluencyBadge (violet → green → cyan → gray) for consistency.
- **Domain sections use dividers** between them, not cards wrapping each section. This is lighter and prevents visual nesting (cards within cards look heavy).
- **Empty state** is warm and directional: "Your skill profile starts here" + CTA to learn page.

### Step 9: Update SkillReceipt to Use Shared FluencyBadge

**File:** `components/learn/SkillReceipt.tsx`

Replace the inline `FluencyBadge` function and its `FLUENCY_COLORS` constant with an import:

```typescript
// Remove the inline FluencyBadge function and FLUENCY_COLORS map
// Add this import instead:
import { FluencyBadge } from '@/components/skills/FluencyBadge';
```

The rest of SkillReceipt.tsx stays unchanged — the interface is identical.

---

## Visual Design Specification

### Layout (Full Page)

```
┌──────────────────────────────────────────────────────────┐
│  Skills                                    (HubShell hdr)│
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Your AI skill portfolio                                 │
│                                                          │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────┐│
│  │ Skills     │ │ Paths      │ │ Practicing+│ │ Domains││
│  │ 7          │ │ 12         │ │ 3          │ │ 4      ││
│  │ of 40      │ │ completed  │ │ skills     │ │ of 8   ││
│  └────────────┘ └────────────┘ └────────────┘ └────────┘│
│                                                          │
│  Fluency Distribution                                    │
│  ████████░░░░░░░░░░░░░░░░░░░░░░░░░░░                    │
│  ● Proficient (1)  ● Practicing (2)  ○ Exploring (4)    │
│                                                          │
│  Skill Domains                                           │
│  ─────────────────────────────────────────────────────   │
│                                                          │
│  ▸ Writing & Communication              2/5  ▬▬░░░  ▾   │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐     │
│  │ Prompt Eng.  │ │ AI Writing   │ │╌╌╌╌╌╌╌╌╌╌╌╌╌│     │
│  │ [Practicing] │ │ [Exploring]  │ │ Content Strat│     │
│  │ 3 paths      │ │ 1 path       │ │ Start explor.│     │
│  └──────────────┘ └──────────────┘ └──────────────┘     │
│  ┌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┐ ┌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┐                    │
│  │ Tone Calib.   │ │ Email Gen.   │                     │
│  │ Start explor. │ │ Start explor.│                     │
│  └╌╌╌╌╌╌╌╌╌╌╌╌╌╌┘ └╌╌╌╌╌╌╌╌╌╌╌╌╌╌┘                    │
│  ─────────────────────────────────────────────────────   │
│                                                          │
│  ▸ Technical Building                   1/5  ▬░░░░  ▾   │
│  ┌──────────────┐ ┌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┐ ...                 │
│  │ AI Code Gen  │ │ AI Debugging  │                     │
│  │ [Proficient] │ │ Start explor. │                     │
│  │ 5 paths      │ │               │                     │
│  └──────────────┘ └╌╌╌╌╌╌╌╌╌╌╌╌╌╌┘                     │
│  ─────────────────────────────────────────────────────   │
│                                                          │
│  ▸ Data & Analysis                      0/5        ▸    │
│  (collapsed — no active skills)                          │
│  ─────────────────────────────────────────────────────   │
│  ...                                                     │
└──────────────────────────────────────────────────────────┘

Legend:
  ┌──────┐ = Active skill (Card with solid border)
  ┌╌╌╌╌╌╌┐ = Undiscovered skill (dashed border, dimmed)
```

### Empty State

```
┌──────────────────────────────────────────────────────────┐
│  Skills                                    (HubShell hdr)│
├──────────────────────────────────────────────────────────┤
│                                                          │
│                                                          │
│                                                          │
│                       (✨)                                │
│                                                          │
│            Your skill profile starts here                │
│                                                          │
│        Complete learning paths to discover your          │
│        skills. Each path develops specific AI            │
│        capabilities and tracks your fluency.             │
│                                                          │
│              [Start a learning path]                     │
│                                                          │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### Component Visual Hierarchy

| Element | Typography | Color |
|---------|-----------|-------|
| Page subtitle | `text-sm` | `--color-text-secondary` |
| Stat card label | `text-sm` | `--color-text-secondary` |
| Stat card value | `text-2xl font-bold` | `white` |
| Stat card sublabel | `text-xs` | `--color-text-tertiary` |
| Section header | `text-sm font-medium` | `--color-text-secondary` |
| Domain name | `text-sm font-semibold` | `--color-text-primary` |
| Domain counter | `text-xs` | `--color-text-tertiary` |
| Active skill name | `text-sm font-medium` | `--color-text-primary` |
| Active skill meta | `text-xs` | `--color-text-tertiary` |
| Undiscovered skill name | `text-sm font-medium` | `--color-text-tertiary` |
| Undiscovered CTA | `text-[10px]` | `--color-text-tertiary` opacity 60% |

---

## Edge Cases

### User has no completed paths with skill tags
The profile API returns `summary.total_skills_started === 0`. The page shows the empty state with a CTA to the learn page. No domains render.

### User has skills in only 1-2 domains
The summary stats still show "Domains: 2 of 8" — this isn't embarrassing, it's informative. Domains with no activity start collapsed, so the page doesn't feel empty. The expanded domains with actual skills dominate visually.

### All skills are at Exploring level
The fluency distribution bar shows 100% gray. This is fine — the message is "you've started, keep going." The stats card shows "Practicing+: 0 skills" which creates natural pull toward leveling up.

### A domain has many undiscovered skills (5-6) and no active ones
The domain starts collapsed. When expanded, the dashed-border cards fill the grid. The visual weight is light (dashed borders, dim text) so it doesn't feel like a wall of failures.

### User has 20+ active skills
The page becomes long. The collapsible domain sections handle this — users can collapse domains they don't want to see. The sticky summary at top means they always see their high-level stats without scrolling.

### Skill taxonomy grows (new skills added later)
New skills appear as undiscovered in their domain sections automatically. The API joins the full taxonomy with user data, so new taxonomy entries appear without any user-side changes.

---

## HubShell Header Configuration

The HubShell renders a header bar for non-practice/learn pages. The Skills page gets:
- **Title:** "Skills" (from the page route — HubShell uses nav item labels)
- **No action button** for now (Phase 5 could add "Browse by Skill" here)

---

## Order of Operations

1. **Create `app/api/skills/profile/route.ts`** — the API endpoint
2. **Modify `components/shell/navItems.tsx`** — add Skills to nav with Sparkles icon
3. **Create `app/(hub)/skills/page.tsx`** — minimal page wrapper
4. **Create `lib/useSkillProfile.ts`** — data fetching hook
5. **Create `components/skills/FluencyBadge.tsx`** — shared fluency badge
6. **Create `components/skills/SkillCard.tsx`** — individual skill display
7. **Create `components/skills/SkillDomainSection.tsx`** — collapsible domain section
8. **Create `components/skills/SkillProfilePage.tsx`** — main page component
9. **Modify `components/learn/SkillReceipt.tsx`** — replace inline FluencyBadge with shared import

### Verification Checklist

- [ ] `/api/skills/profile` returns domains with merged user skill data
- [ ] Nav shows "Skills" link with Sparkles icon between Learn and Practice
- [ ] Skills page renders with summary stats when user has skills
- [ ] Empty state renders with CTA when user has no skills
- [ ] Active skills show fluency badge and path count
- [ ] Undiscovered skills show dashed border and "Start exploring" text
- [ ] Clicking undiscovered skill navigates to `/learn?q=skill_name`
- [ ] Domains with activity auto-expand; empty domains start collapsed
- [ ] Domain chevron toggles expand/collapse correctly
- [ ] Fluency distribution bar renders with correct proportions and colors
- [ ] Domain progress bars show correct fill
- [ ] SkillReceipt still works correctly after FluencyBadge extraction
- [ ] Loading spinner matches ProgressDashboard pattern
- [ ] Mobile layout: stats in 2-col, skills in 1-col
- [ ] No hardcoded colors — all CSS variables

---

## Files Created / Modified

| Action | File | What Changes |
|--------|------|-------------|
| CREATE | `app/api/skills/profile/route.ts` | Profile API endpoint |
| MODIFY | `components/shell/navItems.tsx` | Add Skills nav item with Sparkles icon |
| CREATE | `app/(hub)/skills/page.tsx` | Page route wrapper |
| CREATE | `lib/useSkillProfile.ts` | Data fetching hook |
| CREATE | `components/skills/FluencyBadge.tsx` | Shared fluency badge component |
| CREATE | `components/skills/SkillCard.tsx` | Individual skill card |
| CREATE | `components/skills/SkillDomainSection.tsx` | Collapsible domain section |
| CREATE | `components/skills/SkillProfilePage.tsx` | Main profile page component |
| MODIFY | `components/learn/SkillReceipt.tsx` | Use shared FluencyBadge import |

**Total: 7 new files, 2 modified files.**
