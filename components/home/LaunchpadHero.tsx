"use client";

import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PathCover } from "@/components/learn/PathCover";
import type { HomePrimaryAction } from "@/lib/homeLaunchpad";
import {
  getMissionNextAction,
  getMissionProgressSummary,
  getMissionRepSummary,
} from "@/lib/missionPresentation";
import { getWorldConfig } from "@/lib/worlds";
import type { LearningPath, LearningProgress } from "@/lib/types";

interface LaunchpadHeroProps {
  primaryAction: HomePrimaryAction;
  isLoading: boolean;
  onPrimaryAction: () => void;
  onRoomAction?: () => void;
  previewDetailsVisible?: boolean;
}

export function LaunchpadHero({
  primaryAction,
  isLoading,
  onPrimaryAction,
  onRoomAction,
  previewDetailsVisible = true,
}: LaunchpadHeroProps) {
  const compactPreview = !previewDetailsVisible;
  const heroWorld = getWorldConfig("default");
  const heroMission = primaryAction.mission;
  const heroTitle =
    primaryAction.kind === "empty"
      ? "Start your next rep"
      : (heroMission?.title ?? "Start your next rep");
  const heroEyebrow =
    primaryAction.kind === "active" ? "Active Mission" : "Start Here";

  return (
    <section
      className="relative overflow-hidden rounded-md px-6 py-6 md:px-8 md:py-8"
      style={{
        minHeight: compactPreview
          ? "clamp(320px, 44vh, 420px)"
          : "clamp(340px, 50vh, 500px)",
      }}
    >
      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute inset-0"
          style={{ background: heroWorld.placeholderGradient }}
        />
        {heroWorld.placeholderPattern ? (
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: heroWorld.placeholderPattern,
              backgroundSize: "16px 16px",
            }}
          />
        ) : null}
        <div
          className="absolute inset-0"
          style={{ background: heroWorld.environmentOverlay }}
        />
        <div
          className="absolute -right-8 top-0 h-48 w-48 rounded-full opacity-20 blur-3xl"
          style={{ background: "var(--sg-shell-300)" }}
        />
      </div>

      <div
        className={`relative my-auto grid w-full gap-8 lg:items-center ${
          compactPreview
            ? "lg:grid-cols-[minmax(0,1fr)_minmax(23rem,26rem)] xl:grid-cols-[minmax(0,1fr)_minmax(25rem,28rem)]"
            : "lg:grid-cols-[minmax(0,1fr)_minmax(18rem,28rem)]"
        }`}
      >
        <div className="min-w-0">
          <div className="max-w-[min(100%,42rem)] space-y-5 lg:pr-4">
            {isLoading ? (
              <>
                <HeroHeaderSkeleton />
                <HeroButtonSkeletons />
              </>
            ) : (
              <>
                <div className="space-y-3">
                  <HeroEyebrow>{heroEyebrow}</HeroEyebrow>
                  <h1
                    className="text-3xl leading-[1.05] text-white sm:text-[2.6rem]"
                    style={{
                      fontFamily: "var(--font-display), 'Fraunces', Georgia, serif",
                    }}
                  >
                    {heroTitle}
                  </h1>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Button variant="cta" onClick={onPrimaryAction}>
                    {primaryAction.kind === "active"
                      ? "Resume Mission"
                      : primaryAction.kind === "next"
                        ? "Start Next Rep"
                        : "Browse Missions"}
                  </Button>

                  {primaryAction.kind !== "empty" && onRoomAction ? (
                    <Button
                      variant="outline"
                      className="border-[var(--sg-shell-400)] text-white hover:border-[var(--sg-white)] hover:bg-transparent hover:text-white"
                      onClick={onRoomAction}
                    >
                      Start Coworking
                    </Button>
                  ) : null}
                </div>
              </>
            )}
          </div>
        </div>

        <div
          className={
            previewDetailsVisible
              ? "lg:ml-auto"
              : "w-full lg:ml-auto lg:max-w-[28rem]"
          }
        >
          {isLoading ? (
            <HeroPreviewSkeleton
              previewDetailsVisible={previewDetailsVisible}
              compactPreview={compactPreview}
            />
          ) : heroMission ? (
            <HeroMissionPreviewCard
              path={heroMission}
              progress={primaryAction.progress}
              badgeLabel={
                primaryAction.kind === "active" ? "Resume" : "Next Rep"
              }
              supportLine={
                primaryAction.kind === "active" && primaryAction.progress
                  ? getMissionNextAction(heroMission, primaryAction.progress)
                  : (primaryAction.recommendation?.explanation ?? null)
              }
              onOpen={onPrimaryAction}
              previewDetailsVisible={previewDetailsVisible}
              compactPreview={compactPreview}
            />
          ) : (
            <HeroEmptyStateCard />
          )}
        </div>
      </div>
    </section>
  );
}

function HeroHeaderSkeleton() {
  return (
    <div className="space-y-3">
      <div
        className="h-3 w-28 animate-pulse rounded-full"
        style={{
          background: "color-mix(in srgb, var(--sg-white) 18%, transparent)",
        }}
      />
      <div className="space-y-2">
        <div
          className="h-11 w-full max-w-[34rem] animate-pulse rounded-full"
          style={{
            background: "color-mix(in srgb, var(--sg-white) 14%, transparent)",
          }}
        />
        <div
          className="h-11 w-full max-w-[26rem] animate-pulse rounded-full"
          style={{
            background: "color-mix(in srgb, var(--sg-white) 12%, transparent)",
          }}
        />
      </div>
    </div>
  );
}

