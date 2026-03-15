import { describe, it, expect } from "vitest";
import {
  CreatePathSchema,
  UpdateProgressSchema,
  SearchQuerySchema,
  GeneratePathSchema,
  EvaluateSchema,
  parseBody,
  parseSearchParams,
} from "./validation";

describe("CreatePathSchema", () => {
  it("accepts valid query", () => {
    const result = CreatePathSchema.safeParse({ query: "learn cursor" });
    expect(result.success).toBe(true);
  });

  it("rejects query too short", () => {
    const result = CreatePathSchema.safeParse({ query: "a" });
    expect(result.success).toBe(false);
  });

  it("trims whitespace", () => {
    const result = CreatePathSchema.safeParse({ query: "  cursor  " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.query).toBe("cursor");
    }
  });

  it("rejects missing query", () => {
    const result = CreatePathSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe("UpdateProgressSchema", () => {
  it("accepts empty body (all optional)", () => {
    const result = UpdateProgressSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts valid progress update", () => {
    const result = UpdateProgressSchema.safeParse({
      item_index: 3,
      item_completed: "task-1",
      time_delta_seconds: 120,
    });
    expect(result.success).toBe(true);
  });

  it("rejects negative item_index", () => {
    const result = UpdateProgressSchema.safeParse({ item_index: -1 });
    expect(result.success).toBe(false);
  });

  it("rejects excessive time_delta", () => {
    const result = UpdateProgressSchema.safeParse({
      time_delta_seconds: 10000,
    });
    expect(result.success).toBe(false);
  });
});

describe("SearchQuerySchema", () => {
  it("accepts empty params with defaults", () => {
    const result = SearchQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(12);
    }
  });

  it("accepts valid function and fluency", () => {
    const result = SearchQuerySchema.safeParse({
      q: "cursor",
      function: "engineering",
      fluency: "exploring",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid function", () => {
    const result = SearchQuerySchema.safeParse({
      function: "astronaut",
    });
    expect(result.success).toBe(false);
  });

  it("coerces limit string to number", () => {
    const result = SearchQuerySchema.safeParse({ limit: "5" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(5);
    }
  });
});

describe("GeneratePathSchema", () => {
  it("accepts valid generation request", () => {
    const result = GeneratePathSchema.safeParse({
      query: "learn cursor",
      function: "engineering",
      fluency: "exploring",
    });
    expect(result.success).toBe(true);
  });

  it("accepts null function/fluency", () => {
    const result = GeneratePathSchema.safeParse({
      query: "learn cursor",
      function: null,
      fluency: null,
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty query", () => {
    const result = GeneratePathSchema.safeParse({ query: "" });
    expect(result.success).toBe(false);
  });

  it("validates secondary_functions array", () => {
    const result = GeneratePathSchema.safeParse({
      query: "learn ai",
      secondary_functions: ["marketing", "design"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid secondary function", () => {
    const result = GeneratePathSchema.safeParse({
      query: "learn ai",
      secondary_functions: ["marketing", "invalid"],
    });
    expect(result.success).toBe(false);
  });
});

describe("EvaluateSchema", () => {
  it("accepts valid evaluation request", () => {
    const result = EvaluateSchema.safeParse({
      practice_type: "tool_challenge",
      question: "Build a React component",
      user_response: "Here is my component...",
      success_criteria: "Must handle edge cases",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid practice_type", () => {
    const result = EvaluateSchema.safeParse({
      practice_type: "invalid",
      question: "test",
      user_response: "test",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty user_response", () => {
    const result = EvaluateSchema.safeParse({
      practice_type: "standard",
      question: "test",
      user_response: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("parseBody", () => {
  it("returns success with parsed data", () => {
    const result = parseBody(CreatePathSchema, { query: "test query" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.query).toBe("test query");
    }
  });

  it("returns error message on failure", () => {
    const result = parseBody(CreatePathSchema, { query: "a" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("at least 2");
    }
  });
});

describe("parseSearchParams", () => {
  it("parses URLSearchParams correctly", () => {
    const params = new URLSearchParams("q=cursor&limit=5&function=engineering");
    const result = parseSearchParams(SearchQuerySchema, params);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.q).toBe("cursor");
      expect(result.data.limit).toBe(5);
      expect(result.data.function).toBe("engineering");
    }
  });
});
