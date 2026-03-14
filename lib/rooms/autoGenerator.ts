// ─── Auto Room Generation Orchestrator ───────────────────────
// End-to-end pipeline: hot topics → eligibility → content selection
// → metadata → host → blueprint insertion. Produces draft blueprints
// ready for editorial review.

import { createClient } from "@/lib/supabase/admin";
import { getHotTopics } from "@/lib/topics/heatEngine";
import { getTopicBySlug } from "@/lib/topics/taxonomy";
import { getChannelsForTopic } from "@/lib/creators/catalog";
import { checkEligibility, type EligibilityConfig } from "./eligibility";
import { evaluateForAutoApproval } from "./autoApproval";
import { selectAndSequence, type CurriculumSequence } from "./contentSelector";
import { generateRoomMetadata } from "./metadataGenerator";
import { generateHostScript } from "./hostScriptGenerator";
import { ROOM_VISUAL_PROFILES } from "@/lib/roomVisualProfiles";
import type { RoomVisualProfile } from "@/lib/roomVisualProfiles";

// ─── Types ──────────────────────────────────────────────────

export interface AutoGenerationOptions {
  topicSlugs?: string[];
  heatThreshold?: number;
  maxRooms?: number;
  eligibilityConfig?: Partial<EligibilityConfig>;
}

export interface AutoGenerationResult {
  topicsChecked: number;
  roomsGenerated: number;
  roomsSkipped: number;
  details: {
    topicSlug: string;
    topicName: string;
    heatScore: number;
    eligible: boolean;
    reason: string;
    blueprintId?: string;
  }[];
  durationMs: number;
}

// ─── Visual profile templates by topic category ─────────────

const CATEGORY_VISUAL_TEMPLATES: Record<string, RoomVisualProfile> = {
  tool: {
    ...ROOM_VISUAL_PROFILES["vibe-coding"],
    worldKey: "default" as RoomVisualProfile["worldKey"],
  },
  platform: {
    ...ROOM_VISUAL_PROFILES["vibe-coding"],
    worldKey: "default" as RoomVisualProfile["worldKey"],
  },
  technique: {
    ...ROOM_VISUAL_PROFILES["default"],
    worldKey: "default" as RoomVisualProfile["worldKey"],
  },
  concept: {
    ...ROOM_VISUAL_PROFILES["default"],
    worldKey: "default" as RoomVisualProfile["worldKey"],
  },
  role: {
    ...ROOM_VISUAL_PROFILES["yc-build"],
    worldKey: "default" as RoomVisualProfile["worldKey"],
  },
};

const DEFAULT_VISUAL = ROOM_VISUAL_PROFILES["default"];

// ─── Timeout guard ──────────────────────────────────────────

const TIMEOUT_MS = 40_000; // 40 seconds — leave 20s buffer for Vercel 60s limit

// ─── Core ───────────────────────────────────────────────────

/**
 * Auto-generate room blueprints for hot topics.
 * Produces draft blueprints in fp_room_blueprints for editorial review.
 */
