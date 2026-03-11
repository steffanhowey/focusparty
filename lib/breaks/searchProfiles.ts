// ─── Per-World Search Profiles ──────────────────────────────
// Defines the YouTube search queries, channel targets, duration
// constraints, and recency filters for each room world.

export interface ChannelSource {
  /** YouTube channel ID (UC...) */
  channelId: string;
  /** Display label for logging */
  label: string;
  /** Optional search query within the channel (empty = latest uploads) */
  query?: string;
}

export interface SearchProfile {
  /** YouTube search terms — the discovery job picks 1-2 per run. */
  queries: string[];
  /** Targeted channel sources — one is picked per run alongside topic queries. */
  channels?: ChannelSource[];
  /** Minimum video duration in seconds (default 120 = 2 min). */
  minDuration: number;
  /** Maximum video duration in seconds (default 900 = 15 min). */
  maxDuration: number;
  /** Only discover videos published within this many months. */
  publishedAfterMonths: number;
}

export const WORLD_SEARCH_PROFILES: Record<string, SearchProfile> = {
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
    minDuration: 120,
    maxDuration: 900,
    publishedAfterMonths: 12,
  },

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
    ],
    minDuration: 120,
    maxDuration: 900,
    publishedAfterMonths: 24,
  },

  "yc-build": {
    queries: [
      "startup metrics customer development",
      "founder lessons learned post mortem",
      "bootstrapped SaaS building talk",
    ],
    channels: [
      { channelId: "UCcefcZRL2oaA_uBNeo5UOWg", label: "Y Combinator" },
      { channelId: "UCIBgYfDjtWlbJhg--Z4sOgQ", label: "Garry Tan" },
      { channelId: "UCxIJaCMEptJjxmmQgGFsnCg", label: "YC Startup School", query: "startup" },
    ],
    minDuration: 120,
    maxDuration: 900,
    publishedAfterMonths: 18,
  },

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
    minDuration: 120,
    maxDuration: 900,
    publishedAfterMonths: 24,
  },

  default: {
    queries: [
      "learning how to learn technique",
      "creative process deep dive talk",
      "flow state focus research",
    ],
    channels: [
      { channelId: "UCHnyfMqiRRG1u-2MsSQLbXA", label: "Veritasium" },
      { channelId: "UCYO_jab_esuFRV4b17AJtAw", label: "3Blue1Brown" },
      { channelId: "UCsXVk37bltHxD1rDPwtNM8Q", label: "Kurzgesagt" },
    ],
    minDuration: 120,
    maxDuration: 900,
    publishedAfterMonths: 24,
  },
};

/**
 * Pick `count` random queries from a profile (no repeats).
 */
export function pickQueries(profile: SearchProfile, count = 2): string[] {
  const shuffled = [...profile.queries].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

/**
 * Pick one random channel source from a profile (if any exist).
 */
export function pickChannel(profile: SearchProfile): ChannelSource | null {
  if (!profile.channels || profile.channels.length === 0) return null;
  const idx = Math.floor(Math.random() * profile.channels.length);
  return profile.channels[idx];
}
