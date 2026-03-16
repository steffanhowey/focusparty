/**
 * GET /api/intelligence/market-state
 *
 * Returns skill market state data. Public endpoint (cached data).
 *
 * Query params:
 *   trending=true — only return rising/emerging skills
 *   slug=X — return single skill's market state
 *   limit=N — max results (default 40)
 */

import { NextResponse } from "next/server";
import {
  getAllMarketStates,
  getMarketState,
  getTrendingSkills,
} from "@/lib/intelligence/marketState";

export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const slug = url.searchParams.get("slug");
  const trending = url.searchParams.get("trending");
  const limit = Math.min(
    40,
    Math.max(1, parseInt(url.searchParams.get("limit") ?? "40", 10))
  );

  try {
    if (slug) {
      const state = await getMarketState(slug);
      if (!state) {
        return NextResponse.json(
          { error: "Skill not found" },
          { status: 404 }
        );
      }
      return NextResponse.json({ state });
    }

    if (trending === "true") {
      const states = await getTrendingSkills(limit);
      return NextResponse.json({ states });
    }

    const states = await getAllMarketStates();
    return NextResponse.json({ states: states.slice(0, limit) });
  } catch (error) {
    console.error("[intelligence/market-state] Error:", error);
    return NextResponse.json({ states: [] });
  }
}
