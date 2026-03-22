import type {
  FluencyLevel,
  ProfessionalFunction,
} from "@/lib/missions/types/common";

export interface EditorialKeyParts {
  topicSlug: string;
  professionalFunction: ProfessionalFunction;
  fluencyLevel: FluencyLevel;
}

function normalizeKeyPart(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "-");
}

/** Build the canonical editorial key for a topic/function/fluency tuple. */
export function buildEditorialKey(parts: EditorialKeyParts): string {
  return [
    normalizeKeyPart(parts.topicSlug),
    normalizeKeyPart(parts.professionalFunction),
    normalizeKeyPart(parts.fluencyLevel),
  ].join(":");
}

/** Parse an editorial key back into its normalized parts. */
export function parseEditorialKey(key: string): EditorialKeyParts {
  const [topicSlug, professionalFunction, fluencyLevel] = key.split(":");
  if (!topicSlug || !professionalFunction || !fluencyLevel) {
    throw new Error(`Invalid editorial key: ${key}`);
  }

  return {
    topicSlug,
    professionalFunction: professionalFunction as ProfessionalFunction,
    fluencyLevel: fluencyLevel as FluencyLevel,
  };
}
