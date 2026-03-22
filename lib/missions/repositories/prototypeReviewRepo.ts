import { createClient as createAdminClient } from "@/lib/supabase/admin";
import { PrototypeReviewReportSchema } from "@/lib/missions/schema/prototypeReviewReportSchema";
import type { PrototypeReviewReport } from "@/lib/missions/types/prototypeReviewReport";

function mapRowToPrototypeReview(
  row: Record<string, unknown>,
): PrototypeReviewReport {
  return PrototypeReviewReportSchema.parse({
    id: row.id,
    prototypeKey: row.prototype_key,
    audienceFunction: row.audience_function,
    fluencyLevel: row.fluency_level,
    topicSlugs: row.topic_slugs ?? [],
    familyScope: row.family_scope ?? [],
    benchmarkVersion: row.benchmark_version,
    reviewedBriefIds: row.reviewed_brief_ids ?? [],
    sourcePacketCount: row.source_packet_count,
    missionReadyPacketCount: row.mission_ready_packet_count,
    editorialGenerateNowCount: row.editorial_generate_now_count,
    briefGeneratedCount: row.brief_generated_count,
    briefPassCount: row.brief_pass_count,
    briefFailCount: row.brief_fail_count,
    essentialFields: row.essential_fields ?? [],
    deadWeightFields: row.dead_weight_fields ?? [],
    promoteToTier1Fields: row.promote_to_tier1_fields ?? [],
    unstableFamilyDecisions: row.unstable_family_decisions ?? [],
    rejectReasonFrequency: row.reject_reason_frequency ?? [],
    genericBriefFindings: row.generic_brief_findings ?? [],
    requiredChangesBeforeGeneralizedBuildout: row.required_changes ?? [],
    report: row.report ?? {},
    createdAt: row.created_at,
  });
}

/** Persist the mandatory prototype review artifact. */
export async function createPrototypeReviewReport(
  report: PrototypeReviewReport,
): Promise<PrototypeReviewReport> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("fp_mission_prototype_reviews")
    .insert({
      id: report.id,
      prototype_key: report.prototypeKey,
      audience_function: report.audienceFunction,
      fluency_level: report.fluencyLevel,
      topic_slugs: report.topicSlugs,
      family_scope: report.familyScope,
      benchmark_version: report.benchmarkVersion,
      reviewed_brief_ids: report.reviewedBriefIds,
      source_packet_count: report.sourcePacketCount,
      mission_ready_packet_count: report.missionReadyPacketCount,
      editorial_generate_now_count: report.editorialGenerateNowCount,
      brief_generated_count: report.briefGeneratedCount,
      brief_pass_count: report.briefPassCount,
      brief_fail_count: report.briefFailCount,
      essential_fields: report.essentialFields,
      dead_weight_fields: report.deadWeightFields,
      promote_to_tier1_fields: report.promoteToTier1Fields,
      unstable_family_decisions: report.unstableFamilyDecisions as unknown,
      reject_reason_frequency: report.rejectReasonFrequency as unknown,
      generic_brief_findings: report.genericBriefFindings as unknown,
      required_changes: report.requiredChangesBeforeGeneralizedBuildout as unknown,
      report: report.report as unknown,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(
      `[missions/prototypeReviewRepo] create failed: ${error.message}`,
    );
  }

  return mapRowToPrototypeReview(data as Record<string, unknown>);
}

/** Fetch the latest prototype review by prototype key. */
export async function getPrototypeReviewReportByKey(
  prototypeKey: string,
): Promise<PrototypeReviewReport | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("fp_mission_prototype_reviews")
    .select("*")
    .eq("prototype_key", prototypeKey)
    .maybeSingle();

  if (error) {
    throw new Error(
      `[missions/prototypeReviewRepo] lookup failed: ${error.message}`,
    );
  }

  return data ? mapRowToPrototypeReview(data as Record<string, unknown>) : null;
}
