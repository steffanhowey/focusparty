export default function LobbyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen w-full" style={{ background: "var(--sg-white)" }}>
      {children}
    </div>
  );
}
