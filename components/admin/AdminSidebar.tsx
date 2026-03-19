"use client";

import Link from "next/link";
import { ArrowLeft, Shield } from "lucide-react";
import { ADMIN_NAV_ITEMS } from "./adminNavItems";
import { NavIcon } from "@/components/shell/navItems";

interface AdminSidebarProps {
  activeId: string;
  onNavClick?: (href: string) => void;
  badges?: Record<string, number>;
}

export function AdminSidebar({ activeId, onNavClick, badges }: AdminSidebarProps) {
  return (
    <aside
      className="relative z-[var(--z-card)] flex h-screen w-56 flex-shrink-0 flex-col overflow-visible backdrop-blur-xl"
      style={{
        background: "rgba(10, 10, 10, 0.7)",
        borderRight: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {/* Header */}
      <div className="flex h-14 shrink-0 items-center gap-2.5 px-4">
        <Shield size={18} strokeWidth={1.8} className="shrink-0 text-[var(--sg-forest-500)]" />
        <span
          className="text-sm font-bold tracking-wide text-[var(--sg-shell-900)]"
        >
          Admin
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex flex-col gap-1.5 px-3 pt-2">
        {ADMIN_NAV_ITEMS.map((item) => {
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
              className={`-mx-3 flex h-12 items-center gap-3 border-l-2 px-[calc(0.75rem+0.625rem)] transition-all duration-150 ${
                isActive
                  ? "border-[var(--sg-forest-500)] bg-white/[0.06]"
                  : "border-transparent hover:bg-white/[0.03]"
              }`}
              style={{
                color: isActive
                  ? "var(--sg-shell-900)"
                  : "var(--sg-shell-500)",
              }}
              aria-current={isActive ? "page" : undefined}
            >
              <NavIcon icon={item.icon} />
              <span className="text-sm font-medium">{item.label}</span>
              {badges && badges[item.id] > 0 && (
                <span
                  className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold leading-none"
                  style={{
                    background: "var(--sg-forest-500)",
                    color: "var(--sg-white)",
                  }}
                >
                  {badges[item.id]}
                </span>
              )}
            </a>
          );
        })}
      </nav>

      {/* Back to App */}
      <div className="mt-auto pb-5 px-3">
        <Link
          href="/home"
          className="flex items-center gap-3 rounded-lg py-2 px-2 text-sm font-medium text-[var(--sg-shell-500)] transition-colors hover:bg-white/[0.03] hover:text-[var(--sg-shell-600)]"
        >
          <ArrowLeft size={18} strokeWidth={1.8} className="shrink-0" />
          <span>Back to App</span>
        </Link>
      </div>
    </aside>
  );
}
