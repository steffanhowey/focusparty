// ─── Synthetic Participant Pool ──────────────────────────────
// 12 curated ambient coworkers — 3 per archetype.
// They generate lightweight activity events so rooms feel alive
// even when real-user density is low.

export type SyntheticArchetype = "coder" | "writer" | "founder" | "gentle";

/** Event types a synthetic participant can generate. */
export type SyntheticEventType =
  | "participant_joined"
  | "session_started"
  | "sprint_completed"
  | "session_completed"
  | "participant_left";

export interface SyntheticParticipant {
  /** Stable identifier — stored in payload.synthetic_id, never in user_id FK. */
  id: string;
  handle: string;
  displayName: string;
  /** Placeholder avatar image URL (Unsplash). */
  avatarUrl: string;
  archetype: SyntheticArchetype;
  /** Worlds this synthetic prefers (higher affinity for appearing). */
  preferredWorldKeys: string[];
  /** Relative weights for each event type. Higher = more likely. */
  activityBias: Record<SyntheticEventType, number>;
}

// ─── Pool ────────────────────────────────────────────────────

export const SYNTHETIC_POOL: SyntheticParticipant[] = [
  // ── Coders ──
  {
    id: "syn-kai",
    handle: "kai",
    displayName: "Kai",
    avatarUrl: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=80&q=80&fit=crop&crop=face",
    archetype: "coder",
    preferredWorldKeys: ["vibe-coding", "default", "yc-build"],
    activityBias: {
      participant_joined: 1.0,
      session_started: 1.2,
      sprint_completed: 1.5,
      session_completed: 1.0,
      participant_left: 0.8,
    },
  },
  {
    id: "syn-rio",
    handle: "rio",
    displayName: "Rio",
    avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&q=80&fit=crop&crop=face",
    archetype: "coder",
    preferredWorldKeys: ["vibe-coding", "default"],
    activityBias: {
      participant_joined: 1.0,
      session_started: 1.3,
      sprint_completed: 1.4,
      session_completed: 0.9,
      participant_left: 0.7,
    },
  },
  {
    id: "syn-dev",
    handle: "dev",
    displayName: "Dev",
    avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=80&q=80&fit=crop&crop=face",
    archetype: "coder",
    preferredWorldKeys: ["vibe-coding", "yc-build", "default"],
    activityBias: {
      participant_joined: 0.9,
      session_started: 1.1,
      sprint_completed: 1.6,
      session_completed: 1.1,
      participant_left: 0.8,
    },
  },

  // ── Writers ──
  {
    id: "syn-sage",
    handle: "sage",
    displayName: "Sage",
    avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&q=80&fit=crop&crop=face",
    archetype: "writer",
    preferredWorldKeys: ["writer-room", "default", "gentle-start"],
    activityBias: {
      participant_joined: 1.0,
      session_started: 1.1,
      sprint_completed: 1.3,
      session_completed: 1.0,
      participant_left: 0.9,
    },
  },
  {
    id: "syn-ellis",
    handle: "ellis",
    displayName: "Ellis",
    avatarUrl: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=80&q=80&fit=crop&crop=face",
    archetype: "writer",
    preferredWorldKeys: ["writer-room", "default"],
    activityBias: {
      participant_joined: 1.0,
      session_started: 1.2,
      sprint_completed: 1.2,
      session_completed: 1.0,
      participant_left: 0.8,
    },
  },
  {
    id: "syn-wren",
    handle: "wren",
    displayName: "Wren",
    avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&q=80&fit=crop&crop=face",
    archetype: "writer",
    preferredWorldKeys: ["writer-room", "gentle-start", "default"],
    activityBias: {
      participant_joined: 1.1,
      session_started: 1.0,
      sprint_completed: 1.4,
      session_completed: 1.1,
      participant_left: 0.7,
    },
  },

  // ── Founders ──
  {
    id: "syn-ava",
    handle: "ava",
    displayName: "Ava",
    avatarUrl: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=80&q=80&fit=crop&crop=face",
    archetype: "founder",
    preferredWorldKeys: ["yc-build", "default", "vibe-coding"],
    activityBias: {
      participant_joined: 1.0,
      session_started: 1.4,
      sprint_completed: 1.5,
      session_completed: 0.9,
      participant_left: 0.6,
    },
  },
  {
    id: "syn-noor",
    handle: "noor",
    displayName: "Noor",
    avatarUrl: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=80&q=80&fit=crop&crop=face",
    archetype: "founder",
    preferredWorldKeys: ["yc-build", "default"],
    activityBias: {
      participant_joined: 1.0,
      session_started: 1.3,
      sprint_completed: 1.3,
      session_completed: 1.0,
      participant_left: 0.8,
    },
  },
  {
    id: "syn-quinn",
    handle: "quinn",
    displayName: "Quinn",
    avatarUrl: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=80&q=80&fit=crop&crop=face",
    archetype: "founder",
    preferredWorldKeys: ["yc-build", "vibe-coding", "default"],
    activityBias: {
      participant_joined: 0.9,
      session_started: 1.2,
      sprint_completed: 1.6,
      session_completed: 1.0,
      participant_left: 0.7,
    },
  },

  // ── Gentle ──
  {
    id: "syn-lux",
    handle: "lux",
    displayName: "Lux",
    avatarUrl: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=80&q=80&fit=crop&crop=face",
    archetype: "gentle",
    preferredWorldKeys: ["gentle-start", "default", "writer-room"],
    activityBias: {
      participant_joined: 1.1,
      session_started: 1.0,
      sprint_completed: 1.2,
      session_completed: 1.1,
      participant_left: 0.9,
    },
  },
  {
    id: "syn-sol",
    handle: "sol",
    displayName: "Sol",
    avatarUrl: "https://images.unsplash.com/photo-1519345182560-3f2917c472ef?w=80&q=80&fit=crop&crop=face",
    archetype: "gentle",
    preferredWorldKeys: ["gentle-start", "default"],
    activityBias: {
      participant_joined: 1.0,
      session_started: 1.1,
      sprint_completed: 1.1,
      session_completed: 1.0,
      participant_left: 1.0,
    },
  },
  {
    id: "syn-fern",
    handle: "fern",
    displayName: "Fern",
    avatarUrl: "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=80&q=80&fit=crop&crop=face",
    archetype: "gentle",
    preferredWorldKeys: ["gentle-start", "writer-room", "default"],
    activityBias: {
      participant_joined: 1.0,
      session_started: 1.0,
      sprint_completed: 1.3,
      session_completed: 1.0,
      participant_left: 0.8,
    },
  },
];
