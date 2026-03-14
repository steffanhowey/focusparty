// ─── Lifecycle Stats ─────────────────────────────────────────

import { verifyAdminAuth } from "@/lib/admin/verifyAdminAuth";
import { getLifecycleStats } from "@/lib/rooms/lifecycle";

export async function GET(request: Request): Promise<Response> {
  if (!(await verifyAdminAuth(request))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const stats = await getLifecycleStats();

  return Response.json({ ok: true, ...stats });
}
