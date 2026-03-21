import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { CHARACTERS } from "@/lib/constants";
import { getPartyLaunchDisplayName } from "@/lib/launchRooms";
import type { CharacterId } from "@/lib/types";
import { JoinCard } from "./JoinCard";

interface PageProps {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ from?: string }>;
}

export async function generateMetadata({
  params,
  searchParams,
}: PageProps): Promise<Metadata> {
  const { code } = await params;
  const { from } = await searchParams;
  const supabase = await createClient();

  const { data: party } = await supabase
    .from("fp_parties")
    .select("name, character, world_key, launch_room_key, launch_visible, runtime_profile_key, persistent, blueprint_id")
    .eq("invite_code", code)
    .single();

  if (!party) {
    return { title: "Party not found — SkillGap" };
  }

  let inviterName: string | null = null;
  if (from) {
    const { data: profile } = await supabase
      .from("fp_profiles")
      .select("display_name, first_name")
      .eq("id", from)
      .single();
    inviterName = profile?.display_name ?? profile?.first_name ?? null;
  }

  const character = CHARACTERS[party.character as CharacterId];
  const roomName = getPartyLaunchDisplayName(party);
  const title = inviterName
    ? `${inviterName} invited you to "${roomName}"`
    : `Join "${roomName}" on SkillGap`;
  const description = `${roomName} — a focus sprint with ${character.name}. Join now on SkillGap.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function InvitePage({ params, searchParams }: PageProps) {
  const { code } = await params;
  const { from } = await searchParams;
  const supabase = await createClient();

  // Fetch party by invite code
  const { data: party } = await supabase
    .from("fp_parties")
    .select("*")
    .eq("invite_code", code)
    .single();

  // Fetch inviter profile if ?from= param is present
  let inviterName: string | null = null;
  if (from) {
    const { data: profile } = await supabase
      .from("fp_profiles")
      .select("display_name, first_name")
      .eq("id", from)
      .single();
    inviterName = profile?.display_name ?? profile?.first_name ?? null;
  }

  // Fetch participant count
  let participantCount = 0;
  if (party) {
    const { count } = await supabase
      .from("fp_party_participants")
      .select("*", { count: "exact", head: true })
      .eq("party_id", party.id)
      .is("left_at", null);
    participantCount = count ?? 0;
  }

  return (
    <JoinCard
      party={party}
      inviterName={inviterName}
      participantCount={participantCount}
      inviteCode={code}
    />
  );
}
