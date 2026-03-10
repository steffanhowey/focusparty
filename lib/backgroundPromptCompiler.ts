// ─── Background Prompt Compiler ─────────────────────────────
// Assembles structured generation prompts from room visual
// profiles. Produces deterministic prompt text + SHA-256 hash
// for deduplication.

import { createHash } from "crypto";
import type { RoomVisualProfile } from "./roomVisualProfiles";

export interface CompiledPrompt {
  /** Full assembled prompt text for gpt-image-1. */
  text: string;
  /** SHA-256 hash of the prompt text. */
  hash: string;
}

export interface PromptOptions {
  /** Free-form seed string to encourage variation between candidates. */
  variationSeed?: string;
  /** Time-of-day hint for lighting/mood variation. */
  timeOfDay?: "morning" | "afternoon" | "evening" | "night";
}

/**
 * Compile a generation prompt from a room visual profile.
 * The prompt is structured in sections so gpt-image-1 gets
 * clear, non-conflicting instructions.
 */
export function compileBackgroundPrompt(
  profile: RoomVisualProfile,
  options?: PromptOptions
): CompiledPrompt {
  const sections: string[] = [];

  // 1. Intent
  sections.push(
    "Create a premium, cinematic environment background image for a focus and productivity application."
  );

  // 2. Scene
  sections.push(`Scene: ${profile.masterPrompt}`);

  // 3. Required visual elements
  sections.push(
    `Required visual elements that must appear: ${profile.continuityAnchors.join("; ")}.`
  );

  // 4. Color palette
  sections.push(
    [
      "Color palette:",
      `  Dominant colors: ${profile.palette.dominant.join(", ")}.`,
      `  Accent colors: ${profile.palette.accent.join(", ")}.`,
      `  Colors to avoid: ${profile.palette.avoid.join(", ")}.`,
    ].join("\n")
  );

  // 5. Lighting
  sections.push(`Lighting: ${profile.lighting}`);

  // 6. Camera
  sections.push(`Camera: ${profile.cameraRules}`);

  // 7. Time of day variation
  if (options?.timeOfDay) {
    sections.push(`Time of day: ${options.timeOfDay}.`);
  }

  // 8. Variation seed
  if (options?.variationSeed) {
    sections.push(
      `Variation direction: ${options.variationSeed}. Use this as creative inspiration to make this image distinct from other generations of the same scene, while maintaining all required visual elements and style.`
    );
  }

  // 9. UI composition safety
  sections.push(
    `CRITICAL composition requirement: ${profile.uiSafeZones}`
  );

  // 10. Negative constraints
  sections.push(
    `NEVER include any of the following: ${profile.negativeRules.join("; ")}.`
  );

  // 11. Technical requirements
  sections.push(
    "Technical: Photorealistic digital art with cinematic depth of field. Premium quality suitable for large displays. Landscape orientation. No text, watermarks, logos, or UI elements embedded in the image. The image will be used as a full-bleed background behind semi-transparent dark overlays."
  );

  const text = sections.join("\n\n");
  const hash = createHash("sha256").update(text).digest("hex");

  return { text, hash };
}
