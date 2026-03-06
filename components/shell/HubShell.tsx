"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useState, useEffect, useCallback } from "react";
import { PartyPopper, Menu } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { useTheme } from "@/components/providers/ThemeProvider";
import { CHARACTERS } from "@/lib/constants";

const SIDEBAR_COLLAPSED_KEY = "focusparty-sidebar-collapsed";

const PAGE_TITLES: Record<string, string> = {
  "/party": "Parties",
  "/progress": "Progress",
  "/settings": "Settings",
};

function getTitleForPath(pathname: string): string {
  return PAGE_TITLES[pathname] ?? "Parties";
}

export function HubShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { characterAccent } = useTheme();
  const c = CHARACTERS[characterAccent];

  const [collapsed, setCollapsed] = useState(false);
  const title = getTitleForPath(pathname);

  useEffect(() => {
    try {
      const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
      if (isMobile) {
        setCollapsed(true);
        return;
      }
      const stored = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
      if (stored !== null) setCollapsed(stored === "true");
    } catch {
      // ignore
    }
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const showHamburger = collapsed; // desktop: only when collapsed. Mobile: always (handled by CSS).
  const showMobileOverlay = !collapsed;

  return (
    <div className="flex h-screen overflow-hidden safe-bottom">
      {/* Desktop sidebar: hidden below md */}
      <div className="hidden md:flex md:flex-shrink-0">
        <Sidebar collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />
      </div>
      {/* Mobile overlay: drawer when hamburger opens (collapsed=false) */}
      {showMobileOverlay && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={toggleCollapsed}
            aria-label="Close menu"
          />
          <div className="relative h-full w-60 flex-shrink-0 shadow-xl">
            <Sidebar collapsed={false} onToggleCollapsed={toggleCollapsed} />
          </div>
        </div>
      )}
      <div
        className={`min-w-0 flex-1 overflow-hidden ${collapsed ? "pl-0 pt-2 pr-2 pb-2 md:pt-4 md:pr-4 md:pb-4 md:pl-0" : "p-2 md:p-4"}`}
        style={{ background: "var(--color-bg-primary)" }}
      >
        <div
          className="flex h-full flex-col border border-[var(--color-border-default)] rounded-xl overflow-clip md:rounded-[var(--radius-xl)]"
          style={{
            background: "var(--color-bg-elevated)",
          }}
        >
          <div className="flex h-16 shrink-0 items-center justify-between gap-4 px-4 md:px-5 lg:px-6">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <button
                type="button"
                onClick={toggleCollapsed}
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-bg-active)] hover:text-white ${showHamburger ? "flex md:flex" : "flex md:hidden"}`}
                aria-label="Open menu"
              >
                <Menu size={20} strokeWidth={1.8} />
              </button>
              <span className="truncate text-lg font-semibold text-[var(--color-text-primary)]">
                {title}
              </span>
            </div>
            <Link
              href="/party"
              className="flex h-10 shrink-0 items-center justify-center gap-2 rounded-full px-4 sm:px-5"
              style={{
                background: "var(--color-accent-primary)",
                color: "white",
              }}
              aria-label="Join party"
            >
              <PartyPopper size={18} strokeWidth={1.8} className="shrink-0" />
              <span className="hidden text-sm font-semibold sm:inline">Join Party</span>
            </Link>
          </div>
          <div className="min-h-0 flex-1 overflow-auto px-4 pb-5 md:px-6 md:pb-6">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
