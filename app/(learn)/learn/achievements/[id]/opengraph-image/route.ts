import React from "react";
import { ImageResponse } from "next/og";
import {
  ACHIEVEMENT_OG_ALT,
  ACHIEVEMENT_OG_CONTENT_TYPE,
  ACHIEVEMENT_OG_SIZE,
  AchievementOgImage,
} from "@/components/achievements/AchievementOgImage";
import { getAchievementPageData } from "@/lib/achievements/getAchievementPageData";

export const alt = ACHIEVEMENT_OG_ALT;
export const size = ACHIEVEMENT_OG_SIZE;
export const contentType = ACHIEVEMENT_OG_CONTENT_TYPE;

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const data = await getAchievementPageData(id);

  return new ImageResponse(
    React.createElement(AchievementOgImage, { data }),
    { ...size },
  );
}
