// ─── Content Safety Layer ────────────────────────────────────
// Defense-in-depth screening for break content. Runs BEFORE
// AI evaluation to catch obviously inappropriate content at
// the title/description level. Complements (does not replace)
// the AI evaluator's safety scoring.

// ─── Blocked keyword patterns ───────────────────────────────
// Each pattern is a regex tested case-insensitively against
// title + description. Use word boundaries (\b) to avoid
// false positives (e.g., "therapist" matching "the rapist").

const BLOCKED_PATTERNS: RegExp[] = [
  // Drugs & substances
  /\bdrug(?:s)?\b/i,
  /\bcocaine\b/i,
  /\bheroin\b/i,
  /\bfentanyl\b/i,
  /\bmethamphetamine\b/i,
  /\bmeth\b/i,
  /\bmarijuana\b/i,
  /\bcannabis\b/i,
  /\bweed\b/i,
  /\bpsychedelics?\b/i,
  /\blsd\b/i,
  /\bpsilocybin\b/i,
  /\bmdma\b/i,
  /\bnootropics?\b/i,
  /\bmicrodosing\b/i,
  /\bsubstance abuse\b/i,
  /\bopioid/i,
  /\bketamine\b/i,
  /\badderall\b/i,
  /\bamphetamine\b/i,

  // Violence & weapons
  /\bschool shooting/i,
  /\bmass shooting/i,
  /\bgun violence\b/i,
  /\bterroris[mt]/i,
  /\bextremis[mt]/i,
  /\bbomb making\b/i,
  /\bweapons? tutorial/i,

  // Hate & discrimination
  /\bhate speech\b/i,
  /\bwhite supremac/i,
  /\bneo.?nazi/i,
  /\bracist\b/i,
  /\bracism\b/i,
  /\banti.?semit/i,
  /\bhomophob/i,
  /\btransphob/i,
  /\bmisogyn/i,
  /\bincel\b/i,

  // Explicit & NSFW
  /\bpornograph/i,
  /\bnsfw\b/i,
  /\bexplicit content\b/i,
  /\bsexual content\b/i,
  /\bonlyfans\b/i,

  // Geopolitical controversy & conflict
  /\bwar crime/i,
  /\bgenocide\b/i,
  /\bethnoc?leansing/i,
  /\bcollapse of (?:south korea|north korea|china|russia|ukraine|israel|palestine|iran)/i,
  /\b(?:south korea|north korea|china|russia|ukraine|israel|palestine|iran) (?:is )?(?:over|finished|doomed|collapsing)/i,
  /\bww3\b/i,
  /\bworld war 3\b/i,
  /\bnuclear war\b/i,

  // Conspiracy & misinformation
  /\bconspiracy theor/i,
  /\bflat earth\b/i,
  /\bqanon\b/i,
  /\bdeep state\b/i,
  /\b5g (?:danger|kill|weapon|radiation)/i,
  /\banti.?vax/i,
  /\bplandemic\b/i,

  // Self-harm
  /\bsuicide (?:method|how to|tutorial)/i,
  /\bself.?harm\b/i,
  /\beating disorder tutorial/i,

  // Gambling & scams
  /\bget rich quick\b/i,
  /\bcrypto scam/i,
  /\bponzi\b/i,
  /\bpyramid scheme/i,
];

// ─── Blocked YouTube category IDs ────────────────────────────
// YouTube content categories that are never relevant for
// educational break content. IDs from YouTube API.
export const BLOCKED_CATEGORY_IDS = new Set([
  "10", // Music
  "20", // Gaming
  "17", // Sports
  "24", // Entertainment (too broad, can let through)
  "30", // Movies
  "43", // Shows
]);

// ─── Public API ──────────────────────────────────────────────

/**
 * Screen a candidate's title + description against the blocklist.
 * Returns { safe: false, reason } if blocked, { safe: true } otherwise.
 * Runs in < 1ms — zero API cost.
 */
export function screenContent(
  title: string,
  description: string | null
): { safe: true } | { safe: false; reason: string } {
  const text = `${title} ${description ?? ""}`;

  for (const pattern of BLOCKED_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      return {
        safe: false,
        reason: `Blocked keyword: "${match[0]}"`,
      };
    }
  }

  return { safe: true };
}

/**
 * The universal safety instruction injected into EVERY editorial
 * persona's evaluation prompt. Non-negotiable — appended after
 * all persona-specific guidance.
 */
export const SAFETY_PROMPT = `
CONTENT SAFETY — MANDATORY RULES (override all other guidance):
You MUST set reject=true AND safety_score=0 for ANY content that:
- Promotes recreational drug use or substance abuse
- Contains hate speech, discrimination, or extremist ideology
- Features graphic violence, weapons, or self-harm
- Pushes conspiracy theories or medical misinformation
- Is sexually explicit or NSFW in any way
- Promotes gambling, scams, or get-rich-quick schemes

IMPORTANT — these are NOT reasons to reject:
- Casual profanity or strong opinions (founders/engineers swear — that's fine)
- Edgy humor or irreverent tone (ThePrimeagen, Fireship, etc.)
- Controversial technical opinions (language wars, framework debates)
- Political commentary within startup/business context (regulation, policy)

This is a focus environment for working professionals who are adults.
Score safety_score=0 only for genuinely harmful content listed above.
Score safety_score=100 for content that is safe regardless of tone or language.
A video with F-bombs about system design should score safety_score=100.`;
