import { randomUUID } from "crypto";
import OpenAI from "openai";
import { FUNCTION_CONTEXTS } from "@/lib/learn/functionContexts";
import { getDefaultArtifactTypeForFamily } from "@/lib/missions/config/missionFamilies";
import {
  buildMarketerTranslationPrompt,
  MARKETER_TRANSLATION_RESPONSE_SCHEMA,
} from "@/lib/missions/prompts/marketerTranslationPrompt";
import { MarketerTranslationSchema } from "@/lib/missions/schema/marketerTranslationSchema";
import type {
  LaunchDomainKey,
  MissionFamily,
  ProfessionalFunction,
} from "@/lib/missions/types/common";
import type {
  MarketerTranslation,
  MissionFamilyCandidate,
} from "@/lib/missions/types/marketerTranslation";
import type { SourcePacket } from "@/lib/missions/types/sourcePacket";

let openaiClient: OpenAI | null = null;

export interface BuildMarketerTranslationOptions {
  allowedFamilies?: MissionFamily[];
}

export interface MarketerTranslationBuildResult {
  translation: MarketerTranslation | null;
  mode: "model" | "fallback";
  fallbackReason: string | null;
}

interface TranslationCopy {
  whyThisMattersForFunction: string;
  marketerUseCase: string;
}

const FAMILY_DOMAIN_PREFERENCES: Record<MissionFamily, LaunchDomainKey> = {
  "adoption-evaluation": "workflow-design-operations",
  "research-synthesis": "research-insight",
  "messaging-translation": "positioning-messaging",
  "campaign-design": "campaigns-experiments",
  "content-system-design": "content-systems",
  "workflow-design": "workflow-design-operations",
  "creative-direction": "positioning-messaging",
};

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI();
  }

  return openaiClient;
}

/** Translate a validated packet into marketer-native implications and job shapes. */
export async function buildMarketerTranslation(
  packet: SourcePacket,
  professionalFunction: ProfessionalFunction,
  options: BuildMarketerTranslationOptions = {},
): Promise<MarketerTranslationBuildResult> {
  const functionContext = FUNCTION_CONTEXTS[professionalFunction];
  if (!functionContext) {
    return {
      translation: null,
      mode: "fallback",
      fallbackReason: "missing_function_context",
    };
  }

  const missionableHints = packet.marketerRelevanceHints.filter((hint) => hint.missionable);
  if (missionableHints.length === 0 && packet.readiness.state !== "mission_ready") {
    return {
      translation: null,
      mode: "fallback",
      fallbackReason: "no_missionable_hints_before_translation",
    };
  }

  const allowedFamilies = uniqueFamilies(options.allowedFamilies);

  try {
    const prompt = buildMarketerTranslationPrompt({
      professional_function: professionalFunction,
      function_perspective: functionContext.perspective,
      mission_framing: functionContext.missionFraming,
      topic_slug: packet.topic.topicSlug,
      topic_name: packet.topic.topicName,
      allowed_family_scope: allowedFamilies,
      why_now_summary: packet.whyNow.summary,
      key_claims: packet.keyClaims.map((claim) => ({
        claim_id: claim.claimId,
        statement: claim.statement,
        claim_type: claim.claimType,
        importance: claim.importance,
      })),
      marketer_hints: missionableHints.map((hint) => ({
        launch_domain: hint.launchDomain,
        why_marketers_should_care: hint.whyMarketersShouldCare,
        example_use_case: hint.exampleUseCase,
        missionable: hint.missionable,
        suggested_artifact: hint.suggestedArtifact,
      })),
    });

    const response = await getOpenAIClient().chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      max_tokens: 1400,
      messages: [
        { role: "system", content: prompt.system },
        { role: "user", content: prompt.user },
      ],
      response_format: {
        type: "json_schema",
        json_schema: MARKETER_TRANSLATION_RESPONSE_SCHEMA,
      },
    });

    const text = response.choices[0]?.message?.content;
    if (!text) throw new Error("Empty marketer translation response");

    const parsed = MarketerTranslationSchema.parse({
      translationId: randomUUID(),
      topicSlug: packet.topic.topicSlug,
      professionalFunction,
      ...JSON.parse(text),
    });

    const aligned = alignTranslationToScope(
      parsed,
      packet,
      allowedFamilies,
    );
    if (!aligned) {
      throw new Error("No aligned family candidates after translation normalization");
    }

    return {
      translation: aligned,
      mode: "model",
      fallbackReason: null,
    };
  } catch (error) {
    console.warn("[missions/marketerTranslationService] Falling back:", error);
    const fallbackReason =
      error instanceof Error ? error.message : "unknown_translation_error";
    return {
      translation: buildFallbackTranslation(
        packet,
        professionalFunction,
        allowedFamilies,
      ),
      mode: "fallback",
      fallbackReason,
    };
  }
}

