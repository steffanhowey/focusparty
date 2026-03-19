"use client";

/**
 * Hook to fetch and manage the user's skill profile data.
 * Follows the same pattern as useUserProgress.
 */

import { useState, useEffect } from "react";
import type { SkillFluency, SkillReceipt } from "@/lib/types/skills";

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
  effective_fluency?: SkillFluency;
}

export interface FunctionGap {
  skill_slug: string;
  skill_name: string;
  domain_name: string;
  domain_icon: string;
}

export interface ActiveProgression {
  skill_slug: string;
  skill_name: string;
  fluency_level: SkillFluency;
  paths_completed: number;
  paths_to_next: number;
  next_level: string;
}

export interface StrongestSkill {
  skill_slug: string;
  skill_name: string;
  domain_name: string;
  fluency_level: SkillFluency;
  paths_completed: number;
}

export interface SkillGaps {
  user_function: string | null;
  function_gaps: FunctionGap[];
  active_progression: ActiveProgression[];
  strongest: StrongestSkill[];
}

/** Achievement record from the profile API. */
export interface ProfileAchievement {
  id: string;
  path_id: string;
  path_title: string;
  path_topics: string[];
  items_completed: number;
  time_invested_seconds: number;
  difficulty_level: string;
  share_slug: string;
  skill_receipt: SkillReceipt | null;
  completed_at: string;
}

interface UseSkillProfileReturn {
  domains: SkillProfileDomain[];
  summary: SkillProfileSummary | null;
  gaps: SkillGaps | null;
  achievements: ProfileAchievement[];
  isLoading: boolean;
  error: string | null;
}

export function useSkillProfile(): UseSkillProfileReturn {
  const [domains, setDomains] = useState<SkillProfileDomain[]>([]);
  const [summary, setSummary] = useState<SkillProfileSummary | null>(null);
  const [gaps, setGaps] = useState<SkillGaps | null>(null);
  const [achievements, setAchievements] = useState<ProfileAchievement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/skills/profile")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setDomains(data.domains ?? []);
        setSummary(data.summary ?? null);
        setGaps(data.gaps ?? null);
        setAchievements(data.recent_achievements ?? []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, []);

  return { domains, summary, gaps, achievements, isLoading, error };
}
