// ─── Signal Source Configuration ─────────────────────────────
// Per-source settings, subreddit lists, RSS feeds, and AI keywords.

// ─── Source Config ──────────────────────────────────────────

export interface SignalSourceConfig {
  source: string;
  enabled: boolean;
  /** Minimum minutes between collection runs for this source. */
  frequencyMinutes: number;
  /** Max signals to collect per run. */
  maxSignalsPerRun: number;
  /** Minimum engagement score to keep (0–1). */
  relevanceThreshold: number;
}

export const SIGNAL_SOURCES: Record<string, SignalSourceConfig> = {
  reddit: {
    source: "reddit",
    enabled: true,
    frequencyMinutes: 60,
    maxSignalsPerRun: 30,
    relevanceThreshold: 0.3,
  },
  hn: {
    source: "hn",
    enabled: true,
    frequencyMinutes: 30,
    maxSignalsPerRun: 20,
    relevanceThreshold: 0.3,
  },
  rss: {
    source: "rss",
    enabled: true,
    frequencyMinutes: 120,
    maxSignalsPerRun: 40,
    relevanceThreshold: 0.2,
  },
  youtube_velocity: {
    source: "youtube_velocity",
    enabled: true,
    frequencyMinutes: 360,
    maxSignalsPerRun: 20,
    relevanceThreshold: 0.4,
  },
  internal: {
    source: "internal",
    enabled: true,
    frequencyMinutes: 15,
    maxSignalsPerRun: 100,
    relevanceThreshold: 0,
  },
};

// ─── Reddit Subreddits ─────────────────────────────────────

export const REDDIT_SUBREDDITS = [
  "LocalLLaMA",
  "MachineLearning",
  "artificial",
  "ChatGPT",
  "ClaudeAI",
  "singularity",
  "StableDiffusion",
] as const;

// ─── RSS Feeds ──────────────────────────────────────────────

export const RSS_FEEDS = [
  { url: "https://openai.com/blog/rss.xml", label: "OpenAI Blog" },
  { url: "https://www.anthropic.com/rss.xml", label: "Anthropic" },
  { url: "https://blog.google/technology/ai/rss/", label: "Google AI Blog" },
  { url: "https://huggingface.co/blog/feed.xml", label: "Hugging Face Blog" },
  { url: "https://simonwillison.net/atom/everything/", label: "Simon Willison" },
  { url: "https://lilianweng.github.io/index.xml", label: "Lil'Log" },
  { url: "https://www.latent.space/feed", label: "Latent Space" },
] as const;

// ─── AI Keywords for HN Relevance Filtering ─────────────────

export const AI_KEYWORDS = [
  "ai",
  "llm",
  "gpt",
  "claude",
  "openai",
  "anthropic",
  "machine learning",
  "deep learning",
  "neural",
  "transformer",
  "diffusion",
  "copilot",
  "cursor",
  "coding assistant",
  "vibe cod",
  "gemini",
  "llama",
  "mistral",
  "stable diffusion",
  "midjourney",
  "rag",
  "fine-tun",
  "prompt engineer",
  "agent",
  "multimodal",
  "embedding",
  "vector",
] as const;
