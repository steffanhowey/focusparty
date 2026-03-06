import Link from "next/link";
import { Logo } from "@/components/shell/Logo";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
      {/* Nav */}
      <header className="fixed top-0 left-0 right-0 z-[var(--z-topbar)] border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-primary)]/80 backdrop-blur-md">
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo href="/" height={32} maxWidth={140} />
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-full px-5 py-2.5 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]"
            >
              Log in
            </Link>
            <Link
              href="/login"
              className="rounded-full bg-[var(--color-accent-primary)] px-5 py-2.5 text-sm font-medium text-white transition-all hover:bg-[var(--color-purple-800)] hover:shadow-[var(--shadow-glow-purple)]"
            >
              Get started
            </Link>
          </div>
        </nav>
      </header>

      {/* Hero */}
      <main className="relative pt-24 pb-20 sm:pt-32 sm:pb-28">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
            Your AI co-working partner.
          </h1>
          <p className="mt-5 text-lg text-[var(--color-text-secondary)] sm:text-xl max-w-2xl mx-auto">
            Focus sessions with a partner that’s always there. Set goals, run sprints, and keep your streak — no more no-shows.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/login"
              className="inline-flex h-14 items-center justify-center rounded-full bg-[var(--color-accent-primary)] px-8 font-semibold text-white transition-all hover:scale-[1.02] hover:shadow-[var(--shadow-glow-purple)] active:scale-[0.98]"
            >
              Start a focus session
            </Link>
            <Link
              href="/join/demo"
              className="inline-flex h-14 items-center justify-center rounded-full border border-[var(--color-border-default)] bg-transparent px-8 font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]"
            >
              Join a party
            </Link>
          </div>
        </div>

        {/* Subtle gradient glow behind hero */}
        <div
          className="pointer-events-none absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 w-[600px] max-w-[90vw] h-64 rounded-full opacity-30 blur-3xl"
          style={{ background: "var(--color-purple-700)" }}
          aria-hidden
        />
      </main>

      {/* Features */}
      <section className="relative border-t border-[var(--color-border-subtle)] bg-[var(--color-bg-secondary)] py-16 sm:py-20">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <h2 className="text-center text-2xl font-semibold sm:text-3xl">
            Built for deep work
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-[var(--color-text-secondary)]">
            Sprint timers, goals, and a companion that keeps you accountable.
          </p>
          <ul className="mt-12 grid gap-8 sm:grid-cols-3">
            <li className="rounded-[var(--radius-lg)] border border-[var(--color-border-default)] bg-[var(--color-bg-elevated)] p-6 transition-shadow hover:shadow-[var(--shadow-md)]">
              <span className="text-2xl" aria-hidden>⏱</span>
              <h3 className="mt-3 font-semibold">Sprint sessions</h3>
              <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                Pomodoro-style sprints (15–75 min) with breaks. One timer, one goal per session.
              </p>
            </li>
            <li className="rounded-[var(--radius-lg)] border border-[var(--color-border-default)] bg-[var(--color-bg-elevated)] p-6 transition-shadow hover:shadow-[var(--shadow-md)]">
              <span className="text-2xl" aria-hidden>🔥</span>
              <h3 className="mt-3 font-semibold">Streaks & progress</h3>
              <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                Build a streak and hit milestones. Freeze days when life gets in the way.
              </p>
            </li>
            <li className="rounded-[var(--radius-lg)] border border-[var(--color-border-default)] bg-[var(--color-bg-elevated)] p-6 transition-shadow hover:shadow-[var(--shadow-md)]">
              <span className="text-2xl" aria-hidden>👋</span>
              <h3 className="mt-3 font-semibold">Party mode</h3>
              <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                Invite others to co-work in a shared room. Same timer, same vibe.
              </p>
            </li>
          </ul>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-2xl px-4 text-center sm:px-6">
          <h2 className="text-2xl font-semibold sm:text-3xl">
            Ready to focus?
          </h2>
          <p className="mt-3 text-[var(--color-text-secondary)]">
            Sign in and start your first session in seconds.
          </p>
          <Link
            href="/login"
            className="mt-6 inline-flex h-12 items-center justify-center rounded-full bg-[var(--color-accent-primary)] px-6 font-medium text-white transition-all hover:bg-[var(--color-purple-800)] hover:shadow-[var(--shadow-glow-purple)]"
          >
            Log in to FocusParty
          </Link>
        </div>
      </section>

      <footer className="border-t border-[var(--color-border-subtle)] py-6">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 flex items-center justify-between text-sm text-[var(--color-text-tertiary)]">
          <span>© FocusParty</span>
          <Link href="/login" className="hover:text-[var(--color-text-secondary)] transition-colors">
            Log in
          </Link>
        </div>
      </footer>
    </div>
  );
}
