"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, PanelsTopLeft, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PathCover } from "@/components/learn/PathCover";
import { PathCardSkeleton } from "@/components/learn/PathCardSkeleton";
import { MissionCard } from "@/components/missions/MissionCard";
import { RoomCard } from "@/components/party/RoomCard";
import { useLearnSearch } from "@/lib/useLearnSearch";
import { useSkillRecommendations } from "@/lib/useSkillRecommendations";
import { useDiscoverableParties } from "@/lib/useDiscoverableParties";
import { useActiveBackgrounds } from "@/lib/useActiveBackgrounds";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { useSkillProfile } from "@/lib/useSkillProfile";
import { getCanonicalRoomEntryRoute, getMissionRoute } from "@/lib/appRoutes";
import { getMissionBuildsLine } from "@/lib/missionLanguage";
import {
  getMissionCurrentItem,
  getMissionProgressSummary,
} from "@/lib/missionPresentation";
import { getWorldConfig } from "@/lib/worlds";
import type { LearningPath, LearningProgress } from "@/lib/types";

function getLevelUpCount(skillReceipt: { skills: Array<{ leveled_up: boolean }> } | null): number {
  if (!skillReceipt) return 0;
  return skillReceipt.skills.filter((skill) => skill.leveled_up).length;
}

export function HomePage() {
  const router = useRouter();
  const heroWorld = getWorldConfig("default");
  const { displayName } = useCurrentUser();
  const { inProgressPaths, discoveryPaths, isLoading: learnLoading } = useLearnSearch();
  const { recommendations } = useSkillRecommendations();
  const { parties, loading: roomsLoading } = useDiscoverableParties();
  const backgrounds = useActiveBackgrounds();
  const { summary, achievements } = useSkillProfile();

  const activeMission = inProgressPaths[0] ?? null;
  const activePathIds = useMemo(
    () => new Set(inProgressPaths.map((entry) => entry.path.id)),
    [inProgressPaths],
  );
  const completedPathIds = useMemo(
    () => new Set(achievements.map((achievement) => achievement.path_id)),
    [achievements],
  );

  const recommendedPaths = useMemo(() => {
    const seen = new Set<string>();
    const ordered: LearningPath[] = [];

    const pushPath = (path: LearningPath) => {
      if (seen.has(path.id)) return;
      if (activePathIds.has(path.id)) return;
      if (completedPathIds.has(path.id)) return;
      seen.add(path.id);
      ordered.push(path);
    };

    recommendations.forEach((recommendation) => {
      const firstPath = recommendation.paths[0];
      if (firstPath) pushPath(firstPath);
    });

    discoveryPaths.forEach(pushPath);

    return ordered.slice(0, 4);
  }, [activePathIds, completedPathIds, discoveryPaths, recommendations]);

  const startHereMission = !activeMission ? recommendedPaths[0] ?? null : null;

  const nextRepPaths = activeMission
    ? recommendedPaths.slice(0, 2)
    : recommendedPaths.slice(1, 3);

  const latestOutcome = achievements[0] ?? null;
  const levelUps = getLevelUpCount(latestOutcome?.skill_receipt ?? null);
  const heroName = useMemo(() => {
    const trimmedName = displayName.trim();
    if (!trimmedName || trimmedName === "Guest") {
      return null;
    }

    return trimmedName.split(/\s+/)[0] ?? trimmedName;
  }, [displayName]);
  const roomPreview = useMemo(
    () =>
      parties
        .filter((party) => party.persistent)
        .sort((a, b) => b.participant_count - a.participant_count)
        .slice(0, 3),
    [parties],
  );

  return (
    <div className="space-y-6">
      <section
        className="relative grid overflow-hidden rounded-md px-6 py-6 md:px-8 md:py-8"
        style={{ minHeight: "clamp(340px, 50vh, 500px)" }}
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

        <div className="relative my-auto grid w-full gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,30dvw)] lg:items-center">
            <div className="min-w-0">
              <div className="max-w-[min(100%,44rem)] space-y-4 md:space-y-5 lg:pr-4">
                <div className="space-y-3">
                  <h1
                    className="text-3xl leading-[1.05] text-white sm:text-[2.6rem]"
                    style={{
                      fontFamily: "var(--font-display), 'Fraunces', Georgia, serif",
                    }}
                  >
                    {heroName ? `Welcome back, ${heroName}` : "Welcome back"}
                  </h1>
                  <p className="max-w-2xl text-base leading-8 text-white/72">
                    Keep the next rep obvious: resume what is active, start a focused mission, or step into a room when you want shared energy around the work.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Button variant="cta" onClick={() => router.push("/missions")}>
                    Open Missions
                  </Button>
                  <Button
                    variant="outline"
                    className="border-[var(--sg-shell-400)] text-white hover:border-[var(--sg-white)] hover:bg-transparent hover:text-white"
                    onClick={() => router.push("/rooms")}
                  >
                    Open Rooms
                  </Button>
                </div>
              </div>
            </div>

            {activeMission ? (
              <HeroResumeCard
                path={activeMission.path}
                progress={activeMission.progress}
                onOpen={() => router.push(getMissionRoute(activeMission.path.id))}
              />
            ) : null}
          </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr),360px]">
        <div className="space-y-6">
          {!activeMission ? (
            <>
              <SectionHeader
                title="Start Here"
                description="A clear place to begin, without turning Home into a catalog."
              />

              {startHereMission ? (
                <MissionCard
                  path={startHereMission}
                  featured
                />
              ) : learnLoading ? (
                <MissionCardSkeletonGrid count={1} />
              ) : (
                <Card className="p-5">
                  <div className="space-y-3">
                    <h2 className="text-lg font-semibold text-shell-900">
                      No mission surfaced yet
                    </h2>
                    <p className="text-sm leading-6 text-shell-500">
                      Open Missions to search for a workflow or build a custom rep.
                    </p>
                    <Button variant="outline" size="sm" onClick={() => router.push("/missions")}>
                      Browse missions
                    </Button>
                  </div>
                </Card>
              )}
            </>
          ) : null}

          <section className="space-y-3">
            <SectionHeader
              title="Next Rep"
              description="A short list of strong next starts, not a long feed of options."
            />

            {learnLoading ? (
              <MissionCardSkeletonGrid count={2} />
            ) : nextRepPaths.length > 0 ? (
              <div className="grid gap-4 lg:grid-cols-2">
                {nextRepPaths.map((path) => (
                  <MissionCard
                    key={path.id}
                    path={path}
                    compact
                  />
                ))}
              </div>
            ) : (
              <Card className="p-5 text-sm text-shell-500">
                New mission suggestions will show up here as soon as they are ready.
              </Card>
            )}
          </section>
        </div>

        <div className="space-y-6">
          <Card className="p-4">
            <div className="space-y-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm font-semibold text-shell-900">
                  <TrendingUp size={14} className="text-shell-500" />
                  Progress
                </div>
                <p className="text-sm text-shell-500">
                  A quick snapshot of the capability record you are building.
                </p>
              </div>

              {summary ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <StatBlock label="Capabilities started" value={summary.total_skills_started} />
                    <StatBlock label="Missions completed" value={summary.total_paths_completed} />
                  </div>

                  {latestOutcome ? (
                    <div className="rounded-[var(--sg-radius-lg)] bg-shell-50 px-3 py-3">
                      <p className="text-sm font-medium text-shell-900">
                        {latestOutcome.path_title}
                      </p>
                      <p className="mt-1 text-xs text-shell-500">
                        Completed {new Date(latestOutcome.completed_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                        {levelUps > 0 ? ` · ${levelUps} level-up${levelUps > 1 ? "s" : ""}` : ""}
                      </p>
                    </div>
                  ) : null}
                </>
              ) : (
                <p className="text-sm leading-6 text-shell-500">
                  Finish your first mission to start a visible capability record.
                </p>
              )}

              <Button variant="outline" size="sm" onClick={() => router.push("/progress")}>
                Open Progress
              </Button>
            </div>
          </Card>
        </div>
      </div>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-semibold text-shell-900">
              <PanelsTopLeft size={14} className="text-shell-500" />
              Rooms Right Now
            </div>
            <p className="text-sm text-shell-500">
              Step into a room when you want shared momentum around the work.
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => router.push("/rooms")}>
            See all rooms
          </Button>
        </div>

        {roomsLoading ? (
          <Card className="p-4">
            <div className="flex items-center justify-center py-8">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-shell-300 border-t-forest-500" />
            </div>
          </Card>
        ) : roomPreview.length > 0 ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {roomPreview.map((party) => (
              <RoomCard
                key={party.id}
                party={party}
                backgrounds={backgrounds}
                onClick={() => router.push(getCanonicalRoomEntryRoute(party))}
              />
            ))}
          </div>
        ) : (
          <Card className="p-4 text-sm text-shell-500">
            No rooms are open right now.
          </Card>
        )}
      </section>
    </div>
  );
}

