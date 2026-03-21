import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { MissionOutcomeCard } from "@/components/progress/MissionOutcomeCard";
import { SkillReceipt } from "@/components/learn/SkillReceipt";
import { getAchievementPageData } from "@/lib/achievements/getAchievementPageData";
import {
  formatAchievementDate,
  getAchievementHighlightedSkills,
  getSiteUrl,
} from "@/lib/achievements/achievementModel";
import {
  getProgressEvidenceImageRoute,
  getProgressEvidenceRoute,
} from "@/lib/appRoutes";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const data = await getAchievementPageData(id);

  if (!data) {
    return {
      title: "Evidence Not Found — SkillGap",
      robots: { index: false, follow: false },
    };
  }

  const { achievement, user_name } = data;
  const siteUrl = getSiteUrl();
  const pageUrl = `${siteUrl}${getProgressEvidenceRoute(achievement.share_slug)}`;
  const imageUrl = `${siteUrl}${getProgressEvidenceImageRoute(achievement.share_slug)}`;
  const highlightedSkills = getAchievementHighlightedSkills(
    achievement.skill_receipt,
  );
  const description = highlightedSkills.length
    ? `${user_name} completed the mission ${achievement.path_title} on SkillGap. Mission evidence captured in practice. Demonstrated capabilities: ${highlightedSkills.join(", ")}.`
    : `${user_name} completed the mission ${achievement.path_title} on SkillGap. Mission evidence captured in practice from ${achievement.items_completed} completed steps.`;

  return {
    title: `${achievement.path_title} — Mission Evidence`,
    description,
    alternates: {
      canonical: pageUrl,
    },
    openGraph: {
      title: `${achievement.path_title} — Mission Evidence`,
      description,
      type: "article",
      url: pageUrl,
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: `${achievement.path_title} mission evidence`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${achievement.path_title} — Mission Evidence`,
      description,
      images: [imageUrl],
    },
  };
}

export default async function ProgressEvidencePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getAchievementPageData(id);

  if (!data) {
    return (
      <div className="min-h-screen bg-[var(--sg-cream-50)] px-6 py-16">
        <div className="mx-auto flex max-w-xl flex-col items-center justify-center gap-5 rounded-[var(--sg-radius-xl)] border border-[var(--sg-shell-border)] bg-[var(--sg-white)] px-8 py-12 text-center shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--sg-forest-500)]">
            SkillGap
          </p>
          <h1
            className="text-3xl text-[var(--sg-shell-900)]"
            style={{
              fontFamily: "var(--font-display), 'Fraunces', Georgia, serif",
            }}
          >
            Evidence not found
          </h1>
          <p className="max-w-md text-sm leading-6 text-[var(--sg-shell-600)]">
            This evidence link may have expired, been removed, or never existed in the first place.
          </p>
          <Link
            href="/missions"
            className="inline-flex items-center gap-2 rounded-[var(--sg-radius-btn)] bg-[var(--sg-forest-500)] px-5 py-3 text-sm font-semibold text-white transition-all duration-150 hover:opacity-85"
          >
            Start a mission on SkillGap
            <ArrowRight size={15} />
          </Link>
        </div>
      </div>
    );
  }

  const { achievement, user_name } = data;
  const highlightedSkills = getAchievementHighlightedSkills(
    achievement.skill_receipt,
    2,
  );
  const headline = achievement.path_title;
  const subtitle = highlightedSkills.length
    ? `${user_name} completed this mission on ${formatAchievementDate(achievement.completed_at)}. The completed work and demonstrated capability below were captured in practice.`
    : `${user_name} completed this mission on ${formatAchievementDate(achievement.completed_at)}. The completed work below was captured in practice.`;

  return (
    <div className="relative min-h-screen overflow-hidden bg-[var(--sg-cream-50)]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute left-1/2 top-0 h-80 w-80 -translate-x-[78%] rounded-full blur-3xl"
          style={{
            background:
              "radial-gradient(circle, var(--sg-sage-100) 0%, transparent 68%)",
          }}
        />
        <div
          className="absolute right-0 top-24 h-96 w-96 translate-x-1/4 rounded-full blur-3xl"
          style={{
            background:
              "radial-gradient(circle, var(--sg-teal-100) 0%, transparent 70%)",
          }}
        />
        <div
          className="absolute bottom-0 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full blur-3xl"
          style={{
            background:
              "radial-gradient(circle, var(--sg-gold-100) 0%, transparent 70%)",
          }}
        />
      </div>

      <main className="relative mx-auto flex min-h-screen w-full max-w-5xl flex-col items-center justify-center px-6 py-16 sm:px-10">
        <div className="w-full max-w-3xl space-y-10">
          <div className="space-y-4 text-center">
            <div className="inline-flex items-center rounded-full border border-[var(--sg-shell-border)] bg-[var(--sg-white)] px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--sg-forest-500)] shadow-sm">
              Mission Evidence
            </div>
            <div className="space-y-3">
              <h1
                className="text-4xl leading-[1.05] text-[var(--sg-shell-900)] sm:text-[3.25rem]"
                style={{
                  fontFamily: "var(--font-display), 'Fraunces', Georgia, serif",
                }}
              >
                {headline}
              </h1>
              <p className="mx-auto max-w-2xl text-sm leading-6 text-[var(--sg-shell-600)] sm:text-base">
                {subtitle}
              </p>
            </div>
          </div>

          <div className="flex justify-center">
            <div className="w-full max-w-3xl space-y-8">
              <section className="space-y-3">
                <div className="space-y-1 text-center">
                  <h2 className="text-sm font-semibold uppercase tracking-[0.22em] text-[var(--sg-forest-500)]">
                    Evidence
                  </h2>
                  <p className="text-sm leading-6 text-[var(--sg-shell-600)]">
                    Completed work captured in practice from this mission.
                  </p>
                </div>
                <MissionOutcomeCard
                  achievement={{
                    id: achievement.id,
                    path_id: achievement.path_id,
                    path_title: achievement.path_title,
                    path_topics: achievement.path_topics,
                    items_completed: achievement.items_completed,
                    time_invested_seconds: achievement.time_invested_seconds,
                    difficulty_level: achievement.difficulty_level ?? "intermediate",
                    share_slug: achievement.share_slug,
                    completed_at: achievement.completed_at,
                  }}
                  skillReceipt={achievement.skill_receipt}
                  label="Completed work"
                  summary="Completed work captured in practice from this mission."
                  emphasis="featured"
                  showViewLink={false}
                />
              </section>

              {achievement.skill_receipt && (
                <section className="space-y-3">
                  <div className="space-y-1 text-center">
                    <h2 className="text-sm font-semibold uppercase tracking-[0.22em] text-[var(--sg-forest-500)]">
                      What This Strengthened
                    </h2>
                    <p className="text-sm leading-6 text-[var(--sg-shell-600)]">
                      {user_name}&apos;s capability snapshot at completion.
                    </p>
                  </div>
                  <div className="flex justify-center">
                    <SkillReceipt
                      receipt={achievement.skill_receipt}
                      title="What This Strengthened"
                      subtitle={`${user_name}'s capability snapshot at completion.`}
                      showFirstReceiptNote={false}
                      className="max-w-xl"
                    />
                  </div>
                </section>
              )}
            </div>
          </div>

          <div className="flex flex-col items-center gap-3 text-center">
            <Link
              href="/missions"
              className="inline-flex items-center gap-2 rounded-[var(--sg-radius-btn)] bg-[var(--sg-forest-500)] px-5 py-3 text-sm font-semibold text-white transition-all duration-150 hover:opacity-85"
            >
              Build your own capability record
              <ArrowRight size={15} />
            </Link>
            <p className="text-xs leading-5 text-[var(--sg-shell-500)]">
              SkillGap helps working professionals build AI fluency through missions, rooms, and durable evidence of progress.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
