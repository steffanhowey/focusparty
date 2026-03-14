// ─── Auto-Approval Engine ───────────────────────────────────
// Evaluates auto-generated room blueprints for automatic approval.
// Starts disabled. When enabled, checks quality criteria and
// daily cap before approving. All decisions are audit-logged.

import { createClient } from "@/lib/supabase/admin";
import type { AutoApprovalConfig, AutoApprovalLogEntry } from "@/lib/types";

// ─── Config ─────────────────────────────────────────────────

/**
 * Read the current auto-approval configuration.
 */
export async function getAutoApprovalConfig(): Promise<AutoApprovalConfig> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("fp_auto_approval_config")
    .select("*")
    .limit(1)
    .single();

  if (error || !data) {
    console.error("[rooms/autoApproval] config read error:", error);
    return {
      id: "",
      enabled: false,
      minHeatScore: 0.75,
      minContentScore: 65,
      minCreatorAuthority: 0.6,
      minCurriculumItems: 3,
      maxDailyApprovals: 5,
      updatedAt: new Date().toISOString(),
      updatedBy: null,
    };
  }

  return mapConfigRow(data);
}

/**
 * Update auto-approval configuration.
 */
export async function updateAutoApprovalConfig(
  updates: Partial<Omit<AutoApprovalConfig, "id" | "updatedAt">>,
  updatedBy: string
): Promise<void> {
  const supabase = createClient();

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    updated_by: updatedBy,
  };

  if (updates.enabled !== undefined) updateData.enabled = updates.enabled;
  if (updates.minHeatScore !== undefined) updateData.min_heat_score = updates.minHeatScore;
  if (updates.minContentScore !== undefined) updateData.min_content_score = updates.minContentScore;
  if (updates.minCreatorAuthority !== undefined) updateData.min_creator_authority = updates.minCreatorAuthority;
  if (updates.minCurriculumItems !== undefined) updateData.min_curriculum_items = updates.minCurriculumItems;
  if (updates.maxDailyApprovals !== undefined) updateData.max_daily_approvals = updates.maxDailyApprovals;

  // Update the single config row
  const { error } = await supabase
    .from("fp_auto_approval_config")
    .update(updateData)
    .not("id", "is", null); // Update all rows (there's only one)

  if (error) {
    console.error("[rooms/autoApproval] config update error:", error);
  }
}

// ─── Evaluation ─────────────────────────────────────────────

export interface AutoApprovalResult {
  decision: "approved" | "skipped" | "cap_reached";
  reason: string;
}

/**
 * Evaluate a blueprint for automatic approval.
 * Returns decision + reason. Logs the decision to audit table.
 */
