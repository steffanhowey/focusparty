"use client";

import { ArrowRight, CheckCircle2, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AchievementShareMenu } from "@/components/achievements/AchievementShareMenu";
import { EvidencePreview } from "@/components/progress/EvidencePreview";
import { EvidenceStrengthenedSummary } from "@/components/progress/EvidenceStrengthenedSummary";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { getProgressEvidenceRoute, MISSIONS_ROUTE } from "@/lib/appRoutes";
import {
  formatEvidenceDate,
  formatEvidenceDuration,
  getEvidenceSummary,
} from "@/lib/evidencePresentation";
import type { ProfileAchievement } from "@/lib/useSkillProfile";

interface FeaturedEvidenceSectionProps {
  featuredAchievement: ProfileAchievement | null;
  secondaryAchievements: ProfileAchievement[];
  isLoading?: boolean;
  onOpenEvidenceArchive: () => void;
}

function EvidenceSkeleton() {
  return (
    <section className="space-y-4">
      <div className="space-y-2">
        <div className="h-5 w-40 animate-pulse rounded-full bg-[var(--sg-shell-100)]" />
        <div className="h-4 w-full max-w-2xl animate-pulse rounded-full bg-[var(--sg-shell-100)]" />
      </div>

      <Card className="overflow-hidden">
        <div className="grid gap-0 xl:grid-cols-[minmax(0,1.08fr)_minmax(22rem,0.92fr)]">
          <div className="min-h-[280px] animate-pulse bg-[var(--sg-shell-50)]" />
          <div className="space-y-4 p-5 sm:p-6">
            <div className="h-4 w-32 animate-pulse rounded-full bg-[var(--sg-shell-100)]" />
            <div className="h-8 w-full max-w-xl animate-pulse rounded-full bg-[var(--sg-shell-100)]" />
            <div className="h-4 w-full animate-pulse rounded-full bg-[var(--sg-shell-100)]" />
            <div className="h-4 w-full max-w-lg animate-pulse rounded-full bg-[var(--sg-shell-100)]" />
            <div className="flex gap-2">
              <div className="h-9 w-24 animate-pulse rounded-full bg-[var(--sg-shell-100)]" />
              <div className="h-9 w-20 animate-pulse rounded-full bg-[var(--sg-shell-100)]" />
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Card key={index} className="overflow-hidden">
            <div className="h-36 animate-pulse bg-[var(--sg-shell-50)]" />
            <div className="space-y-3 p-4">
              <div className="h-4 w-24 animate-pulse rounded-full bg-[var(--sg-shell-100)]" />
              <div className="h-6 w-full animate-pulse rounded-full bg-[var(--sg-shell-100)]" />
              <div className="h-4 w-full animate-pulse rounded-full bg-[var(--sg-shell-100)]" />
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}

function EmptyEvidenceVisual() {
  return (
    <div
      className="relative min-h-[240px] overflow-hidden border-b border-[var(--sg-shell-border)] bg-[var(--sg-shell-50)] p-5 sm:min-h-[280px] sm:p-6 lg:border-b-0 lg:border-r"
      style={{
        background:
          "linear-gradient(135deg, color-mix(in srgb, var(--sg-white) 82%, var(--sg-sage-100) 18%) 0%, color-mix(in srgb, var(--sg-white) 92%, var(--sg-cream-50) 8%) 100%)",
      }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(color-mix(in srgb, var(--sg-shell-300) 20%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in srgb, var(--sg-shell-300) 18%, transparent) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
          opacity: 0.35,
        }}
      />
      <div className="relative flex h-full flex-col justify-between gap-5">
        <div
          className="inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--sg-forest-500)]"
          style={{
            background:
              "color-mix(in srgb, var(--sg-white) 70%, var(--sg-sage-100) 30%)",
          }}
        >
          <CheckCircle2 size={12} />
          Proof of work
        </div>

        <div className="space-y-3">
          <p
            className="text-[1.9rem] font-semibold leading-[1.02] text-[var(--sg-shell-900)]"
            style={{
              fontFamily: "var(--font-display), 'Fraunces', Georgia, serif",
            }}
          >
            Your next finished piece lives here
          </p>
          <p className="max-w-xl text-sm leading-6 text-[var(--sg-shell-600)]">
            Completed mission work turns into visible proof on your profile.
          </p>
        </div>

        <div className="pointer-events-none absolute right-5 top-5 hidden h-32 w-36 sm:block">
          <div
            className="absolute right-1 top-0 h-[62%] w-[72%] rounded-[1rem] border rotate-[6deg]"
            style={{
              background:
                "color-mix(in srgb, var(--sg-white) 82%, transparent)",
              borderColor:
                "color-mix(in srgb, var(--sg-shell-border) 76%, transparent)",
            }}
          />
          <div
            className="absolute right-6 top-3 h-[68%] w-[76%] rounded-[1rem] border -rotate-[4deg]"
            style={{
              background:
                "color-mix(in srgb, var(--sg-white) 88%, transparent)",
              borderColor:
                "color-mix(in srgb, var(--sg-shell-border) 72%, transparent)",
            }}
          />
          <div
            className="absolute bottom-0 left-0 h-[70%] w-[82%] rounded-[1rem] border"
            style={{
              background:
                "color-mix(in srgb, var(--sg-white) 94%, transparent)",
              borderColor:
                "color-mix(in srgb, var(--sg-shell-border) 82%, transparent)",
            }}
          >
            <div className="space-y-2 px-3 py-3">
              <div className="h-2 rounded-full bg-[var(--sg-forest-500)] opacity-80" />
              <div
                className="h-2 w-4/5 rounded-full"
                style={{
                  background:
                    "color-mix(in srgb, var(--sg-shell-500) 24%, transparent)",
                }}
              />
              <div
                className="h-2 w-3/5 rounded-full"
                style={{
                  background:
                    "color-mix(in srgb, var(--sg-shell-500) 18%, transparent)",
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SecondaryEvidenceCard({
  achievement,
}: {
  achievement: ProfileAchievement;
}) {
  const viewHref = achievement.share_slug
    ? getProgressEvidenceRoute(achievement.share_slug)
    : null;

  return (
    <Card className="overflow-hidden">
      <EvidencePreview
        achievement={achievement}
        receipt={achievement.skill_receipt}
        compact
        className="rounded-none border-0 border-b"
      />

      <div className="space-y-3 p-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--sg-shell-500)]">
            Work item
          </div>
          <h3 className="text-lg font-semibold leading-snug text-[var(--sg-shell-900)]">
            {achievement.path_title}
          </h3>
        </div>

        <p className="text-sm leading-6 text-[var(--sg-shell-600)]">
          {getEvidenceSummary(achievement, achievement.skill_receipt, true)}
        </p>

        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--sg-shell-500)]">
          <span>
            {formatEvidenceDate(achievement.completed_at)} •{" "}
            {formatEvidenceDuration(achievement.time_invested_seconds)}
          </span>
          {viewHref ? (
            <Link
              href={viewHref}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--sg-forest-500)] transition-colors hover:text-[var(--sg-shell-900)]"
            >
              View work
              <ArrowRight size={14} />
            </Link>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

export function FeaturedEvidenceSection({
  featuredAchievement,
  secondaryAchievements,
  isLoading = false,
  onOpenEvidenceArchive,
}: FeaturedEvidenceSectionProps) {
  const router = useRouter();

  if (isLoading && !featuredAchievement) {
    return <EvidenceSkeleton />;
  }

  if (!featuredAchievement) {
    return (
      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold text-[var(--sg-shell-900)]">
            Featured Work
          </h2>
          <p className="text-sm leading-6 text-[var(--sg-shell-500)]">
            Completed work should be the clearest proof on the profile.
          </p>
        </div>

        <Card className="overflow-hidden">
          <div className="grid gap-0 lg:grid-cols-[minmax(0,1.05fr)_minmax(22rem,0.95fr)]">
            <EmptyEvidenceVisual />

            <div className="flex h-full flex-col justify-center p-6 sm:p-7">
              <div className="max-w-xl space-y-4">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--sg-shell-500)]">
                  <CheckCircle2
                    size={13}
                    className="text-[var(--sg-forest-500)]"
                  />
                  First work
                </div>
                <div className="space-y-2">
                  <p className="text-lg font-semibold text-[var(--sg-shell-900)]">
                    Finish a mission to start building visible work.
                  </p>
                  <p className="text-sm leading-6 text-[var(--sg-shell-500)]">
                    Completed work becomes the strongest signal on this profile.
                    Your first finished piece will anchor this section here.
                  </p>
                </div>
                <Button onClick={() => router.push(MISSIONS_ROUTE)}>
                  Start a mission
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </section>
    );
  }

  const viewHref = featuredAchievement.share_slug
    ? getProgressEvidenceRoute(featuredAchievement.share_slug)
    : null;

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold text-[var(--sg-shell-900)]">
          Featured Work
        </h2>
        <p className="text-sm leading-6 text-[var(--sg-shell-500)]">
          Completed work should be the center of gravity of the profile.
        </p>
      </div>

      <div className="space-y-5">
        <Card
          className="overflow-hidden"
          style={{
            borderColor:
              "color-mix(in srgb, var(--sg-forest-500) 18%, var(--sg-shell-border) 82%)",
            boxShadow: "var(--shadow-float)",
          }}
        >
          <div className="grid gap-0 xl:grid-cols-[minmax(0,1.08fr)_minmax(22rem,0.92fr)]">
            <EvidencePreview
              achievement={featuredAchievement}
              receipt={featuredAchievement.skill_receipt}
              className="rounded-none border-0 border-b xl:border-b-0 xl:border-r xl:min-h-[360px]"
            />

            <div className="flex h-full flex-col justify-between gap-5 p-5 sm:p-6">
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--sg-shell-500)]">
                  <CheckCircle2
                    size={13}
                    className="text-[var(--sg-forest-500)]"
                  />
                  Featured work
                </div>

                <div className="space-y-2">
                  <h3 className="text-2xl font-semibold leading-tight text-[var(--sg-shell-900)] sm:text-[2rem]">
                    {featuredAchievement.path_title}
                  </h3>
                  <p className="text-base leading-7 text-[var(--sg-shell-600)]">
                    {getEvidenceSummary(
                      featuredAchievement,
                      featuredAchievement.skill_receipt,
                    )}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[var(--sg-shell-500)]">
                  <span>{formatEvidenceDate(featuredAchievement.completed_at)}</span>
                  <span className="text-[var(--sg-shell-300)]">•</span>
                  <span>
                    {featuredAchievement.items_completed}{" "}
                    {featuredAchievement.items_completed === 1
                      ? "step"
                      : "steps"}
                  </span>
                  <span className="text-[var(--sg-shell-300)]">•</span>
                  <span>
                    {formatEvidenceDuration(
                      featuredAchievement.time_invested_seconds,
                    )}
                  </span>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  {viewHref ? (
                    <Link
                      href={viewHref}
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--sg-forest-500)] transition-colors hover:text-[var(--sg-shell-900)]"
                    >
                      View work
                      <ExternalLink size={14} />
                    </Link>
                  ) : null}

                  {featuredAchievement.share_slug ? (
                    <AchievementShareMenu
                      shareSlug={featuredAchievement.share_slug}
                      pathTitle={featuredAchievement.path_title}
                      pathTopics={featuredAchievement.path_topics}
                      buttonLabel="Share"
                      buttonVariant="outline"
                      buttonSize="sm"
                      menuAlign="right"
                    />
                  ) : null}
                </div>

                <div className="rounded-[var(--sg-radius-lg)] border border-[var(--sg-shell-border)] bg-[var(--sg-shell-50)] px-4 py-4">
                  <EvidenceStrengthenedSummary
                    receipt={featuredAchievement.skill_receipt}
                    compact
                  />
                </div>
              </div>
            </div>
          </div>
        </Card>

        {secondaryAchievements.length > 0 ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--sg-shell-500)]">
              <CheckCircle2
                size={13}
                className="text-[var(--sg-forest-500)]"
              />
              More work
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {secondaryAchievements.map((achievement) => (
                <SecondaryEvidenceCard
                  key={achievement.id}
                  achievement={achievement}
                />
              ))}
            </div>
          </div>
        ) : (
          <Card className="p-4 sm:p-5">
            <div className="space-y-2">
              <p className="text-sm font-medium text-[var(--sg-shell-900)]">
                Your work archive starts with this piece.
              </p>
              <p className="text-sm leading-6 text-[var(--sg-shell-500)]">
                More completed work will collect here as you finish missions and
                add to the profile.
              </p>
            </div>
          </Card>
        )}

        <div className="flex justify-start">
          <Button
            variant="link"
            rightIcon={<ArrowRight size={14} />}
            onClick={onOpenEvidenceArchive}
          >
            See all work
          </Button>
        </div>
      </div>
    </section>
  );
}