function HeroButtonSkeletons() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div
        className="h-14 w-56 animate-pulse rounded-[var(--sg-radius-btn)]"
        style={{
          background: "color-mix(in srgb, var(--sg-white) 14%, transparent)",
        }}
      />
      <div
        className="h-14 w-52 animate-pulse rounded-[var(--sg-radius-btn)]"
        style={{
          background: "color-mix(in srgb, var(--sg-white) 10%, transparent)",
          border: "1px solid color-mix(in srgb, var(--sg-white) 12%, transparent)",
        }}
      />
    </div>
  );
}

function HeroMissionPreviewCard({
  path,
  progress,
  badgeLabel,
  supportLine,
  onOpen,
  previewDetailsVisible,
  compactPreview,
}: {
  path: LearningPath;
  progress?: LearningProgress | null;
  badgeLabel: string;
  supportLine: string | null;
  onOpen: () => void;
  previewDetailsVisible: boolean;
  compactPreview: boolean;
}) {
  const progressLine = progress
    ? getMissionProgressSummary(progress)
    : getMissionRepSummary(path);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group/resume block w-full cursor-pointer text-left transition-colors focus:outline-none"
      aria-label={`${badgeLabel} ${path.title}`}
    >
      <div
        className="relative w-full overflow-hidden rounded-md border transition-all duration-200"
        style={{
          borderColor: "color-mix(in srgb, var(--sg-white) 12%, transparent)",
          boxShadow: "var(--sg-shadow-dark-sm)",
        }}
      >
        <PathCover
          path={path}
          height={
            compactPreview
              ? "h-[230px] sm:h-[245px] lg:h-[270px]"
              : "h-[240px]"
          }
          sizes={
            compactPreview
              ? "(max-width: 1024px) 100vw, 28rem"
              : "(max-width: 1024px) 100vw, 28rem"
          }
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(to top, color-mix(in srgb, var(--sg-forest-900) 88%, transparent) 0%, transparent 72%)",
          }}
        />
        {previewDetailsVisible ? (
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 px-4 py-3">
            <span
              className="rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]"
              style={{
                background:
                  "color-mix(in srgb, var(--sg-white) 12%, transparent)",
                color: "var(--sg-white)",
              }}
            >
              {badgeLabel}
            </span>
            <span className="text-xs font-medium text-white/75">
              {progressLine}
            </span>
          </div>
        ) : null}
      </div>

      {previewDetailsVisible ? (
        <div className="flex items-start gap-3 px-1 pt-2.5">
          <div className="min-w-0 flex-1 space-y-1">
            <h2 className="line-clamp-2 text-base font-semibold leading-snug text-white">
              {path.title}
            </h2>
            {supportLine ? (
              <p className="line-clamp-2 text-xs leading-5 text-white/58">
                {supportLine}
              </p>
            ) : null}
          </div>
          <span className="mt-0.5 inline-flex shrink-0 items-center gap-1 text-xs font-medium text-white/62 transition-transform duration-150 group-hover/resume:translate-x-0.5">
            Open
            <ArrowRight size={14} strokeWidth={1.9} />
          </span>
        </div>
      ) : null}
    </button>
  );
}

function HeroPreviewSkeleton({
  previewDetailsVisible,
  compactPreview = false,
}: {
  previewDetailsVisible: boolean;
  compactPreview?: boolean;
}) {
  return (
    <div className="w-full animate-pulse">
      <div
        className={`rounded-md border ${
          compactPreview
            ? "h-[230px] sm:h-[245px] lg:h-[270px]"
            : "h-[240px]"
        }`}
        style={{
          borderColor: "color-mix(in srgb, var(--sg-white) 12%, transparent)",
          background: "color-mix(in srgb, var(--sg-white) 8%, transparent)",
        }}
      />
      {previewDetailsVisible ? (
        <div className="space-y-2 px-1 pt-3">
          <div
            className="h-4 w-3/4 rounded-full"
            style={{
              background: "color-mix(in srgb, var(--sg-white) 14%, transparent)",
            }}
          />
          <div
            className="h-3 w-1/2 rounded-full"
            style={{
              background: "color-mix(in srgb, var(--sg-white) 10%, transparent)",
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

function HeroEmptyStateCard() {
  return (
    <div
      className="rounded-md border px-5 py-5"
      style={{
        borderColor: "color-mix(in srgb, var(--sg-white) 12%, transparent)",
        background: "color-mix(in srgb, var(--sg-white) 8%, transparent)",
      }}
    >
      <div className="space-y-2">
        <p className="text-sm font-semibold text-white">
          No mission surfaced yet
        </p>
        <p className="text-sm leading-6 text-white/65">
          Open Missions to search by workflow, deliverable, or next rep.
        </p>
      </div>
    </div>
  );
}

function HeroEyebrow({ children }: { children: string }) {
  return (
    <p
      className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/65"
      style={{ letterSpacing: "0.2em" }}
    >
      {children}
    </p>
  );
}
