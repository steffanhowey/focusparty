import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/admin";

const USERNAME_REGEX = /^[a-z][a-z0-9_]{2,19}$/;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get("username")?.toLowerCase().trim();

    if (!username) {
      return NextResponse.json(
        { available: false, reason: "Username is required" },
        { status: 400 }
      );
    }

    // Server-side format validation
    if (!USERNAME_REGEX.test(username)) {
      return NextResponse.json({
        available: false,
        reason: "Must be 3-20 characters, start with a letter, and contain only letters, numbers, or underscores",
      });
    }

    const supabase = createClient();

    // Check reserved usernames
    const { data: reserved } = await supabase
      .from("fp_reserved_usernames")
      .select("username")
      .eq("username", username)
      .maybeSingle();

    if (reserved) {
      return NextResponse.json({
        available: false,
        reason: "This username is reserved",
      });
    }

    // Check existing profiles (case-insensitive via the DB index)
    const { data: existing } = await supabase
      .from("fp_profiles")
      .select("id")
      .ilike("username", username)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({
        available: false,
        reason: "Username is already taken",
      });
    }

    return NextResponse.json({ available: true });
  } catch (err) {
    console.error("[username/check] Error:", err);
    return NextResponse.json(
      { available: false, reason: "Internal server error" },
      { status: 500 }
    );
  }
}
