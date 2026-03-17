import { createClient as createAdminClient } from "@/lib/supabase/admin";
import type { Metadata } from "next";

// ─── Types ──────────────────────────────────────────────────

interface Achievement {
  id: string;
  path_title: string;
  path_topics: string[];
  items_completed: number;
  time_invested_seconds: number;
  difficulty_level: string;
  completed_at: string;
  share_slug: string;
  user_id: string;
}

// ─── Helpers ────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm ? `${h}h ${rm}m` : `${h}h`;
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

async function fetchAchievement(id: string): Promise<Achievement | null> {
  const admin = createAdminClient();

  // Try by share_slug first, then by id
  let { data } = await admin
    .from("fp_achievements")
    .select("*")
    .eq("share_slug", id)
    .single();

  if (!data) {
    const result = await admin
      .from("fp_achievements")
      .select("*")
      .eq("id", id)
      .single();
    data = result.data;
  }

  return data as Achievement | null;
}

async function fetchUserName(userId: string): Promise<string> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("fp_profiles")
    .select("name")
    .eq("id", userId)
    .single();
  return data?.name ?? "A learner";
}

// ─── Metadata ───────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const achievement = await fetchAchievement(id);

  if (!achievement) {
    return { title: "Achievement Not Found — SkillGap" };
  }

  const description = `${achievement.items_completed} resources completed in ${formatDuration(achievement.time_invested_seconds)}. Topics: ${achievement.path_topics.join(", ")}.`;

  return {
    title: `${achievement.path_title} — Completed on SkillGap`,
    description,
    openGraph: {
      title: `I completed "${achievement.path_title}" on SkillGap`,
      description: `${achievement.items_completed} resources · ${formatDuration(achievement.time_invested_seconds)} invested`,
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title: `I completed "${achievement.path_title}" on SkillGap`,
      description,
    },
  };
}

// ─── Page ───────────────────────────────────────────────────

export default async function AchievementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const achievement = await fetchAchievement(id);

  if (!achievement) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--sg-white)]">
        <p className="text-sm text-[var(--sg-shell-500)]">
          Achievement not found.
        </p>
      </div>
    );
  }

  const userName = await fetchUserName(achievement.user_id);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--sg-white)] p-6">
      {/* Attribution */}
      <p className="text-sm text-[var(--sg-shell-500)] mb-6">
        {userName} completed this learning path
      </p>

      {/* Achievement Card */}
      <div
        className="w-full max-w-md rounded-xl overflow-hidden"
        style={{
          background:
            "linear-gradient(145deg, var(--sg-shell-50), var(--sg-white))",
          border: "1px solid var(--sg-shell-border)",
          boxShadow: "var(--shadow-float, 0 8px 32px rgba(0,0,0,0.12))",
        }}
      >
        {/* Accent bar */}
        <div
          className="h-1"
          style={{
            background:
              "linear-gradient(to right, var(--sg-forest-500), var(--sg-teal-600))",
          }}
        />

        <div className="p-6 space-y-5">
          {/* Title */}
          <div className="space-y-1">
            <p
              className="text-xs font-semibold uppercase tracking-widest"
              style={{ color: "var(--sg-forest-500)" }}
            >
              Path Complete
            </p>
            <h1 className="text-lg font-bold text-[var(--sg-shell-900)] leading-snug">
              {achievement.path_title}
            </h1>
          </div>

          {/* Divider */}
          <div
            className="h-px"
            style={{ background: "var(--sg-shell-border)" }}
          />

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-[var(--sg-shell-500)] text-xs">
                Resources
              </p>
              <p className="text-[var(--sg-shell-900)] font-medium">
                {achievement.items_completed} completed
              </p>
            </div>
            <div>
              <p className="text-[var(--sg-shell-500)] text-xs">
                Time invested
              </p>
              <p className="text-[var(--sg-shell-900)] font-medium">
                {formatDuration(achievement.time_invested_seconds)}
              </p>
            </div>
          </div>

          {/* Topics */}
          {achievement.path_topics.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[var(--sg-shell-500)] text-xs">
                Topics
              </p>
              <div className="flex flex-wrap gap-1.5">
                {achievement.path_topics.slice(0, 5).map((t) => (
                  <span
                    key={t}
                    className="px-2 py-0.5 rounded text-xs bg-[var(--sg-sage-100)] text-[var(--sg-shell-600)]"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-[var(--sg-shell-500)]">
              Completed {formatDate(achievement.completed_at)}
            </span>
            <span className="text-xs font-medium text-[var(--sg-shell-500)]">
              SkillGap.ai
            </span>
          </div>
        </div>
      </div>

      {/* CTA */}
      <a
        href="/learn"
        className="mt-8 text-sm font-medium transition-colors"
        style={{ color: "var(--sg-forest-500)" }}
      >
        Start learning on SkillGap.ai
      </a>
    </div>
  );
}