function buildFallbackTranslation(
  packet: SourcePacket,
  professionalFunction: ProfessionalFunction,
  allowedFamilies: MissionFamily[],
): MarketerTranslation | null {
  const familyScope = allowedFamilies.length > 0
    ? allowedFamilies.filter((family) => packetSupportsFamily(packet, family))
    : inferDefaultFamilies(packet);

  const usableFamilies = familyScope.length > 0 ? familyScope : inferDefaultFamilies(packet);
  if (usableFamilies.length === 0) return null;

  const copy = buildScopedTranslationCopy(packet, usableFamilies);
  const missionFamilyCandidates = buildScopedFamilyCandidates(packet, usableFamilies, "fallback");
  const affectedLaunchDomains = buildScopedLaunchDomains(packet, usableFamilies, "fallback");

  return {
    translationId: randomUUID(),
    topicSlug: packet.topic.topicSlug,
    professionalFunction,
    whyThisMattersForFunction: copy.whyThisMattersForFunction,
    marketerUseCase: copy.marketerUseCase,
    affectedLaunchDomains,
    missionFamilyCandidates,
    recommendedUseCases: [copy.marketerUseCase],
    nonUseCases: ["Do not treat the topic as a full technical deep-dive."],
    requiredInputHints: ["A lightweight brand or audience context is enough to begin."],
    opinionatedStance:
      "Prioritize a practical first rep over broad exploration or speculative strategy.",
    whatToIgnore: packet.whyNow.whatIsNoiseOrNotYetProven,
  };
}

function alignTranslationToScope(
  translation: MarketerTranslation,
  packet: SourcePacket,
  allowedFamilies: MissionFamily[],
): MarketerTranslation | null {
  const requestedFamilies =
    allowedFamilies.length > 0
      ? allowedFamilies
      : uniqueFamilies(translation.missionFamilyCandidates.map((candidate) => candidate.family));

  const supportedRequestedFamilies = requestedFamilies.filter((family) =>
    packetSupportsFamily(packet, family),
  );
  const fallbackFamilies =
    supportedRequestedFamilies.length > 0 ? supportedRequestedFamilies : inferDefaultFamilies(packet);
  if (fallbackFamilies.length === 0) return null;

  const existingCandidates = translation.missionFamilyCandidates.filter(
    (candidate) =>
      requestedFamilies.length === 0 || requestedFamilies.includes(candidate.family),
  );
  const normalizedCandidates = mergeFamilyCandidates(
    existingCandidates,
    buildScopedFamilyCandidates(packet, fallbackFamilies, "alignment"),
  );

  if (normalizedCandidates.length === 0) return null;

  const copy = requestedFamilies.length === 1
    ? buildScopedTranslationCopy(packet, requestedFamilies)
    : buildMultiFamilyTranslationCopy(packet, normalizedCandidates.map((candidate) => candidate.family));
  const affectedLaunchDomains = mergeLaunchDomains(
    translation.affectedLaunchDomains,
    buildScopedLaunchDomains(packet, normalizedCandidates.map((candidate) => candidate.family), "alignment"),
  );

  return {
    ...translation,
    whyThisMattersForFunction: copy.whyThisMattersForFunction,
    marketerUseCase: copy.marketerUseCase,
    affectedLaunchDomains,
    missionFamilyCandidates: normalizedCandidates,
    recommendedUseCases: uniqueStrings([
      copy.marketerUseCase,
      ...translation.recommendedUseCases,
    ]),
  };
}

