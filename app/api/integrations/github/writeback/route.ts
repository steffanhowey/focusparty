import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@/lib/supabase/admin";
import { writeBackToGitHub } from "@/lib/integrations/github";
import type { WritebackPayload } from "@/lib/integrations/types";

/**
 * POST /api/integrations/github/writeback
 * Posts a comment or status update back to a GitHub issue/PR.
 * Body: { externalId: string, sessionId?: string, payload: WritebackPayload }
 */
export async function POST(request: Request) {
  try {
    const { externalId, sessionId, payload } = (await request.json()) as {
      externalId: string;
      sessionId?: string;
      payload: WritebackPayload;
    };

    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const providerToken = session.provider_token;
    if (!providerToken) {
      return NextResponse.json(
        { error: "No GitHub token available. Try reconnecting GitHub." },
        { status: 401 }
      );
    }

    // Perform the writeback
    let success = true;
    let errorMessage: string | null = null;

    try {
      await writeBackToGitHub(providerToken, externalId, payload);
    } catch (err) {
      success = false;
      errorMessage = err instanceof Error ? err.message : String(err);
    }

    // Log the writeback attempt
    const admin = createAdminClient();
    await admin.from("fp_integration_writebacks").insert({
      user_id: session.user.id,
      session_id: sessionId ?? null,
      provider: "github",
      resource_id: null,
      action_type: payload.action,
      payload: payload as unknown as Record<string, unknown>,
      success,
      error_message: errorMessage,
    });

    if (!success) {
      return NextResponse.json(
        { error: errorMessage ?? "Writeback failed" },
        { status: 502 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[github/writeback] Error:", err);
    return NextResponse.json(
      { error: "Failed to write back to GitHub" },
      { status: 500 }
    );
  }
}
