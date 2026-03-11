// ─── Freshness Scoring ──────────────────────────────────────
// Computes freshness-based score boosts from a candidate's
// published_at timestamp. Recent content gets promoted;
// stale content from low-authority creators gets penalised.

/**
 * Freshness dimension score (0–100) for the weighted formula.
 * Feeds into taste_score at 0.10 weight.
 */
export function computeFreshnessDimension(
  publishedAt: string | null
): number {
  if (!publishedAt) return 50; // neutral if unknown

  const ageHours =
    (Date.now() - new Date(publishedAt).getTime()) / (1000 * 60 * 60);

  if (ageHours < 24) return 100;
  if (ageHours < 72) return 85;
  if (ageHours < 168) return 70; // < 7 days
  if (ageHours < 720) return 50; // < 30 days
  return 25; // > 30 days
}

/**
 * Additive freshness bonus applied AFTER the weighted sum.
 * Matches the PRD's explicit boost values.
 *
 * High-authority creators (score >= 70) are exempt from
 * the staleness penalty — evergreen content from experts
 * should not be punished.
 */
export function computeFreshnessBonus(
  publishedAt: string | null,
  creatorAuthorityScore: number
): number {
  if (!publishedAt) return 0;

  const ageHours =
    (Date.now() - new Date(publishedAt).getTime()) / (1000 * 60 * 60);

  if (ageHours < 24) return 20;
  if (ageHours < 72) return 10;
  if (ageHours < 168) return 5; // < 7 days
  if (ageHours > 720 && creatorAuthorityScore < 70) return -10; // > 30 days penalty
  return 0;
}
