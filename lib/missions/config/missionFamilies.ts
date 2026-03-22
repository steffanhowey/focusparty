import type { ArtifactType, MissionFamily } from "@/lib/missions/types/common";

export interface MissionFamilyDefinition {
  family: MissionFamily;
  label: string;
  description: string;
  defaultArtifactType: ArtifactType;
  prototypeEnabled: boolean;
}

export const MISSION_FAMILY_DEFINITIONS: Record<
  MissionFamily,
  MissionFamilyDefinition
> = {
  "adoption-evaluation": {
    family: "adoption-evaluation",
    label: "Adoption Evaluation",
    description: "Evaluate whether and how a new capability should enter the workflow.",
    defaultArtifactType: "adoption-memo",
    prototypeEnabled: false,
  },
  "research-synthesis": {
    family: "research-synthesis",
    label: "Research Synthesis",
    description: "Turn scattered evidence into a usable marketer-facing brief.",
    defaultArtifactType: "audience-brief",
    prototypeEnabled: true,
  },
  "messaging-translation": {
    family: "messaging-translation",
    label: "Messaging Translation",
    description: "Convert a technical development into positioning, messaging, and channel-ready framing.",
    defaultArtifactType: "message-matrix",
    prototypeEnabled: true,
  },
  "campaign-design": {
    family: "campaign-design",
    label: "Campaign Design",
    description: "Design a concrete campaign or experiment around a new workflow or tool.",
    defaultArtifactType: "experiment-plan",
    prototypeEnabled: false,
  },
  "content-system-design": {
    family: "content-system-design",
    label: "Content System Design",
    description: "Design a repeatable content production or repurposing system.",
    defaultArtifactType: "content-system",
    prototypeEnabled: false,
  },
  "workflow-design": {
    family: "workflow-design",
    label: "Workflow Design",
    description: "Design a repeatable AI-assisted workflow with clear inputs, outputs, and constraints.",
    defaultArtifactType: "workflow-spec",
    prototypeEnabled: false,
  },
  "creative-direction": {
    family: "creative-direction",
    label: "Creative Direction",
    description: "Direct a creative system or campaign concept from a strong strategic angle.",
    defaultArtifactType: "creative-brief",
    prototypeEnabled: false,
  },
};

export const PROTOTYPE_MISSION_FAMILIES: MissionFamily[] = [
  "research-synthesis",
  "messaging-translation",
];

/** Resolve the configured default artifact type for a mission family. */
export function getDefaultArtifactTypeForFamily(
  family: MissionFamily,
): ArtifactType {
  return MISSION_FAMILY_DEFINITIONS[family].defaultArtifactType;
}
