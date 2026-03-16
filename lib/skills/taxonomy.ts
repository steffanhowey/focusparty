/**
 * Skill taxonomy data access.
 * Loads and caches the canonical skill domains and skills from Supabase.
 */

import { createClient } from "@/lib/supabase/admin";
import type { SkillDomain, Skill, SkillWithDomain } from "@/lib/types/skills";

let _domains: SkillDomain[] | null = null;
let _skills: Skill[] | null = null;
let _cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function isCacheFresh(): boolean {
  return Date.now() - _cacheTime < CACHE_TTL;
}

/** Load all skill domains, cached. */
export async function getSkillDomains(): Promise<SkillDomain[]> {
  if (_domains && isCacheFresh()) return _domains;
  const supabase = createClient();
  const { data, error } = await supabase
    .from("fp_skill_domains")
    .select("*")
    .order("sort_order");
  if (error) throw error;
  _domains = data as SkillDomain[];
  _cacheTime = Date.now();
  return _domains;
}

/** Load all skills, cached. */
export async function getSkills(): Promise<Skill[]> {
  if (_skills && isCacheFresh()) return _skills;
  const supabase = createClient();
  const { data, error } = await supabase
    .from("fp_skills")
    .select("*")
    .order("sort_order");
  if (error) throw error;
  _skills = data as Skill[];
  _cacheTime = Date.now();
  return _skills;
}

/** Get skills with their domain info joined. */
export async function getSkillsWithDomains(): Promise<SkillWithDomain[]> {
  const [domains, skills] = await Promise.all([getSkillDomains(), getSkills()]);
  const domainMap = new Map(domains.map((d) => [d.id, d]));
  return skills
    .map((s) => ({ ...s, domain: domainMap.get(s.domain_id)! }))
    .filter((s) => s.domain);
}

/** Get skills relevant to a specific function. Returns universal + function-relevant. */
export async function getSkillsForFunction(fn: string): Promise<Skill[]> {
  const skills = await getSkills();
  return skills.filter(
    (s) => s.relevant_functions.length === 0 || s.relevant_functions.includes(fn),
  );
}

/** Find a skill by slug. */
export async function getSkillBySlug(slug: string): Promise<Skill | null> {
  const skills = await getSkills();
  return skills.find((s) => s.slug === slug) ?? null;
}

/** Get skills tagged on a learning path (with domain info). */
export async function getSkillTagsForPath(
  pathId: string,
): Promise<Array<SkillWithDomain & { relevance: "primary" | "secondary" }>> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("fp_skill_tags")
    .select("skill_id, relevance")
    .eq("path_id", pathId);
  if (error || !data?.length) return [];

  const allSkills = await getSkillsWithDomains();
  const tagMap = new Map(data.map((t) => [t.skill_id, t.relevance as "primary" | "secondary"]));
  return allSkills
    .filter((s) => tagMap.has(s.id))
    .map((s) => ({ ...s, relevance: tagMap.get(s.id)! }));
}

/** Invalidate the cache (call after seeding or updating taxonomy). */
export function invalidateSkillCache(): void {
  _domains = null;
  _skills = null;
  _cacheTime = 0;
}
