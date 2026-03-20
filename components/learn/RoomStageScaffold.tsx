"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

interface RoomStageFooterProps {
  meta?: ReactNode;
  primaryAction?: ReactNode;
  secondaryAction?: ReactNode;
  className?: string;
}

interface RoomStageScaffoldProps {
  eyebrow: string;
  title: string;
  description?: ReactNode;
  badge?: ReactNode;
  children: ReactNode;
  footerMeta?: ReactNode;
  primaryAction?: ReactNode;
  secondaryAction?: ReactNode;
  contentClassName?: string;
}

interface RoomStagePanelProps {
  children: ReactNode;
  className?: string;
}

interface RoomStageSecondaryButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  className?: string;
}

export function RoomStageFooter({
  meta,
  primaryAction,
  secondaryAction,
  className = "",
}: RoomStageFooterProps) {
  return (
    <div
      className={`border-t border-white/[0.06] bg-black/10 px-5 py-4 md:px-6 ${className}`}
    >
      <div className="mx-auto flex w-full items-center justify-between gap-4">
        <div className="min-w-0 flex-1 text-xs leading-5 text-white/45">
          {meta}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {secondaryAction}
          {primaryAction}
        </div>
      </div>
    </div>
  );
}

export function RoomStageScaffold({
  eyebrow,
  title,
  description,
  badge,
  children,
  footerMeta,
  primaryAction,
  secondaryAction,
  contentClassName = "max-w-[680px] space-y-5",
}: RoomStageScaffoldProps) {
  return (
    <div
      className="flex h-full w-full flex-col overflow-hidden rounded-[var(--sg-radius-xl)] border border-white/[0.08] bg-white/[0.04]"
      style={{ boxShadow: "var(--sg-shadow-dark-sm)" }}
    >
      <div className="border-b border-white/[0.06] px-6 py-5 md:px-8">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--sg-forest-300)]">
              {eyebrow}
            </p>
            <h2 className="mt-3 text-2xl font-semibold leading-tight tracking-[-0.02em] text-white">
              {title}
            </h2>
            {description ? (
              <div className="mt-3 max-w-2xl text-sm leading-6 text-white/55">
                {description}
              </div>
            ) : null}
          </div>
          {badge ? <div className="shrink-0">{badge}</div> : null}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto fp-shell-scroll px-6 py-5 md:px-8">
        <div className={`mx-auto w-full ${contentClassName}`}>{children}</div>
      </div>

      <RoomStageFooter
        meta={footerMeta}
        primaryAction={primaryAction}
        secondaryAction={secondaryAction}
      />
    </div>
  );
}

export function RoomStagePanel({
  children,
  className = "",
}: RoomStagePanelProps) {
  return (
    <div
      className={`rounded-[var(--sg-radius-lg)] border border-white/[0.08] bg-white/[0.04] p-4 ${className}`}
    >
      {children}
    </div>
  );
}

export function RoomStageSecondaryButton({
  children,
  className = "",
  type = "button",
  ...props
}: RoomStageSecondaryButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex h-9 cursor-pointer items-center justify-center rounded-full border border-white/[0.08] px-4 text-sm font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
