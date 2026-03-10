import { NextResponse } from "next/server";
import sharp from "sharp";
import { createClient } from "@/lib/supabase/admin";
import { SYNTHETIC_POOL } from "@/lib/synthetics/pool";

/**
 * POST /api/avatar/generate-synthetic-thumbs
 *
 * One-time admin endpoint to generate 80×80 thumbnails from existing
 * full-size synthetic avatars. Downloads → resizes via sharp → uploads.
 * Protected by ADMIN_SECRET env var.
 *
 * Body (optional): { handles?: string[] }
 *   - If handles provided, only process those specific synthetics.
 *   - If omitted, processes ALL synthetics in the pool.
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
    // No body or invalid JSON — process all
  }

  const targets = handleFilter
    ? SYNTHETIC_POOL.filter((s) => handleFilter!.has(s.handle))
    : SYNTHETIC_POOL;

  const supabase = createClient();
  const results: { handle: string; url: string; success: boolean; error?: string }[] = [];

  for (const synthetic of targets) {
    try {
      // 1. Download the full-size avatar
      const fullSizePath = `synthetic/${synthetic.handle}/avatar.png`;
      const { data: fileData, error: downloadError } = await supabase.storage
        .from("avatars")
        .download(fullSizePath);

      if (downloadError || !fileData) {
        console.error(`[generate-thumbs] Download failed for ${synthetic.handle}:`, downloadError);
        results.push({ handle: synthetic.handle, url: "", success: false, error: downloadError?.message ?? "No file data" });
        continue;
      }

      // 2. Resize to 80×80 with sharp
      const arrayBuffer = await fileData.arrayBuffer();
      const thumbBuffer = await sharp(Buffer.from(arrayBuffer))
        .resize(80, 80, { fit: "cover" })
        .png({ quality: 80, compressionLevel: 9 })
        .toBuffer();

      // 3. Upload thumbnail
      const thumbPath = `synthetic/${synthetic.handle}/thumb.png`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(thumbPath, thumbBuffer, {
          contentType: "image/png",
          upsert: true,
        });

      if (uploadError) {
        console.error(`[generate-thumbs] Upload failed for ${synthetic.handle}:`, uploadError);
        results.push({ handle: synthetic.handle, url: "", success: false, error: uploadError.message });
        continue;
      }

      // 4. Get public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(thumbPath);

      results.push({ handle: synthetic.handle, url: publicUrl, success: true });
      console.log(`[generate-thumbs] ✓ ${synthetic.handle} → ${publicUrl} (${thumbBuffer.length} bytes)`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error(`[generate-thumbs] Error for ${synthetic.handle}:`, message);
      results.push({ handle: synthetic.handle, url: "", success: false, error: message });
    }
  }

  const successCount = results.filter((r) => r.success).length;
  console.log(`[generate-thumbs] Done: ${successCount}/${targets.length} succeeded`);

  return NextResponse.json({ results, successCount, totalCount: targets.length });
}
