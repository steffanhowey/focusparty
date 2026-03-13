import { ImageResponse } from "next/og";
import { createClient } from "@/lib/supabase/server";
import { CHARACTERS } from "@/lib/constants";
import type { CharacterId } from "@/lib/types";

export const alt = "SkillGap Invite";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const supabase = await createClient();

  const { data: party } = await supabase
    .from("fp_parties")
    .select("name, character, creator_id")
    .eq("invite_code", code)
    .single();

  if (!party) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            background: "linear-gradient(135deg, #111111 0%, #0a0a0a 50%, #141414 100%)",
            fontFamily: "sans-serif",
          }}
        >
          <div style={{ fontSize: 32, color: "#888888" }}>SkillGap</div>
          <div style={{ fontSize: 48, color: "#ffffff", marginTop: 20, fontWeight: 700 }}>
            Party not found
          </div>
        </div>
      ),
      { ...size }
    );
  }

  const character = CHARACTERS[party.character as CharacterId];

  // Fetch creator name for the OG image
  let creatorName: string | null = null;
  const { data: creator } = await supabase
    .from("fp_profiles")
    .select("display_name, first_name")
    .eq("id", party.creator_id)
    .single();
  creatorName = creator?.display_name ?? creator?.first_name ?? null;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          background: `linear-gradient(135deg, ${character.primary}18 0%, #0a0a0a 50%, #141414 100%)`,
          fontFamily: "sans-serif",
          padding: 60,
        }}
      >
        {/* Brand */}
        <div style={{ fontSize: 24, color: "#888888", marginBottom: 40, letterSpacing: 1 }}>
          SkillGap
        </div>

        {/* Party name */}
        <div
          style={{
            fontSize: 56,
            fontWeight: 700,
            color: "#ffffff",
            textAlign: "center",
            maxWidth: "80%",
            lineHeight: 1.2,
          }}
        >
          {party.name}
        </div>

        {/* Character tag */}
        <div
          style={{
            fontSize: 26,
            color: character.primary,
            marginTop: 24,
          }}
        >
          with {character.name} — {character.tagline}
        </div>

        {/* Creator attribution */}
        {creatorName && (
          <div style={{ fontSize: 22, color: "#c0c0c0", marginTop: 16 }}>
            Hosted by {creatorName}
          </div>
        )}
      </div>
    ),
    { ...size }
  );
}
