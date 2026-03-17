import Link from "next/link";

/**
 * Brand colors hardcoded to avoid ThemeProvider character accent overrides.
 * Source of truth: brand/skillgap-homepage-v4.html + figma-code-connect.md
 */
const BRAND = {
  forest900: "#0F2318",
  forest500: "#3A7D53",
  forest400: "#4A9E6A",
  forest300: "#6BBF87",
  white: "#FFFFFF",
} as const;

export default function LandingPage() {
  return (
    <div
      className="flex min-h-screen flex-col"
      style={{
        fontFamily: "var(--font-body), 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif",
        color: "var(--sg-shell-700)",
        background: BRAND.white,
      }}
    >
      {/* Nav */}
      <header
        className="fixed top-0 left-0 right-0 z-[1000] flex items-center justify-between px-8"
        style={{
          height: 56,
          background: "rgba(15, 35, 24, 0.85)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
        }}
      >
        <Link
          href="/"
          className="flex items-center gap-1 text-base font-bold no-underline"
          style={{
            fontFamily: "var(--font-body), 'DM Sans', sans-serif",
            color: BRAND.white,
          }}
        >
          SkillGap<span style={{ color: BRAND.forest300 }}>.ai</span>
        </Link>

        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm font-medium no-underline transition-colors"
            style={{
              color: "rgba(255, 255, 255, 0.45)",
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="text-sm font-semibold no-underline transition-colors"
            style={{
              padding: "7px 18px",
              background: BRAND.forest500,
              color: BRAND.white,
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            Get Started
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main
        className="relative flex min-h-screen flex-1 flex-col items-center justify-center overflow-hidden"
        style={{
          backgroundColor: BRAND.forest900,
          backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.03) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
          padding: "80px 32px 60px",
        }}
      >
        {/* Green radial glow */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: "radial-gradient(ellipse at 50% 30%, rgba(58,125,83,0.08) 0%, transparent 60%)",
          }}
        />

        <div className="relative z-10 mx-auto max-w-[1080px] text-center">
          {/* Eyebrow label */}
          <div
            className="mb-6 inline-flex items-center gap-2 uppercase"
            style={{
              fontFamily: "var(--font-body), 'DM Sans', sans-serif",
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: "0.1em",
              color: BRAND.forest300,
            }}
          >
            <span
              className="inline-block rounded-full"
              style={{
                width: 6,
                height: 6,
                background: BRAND.forest400,
                animation: "pulse 2s ease-in-out infinite",
              }}
            />
            AI fluency for professionals
          </div>

          {/* Headline */}
          <h1
            style={{
              fontFamily: "var(--font-display), 'Fraunces', Georgia, serif",
              fontSize: "clamp(36px, 5vw, 56px)",
              fontWeight: 600,
              color: BRAND.white,
              lineHeight: 1.15,
              letterSpacing: "-0.025em",
              marginBottom: 20,
            }}
          >
            Become AI-native in your role.
          </h1>

          {/* Subhead */}
          <p
            className="mx-auto"
            style={{
              fontSize: 16,
              color: "rgba(255, 255, 255, 0.4)",
              lineHeight: 1.6,
              maxWidth: 620,
              marginBottom: 60,
            }}
          >
            Guided pathways, live accountability, and real-world practice for
            professionals learning the tools and skills shaping modern work.
          </p>

          {/* CTAs */}
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center font-semibold no-underline transition-colors"
              style={{
                padding: "16px 32px",
                background: BRAND.forest500,
                color: BRAND.white,
                borderRadius: 10,
                fontSize: 16,
                fontWeight: 600,
              }}
            >
              Build my AI-native path
            </Link>
            <Link
              href="#how-it-works"
              className="inline-flex items-center justify-center font-semibold no-underline transition-colors"
              style={{
                padding: "16px 32px",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                color: "rgba(255, 255, 255, 0.6)",
                borderRadius: 10,
                fontSize: 16,
                fontWeight: 600,
              }}
            >
              See how it works
            </Link>
          </div>
        </div>
      </main>

      {/* Pulse animation keyframes */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
