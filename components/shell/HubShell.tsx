"use client";

import { usePathname } from "next/navigation";
import { ReactNode, useState, useEffect, useCallback, useRef, lazy, Suspense } from "react";
import { Users, Plus, Menu } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Sidebar } from "./Sidebar";
import { CLIENT_NAV_HREFS } from "./navItems";
import { FunctionMigrationModal } from "@/components/onboarding/FunctionMigrationModal";

const PAGE_TITLES: Record<string, string> = {
  "/practice": "Practice",
  "/learn": "Learn",
  "/skills": "Skills",
  "/goals": "Goals",
  "/stats": "Stats",
  "/settings": "Settings",
};

function getTitleForPath(pathname: string): string {
  return PAGE_TITLES[pathname] ?? "Learn";
}

/* ─── Lazy tab components ─── */

const LazyPartyList = lazy(() =>
  import("@/components/party/PartyList").then((m) => ({ default: m.PartyList }))
);

const LazyGoalBoard = lazy(() =>
  import("@/components/goals/GoalBoard").then((m) => ({ default: m.GoalBoard }))
);

const LazyProgressDashboard = lazy(() =>
  import("@/components/progress/ProgressDashboard").then((m) => ({ default: m.ProgressDashboard }))
);

const LazyProfileSettings = lazy(() =>
  import("@/components/settings/ProfileSettings").then((m) => ({ default: m.ProfileSettings }))
);

const LazyIntegrationSettings = lazy(() =>
  import("@/components/settings/IntegrationSettings").then((m) => ({ default: m.IntegrationSettings }))
);

const LazyLearnPage = lazy(() =>
  import("@/components/learn/LearnPage").then((m) => ({ default: m.LearnPage }))
);

const LazySkillProfilePage = lazy(() =>
  import("@/components/skills/SkillProfilePage").then((m) => ({ default: m.SkillProfilePage }))
);

/**
 * Tab definitions — maps route paths to their lazy component(s).
 * Order determines prefetch priority (Learn first since it's the home tab).
 */
const TAB_DEFS: Array<{ path: string; render: () => ReactNode }> = [
  { path: "/learn", render: () => <LazyLearnPage /> },
  { path: "/skills", render: () => <LazySkillProfilePage /> },
  { path: "/practice", render: () => <LazyPartyList /> },
  { path: "/goals", render: () => <LazyGoalBoard /> },
  { path: "/stats", render: () => <LazyProgressDashboard /> },
  {
    path: "/settings",
    render: () => (
      <>
        <LazyProfileSettings />
        <LazyIntegrationSettings />
      </>
    ),
  },
];

/**
 * Prefetch all tab chunks after a short idle delay so switching
 * to an unvisited tab doesn't wait for the network.
 */
function usePrefetchTabs(): void {
  const prefetched = useRef(false);
  useEffect(() => {
    if (prefetched.current) return;
    prefetched.current = true;

    const id = requestIdleCallback(
      () => {
        // Fire-and-forget dynamic imports — populates the module cache
        // so React.lazy resolves instantly when the tab is first visited.
        import("@/components/learn/LearnPage").catch(() => {});
        import("@/components/skills/SkillProfilePage").catch(() => {});
        import("@/components/party/PartyList").catch(() => {});
        import("@/components/goals/GoalBoard").catch(() => {});
        import("@/components/progress/ProgressDashboard").catch(() => {});
        import("@/components/settings/ProfileSettings").catch(() => {});
        import("@/components/settings/IntegrationSettings").catch(() => {});
      },
      { timeout: 3000 },
    );
    return () => cancelIdleCallback(id);
  }, []);
}

