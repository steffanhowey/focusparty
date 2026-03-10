import { NextResponse } from "next/server";
import OpenAI from "openai";
import sharp from "sharp";
import { createClient } from "@/lib/supabase/admin";
import { getRoomVisualProfile } from "@/lib/roomVisualProfiles";
import {
  compileBackgroundPrompt,
  type PromptOptions,
} from "@/lib/backgroundPromptCompiler";
import type { WorldKey } from "@/lib/worlds";
import { TIME_OF_DAY_STATES, type TimeOfDayState } from "@/lib/timeOfDay";

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) _openai = new OpenAI();
  return _openai;
}

const VALID_WORLD_KEYS: Set<string> = new Set([
  "default",
  "vibe-coding",
  "writer-room",
  "yc-build",
  "gentle-start",
]);

/**
 * POST /api/backgrounds/generate
 *
 * Admin endpoint to generate AI background candidates for a room world.
 * Protected by ADMIN_SECRET. Generates sequentially to respect rate limits.
 *
 * Body: {
 *   worldKey: string,
 *   count?: number,          // 1-5, default 3
 *   variationSeed?: string,
 *   timeOfDay?: "morning" | "afternoon" | "evening" | "late_night"
 * }
 *
 * Returns: { jobId, results: [{ assetId, url, success, error? }] }
 */
export async function POST(request: Request) {
  // Auth check
  const authHeader = request.headers.get("authorization");
  const secret = process.env.ADMIN_SECRET;

  if (!secret) {
    return NextResponse.json(
      { error: "ADMIN_SECRET env var not configured" },
      { status: 500 }
    );
  }

  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Parse body
  let body: {
    worldKey?: string;
    count?: number;
    variationSeed?: string;
    timeOfDay?: PromptOptions["timeOfDay"];
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { worldKey, count = 3, variationSeed, timeOfDay } = body;

  if (!worldKey || !VALID_WORLD_KEYS.has(worldKey)) {
    return NextResponse.json(
      { error: `Invalid worldKey. Must be one of: ${[...VALID_WORLD_KEYS].join(", ")}` },
      { status: 400 }
    );
  }

  // Validate and resolve time-of-day state
  const validTimeStates = new Set<string>(TIME_OF_DAY_STATES);
  const timeOfDayState: TimeOfDayState =
    timeOfDay && validTimeStates.has(timeOfDay)
      ? (timeOfDay as TimeOfDayState)
      : "afternoon";

  const candidateCount = Math.min(Math.max(1, count), 5);

  // Compile prompt
  const profile = getRoomVisualProfile(worldKey);
  const compiled = compileBackgroundPrompt(profile, {
    variationSeed,
    timeOfDay: timeOfDayState,
  });

  const openai = getOpenAI();
  const supabase = createClient();

  // Create generation job
  const { data: job, error: jobError } = await supabase
    .from("fp_room_background_jobs")
    .insert({
      world_key: worldKey,
      prompt_text: compiled.text,
      prompt_hash: compiled.hash,
      status: "generating",
    })
    .select("id")
    .single();

  if (jobError || !job) {
    console.error("[bg-generate] Failed to create job:", jobError);
    return NextResponse.json(
      { error: "Failed to create generation job" },
      { status: 500 }
    );
  }

  const jobId = job.id;
  const results: {
    assetId: string;
    url: string;
    success: boolean;
    error?: string;
  }[] = [];

  // Generate candidates sequentially
  for (let i = 0; i < candidateCount; i++) {
    try {
      // Add per-candidate variation via index
      const candidatePrompt =
        candidateCount > 1
          ? `${compiled.text}\n\nCandidate variation ${i + 1} of ${candidateCount}. Make this distinctly different from other candidates while maintaining all required visual elements.`
          : compiled.text;

      const response = await openai.images.generate({
        model: "gpt-image-1",
        prompt: candidatePrompt,
        n: 1,
        size: "1536x1024",
        quality: "medium",
      });

      const imageData = response.data?.[0];

      if (!imageData?.b64_json) {
        console.error(`[bg-generate] No image data for candidate ${i}`);
        results.push({
          assetId: "",
          url: "",
          success: false,
          error: "No image data returned",
        });
        continue;
      }

      // Convert to buffer and process with sharp
      const rawBuffer = Buffer.from(imageData.b64_json, "base64");

      // Resize to 1920x1080 and convert to WebP
      const mainBuffer = await sharp(rawBuffer)
        .resize(1920, 1080, { fit: "cover" })
        .webp({ quality: 85 })
        .toBuffer();

      // Generate 600x338 thumbnail
      const thumbBuffer = await sharp(rawBuffer)
        .resize(600, 338, { fit: "cover" })
        .webp({ quality: 75 })
        .toBuffer();

      // Upload main image (organized by time state)
      const mainPath = `${worldKey}/${timeOfDayState}/${jobId}/candidate-${i}.webp`;
      const { error: mainUploadErr } = await supabase.storage
        .from("room-backgrounds")
        .upload(mainPath, mainBuffer, {
          contentType: "image/webp",
          upsert: true,
        });

      if (mainUploadErr) {
        console.error(`[bg-generate] Upload failed for candidate ${i}:`, mainUploadErr);
        results.push({
          assetId: "",
          url: "",
          success: false,
          error: mainUploadErr.message,
        });
        continue;
      }

      // Upload thumbnail
      const thumbPath = `${worldKey}/${timeOfDayState}/${jobId}/candidate-${i}-thumb.webp`;
      await supabase.storage
        .from("room-backgrounds")
        .upload(thumbPath, thumbBuffer, {
          contentType: "image/webp",
          upsert: true,
        })
        .catch((err: unknown) => {
          console.error(`[bg-generate] Thumb upload failed for candidate ${i}:`, err);
        });

      // Get public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from("room-backgrounds").getPublicUrl(mainPath);

      // Insert asset record
      const { data: asset, error: assetError } = await supabase
        .from("fp_room_background_assets")
        .insert({
          world_key: worldKey,
          job_id: jobId,
          storage_path: mainPath,
          public_url: publicUrl,
          status: "candidate",
          time_of_day_state: timeOfDayState,
          width: 1920,
          height: 1080,
          file_size_bytes: mainBuffer.length,
          prompt_text: compiled.text,
        })
        .select("id")
        .single();

      if (assetError || !asset) {
        console.error(`[bg-generate] Asset insert failed for candidate ${i}:`, assetError);
        results.push({
          assetId: "",
          url: publicUrl,
          success: false,
          error: "Asset record insert failed",
        });
        continue;
      }

      results.push({ assetId: asset.id, url: publicUrl, success: true });
      console.log(`[bg-generate] ✓ ${worldKey}/${timeOfDayState} candidate ${i} → ${publicUrl}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error(`[bg-generate] Error for candidate ${i}:`, message);
      results.push({ assetId: "", url: "", success: false, error: message });
    }
  }

  // Update job status
  const successCount = results.filter((r) => r.success).length;
  await supabase
    .from("fp_room_background_jobs")
    .update({
      status: successCount > 0 ? "completed" : "failed",
      candidates_count: successCount,
      completed_at: new Date().toISOString(),
      ...(successCount === 0
        ? { error_message: "All candidates failed to generate" }
        : {}),
    })
    .eq("id", jobId);

  console.log(
    `[bg-generate] Job ${jobId} done: ${successCount}/${candidateCount} succeeded`
  );

  return NextResponse.json({
    jobId,
    results,
    successCount,
    totalCount: candidateCount,
  });
}
