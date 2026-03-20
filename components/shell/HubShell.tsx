"use client";

import { usePathname } from "next/navigation";
import { ReactNode, useState, useEffect, useCallback, useRef, lazy, Suspense } from "react";
import { Menu, PanelsTopLeft } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { Sidebar } from "./Sidebar";
import { CLIENT_NAV_HREFS } from "./navItems";
import { FunctionMigrationModal } from "@/components/onboarding/FunctionMigrationModal";

const PAGE_TITLE_RULES: Array<{ prefix: string; title: string }> = [
  { prefix: "/home", title: "Home" },
  { prefix: "/missions", title: "Missions" },
  { prefix: "/learn", title: "Missions" },
  { prefix: "/rooms", title: "Rooms" },
  { prefix: "/practice", title: "Rooms" },
  { prefix: "/progress", title: "Progress" },
  { prefix: "/skills", title: "Progress" },
  { prefix: "/stats", title: "Progress" },
  { prefix: "/goals", title: "Missions" },
  { prefix: "/settings", title: "Settings" },
];

function getTitleForPath(pathname: string): string {
  const match = PAGE_TITLE_RULES.find(({ prefix }) => pathname.startsWith(prefix));
  return match?.title ?? "Home";
}

/* ─── Lazy tab components ─── */

const LazyPartyList = lazy(() =>
  import("@/components/party/PartyList").then((m) => ({ default: m.PartyList }))
);

const LazyHomePage = lazy(() =>
  import("@/components/home/HomePage").then((m) => ({ default: m.HomePage }))
);

const LazyProgressPage = lazy(() =>
  import("@/components/progress/ProgressPage").then((m) => ({ default: m.ProgressPage }))
);

const LazyProfileSettings = lazy(() =>
  import("@/components/settings/ProfileSettings").then((m) => ({ default: m.ProfileSettings }))
);

const LazyIntegrationSettings = lazy(() =>
  import("@/components/settings/IntegrationSettings").then((m) => ({ default: m.IntegrationSettings }))
);

const LazyMissionsPage = lazy(() =>
  import("@/components/missions/MissionsPage").then((m) => ({ default: m.MissionsPage }))
);

/**
 * Tab definitions — maps route paths to their lazy component(s).
 * Order determines prefetch priority (Home first since it's the app launchpad).
 */
const TAB_DEFS: Array<{ path: string; render: () => ReactNode }> = [
  { path: "/home", render: () => <LazyHomePage /> },
  { path: "/missions", render: () => <LazyMissionsPage /> },
  { path: "/rooms", render: () => <LazyPartyList /> },
  { path: "/progress", render: () => <LazyProgressPage /> },
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
        import("@/components/home/HomePage").catch(() => {});
        import("@/components/missions/MissionsPage").catch(() => {});
        import("@/components/party/PartyList").catch(() => {});
        import("@/components/progress/ProgressPage").catch(() => {});
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
  const [visitedTabs, setVisitedTabs] = useState<Set<string>>(
    () => new Set(CLIENT_NAV_HREFS.has(pathname) ? [pathname] : []),
  );

  // Prefetch all tab chunks during idle time
  usePrefetchTabs();

  const resolvedClientTab =
    clientTab !== null && CLIENT_NAV_HREFS.has(pathname) ? clientTab : null;

  // Single source of truth: clientTab (after first nav click) or pathname (initial server render)
  const effectivePath = resolvedClientTab ?? pathname;
  const title = getTitleForPath(effectivePath);
  const hideTopChrome =
    effectivePath === "/home" ||
    effectivePath === "/rooms" ||
    effectivePath === "/missions";

  const toggleMobileMenu = useCallback(() => {
    setMobileMenuOpen((prev) => !prev);
  }, []);

  const handleNavClick = useCallback((href: string) => {
    if (!CLIENT_NAV_HREFS.has(href)) return;
    window.history.pushState(null, "", href);
    setClientTab(href);
    setVisitedTabs((prev) => {
      if (prev.has(href)) return prev;
      const next = new Set(prev);
      next.add(href);
      return next;
    });
  }, []);

  const handleMobileNavClick = useCallback((href: string) => {
    handleNavClick(href);
    setMobileMenuOpen(false);
  }, [handleNavClick]);

  // Sync with browser back/forward
  useEffect(() => {
    const onPopState = () => {
      const p = window.location.pathname;
      if (CLIENT_NAV_HREFS.has(p)) {
        setClientTab(p);
        setVisitedTabs((prev) => {
          if (prev.has(p)) return prev;
          const next = new Set(prev);
          next.add(p);
          return next;
        });
      } else {
        setClientTab(null);
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // When clientTab is null we're on a server-rendered route — show children directly.
  const isClientTab = resolvedClientTab !== null;

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
        {!hideTopChrome && (
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
              {effectivePath !== "/rooms" && (
                <button
                  type="button"
                  onClick={() => handleNavClick("/rooms")}
                  className="flex h-10 shrink-0 items-center justify-center gap-2 rounded-[var(--sg-radius-btn)] bg-[var(--sg-forest-500)] px-4 text-white sm:px-5"
                  aria-label="Open rooms"
                >
                  <PanelsTopLeft size={18} strokeWidth={1.8} className="shrink-0" />
                  <span className="hidden text-sm font-semibold sm:inline">Open Rooms</span>
                </button>
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
