"use client";

import { Settings2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

interface ProfileHeaderProps {
  displayName: string;
  username: string | null;
  avatarUrl: string | null;
  functionLabel: string | null;
  capabilityLine: string;
  focusedNowLine: string;
  isLoading?: boolean;
}

function HeaderSkeleton() {
  return (
    <Card className="overflow-hidden">
      <div className="relative px-6 py-6 sm:px-8 sm:py-7">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-1 items-start gap-4">
            <div className="h-20 w-20 animate-pulse rounded-full bg-[var(--sg-shell-100)]" />
            <div className="min-w-0 flex-1 space-y-3">
              <div className="h-9 w-52 animate-pulse rounded-full bg-[var(--sg-shell-100)]" />
              <div className="h-5 w-32 animate-pulse rounded-full bg-[var(--sg-shell-100)]" />
              <div className="h-5 w-full max-w-xl animate-pulse rounded-full bg-[var(--sg-shell-100)]" />
              <div className="h-5 w-full max-w-lg animate-pulse rounded-full bg-[var(--sg-shell-100)]" />
            </div>
          </div>
          <div className="h-10 w-32 animate-pulse rounded-[var(--sg-radius-btn)] bg-[var(--sg-shell-100)]" />
        </div>
      </div>
    </Card>
  );
}

export function ProfileHeader({
  displayName,
  username,
  avatarUrl,
  functionLabel,
  capabilityLine,
  focusedNowLine,
  isLoading = false,
}: ProfileHeaderProps) {
  const router = useRouter();

  if (isLoading && !displayName) {
    return <HeaderSkeleton />;
  }

  return (
    <Card className="overflow-hidden">
      <div className="relative">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(135deg, color-mix(in srgb, var(--sg-white) 86%, var(--sg-cream-50) 14%) 0%, color-mix(in srgb, var(--sg-white) 72%, var(--sg-sage-100) 28%) 100%)",
          }}
        />
        <div
          className="pointer-events-none absolute -right-10 top-0 h-40 w-40 rounded-full blur-3xl"
          style={{
            background:
              "radial-gradient(circle, color-mix(in srgb, var(--sg-teal-100) 75%, transparent) 0%, transparent 72%)",
          }}
        />

        <div className="relative px-6 py-6 sm:px-8 sm:py-7">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1 space-y-5">
              <div className="flex items-start gap-4">
                <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full border border-[var(--sg-shell-border)] bg-[var(--sg-shell-100)]">
                  {avatarUrl ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={avatarUrl}
                        alt={`${displayName} avatar`}
                        className="h-full w-full object-cover"
                      />
                    </>
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-2xl font-semibold text-[var(--sg-shell-600)]">
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1 space-y-3">
                  <div className="space-y-1">
                    <h1
                      className="text-3xl leading-[1.02] text-[var(--sg-shell-900)] sm:text-[2.6rem]"
                      style={{
                        fontFamily:
                          "var(--font-display), 'Fraunces', Georgia, serif",
                      }}
                    >
                      {displayName}
                    </h1>
                    {username ? (
                      <p className="text-sm font-medium text-[var(--sg-shell-500)]">
                        @{username}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {functionLabel ? (
                      <span className="inline-flex items-center rounded-full border border-[var(--sg-shell-border)] bg-white px-3 py-1 text-xs font-medium text-[var(--sg-shell-600)]">
                        {functionLabel}
                      </span>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm leading-6 text-[var(--sg-shell-700)]">
                      {capabilityLine}
                    </p>
                    <div className="space-y-1">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--sg-shell-500)]">
                        Focused now
                      </p>
                      <p className="text-sm leading-6 text-[var(--sg-shell-700)]">
                        {focusedNowLine}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="shrink-0">
              <Button
                variant="outline"
                size="sm"
                leftIcon={<Settings2 size={14} />}
                onClick={() => router.push("/settings")}
              >
                Edit profile
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
