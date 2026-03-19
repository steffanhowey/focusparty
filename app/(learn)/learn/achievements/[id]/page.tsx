import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { AchievementCard } from "@/components/achievements/AchievementCard";
import { SkillReceipt } from "@/components/learn/SkillReceipt";
import { getAchievementPageData } from "@/lib/achievements/getAchievementPageData";
import {
  formatAchievementDate,
  formatAchievementDuration,
  getAchievementHighlightedSkills,
  getAchievementLevelUpCount,
  getSiteUrl,
} from "@/lib/achievements/achievementModel";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const data = await getAchievementPageData(id);

  if (!data) {
    return {
      title: "Achievement Not Found — SkillGap",
      robots: { index: false, follow: false },
    };
  }

  const { achievement, user_name } = data;
  const siteUrl = getSiteUrl();
  const pageUrl = `${siteUrl}/learn/achievements/${achievement.share_slug}`;
  const imageUrl = `${pageUrl}/opengraph-image`;
  const highlightedSkills = getAchievementHighlightedSkills(
    achievement.skill_receipt,
  );
  const description = highlightedSkills.length
    ? `${user_name} completed ${achievement.path_title} on SkillGap. Skills demonstrated: ${highlightedSkills.join(", ")}. ${formatAchievementDuration(achievement.time_invested_seconds)} invested.`
    : `${user_name} completed ${achievement.path_title} on SkillGap. ${achievement.items_completed} resources completed in ${formatAchievementDuration(achievement.time_invested_seconds)}.`;

  return {
    title: `${achievement.path_title} — SkillGap Credential`,
    description,
    alternates: {
      canonical: pageUrl,
    },
    openGraph: {
      title: `${user_name} completed ${achievement.path_title} on SkillGap`,
      description,
      type: "article",
      url: pageUrl,
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: `${achievement.path_title} credential`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${user_name} completed ${achievement.path_title} on SkillGap`,
      description,
      images: [imageUrl],
    },
  };
}

export default async function AchievementPage({
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
            Achievement not found
          </h1>
          <p className="max-w-md text-sm leading-6 text-[var(--sg-shell-600)]">
            This credential link may have expired, been removed, or never
            existed in the first place.
          </p>
          <Link
            href="/learn"
            className="inline-flex items-center gap-2 rounded-[var(--sg-radius-btn)] bg-[var(--sg-forest-500)] px-5 py-3 text-sm font-semibold text-white transition-all duration-150 hover:opacity-85"
          >
            Start learning on SkillGap
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
  const levelUpCount = getAchievementLevelUpCount(achievement.skill_receipt);
  const headline = highlightedSkills.length
    ? `${highlightedSkills[0]} demonstrated in practice`
    : "AI fluency, demonstrated in practice";
  const subtitle = levelUpCount
    ? `${user_name} completed ${achievement.path_title} on ${formatAchievementDate(achievement.completed_at)} and advanced ${levelUpCount} skill${levelUpCount > 1 ? "s" : ""}.`
    : `${user_name} completed ${achievement.path_title} on ${formatAchievementDate(achievement.completed_at)}. The skills below were captured at completion.`;

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
          <div className="text-center space-y-4">
            <div className="inline-flex items-center rounded-full border border-[var(--sg-shell-border)] bg-[var(--sg-white)] px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--sg-forest-500)] shadow-sm">
              Public Credential
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
            <AchievementCard
              pathTitle={achievement.path_title}
              pathTopics={achievement.path_topics}
              itemsCompleted={achievement.items_completed}
              timeInvestedSeconds={achievement.time_invested_seconds}
              completedAt={achievement.completed_at}
              skillReceipt={achievement.skill_receipt}
              variant="public"
            />
          </div>

          {achievement.skill_receipt && (
            <div className="flex justify-center">
              <SkillReceipt
                receipt={achievement.skill_receipt}
                title={levelUpCount > 0 ? "Skills Advanced" : "Skills Demonstrated"}
                subtitle={`${user_name}'s fluency snapshot at completion.`}
                showFirstReceiptNote={false}
                className="max-w-xl"
              />
            </div>
          )}

          <div className="flex flex-col items-center gap-3 text-center">
            <Link
              href="/learn"
              className="inline-flex items-center gap-2 rounded-[var(--sg-radius-btn)] bg-[var(--sg-forest-500)] px-5 py-3 text-sm font-semibold text-white transition-all duration-150 hover:opacity-85"
            >
              Build your own skill graph
              <ArrowRight size={15} />
            </Link>
            <p className="text-xs leading-5 text-[var(--sg-shell-500)]">
              SkillGap helps working professionals build AI fluency through
              guided paths, live rooms, and durable proof of progress.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
