import { PartyLobby } from "@/components/party/PartyLobby";

export default async function PartyLobbyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <main className="flex-1">
      <PartyLobby partyId={id} />
    </main>
  );
}