function buildScopedFamilyCandidates(
  packet: SourcePacket,
  families: MissionFamily[],
  mode: "fallback" | "alignment",
): MissionFamilyCandidate[] {
  const singleFamilyScope = families.length === 1;

  return families
    .filter((family) => packetSupportsFamily(packet, family))
    .map((family) => ({
      family,
      score: getFamilyCandidateScore(family, singleFamilyScope, mode),
      rationale:
        mode === "fallback"
          ? `Fallback translation aligned to ${family} because the packet evidence supports that job shape.`
          : `Aligned translation candidate added for ${family} based on the requested family scope and packet evidence.`,
      recommendedArtifactType: getDefaultArtifactTypeForFamily(family),
    }))
    .sort((left, right) => right.score - left.score);
}

function buildScopedLaunchDomains(
  packet: SourcePacket,
  families: MissionFamily[],
  mode: "fallback" | "alignment",
): MarketerTranslation["affectedLaunchDomains"] {
  const singleFamilyScope = families.length === 1;
  const seededDomains = packet.marketerRelevanceHints.map((hint) => ({
    launchDomain: hint.launchDomain,
    score: 0.62,
    rationale: "Derived from packet-level marketer relevance hints.",
  }));

  const familyDomains = families
    .filter((family) => packetSupportsFamily(packet, family))
    .map((family) => ({
      launchDomain: FAMILY_DOMAIN_PREFERENCES[family],
      score: singleFamilyScope ? 0.82 : getFamilyDomainScore(family),
      rationale:
        mode === "fallback"
          ? `Fallback launch-domain candidate aligned to ${family}.`
          : `Scoped launch-domain candidate aligned to ${family}.`,
    }));

  return mergeLaunchDomains(seededDomains, familyDomains);
}

function buildScopedTranslationCopy(
  packet: SourcePacket,
  families: MissionFamily[],
): TranslationCopy {
  const topicName = packet.topic.topicName.toLowerCase();
  const topicSlug = packet.topic.topicSlug;
  const family = families[0];

  if (
    topicSlug === "prompt-engineering" &&
    family === "research-synthesis"
  ) {
    return {
      whyThisMattersForFunction:
        "Marketers no longer win by using AI more often. They win by making one recurring workflow, such as content-brief drafting, produce more reliable and specific output.",
      marketerUseCase:
        "Synthesize current prompt-engineering evidence into a workflow brief a content marketer can use to improve AI-assisted content-brief drafting with two prompt structures to test and two failure modes to avoid.",
    };
  }

  if (
    topicSlug === "claude-code" &&
    family === "messaging-translation"
  ) {
    return {
      whyThisMattersForFunction:
        "Marketers increasingly need to explain AI workflow tools to operations-minded teammates without falling back on hype, feature lists, or technical jargon.",
      marketerUseCase:
        "Create an internal message matrix a product marketer could use to explain one Claude Code pilot to a marketing ops lead, including the workflow pain point, value claim, proof, objection, and non-fit boundary.",
    };
  }

  if (family === "messaging-translation") {
    return {
      whyThisMattersForFunction:
        `Marketers need a clearer way to explain how ${topicName} improves input quality, output quality, and repeatability without falling back on vague AI hype.`,
      marketerUseCase:
        `Translate ${topicName} into a message matrix marketers can use to frame better prompt inputs and stronger AI-assisted content output quality for a defined audience.`,
    };
  }

  return {
    whyThisMattersForFunction:
      `Marketers need source-backed insight on which ${topicName} patterns actually improve AI-assisted workflow quality before they standardize them across a team.`,
    marketerUseCase:
      `Synthesize current ${topicName} evidence into a research brief that gives marketers a usable insight on which prompt patterns improve AI-assisted content workflows.`,
  };
}

