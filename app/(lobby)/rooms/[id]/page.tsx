import { redirect } from "next/navigation";
import { PartyLobby } from "@/components/party/PartyLobby";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function RoomLobbyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let shouldOpenEnvironment = false;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("fp_parties")
      .select("status, persistent")
      .eq("id", id)
      .single();

    if (!error && data) {
      shouldOpenEnvironment = Boolean(
        data.persistent || data.status === "active",
      );
    }
  } catch (err) {
    console.error("[RoomLobbyPage] room entry gate failed:", err);
  }

  if (shouldOpenEnvironment) {
    redirect(`/environment/${id}`);
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 sm:py-10">
      <PartyLobby partyId={id} />
    </main>
  );
}