function HeroResumeCard({
  path,
  progress,
  onOpen,
}: {
  path: LearningPath;
  progress: LearningProgress;
  onOpen: () => void;
}) {
  const currentItem = getMissionCurrentItem(path, progress);
  const progressSummary = getMissionProgressSummary(progress);
  const supportLine =
    currentItem?.title ??
    getMissionBuildsLine(path, { includeDomain: false }) ??
    progressSummary;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group/resume w-full cursor-pointer text-left transition-colors focus:outline-none lg:ml-auto"
      style={{ maxWidth: "min(100%, 30dvw)" }}
      aria-label={`Resume ${path.title}`}
    >
      <div
        className="relative overflow-hidden rounded-md border transition-all duration-200"
        style={{
          borderColor: "color-mix(in srgb, var(--sg-white) 12%, transparent)",
          boxShadow: "var(--sg-shadow-dark-sm)",
        }}
      >
        <PathCover
          path={path}
          height="h-[176px]"
          sizes="(max-width: 1024px) 100vw, 320px"
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(to top, color-mix(in srgb, var(--sg-forest-900) 88%, transparent) 0%, transparent 72%)",
          }}
        />
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 px-4 py-3">
          <span
            className="rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]"
            style={{
              background: "color-mix(in srgb, var(--sg-white) 12%, transparent)",
              color: "var(--sg-white)",
            }}
          >
            Resume
          </span>
          <span className="text-xs font-medium text-white/75">
            {progressSummary}
          </span>
        </div>
      </div>

      <div className="flex items-start gap-3 px-1 pt-2.5">
        <div className="min-w-0 flex-1 space-y-1">
          <h2 className="line-clamp-2 text-base font-semibold leading-snug text-white">
            {path.title}
          </h2>
          <p className="line-clamp-1 text-xs text-white/58">
            {supportLine}
          </p>
        </div>
        <span className="mt-0.5 inline-flex shrink-0 items-center gap-1 text-xs font-medium text-white/62 transition-transform duration-150 group-hover/resume:translate-x-0.5">
          Open
          <ArrowRight size={14} strokeWidth={1.9} />
        </span>
      </div>
    </button>
  );
}

function SectionHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="space-y-1">
      <h2 className="text-lg font-semibold text-shell-900">
        {title}
      </h2>
      <p className="text-sm text-shell-500">
        {description}
      </p>
    </div>
  );
}

function StatBlock({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-[var(--sg-radius-lg)] bg-shell-50 px-3 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-shell-500">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold text-shell-900">
        {value}
      </p>
    </div>
  );
}

function MissionCardSkeletonGrid({
  count,
}: {
  count: number;
}) {
  return (
    <div className={`grid gap-4 ${count > 1 ? "lg:grid-cols-2" : ""}`}>
      {Array.from({ length: count }).map((_, index) => (
        <PathCardSkeleton key={index} />
      ))}
    </div>
  );
}
