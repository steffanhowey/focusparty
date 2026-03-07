"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState, useEffect } from "react";
import { ChevronLeft, ChevronDown, ChevronUp, Sun, Moon, CreditCard, Settings, LogOut, LogIn } from "lucide-react";
import { Logo } from "./Logo";
import { useAuth } from "@/components/providers/AuthProvider";
import { useTheme } from "@/components/providers/ThemeProvider";
import { NAV_ITEMS, NavIcon } from "./navItems";
import { PLAN_LABELS, STUB_DISPLAY_NAME, STUB_PLAN } from "@/lib/constants";

const SIDEBAR_WIDTH_EXPANDED = "w-60";
const SIDEBAR_WIDTH_RAILS = "w-14 md:w-18";
const RAILS_INSET_X = "px-2 md:px-4";

/** Shared vertical rhythm tokens (used in both expanded and rails). */
const SECTION_GAP = "pt-4";
const NAV_ITEM_GAP = "gap-1";
const BOTTOM_PAD = "pb-5";

interface SidebarProps {
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  onNavClick?: (href: string) => void;
}

const PROFILE_MENU_STYLE = {
  background: "var(--color-bg-elevated)",
  border: "1px solid var(--color-border-default)",
};

export function Sidebar({ collapsed = false, onToggleCollapsed, onNavClick }: SidebarProps) {
  const pathname = usePathname();
  const { user, authState, signOut } = useAuth();
  const { colorMode, setColorMode } = useTheme();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  const rawName =
    user?.user_metadata?.display_name ??
    user?.user_metadata?.full_name ??
    user?.email?.split("@")[0] ??
    STUB_DISPLAY_NAME;
  const displayName = rawName
    .split(/[\s._-]+/)
    .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
  const avatarUrl: string | undefined =
    user?.user_metadata?.avatar_url ?? user?.user_metadata?.picture;
  const planLabel = PLAN_LABELS[STUB_PLAN];

  const activeId = NAV_ITEMS.find((item) => pathname === item.href)?.id ?? "party";

  useEffect(() => {
    if (!profileMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [profileMenuOpen]);

  const isAuthenticated = authState === "authenticated";

  const profileMenuItems = (
    <>
      <button
        type="button"
        onClick={() => {
          setColorMode(colorMode === "dark" ? "light" : "dark");
        }}
        className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-bg-hover)]"
      >
        {colorMode === "dark" ? <Sun size={18} strokeWidth={1.8} /> : <Moon size={18} strokeWidth={1.8} />}
        <span>{colorMode === "dark" ? "Light mode" : "Dark mode"}</span>
      </button>
      <a
        href="/settings"
        onClick={(e) => {
          setProfileMenuOpen(false);
          if (onNavClick) {
            e.preventDefault();
            onNavClick("/settings");
          }
        }}
        className="flex w-full items-center gap-3 px-3 py-2 text-sm font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-bg-hover)]"
      >
        <CreditCard size={18} strokeWidth={1.8} />
        <span>Plans & Billing</span>
      </a>
      <a
        href="/settings"
        onClick={(e) => {
          setProfileMenuOpen(false);
          if (onNavClick) {
            e.preventDefault();
            onNavClick("/settings");
          }
        }}
        className="flex w-full items-center gap-3 px-3 py-2 text-sm font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-bg-hover)]"
      >
        <Settings size={18} strokeWidth={1.8} />
        <span>Settings</span>
      </a>
      {isAuthenticated ? (
        <button
          type="button"
          onClick={() => {
            setProfileMenuOpen(false);
            signOut();
          }}
          className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-bg-hover)]"
        >
          <LogOut size={18} strokeWidth={1.8} />
          <span>Sign out</span>
        </button>
      ) : (
        <Link
          href="/login"
          onClick={() => setProfileMenuOpen(false)}
          className="flex w-full items-center gap-3 px-3 py-2 text-sm font-medium text-[var(--color-accent-primary)] transition-colors hover:bg-[var(--color-bg-hover)]"
        >
          <LogIn size={18} strokeWidth={1.8} />
          <span>Sign in</span>
        </Link>
      )}
    </>
  );

  const asideClass = collapsed
    ? `${SIDEBAR_WIDTH_RAILS} relative z-[var(--z-card)] flex h-screen flex-shrink-0 flex-col overflow-visible pt-2 md:pt-4 transition-[width] duration-200 ease-out`
    : `${SIDEBAR_WIDTH_EXPANDED} relative z-[var(--z-card)] flex h-screen flex-shrink-0 flex-col overflow-visible pt-2 md:pt-4 transition-[width] duration-200 ease-out`;

  return (
    <aside className={asideClass} style={{ background: "var(--color-bg-primary)" }}>
      {collapsed ? (
        <div className={`flex min-h-0 flex-1 flex-col ${RAILS_INSET_X}`}>
          <div className="flex h-16 shrink-0 items-center justify-center">
            <Logo href="/party" variant="small" />
          </div>
          <nav className={`flex shrink-0 flex-col items-center ${NAV_ITEM_GAP} ${SECTION_GAP}`}>
            {NAV_ITEMS.map((item) => {
              const isActive = activeId === item.id;
              return (
                <a
                  key={item.id}
                  href={item.href}
                  onClick={(e) => {
                    if (onNavClick) {
                      e.preventDefault();
                      onNavClick(item.href);
                    }
                  }}
                  className="flex h-10 min-h-10 w-10 min-w-10 shrink-0 items-center justify-center rounded-lg transition-[color,background] duration-150"
                  style={{
                    background: isActive ? "var(--color-bg-active)" : "transparent",
                    color: isActive ? "var(--color-text-primary)" : "var(--color-text-tertiary)",
                  }}
                  aria-current={isActive ? "page" : undefined}
                  title={item.label}
                >
                  <NavIcon icon={item.icon} />
                </a>
              );
            })}
          </nav>
          <div ref={profileRef} className={`relative mt-auto flex shrink-0 flex-col items-center gap-3 ${BOTTOM_PAD}`}>
            {profileMenuOpen && (
              <div
                className="absolute bottom-full left-1/2 z-[var(--z-dropdown)] mb-1 w-48 -translate-x-1/2 overflow-hidden rounded-lg shadow-lg"
                style={PROFILE_MENU_STYLE}
              >
                {profileMenuItems}
              </div>
            )}
            <button
              type="button"
              onClick={() => setProfileMenuOpen((o) => !o)}
              className="flex shrink-0"
              aria-expanded={profileMenuOpen}
              aria-haspopup="true"
              aria-label="Profile menu"
              title={`${displayName} · ${planLabel}`}
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt=""
                  className="h-9 w-9 shrink-0 rounded-full object-cover"
                  style={{ border: "1px solid var(--color-border-default)" }}
                />
              ) : (
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-semibold"
                  style={{
                    background: "var(--color-bg-elevated)",
                    border: "1px solid var(--color-border-default)",
                    color: "var(--color-text-primary)",
                    fontSize: 14,
                  }}
                >
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex h-16 shrink-0 items-center justify-between gap-2 pl-4 pr-0">
            <div className="flex min-w-0 flex-1 items-center">
              <Logo href="/party" variant={colorMode === "light" ? "light" : "dark"} />
            </div>
            {onToggleCollapsed && (
              <button
                type="button"
                onClick={onToggleCollapsed}
                className="flex shrink-0 items-center justify-center rounded-lg p-1.5 text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-bg-active)] hover:text-[var(--color-text-primary)]"
                aria-label="Collapse sidebar"
              >
                <ChevronLeft size={18} strokeWidth={2} />
              </button>
            )}
          </div>
          <nav className={`flex flex-col ${NAV_ITEM_GAP} ${SECTION_GAP} pl-4 pr-0`}>
            {NAV_ITEMS.map((item) => {
              const isActive = activeId === item.id;
              return (
                <a
                  key={item.id}
                  href={item.href}
                  onClick={(e) => {
                    if (onNavClick) {
                      e.preventDefault();
                      onNavClick(item.href);
                    }
                  }}
                  className="flex h-10 items-center gap-3 rounded-lg -ml-3 pl-3 pr-2.5 transition-[color,background] duration-150"
                  style={{
                    background: isActive ? "var(--color-bg-active)" : "transparent",
                    color: isActive ? "var(--color-text-primary)" : "var(--color-text-tertiary)",
                  }}
                  aria-current={isActive ? "page" : undefined}
                >
                  <NavIcon icon={item.icon} />
                  <span className="text-sm font-medium">
                    {item.label}
                  </span>
                </a>
              );
            })}
          </nav>
          <div ref={profileRef} className={`relative mt-auto flex flex-col gap-3 ${BOTTOM_PAD} pl-4 pr-0`}>
            {profileMenuOpen && (
              <div
                className="absolute bottom-full left-4 right-0 z-[var(--z-dropdown)] mb-2 overflow-hidden rounded-lg shadow-lg"
                style={PROFILE_MENU_STYLE}
              >
                {profileMenuItems}
              </div>
            )}
            <button
              type="button"
              onClick={() => setProfileMenuOpen((o) => !o)}
              className="flex w-full items-center gap-3 rounded-lg py-1.5 pr-2"
              aria-expanded={profileMenuOpen}
              aria-haspopup="true"
              aria-label="Profile menu"
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt=""
                  className="h-9 w-9 shrink-0 rounded-full object-cover"
                  style={{ border: "1px solid var(--color-border-default)" }}
                />
              ) : (
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-semibold"
                  style={{
                    background: "var(--color-bg-elevated)",
                    border: "1px solid var(--color-border-default)",
                    color: "var(--color-text-primary)",
                    fontSize: 14,
                  }}
                >
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1 text-left">
                <p className="truncate text-sm font-medium text-[var(--color-text-primary)]">
                  {displayName}
                </p>
                <p className="truncate text-xs font-medium text-[var(--color-text-tertiary)]">
                  {planLabel}
                </p>
              </div>
              <span className="shrink-0 text-[var(--color-text-tertiary)]">
                {profileMenuOpen ? <ChevronUp size={16} strokeWidth={2} /> : <ChevronDown size={16} strokeWidth={2} />}
              </span>
            </button>
          </div>
        </>
      )}
    </aside>
  );
}
