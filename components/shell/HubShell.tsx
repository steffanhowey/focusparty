"use client";

import { usePathname } from "next/navigation";
import { ReactNode, useState, useEffect, useCallback, lazy, Suspense } from "react";
import { PartyPopper, Plus, Menu } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { useTheme } from "@/components/providers/ThemeProvider";
import { CHARACTERS } from "@/lib/constants";
import { CLIENT_NAV_HREFS } from "./navItems";

const SIDEBAR_COLLAPSED_KEY = "focusparty-sidebar-collapsed";

const PAGE_TITLES: Record<string, string> = {
  "/party": "Parties",
  "/tasks": "Tasks",
  "/progress": "Progress",
  "/settings": "Settings",
};

function getTitleForPath(pathname: string): string {
  return PAGE_TITLES[pathname] ?? "Parties";
}

const LazyPartyList = lazy(() =>
  import("@/components/party/PartyList").then((m) => ({ default: m.PartyList }))
);

const LazyTaskBoard = lazy(() =>
  import("@/components/tasks/TaskBoard").then((m) => ({ default: m.TaskBoard }))
);

const LazyProgressDashboard = lazy(() =>
  import("@/components/progress/ProgressDashboard").then((m) => ({ default: m.ProgressDashboard }))
);

function renderTabContent(tab: string): ReactNode {
  switch (tab) {
    case "/party":
      return (
        <main className="flex-1">
          <Suspense fallback={null}>
            <LazyPartyList />
          </Suspense>
        </main>
      );
    case "/tasks":
      return (
        <main className="flex-1">
          <Suspense fallback={null}>
            <LazyTaskBoard />
          </Suspense>
        </main>
      );
    case "/progress":
      return (
        <main className="flex-1">
          <Suspense fallback={null}>
            <LazyProgressDashboard />
          </Suspense>
        </main>
      );
    case "/settings":
      return <main className="flex-1">{/* Content — title is in shell header */}</main>;
    default:
      return null;
  }
}

export function HubShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { characterAccent } = useTheme();
  const c = CHARACTERS[characterAccent];

  const [collapsed, setCollapsed] = useState(false);
  const [clientTab, setClientTab] = useState<string | null>(null);

  // Single source of truth: clientTab (after first nav click) or pathname (initial server render)
  const effectivePath = clientTab ?? pathname;
  const title = getTitleForPath(effectivePath);

  useEffect(() => {
    const COLLAPSE_BP = 1024;
    let wasWide = window.innerWidth >= COLLAPSE_BP;

    const apply = () => {
      const isWide = window.innerWidth >= COLLAPSE_BP;
      if (!isWide) {
        setCollapsed(true);
      } else if (isWide !== wasWide) {
        // Only restore preference when crossing back above breakpoint
        try {
          const stored = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
          setCollapsed(stored === "true");
        } catch { /* ignore */ }
      }
      wasWide = isWide;
    };

    // Initial check
    if (!wasWide) {
      setCollapsed(true);
    } else {
      try {
        const stored = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
        setCollapsed(stored === "true");
      } catch { /* ignore */ }
    }

    window.addEventListener("resize", apply);
    return () => window.removeEventListener("resize", apply);
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

  const handleNavClick = useCallback((href: string) => {
    if (!CLIENT_NAV_HREFS.has(href)) return;
    window.history.pushState(null, "", href);
    setClientTab(href);
  }, []);

  const handleMobileNavClick = useCallback((href: string) => {
    handleNavClick(href);
    setCollapsed(true);
  }, [handleNavClick]);

  // Clear stale clientTab when Next.js navigates to a non-client-tab route
  // (e.g., <Link> from /party grid to /party/[id])
  useEffect(() => {
    if (clientTab !== null && !CLIENT_NAV_HREFS.has(pathname)) {
      setClientTab(null);
    }
  }, [pathname, clientTab]);

  // Sync with browser back/forward
  useEffect(() => {
    const onPopState = () => {
      const p = window.location.pathname;
      if (CLIENT_NAV_HREFS.has(p)) {
        setClientTab(p);
      } else {
        setClientTab(null);
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const showHamburger = collapsed; // desktop: only when collapsed. Mobile: always (handled by CSS).
  const showMobileOverlay = !collapsed;

  return (
    <div className="flex h-screen overflow-hidden safe-bottom">
      {/* Desktop sidebar: hidden below md */}
      <div className="hidden md:flex md:flex-shrink-0">
        <Sidebar collapsed={collapsed} onToggleCollapsed={toggleCollapsed} onNavClick={handleNavClick} />
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
            <Sidebar collapsed={false} onToggleCollapsed={toggleCollapsed} onNavClick={handleMobileNavClick} />
          </div>
        </div>
      )}
      <div
        className={`min-w-0 flex-1 overflow-hidden ${collapsed ? "pl-0 pt-2 pr-2 pb-2 md:pt-4 md:pr-4 md:pb-4 md:pl-0" : "p-2 md:p-4"}`}
        style={{ background: "var(--color-bg-primary)" }}
      >
        <div
          className="flex h-full flex-col overflow-clip border border-[var(--color-border-default)] rounded-xl md:rounded-[var(--radius-xl)]"
          style={{
            background: "var(--color-bg-elevated)",
          }}
        >
          <div className="flex h-16 shrink-0 items-center justify-between gap-4 px-4 md:px-5 lg:px-6">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <button
                type="button"
                onClick={toggleCollapsed}
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-bg-active)] hover:text-[var(--color-text-primary)] ${showHamburger ? "flex md:flex" : "flex md:hidden"}`}
                aria-label="Open menu"
              >
                <Menu size={20} strokeWidth={1.8} />
              </button>
              <span className="truncate text-lg font-semibold text-[var(--color-text-primary)]">
                {title}
              </span>
            </div>
            {effectivePath === "/party" ? (
              <div id="hub-header-action" />
            ) : effectivePath === "/tasks" ? (
              <button
                type="button"
                onClick={() => document.dispatchEvent(new CustomEvent("fp:create-task"))}
                className="flex h-10 shrink-0 items-center justify-center gap-2 rounded-full px-4 sm:px-5"
                style={{
                  background: "var(--color-accent-primary)",
                  color: "white",
                }}
                aria-label="New task"
              >
                <Plus size={18} strokeWidth={1.8} className="shrink-0" />
                <span className="hidden text-sm font-semibold sm:inline">New Task</span>
              </button>
            ) : (
              <a
                href="/party"
                onClick={(e) => {
                  e.preventDefault();
                  handleNavClick("/party");
                }}
                className="flex h-10 shrink-0 items-center justify-center gap-2 rounded-full px-4 sm:px-5"
                style={{
                  background: "var(--color-accent-primary)",
                  color: "white",
                }}
                aria-label="Join party"
              >
                <PartyPopper size={18} strokeWidth={1.8} className="shrink-0" />
                <span className="hidden text-sm font-semibold sm:inline">Join Party</span>
              </a>
            )}
          </div>
          <div className="fp-shell-scroll min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-4 pt-4 pb-5 md:px-6 md:pt-5 md:pb-6">
            {clientTab !== null ? renderTabContent(effectivePath) : children}
          </div>
        </div>
      </div>
    </div>
  );
}
