// ─── Shared Avatar Generation Prompt ─────────────────────────
// Used by both real user avatar generation and synthetic avatar generation
// to ensure a consistent visual style across all avatars on the platform.

export const AVATAR_PROMPT = (seed: string) =>
  `Create a single minimalist avatar portrait for a productivity app. Requirements:
- A friendly, abstract geometric character — NOT photorealistic, NOT a human photo
- Solid pastel or muted background color
- Clean vector-art aesthetic with soft rounded shapes
- Warm, approachable expression or feel
- No text, no borders, no watermarks, centered square composition
- The character should feel unique and distinct based on this seed: "${seed}"

Style: Notion-style geometric avatars — simple, warm, modern, suitable for display at 64px on a dark UI.`;
