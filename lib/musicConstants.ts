export type VibeId =
  | "calm-focus"
  | "energizing-flow"
  | "deep-concentration"
  | "ambient-chill";

export type MusicStatus =
  | "idle"
  | "loading"
  | "ready"
  | "playing"
  | "paused"
  | "error";

export interface VibeConfig {
  id: VibeId;
  label: string;
  description: string;
  videoIds: string[];
}

// Curated 24/7 YouTube livestreams per vibe — all from established channels.
// Each vibe has 2 streams: primary + fallback. The player auto-advances on error.
export const VIBES: VibeConfig[] = [
  {
    id: "calm-focus",
    label: "Calm Focus",
    description: "Gentle ambient for steady work",
    videoIds: [
      "jfKfPfyJRdk", // Lofi Girl — lofi hip hop radio (14M+ subs, iconic)
      "w9S5ID3nfOc", // Soothing Relaxation — beautiful piano radio 24/7
    ],
  },
  {
    id: "energizing-flow",
    label: "Energizing Flow",
    description: "Upbeat rhythms to power through",
    videoIds: [
      "MVPTGNGiI-4", // Lofi Girl — synthwave radio (driving retro-electronic)
      "5yx6BWlEVcY", // Chillhop Music — chillhop radio (jazzy upbeat beats)
    ],
  },
  {
    id: "deep-concentration",
    label: "Deep Concentration",
    description: "Minimal soundscapes for deep work",
    videoIds: [
      "Kn2t3iT_mdo", // DJ Grossman — brown noise 24/7 (black screen, no ads)
      "vKL1LVxr35k", // Cryo Chamber — dark ambient 24/7 (atmospheric textures)
    ],
  },
  {
    id: "ambient-chill",
    label: "Ambient Chill",
    description: "Soft textures for relaxed focus",
    videoIds: [
      "S_MOd40zlYU", // Lofi Girl — dark ambient radio (dreamy soundscapes)
      "rUxyKA_-grg", // Lofi Girl — beats to sleep/chill to (mellow lofi)
    ],
  },
];

export const VIBES_MAP: Record<VibeId, VibeConfig> = Object.fromEntries(
  VIBES.map((v) => [v.id, v]),
) as Record<VibeId, VibeConfig>;

export const DEFAULT_VOLUME = 50;
export const MUSIC_STORAGE_KEY = "focusparty-music";
export const YT_PLAYER_ID = "fp-yt-player";
