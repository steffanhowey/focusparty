import { createPrototypeReviewReport, getPrototypeReviewReportByKey } from "@/lib/missions/repositories/prototypeReviewRepo";
import {
  buildPrototypeReview,
  type PrototypeReviewBuilderInput,
} from "@/lib/missions/services/prototypeReviewService";
import type { PrototypeReviewReport } from "@/lib/missions/types/prototypeReviewReport";

/** Build and persist the mandatory prototype review report for a prototype key. */
export async function buildAndPersistPrototypeReviewReport(
  input: PrototypeReviewBuilderInput,
): Promise<PrototypeReviewReport> {
  const existing = await getPrototypeReviewReportByKey(input.prototypeKey);
  if (existing) {
    throw new Error(
      `Prototype review report already exists for key "${input.prototypeKey}". Use a new prototype key for a fresh run.`,
    );
  }

  const report = await buildPrototypeReview(input);
  return createPrototypeReviewReport(report);
}

