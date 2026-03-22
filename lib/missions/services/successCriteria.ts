import type { MissionBriefV2 } from "@/lib/missions/types/missionBriefV2";
import type {
  ArtifactType,
  MissionFamily,
  MissionRejectReason,
} from "@/lib/missions/types/common";

export type SuccessCriterionIssue =
  | "subjective_language"
  | "missing_observable_condition"
  | "missing_required_artifact_structure";

export interface SuccessCriteriaContext {
  artifactType: ArtifactType;
  format: MissionBriefV2["artifact"]["format"];
  minimumSections: string[];
  missionFamily: MissionFamily;
}

export interface SuccessCriterionDraft {
  label: string;
  definition: string;
  critical: boolean;
}

export interface SuccessCriterionAnalysis {
  valid: boolean;
  issues: SuccessCriterionIssue[];
  containsSubjectiveLanguage: boolean;
  hasObservableCondition: boolean;
  hasStructureOrEvidenceAnchor: boolean;
}

const SUBJECTIVE_LANGUAGE_PATTERN =
  /\b(formatted professionally|professional presentation|professional use|clear and actionable|readability|practical|practicality|useful|effective|relevant|well-structured|overall readability|organization|polished|easy to read|directly applicable)\b/;

const OBSERVABLE_VERB_PATTERN =
  /\b(include|includes|contain|contains|list|lists|show|shows|document|documents|provide|provides|identify|identifies|map|maps|cite|cites|reference|references|name|names|specify|specifies|pair|pairs|summarize|summarizes|deliver|delivers|capture|captures|record|records)\b/;

const OBSERVABLE_OBJECT_PATTERN =
  /\b(artifact|brief|matrix|document|output|section|sections|field|fields|row|rows|column|columns|claim|claims|source|sources|recommendation|recommendations|prompt|prompts|audience|evidence|message|workflow|use case|examples?)\b/;

const EXPLICIT_CONDITION_PATTERN =
  /\b(at least|exactly|each|for each|paired with|includes the|contains the|lists the|names the|two|three|four)\b/;

const GENERIC_SECTION_PATTERN =
  /^(summary|overview|notes|details|analysis|key takeaways|takeaways|observations|main points?)$/i;

export function normalizeObservableMinimumSections(
  context: SuccessCriteriaContext,
): string[] {
  const cleaned = [...new Set(context.minimumSections.map((section) => section.trim()).filter(Boolean))];
  const nonGenericCount = cleaned.filter((section) => !GENERIC_SECTION_PATTERN.test(section)).length;
  const isTableArtifact =
    context.missionFamily === "messaging-translation" ||
    context.artifactType === "message-matrix" ||
    context.format === "table";

  if (isTableArtifact) {
    if (cleaned.length >= 4 && nonGenericCount >= 4) {
      return cleaned.slice(0, Math.min(cleaned.length, 6));
    }

    return [
      "audience/problem",
      "prompt principle",
      "marketer benefit",
      "example phrasing",
    ];
  }

  if (cleaned.length >= 3 && nonGenericCount >= 3) {
    return cleaned.slice(0, Math.min(cleaned.length, 5));
  }

  if (
    context.missionFamily === "research-synthesis" ||
    context.artifactType === "audience-brief"
  ) {
    return [
      "working thesis",
      "source-backed prompt patterns",
      "marketing implications",
      "recommended next move",
    ];
  }

  return [
    "what changed",
    "source-backed evidence",
    "recommended next move",
  ];
}

export function analyzeSuccessCriterionDefinition(
  definition: string,
  context: SuccessCriteriaContext,
): SuccessCriterionAnalysis {
  const normalized = normalizeDefinition(definition);
  const structureSections = normalizeObservableMinimumSections(context).map((section) =>
    normalizeToken(section),
  );
  const containsSubjectiveLanguage = SUBJECTIVE_LANGUAGE_PATTERN.test(normalized);
  const hasObservableVerb = OBSERVABLE_VERB_PATTERN.test(normalized);
  const hasObservableObject = OBSERVABLE_OBJECT_PATTERN.test(normalized);
  const referencesNamedStructure = structureSections.some(
    (section) => section.length > 0 && normalized.includes(section),
  );
  const referencesGenericStructure =
    /\b(section|sections|field|fields|row|rows|column|columns)\b/.test(normalized);
  const referencesEvidenceAnchor =
    /\b(claim|claims|source|sources|citation|cited|recommendation|recommendations|example|examples|use case|workflow implication)\b/.test(
      normalized,
    );
  const hasExplicitCondition =
    EXPLICIT_CONDITION_PATTERN.test(normalized) || referencesNamedStructure;
  const hasObservableCondition =
    hasObservableVerb && hasObservableObject && hasExplicitCondition;
  const hasStructureOrEvidenceAnchor =
    referencesNamedStructure || referencesGenericStructure || referencesEvidenceAnchor;

  const issues: SuccessCriterionIssue[] = [];

  if (containsSubjectiveLanguage && !(hasObservableCondition && hasStructureOrEvidenceAnchor)) {
    issues.push("subjective_language");
  } else if (!hasObservableCondition) {
    issues.push("missing_observable_condition");
  } else if (!hasStructureOrEvidenceAnchor) {
    issues.push("missing_required_artifact_structure");
  }

  return {
    valid: issues.length === 0,
    issues,
    containsSubjectiveLanguage,
    hasObservableCondition,
    hasStructureOrEvidenceAnchor,
  };
}

