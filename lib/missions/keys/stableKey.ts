import type { MissionFamily } from "@/lib/missions/types/common";
import {
  buildEditorialKey,
  type EditorialKeyParts,
  parseEditorialKey,
} from "./editorialKey";

export interface StableKeyParts extends EditorialKeyParts {
  missionFamily: MissionFamily;
}

/** Build the canonical stable key from editorial identity plus mission family. */
export function buildStableKey(parts: StableKeyParts): string {
  return `${buildEditorialKey(parts)}:${parts.missionFamily}`;
}

/** Parse a stable key into its normalized components. */
export function parseStableKey(key: string): StableKeyParts {
  const parts = key.split(":");
  if (parts.length !== 4) {
    throw new Error(`Invalid stable key: ${key}`);
  }

  const missionFamily = parts[3] as MissionFamily;
  const editorial = parseEditorialKey(parts.slice(0, 3).join(":"));

  return {
    ...editorial,
    missionFamily,
  };
}
