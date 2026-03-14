// ─── Creator Catalog List ────────────────────────────────────

import { verifyAdminAuth } from "@/lib/admin/verifyAdminAuth";
import { getCreators } from "@/lib/creators/catalog";

export async function GET(request: Request): Promise<Response> {
  if (!(await verifyAdminAuth(request))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const partnership = url.searchParams.get("partnership") ?? undefined;
  const topic = url.searchParams.get("topic") ?? undefined;
  const minAuthority = url.searchParams.get("minAuthority")
    ? parseFloat(url.searchParams.get("minAuthority")!)
    : undefined;
  const search = url.searchParams.get("search") ?? undefined;
  const limit = url.searchParams.get("limit")
    ? parseInt(url.searchParams.get("limit")!, 10)
    : 50;
  const offset = url.searchParams.get("offset")
    ? parseInt(url.searchParams.get("offset")!, 10)
    : 0;

  const creators = await getCreators({
    partnership,
    topic,
    minAuthority,
    search,
    limit,
    offset,
  });

  return Response.json({ ok: true, count: creators.length, creators });
}
