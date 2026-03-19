/**
 * AI-powered evaluation of practice submissions.
 *
 * Lightweight evaluator that scores user submissions against mission
 * objectives and success criteria. Uses gpt-4o-mini with structured
 * output. Fails gracefully with a default positive evaluation.
 */

import OpenAI from "openai";
import { SAFETY_PROMPT } from "@/lib/breaks/contentSafety";

// ─── OpenAI singleton ───────────────────────────────────────

let _openai: OpenAI | null = null;
function getClient(): OpenAI {
  if (!_openai) _openai = new OpenAI();
  return _openai;
}

// ─── Types ──────────────────────────────────────────────────

/** The evaluation result returned to the client and stored in item_states. */
export interface SubmissionEvaluation {
  /** Overall score 0-100, or null if evaluation failed/was skipped */
  score: number | null;
  /** 1-2 sentence summary feedback */
  feedback: string;
  /** What the learner did well */
  strengths: string[];
  /** Areas to improve */
  improvements: string[];
}

/** Input for the evaluator. */
interface EvaluationInput {
  submission: string;
  objective: string;
  successCriteria: string[];
}

// ─── Schema ─────────────────────────────────────────────────

const EVALUATION_SCHEMA = {
  type: "object" as const,
  properties: {
    score: { type: "number" as const },
    feedback: { type: "string" as const },
    strengths: {
      type: "array" as const,
      items: { type: "string" as const },
    },
    improvements: {
      type: "array" as const,
      items: { type: "string" as const },
    },
  },
  required: ["score", "feedback", "strengths", "improvements"] as const,
  additionalProperties: false,
};

// ─── Default fallback ───────────────────────────────────────

/**
 * Fallback evaluation used when the AI evaluator fails or the submission
 * is too short. Score is null so it does NOT count toward fluency
 * assessment — only real AI evaluations feed into skill progression.
 */
const DEFAULT_EVALUATION: SubmissionEvaluation = {
  score: null,
  feedback: "Your submission was recorded. We couldn't evaluate it automatically — it won't affect your skill progression.",
  strengths: ["Completed the mission"],
  improvements: [],
};

// ─── Evaluate ───────────────────────────────────────────────

/**
 * Evaluate a user's practice submission against the mission criteria.
 * Returns a structured evaluation. Never throws — falls back to a
 * default positive evaluation on any error.
 */
export async function evaluateSubmission(
  input: EvaluationInput
): Promise<SubmissionEvaluation> {
  // Skip evaluation for very short submissions
  if (!input.submission || input.submission.trim().length < 10) {
    return DEFAULT_EVALUATION;
  }

  try {
    const openai = getClient();

    const systemPrompt = `You are an AI learning coach evaluating a student's practice submission on SkillGap.ai.

EVALUATION GUIDELINES:
- Be encouraging but honest. This is a professional learning environment.
- Score 80-100: met or exceeded all success criteria
- Score 60-79: met most criteria with minor gaps
- Score 40-59: partially met criteria, needs improvement
- Score below 40: did not meet the objective
- Provide 1-3 specific strengths (things done well)
- Provide 1-2 specific, actionable improvements
- Keep feedback concise (1-2 sentences)
- Be specific — reference what the learner actually produced
- Never be condescending. These are working professionals.

${SAFETY_PROMPT}`;

    const userPrompt = `MISSION OBJECTIVE:
${input.objective}

SUCCESS CRITERIA:
${input.successCriteria.map((c, i) => `${i + 1}. ${c}`).join("\n")}

STUDENT SUBMISSION:
${input.submission.slice(0, 3000)}

Evaluate this submission against the objective and success criteria.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "submission_evaluation",
          strict: true,
          schema: EVALUATION_SCHEMA,
        },
      },
      temperature: 0.3,
      max_tokens: 500,
    });

    const raw = JSON.parse(response.choices[0].message.content ?? "{}");

    return {
      score: Math.max(0, Math.min(100, raw.score ?? 75)),
      feedback: raw.feedback ?? DEFAULT_EVALUATION.feedback,
      strengths: (raw.strengths as string[])?.slice(0, 3) ?? DEFAULT_EVALUATION.strengths,
      improvements: (raw.improvements as string[])?.slice(0, 2) ?? DEFAULT_EVALUATION.improvements,
    };
  } catch (error) {
    console.error("[evaluator] Evaluation failed, using default:", error);
    return DEFAULT_EVALUATION;
  }
}
