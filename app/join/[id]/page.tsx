export default async function JoinPartyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] p-8 text-white">
      <p>Join Focus Party — {id}</p>
    </div>
  );
}
