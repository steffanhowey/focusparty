import { NextResponse } from "next/server";
import { getProgressEvidenceImageRoute } from "@/lib/appRoutes";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const url = new URL(getProgressEvidenceImageRoute(id), request.url);

  return NextResponse.redirect(url);
}
