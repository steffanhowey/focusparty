"use client";

import {
  useEffect,
  useRef,
  useCallback,
  ReactNode,
  KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { useFocusTrap } from "@/lib/useFocusTrap";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  ariaLabel?: string;
  children: ReactNode;
  panelClassName?: string;
  variant?: "default" | "immersive";
}

export function Modal({
  isOpen,
  onClose,
  title,
  ariaLabel,
  children,
  panelClassName = "",
  variant = "default",
}: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const previousActive = useRef<HTMLElement | null>(null);

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

  useFocusTrap(overlayRef, isOpen);

  useEffect(() => {
    if (!isOpen) return;
    const focusable = overlayRef.current?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable?.[0];
    first?.focus();
  }, [isOpen]);

  if (!isOpen) return null;

  const overlayClassName =
    variant === "immersive"
      ? "absolute inset-0 bg-black/50 backdrop-blur-[10px]"
      : "absolute inset-0 bg-shell-900/40 backdrop-blur-[8px]";
  const containerClassName =
    variant === "immersive"
      ? "relative max-h-[90vh] w-full max-w-[480px] overflow-auto rounded-[var(--sg-radius-xl)] border border-white/[0.08] p-8"
      : "relative max-h-[90vh] w-full max-w-[480px] overflow-auto rounded-[var(--sg-radius-lg)] border border-shell-border bg-white p-8 shadow-xl";
  const containerStyle =
    variant === "immersive"
      ? {
          background: "color-mix(in srgb, var(--sg-forest-900) 88%, transparent)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          boxShadow: "var(--sg-shadow-dark-lg)",
        }
      : undefined;
  const titleClassName =
    variant === "immersive"
      ? "mb-4 text-xl font-bold text-white"
      : "mb-4 text-xl font-bold text-shell-900";
  const closeButtonClassName =
    variant === "immersive"
      ? "absolute right-2 top-2 flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg text-white/55 transition-colors hover:bg-white/10 hover:text-white"
      : "absolute right-2 top-2 flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg text-shell-500 hover:text-shell-900";

  const content = (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? "modal-title" : undefined}
      aria-label={title ? undefined : ariaLabel}
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ zIndex: 40 }}
      onKeyDown={handleKeyDown}
    >
      <div
        className={overlayClassName}
        aria-hidden
        onClick={onClose}
      />
      <div
        className={`${containerClassName} ${panelClassName}`}
        style={containerStyle}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <h2
            id="modal-title"
            className={titleClassName}
          >
            {title}
          </h2>
        )}
        {children}
        <button
          type="button"
          onClick={onClose}
          className={closeButtonClassName}
          aria-label="Close"
        >
          <span className="text-xl leading-none">&times;</span>
        </button>
      </div>
    </div>
  );

  return typeof document !== "undefined"
    ? createPortal(content, document.body)
    : null;
}
