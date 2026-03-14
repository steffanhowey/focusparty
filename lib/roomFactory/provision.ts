// ─── Deterministic Room Provisioning ─────────────────────────
// Takes an approved blueprint and creates a live persistent room.
// No AI involved — purely deterministic database operations.

import { createClient as createAdminClient } from "../supabase/admin";
import { generateInviteCode } from "../inviteCode";
import { setRoomDna, type RoomDna } from "../roomDna";
import type { BlueprintResult } from "./blueprintPrompt";
import type { WorldConfig } from "../worlds";
import type { HostConfig, HostStyleGuide } from "../hosts";
import type { VibeId } from "../musicConstants";
import type { RoomVisualProfile } from "../roomVisualProfiles";
import type { WorldBreakProfile } from "../breaks/worldBreakProfiles";

// ─── Types ──────────────────────────────────────────────────

export interface ProvisionInput {
  blueprintId: string;
  overrides?: {
    name?: string;
    accentColor?: string;
    defaultSprintLength?: number;
    targetRoomSize?: number;
  };
}

export interface ProvisionResult {
  partyId: string;
  worldKey: string;
  inviteCode: string;
  name: string;
}

// ─── Slug Generation ────────────────────────────────────────

/** Generate a URL-safe world_key slug from a room name. */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 40);
}

// ─── Provision ──────────────────────────────────────────────

export async function provisionRoom(
  input: ProvisionInput
): Promise<ProvisionResult> {
  const admin = createAdminClient();

  // 1. Fetch the blueprint
  const { data: bp, error: bpError } = await admin
    .from("fp_room_blueprints")
    .select("*")
    .eq("id", input.blueprintId)
    .single();

  if (bpError || !bp) {
    throw new Error(`Blueprint not found: ${input.blueprintId}`);
  }

  if (bp.status !== "draft" && bp.status !== "approved") {
    throw new Error(`Blueprint status is "${bp.status}" — must be draft or approved`);
  }

  // 2. Build the room configuration
  const blueprint = {
    world_config: bp.world_config,
    host_config: bp.host_config,
    synthetic_config: bp.synthetic_config,
    break_profile: bp.break_profile,
    visual_profile: bp.visual_profile,
    discovery_config: bp.discovery_config,
  } as BlueprintResult;

  const roomName = input.overrides?.name ?? bp.room_name;
  const worldKey = slugify(roomName);
  const inviteCode = generateInviteCode();

  const sprintLength =
    input.overrides?.defaultSprintLength ??
    blueprint.world_config.defaultSprintLength;
  const roomSize =
    input.overrides?.targetRoomSize ?? blueprint.world_config.targetRoomSize;

  // 3. Create the fp_parties row
  const { data: party, error: partyError } = await admin
    .from("fp_parties")
    .insert({
      name: roomName,
      character: "ember",
      planned_duration_min: sprintLength,
      max_participants: Math.min(roomSize, 15),
      status: "waiting",
      world_key: worldKey,
      host_personality: worldKey,
      persistent: true,
      invite_code: inviteCode,
      blueprint_id: input.blueprintId,
      ...(bp.generation_source === "auto" ? {
        topic_slug: bp.topic_slug,
        is_trending: true,
        generation_source: "auto" as const,
      } : {}),
    })
    .select("id")
    .single();

  if (partyError) {
    // Retry once on invite_code collision
    if (partyError.code === "23505" && partyError.message?.includes("invite_code")) {
      const retryCode = generateInviteCode();
      const { data: retryData, error: retryError } = await admin
        .from("fp_parties")
        .insert({
          name: roomName,
          character: "ember",
          planned_duration_min: sprintLength,
          max_participants: Math.min(roomSize, 15),
          status: "waiting",
          world_key: worldKey,
          host_personality: worldKey,
          persistent: true,
          invite_code: retryCode,
          blueprint_id: input.blueprintId,
          ...(bp.generation_source === "auto" ? {
            topic_slug: bp.topic_slug,
            is_trending: true,
            generation_source: "auto" as const,
          } : {}),
        })
        .select("id")
        .single();

      if (retryError) throw retryError;

      await finalizeBlueprintAndCache(
        admin,
        input.blueprintId,
        retryData.id,
        worldKey,
        blueprint,
        input.overrides
      );

      return {
        partyId: retryData.id,
        worldKey,
        inviteCode: retryCode,
        name: roomName,
      };
    }
    throw partyError;
  }

  // 4. Link blueprint → party and cache
  await finalizeBlueprintAndCache(
    admin,
    input.blueprintId,
    party.id,
    worldKey,
    blueprint,
    input.overrides
  );

  return {
    partyId: party.id,
    worldKey,
    inviteCode,
    name: roomName,
  };
}

