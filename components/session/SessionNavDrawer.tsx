"use client";

import { useState, useEffect, useCallback, KeyboardEvent } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { NAV_ITEMS, NavIcon } from "@/components/shell/navItems";

interface SessionNavDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SessionNavDrawer({ isOpen, onClose }: SessionNavDrawerProps) {
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen || !mounted) return null;

  const content = (
    <div
      className="fixed inset-0 z-50 flex"
      role="dialog"
      aria-modal="true"
      aria-label="Navigation menu"
      onKeyDown={handleKeyDown}
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-label="Close menu"
      />
      <aside className="relative z-10 flex w-60 flex-col border-r border-[var(--color-border-default)] bg-[var(--color-bg-primary)] pt-4 shadow-xl">
        <div className="mb-6 flex items-center justify-between pl-4 pr-0">
          <span className="text-sm font-semibold text-white">Menu</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-active)] hover:text-white"
            aria-label="Close menu"
          >
            <X size={20} strokeWidth={2} />
          </button>
        </div>
        <nav className="flex flex-col gap-0.5 pl-4 pr-0">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.id}
                href={item.href}
                onClick={onClose}
                className="flex h-10 items-center gap-3 rounded-lg px-3 transition-[color,background] duration-150"
                style={{
                  background: isActive ? "var(--color-bg-active)" : "transparent",
                  color: isActive ? "var(--color-text-primary)" : "var(--color-text-tertiary)",
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
    </div>
  );

  return createPortal(content, document.body);
}
