// ─── Unified Break Content Profiles ─────────────────────────
// Single source of truth for everything that drives break
// content sourcing per world: discovery queries, channel targets,
// editorial personas, and creator authority boosts.
//
// To add a new room: add one entry to WORLD_BREAK_PROFILES.
// That's it — no other files to touch.

import { WORLD_CONFIGS, type WorldKey } from "@/lib/worlds";

// ─── Shared Constants ───────────────────────────────────────

/** Minimum video duration in seconds (2 min). */
export const MIN_DURATION = 120;
/** Maximum video duration in seconds (15 min). */
export const MAX_DURATION = 900;

// ─── Types ──────────────────────────────────────────────────

export interface ChannelSource {
  /** YouTube channel ID (UC...) */
  channelId: string;
  /** Display label for logging */
  label: string;
  /** Optional search query within the channel (empty = latest uploads) */
  query?: string;
}

export interface EditorialPersona {
  /** Short name for the persona (e.g. "Syntax", "Atlas"). */
  name: string;
  /** 3-4 sentence editorial identity for the AI scoring prompt. */
  voicePrompt: string;
  /** Per-world rejection cues (appended to reject criteria). */
  rejectPatterns: string[];
  /** Per-world preference cues (appended to prefer criteria). */
  preferPatterns: string[];
}

export interface WorldBreakProfile {
  // ── Discovery ──────────────────────────────────────────
  /** YouTube search terms — the discovery job picks 1-2 per run. Min 4. */
  queries: string[];
  /** Targeted channel sources — one is picked per run alongside topic queries. Min 3. */
  channels: ChannelSource[];
  /** Only discover videos published within this many months. Default 18. */
  publishedAfterMonths: number;

  // ── Editorial Persona ──────────────────────────────────
  persona: EditorialPersona;

  // ── Creator Authority ──────────────────────────────────
  /** Map of creator name (lowercase) → additive score boost (10–20). */
  creatorBoosts: Record<string, number>;
}

// ─── Per-World Profiles ─────────────────────────────────────

