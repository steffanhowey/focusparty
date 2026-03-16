/**
 * GET /api/learn/recommendations
 *
 * Returns personalized skill-based path recommendations for the
 * authenticated user. Based on their skill profile, function, and
 * the available path library.
 *
 * Query params:
 *   limit (optional, default 6, max 12)
 */

import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@/lib/supabase/admin";
import { getSkillRecommendations } from "@/lib/skills/recommendations";

export async function GET(request: Request): Promise<Response> {
  // Auth check
  const supabase = await createServerClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Parse limit
  const url = new URL(request.url);
  const limit = Math.min(
    12,
    Math.max(1, parseInt(url.searchParams.get("limit") ?? "6", 10))
  );

  // Load user's function for relevance ranking
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("fp_profiles")
    .select("primary_function")
    .eq("id", user.id)
    .single();

  const userFunction = (profile?.primary_function as string) ?? null;

  try {
    const recommendations = await getSkillRecommendations(
      user.id,
      userFunction,
      limit
    );
    return NextResponse.json({ recommendations });
  } catch (error) {
    console.error("[learn/recommendations] Error:", error);
    return NextResponse.json({ recommendations: [] });
  }
}
