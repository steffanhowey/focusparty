"use client";

import { FileStack } from "lucide-react";
import { useRouter } from "next/navigation";
import { EvidenceArchiveCard } from "@/components/progress/EvidenceArchiveCard";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { MISSIONS_ROUTE } from "@/lib/appRoutes";
import type { ProfileAchievement } from "@/lib/useSkillProfile";

interface EvidenceArchiveProps {
  achievements: ProfileAchievement[];
  isLoading?: boolean;
  error?: string | null;
}

function ArchiveSkeleton() {
  return (
    <section className="space-y-4">
      <div className="space-y-2">
        <div className="h-4 w-24 animate-pulse rounded-full bg-[var(--sg-shell-100)]" />
        <div className="h-8 w-64 animate-pulse rounded-full bg-[var(--sg-shell-100)]" />
        <div className="h-4 w-full max-w-2xl animate-pulse rounded-full bg-[var(--sg-shell-100)]" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index} className="overflow-hidden">
            <div className="grid gap-0 md:grid-cols-[minmax(14rem,18rem)_minmax(0,1fr)]">
              <div className="h-40 animate-pulse bg-[var(--sg-shell-50)]" />
              <div className="space-y-3 p-4 sm:p-5">
                <div className="h-4 w-28 animate-pulse rounded-full bg-[var(--sg-shell-100)]" />
                <div className="h-7 w-full max-w-md animate-pulse rounded-full bg-[var(--sg-shell-100)]" />
                <div className="h-4 w-full animate-pulse rounded-full bg-[var(--sg-shell-100)]" />
                <div className="h-4 w-2/3 animate-pulse rounded-full bg-[var(--sg-shell-100)]" />
              </div>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}

function EmptyArchiveVisual() {
  return (
    <div
      className="relative min-h-[220px] overflow-hidden border-b border-[var(--sg-shell-border)] bg-[var(--sg-shell-50)] p-5 sm:min-h-[250px] sm:p-6 lg:border-b-0 lg:border-r"
      style={{
        background:
          "linear-gradient(135deg, color-mix(in srgb, var(--sg-white) 84%, var(--sg-teal-100) 16%) 0%, color-mix(in srgb, var(--sg-white) 94%, var(--sg-sage-100) 6%) 100%)",
      }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(color-mix(in srgb, var(--sg-shell-300) 20%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in srgb, var(--sg-shell-300) 18%, transparent) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
          opacity: 0.3,
        }}
      />

      <div className="relative flex h-full flex-col justify-between gap-5">
        <div
          className="inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--sg-teal-500)]"
          style={{
            background:
              "color-mix(in srgb, var(--sg-white) 72%, var(--sg-teal-100) 28%)",
          }}
        >
          <FileStack size={12} />
          Work archive
        </div>

        <div className="space-y-3">
          <p
            className="text-[1.7rem] font-semibold leading-[1.05] text-[var(--sg-shell-900)]"
            style={{
              fontFamily: "var(--font-display), 'Fraunces', Georgia, serif",
            }}
          >
            Completed work will collect here
          </p>
          <p className="max-w-xl text-sm leading-6 text-[var(--sg-shell-600)]">
            Each finished mission becomes durable work you can revisit and
            share.
          </p>
        </div>
      </div>
    </div>
  );
}

export function EvidenceArchive({
  achievements,
  isLoading = false,
  error = null,
}: EvidenceArchiveProps) {
  const router = useRouter();

  if (isLoading && achievements.length === 0) {
    return <ArchiveSkeleton />;
  }

  if (error) {
    return (
      <Card className="p-6">
        <div className="space-y-2">
          <p className="text-sm font-semibold text-[var(--sg-shell-900)]">
            We couldn&apos;t load the work archive.
          </p>
          <p className="text-sm leading-6 text-[var(--sg-shell-500)]">
            {error}
          </p>
        </div>
      </Card>
    );
  }

  if (achievements.length === 0) {
    return (
      <Card className="overflow-hidden">
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1.02fr)_minmax(22rem,0.98fr)]">
          <EmptyArchiveVisual />

          <div className="flex h-full flex-col justify-center p-6 sm:p-7">
            <div className="max-w-xl space-y-4">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--sg-shell-500)]">
                <FileStack size={13} className="text-[var(--sg-forest-500)]" />
                Work
              </div>
              <div className="space-y-2">
                <p className="text-lg font-semibold text-[var(--sg-shell-900)]">
                  Your work archive will start with the first completed mission.
                </p>
                <p className="text-sm leading-6 text-[var(--sg-shell-500)]">
                  Capability grows from finished work. Once you complete a
                  mission, the completed work will land here as part of your
                  record.
                </p>
              </div>
              <Button onClick={() => router.push(MISSIONS_ROUTE)}>
                Start a mission
              </Button>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <section className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--sg-shell-500)]">
          <FileStack size={13} className="text-[var(--sg-forest-500)]" />
          Work
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <h2 className="text-2xl font-semibold text-[var(--sg-shell-900)]">
              Completed work
            </h2>
            <p className="text-sm leading-6 text-[var(--sg-shell-500)]">
              Finished missions, newest first.
            </p>
          </div>

          <div className="inline-flex w-fit items-center rounded-full border border-[var(--sg-shell-border)] bg-[var(--sg-shell-50)] px-3 py-1 text-xs font-medium text-[var(--sg-shell-600)]">
            {achievements.length}{" "}
            {achievements.length === 1 ? "item" : "items"}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {achievements.map((achievement) => (
          <EvidenceArchiveCard key={achievement.id} achievement={achievement} />
        ))}
      </div>
    </section>
  );
}
