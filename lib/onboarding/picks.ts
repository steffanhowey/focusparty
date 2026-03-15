import { createClient } from "@/lib/supabase/client";
import type {
  OnboardingPick,
  ProfessionalFunction,
  FluencyLevel,
} from "./types";

/**
 * Fetch editorial onboarding picks for a function × fluency combination.
 *
 * Returns the hero pick (sort_order 0) and up to 2 "also for you" picks.
 * If no exact match exists, falls back to the same function at any fluency.
 */
export async function fetchOnboardingPicks(
  primaryFunction: ProfessionalFunction,
  fluencyLevel: FluencyLevel,
  secondaryFunctions: ProfessionalFunction[] = []
): Promise<{ hero: OnboardingPick | null; also: OnboardingPick[] }> {
  const supabase = createClient();

  // Primary picks: exact function × fluency match
  const { data: primaryPicks } = await supabase
    .from("fp_onboarding_picks")
    .select("*")
    .eq("function", primaryFunction)
    .eq("fluency_level", fluencyLevel)
    .order("sort_order", { ascending: true })
    .limit(3);

  let hero: OnboardingPick | null = null;
  let also: OnboardingPick[] = [];

  if (primaryPicks && primaryPicks.length > 0) {
    hero = primaryPicks[0] as OnboardingPick;
    also = (primaryPicks.slice(1) as OnboardingPick[]);
  }

  // If we have secondary functions and need more "also" picks, fetch from those
  if (also.length < 2 && secondaryFunctions.length > 0) {
    const needed = 2 - also.length;
    const { data: secondaryPicks } = await supabase
      .from("fp_onboarding_picks")
      .select("*")
      .in("function", secondaryFunctions)
      .eq("fluency_level", fluencyLevel)
      .eq("sort_order", 0)
      .limit(needed);

    if (secondaryPicks) {
      also = [...also, ...(secondaryPicks as OnboardingPick[])];
    }
  }

  // Fallback: if no hero, try same function at any fluency
  if (!hero) {
    const { data: fallbackPicks } = await supabase
      .from("fp_onboarding_picks")
      .select("*")
      .eq("function", primaryFunction)
      .order("sort_order", { ascending: true })
      .limit(3);

    if (fallbackPicks && fallbackPicks.length > 0) {
      hero = fallbackPicks[0] as OnboardingPick;
      also = (fallbackPicks.slice(1) as OnboardingPick[]).slice(0, 2);
    }
  }

  return { hero, also: also.slice(0, 2) };
}
