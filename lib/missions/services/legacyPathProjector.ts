import { randomUUID } from "crypto";
import { createClient as createAdminClient } from "@/lib/supabase/admin";
import { mapPathRow } from "@/lib/learn/pathGenerator";
import type { LearningPath, MissionBriefing, PathItem } from "@/lib/types";
import type { MissionBriefV2 } from "@/lib/missions/types/missionBriefV2";
import type { FluencyLevel } from "@/lib/missions/types/common";
import {
  createMissionPathProjection,
  getMissionPathProjectionByMissionBriefId,
  type MissionPathProjection,
} from "@/lib/missions/repositories/missionPathProjectionRepo";
import { getExistingLearningPathForMissionBrief } from "@/lib/missions/services/missionCacheService";
import { resolveMissionProjectionTool } from "@/lib/missions/services/toolCapabilityResolver";

const PROJECTOR_VERSION = "shadow_projection_v1";

interface LearningPathRow {
  id: string;
  title: string;
  description: string;
  goal: string;
  query: string;
  topics: string[];
  primary_tools: string[];
  difficulty_level: "beginner" | "intermediate" | "advanced";
  estimated_duration_seconds: number;
  items: PathItem[];
  modules: null;
  source: "search";
  is_cached: boolean;
  is_discoverable: boolean;
  source_mission_brief_id: string;
  generation_engine: "mission_projection";
  canonical_stable_key: string;
  view_count: number;
  start_count: number;
  completion_count: number;
  created_at?: string;
}

export interface MissionShadowProjectionResult {
  learningPath: LearningPath;
  projection: MissionPathProjection;
  created: boolean;
}

/** Project one canonical mission brief into a hidden compatibility learning path. */
export async function projectMissionBriefToHiddenLearningPath(
  brief: MissionBriefV2,
): Promise<MissionShadowProjectionResult> {
  const admin = createAdminClient();
  const [existingProjection, existingPathRow] = await Promise.all([
    getMissionPathProjectionByMissionBriefId(brief.missionId),
    getExistingLearningPathForMissionBrief(brief.missionId),
  ]);

  if (existingProjection) {
    const learningPath = await getLearningPathById(existingProjection.learningPathId);
    if (learningPath) {
      return {
        learningPath,
        projection: existingProjection,
        created: false,
      };
    }
  }

  if (existingPathRow?.id) {
    const projection = await createMissionPathProjection({
      id: existingProjection?.id ?? randomUUID(),
      missionBriefId: brief.missionId,
      learningPathId: existingPathRow.id,
      projectorVersion: PROJECTOR_VERSION,
      projectionStatus: "active",
      supersededAt: null,
    });

    const learningPath = await getLearningPathById(existingPathRow.id);
    if (!learningPath) {
      throw new Error(
        `[missions/legacyPathProjector] linked learning path ${existingPathRow.id} could not be loaded`,
      );
    }

    return {
      learningPath,
      projection,
      created: false,
    };
  }

  const insertRow = buildProjectedLearningPathRow(brief);
  const { data, error } = await admin
    .from("fp_learning_paths")
    .insert(insertRow as unknown)
    .select("*")
    .single();

  if (error) {
    throw new Error(
      `[missions/legacyPathProjector] path insert failed: ${error.message}`,
    );
  }

  const createdRow = data as Record<string, unknown>;
  const projection = await createMissionPathProjection({
    id: existingProjection?.id ?? randomUUID(),
    missionBriefId: brief.missionId,
    learningPathId: createdRow.id as string,
    projectorVersion: PROJECTOR_VERSION,
    projectionStatus: "active",
    supersededAt: null,
  });

  return {
    learningPath: mapPathRow(createdRow),
    projection,
    created: true,
  };
}

async function getLearningPathById(pathId: string): Promise<LearningPath | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("fp_learning_paths")
    .select("*")
    .eq("id", pathId)
    .maybeSingle();

  if (error) {
    throw new Error(
      `[missions/legacyPathProjector] path lookup failed: ${error.message}`,
    );
  }

  return data ? mapPathRow(data as Record<string, unknown>) : null;
}

