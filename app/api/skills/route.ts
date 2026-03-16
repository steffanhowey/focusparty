import { NextResponse } from "next/server";
import {
  getSkillDomains,
  getSkillsWithDomains,
} from "@/lib/skills/taxonomy";

/**
 * GET /api/skills
 * Returns the full skill taxonomy: domains and skills with domain info.
 */
export async function GET(): Promise<NextResponse> {
  try {
    const [domains, skills] = await Promise.all([
      getSkillDomains(),
      getSkillsWithDomains(),
    ]);

    return NextResponse.json({ domains, skills });
  } catch (error) {
    console.error("[api/skills] Failed to load taxonomy:", error);
    return NextResponse.json(
      { error: "Failed to load skill taxonomy" },
      { status: 500 },
    );
  }
}
