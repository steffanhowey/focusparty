import Link from "next/link";
import { Logo } from "@/components/shell/Logo";

export default async function JoinPartyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
      <header className="border-b border-[var(--color-border-subtle)]">
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo href="/" height={32} maxWidth={140} />
          <Link
            href="/party"
            className="text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            Open app
          </Link>
        </nav>
      </header>

      <main className="mx-auto max-w-md px-4 py-16 sm:py-24">
        <h1 className="text-2xl font-semibold">Join party</h1>
        <p className="mt-2 text-[var(--color-text-secondary)]">
          You’re joining: <span className="font-medium text-[var(--color-text-primary)]">{id}</span>
        </p>
        <p className="mt-4 text-sm text-[var(--color-text-tertiary)]">
          Party join flow coming soon. You can open the app in the meantime.
        </p>
        <div className="mt-6 flex gap-3">
          <Link
            href="/party"
            className="inline-flex h-12 flex-1 items-center justify-center rounded-full bg-[var(--color-accent-primary)] font-medium text-white transition-all hover:bg-[var(--color-purple-800)] hover:shadow-[var(--shadow-glow-purple)]"
          >
            Go to app
          </Link>
          <Link
            href="/"
            className="inline-flex h-12 items-center justify-center rounded-full border border-[var(--color-border-default)] px-6 font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-hover)]"
          >
            Back to home
          </Link>
        </div>
      </main>
    </div>
  );
}
