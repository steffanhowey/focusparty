/** Professional function — the user's primary domain. */
export type ProfessionalFunction =
  | "engineering"
  | "marketing"
  | "design"
  | "product"
  | "data_analytics"
  | "sales_revenue"
  | "operations";

/** AI fluency level — self-assessed during onboarding. */
export type FluencyLevel =
  | "exploring"
  | "practicing"
  | "proficient"
  | "advanced";

/** Metadata for a single function card in the selection grid. */
export interface FunctionOption {
  value: ProfessionalFunction;
  label: string;
  icon: string;
}

/** Metadata for a single fluency card. */
export interface FluencyOption {
  value: FluencyLevel;
  label: string;
  anchor: string;
}

/** An editorial pick from fp_onboarding_picks — drives Step 3 recommendations. */
export interface OnboardingPick {
  id: string;
  function: string;
  fluency_level: string;
  path_topic: string;
  display_title: string;
  display_description: string;
  time_estimate_min: number;
  module_count: number;
  tool_names: string[];
  sort_order: number;
}

/** Canonical function options for the selection grid. */
export const FUNCTION_OPTIONS: FunctionOption[] = [
  { value: "engineering", label: "Engineering", icon: "code-2" },
  { value: "marketing", label: "Marketing", icon: "megaphone" },
  { value: "design", label: "Design", icon: "pen-tool" },
  { value: "product", label: "Product", icon: "layers" },
  { value: "data_analytics", label: "Data & Analytics", icon: "bar-chart-3" },
  { value: "sales_revenue", label: "Sales & Revenue", icon: "handshake" },
  { value: "operations", label: "Operations", icon: "settings" },
];

/** Canonical fluency options with anchor descriptions. */
export const FLUENCY_OPTIONS: FluencyOption[] = [
  {
    value: "exploring",
    label: "Exploring",
    anchor:
      "I've heard about AI tools but haven't really used them for work yet.",
  },
  {
    value: "practicing",
    label: "Practicing",
    anchor:
      "I've tried tools like ChatGPT or Copilot a few times, but I'm not consistent.",
  },
  {
    value: "proficient",
    label: "Proficient",
    anchor:
      "I use AI tools regularly in my workflow and I'm comfortable with prompting.",
  },
  {
    value: "advanced",
    label: "Advanced",
    anchor:
      "I've built custom workflows, integrated APIs, or taught others to use AI tools.",
  },
];
