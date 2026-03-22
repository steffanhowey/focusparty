import type {
  ArtifactType,
  FluencyLevel,
  LaunchDomainKey,
  LaunchRoomKey,
  MissionConstraintType,
  MissionEvidenceItemType,
  MissionFamily,
  MissionGuidanceLevel,
  MissionInputType,
  MissionStatus,
  ProfessionalFunction,
  SubmissionMode,
  TimelinessClass,
} from "./common";
import type { MissionQualityStamp } from "./quality";

export interface MissionStep {
  stepId: string;
  title: string;
  instruction: string;
  expectedOutput: string;
  estimatedMinutes: number;
}

export interface MissionSuccessCriterion {
  criterionId: string;
  label: string;
  definition: string;
  critical: boolean;
  verificationMethod?: "binary" | "rubric";
}

export interface MissionSourceReference {
  referenceId: string;
  sourceItemId: string;
  claimIds: string[];
  supportsSections: Array<
    "why_now" | "why_marketing" | "artifact" | "steps" | "success_criteria"
  >;
}

export interface MissionBriefV2Core {
  missionId: string;
  stableKey: string;
  schemaVersion: "mission_brief_v2";
  status: MissionStatus;
  identity: MissionIdentity;
  topic: MissionTopicIdentity;
  framing: MissionFraming;
  artifact: MissionArtifactSpec;
  execution: MissionExecutionCore;
  successCriteria: MissionSuccessCriterion[];
  bestRoom: MissionBestRoom;
  sourceReferences: MissionSourceReference[];
  quality: MissionQualityStamp;
  lifecycleCore: MissionLifecycleCore;
}

export interface MissionIdentity {
  title: string;
  shortTitle: string;
  summary: string;
  professionalFunction: ProfessionalFunction;
  fluencyLevel: FluencyLevel;
  missionFamily: MissionFamily;
  launchDomain: LaunchDomainKey;
}

export interface MissionTopicIdentity {
  topicSlug: string;
  topicName: string;
  sourcePacketId: string;
  sourcePacketHash: string;
  sourcePacketReadinessState: "tracking_only" | "watchlist_only" | "mission_ready";
  timelinessClass: TimelinessClass;
  heatScoreSnapshot: number | null;
}

export interface MissionFraming {
  whyThisMattersNow: string;
  whyThisMattersForMarketing: string;
  marketerUseCase: string;
}

export interface MissionArtifactSpec {
  artifactType: ArtifactType;
  artifactName: string;
  outputDescription: string;
  audience: string;
  format:
    | "doc"
    | "table"
    | "deck-outline"
    | "prompt-pack"
    | "json"
    | "worksheet";
  completionDefinition: string;
  channel?: string | null;
  minimumSections?: string[];
}

export interface MissionExecutionCore {
  timeboxMinutes: number;
  hardCapMinutes: number;
  steps: MissionStep[];
}

export interface MissionBestRoom {
  roomKey: LaunchRoomKey | null;
  launchDomain: LaunchDomainKey;
  rationale: string;
}

export interface MissionLifecycleCore {
  briefVersion: number;
  generatedAt: string;
  expiresAt: string;
}

export interface MissionInputField {
  inputId: string;
  label: string;
  description: string;
  type: MissionInputType;
  example: string | null;
  canUsePlaceholder: boolean;
}

export interface MissionInputDefault {
  inputId: string;
  strategy: string;
  defaultValue: string | null;
}

export interface MissionToolRef {
  toolKey: string;
  displayName: string;
  resolutionType: "registry" | "capability";
  capabilityTags: string[];
  required: boolean;
  rationale: string;
}

export interface MissionConstraint {
  constraintId: string;
  type: MissionConstraintType;
  rule: string;
  hard: boolean;
}

export interface MissionRubricDimension {
  dimensionId: string;
  label:
    | "specificity"
    | "channel-fit"
    | "strategic-judgment"
    | "evidence-use"
    | "clarity"
    | "completeness"
    | "differentiation";
  definition: string;
  passingScore: number;
}

export interface MissionEvidenceItem {
  label: string;
  type: MissionEvidenceItemType;
  description: string;
}

export interface MissionEvidenceSpec {
  submissionMode: SubmissionMode;
  requiredItems: MissionEvidenceItem[];
  proofOfCompletion: string[];
  autoEvalFields: string[];
}

export interface MissionLifecyclePlus {
  familyTemplateVersion: string;
  benchmarkVersion: string;
  supersedesMissionId: string | null;
  cacheTags: string[];
  regenTriggers: string[];
}

export interface MissionBriefV2Enrichments {
  framingPlus?: {
    opinionatedTake: string;
    whatToIgnore: string | null;
    expectedValueIfCompleted: string;
  };
  inputs?: {
    requiredInputs: MissionInputField[];
    optionalInputs: MissionInputField[];
    systemDefaults: MissionInputDefault[];
  };
  tools?: {
    primary: MissionToolRef;
    supporting: MissionToolRef[];
    disallowed: string[];
  };
  scaffolding?: {
    guidanceLevel: MissionGuidanceLevel;
    warmStartPrompt: string | null;
    starterTemplate: string | null;
    checkpoints: string[];
    commonFailureModes: string[];
  };
  constraints?: MissionConstraint[];
  rubricDimensions?: MissionRubricDimension[];
  roomFitPlus?: {
    collaborationMode: "solo-with-shared-momentum" | "share-and-compare" | "paired-review";
    handoffMoments: string[];
    idealSessionMinutes: number;
  };
  evidence?: MissionEvidenceSpec;
  lifecyclePlus?: MissionLifecyclePlus;
}

export type MissionBriefV2 = MissionBriefV2Core & MissionBriefV2Enrichments;
