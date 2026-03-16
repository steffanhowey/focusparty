/**
 * Backfill skill tags for existing learning paths.
 *
 * Loads all paths from fp_learning_paths that have no entries in fp_skill_tags,
 * then uses GPT-4o-mini to tag each with 2-4 skills from the taxonomy.
 *
 * Usage:
 *   npx tsx scripts/backfill-skill-tags.ts
 *
 * Requires OPENAI_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * in environment (or .env.local).
 */

import "dotenv/config";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

const BATCH_SIZE = 10;
const MODEL = "gpt-4o-mini";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env vars");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const openai = new OpenAI();
const supabase = getSupabase();

interface SkillRow {
  id: string;
  slug: string;
  name: string;
}

interface PathRow {
  id: string;
  title: string;
  description: string;
  topics: string[] | null;
  primary_tools: string[] | null;
  goal: string | null;
}

const TAGGING_SCHEMA = {
  type: "object" as const,
  properties: {
    skills: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          skill_slug: { type: "string" as const },
          relevance: {
            type: "string" as const,
            enum: ["primary", "secondary"],
          },
        },
        required: ["skill_slug", "relevance"] as const,
        additionalProperties: false,
      },
    },
  },
  required: ["skills"] as const,
  additionalProperties: false,
};

async function loadSkills(): Promise<SkillRow[]> {
  const { data, error } = await supabase
    .from("fp_skills")
    .select("id, slug, name")
    .order("sort_order");
  if (error) throw error;
  return data as SkillRow[];
}

async function loadUntaggedPaths(): Promise<PathRow[]> {
  // Get all path IDs that already have tags
  const { data: tagged } = await supabase
    .from("fp_skill_tags")
    .select("path_id");
  const taggedIds = new Set((tagged ?? []).map((t) => t.path_id));

  // Get all paths
  const { data: paths, error } = await supabase
    .from("fp_learning_paths")
    .select("id, title, description, topics, primary_tools, goal")
    .order("created_at", { ascending: false });
  if (error) throw error;

  return (paths as PathRow[]).filter((p) => !taggedIds.has(p.id));
}

async function tagPath(
  path: PathRow,
  skills: SkillRow[],
  skillSlugList: string,
): Promise<number> {
  const prompt = `Tag this learning path with 2-4 skills from the available taxonomy.

Path title: ${path.title}
Path description: ${path.description ?? ""}
Path goal: ${path.goal ?? ""}
Topics: ${(path.topics ?? []).join(", ")}
Tools: ${(path.primary_tools ?? []).join(", ")}

Available skill slugs:
${skillSlugList}

Rules:
- "primary": The main skill(s) this path builds (1-2 max)
- "secondary": Skills practiced but not the main focus (1-2 max)
- Select skills that match what the learner will DO, not just read about
- Return 2-4 skills total`;

  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [{ role: "user", content: prompt }],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "skill_tags",
        strict: true,
        schema: TAGGING_SCHEMA,
      },
    },
    temperature: 0.3,
  });

  const raw = JSON.parse(response.choices[0].message.content ?? "{}");
  const rawSkills = (raw.skills ?? []) as Array<{
    skill_slug: string;
    relevance: string;
  }>;

  const skillMap = new Map(skills.map((s) => [s.slug, s]));
  const rows: Array<{ path_id: string; skill_id: string; relevance: string }> =
    [];

  for (const tag of rawSkills) {
    const skill = skillMap.get(tag.skill_slug);
    if (skill && (tag.relevance === "primary" || tag.relevance === "secondary")) {
      rows.push({
        path_id: path.id,
        skill_id: skill.id,
        relevance: tag.relevance,
      });
    }
  }

  if (rows.length > 0) {
    const { error } = await supabase.from("fp_skill_tags").insert(rows);
    if (error) {
      console.error(`  Error writing tags for "${path.title}":`, error.message);
      return 0;
    }
  }

  return rows.length;
}

async function main(): Promise<void> {
  console.log("Loading skill taxonomy...");
  const skills = await loadSkills();
  const skillSlugList = skills.map((s) => `${s.slug} (${s.name})`).join(", ");
  console.log(`Loaded ${skills.length} skills`);

  console.log("Loading untagged paths...");
  const paths = await loadUntaggedPaths();
  console.log(`Found ${paths.length} untagged paths`);

  if (paths.length === 0) {
    console.log("Nothing to backfill.");
    return;
  }

  let totalTagged = 0;
  let totalPaths = 0;

  for (let i = 0; i < paths.length; i += BATCH_SIZE) {
    const batch = paths.slice(i, i + BATCH_SIZE);
    console.log(
      `\nBatch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(paths.length / BATCH_SIZE)} (${batch.length} paths)`,
    );

    for (const path of batch) {
      try {
        const count = await tagPath(path, skills, skillSlugList);
        totalPaths++;
        totalTagged += count;
        console.log(`  ✓ "${path.title}" → ${count} skills`);
      } catch (err) {
        console.error(
          `  ✗ "${path.title}":`,
          err instanceof Error ? err.message : err,
        );
      }
    }

    // Brief pause between batches to respect rate limits
    if (i + BATCH_SIZE < paths.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  console.log(
    `\nDone. Tagged ${totalPaths} paths with ${totalTagged} total skill tags.`,
  );
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
