// ─── Creator Opt-Out ─────────────────────────────────────────

import { verifyAdminAuth } from "@/lib/admin/verifyAdminAuth";
import { optOutCreator } from "@/lib/creators/catalog";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ channelId: string }> }
): Promise<Response> {
  if (!(await verifyAdminAuth(request))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { channelId } = await params;

  let reason: string | undefined;
  try {
    const body = await request.json();
    reason = body.reason;
  } catch {
    // No reason provided
  }

  await optOutCreator(channelId, reason);

  return Response.json({ ok: true, channelId, optedOut: true });
}
