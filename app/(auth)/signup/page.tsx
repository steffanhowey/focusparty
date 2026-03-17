"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/shell/Logo";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/components/providers/AuthProvider";

function friendlyError(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes("rate limit") || lower.includes("too many"))
    return "Already sent — check your inbox.";
  if (lower.includes("invalid") && lower.includes("email"))
    return "That email doesn't look right.";
  if (lower.includes("not allowed") || lower.includes("not authorized"))
    return "Sign-up unavailable. Try again shortly.";
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

function SignUpForm() {
  const { signUp, authState } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (authState === "authenticated") {
    const next = searchParams.get("next") ?? "/practice";
    router.replace(next);
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim() || !email.trim() || loading)
      return;

    setLoading(true);
    setError(null);

    try {
      const result = await signUp(email.trim(), {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
      });
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
      <h1 className="text-2xl font-semibold text-[var(--sg-shell-900)]">Create your account</h1>
      <p className="mt-2 text-[var(--sg-shell-600)]">
        We&apos;ll send you a magic link.
      </p>

      <div className="mt-8 rounded-lg border border-[var(--sg-shell-border)] bg-[var(--sg-shell-100)] p-6">
        {sent ? (
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--sg-shell-200)]">
              <span className="text-xl" aria-hidden>✉️</span>
            </div>
            <p className="text-sm font-medium text-[var(--sg-shell-900)]">
              Check your inbox
            </p>
            <p className="mt-2 text-xs text-[var(--sg-shell-500)]">
              Magic link sent to <strong className="text-[var(--sg-shell-600)]">{email}</strong>
            </p>
            <Button
              variant="link"
              size="sm"
              onClick={() => {
                setSent(false);
                setEmail("");
              }}
              className="mt-5"
            >
              Use a different email
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="mb-1.5 block text-xs font-medium text-[var(--sg-shell-600)]">
                  First name
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Jane"
                  required
                  className="h-11 w-full rounded-full border border-[var(--sg-shell-border)] bg-[var(--sg-shell-100)] px-5 text-sm text-[var(--sg-shell-900)] outline-none placeholder:text-[var(--sg-shell-500)] focus:border-[var(--sg-forest-500)]"
                />
              </div>
              <div className="flex-1">
                <label className="mb-1.5 block text-xs font-medium text-[var(--sg-shell-600)]">
                  Last name
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Doe"
                  required
                  className="h-11 w-full rounded-full border border-[var(--sg-shell-border)] bg-[var(--sg-shell-100)] px-5 text-sm text-[var(--sg-shell-900)] outline-none placeholder:text-[var(--sg-shell-500)] focus:border-[var(--sg-forest-500)]"
                />
              </div>
            </div>
            <label className="mt-4 mb-1.5 block text-xs font-medium text-[var(--sg-shell-600)]">
              Email address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="h-11 w-full rounded-full border border-[var(--sg-shell-border)] bg-[var(--sg-shell-100)] px-5 text-sm text-[var(--sg-shell-900)] outline-none placeholder:text-[var(--sg-shell-500)] focus:border-[var(--sg-forest-500)]"
            />
            {error && <p className="mt-2 text-xs text-[var(--sg-coral-500)]">{error}</p>}
            <Button
              variant="primary"
              fullWidth
              loading={loading}
              type="submit"
              disabled={!firstName.trim() || !lastName.trim() || !email.trim()}
              className="mt-4"
            >
              Get Focused
            </Button>
          </form>
        )}
      </div>

      <p className="mt-6 text-center text-sm text-[var(--sg-shell-500)]">
        Already have an account?{" "}
        <Link
          href="/login"
          className="text-[var(--sg-shell-600)] transition-colors hover:text-[var(--sg-shell-900)]"
        >
          Log in
        </Link>
      </p>
    </>
  );
}

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen flex-col" style={{ background: "var(--sg-white)", color: "var(--sg-shell-900)" }}>
      <header className="backdrop-blur-md" style={{ background: "var(--sg-white)" }}>
        <nav className="mx-auto flex h-16 max-w-6xl items-center px-4 sm:px-6">
          <Logo href="/" height={32} maxWidth={140} />
        </nav>
      </header>

      <main className="mx-auto w-full max-w-md px-4 py-16 sm:py-24">
        <Suspense>
          <SignUpForm />
        </Suspense>
      </main>
    </div>
  );
}