export async function autoGenerateRooms(
  options?: AutoGenerationOptions
): Promise<AutoGenerationResult> {
  const startTime = Date.now();
  const threshold = options?.heatThreshold ?? 0.8;
  const maxRooms = options?.maxRooms ?? 3;
  const details: AutoGenerationResult["details"] = [];

  // 1. Get candidate topics
  let clusterIds: { id: string; topicSlug?: string; heatScore?: number }[] = [];

  if (options?.topicSlugs && options.topicSlugs.length > 0) {
    // Manual trigger — look up clusters for specific topics
    const supabase = createClient();
    for (const slug of options.topicSlugs) {
      const topic = await getTopicBySlug(slug);
      if (!topic) {
        details.push({
          topicSlug: slug,
          topicName: slug,
          heatScore: 0,
          eligible: false,
          reason: `Topic not found: ${slug}`,
        });
        continue;
      }
      const { data: cluster } = await supabase
        .from("fp_topic_clusters")
        .select("id, heat_score")
        .eq("topic_id", topic.id)
        .single();

      if (cluster) {
        clusterIds.push({ id: cluster.id, topicSlug: slug, heatScore: cluster.heat_score });
      } else {
        details.push({
          topicSlug: slug,
          topicName: topic.name,
          heatScore: 0,
          eligible: false,
          reason: `No cluster found for topic: ${slug}`,
        });
      }
    }
  } else {
    // Cron trigger — get hot topics from heat engine
    const hotTopics = await getHotTopics(threshold, 10);
    clusterIds = hotTopics.map((c) => ({
      id: c.id,
      topicSlug: c.topic?.slug,
      heatScore: c.heatScore,
    }));
  }

  // 2. Check eligibility
  let roomsGenerated = 0;

  for (const cluster of clusterIds) {
    // Timeout guard
    if (Date.now() - startTime > TIMEOUT_MS) {
      console.log(`[rooms/autoGenerator] Timeout guard hit after ${roomsGenerated} rooms`);
      break;
    }

    if (roomsGenerated >= maxRooms) break;

    try {
      const eligibility = await checkEligibility(cluster.id, options?.eligibilityConfig);

      if (!eligibility.eligible) {
        details.push({
          topicSlug: eligibility.topicSlug || cluster.topicSlug || "",
          topicName: eligibility.topicName || "",
          heatScore: eligibility.heatScore || cluster.heatScore || 0,
          eligible: false,
          reason: eligibility.reason,
        });
        continue;
      }

      // 3. Generate the room
      const blueprintId = await generateRoomForTopic(
        eligibility.topicSlug,
        eligibility.topicName,
        eligibility.clusterId,
        eligibility.heatScore
      );

      roomsGenerated++;
      details.push({
        topicSlug: eligibility.topicSlug,
        topicName: eligibility.topicName,
        heatScore: eligibility.heatScore,
        eligible: true,
        reason: "Room generated successfully",
        blueprintId,
      });
    } catch (err) {
      console.error(`[rooms/autoGenerator] Error processing cluster ${cluster.id}:`, err);
      details.push({
        topicSlug: cluster.topicSlug || "",
        topicName: "",
        heatScore: cluster.heatScore || 0,
        eligible: false,
        reason: `Error: ${err instanceof Error ? err.message : "unknown"}`,
      });
    }
  }

  return {
    topicsChecked: clusterIds.length + details.filter((d) => !d.eligible && !d.blueprintId).length,
    roomsGenerated,
    roomsSkipped: details.filter((d) => !d.eligible).length,
    details,
    durationMs: Date.now() - startTime,
  };
}

// ─── Per-topic generation ───────────────────────────────────

/**
 * Generate a complete room blueprint for a single eligible topic.
 * Runs 3 LLM calls: curriculum sequencing, metadata, host script.
 */
