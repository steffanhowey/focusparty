import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@/lib/supabase/admin";
import { getSkillBySlug, getSkillDomains } from "@/lib/skills/taxonomy";
import { mapPathRow } from "@/lib/learn/pathGenerator";
import type { LearningPath } from "@/lib/types";

/**
 * GET /api/skills/:slug
 * Returns a single skill with its domain info and tagged learning paths.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
  const { slug } = await params;

  try {
    const skill = await getSkillBySlug(slug);
    if (!skill) {
      return NextResponse.json({ error: "Skill not found" }, { status: 404 });
    }

    // Get domain info
    const domains = await getSkillDomains();
    const domain = domains.find((d) => d.id === skill.domain_id);

    // Get learning paths tagged with this skill
    const supabase = createAdminClient();
    const { data: tags, error: tagError } = await supabase
      .from("fp_skill_tags")
      .select("path_id, relevance")
      .eq("skill_id", skill.id);

    let paths: LearningPath[] = [];
    if (!tagError && tags && tags.length > 0) {
      const pathIds = tags.map((t) => t.path_id);
      const { data: pathRows } = await supabase
        .from("fp_learning_paths")
        .select("*")
        .in("id", pathIds)
        .order("completion_count", { ascending: false });

      if (pathRows) {
        paths = pathRows.map((row) => mapPathRow(row as Record<string, unknown>));
      }
    }

    return NextResponse.json({
      skill: { ...skill, domain: domain ?? null },
      paths,
    });
  } catch (error) {
    console.error(`[api/skills/${slug}] Failed:`, error);
    return NextResponse.json(
      { error: "Failed to load skill" },
      { status: 500 },
    );
  }
}
