"use client";

import { useEffect, memo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { NAV_ITEMS, NavIcon } from "@/components/shell/navItems";

interface SessionNavDrawerProps {
  onClose: () => void;
}

export const NAV_WIDTH = 240;

export const SessionNavDrawer = memo(function SessionNavDrawer({ onClose }: SessionNavDrawerProps) {
  const pathname = usePathname();

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <aside
      className="flex h-full flex-col border-r border-[var(--sg-shell-border)] bg-[var(--sg-white)] pt-4"
      style={{ width: NAV_WIDTH }}
      role="navigation"
      aria-label="Navigation menu"
    >
      <div className="mb-6 flex items-center justify-between pl-4 pr-2">
        <span className="text-sm font-semibold text-white">Menu</span>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-[var(--sg-shell-500)] hover:bg-[var(--sg-shell-200)] hover:text-white"
          aria-label="Close menu"
        >
          <X size={18} strokeWidth={2} />
        </button>
      </div>
      <nav className="flex flex-col gap-0.5 px-3">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.id}
              href={item.href}
              onClick={onClose}
              className="flex h-10 items-center gap-3 rounded-lg px-3 transition-[color,background] duration-150"
              style={{
                background: isActive ? "var(--sg-shell-200)" : "transparent",
                color: isActive ? "var(--sg-shell-900)" : "var(--sg-shell-500)",
              }}
              aria-current={isActive ? "page" : undefined}
            >
              <NavIcon icon={item.icon} />
              <span className="text-sm font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
});
