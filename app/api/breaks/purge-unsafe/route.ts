import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/admin";
import { screenContent } from "@/lib/breaks/contentSafety";

/**
 * POST /api/breaks/purge-unsafe
 * Scans all active shelf items and pending/evaluated candidates,
 * removing any that fail the keyword safety screen.
 * Run this once to clean up existing content, then rely on the
 * pipeline's built-in screening for new content.
 */
export async function POST() {
  const supabase = createClient();

  // 1. Scan active shelf items
  const { data: shelfItems, error: shelfErr } = await supabase
    .from("fp_break_content_items")
    .select("id, title, description, room_world_key, status")
    .eq("status", "active");

  if (shelfErr) {
    return NextResponse.json({ error: shelfErr.message }, { status: 500 });
  }

  const shelfPurged: string[] = [];

  for (const item of shelfItems ?? []) {
    const result = screenContent(item.title ?? "", item.description);
    if (!result.safe) {
      await supabase
        .from("fp_break_content_items")
        .update({ status: "expired" })
        .eq("id", item.id);
      shelfPurged.push(`${item.room_world_key}: "${item.title}" — ${result.reason}`);
    }
  }

  // 2. Scan pending/evaluated candidates
  const { data: candidates, error: candErr } = await supabase
    .from("fp_break_content_candidates")
    .select("id, title, description, world_key, status")
    .in("status", ["pending", "evaluated"]);

  if (candErr) {
    return NextResponse.json({ error: candErr.message }, { status: 500 });
  }

  const candidatesPurged: string[] = [];

  for (const cand of candidates ?? []) {
    const result = screenContent(cand.title ?? "", cand.description);
    if (!result.safe) {
      await supabase
        .from("fp_break_content_candidates")
        .update({ status: "rejected" })
        .eq("id", cand.id);
      candidatesPurged.push(`${cand.world_key}: "${cand.title}" — ${result.reason}`);
    }
  }

  console.log(
    `[breaks/purge-unsafe] Purged ${shelfPurged.length} shelf items, ${candidatesPurged.length} candidates`
  );

  return NextResponse.json({
    shelfPurged: shelfPurged.length,
    candidatesPurged: candidatesPurged.length,
    shelfDetails: shelfPurged,
    candidateDetails: candidatesPurged,
  });
}
