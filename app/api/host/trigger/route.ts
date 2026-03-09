import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/admin";
import { getHostConfig } from "@/lib/hosts";
import { getPartyHostPersonality } from "@/lib/worlds";
import { buildHostContext, isCooldownActive } from "@/lib/hostTrigger";
import { generateHostPrompt } from "@/lib/hostPrompt";
import type { HostTriggerType } from "@/lib/types";

const VALID_TRIGGERS = new Set<HostTriggerType>([
  "session_started",
  "sprint_started",
  "sprint_midpoint",
  "sprint_near_end",
  "review_entered",
  "session_completed",
]);

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const { triggerType, partyId, sessionId, sprintId, userId, context } =
      body as {
        triggerType: string;
        partyId: string;
        sessionId?: string;
        sprintId?: string;
        userId?: string;
        context?: {
          goalSummary?: string | null;
          participantCount?: number;
          sprintNumber?: number | null;
          sprintDurationSec?: number | null;
          sprintElapsedSec?: number | null;
        };
      };

    // Validate required fields
    if (!triggerType || !partyId) {
      return NextResponse.json(
        { error: "triggerType and partyId are required" },
        { status: 400 }
      );
    }

    if (!VALID_TRIGGERS.has(triggerType as HostTriggerType)) {
      return NextResponse.json(
        { error: `Invalid triggerType: ${triggerType}` },
        { status: 400 }
      );
    }

    // Fetch party to resolve world + host personality
    const supabase = createClient();
    const { data: party, error: partyErr } = await supabase
      .from("fp_parties")
      .select("name, host_personality, world_key")
      .eq("id", partyId)
      .single();

    if (partyErr || !party) {
      return NextResponse.json(
        { error: "Party not found" },
        { status: 404 }
      );
    }

    // Resolve effective personality: party override → world default → "default"
    const effectivePersonality = getPartyHostPersonality(party);
    const config = getHostConfig(effectivePersonality);

    // Cooldown check
    const onCooldown = await isCooldownActive(partyId, config.cooldownSeconds);
    if (onCooldown) {
      return NextResponse.json({
        posted: false,
        reason: "cooldown_active",
      });
    }

    // Build context and generate prompt
    const hostContext = await buildHostContext(
      { triggerType: triggerType as HostTriggerType, partyId, sessionId, sprintId, userId, context },
      party.name,
      effectivePersonality
    );

    const result = await generateHostPrompt(hostContext);

    if (!result.shouldPost || !result.body) {
      return NextResponse.json({
        posted: false,
        reason: result.reason,
      });
    }

    // Insert host event into activity feed
    const { error: insertErr } = await supabase
      .from("fp_activity_events")
      .insert({
        party_id: partyId,
        session_id: sessionId ?? null,
        user_id: userId ?? null,
        actor_type: "host",
        event_type: "host_prompt",
        body: result.body,
        payload: {
          hostName: config.hostName,
          triggerType,
          messageType: result.messageType,
          reason: result.reason,
        },
      });

    if (insertErr) {
      console.error("[host/trigger] Insert failed:", insertErr);
      return NextResponse.json(
        { error: "Failed to insert host event" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      posted: true,
      body: result.body,
      messageType: result.messageType,
      hostName: config.hostName,
    });
  } catch (err) {
    console.error("[host/trigger] Unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
