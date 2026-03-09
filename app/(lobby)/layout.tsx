export default function LobbyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen w-full" style={{ background: "var(--color-bg-primary)" }}>
      {children}
    </div>
  );
}
