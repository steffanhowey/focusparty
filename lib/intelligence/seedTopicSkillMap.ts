/**
 * Topic-to-Skill mapping seed generator.
 *
 * Uses GPT-4o-mini to generate initial fp_topic_skill_map entries
 * from the canonical topic taxonomy and skill taxonomy.
 * Output is SQL for human review before committing.
 */

import OpenAI from "openai";
import { getTopics } from "@/lib/topics/taxonomy";
import { getSkillsWithDomains } from "@/lib/skills/taxonomy";
import type { TopicSkillMapping, TopicSkillRelationship } from "@/lib/types/intelligence";

let _openai: OpenAI | null = null;
function getClient(): OpenAI {
  if (!_openai) _openai = new OpenAI();
  return _openai;
}

// ─── Structured Output Schema ────────────────────────────────

const MAPPING_SCHEMA = {
  type: "object" as const,
  properties: {
    mappings: {
      type: "array" as const,
      description: "Topic-to-skill mappings",
      items: {
        type: "object" as const,
        properties: {
          topic_slug: { type: "string" as const },
          skill_slug: { type: "string" as const },
          strength: {
            type: "number" as const,
            description: "0.1-1.0. 1.0=direct mapping, 0.7-0.9=strong applied, 0.4-0.6=moderate, 0.1-0.3=weak contextual",
          },
          relationship: {
            type: "string" as const,
            enum: ["direct", "applied", "contextual"],
          },
        },
        required: ["topic_slug", "skill_slug", "strength", "relationship"] as const,
        additionalProperties: false as const,
      },
    },
  },
  required: ["mappings"] as const,
  additionalProperties: false as const,
};

// ─── Main ────────────────────────────────────────────────────

/**
 * Generate topic-to-skill mappings using GPT-4o-mini.
 * Returns structured mappings and ready-to-run SQL.
 */
export async function generateTopicSkillSeed(): Promise<{
  mappings: TopicSkillMapping[];
  sql: string;
  stats: {
    total: number;
    direct: number;
    applied: number;
    contextual: number;
    topics_mapped: number;
    skills_mapped: number;
  };
}> {
  const [topics, skills] = await Promise.all([
    getTopics(),
    getSkillsWithDomains(),
  ]);

  const topicList = topics
    .map((t) => `- ${t.slug} (${t.category}): ${t.name}${t.description ? ` — ${t.description}` : ""}`)
    .join("\n");

  const skillList = skills
    .map((s) => `- ${s.slug} [${s.domain.name}]: ${s.name} — ${s.description}`)
    .join("\n");

  const response = await getClient().chat.completions.create({
    model: "gpt-4o-mini",
    max_tokens: 8000,
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content: `You are mapping topics from an AI signal intelligence pipeline to professional skills in a skill taxonomy.

Each topic represents a tool, technique, concept, role, or platform that appears in AI news/signals.
Each skill represents a discrete professional capability that users develop through learning paths.

RULES:
- Every topic should map to at least 1 skill (most topics are relevant to something)
- A topic can map to multiple skills (e.g., "cursor" → ai-code-generation AND prompt-engineering)
- A skill can be mapped from multiple topics
- Use strength to indicate how strongly the topic develops/relates to the skill:
  * 1.0: topic IS the skill (e.g., "prompt-engineering" topic → "prompt-engineering" skill)
  * 0.7-0.9: topic is a primary tool/technique for the skill (e.g., "cursor" → "ai-code-generation")
  * 0.4-0.6: topic moderately develops the skill (e.g., "react" → "ai-code-generation")
  * 0.1-0.3: topic provides weak/contextual background (e.g., "transformers" → "prompt-engineering")
- Use relationship types:
  * "direct": topic IS the skill in practice
  * "applied": topic is a tool/technique that develops the skill
  * "contextual": topic provides background relevant to the skill
- Be thorough but accurate. Quality over quantity for weak mappings.
- ONLY use exact slugs from the provided lists.`,
      },
      {
        role: "user",
        content: `Map these topics to these skills.

TOPICS:
${topicList}

SKILLS:
${skillList}

Generate all valid mappings. Be thorough for direct and applied relationships, selective for contextual.`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "topic_skill_mappings",
        strict: true,
        schema: MAPPING_SCHEMA,
      },
    },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("No response from GPT-4o-mini");

  const parsed = JSON.parse(content) as { mappings: TopicSkillMapping[] };

  // Validate slugs
  const validTopics = new Set(topics.map((t) => t.slug));
  const validSkills = new Set(skills.map((s) => s.slug));

  const validMappings = parsed.mappings.filter((m) => {
    if (!validTopics.has(m.topic_slug)) {
      console.warn(`[seed] Invalid topic slug: ${m.topic_slug}`);
      return false;
    }
    if (!validSkills.has(m.skill_slug)) {
      console.warn(`[seed] Invalid skill slug: ${m.skill_slug}`);
      return false;
    }
    if (m.strength < 0.1 || m.strength > 1.0) return false;
    if (!["direct", "applied", "contextual"].includes(m.relationship)) return false;
    return true;
  });

  // Generate SQL
  const sqlValues = validMappings
    .map(
      (m) =>
        `  ('${m.topic_slug}', '${m.skill_slug}', ${m.strength.toFixed(2)}, '${m.relationship}')`
    )
    .join(",\n");

  const sql = `-- Generated topic-to-skill mappings (${validMappings.length} rows)
-- Review before running!

INSERT INTO fp_topic_skill_map (topic_slug, skill_slug, strength, relationship)
VALUES
${sqlValues}
ON CONFLICT (topic_slug, skill_slug) DO UPDATE SET
  strength = EXCLUDED.strength,
  relationship = EXCLUDED.relationship;`;

  // Stats
  const stats = {
    total: validMappings.length,
    direct: validMappings.filter((m) => m.relationship === "direct").length,
    applied: validMappings.filter((m) => m.relationship === "applied").length,
    contextual: validMappings.filter((m) => m.relationship === "contextual").length,
    topics_mapped: new Set(validMappings.map((m) => m.topic_slug)).size,
    skills_mapped: new Set(validMappings.map((m) => m.skill_slug)).size,
  };

  return { mappings: validMappings, sql, stats };
}
