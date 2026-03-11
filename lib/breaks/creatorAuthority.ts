// ─── Creator Authority Graph ────────────────────────────────
// Static lookup of known authoritative creators per world.
// These creators receive additive score boosts when their
// content is evaluated, ensuring high-quality voices surface.

/**
 * Boost values (10–20) keyed by world → creator name (lowercase).
 * Use substring matching so "Fireship" matches "fireship".
 */
export const CREATOR_AUTHORITY_BOOSTS: Record<
  string,
  Record<string, number>
> = {
  "vibe-coding": {
    fireship: 20,
    "theo browne": 15,
    theo: 15,
    "the primeagen": 15,
    primeagen: 15,
    "andrej karpathy": 20,
    karpathy: 20,
    "web dev simplified": 15,
    "jack herrington": 15,
    "matt pocock": 15,
    "riley brown": 15,
    "sam witteveen": 10,
    "travis media": 10,
    "code with antonio": 10,
    "devaslife": 10,
  },
  "writer-room": {
    "brandon sanderson": 20,
    nerdwriter: 15,
    nerdwriter1: 15,
    "like stories of old": 15,
    struthless: 10,
    "the creative independent": 10,
    "tim ferriss": 10,
  },
  "yc-build": {
    "y combinator": 20,
    "garry tan": 15,
    "michael seibel": 15,
    "dalton caldwell": 15,
    "paul graham": 20,
    "sam altman": 15,
    "all-in podcast": 10,
    "my first million": 10,
    "lenny rachitsky": 15,
    "jason calacanis": 10,
  },
  "gentle-start": {
    "thomas frank": 15,
    "ali abdaal": 10,
    "matt d'avella": 15,
    struthless: 10,
    "therapy in a nutshell": 10,
    "the school of life": 10,
  },
  default: {
    veritasium: 15,
    "3blue1brown": 20,
    kurzgesagt: 15,
    "wendover productions": 10,
    "cgp grey": 15,
    "numberphile": 10,
  },
};

/**
 * Look up the authority boost for a creator in a given world.
 * Uses case-insensitive substring matching to handle channel
 * name variations (e.g. "Fireship" vs "fireship").
 *
 * Returns 0 if no match found.
 */
export function getCreatorBoost(
  worldKey: string,
  creatorName: string
): number {
  const boosts =
    CREATOR_AUTHORITY_BOOSTS[worldKey] ??
    CREATOR_AUTHORITY_BOOSTS["default"] ??
    {};

  const normalised = creatorName.toLowerCase().trim();
  if (!normalised) return 0;

  // Also check the default boosts (universal authorities)
  const defaultBoosts = CREATOR_AUTHORITY_BOOSTS["default"] ?? {};
  const allBoosts = worldKey === "default" ? boosts : { ...defaultBoosts, ...boosts };

  for (const [key, boost] of Object.entries(allBoosts)) {
    if (normalised.includes(key) || key.includes(normalised)) {
      return boost;
    }
  }

  return 0;
}
