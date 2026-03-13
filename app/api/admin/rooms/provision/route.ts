import { NextResponse } from "next/server";
import { requireAdmin, isAdminError } from "@/lib/admin/requireAdmin";
import { provisionRoom } from "@/lib/roomFactory/provision";

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (isAdminError(auth)) return auth;

  let body: { blueprintId: string; overrides?: Record<string, unknown> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.blueprintId?.trim()) {
    return NextResponse.json(
      { error: "Missing required field: blueprintId" },
      { status: 400 }
    );
  }

  try {
    const result = await provisionRoom({
      blueprintId: body.blueprintId,
      overrides: body.overrides as {
        name?: string;
        accentColor?: string;
        defaultSprintLength?: number;
        targetRoomSize?: number;
      },
    });

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Provisioning failed";
    console.error("[room-factory] Provisioning error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