async function finalizeBlueprintAndCache(
  admin: ReturnType<typeof createAdminClient>,
  blueprintId: string,
  partyId: string,
  worldKey: string,
  blueprint: BlueprintResult,
  overrides?: ProvisionInput["overrides"]
) {
  // Update blueprint status and link to party
  await admin
    .from("fp_room_blueprints")
    .update({
      status: "provisioned",
      party_id: partyId,
      provisioned_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", blueprintId);

  // Preload into runtime cache
  const accentColor =
    overrides?.accentColor ?? blueprint.world_config.accentColor;

  const worldConfig: WorldConfig = {
    worldKey: worldKey as WorldConfig["worldKey"],
    label: blueprint.world_config.label,
    description: blueprint.world_config.description,
    hostPersonality: worldKey as WorldConfig["hostPersonality"],
    defaultSprintLength:
      overrides?.defaultSprintLength ??
      blueprint.world_config.defaultSprintLength,
    targetRoomSize:
      overrides?.targetRoomSize ?? blueprint.world_config.targetRoomSize,
    accentColor,
    placeholderGradient: blueprint.world_config.placeholderGradient,
    environmentOverlay: blueprint.world_config.environmentOverlay,
    vibeKey: blueprint.world_config.vibeKey as VibeId,
  };

  const styleGuide: HostStyleGuide = {
    toneInstruction: blueprint.host_config.toneInstruction,
    triggerHints: blueprint.host_config.triggerHints,
  };

  const hostConfig: HostConfig = {
    partyKey: worldKey as HostConfig["partyKey"],
    hostName: blueprint.host_config.hostName,
    tone: blueprint.host_config.tone,
    styleGuide,
    cooldownSeconds: blueprint.host_config.cooldownSeconds,
    avatarUrl: `https://api.dicebear.com/9.x/bottts-neutral/png?seed=${encodeURIComponent(blueprint.host_config.hostName)}&size=64`,
  };

  const breakProfile: WorldBreakProfile = {
    queries: blueprint.break_profile.queries,
    channels: blueprint.break_profile.channels,
    publishedAfterMonths: blueprint.break_profile.publishedAfterMonths,
    persona: blueprint.break_profile.persona,
    creatorBoosts: Array.isArray(blueprint.break_profile.creatorBoosts)
      ? blueprint.break_profile.creatorBoosts.reduce(
          (acc: Record<string, number>, b: { channelName: string; weight: number }) => {
            acc[b.channelName] = b.weight;
            return acc;
          },
          {}
        )
      : blueprint.break_profile.creatorBoosts,
  };

  const visualProfile: RoomVisualProfile = {
    worldKey: worldKey as RoomVisualProfile["worldKey"],
    masterPrompt: blueprint.visual_profile.masterPrompt,
    continuityAnchors: blueprint.visual_profile.continuityAnchors,
    palette: blueprint.visual_profile.palette,
    lighting: blueprint.visual_profile.lighting,
    cameraRules: blueprint.visual_profile.cameraRules,
    negativeRules: blueprint.visual_profile.negativeRules,
    uiSafeZones: blueprint.visual_profile.uiSafeZones,
    timeOverrides: blueprint.visual_profile.timeOverrides,
  };

  const dna: RoomDna = {
    worldKey,
    worldConfig,
    hostConfig,
    breakProfile,
    visualProfile: visualProfile,
    syntheticConfig: {
      archetypeMix: blueprint.synthetic_config.archetypeMix,
      targetCount: Math.min(blueprint.synthetic_config.targetCount, 8),
    },
  };

  setRoomDna(worldKey, dna);
}
