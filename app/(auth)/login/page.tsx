"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/shell/Logo";
import { useAuth } from "@/components/providers/AuthProvider";

function friendlyError(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes("rate limit") || lower.includes("too many"))
    return "Already sent — check your inbox.";
  if (lower.includes("signups not allowed") || lower.includes("signup"))
    return "No account found. Try signing up.";
  if (lower.includes("invalid") && lower.includes("email"))
    return "That email doesn't look right.";
  if (lower.includes("not allowed") || lower.includes("not authorized"))
    return "Login unavailable. Try again shortly.";
  if (
    lower.includes("network") ||
    lower.includes("fetch") ||
    lower.includes("failed") ||
    lower.includes("timeout") ||
    lower.includes("unavailable")
  )
    return "Can't reach our servers. Check your connection.";
  return "Something went wrong. Try again.";
}

function LoginForm() {
  const { signIn, authState } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(
    searchParams.get("error") === "auth_failed"
      ? "Authentication failed. Try again."
      : null
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (authState === "authenticated") {
      const next = searchParams.get("next") ?? "/party";
      router.replace(next);
    }
  }, [authState, router, searchParams]);

  if (authState === "authenticated") {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || loading) return;

    setLoading(true);
    setError(null);

    try {
      const result = await signIn(email.trim());
      if (result.error) {
        setError(friendlyError(result.error));
      } else {
        setSent(true);
      }
    } catch {
      setError("Can't reach our servers. Check your connection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <h1 className="text-2xl font-semibold text-[var(--color-text-primary)]">Log in</h1>
      <p className="mt-2 text-[var(--color-text-secondary)]">
        We&apos;ll send you a magic link.
      </p>

      <div className="mt-8 rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-bg-hover)] p-6">
        {sent ? (
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-bg-active)]">
              <span className="text-xl" aria-hidden>✉️</span>
            </div>
            <p className="text-sm font-medium text-[var(--color-text-primary)]">
              Check your inbox
            </p>
            <p className="mt-2 text-xs text-[var(--color-text-tertiary)]">
              Magic link sent to <strong className="text-[var(--color-text-secondary)]">{email}</strong>
            </p>
            <button
              type="button"
              onClick={() => {
                setSent(false);
                setEmail("");
              }}
              className="mt-5 text-sm text-[var(--color-accent-primary)] hover:underline"
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
              className="h-11 w-full rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-hover)] px-5 text-sm text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-border-focus)]"
            />
            {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={!email.trim() || loading}
              className="mt-4 inline-flex h-12 w-full items-center justify-center rounded-full bg-[var(--color-accent-primary)] font-medium text-white transition-opacity hover:opacity-85 active:opacity-75 disabled:opacity-50"
            >
              {loading ? "Sending..." : "Send magic link"}
            </button>
          </form>
        )}
      </div>

      <p className="mt-6 text-center text-sm text-[var(--color-text-tertiary)]">
        Don&apos;t have an account?{" "}
        <Link
          href="/signup"
          className="text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]"
        >
          Sign up
        </Link>
      </p>
    </>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col" style={{ background: "var(--color-bg-primary)", color: "var(--color-text-primary)" }}>
      <header className="backdrop-blur-md" style={{ background: "var(--color-bg-primary)" }}>
        <nav className="mx-auto flex h-16 max-w-6xl items-center px-4 sm:px-6">
          <Logo href="/" height={32} maxWidth={140} />
        </nav>
      </header>

      <main className="mx-auto w-full max-w-md px-4 py-16 sm:py-24">
        <Suspense>
          <LoginForm />
        </Suspense>
      </main>
    </div>
  );
}
