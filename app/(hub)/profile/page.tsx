"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Clock, Award, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import type { LearningPath, LearningProgress } from "@/lib/types";

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
}

interface SkillLevel {
  topic: string;
  level: number;
  paths_completed: number;
  paths_in_progress: number;
  time_invested_seconds: number;
}

interface PathWithProgress {
  path: LearningPath;
  progress: LearningProgress;
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
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function computeSkillLevels(
  completedPaths: PathWithProgress[],
  inProgressPaths: PathWithProgress[],
  achievements: Achievement[]
): SkillLevel[] {
  const topicMap = new Map<
    string,
    {
      completed: number;
      inProgress: number;
      timeSeconds: number;
      hasDifficulty: Set<string>;
    }
  >();

  for (const { path, progress } of completedPaths) {
    for (const topic of path.topics) {
      const entry = topicMap.get(topic) ?? {
        completed: 0,
        inProgress: 0,
        timeSeconds: 0,
        hasDifficulty: new Set(),
      };
      entry.completed++;
      entry.timeSeconds += progress.time_invested_seconds;
      entry.hasDifficulty.add(path.difficulty_level);
      topicMap.set(topic, entry);
    }
  }

  for (const { path, progress } of inProgressPaths) {
    for (const topic of path.topics) {
      const entry = topicMap.get(topic) ?? {
        completed: 0,
        inProgress: 0,
        timeSeconds: 0,
        hasDifficulty: new Set(),
      };
      entry.inProgress++;
      entry.timeSeconds += progress.time_invested_seconds;
      topicMap.set(topic, entry);
    }
  }

  const skills: SkillLevel[] = [];
  for (const [topic, data] of topicMap) {
    const timeHours = data.timeSeconds / 3600;
    const difficultyBonus = data.hasDifficulty.has("advanced")
      ? 10
      : data.hasDifficulty.has("intermediate")
        ? 5
        : 0;
    const level = Math.min(
      100,
      data.completed * 25 + data.inProgress * 10 + timeHours * 5 + difficultyBonus
    );
    skills.push({
      topic,
      level: Math.round(level),
      paths_completed: data.completed,
      paths_in_progress: data.inProgress,
      time_invested_seconds: data.timeSeconds,
    });
  }

  return skills.sort((a, b) => b.level - a.level);
}

// ─── Page ───────────────────────────────────────────────────

export default function ProfilePage() {
  const router = useRouter();
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [completedPaths, setCompletedPaths] = useState<PathWithProgress[]>([]);
  const [inProgressPaths, setInProgressPaths] = useState<PathWithProgress[]>(
    []
  );
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/learn/achievements").then((r) => r.json()),
      fetch("/api/learn/paths").then((r) => r.json()),
    ])
      .then(([achData, pathsData]) => {
        setAchievements(achData.achievements ?? []);
        setCompletedPaths(pathsData.completed ?? []);
        setInProgressPaths(pathsData.in_progress ?? []);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const totalTime = [
    ...completedPaths.map((p) => p.progress.time_invested_seconds),
    ...inProgressPaths.map((p) => p.progress.time_invested_seconds),
  ].reduce((a, b) => a + b, 0);

  const skills = computeSkillLevels(
    completedPaths,
    inProgressPaths,
    achievements
  );

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="flex justify-center">
          <div className="w-6 h-6 border-2 border-[var(--sg-shell-500)] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-10">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-[var(--sg-shell-900)]">
          Learning Profile
        </h1>
        <div className="flex flex-wrap items-center gap-4 text-sm text-[var(--sg-shell-500)]">
          <span className="flex items-center gap-1">
            <Award size={14} />
            {achievements.length} path{achievements.length !== 1 ? "s" : ""}{" "}
            completed
          </span>
          <span className="flex items-center gap-1">
            <Clock size={14} />
            {formatDuration(totalTime)} invested
          </span>
          {inProgressPaths.length > 0 && (
            <span className="flex items-center gap-1">
              <BookOpen size={14} />
              {inProgressPaths.length} in progress
            </span>
          )}
        </div>
      </div>

      {/* Skills */}
      {skills.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-[var(--sg-shell-600)]">
            Skills
          </h2>
          <div className="space-y-3">
            {skills.slice(0, 10).map((skill) => (
              <div key={skill.topic} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-[var(--sg-shell-900)]">
                    {skill.topic}
                  </span>
                  <span className="text-xs text-[var(--sg-shell-500)]">
                    {skill.level}%
                  </span>
                </div>
                <div className="h-2 rounded-full bg-[var(--sg-shell-100)] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${skill.level}%`,
                      background:
                        "linear-gradient(to right, var(--sg-forest-500), var(--sg-teal-500))",
                    }}
                  />
                </div>
                <p className="text-[10px] text-[var(--sg-shell-500)]">
                  {skill.paths_completed} completed
                  {skill.paths_in_progress > 0
                    ? ` · ${skill.paths_in_progress} in progress`
                    : ""}
                  {" · "}
                  {formatDuration(skill.time_invested_seconds)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Achievements */}
      {achievements.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-[var(--sg-shell-600)]">
            Achievements
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {achievements.map((ach) => (
              <button
                key={ach.id}
                onClick={() =>
                  router.push(`/learn/achievements/${ach.share_slug}`)
                }
                className="text-left group"
              >
                <Card className="p-4 space-y-2 hover:border-[var(--sg-forest-500)] transition-colors">
                  <div className="flex items-start justify-between">
                    <h3 className="text-sm font-medium text-[var(--sg-shell-900)] line-clamp-2 group-hover:text-[var(--sg-forest-500)] transition-colors">
                      {ach.path_title}
                    </h3>
                    <ArrowRight
                      size={12}
                      className="text-[var(--sg-shell-500)] shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    />
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[var(--sg-shell-500)]">
                    <span>{ach.items_completed} resources</span>
                    <span>&middot;</span>
                    <span>{formatDuration(ach.time_invested_seconds)}</span>
                    <span>&middot;</span>
                    <span>{formatDate(ach.completed_at)}</span>
                  </div>
                  {ach.path_topics.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {ach.path_topics.slice(0, 3).map((t) => (
                        <span
                          key={t}
                          className="px-1.5 py-0.5 rounded text-[10px] bg-[var(--sg-shell-100)] text-[var(--sg-shell-600)]"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </Card>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* In Progress */}
      {inProgressPaths.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-[var(--sg-shell-600)]">
            Currently Learning
          </h2>
          <div className="space-y-2">
            {inProgressPaths.map(({ path, progress }) => {
              const pct =
                progress.items_total > 0
                  ? Math.round(
                      (progress.items_completed / progress.items_total) * 100
                    )
                  : 0;
              return (
                <button
                  key={path.id}
                  onClick={() => router.push(`/learn/paths/${path.id}`)}
                  className="w-full text-left"
                >
                  <Card className="p-3 space-y-2 hover:border-[var(--sg-forest-500)] transition-colors">
                    <h3 className="text-sm font-medium text-[var(--sg-shell-900)]">
                      {path.title}
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-[var(--sg-shell-500)]">
                      <span>
                        {progress.items_completed}/{progress.items_total} done
                      </span>
                      <span>&middot;</span>
                      <span>{pct}%</span>
                    </div>
                    <div className="h-1 rounded-full bg-[var(--sg-shell-100)] overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${pct}%`,
                          background: "var(--sg-forest-500)",
                        }}
                      />
                    </div>
                  </Card>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty State */}
      {achievements.length === 0 &&
        inProgressPaths.length === 0 &&
        completedPaths.length === 0 && (
          <div className="text-center py-16 space-y-3">
            <BookOpen
              size={32}
              className="mx-auto text-[var(--sg-shell-500)] opacity-40"
            />
            <p className="text-sm text-[var(--sg-shell-500)]">
              No learning activity yet. Start a learning path to build your
              profile.
            </p>
            <Button variant="cta" onClick={() => router.push("/learn")}>
              Start Learning
            </Button>
          </div>
        )}
    </div>
  );
}
