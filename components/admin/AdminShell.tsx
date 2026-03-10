"use client";

import { ReactNode, useState, useEffect, useCallback, lazy, Suspense } from "react";
import { Menu } from "lucide-react";
import { AdminSidebar } from "./AdminSidebar";
import { ADMIN_NAV_ITEMS, ADMIN_NAV_HREFS } from "./adminNavItems";
import { useAdminAuth } from "@/lib/admin/useAdminAuth";

const PAGE_TITLES: Record<string, string> = {
  "/admin": "Dashboard",
  "/admin/users": "Users",
  "/admin/rooms": "Rooms",
  "/admin/backgrounds": "Backgrounds",
  "/admin/activity": "Activity",
  "/admin/synthetics": "Synthetics",
  "/admin/settings": "Settings",
};

function getTitleForPath(pathname: string): string {
  return PAGE_TITLES[pathname] ?? "Admin";
}

/* Lazy-loaded admin page views */
const LazyDashboardView = lazy(() =>
  import("@/components/admin/dashboard/DashboardView").then((m) => ({
    default: m.DashboardView,
  }))
);
const LazyUsersView = lazy(() =>
  import("@/components/admin/users/UsersView").then((m) => ({
    default: m.UsersView,
  }))
);
const LazyRoomsView = lazy(() =>
  import("@/components/admin/rooms/RoomsView").then((m) => ({
    default: m.RoomsView,
  }))
);
const LazyBackgroundsView = lazy(() =>
  import("@/components/admin/backgrounds/BackgroundsView").then((m) => ({
    default: m.BackgroundsView,
  }))
);
const LazyActivityView = lazy(() =>
  import("@/components/admin/activity/ActivityView").then((m) => ({
    default: m.ActivityView,
  }))
);
const LazySyntheticsView = lazy(() =>
  import("@/components/admin/synthetics/SyntheticsView").then((m) => ({
    default: m.SyntheticsView,
  }))
);
const LazySettingsView = lazy(() =>
  import("@/components/admin/settings/SettingsView").then((m) => ({
    default: m.SettingsView,
  }))
);

function renderTabContent(tab: string): ReactNode {
  switch (tab) {
    case "/admin":
      return (
        <Suspense fallback={null}>
          <LazyDashboardView />
        </Suspense>
      );
    case "/admin/users":
      return (
        <Suspense fallback={null}>
          <LazyUsersView />
        </Suspense>
      );
    case "/admin/rooms":
      return (
        <Suspense fallback={null}>
          <LazyRoomsView />
        </Suspense>
      );
    case "/admin/backgrounds":
      return (
        <Suspense fallback={null}>
          <LazyBackgroundsView />
        </Suspense>
      );
    case "/admin/activity":
      return (
        <Suspense fallback={null}>
          <LazyActivityView />
        </Suspense>
      );
    case "/admin/synthetics":
      return (
        <Suspense fallback={null}>
          <LazySyntheticsView />
        </Suspense>
      );
    case "/admin/settings":
      return (
        <Suspense fallback={null}>
          <LazySettingsView />
        </Suspense>
      );
    default:
      return null;
  }
}

export function AdminShell({ children }: { children: ReactNode }) {
  const { isAdmin, isLoading } = useAdminAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [clientTab, setClientTab] = useState<string | null>(null);

  // Derive active path
  const effectivePath =
    clientTab ?? (typeof window !== "undefined" ? window.location.pathname : "/admin");
  const title = getTitleForPath(effectivePath);
  const activeNavId =
    ADMIN_NAV_ITEMS.find((item) => effectivePath === item.href)?.id ?? "dashboard";

  const toggleMobileMenu = useCallback(() => {
    setMobileMenuOpen((prev) => !prev);
  }, []);

  const handleNavClick = useCallback((href: string) => {
    if (!ADMIN_NAV_HREFS.has(href)) return;
    window.history.pushState(null, "", href);
    setClientTab(href);
  }, []);

  const handleMobileNavClick = useCallback(
    (href: string) => {
      handleNavClick(href);
      setMobileMenuOpen(false);
    },
    [handleNavClick]
  );

  // Sync with browser back/forward
  useEffect(() => {
    const onPopState = () => {
      const p = window.location.pathname;
      if (ADMIN_NAV_HREFS.has(p)) {
        setClientTab(p);
      } else {
        setClientTab(null);
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // Loading / auth gate
  if (isLoading || !isAdmin) {
    return (
      <div
        className="flex h-screen items-center justify-center"
        style={{ background: "var(--color-bg-primary)" }}
      >
        <div
          className="h-6 w-6 animate-spin rounded-full border-2 border-current border-t-transparent"
          style={{ color: "var(--color-text-tertiary)" }}
        />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden md:flex md:flex-shrink-0">
        <AdminSidebar activeId={activeNavId} onNavClick={handleNavClick} />
      </div>

      {/* Mobile overlay drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={toggleMobileMenu}
            aria-label="Close menu"
          />
          <div className="relative h-full w-56 flex-shrink-0 shadow-xl">
            <AdminSidebar activeId={activeNavId} onNavClick={handleMobileNavClick} />
          </div>
        </div>
      )}

      {/* Main content */}
      <div
        className="min-w-0 flex-1 flex flex-col overflow-hidden"
        style={{ background: "var(--color-bg-primary)" }}
      >
        {/* Header */}
        <div className="flex h-16 shrink-0 items-center justify-between gap-4 px-4 md:px-5 lg:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <button
              type="button"
              onClick={toggleMobileMenu}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-bg-active)] hover:text-[var(--color-text-primary)] md:hidden"
              aria-label="Open menu"
            >
              <Menu size={20} strokeWidth={1.8} />
            </button>
            <span className="truncate text-lg font-semibold text-[var(--color-text-primary)]">
              {title}
            </span>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="fp-shell-scroll min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-4 pt-4 pb-5 md:px-5 md:pt-5 md:pb-6 lg:px-6">
          {ADMIN_NAV_HREFS.has(effectivePath) ? renderTabContent(effectivePath) : children}
        </div>
      </div>
    </div>
  );
}
