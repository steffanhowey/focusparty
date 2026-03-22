import type {
  FluencyLevel,
  MissionFamily,
  ProfessionalFunction,
} from "@/lib/missions/types/common";

export interface MissionRolloutConfig {
  enablePrototypeFlow: boolean;
  enableShadowProjection: boolean;
  enableVisibleProjection: boolean;
  enablePathGeneratorSwitch: boolean;
  allowlistedFunctions: ProfessionalFunction[];
  allowlistedFluencies: FluencyLevel[];
  allowlistedFamilies: MissionFamily[];
  allowlistedTopics: string[];
}

export const MISSION_ROLLOUT_CONFIG: MissionRolloutConfig = {
  enablePrototypeFlow: true,
  enableShadowProjection: true,
  enableVisibleProjection: true,
  enablePathGeneratorSwitch: true,
  allowlistedFunctions: ["marketing"],
  allowlistedFluencies: ["practicing"],
  allowlistedFamilies: ["research-synthesis", "messaging-translation"],
  allowlistedTopics: ["prompt-engineering", "claude-code", "github-copilot"],
};
