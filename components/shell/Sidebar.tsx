"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState, useEffect } from "react";
import { ChevronDown, ChevronUp, Sun, Moon, CreditCard, Settings, LogOut, LogIn } from "lucide-react";
import { Logo } from "./Logo";
import { useAuth } from "@/components/providers/AuthProvider";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { useTheme } from "@/components/providers/ThemeProvider";
import { NAV_ITEMS, NavIcon } from "./navItems";
import { PLAN_LABELS, STUB_PLAN } from "@/lib/constants";

const SIDEBAR_WIDTH_EXPANDED = "w-56";
const SIDEBAR_WIDTH_RAILS = "w-14 md:w-18";
const RAILS_INSET_X = "px-2 md:px-4";

/** Shared vertical rhythm tokens (used in both expanded and rails). */
const SECTION_GAP = "pt-4";
const NAV_ITEM_GAP = "gap-1.5";
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
  const { authState, signOut } = useAuth();
  const { displayName: rawDisplayName, username, avatarUrl } = useCurrentUser();
  const { colorMode, setColorMode } = useTheme();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  const displayName = rawDisplayName
    .split(/[\s._-]+/)
    .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
  const planLabel = PLAN_LABELS[STUB_PLAN];

  const activeId = NAV_ITEMS.find((item) => pathname === item.href)?.id ?? "rooms";

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
    ? `${SIDEBAR_WIDTH_RAILS} relative z-[var(--z-card)] flex h-screen flex-shrink-0 flex-col overflow-visible transition-[width] duration-200 ease-out`
    : `${SIDEBAR_WIDTH_EXPANDED} relative z-[var(--z-card)] flex h-screen flex-shrink-0 flex-col overflow-visible transition-[width] duration-200 ease-out`;

  return (
    <aside className={`${asideClass} backdrop-blur-xl`} style={{ background: "rgba(10, 10, 10, 0.7)", borderRight: "1px solid rgba(255,255,255,0.06)" }}>
      {collapsed ? (
        <div className={`flex min-h-0 flex-1 flex-col ${RAILS_INSET_X} pt-4`}>
          <nav className={`flex shrink-0 flex-col items-center ${NAV_ITEM_GAP}`}>
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
                  className={`flex h-10 min-h-10 w-10 min-w-10 shrink-0 items-center justify-center rounded-lg border-l-2 transition-all duration-150 ${isActive ? "border-[var(--color-accent-error)] bg-white/[0.06] backdrop-blur-sm" : "border-transparent"}`}
                  style={{
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
              title={username ? `@${username}` : `${displayName} · ${planLabel}`}
            >
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
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
          <div className="flex h-14 shrink-0 items-center px-4">
            <Logo href="/rooms" maxWidth={150} />
          </div>
          <nav className={`flex flex-col ${NAV_ITEM_GAP} px-3 pt-2`}>
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
                  className={`-mx-3 flex h-12 items-center gap-3 border-l-2 px-[calc(0.75rem+0.625rem)] transition-all duration-150 ${isActive ? "border-[var(--color-accent-error)] bg-white/[0.06]" : "border-transparent"}`}
                  style={{
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
          <div ref={profileRef} className={`relative mt-auto flex flex-col gap-3 ${BOTTOM_PAD} px-3`}>
            {profileMenuOpen && (
              <div
                className="absolute bottom-full left-0 right-0 z-[var(--z-dropdown)] mb-2 overflow-hidden rounded-lg shadow-lg"
                style={PROFILE_MENU_STYLE}
              >
                {profileMenuItems}
              </div>
            )}
            <button
              type="button"
              onClick={() => setProfileMenuOpen((o) => !o)}
              className="flex w-full items-center gap-3 rounded-lg py-1.5 pl-1 pr-2"
              aria-expanded={profileMenuOpen}
              aria-haspopup="true"
              aria-label="Profile menu"
            >
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
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
                  {username ? `@${username}` : planLabel}
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
