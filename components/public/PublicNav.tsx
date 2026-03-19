"use client";

/**
 * Shared navigation bar for public intelligence pages.
 * Logo → /, Skills Pulse → /pulse, Skills Index → /index, primary CTA → /missions
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

const NAV_LINKS = [
  { href: "/pulse", label: "Skills Pulse" },
  { href: "/index", label: "Skills Index" },
];

export function PublicNav() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <nav className="flex items-center justify-between px-4 py-3 md:px-8 border-b border-[var(--sg-shell-border)]">
      <div className="flex items-center gap-6">
        {/* Logo */}
        <Link
          href="/"
          className="text-sm font-bold text-[var(--sg-shell-900)]"
        >
          SkillGap.ai
        </Link>

        {/* Links */}
        <div className="flex items-center gap-4">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-xs font-medium transition-colors"
              style={{
                color:
                  pathname === link.href
                    ? "var(--sg-shell-900)"
                    : "var(--sg-shell-500)",
              }}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>

      <Button variant="cta" size="sm" onClick={() => router.push("/missions")}>
        Browse Missions
      </Button>
    </nav>
  );
}
