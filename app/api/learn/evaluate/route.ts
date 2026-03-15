// ─── Practice Evaluation Endpoint ────────────────────────────
// Evaluates user responses to practice items using GPT-4o-mini.

import { NextResponse } from "next/server";
import OpenAI from "openai";
import { SAFETY_PROMPT } from "@/lib/breaks/contentSafety";

let _openai: OpenAI | null = null;
function getClient(): OpenAI {
  if (!_openai) _openai = new OpenAI();
  return _openai;
}

interface EvaluateRequest {
  practice_type: string;
  question: string;
  reference_answer?: string;
  user_response: string;
  context?: string;
  success_criteria?: string;
  hint?: string;
}

const SYSTEM_PROMPT = `You are a supportive learning coach evaluating a student's practice response.

Rules:
- Be encouraging but honest. If they got it right, say so clearly. If they missed something, explain what and why.
- Keep feedback to 2-4 sentences. Don't write essays.
- Reference specific parts of their response ("You correctly identified X" or "The part about Y needs refinement").
- If their response shows misunderstanding, gently redirect without being condescending.
- End with one actionable suggestion for improvement, or affirmation if they nailed it.
- Never say "Great job!" without substance. Always explain WHY it's good or what to improve.

${SAFETY_PROMPT}`;

const TOOL_CHALLENGE_SYSTEM_PROMPT = `You are a supportive learning coach evaluating a student's tool challenge submission.

The student was given a challenge with specific success criteria, completed it using an AI tool, and pasted their output. Evaluate their submission against the success criteria.

Rules:
- Be encouraging but honest. If they met the criteria, say so clearly. If they missed something, explain what and why.
- Keep feedback to 2-4 sentences. Don't write essays.
- Reference specific parts of their submission ("Your prompt structure is solid" or "The output is missing error handling").
- Break the success criteria into individual checkpoints and evaluate each one.
- End with one actionable suggestion for improvement, or affirmation if they nailed it.
- Never say "Great job!" without substance. Always explain WHY it's good or what to improve.

${SAFETY_PROMPT}`;

const DEFAULT_RESPONSE = {
  feedback:
    "Thanks for giving this a shot! Review the material and try again when you're ready.",
  quality: "good" as const,
};

/** JSON schema for standard practice feedback */
const STANDARD_SCHEMA = {
  name: "practice_feedback",
  strict: true as const,
  schema: {
    type: "object" as const,
    properties: {
      feedback: { type: "string" as const },
      quality: {
        type: "string" as const,
        enum: ["strong", "good", "needs_work"],
      },
    },
    required: ["feedback", "quality"],
    additionalProperties: false,
  },
};

/** JSON schema for tool challenge feedback with per-criterion results */
const TOOL_CHALLENGE_SCHEMA = {
  name: "tool_challenge_feedback",
  strict: true as const,
  schema: {
    type: "object" as const,
    properties: {
      feedback: { type: "string" as const },
      quality: {
        type: "string" as const,
        enum: ["strong", "good", "needs_work"],
      },
      criteria_results: {
        type: "array" as const,
        items: {
          type: "object" as const,
          properties: {
            criterion: { type: "string" as const },
            passed: { type: "boolean" as const },
          },
          required: ["criterion", "passed"],
          additionalProperties: false,
        },
      },
    },
    required: ["feedback", "quality", "criteria_results"],
    additionalProperties: false,
  },
};

const REFLECTION_SYSTEM_PROMPT = `You are an empathetic learning coach reading a student's reflection on what they just learned.

Rules:
- Evaluate depth of thought, NOT correctness. Reflections have no right answer.
- Acknowledge what they noticed or connected. Be specific: "Your observation about X shows real insight."
- If shallow (just restating content), gently prompt deeper thinking: "What would change in your workflow if you applied this?"
- Keep feedback to 1-3 sentences. Reflections are personal — don't over-analyze.
- Always be warm and encouraging. Reflection takes vulnerability.

${SAFETY_PROMPT}`;

const QUICK_CHECK_SYSTEM_PROMPT = `You are a supportive learning coach evaluating a student's answer to a quick comprehension check.

Rules:
- Compare their answer against the correct answer provided.
- If correct, affirm briefly with a one-sentence explanation of WHY it's right.
- If incorrect, explain gently what they missed. Reference the correct answer.
- Keep feedback to 1-2 sentences. Quick checks should feel lightweight.
- Never be condescending. Wrong answers are learning opportunities.

${SAFETY_PROMPT}`;

/** JSON schema for quick check feedback with correctness flag */
const QUICK_CHECK_SCHEMA = {
  name: "quick_check_feedback",
  strict: true as const,
  schema: {
    type: "object" as const,
    properties: {
      feedback: { type: "string" as const },
      quality: {
        type: "string" as const,
        enum: ["strong", "good", "needs_work"],
      },
      is_correct: { type: "boolean" as const },
    },
    required: ["feedback", "quality", "is_correct"],
    additionalProperties: false,
  },
};

/**
 * POST /api/learn/evaluate
 * Evaluate a user's practice response with AI feedback.
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = (await request.json()) as EvaluateRequest;

    if (!body.user_response?.trim() || !body.question?.trim()) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const isToolChallenge =
      body.practice_type === "tool_challenge" && !!body.success_criteria;
    const isReflection = body.practice_type === "reflection";
    const isQuickCheck = body.practice_type === "quick_check";

    const userPrompt = [
      `Practice type: ${body.practice_type}`,
      `Question/Challenge: ${body.question}`,
      body.reference_answer
        ? `Reference/correct answer: ${body.reference_answer}`
        : null,
      body.success_criteria
        ? `Success criteria: ${body.success_criteria}`
        : null,
      body.context ? `Context (source material): ${body.context}` : null,
      body.hint && isQuickCheck ? `Hint for the student: ${body.hint}` : null,
      `\nStudent's submission:\n${body.user_response}`,
    ]
      .filter(Boolean)
      .join("\n");

    // Select system prompt and schema based on practice type
    let systemPrompt = SYSTEM_PROMPT;
    let schema = STANDARD_SCHEMA;
    let maxTokens = 256;

    if (isToolChallenge) {
      systemPrompt = TOOL_CHALLENGE_SYSTEM_PROMPT;
      schema = TOOL_CHALLENGE_SCHEMA;
      maxTokens = 512;
    } else if (isReflection) {
      systemPrompt = REFLECTION_SYSTEM_PROMPT;
      maxTokens = 200;
    } else if (isQuickCheck) {
      systemPrompt = QUICK_CHECK_SYSTEM_PROMPT;
      schema = QUICK_CHECK_SCHEMA;
      maxTokens = 200;
    }

    const response = await getClient().chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: maxTokens,
      temperature: 0.5,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: schema,
      },
    });

    const text = response.choices[0]?.message?.content;
    if (!text) return NextResponse.json(DEFAULT_RESPONSE);

    const parsed = JSON.parse(text);
    return NextResponse.json(parsed);
  } catch (error) {
    console.error("[learn/evaluate] Evaluation failed:", error);
    return NextResponse.json(DEFAULT_RESPONSE);
  }
}