export function HubShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [clientTab, setClientTab] = useState<string | null>(null);

  // Track which tabs have been visited so we can mount them once and keep them alive.
  const [visitedTabs, setVisitedTabs] = useState<Set<string>>(new Set());

  // Prefetch all tab chunks during idle time
  usePrefetchTabs();

  // Single source of truth: clientTab (after first nav click) or pathname (initial server render)
  const effectivePath = clientTab ?? pathname;
  const title = getTitleForPath(effectivePath);

  // Mark the active tab as visited whenever it changes
  useEffect(() => {
    if (CLIENT_NAV_HREFS.has(effectivePath)) {
      setVisitedTabs((prev) => {
        if (prev.has(effectivePath)) return prev;
        const next = new Set(prev);
        next.add(effectivePath);
        return next;
      });
    }
  }, [effectivePath]);

  const toggleMobileMenu = useCallback(() => {
    setMobileMenuOpen((prev) => !prev);
  }, []);

  const handleNavClick = useCallback((href: string) => {
    if (!CLIENT_NAV_HREFS.has(href)) return;
    window.history.pushState(null, "", href);
    setClientTab(href);
  }, []);

  const handleMobileNavClick = useCallback((href: string) => {
    handleNavClick(href);
    setMobileMenuOpen(false);
  }, [handleNavClick]);

  // Clear stale clientTab when Next.js navigates to a non-client-tab route
  // (e.g., <Link> from /rooms grid to /rooms/[id])
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

  // When clientTab is null we're on a server-rendered route — show children directly.
  const isClientTab = clientTab !== null;

  return (
    <div className="flex h-screen overflow-hidden safe-bottom">
      {/* Desktop sidebar: always expanded, hidden below md */}
      <div className="hidden md:flex md:flex-shrink-0">
        <Sidebar onNavClick={handleNavClick} />
      </div>
      {/* Mobile overlay drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-[var(--sg-shell-900)]/40 backdrop-blur-sm"
            onClick={toggleMobileMenu}
            aria-label="Close menu"
          />
          <div className="relative h-full w-56 flex-shrink-0 shadow-xl">
            <Sidebar onNavClick={handleMobileNavClick} />
          </div>
        </div>
      )}
      <div
        className="min-w-0 flex-1 flex flex-col overflow-hidden"
        style={{ background: "var(--sg-white)" }}
      >
        {effectivePath !== "/practice" && effectivePath !== "/learn" && (
          <div className="shrink-0 px-4 md:px-5 lg:px-6">
            <div className="mx-auto flex h-16 items-center justify-between gap-4" style={{ maxWidth: "var(--sg-max-width)" }}>
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <IconButton
                  variant="ghost"
                  size="sm"
                  icon={<Menu size={20} strokeWidth={1.8} />}
                  onClick={toggleMobileMenu}
                  className="shrink-0 rounded-lg md:hidden"
                  aria-label="Open menu"
                />
                <span className="truncate text-lg font-semibold text-[var(--sg-shell-900)]">
                  {title}
                </span>
              </div>
              {effectivePath === "/goals" ? (
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<Plus size={18} strokeWidth={1.8} />}
                  onClick={() => document.dispatchEvent(new CustomEvent("fp:create-goal"))}
                  aria-label="New goal"
                >
                  <span className="hidden sm:inline">New Goal</span>
                </Button>
              ) : (
                <a
                  href="/practice"
                  onClick={(e) => {
                    e.preventDefault();
                    handleNavClick("/practice");
                  }}
                  className="flex h-10 shrink-0 items-center justify-center gap-2 rounded-[var(--sg-radius-btn)] bg-[var(--sg-forest-500)] px-4 text-white sm:px-5"
                  aria-label="Join session"
                >
                  <Users size={18} strokeWidth={1.8} className="shrink-0" />
                  <span className="hidden text-sm font-semibold sm:inline">Join Session</span>
                </a>
              )}
            </div>
          </div>
        )}
        <div className="fp-shell-scroll min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-4 pt-4 pb-5 md:px-5 md:pt-5 md:pb-6 lg:px-6">
          <div className="mx-auto w-full" style={{ maxWidth: "var(--sg-max-width)" }}>
            {/*
             * Keep-alive tabs: once a tab is visited, it stays mounted (hidden via display:none).
             * Switching back is instant — no re-render, no re-fetch, scroll position preserved.
             */}
            {isClientTab &&
              TAB_DEFS.map(({ path, render }) => {
                if (!visitedTabs.has(path)) return null;
                const isActive = effectivePath === path;
                return (
                  <main
                    key={path}
                    className="flex-1"
                    style={{ display: isActive ? "block" : "none" }}
                  >
                    <Suspense fallback={null}>{render()}</Suspense>
                  </main>
                );
              })}

            {/* Server-rendered route content (detail pages, etc.) */}
            {!isClientTab && children}
          </div>
        </div>
      </div>

      {/* Existing user migration prompt for function/fluency */}
      <FunctionMigrationModal />
    </div>
  );
}
