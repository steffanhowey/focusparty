"use client";

import { ArrowRight, Target } from "lucide-react";
import { useRouter } from "next/navigation";
import { PathCover } from "@/components/learn/PathCover";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { HomePrimaryAction } from "@/lib/homeLaunchpad";
import {
  getMissionFraming,
  getMissionNextAction,
  getMissionProgressSummary,
  getMissionRepSummary,
} from "@/lib/missionPresentation";
import { getMissionRoute, MISSIONS_ROUTE } from "@/lib/appRoutes";

interface CurrentFocusPanelProps {
  primaryAction: HomePrimaryAction;
  isLoading?: boolean;
}

function FocusSkeleton() {
  return (
    <section className="space-y-4">
      <div className="space-y-2">
        <div className="h-5 w-32 animate-pulse rounded-full bg-[var(--sg-shell-100)]" />
        <div className="h-4 w-full max-w-xl animate-pulse rounded-full bg-[var(--sg-shell-100)]" />
      </div>

      <Card className="overflow-hidden p-6">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_14rem]">
          <div className="space-y-4">
            <div className="h-4 w-24 animate-pulse rounded-full bg-[var(--sg-shell-100)]" />
            <div className="h-8 w-full max-w-lg animate-pulse rounded-full bg-[var(--sg-shell-100)]" />
            <div className="h-4 w-full animate-pulse rounded-full bg-[var(--sg-shell-100)]" />
            <div className="h-4 w-full max-w-md animate-pulse rounded-full bg-[var(--sg-shell-100)]" />
            <div className="h-10 w-40 animate-pulse rounded-[var(--sg-radius-btn)] bg-[var(--sg-shell-100)]" />
          </div>
          <div className="hidden h-48 animate-pulse rounded-[var(--sg-radius-lg)] bg-[var(--sg-shell-100)] lg:block" />
        </div>
      </Card>
    </section>
  );
}

export function CurrentFocusPanel({
  primaryAction,
  isLoading = false,
}: CurrentFocusPanelProps) {
  const router = useRouter();

  if (isLoading && primaryAction.kind === "empty") {
    return <FocusSkeleton />;
  }

  const primaryMission = primaryAction.mission;
  const isActiveMission = primaryAction.kind === "active";
  const primaryLabel = isActiveMission
    ? "Active mission"
    : primaryAction.kind === "next"
      ? "Next rep"
      : "Current focus";
  const primaryButtonLabel = isActiveMission
    ? "Resume Mission"
    : primaryAction.kind === "next"
      ? "Start Next Rep"
      : "Browse Missions";
  const primarySummary =
    primaryMission && primaryAction.progress
      ? getMissionProgressSummary(primaryAction.progress)
      : primaryMission
        ? getMissionRepSummary(primaryMission)
        : "Choose the next mission to keep the profile moving.";
  const primaryContext =
    primaryMission && isActiveMission
      ? getMissionNextAction(primaryMission, primaryAction.progress)
      : primaryAction.recommendation?.explanation ??
        (primaryMission ? getMissionFraming(primaryMission) : null);

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold text-[var(--sg-shell-900)]">
          Current Focus
        </h2>
        <p className="text-sm leading-6 text-[var(--sg-shell-500)]">
          One clear next step to keep moving.
        </p>
      </div>

      <Card className="overflow-hidden">
        <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_14rem] lg:items-center">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--sg-shell-50)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--sg-shell-500)]">
                <Target
                  size={12}
                  className="text-[var(--sg-forest-500)]"
                />
                {primaryLabel}
              </span>
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-semibold text-[var(--sg-shell-900)]">
                {primaryMission?.title ?? "Start your next mission"}
              </h3>
              <p className="text-sm font-medium text-[var(--sg-shell-600)]">
                {primarySummary}
              </p>
              {primaryContext ? (
                <p className="text-sm leading-6 text-[var(--sg-shell-500)]">
                  <span className="font-medium text-[var(--sg-shell-900)]">
                    {isActiveMission ? "Next action" : "Why this next"}
                  </span>{" "}
                  <span>{primaryContext}</span>
                </p>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                rightIcon={<ArrowRight size={14} />}
                onClick={() =>
                  router.push(
                    primaryMission
                      ? getMissionRoute(primaryMission.id)
                      : MISSIONS_ROUTE,
                  )
                }
              >
                {primaryButtonLabel}
              </Button>
            </div>
          </div>

          {primaryMission ? (
            <div className="overflow-hidden rounded-[var(--sg-radius-lg)] border border-[var(--sg-shell-border)]">
              <PathCover
                path={primaryMission}
                height="h-44 sm:h-52 lg:h-56"
                sizes="(max-width: 1024px) 100vw, 240px"
              />
            </div>
          ) : null}
        </div>
      </Card>
    </section>
  );
}
