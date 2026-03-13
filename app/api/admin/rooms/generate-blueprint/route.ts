import { NextResponse } from "next/server";
import OpenAI from "openai";
import { requireAdmin, isAdminError } from "@/lib/admin/requireAdmin";
import { createClient as createAdminClient } from "@/lib/supabase/admin";
import {
  buildBlueprintSystemPrompt,
  buildBlueprintUserPrompt,
  validateBlueprint,
  BLUEPRINT_RESPONSE_SCHEMA,
  type BlueprintInput,
  type RoomArchetype,
} from "@/lib/roomFactory/blueprintPrompt";

let _openai: OpenAI | null = null;
function getClient(): OpenAI {
  if (!_openai) _openai = new OpenAI();
  return _openai;
}

const VALID_ARCHETYPES = new Set<RoomArchetype>([
  "coder",
  "writer",
  "founder",
  "gentle",
  "custom",
]);

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (isAdminError(auth)) return auth;

  let body: BlueprintInput;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Validate required fields
  if (
    !body.name?.trim() ||
    !body.description?.trim() ||
    !body.topic?.trim() ||
    !body.audience?.trim()
  ) {
    return NextResponse.json(
      { error: "Missing required fields: name, description, topic, audience" },
      { status: 400 }
    );
  }

  const archetype = (body.archetype ?? "custom") as RoomArchetype;
  if (!VALID_ARCHETYPES.has(archetype)) {
    return NextResponse.json(
      { error: `Invalid archetype. Must be one of: ${[...VALID_ARCHETYPES].join(", ")}` },
      { status: 400 }
    );
  }

  try {
    // Generate blueprint via AI
    const systemPrompt = buildBlueprintSystemPrompt(archetype);
    const userPrompt = buildBlueprintUserPrompt({
      ...body,
      archetype,
    });

    const response = await getClient().chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 4096,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: BLUEPRINT_RESPONSE_SCHEMA,
      },
    });

    const text = response.choices[0]?.message?.content;
    if (!text) {
      return NextResponse.json(
        { error: "Empty response from AI" },
        { status: 502 }
      );
    }

    const blueprint = JSON.parse(text);

    if (!validateBlueprint(blueprint)) {
      console.error("[room-factory] Invalid blueprint shape:", blueprint);
      return NextResponse.json(
        { error: "AI generated an invalid blueprint" },
        { status: 502 }
      );
    }

    // Store in database
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("fp_room_blueprints")
      .insert({
        archetype,
        room_name: body.name.trim(),
        room_description: body.description.trim(),
        topic: body.topic.trim(),
        audience: body.audience.trim(),
        partner_info: body.partnerInfo ?? null,
        world_config: blueprint.world_config,
        host_config: blueprint.host_config,
        synthetic_config: blueprint.synthetic_config,
        break_profile: blueprint.break_profile,
        visual_profile: blueprint.visual_profile,
        discovery_config: blueprint.discovery_config,
        status: "draft",
        generation_model: "gpt-4o-mini",
        generation_raw_response: blueprint,
        created_by: auth.userId,
      })
      .select("id")
      .single();

    if (error) {
      console.error("[room-factory] DB insert failed:", error);
      return NextResponse.json(
        { error: "Failed to store blueprint" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      blueprintId: data.id,
      blueprint,
    });
  } catch (err) {
    console.error("[room-factory] Blueprint generation failed:", err);
    return NextResponse.json(
      { error: "Blueprint generation failed" },
      { status: 500 }
    );
  }
}
