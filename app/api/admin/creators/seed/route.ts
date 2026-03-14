// ─── Creator Catalog Seed ───────────────────────────────────
// One-time endpoint to seed fp_creators from the hardcoded
// channel lists in worldBreakProfiles.ts.

import { verifyAdminAuth } from "@/lib/admin/verifyAdminAuth";
import { WORLD_BREAK_PROFILES, CATEGORY_PROFILES } from "@/lib/breaks/worldBreakProfiles";
import { ensureCreator } from "@/lib/creators/catalog";
import { getChannelDetails } from "@/lib/breaks/youtubeClient";

export async function POST(request: Request): Promise<Response> {
  if (!(await verifyAdminAuth(request))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Collect all unique channels from world + category profiles
  const channelMap = new Map<string, string>(); // channelId → label

  for (const profile of Object.values(WORLD_BREAK_PROFILES)) {
    for (const ch of profile.channels) {
      channelMap.set(ch.channelId, ch.label);
    }
  }
  for (const profile of Object.values(CATEGORY_PROFILES)) {
    for (const ch of profile.channels) {
      channelMap.set(ch.channelId, ch.label);
    }
  }

  console.log(`[creators/seed] Found ${channelMap.size} unique channels to seed`);

  // Fetch YouTube stats in batches of 50
  const channelIds = [...channelMap.keys()];
  const statsMap = new Map<string, { subscriberCount: number; videoCount: number; viewCount: number }>();

  for (let i = 0; i < channelIds.length; i += 50) {
    try {
      const batch = channelIds.slice(i, i + 50);
      const details = await getChannelDetails(batch);
      for (const d of details) {
        statsMap.set(d.channelId, {
          subscriberCount: d.subscriberCount,
          videoCount: d.videoCount,
          viewCount: d.viewCount,
        });
      }
    } catch (err) {
      console.error("[creators/seed] YouTube API error:", err);
    }
  }

  // Seed each creator
  let seeded = 0;
  let existing = 0;
  const errors: string[] = [];

  for (const [channelId, label] of channelMap.entries()) {
    try {
      const creator = await ensureCreator(channelId, {
        channelName: label,
        discoverySource: "manual",
        partnershipStatus: "indexed",
      });

      if (creator) {
        seeded++;
      }
    } catch (err) {
      const msg = `Failed to seed ${label} (${channelId}): ${(err as Error).message}`;
      errors.push(msg);
      console.error(`[creators/seed] ${msg}`);
    }
  }

  existing = channelMap.size - seeded;

  console.log(
    `[creators/seed] Done: ${seeded} seeded, ${existing} already existed, ${errors.length} errors`
  );

  return Response.json({
    ok: true,
    totalChannels: channelMap.size,
    seeded,
    existing,
    errors,
    statsAvailable: statsMap.size,
  });
}
