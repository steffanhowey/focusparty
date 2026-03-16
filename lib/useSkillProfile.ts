"use client";

/**
 * Hook to fetch and manage the user's skill profile data.
 * Follows the same pattern as useUserProgress.
 */

import { useState, useEffect } from "react";
import type { SkillFluency } from "@/lib/types/skills";

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
    fetch("/api/skills/profile")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setDomains(data.domains ?? []);
        setSummary(data.summary ?? null);
      })
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, []);

  return { domains, summary, isLoading, error };
}
