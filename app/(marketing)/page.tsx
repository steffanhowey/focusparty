import Link from "next/link";
import { Logo } from "@/components/shell/Logo";

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col" style={{ background: "var(--sg-white)", color: "var(--sg-shell-900)" }}>
      {/* Nav */}
      <header className="fixed top-0 left-0 right-0 z-[var(--z-topbar)] backdrop-blur-md" style={{ background: "var(--sg-white)" }}>
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo href="/" height={32} maxWidth={140} />
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-full px-5 py-2.5 text-sm font-medium text-[var(--sg-shell-600)] transition-colors hover:bg-[var(--sg-shell-100)] hover:text-[var(--sg-shell-900)]"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="rounded-full bg-[var(--sg-forest-500)] px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-85"
            >
              Get Focused
            </Link>
          </div>
        </nav>
      </header>

      {/* Hero */}
      <main className="flex flex-1 items-center justify-center px-4 sm:px-6">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="text-4xl font-bold tracking-tight text-[var(--sg-shell-900)] sm:text-5xl md:text-6xl">
            Your AI co-working partner.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-[var(--sg-shell-600)] sm:text-xl">
            Focus sessions with a partner that&apos;s always there. Set goals,
            run sprints, and keep your streak — no more no-shows.
          </p>
          <div className="mt-10">
            <Link
              href="/signup"
              className="inline-flex h-14 items-center justify-center rounded-full bg-[var(--sg-forest-500)] px-8 font-semibold text-white transition-opacity hover:opacity-85 active:opacity-75"
            >
              Get Focused
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