async function generateRoomForTopic(
  topicSlug: string,
  topicName: string,
  clusterId: string,
  heatScore: number
): Promise<string> {
  const supabase = createClient();

  // Get topic category for visual template selection
  const topic = await getTopicBySlug(topicSlug);
  const topicCategory = topic?.category ?? "concept";

  // Step A: Content selection + curriculum sequencing (LLM call 1/3)
  const { selected, curriculum } = await selectAndSequence(topicSlug, topicName);

  if (selected.length === 0) {
    throw new Error(`No content selected for topic: ${topicSlug}`);
  }

  // Get unique creators from selected content
  const creatorNames = [...new Set(selected.map((s) => s.creator).filter(Boolean))];

  // Step B: Room metadata (LLM call 2/3)
  const metadata = await generateRoomMetadata({
    topicSlug,
    topicName,
    topicCategory,
    curriculum,
    creators: creatorNames,
  });

  // Step C: Host script (LLM call 3/3)
  const hostScript = await generateHostScript({
    topicName,
    topicCategory,
    curriculum,
    roomMetadata: metadata,
  });

  // Step D: Assemble remaining blueprint domains (no LLM)
  const breakProfile = buildBreakProfile(topicSlug, topicName, selected, creatorNames, topic?.aliases);
  const visualProfile = buildVisualProfile(topicCategory, metadata.world_config.label);
  const syntheticConfig = buildSyntheticConfig(metadata.world_config.targetRoomSize);

  // Step E: Insert blueprint
  const contentSelection = {
    videoIds: selected.map((s) => s.externalId),
    items: selected.map((s) => ({
      videoId: s.externalId,
      title: s.title,
      creator: s.creator,
      tasteScore: s.tasteScore,
    })),
  };

  const curriculumSequenceData = {
    items: curriculum.items.map((item) => ({
      videoId: item.externalId,
      title: item.title,
      sequencePosition: item.sequencePosition,
      learningRationale: item.learningRationale,
    })),
    totalDurationMinutes: curriculum.totalDurationMinutes,
    difficultyProgression: curriculum.difficultyProgression,
  };

  const { data: blueprint, error } = await supabase
    .from("fp_room_blueprints")
    .insert({
      archetype: "custom",
      room_name: metadata.world_config.label,
      room_description: metadata.world_config.description,
      topic: topicName,
      audience: "Tech professionals exploring " + topicName,
      world_config: metadata.world_config,
      host_config: hostScript.host_config,
      synthetic_config: syntheticConfig,
      break_profile: breakProfile,
      visual_profile: visualProfile,
      discovery_config: metadata.discovery_config,
      status: "draft",
      generation_source: "auto",
      generation_model: "gpt-4o-mini",
      topic_cluster_id: clusterId,
      topic_slug: topicSlug,
      heat_score_at_generation: heatScore,
      review_status: "pending",
      content_selection: contentSelection,
      curriculum_sequence: curriculumSequenceData,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Blueprint insert failed: ${error.message}`);
  }

  console.log(
    `[rooms/autoGenerator] Generated blueprint ${blueprint.id} for topic "${topicSlug}" (heat: ${heatScore.toFixed(3)})`
  );

  // Auto-approval check (no-op when disabled)
  try {
    const autoResult = await evaluateForAutoApproval(blueprint.id);
    if (autoResult.decision === "approved") {
      console.log(`[rooms/autoGenerator] Blueprint ${blueprint.id} auto-approved: ${autoResult.reason}`);
    }
  } catch (err) {
    console.error("[rooms/autoGenerator] auto-approval check failed:", err);
  }

  return blueprint.id;
}

// ─── Blueprint assembly helpers (no LLM) ────────────────────

function buildBreakProfile(
  topicSlug: string,
  topicName: string,
  selected: { creator: string; channelId: string }[],
  creatorNames: string[],
  aliases?: string[]
) {
  // Queries from topic name + aliases
  const queries = [topicName];
  if (aliases) {
    queries.push(...aliases.slice(0, 3));
  }
  queries.push(`${topicName} tutorial`, `${topicName} explained`);

  // Channels from selected content
  const channelMap = new Map<string, string>();
  for (const item of selected) {
    if (item.channelId && item.creator && !channelMap.has(item.channelId)) {
      channelMap.set(item.channelId, item.creator);
    }
  }
  const channels = [...channelMap.entries()].slice(0, 5).map(([channelId, label]) => ({
    channelId,
    label,
    query: topicName,
  }));

  // Creator boosts from the selected content's top creators
  const creatorBoosts = creatorNames.slice(0, 5).map((name) => ({
    channelName: name,
    weight: 15,
  }));

  return {
    queries,
    channels,
    publishedAfterMonths: 6,
    persona: {
      name: `${topicName} Curator`,
      voicePrompt: `You are a curator for ${topicName} content. Prioritize videos that teach practical skills, show real implementations, and come from practitioners. Prefer hands-on tutorials and deep dives over news summaries or opinion pieces.`,
      rejectPatterns: [
        "off-topic content not related to " + topicSlug,
        "clickbait without substance",
        "low-quality screen recordings",
      ],
      preferPatterns: [
        "hands-on tutorials",
        "deep technical dives",
        "practical demonstrations",
        "expert practitioners",
      ],
    },
    creatorBoosts,
  };
}

function buildVisualProfile(
  topicCategory: string,
  roomLabel: string
): Record<string, unknown> {
  const template = CATEGORY_VISUAL_TEMPLATES[topicCategory] ?? DEFAULT_VISUAL;
  return {
    masterPrompt: template.masterPrompt,
    continuityAnchors: template.continuityAnchors,
    palette: template.palette,
    lighting: template.lighting,
    cameraRules: template.cameraRules,
    negativeRules: template.negativeRules,
    uiSafeZones: template.uiSafeZones,
    timeOverrides: template.timeOverrides ?? {
      morning: { lighting: "Warm golden morning light from the east", mood: "Fresh start energy" },
      evening: { lighting: "Warm amber lamp light with blue twilight outside", mood: "Cozy evening focus" },
      late_night: { lighting: "Soft focused desk lamp with deep blue surroundings", mood: "Deep night concentration" },
    },
  };
}

function buildSyntheticConfig(targetRoomSize: number) {
  return {
    archetypeMix: {
      coder: 0.5,
      writer: 0.0,
      founder: 0.3,
      gentle: 0.2,
    },
    targetCount: Math.min(Math.ceil(targetRoomSize * 0.6), 8),
  };
}
