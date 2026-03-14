// ─── Manual Discovery Trigger ────────────────────────────────

import { verifyAdminAuth } from "@/lib/admin/verifyAdminAuth";
import { discoverForHotTopics } from "@/lib/breaks/topicTriggeredDiscovery";

export async function POST(request: Request): Promise<Response> {
  if (!(await verifyAdminAuth(request))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    topicSlugs?: string[];
    heatThreshold?: number;
    maxTopics?: number;
  } = {};
  try {
    body = await request.json();
  } catch {
    // Use defaults
  }

  const result = await discoverForHotTopics({
    topicSlugs: body.topicSlugs,
    heatThreshold: body.heatThreshold ?? 0.3,
    maxTopics: body.maxTopics ?? 10,
  });

  return Response.json({ ok: true, ...result });
}