export function getSuccessCriteriaRejectReasons(
  criteria: MissionBriefV2["successCriteria"] | SuccessCriterionDraft[],
  context: SuccessCriteriaContext,
): MissionRejectReason[] {
  const analyses = criteria.map((criterion) =>
    analyzeSuccessCriterionDefinition(criterion.definition, context),
  );

  if (analyses.every((analysis) => analysis.valid)) {
    return [];
  }

  const reasons = new Set<MissionRejectReason>();
  if (analyses.some((analysis) => analysis.issues.includes("subjective_language"))) {
    reasons.add("success_criteria_subjective_language");
  }
  if (analyses.some((analysis) => analysis.issues.includes("missing_observable_condition"))) {
    reasons.add("success_criteria_missing_observable_condition");
  }
  if (
    analyses.some((analysis) =>
      analysis.issues.includes("missing_required_artifact_structure"),
    ) ||
    normalizeObservableMinimumSections(context).length < 3
  ) {
    reasons.add("success_criteria_missing_required_artifact_structure");
  }

  if (reasons.size === 0) {
    reasons.add("success_criteria_unverifiable");
  }

  return [...reasons];
}

export function buildObservableSuccessCriteria(
  context: SuccessCriteriaContext,
): SuccessCriterionDraft[] {
  const minimumSections = normalizeObservableMinimumSections(context);
  const requiredSections = minimumSections.map((section) => `"${section}"`).join(", ");
  const isMessageMatrix =
    context.missionFamily === "messaging-translation" ||
    context.artifactType === "message-matrix" ||
    context.format === "table";

  if (isMessageMatrix) {
    const hasCommunicationBoundaryFields =
      minimumSections.includes("objection") || minimumSections.includes("non-fit boundary");

    return [
      {
        label: "Required matrix fields are present",
        definition: `The final matrix includes the fields ${requiredSections}.`,
        critical: true,
      },
      {
        label: hasCommunicationBoundaryFields
          ? "The message case is fully specified"
          : "Each row is fully specified",
        definition: hasCommunicationBoundaryFields
          ? "The final matrix names one audience, one pain point, one value claim, one proof set, one objection, one non-fit boundary, and at least two example phrasing lines a marketer could reuse."
          : "The final matrix contains at least three rows, and each row names one prompt principle, one marketer-facing benefit, and one example phrasing or prompt input.",
        critical: true,
      },
      {
        label: "Evidence is attached to the matrix",
        definition:
          "At least two rows in the final matrix include a cited packet-backed claim or source-backed note explaining why the message choice matters.",
        critical: true,
      },
    ];
  }

  const hasPromptStructureSections =
    minimumSections.includes("prompt structure 1") &&
    minimumSections.includes("prompt structure 2");

  return hasPromptStructureSections
    ? [
        {
          label: "Required brief sections are complete",
          definition: `The final brief includes the sections ${requiredSections}.`,
          critical: true,
        },
        {
          label: "Workflow recommendation is specific",
          definition:
            "The final brief names one workflow, documents two specific prompt structures to test, and ends with one recommended workflow change.",
          critical: true,
        },
        {
          label: "Failure modes and evidence are present",
          definition:
            "The final brief lists at least two concrete failure modes to avoid and includes at least two cited packet-backed claims or source-backed recommendations.",
          critical: true,
        },
      ]
    : [
    {
      label: "Required brief sections are complete",
      definition: `The final brief includes the sections "${minimumSections[0]}", "${minimumSections[1]}", and "${minimumSections[2]}".`,
      critical: true,
    },
    {
      label: "Recommendations are explicit",
      definition:
        "The final brief lists at least three explicit recommendations or workflow patterns, and each one is paired with a named marketer use case or workflow implication.",
      critical: true,
    },
    {
      label: "Evidence is cited in the brief",
      definition:
        "At least two sections in the final brief include a cited packet-backed claim or source-backed recommendation.",
      critical: true,
    },
  ];
}

export const __testing = {
  analyzeSuccessCriterionDefinition,
  buildObservableSuccessCriteria,
  normalizeObservableMinimumSections,
  getSuccessCriteriaRejectReasons,
};

function normalizeDefinition(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeToken(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}
