import Link from "next/link";
import { Logo } from "@/components/shell/Logo";

export default function OnboardPage() {
  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
      <header className="border-b border-[var(--color-border-subtle)]">
        <nav className="mx-auto flex h-16 max-w-6xl items-center px-4 sm:px-6">
          <Logo href="/" height={32} maxWidth={140} />
        </nav>
      </header>

      <main className="mx-auto max-w-md px-4 py-16 sm:py-24">
        <h1 className="text-2xl font-semibold">Welcome to FocusParty</h1>
        <p className="mt-2 text-[var(--color-text-secondary)]">
          Set up your profile and preferences.
        </p>

        <div className="mt-8 rounded-[var(--radius-lg)] border border-[var(--color-border-default)] bg-[var(--color-bg-elevated)] p-6">
          <p className="text-sm text-[var(--color-text-tertiary)]">
            Onboarding flow coming soon. Go to the dashboard to start.
          </p>
          <Link
            href="/party"
            className="mt-4 inline-flex h-12 w-full items-center justify-center rounded-full bg-[var(--color-accent-primary)] font-medium text-white transition-all hover:bg-[var(--color-purple-800)] hover:shadow-[var(--shadow-glow-purple)]"
          >
            Go to dashboard
          </Link>
        </div>

        <p className="mt-6 text-center text-sm text-[var(--color-text-tertiary)]">
          <Link href="/" className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors">
            ← Back to home
          </Link>
        </p>
      </main>
    </div>
  );
}
