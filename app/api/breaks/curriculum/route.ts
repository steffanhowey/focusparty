import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPartyRuntimeWorldKey } from "@/lib/worlds";
import { extractYouTubeId } from "@/lib/youtube";

interface CurriculumItem {
  videoId: string;
  title: string;
  sequencePosition: number;
  learningRationale: string;
}

interface CurriculumSequenceData {
  items: CurriculumItem[];
  totalDurationMinutes: number;
  difficultyProgression: string;
}

interface ContentSelectionItem {
  videoId: string;
  title: string;
  creator: string;
  tasteScore: number;
}

/**
 * GET /api/breaks/curriculum?party_id=...
 * Returns the curriculum sequence for a room, or null for non-curriculum rooms.
 */
export async function GET(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const partyId = searchParams.get("party_id");

  if (!partyId) {
    return NextResponse.json({ error: "party_id required" }, { status: 400 });
  }

  // Get the party's blueprint_id
  const { data: party } = await supabase
    .from("fp_parties")
    .select("blueprint_id, world_key, runtime_profile_key")
    .eq("id", partyId)
    .single();

  if (!party?.blueprint_id) {
    return NextResponse.json({ curriculum: null });
  }

  // Get the blueprint's curriculum_sequence and content_selection
  const { data: blueprint } = await supabase
    .from("fp_room_blueprints")
    .select("curriculum_sequence, content_selection")
    .eq("id", party.blueprint_id)
    .single();

  if (!blueprint?.curriculum_sequence) {
    return NextResponse.json({ curriculum: null });
  }

  const sequence = blueprint.curriculum_sequence as CurriculumSequenceData;
  const contentSelection = blueprint.content_selection as {
    items: ContentSelectionItem[];
  } | null;

  if (!sequence.items || sequence.items.length === 0) {
    return NextResponse.json({ curriculum: null });
  }

  // Build a map of videoId → creator/tasteScore from content_selection
  const selectionMap = new Map<string, ContentSelectionItem>();
  if (contentSelection?.items) {
    for (const item of contentSelection.items) {
      selectionMap.set(item.videoId, item);
    }
  }

  // Get shelf items for this room to match curriculum entries to active content
  const { data: shelfItems } = await supabase
    .from("fp_break_content_items")
    .select("id, video_url, title, source_name, duration_seconds, scaffolding, scaffolding_status, taste_score")
    .eq("room_world_key", getPartyRuntimeWorldKey(party))
    .eq("status", "active");

  // Build shelf video ID map
  const shelfByVideoId = new Map<
    string,
    { id: string; title: string; creator: string; durationSeconds: number; tasteScore: number; scaffolding: unknown; scaffolding_status: string | null }
  >();
  for (const item of shelfItems ?? []) {
    const ytId = extractYouTubeId(item.video_url);
    if (ytId) {
      shelfByVideoId.set(ytId, {
        id: item.id,
        title: item.title,
        creator: item.source_name ?? "",
        durationSeconds: item.duration_seconds ?? 0,
        tasteScore: item.taste_score ?? 0,
        scaffolding: item.scaffolding,
        scaffolding_status: item.scaffolding_status,
      });
    }
  }

  // Check which videos the user has completed
  const shelfIds = [...shelfByVideoId.values()].map((s) => s.id);
  const completedVideoIds = new Set<string>();

  if (shelfIds.length > 0) {
    const { data: engagements } = await supabase
      .from("fp_break_engagement")
      .select("content_item_id")
      .eq("user_id", user.id)
      .eq("event_type", "completed")
      .in("content_item_id", shelfIds);

    if (engagements) {
      // Map completed shelf IDs back to video IDs
      const shelfIdToVideoId = new Map<string, string>();
      for (const [vid, shelf] of shelfByVideoId) {
        shelfIdToVideoId.set(shelf.id, vid);
      }
      for (const e of engagements) {
        const vid = shelfIdToVideoId.get(e.content_item_id);
        if (vid) completedVideoIds.add(vid);
      }
    }
  }

  // Build curriculum entries
  const curriculum = sequence.items.map((item) => {
    const shelf = shelfByVideoId.get(item.videoId);
    const selection = selectionMap.get(item.videoId);

    return {
      videoId: item.videoId,
      title: shelf?.title ?? item.title,
      creator: shelf?.creator ?? selection?.creator ?? "",
      sequencePosition: item.sequencePosition,
      learningRationale: item.learningRationale,
      durationSeconds: shelf?.durationSeconds ?? 0,
      tasteScore: shelf?.tasteScore ?? selection?.tasteScore ?? 0,
      scaffolding: shelf?.scaffolding ?? null,
      scaffoldingStatus: shelf?.scaffolding_status ?? null,
      completed: completedVideoIds.has(item.videoId),
      onShelf: !!shelf,
      shelfItemId: shelf?.id ?? null,
    };
  });

  return NextResponse.json({
    curriculum,
    totalDurationMinutes: sequence.totalDurationMinutes,
    difficultyProgression: sequence.difficultyProgression,
  });
}
