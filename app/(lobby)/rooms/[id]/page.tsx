import { PartyLobby } from "@/components/party/PartyLobby";

export default async function RoomLobbyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 sm:py-10">
      <PartyLobby partyId={id} />
    </main>
  );
}
