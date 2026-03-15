// ─── API Request Validation Schemas ────────────────────────
// Zod schemas for learning API routes. Imported by route handlers
// to validate request bodies and query parameters.

import { z } from "zod";

// ─── Shared enums ──────────────────────────────────────────

export const ProfessionalFunctionSchema = z.enum([
  "engineering",
  "marketing",
  "design",
  "product",
  "data_analytics",
  "sales_revenue",
  "operations",
]);

export const FluencyLevelSchema = z.enum([
  "exploring",
  "practicing",
  "proficient",
  "advanced",
]);

// ─── POST /api/learn/paths ─────────────────────────────────

export const CreatePathSchema = z.object({
  query: z
    .string()
    .trim()
    .min(2, "Query must be at least 2 characters")
    .max(200, "Query must be at most 200 characters"),
});

export type CreatePathInput = z.infer<typeof CreatePathSchema>;

// ─── PATCH /api/learn/paths/[id] ───────────────────────────

export const UpdateProgressSchema = z.object({
  item_index: z.number().int().nonnegative().optional(),
  item_completed: z.string().min(1).optional(),
  item_state: z.record(z.string(), z.unknown()).optional(),
  time_delta_seconds: z.number().nonnegative().max(7200).optional(),
  submission: z.string().max(50000).optional(),
});

export type UpdateProgressInput = z.infer<typeof UpdateProgressSchema>;

// ─── GET /api/learn/search ─────────────────────────────────

export const SearchQuerySchema = z.object({
  q: z.string().trim().min(1).max(200).optional(),
  limit: z.coerce.number().int().min(1).max(20).default(12),
  function: ProfessionalFunctionSchema.optional(),
  fluency: FluencyLevelSchema.optional(),
});

export type SearchQueryInput = z.infer<typeof SearchQuerySchema>;

// ─── POST /api/learn/search/generate ───────────────────────

export const GeneratePathSchema = z.object({
  query: z
    .string()
    .trim()
    .min(1, "query is required")
    .max(200),
  function: ProfessionalFunctionSchema.nullable().optional(),
  fluency: FluencyLevelSchema.nullable().optional(),
  secondary_functions: z.array(ProfessionalFunctionSchema).optional(),
});

export type GeneratePathInput = z.infer<typeof GeneratePathSchema>;

// ─── POST /api/learn/evaluate ──────────────────────────────

export const EvaluateSchema = z.object({
  practice_type: z.enum([
    "tool_challenge",
    "reflection",
    "quick_check",
    "standard",
  ]),
  question: z.string().trim().min(1, "question is required").max(5000),
  user_response: z.string().trim().min(1, "user_response is required").max(50000),
  reference_answer: z.string().max(5000).optional(),
  success_criteria: z.string().max(5000).optional(),
  context: z.string().max(10000).optional(),
  hint: z.string().max(1000).optional(),
});

export type EvaluateInput = z.infer<typeof EvaluateSchema>;

// ─── Helpers ───────────────────────────────────────────────

/** Result type for parse helpers. */
export type ParseResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

/**
 * Parse a request body with a Zod schema.
 * Returns { success: true, data } on success, { success: false, error } on failure.
 */
export function parseBody<T>(
  schema: z.ZodSchema<T>,
  raw: unknown
): ParseResult<T> {
  const result = schema.safeParse(raw);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const message = result.error.issues
    .map((i) => `${i.path.join(".")}: ${i.message}`)
    .join("; ");
  return { success: false, error: message };
}

/**
 * Parse URL search params with a Zod schema.
 * Converts URLSearchParams to a plain object first.
 */
export function parseSearchParams<T>(
  schema: z.ZodSchema<T>,
  params: URLSearchParams
): ParseResult<T> {
  const raw: Record<string, string> = {};
  params.forEach((value, key) => {
    raw[key] = value;
  });
  return parseBody(schema, raw);
}
