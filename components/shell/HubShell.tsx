"use client";

import { usePathname } from "next/navigation";
import { ReactNode, useState, useEffect, useCallback, lazy, Suspense } from "react";
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
  return PAGE_TITLES[pathname] ?? "Practice";
}

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

function renderTabContent(tab: string): ReactNode {
  switch (tab) {
    case "/practice":
      return (
        <main className="flex-1">
          <Suspense fallback={null}>
            <LazyPartyList />
          </Suspense>
        </main>
      );
    case "/learn":
      return (
        <main className="flex-1">
          <Suspense fallback={null}>
            <LazyLearnPage />
          </Suspense>
        </main>
      );
    case "/skills":
      return (
        <main className="flex-1">
          <Suspense fallback={null}>
            <LazySkillProfilePage />
          </Suspense>
        </main>
      );
    case "/goals":
      return (
        <main className="flex-1">
          <Suspense fallback={null}>
            <LazyGoalBoard />
          </Suspense>
        </main>
      );
    case "/stats":
      return (
        <main className="flex-1">
          <Suspense fallback={null}>
            <LazyProgressDashboard />
          </Suspense>
        </main>
      );
    case "/settings":
      return (
        <main className="flex-1">
          <Suspense fallback={null}>
            <LazyProfileSettings />
            <LazyIntegrationSettings />
          </Suspense>
        </main>
      );
    default:
      return null;
  }
}

export function HubShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [clientTab, setClientTab] = useState<string | null>(null);

  // Single source of truth: clientTab (after first nav click) or pathname (initial server render)
  const effectivePath = clientTab ?? pathname;
  const title = getTitleForPath(effectivePath);

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
            className="absolute inset-0 bg-shell-900/40 backdrop-blur-sm"
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
          <div className="flex h-16 shrink-0 items-center justify-between gap-4 px-4 md:px-5 lg:px-6">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <IconButton
                variant="ghost"
                size="sm"
                icon={<Menu size={20} strokeWidth={1.8} />}
                onClick={toggleMobileMenu}
                className="shrink-0 rounded-lg md:hidden"
                aria-label="Open menu"
              />
              <span className="truncate text-lg font-semibold text-shell-900">
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
                className="flex h-10 shrink-0 items-center justify-center gap-2 rounded-[var(--sg-radius-btn)] bg-forest-500 px-4 text-white sm:px-5"
                aria-label="Join session"
              >
                <Users size={18} strokeWidth={1.8} className="shrink-0" />
                <span className="hidden text-sm font-semibold sm:inline">Join Session</span>
              </a>
            )}
          </div>
        )}
        <div className="fp-shell-scroll min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-4 pt-4 pb-5 md:px-5 md:pt-5 md:pb-6 lg:px-6">
          {clientTab !== null ? renderTabContent(effectivePath) : children}
        </div>
      </div>

      {/* Existing user migration prompt for function/fluency */}
      <FunctionMigrationModal />
    </div>
  );
}
