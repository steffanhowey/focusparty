import React from "react";
import { describe, expect, it } from "vitest";
import { ImageResponse } from "next/og";
import { AchievementOgImage, ACHIEVEMENT_OG_SIZE } from "@/components/achievements/AchievementOgImage";
import type { AchievementPageData } from "@/lib/types";

const achievementPageData: AchievementPageData = {
  user_name: "Codex E2E",
  achievement: {
    id: "achievement-1",
    user_id: "user-1",
    progress_id: "progress-1",
    path_id: "path-1",
    path_title: "AI Coding Mastery",
    path_topics: ["Agents", "Automation"],
    items_completed: 3,
    time_invested_seconds: 1800,
    difficulty_level: "exploring",
    completed_at: "2026-03-19T19:20:00.000Z",
    share_slug: "codexe2e-ai-coding",
    skill_receipt: {
      path: {
        id: "path-1",
        title: "AI Coding Mastery",
        completed_at: "2026-03-19T19:20:00.000Z",
      },
      is_first_receipt: false,
      skills: [
        {
          skill: {
            slug: "prompt-engineering",
            name: "Prompt Engineering",
            domain_slug: "core-ai",
            domain_name: "Core AI",
            domain_icon: "sparkles",
          },
          relevance: "primary",
          before: {
            fluency_level: "exploring",
            paths_completed: 0,
          },
          after: {
            fluency_level: "practicing",
            paths_completed: 1,
          },
          leveled_up: true,
          missions_in_path: 1,
          avg_score_in_path: null,
        },
      ],
    },
  },
};

describe("AchievementOgImage", () => {
  it("renders populated achievement data as a PNG", async () => {
    const response = new ImageResponse(
      React.createElement(AchievementOgImage, { data: achievementPageData }),
      { ...ACHIEVEMENT_OG_SIZE },
    );

    const buffer = await response.arrayBuffer();

    expect(buffer.byteLength).toBeGreaterThan(0);
    expect(response.headers.get("content-type")).toContain("image/png");
  });

  it("renders the fallback state when achievement data is missing", async () => {
    const response = new ImageResponse(
      React.createElement(AchievementOgImage, { data: null }),
      { ...ACHIEVEMENT_OG_SIZE },
    );

    const buffer = await response.arrayBuffer();

    expect(buffer.byteLength).toBeGreaterThan(0);
    expect(response.headers.get("content-type")).toContain("image/png");
  });
});