function buildProjectedLearningPathRow(brief: MissionBriefV2): LearningPathRow {
  const tool = resolveMissionProjectionTool(brief);
  const doTask = buildProjectedDoTask(brief, tool);

  return {
    id: randomUUID(),
    title: brief.identity.title,
    description: brief.framing.whyThisMattersForMarketing,
    goal: brief.artifact.completionDefinition,
    query: brief.topic.topicName.toLowerCase(),
    topics: [brief.topic.topicSlug],
    primary_tools: [tool.slug],
    difficulty_level: mapDifficultyLevel(brief.identity.fluencyLevel),
    estimated_duration_seconds: brief.execution.timeboxMinutes * 60,
    items: [doTask],
    modules: null,
    source: "search",
    is_cached: false,
    is_discoverable: false,
    source_mission_brief_id: brief.missionId,
    generation_engine: "mission_projection",
    canonical_stable_key: brief.stableKey,
    view_count: 0,
    start_count: 0,
    completion_count: 0,
  };
}

function buildProjectedDoTask(
  brief: MissionBriefV2,
  tool: MissionBriefing["tool"],
): PathItem {
  const mission = buildProjectedMissionBriefing(brief, tool);

  return {
    item_id: `projected-do-${brief.missionId}`,
    task_type: "do",
    position: 0,
    module_index: 0,
    title: brief.artifact.artifactName,
    connective_text: brief.framing.marketerUseCase,
    duration_seconds: brief.execution.timeboxMinutes * 60,
    content_id: null,
    content_type: null,
    creator_name: null,
    source_url: null,
    thumbnail_url: null,
    quality_score: null,
    clip_start_seconds: null,
    clip_end_seconds: null,
    mission,
    check: null,
    reflection: null,
  };
}

function buildProjectedMissionBriefing(
  brief: MissionBriefV2,
  tool: MissionBriefing["tool"],
): MissionBriefing {
  const objectiveAudience = brief.artifact.audience.trim();

  return {
    objective: `Create the ${brief.artifact.artifactName} for ${objectiveAudience}.`,
    context: `${brief.framing.whyThisMattersNow} ${brief.framing.whyThisMattersForMarketing}`.trim(),
    tool,
    tool_prompt: buildProjectedToolPrompt(brief),
    steps: brief.execution.steps.map((step) => `${step.title}: ${step.instruction}`),
    success_criteria: brief.successCriteria.map((criterion) => criterion.definition),
    starter_code: null,
    guidance_level: mapGuidanceLevel(brief.identity.fluencyLevel),
    submission_type: tool.submission_type,
  };
}

function buildProjectedToolPrompt(brief: MissionBriefV2): string {
  const sections = brief.artifact.minimumSections?.length
    ? `Required sections/fields:\n- ${brief.artifact.minimumSections.join("\n- ")}`
    : null;
  const sourceReferenceCoverage = brief.sourceReferences.length
    ? `Source-backed requirements:\n- Use the source-backed claims already selected for this mission.\n- Keep recommendations grounded in the evidence supporting why this matters for marketing and the success criteria.\n- Total source references attached: ${brief.sourceReferences.length}`
    : null;
  const steps = brief.execution.steps
    .map((step, index) => `${index + 1}. ${step.instruction}`)
    .join("\n");
  const criteria = brief.successCriteria
    .map((criterion) => `- ${criterion.definition}`)
    .join("\n");

  return [
    `Help me complete this SkillGap mission about ${brief.topic.topicName}.`,
    `Why this matters now: ${brief.framing.whyThisMattersNow}`,
    `Why this matters for marketing: ${brief.framing.whyThisMattersForMarketing}`,
    `Use case: ${brief.framing.marketerUseCase}`,
    `Artifact: ${brief.artifact.artifactName}`,
    `Audience: ${brief.artifact.audience}`,
    `Completion definition: ${brief.artifact.completionDefinition}`,
    sections,
    sourceReferenceCoverage,
    "Steps:",
    steps,
    "Success criteria:",
    criteria,
  ]
    .filter((part): part is string => Boolean(part))
    .join("\n\n");
}

function mapDifficultyLevel(
  fluencyLevel: FluencyLevel,
): LearningPath["difficulty_level"] {
  switch (fluencyLevel) {
    case "exploring":
      return "beginner";
    case "practicing":
      return "intermediate";
    default:
      return "advanced";
  }
}

function mapGuidanceLevel(
  fluencyLevel: FluencyLevel,
): MissionBriefing["guidance_level"] {
  switch (fluencyLevel) {
    case "exploring":
      return "guided";
    case "practicing":
      return "scaffolded";
    case "proficient":
      return "independent";
    default:
      return "solo";
  }
}

export const __testing = {
  buildProjectedLearningPathRow,
  buildProjectedToolPrompt,
  buildProjectedDoTask,
};
