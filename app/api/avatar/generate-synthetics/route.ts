import { NextResponse } from "next/server";
import OpenAI from "openai";
import sharp from "sharp";
import { createClient } from "@/lib/supabase/admin";
import { AVATAR_PROMPT } from "@/lib/avatarPrompt";
import { SYNTHETIC_POOL } from "@/lib/synthetics/pool";

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) _openai = new OpenAI();
  return _openai;
}

/**
 * POST /api/avatar/generate-synthetics
 *
 * Admin endpoint to generate AI avatars for synthetic participants.
 * Protected by ADMIN_SECRET env var. Generates sequentially to avoid rate limits.
 *
 * Body (optional): { handles?: string[] }
 *   - If handles provided, only generate for those specific synthetics.
 *   - If omitted, generates for ALL synthetics in the pool.
 *
 * Returns: { results: [{ handle, url, success, error? }] }
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

  // Optional: filter to specific handles
  let handleFilter: Set<string> | null = null;
  try {
    const body = await request.json().catch(() => null);
    if (body?.handles && Array.isArray(body.handles)) {
      handleFilter = new Set(body.handles as string[]);
    }
  } catch {
    // No body or invalid JSON — generate all
  }

  const targets = handleFilter
    ? SYNTHETIC_POOL.filter((s) => handleFilter!.has(s.handle))
    : SYNTHETIC_POOL;

  const openai = getOpenAI();
  const supabase = createClient();
  const results: { handle: string; url: string; success: boolean; error?: string }[] = [];

  for (const synthetic of targets) {
    const seed = `synthetic-${synthetic.handle}`;

    try {
      // Generate avatar
      const response = await openai.images.generate({
        model: "gpt-image-1",
        prompt: AVATAR_PROMPT(seed),
        n: 1,
        size: "1024x1024",
        quality: "low",
      });

      const imageData = response.data?.[0];

      if (!imageData?.b64_json) {
        console.error(`[generate-synthetics] No image data for ${synthetic.handle}`);
        results.push({ handle: synthetic.handle, url: "", success: false, error: "No image data returned" });
        continue;
      }

      // Convert to buffer and upload
      const buffer = Buffer.from(imageData.b64_json, "base64");
      const storagePath = `synthetic/${synthetic.handle}/avatar.png`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(storagePath, buffer, {
          contentType: "image/png",
          upsert: true,
        });

      if (uploadError) {
        console.error(`[generate-synthetics] Upload failed for ${synthetic.handle}:`, uploadError);
        results.push({ handle: synthetic.handle, url: "", success: false, error: uploadError.message });
        continue;
      }

      // Also generate and upload 80×80 thumbnail
      try {
        const thumbBuffer = await sharp(buffer)
          .resize(80, 80, { fit: "cover" })
          .png({ quality: 80, compressionLevel: 9 })
          .toBuffer();
        const thumbPath = `synthetic/${synthetic.handle}/thumb.png`;
        await supabase.storage
          .from("avatars")
          .upload(thumbPath, thumbBuffer, {
            contentType: "image/png",
            upsert: true,
          });
      } catch (thumbErr) {
        console.error(`[generate-synthetics] Thumb failed for ${synthetic.handle}:`, thumbErr);
        // Non-fatal — full-size avatar was still uploaded successfully
      }

      // Get public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(storagePath);

      results.push({ handle: synthetic.handle, url: publicUrl, success: true });
      console.log(`[generate-synthetics] ✓ ${synthetic.handle} → ${publicUrl}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error(`[generate-synthetics] Error for ${synthetic.handle}:`, message);
      results.push({ handle: synthetic.handle, url: "", success: false, error: message });
    }
  }

  const successCount = results.filter((r) => r.success).length;
  console.log(`[generate-synthetics] Done: ${successCount}/${targets.length} succeeded`);

  return NextResponse.json({ results, successCount, totalCount: targets.length });
}
