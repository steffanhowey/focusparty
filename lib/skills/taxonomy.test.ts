import { describe, expect, it } from "vitest";
import {
  normalizeSkillFunctionValue,
  skillMatchesFunction,
} from "./taxonomy";

describe("normalizeSkillFunctionValue", () => {
  it("maps legacy labels to canonical function slugs", () => {
    expect(normalizeSkillFunctionValue("Engineering")).toBe("engineering");
    expect(normalizeSkillFunctionValue("Data")).toBe("data_analytics");
    expect(normalizeSkillFunctionValue("Data & Analytics")).toBe(
      "data_analytics",
    );
    expect(normalizeSkillFunctionValue("Sales")).toBe("sales_revenue");
    expect(normalizeSkillFunctionValue("Sales & Revenue")).toBe(
      "sales_revenue",
    );
  });
});

describe("skillMatchesFunction", () => {
  it("matches legacy taxonomy labels against canonical profile values", () => {
    expect(skillMatchesFunction(["Marketing"], "marketing")).toBe(true);
    expect(skillMatchesFunction(["Data"], "data_analytics")).toBe(true);
    expect(skillMatchesFunction(["Sales"], "sales_revenue")).toBe(true);
  });

  it("treats empty relevant_functions arrays as universal", () => {
    expect(skillMatchesFunction([], "operations")).toBe(true);
  });
});
