"use client";

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  ReactNode,
  KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  const [mounted, setMounted] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const previousActive = useRef<HTMLElement | null>(null);

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
    previousActive.current = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
      previousActive.current?.focus();
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !mounted) return;
    const focusable = overlayRef.current?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable?.[0];
    first?.focus();
  }, [isOpen, mounted]);

  if (!isOpen) return null;

  const content = (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? "modal-title" : undefined}
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ zIndex: 40 }}
      onKeyDown={handleKeyDown}
    >
      <div
        className="absolute inset-0 bg-[var(--color-navy-700)]/60 backdrop-blur-[8px]"
        aria-hidden
        onClick={onClose}
      />
      <div
        className="relative max-h-[90vh] w-full max-w-[480px] overflow-auto rounded-[var(--radius-lg)] border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] p-8 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <h2
            id="modal-title"
            className="mb-4 text-2xl font-bold text-white"
            style={{ fontFamily: "var(--font-montserrat), sans-serif" }}
          >
            {title}
          </h2>
        )}
        {children}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded p-1 text-[var(--color-text-tertiary)] hover:text-white"
          aria-label="Close"
        >
          <span className="text-xl leading-none">&times;</span>
        </button>
      </div>
    </div>
  );

  return mounted && typeof document !== "undefined"
    ? createPortal(content, document.body)
    : null;
}