function buildMultiFamilyTranslationCopy(
  packet: SourcePacket,
  families: MissionFamily[],
): TranslationCopy {
  const topicName = packet.topic.topicName.toLowerCase();
  const includesMessaging = families.includes("messaging-translation");
  const includesResearch = families.includes("research-synthesis");

  if (includesResearch && includesMessaging) {
    return {
      whyThisMattersForFunction:
        `Marketers need both source-backed insight and clearer language for how ${topicName} changes AI-assisted workflow quality.`,
      marketerUseCase:
        `Turn current ${topicName} evidence into a marketer-ready brief or messaging frame that clarifies better inputs, stronger outputs, and practical workflow value.`,
    };
  }

  return buildScopedTranslationCopy(packet, families);
}

function packetSupportsFamily(
  packet: SourcePacket,
  family: MissionFamily,
): boolean {
  const searchText = [
    packet.topic.topicSlug,
    packet.topic.topicName,
    packet.whyNow.summary,
    ...packet.keyClaims.map((claim) => claim.statement),
    ...packet.marketerRelevanceHints.flatMap((hint) => [
      hint.whyMarketersShouldCare,
      hint.exampleUseCase,
      hint.suggestedArtifact ?? "",
    ]),
  ]
    .join(" ")
    .toLowerCase();

  switch (family) {
    case "research-synthesis":
      return packet.keyClaims.length >= 2;
    case "messaging-translation":
      return /(message|messaging|position|copy|audience|content|prompt|frame|story|quality|output)/.test(
        searchText,
      );
    default:
      return false;
  }
}

function inferDefaultFamilies(packet: SourcePacket): MissionFamily[] {
  const defaults: MissionFamily[] = [];

  if (packetSupportsFamily(packet, "research-synthesis")) {
    defaults.push("research-synthesis");
  }

  if (packetSupportsFamily(packet, "messaging-translation")) {
    defaults.push("messaging-translation");
  }

  return defaults;
}

function getFamilyCandidateScore(
  family: MissionFamily,
  singleFamilyScope: boolean,
  mode: "fallback" | "alignment",
): number {
  if (singleFamilyScope) {
    return mode === "fallback" ? 0.8 : 0.82;
  }

  if (family === "research-synthesis") return mode === "fallback" ? 0.78 : 0.8;
  if (family === "messaging-translation") return mode === "fallback" ? 0.73 : 0.75;

  return mode === "fallback" ? 0.65 : 0.68;
}

function getFamilyDomainScore(
  family: MissionFamily,
): number {
  if (family === "research-synthesis") return 0.8;
  if (family === "messaging-translation") return 0.75;
  return 0.68;
}

function mergeFamilyCandidates(
  existing: MissionFamilyCandidate[],
  scoped: MissionFamilyCandidate[],
): MissionFamilyCandidate[] {
  const merged = new Map<MissionFamily, MissionFamilyCandidate>();

  for (const candidate of [...existing, ...scoped]) {
    const current = merged.get(candidate.family);
    if (!current || candidate.score > current.score) {
      merged.set(candidate.family, candidate);
    }
  }

  return [...merged.values()].sort((left, right) => right.score - left.score);
}

function mergeLaunchDomains(
  existing: MarketerTranslation["affectedLaunchDomains"],
  scoped: MarketerTranslation["affectedLaunchDomains"],
): MarketerTranslation["affectedLaunchDomains"] {
  const merged = new Map<LaunchDomainKey, MarketerTranslation["affectedLaunchDomains"][number]>();

  for (const candidate of [...existing, ...scoped]) {
    const current = merged.get(candidate.launchDomain);
    if (!current || candidate.score > current.score) {
      merged.set(candidate.launchDomain, candidate);
    }
  }

  return [...merged.values()].sort((left, right) => right.score - left.score);
}

function uniqueFamilies(
  families?: MissionFamily[],
): MissionFamily[] {
  if (!families || families.length === 0) return [];
  return [...new Set(families)];
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}

export const __testing = {
  alignTranslationToScope,
  buildFallbackTranslation,
  buildScopedFamilyCandidates,
  buildScopedLaunchDomains,
  buildScopedTranslationCopy,
  buildMultiFamilyTranslationCopy,
  packetSupportsFamily,
};