export const WORLD_BREAK_PROFILES: Record<WorldKey, WorldBreakProfile> = {
  // ────────────────────────────────────────────────────────
  // DEFAULT — Focus Room
  // ────────────────────────────────────────────────────────
  default: {
    queries: [
      "learning how to learn technique",
      "creative process deep dive talk",
      "flow state focus research",
      "science of focus and attention research",
      "how experts practice and learn skills",
    ],
    channels: [
      { channelId: "UCHnyfMqiRRG1u-2MsSQLbXA", label: "Veritasium" },
      { channelId: "UCYO_jab_esuFRV4b17AJtAw", label: "3Blue1Brown" },
      { channelId: "UCsXVk37bltHxD1rDPwtNM8Q", label: "Kurzgesagt" },
    ],
    publishedAfterMonths: 24,
    persona: {
      name: "Guide",
      voicePrompt:
        "You are Guide, a calm, clear-eyed generalist curator. You value content that teaches something transferable in under 15 minutes — workflow breakdowns, learning-how-to-learn insights, creative process deep dives. You reject motivational fluff, clickbait, and anything that wastes a focused person's break time. You prefer creators who respect the viewer's intelligence.",
      rejectPatterns: [
        "motivational fluff",
        "generic self-help",
        "clickbait thumbnails without substance",
        "content primarily about promoting a course or product",
      ],
      preferPatterns: [
        "transferable insights across disciplines",
        "workflow breakdowns",
        "learning-how-to-learn content",
        "creative process deep dives",
      ],
    },
    creatorBoosts: {
      veritasium: 15,
      "3blue1brown": 20,
      kurzgesagt: 15,
      "wendover productions": 10,
      "cgp grey": 15,
      numberphile: 10,
    },
  },

  // ────────────────────────────────────────────────────────
  // VIBE CODING
  // ────────────────────────────────────────────────────────
  "vibe-coding": {
    queries: [
      "coding workflow demo live",
      "developer tools deep dive",
      "system design architecture talk",
      "build in public dev shipping",
    ],
    channels: [
      { channelId: "UCsBjURrPoezykLs9EqgamOA", label: "Fireship" },
      { channelId: "UCyU5wkjgQYGRB0hIHMwm2Sg", label: "Matt Pocock" },
      { channelId: "UCFbNIlppjAuEX4znoulh0Cw", label: "Web Dev Simplified" },
      { channelId: "UCBcRF18a7Qf58cCRy5xuWwQ", label: "ThePrimeTime", query: "coding" },
      { channelId: "UC2Qw1dzXDBAZPwS7zm37g8g", label: "Theo", query: "developer tools" },
    ],
    publishedAfterMonths: 12,
    persona: {
      name: "Syntax",
      voicePrompt:
        "You are Syntax, a sharp curious engineer who loves shipping software quickly. You value practical workflows, live coding demos, tooling deep dives, and developer experience insights. You reject hype cycles, shallow tutorials that pad runtime, and AI drama content. You prefer creators who show real systems being built — Fireship, Theo, Primeagen, ThePrimeTime.",
      rejectPatterns: [
        "AI hype or drama content",
        "shallow beginner tutorials that pad runtime",
        "motivational talks about coding mindset",
        "content promoting a single tool without showing real usage",
        "listicle-style 'top 10' videos without depth",
      ],
      preferPatterns: [
        "practical coding workflows and demos",
        "tooling deep dives (editors, CLI, dev tools)",
        "developer experience insights",
        "system design and architecture talks",
        "build-in-public demos showing real shipping",
      ],
    },
    creatorBoosts: {
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
      devaslife: 10,
    },
  },

  // ────────────────────────────────────────────────────────
  // WRITER ROOM
  // ────────────────────────────────────────────────────────
  "writer-room": {
    queries: [
      "author revision process talk",
      "story structure narrative design craft",
      "published author writing process interview",
      "creative writing discipline showing up",
      "literary analysis close reading",
    ],
    channels: [
      { channelId: "UCXU7XVK_2Wd6tAHYO8g9vAA", label: "Brandon Sanderson", query: "writing" },
      { channelId: "UCJkMlOu7faDgqh4PfzbpLdg", label: "Nerdwriter1" },
      { channelId: "UCwtsm09UoR7y4TiJxvzmNzQ", label: "Jenna Moreci", query: "writing craft" },
      { channelId: "UCcI6AfohiK8bMbR5pKqaLow", label: "Hello Future Me", query: "writing" },
      { channelId: "UCErSSa3CaP_GJxmFpdjG9Jw", label: "Lessons from the Screenplay" },
    ],
    publishedAfterMonths: 24,
    persona: {
      name: "Quill",
      voicePrompt:
        "You are Quill, a reflective editor with deep reverence for the writing craft. You value talks about revision, structure, finding voice, and the discipline of sitting down to write. You reject AI writing tool promotions, productivity-porn content, and anything that treats writing as a hack to optimize. You prefer creators who have published real work and speak from experience.",
      rejectPatterns: [
        "AI writing tool promotions",
        "productivity hacks for writing",
        "content treating writing as a formula to optimize",
        "generic 'how to be a better writer' listicles",
      ],
      preferPatterns: [
        "revision and editing craft talks",
        "story structure and narrative design",
        "writing process from published authors",
        "creative resistance and showing up to write",
        "literary analysis and close reading",
      ],
    },
    creatorBoosts: {
      "brandon sanderson": 20,
      nerdwriter: 15,
      nerdwriter1: 15,
      "like stories of old": 15,
      "hello future me": 15,
      "lessons from the screenplay": 15,
      struthless: 10,
      "the creative independent": 10,
      "tim ferriss": 10,
    },
  },

  // ────────────────────────────────────────────────────────
  // YC BUILD PARTY
  // ────────────────────────────────────────────────────────
  "yc-build": {
    queries: [
      "startup metrics customer development",
      "founder lessons learned post mortem",
      "bootstrapped SaaS building talk",
      "technical founder scaling engineering team",
      "product market fit case study talk",
    ],
    channels: [
      { channelId: "UCcefcZRL2oaA_uBNeo5UOWg", label: "Y Combinator" },
      { channelId: "UCIBgYfDjtWlbJhg--Z4sOgQ", label: "Garry Tan" },
      { channelId: "UCxIJaCMEptJjxmmQgGFsnCg", label: "YC Startup School", query: "startup" },
    ],
    publishedAfterMonths: 18,
    persona: {
      name: "Atlas",
      voicePrompt:
        "You are Atlas, a sharp YC-style advisor obsessed with execution velocity. You value founder talks focused on metrics, customer development, scope cutting, and shipping under pressure. You reject startup motivational fluff, lifestyle content, and pitch deck advice without substance. You prefer creators with real traction — YC partners, active founders, investors who build.",
      rejectPatterns: [
        "startup motivational fluff",
        "entrepreneur lifestyle content",
        "pitch deck templates without real examples",
        "generic business advice from non-practitioners",
        "crypto/NFT startup content",
      ],
      preferPatterns: [
        "metrics-driven founder talks",
        "customer development and user research",
        "scope cutting and prioritization frameworks",
        "fundraising from practitioners",
        "post-mortem and lessons-learned talks",
      ],
    },
    creatorBoosts: {
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
  },

  // ────────────────────────────────────────────────────────
  // GENTLE START
  // ────────────────────────────────────────────────────────
  "gentle-start": {
    queries: [
      "building focus habits sustainable",
      "overcoming creative resistance procrastination",
      "self compassion creative work",
      "gentle productivity without burnout",
    ],
    channels: [
      { channelId: "UCG-KntY7aVnIGXYEBQvmBAQ", label: "Thomas Frank" },
      { channelId: "UCJ24N4O0bP7LGLBDvye7oCA", label: "Matt D'Avella" },
      { channelId: "UCIaH-gZIVC432YRjNVvnyCA", label: "Cal Newport", query: "deep work focus" },
    ],
    publishedAfterMonths: 24,
    persona: {
      name: "Bloom",
      voicePrompt:
        "You are Bloom, a warm encouraging curator who believes momentum matters more than perfection. You value content about building focus habits, gentle productivity, overcoming resistance, and finding meaning in small steps. You reject hustle culture, high-pressure productivity systems, and anything that induces guilt. You prefer creators who speak with empathy and lived experience.",
      rejectPatterns: [
        "hustle culture content",
        "high-pressure productivity systems",
        "guilt-inducing 'you're not working hard enough' messaging",
        "aggressive morning routine content",
      ],
      preferPatterns: [
        "building sustainable focus habits",
        "overcoming creative resistance",
        "mindfulness and intentional work",
        "small-step momentum strategies",
        "self-compassion in creative work",
      ],
    },
    creatorBoosts: {
      "thomas frank": 15,
      "ali abdaal": 10,
      "matt d'avella": 15,
      struthless: 10,
      "therapy in a nutshell": 10,
      "the school of life": 10,
    },
  },
};

// ─── Public API ─────────────────────────────────────────────

/**
 * Get the break profile for a world.
 * Falls back to the default profile for unknown keys.
 */
export function getBreakProfile(worldKey: string): WorldBreakProfile {
  return (
    WORLD_BREAK_PROFILES[worldKey as WorldKey] ??
    WORLD_BREAK_PROFILES.default
  );
}

/**
 * Get the editorial persona for a world (convenience wrapper).
 */
export function getEditorialPersona(worldKey: string): EditorialPersona {
  return getBreakProfile(worldKey).persona;
}

/**
 * Look up the authority boost for a creator in a given world.
 * Uses case-insensitive substring matching.
 * Also checks the default boosts (universal authorities).
 * Returns 0 if no match found.
 */
export function getCreatorBoost(
  worldKey: string,
  creatorName: string,
): number {
  const profile = getBreakProfile(worldKey);
  const normalised = creatorName.toLowerCase().trim();
  if (!normalised) return 0;

  // Merge default boosts for non-default worlds
  const defaultBoosts =
    worldKey === "default" ? {} : WORLD_BREAK_PROFILES.default.creatorBoosts;
  const allBoosts = { ...defaultBoosts, ...profile.creatorBoosts };

  for (const [key, boost] of Object.entries(allBoosts)) {
    if (normalised.includes(key) || key.includes(normalised)) {
      return boost;
    }
  }

  return 0;
}

/**
 * Pick `count` random queries from a profile (no repeats).
 */
export function pickQueries(
  profile: WorldBreakProfile,
  count = 2,
): string[] {
  const shuffled = [...profile.queries].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

/**
 * Pick one random channel source from a profile (if any exist).
 */
export function pickChannel(
  profile: WorldBreakProfile,
): ChannelSource | null {
  if (profile.channels.length === 0) return null;
  const idx = Math.floor(Math.random() * profile.channels.length);
  return profile.channels[idx];
}

// ─── Validation (dev only) ──────────────────────────────────

if (process.env.NODE_ENV === "development") {
  const worldKeys = Object.keys(WORLD_CONFIGS) as WorldKey[];
  for (const key of worldKeys) {
    if (!WORLD_BREAK_PROFILES[key]) {
      console.warn(
        `[breaks] WARNING: World "${key}" has no break profile — will fall back to default`,
      );
    }
  }

  for (const [key, profile] of Object.entries(WORLD_BREAK_PROFILES)) {
    if (profile.queries.length < 4) {
      console.warn(
        `[breaks] WARNING: "${key}" has only ${profile.queries.length} queries (min 4)`,
      );
    }
    if (profile.channels.length < 3) {
      console.warn(
        `[breaks] WARNING: "${key}" has only ${profile.channels.length} channels (min 3)`,
      );
    }
    if (profile.persona.rejectPatterns.length < 3) {
      console.warn(
        `[breaks] WARNING: "${key}" persona has only ${profile.persona.rejectPatterns.length} reject patterns (min 3)`,
      );
    }
  }
}
