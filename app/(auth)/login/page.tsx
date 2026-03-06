"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/shell/Logo";
import { useAuth } from "@/components/providers/AuthProvider";

function LoginForm() {
  const { signIn, authState } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(
    searchParams.get("error") === "auth_failed"
      ? "Authentication failed. Please try again."
      : null
  );
  const [loading, setLoading] = useState(false);

  if (authState === "authenticated") {
    const next = searchParams.get("next") ?? "/party";
    router.replace(next);
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || loading) return;

    setLoading(true);
    setError(null);

    const result = await signIn(email.trim());
    setLoading(false);

    if (result.error) {
      setError(result.error);
    } else {
      setSent(true);
    }
  };

  return (
    <>
      <h1 className="text-2xl font-semibold">Log in</h1>
      <p className="mt-2 text-[var(--color-text-secondary)]">
        Enter your email to receive a magic link.
      </p>

      <div className="mt-8 rounded-[var(--radius-lg)] border border-[var(--color-border-default)] bg-[var(--color-bg-elevated)] p-6">
        {sent ? (
          <div>
            <p className="text-sm text-[var(--color-text-primary)]">
              Check your email for a magic link to sign in.
            </p>
            <p className="mt-2 text-xs text-[var(--color-text-tertiary)]">
              Sent to <strong>{email}</strong>
            </p>
            <button
              type="button"
              onClick={() => {
                setSent(false);
                setEmail("");
              }}
              className="mt-4 text-sm text-[var(--color-accent-primary)] hover:underline"
            >
              Use a different email
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <label className="mb-1.5 block text-xs font-medium text-[var(--color-text-secondary)]">
              Email address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="h-11 w-full rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-white/[0.06] px-4 text-sm text-white outline-none placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-border-focus)]"
            />
            {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={!email.trim() || loading}
              className="mt-4 inline-flex h-12 w-full items-center justify-center rounded-full bg-[var(--color-accent-primary)] font-medium text-white transition-all hover:bg-[var(--color-purple-800)] hover:shadow-[var(--shadow-glow-purple)] disabled:opacity-50"
            >
              {loading ? "Sending..." : "Send magic link"}
            </button>
          </form>
        )}
      </div>

      <p className="mt-6 text-center text-sm text-[var(--color-text-tertiary)]">
        <Link
          href="/"
          className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
        >
          Back to home
        </Link>
      </p>
    </>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
      <header className="border-b border-[var(--color-border-subtle)]">
        <nav className="mx-auto flex h-16 max-w-6xl items-center px-4 sm:px-6">
          <Logo href="/" height={32} maxWidth={140} />
        </nav>
      </header>

      <main className="mx-auto max-w-md px-4 py-16 sm:py-24">
        <Suspense>
          <LoginForm />
        </Suspense>
      </main>
    </div>
  );
}
