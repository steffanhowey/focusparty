import { NextResponse } from "next/server";
import {
  computeAllSkillHeat,
  takePractitionerSnapshot,
  enrichMarketState,
} from "@/lib/skills/skillHeatEngine";
import { logger } from "@/lib/logger";

const log = logger("cron/skill-heat");

/**
 * GET /api/skills/compute-heat
 * Daily cron job (3:30am UTC) — computes skill heat from topic heat,
 * takes practitioner snapshots, and enriches market state.
 *
 * Also supports POST for manual trigger.
 */
export async function GET(): Promise<NextResponse> {
  return runPipeline();
}

export async function POST(): Promise<NextResponse> {
  return runPipeline();
}

async function runPipeline(): Promise<NextResponse> {
  const start = Date.now();
  log.info("Skill heat pipeline starting");

  try {
    // Step 1: Compute heat scores from topic clusters
    const heatResult = await computeAllSkillHeat();

    // Step 2: Take practitioner snapshot
    const snapResult = await takePractitionerSnapshot();

    // Step 3: Enrich market state with practitioner data
    const enrichResult = await enrichMarketState();

    const duration = Date.now() - start;
    log.info("Skill heat pipeline complete", {
      duration: `${duration}ms`,
      skillsComputed: heatResult.computed,
      practitionersSnapped: snapResult.skills,
      marketStateEnriched: enrichResult.enriched,
    });

    return NextResponse.json({
      ok: true,
      duration: `${duration}ms`,
      heat: heatResult,
      practitioners: snapResult,
      enrichment: enrichResult,
    });
  } catch (error) {
    log.error("Skill heat pipeline failed", error);
    return NextResponse.json(
      { ok: false, error: "Pipeline failed" },
      { status: 500 }
    );
  }
}
