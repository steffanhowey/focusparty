"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Award, Compass, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ContinueLearning } from "@/components/learn/ContinueLearning";
import { SkillRecommendations } from "@/components/learn/SkillRecommendations";
import { RoomCard } from "@/components/party/RoomCard";
import { MyQueueBoard } from "@/components/missions/MyQueueBoard";
import { useLearnSearch } from "@/lib/useLearnSearch";
import { useSkillRecommendations } from "@/lib/useSkillRecommendations";
import { useDiscoverableParties } from "@/lib/useDiscoverableParties";
import { useSkillProfile } from "@/lib/useSkillProfile";
import { getRoomRoute } from "@/lib/appRoutes";

function getLevelUpCount(skillReceipt: { skills: Array<{ leveled_up: boolean }> } | null): number {
  if (!skillReceipt) return 0;
  return skillReceipt.skills.filter((skill) => skill.leveled_up).length;
}

export function HomePage() {
  const router = useRouter();
  const { inProgressPaths, discoveryPaths, isLoading: learnLoading } = useLearnSearch();
  const { recommendations } = useSkillRecommendations();
  const { parties, loading: roomsLoading } = useDiscoverableParties();
  const { summary, achievements } = useSkillProfile();

  const featuredRecommendations = recommendations.slice(0, 3);
  const fallbackPaths = discoveryPaths.slice(0, 3);
  const roomPreview = useMemo(
    () => parties.filter((party) => party.persistent).slice(0, 3),
    [parties],
  );
  const queuePaths = useMemo(() => {
    const seen = new Set<string>();
    return [...inProgressPaths.map((entry) => entry.path), ...discoveryPaths].filter(
      (path) => {
        if (seen.has(path.id)) return false;
        seen.add(path.id);
        return true;
      },
    );
  }, [discoveryPaths, inProgressPaths]);
  const latestOutcome = achievements[0] ?? null;
  const levelUps = getLevelUpCount(latestOutcome?.skill_receipt ?? null);

  return (
    <div className="space-y-8">
      <section className="rounded-[var(--sg-radius-xl)] border border-shell-border bg-white p-6 shadow-sm sm:p-8">
        <div className="max-w-2xl space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-forest-500">
            Home
          </p>
          <div className="space-y-2">
            <h1
              className="text-3xl leading-[1.05] text-shell-900 sm:text-[2.6rem]"
              style={{
                fontFamily: "var(--font-display), 'Fraunces', Georgia, serif",
              }}
            >
              Your next best rep starts here.
            </h1>
            <p className="text-sm leading-6 text-shell-600 sm:text-base">
              Pick up an active mission, save the next one to your queue, or step into a room when you want shared momentum.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="cta" onClick={() => router.push("/missions")}>
              Open Missions
            </Button>
            <Button variant="outline" onClick={() => router.push("/rooms")}>
              Browse Rooms
            </Button>
          </div>
        </div>
      </section>

      {inProgressPaths.length > 0 ? (
        <ContinueLearning
          paths={inProgressPaths}
          title="Active Missions"
          linkHref="/progress"
          linkLabel="Open progress"
        />
      ) : !learnLoading && featuredRecommendations.length === 0 && fallbackPaths.length > 0 ? (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Compass size={14} className="text-shell-500" />
            <h2 className="text-sm font-semibold text-shell-600">
              Pick your first mission
            </h2>
          </div>
          <div className="rounded-[var(--sg-radius-xl)] border border-shell-border bg-shell-50 px-4 py-5 text-sm text-shell-600">
            Start with a guided mission, then bring that work into a room when you want momentum around it.
          </div>
        </section>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.15fr,0.85fr]">
        <MyQueueBoard
          compact
          availablePaths={queuePaths}
          activeMissions={inProgressPaths}
          completedEvidence={achievements}
        />

        <Card className="p-5">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <TrendingUp size={14} className="text-shell-500" />
              <h2 className="text-sm font-semibold text-shell-600">
                Recent Progress
              </h2>
            </div>

            {summary ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-[var(--sg-radius-lg)] bg-shell-50 p-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-shell-500">
                    Skills Started
                  </p>
                  <p className="mt-1 text-xl font-semibold text-shell-900">
                    {summary.total_skills_started}
                  </p>
                </div>
                <div className="rounded-[var(--sg-radius-lg)] bg-shell-50 p-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-shell-500">
                    Completed
                  </p>
                  <p className="mt-1 text-xl font-semibold text-shell-900">
                    {summary.total_paths_completed}
                  </p>
                </div>
              </div>
            ) : (
              <div className="rounded-[var(--sg-radius-lg)] bg-shell-50 px-4 py-5 text-sm text-shell-600">
                Finish your first mission to start a visible capability record.
              </div>
            )}

            {latestOutcome ? (
              <div className="rounded-[var(--sg-radius-lg)] border border-shell-border bg-white p-4">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-forest-500">
                  <Award size={12} />
                  Latest Outcome
                </div>
                <p className="mt-2 text-sm font-medium text-shell-900">
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

            <Button variant="outline" onClick={() => router.push("/progress")}>
              Open Progress
            </Button>
          </div>
        </Card>
      </div>

      {featuredRecommendations.length > 0 && (
        <SkillRecommendations
          recommendations={featuredRecommendations}
          title="Next Best Reps"
        />
      )}

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-shell-900">
              Rooms Right Now
            </h2>
            <p className="text-sm text-shell-500">
              Bring a mission with you or start one once you get inside.
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => router.push("/rooms")}>
            All Rooms
          </Button>
        </div>

        {roomsLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-shell-300 border-t-forest-500" />
          </div>
        ) : roomPreview.length > 0 ? (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {roomPreview.map((party) => (
              <RoomCard
                key={party.id}
                party={party}
                onClick={() => router.push(getRoomRoute(party.id))}
              />
            ))}
          </div>
        ) : (
          <Card className="p-5 text-sm text-shell-500">
            No rooms are open right now.
          </Card>
        )}
      </section>
    </div>
  );
}
