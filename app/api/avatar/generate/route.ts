import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@/lib/supabase/admin";
import { AVATAR_PROMPT } from "@/lib/avatarPrompt";

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) _openai = new OpenAI();
  return _openai;
}

function randomSalt(length = 6): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, seed: existingSeed, userId } = body as {
      username: string;
      seed?: string;
      userId: string;
    };

    if (!username || !userId) {
      return NextResponse.json(
        { error: "username and userId are required" },
        { status: 400 }
      );
    }

    // Generate or reuse seed
    const salt = randomSalt();
    const seed = existingSeed ?? `${username}-${salt}`;

    const openai = getOpenAI();

    // Generate image with gpt-image-1
    const response = await openai.images.generate({
      model: "gpt-image-1",
      prompt: AVATAR_PROMPT(seed),
      n: 1,
      size: "1024x1024",
      quality: "low",
    });

    const imageData = response.data?.[0];

    if (!imageData?.b64_json) {
      console.error("[avatar/generate] No image data returned");
      return NextResponse.json(
        { error: "Failed to generate avatar", fallback: true },
        { status: 502 }
      );
    }

    // Convert base64 to buffer for upload
    const buffer = Buffer.from(imageData.b64_json, "base64");

    // Upload to Supabase storage
    const supabase = createClient();
    const storagePath = `${userId}/avatar.png`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(storagePath, buffer, {
        contentType: "image/png",
        upsert: true,
      });

    if (uploadError) {
      console.error("[avatar/generate] Upload failed:", uploadError);
      return NextResponse.json(
        { error: "Failed to upload avatar", fallback: true },
        { status: 500 }
      );
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from("avatars").getPublicUrl(storagePath);

    const avatarUrl = `${publicUrl}?t=${Date.now()}`;

    // Update profile with avatar URL and seed
    const { error: updateError } = await supabase
      .from("fp_profiles")
      .update({
        avatar_url: avatarUrl,
        avatar_seed: seed,
        avatar_style_version: 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (updateError) {
      console.error("[avatar/generate] Profile update failed:", updateError);
      // Non-fatal — avatar was uploaded, URL can be set later
    }

    return NextResponse.json({ url: avatarUrl, seed });
  } catch (err) {
    console.error("[avatar/generate] Unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error", fallback: true },
      { status: 500 }
    );
  }
}