export async function evaluateForAutoApproval(
  blueprintId: string
): Promise<AutoApprovalResult> {
  const config = await getAutoApprovalConfig();

  // Check 1: Is auto-approval enabled?
  if (!config.enabled) {
    await logDecision(blueprintId, config, {}, "skipped", "Auto-approval disabled");
    return { decision: "skipped", reason: "Auto-approval disabled" };
  }

  const supabase = createClient();

  // Check 2: Daily cap
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const { count: todayApprovals } = await supabase
    .from("fp_auto_approval_log")
    .select("*", { count: "exact", head: true })
    .eq("decision", "approved")
    .gte("created_at", todayStart.toISOString());

  if ((todayApprovals ?? 0) >= config.maxDailyApprovals) {
    await logDecision(blueprintId, config, {}, "cap_reached", `Daily cap reached (${todayApprovals}/${config.maxDailyApprovals})`);
    return { decision: "cap_reached", reason: `Daily cap reached (${todayApprovals}/${config.maxDailyApprovals})` };
  }

  // Get blueprint details
  const { data: blueprint } = await supabase
    .from("fp_room_blueprints")
    .select("heat_score_at_generation, curriculum_sequence, content_selection")
    .eq("id", blueprintId)
    .single();

  if (!blueprint) {
    await logDecision(blueprintId, config, {}, "skipped", "Blueprint not found");
    return { decision: "skipped", reason: "Blueprint not found" };
  }

  const scores: Record<string, number> = {
    heatScore: blueprint.heat_score_at_generation ?? 0,
  };

  // Check 3: Heat score
  if (scores.heatScore < config.minHeatScore) {
    await logDecision(blueprintId, config, scores, "skipped", `Heat score ${scores.heatScore.toFixed(3)} < ${config.minHeatScore}`);
    return { decision: "skipped", reason: `Heat score ${scores.heatScore.toFixed(3)} below threshold ${config.minHeatScore}` };
  }

  // Check 4: Curriculum size
  const curriculum = (blueprint.curriculum_sequence ?? []) as Array<Record<string, unknown>>;
  scores.curriculumItems = curriculum.length;
  if (curriculum.length < config.minCurriculumItems) {
    await logDecision(blueprintId, config, scores, "skipped", `Curriculum has ${curriculum.length} items (need ${config.minCurriculumItems})`);
    return { decision: "skipped", reason: `Curriculum has ${curriculum.length} items (need ${config.minCurriculumItems})` };
  }

  // Check 5: Content scores (from content_selection)
  const contentSelection = blueprint.content_selection as Record<string, unknown> | null;
  const avgTasteScore = Number(contentSelection?.avgTasteScore ?? 0);
  scores.avgContentScore = avgTasteScore;
  if (avgTasteScore < config.minContentScore) {
    await logDecision(blueprintId, config, scores, "skipped", `Avg content score ${avgTasteScore.toFixed(1)} < ${config.minContentScore}`);
    return { decision: "skipped", reason: `Avg content score ${avgTasteScore.toFixed(1)} below threshold ${config.minContentScore}` };
  }

  // Check 6: Creator authority (check curriculum video creators)
  const videoIds = curriculum
    .map((item) => item.videoId as string)
    .filter(Boolean);

  if (videoIds.length > 0) {
    const { data: candidates } = await supabase
      .from("fp_break_content_candidates")
      .select("channel_id")
      .in("external_id", videoIds)
      .not("channel_id", "is", null);

    if (candidates && candidates.length > 0) {
      const channelIds = [...new Set(candidates.map((c) => c.channel_id))];
      const { data: creators } = await supabase
        .from("fp_creators")
        .select("authority_score")
        .in("channel_id", channelIds);

      if (creators && creators.length > 0) {
        const minAuthority = Math.min(...creators.map((c) => c.authority_score ?? 0));
        scores.minCreatorAuthority = minAuthority;
        if (minAuthority < config.minCreatorAuthority) {
          await logDecision(blueprintId, config, scores, "skipped", `Min creator authority ${minAuthority.toFixed(3)} < ${config.minCreatorAuthority}`);
          return { decision: "skipped", reason: `Min creator authority ${minAuthority.toFixed(3)} below threshold ${config.minCreatorAuthority}` };
        }
      }
    }
  }

  // All checks passed — approve
  const { error: approveError } = await supabase
    .from("fp_room_blueprints")
    .update({ review_status: "approved", reviewed_at: new Date().toISOString() })
    .eq("id", blueprintId);

  if (approveError) {
    console.error("[rooms/autoApproval] approve error:", approveError);
    await logDecision(blueprintId, config, scores, "skipped", `Database error: ${approveError.message}`);
    return { decision: "skipped", reason: `Database error: ${approveError.message}` };
  }

  await logDecision(blueprintId, config, scores, "approved", "All criteria met");
  return { decision: "approved", reason: "All criteria met" };
}

// ─── Stats ──────────────────────────────────────────────────

/**
 * Get auto-approval stats for the given period.
 */
export async function getAutoApprovalStats(
  daysBack = 7
): Promise<{ approved: number; skipped: number; capReached: number }> {
  const supabase = createClient();
  const cutoff = new Date(Date.now() - daysBack * 86400000).toISOString();

  const { data } = await supabase
    .from("fp_auto_approval_log")
    .select("decision")
    .gte("created_at", cutoff);

  const entries = data ?? [];
  return {
    approved: entries.filter((e) => e.decision === "approved").length,
    skipped: entries.filter((e) => e.decision === "skipped").length,
    capReached: entries.filter((e) => e.decision === "cap_reached").length,
  };
}

/**
 * Get recent auto-approval log entries.
 */
export async function getAutoApprovalLog(
  limit = 50
): Promise<AutoApprovalLogEntry[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("fp_auto_approval_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []).map(mapLogRow);
}

// ─── Internal ───────────────────────────────────────────────

async function logDecision(
  blueprintId: string,
  config: AutoApprovalConfig,
  scores: Record<string, number>,
  decision: string,
  reason: string
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("fp_auto_approval_log").insert({
    blueprint_id: blueprintId,
    criteria_snapshot: config,
    scores_snapshot: scores,
    decision,
    reason,
  });

  if (error) {
    console.error("[rooms/autoApproval] log error:", error);
  }
}

function mapConfigRow(row: Record<string, unknown>): AutoApprovalConfig {
  return {
    id: row.id as string,
    enabled: (row.enabled as boolean) ?? false,
    minHeatScore: Number(row.min_heat_score ?? 0.75),
    minContentScore: Number(row.min_content_score ?? 65),
    minCreatorAuthority: Number(row.min_creator_authority ?? 0.6),
    minCurriculumItems: (row.min_curriculum_items as number) ?? 3,
    maxDailyApprovals: (row.max_daily_approvals as number) ?? 5,
    updatedAt: (row.updated_at as string) ?? new Date().toISOString(),
    updatedBy: (row.updated_by as string) ?? null,
  };
}

function mapLogRow(row: Record<string, unknown>): AutoApprovalLogEntry {
  return {
    id: row.id as string,
    blueprintId: row.blueprint_id as string,
    criteriaSnapshot: row.criteria_snapshot as AutoApprovalConfig,
    scoresSnapshot: (row.scores_snapshot as Record<string, number>) ?? {},
    decision: row.decision as AutoApprovalLogEntry["decision"],
    reason: (row.reason as string) ?? null,
    createdAt: row.created_at as string,
  };
}
