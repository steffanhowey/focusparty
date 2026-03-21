import {
  formatAchievementDate,
  getAchievementHighlightedSkills,
} from "@/lib/achievements/achievementModel";
import type { AchievementPageData } from "@/lib/types";
import {
  FOREST_900,
  FOREST_700,
  FOREST_500,
  SHELL_900,
  SHELL_700,
  SHELL_600,
  SHELL_300,
  SHELL_50,
  TEAL_600,
} from "@/lib/palette";

export const ACHIEVEMENT_OG_ALT = "Mission evidence";
export const ACHIEVEMENT_OG_SIZE = { width: 1200, height: 630 };
export const ACHIEVEMENT_OG_CONTENT_TYPE = "image/png";

interface AchievementOgImageProps {
  data: AchievementPageData | null;
}

export function AchievementOgImage({ data }: AchievementOgImageProps) {
  if (!data) {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: `linear-gradient(135deg, ${FOREST_900} 0%, ${FOREST_700} 100%)`,
          color: "white",
          fontFamily: "sans-serif",
          fontSize: 44,
          fontWeight: 700,
        }}
      >
        Mission Evidence Not Found
      </div>
    );
  }

  const { achievement, user_name } = data;
  const highlightedSkills = getAchievementHighlightedSkills(
    achievement.skill_receipt,
  );
  const subtitle = highlightedSkills.length > 0
    ? `${user_name} completed this mission. Completed work captured in practice. Demonstrated capability: ${highlightedSkills.slice(0, 2).join(", ")}.`
    : `${user_name} completed this mission. Completed work captured in practice from ${achievement.items_completed} finished steps.`;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        background: `linear-gradient(140deg, ${FOREST_900} 0%, ${FOREST_700} 48%, ${SHELL_900} 100%)`,
        padding: 44,
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          borderRadius: 30,
          background: "white",
          border: `1px solid ${SHELL_300}`,
          padding: "38px 42px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 24,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                fontSize: 16,
                letterSpacing: 4,
                textTransform: "uppercase",
                fontWeight: 700,
                color: FOREST_500,
              }}
            >
              Mission Evidence
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
                maxWidth: 760,
              }}
            >
              <div
                style={{
                  fontSize: 54,
                  lineHeight: 1.06,
                  fontWeight: 700,
                  color: SHELL_900,
                  fontFamily: "serif",
                }}
              >
                {achievement.path_title}
              </div>
              <div
                style={{
                  fontSize: 24,
                  lineHeight: 1.35,
                  color: SHELL_700,
                }}
              >
                {subtitle}
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 18,
          }}
        >
          {highlightedSkills.length > 0 && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  letterSpacing: 3,
                  textTransform: "uppercase",
                  color: SHELL_600,
                }}
              >
                What This Strengthened
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                {highlightedSkills.slice(0, 3).map((skillName) => (
                  <div
                    key={skillName}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      borderRadius: 9999,
                      border: `1px solid ${SHELL_300}`,
                      background: SHELL_50,
                      padding: "10px 16px",
                      fontSize: 20,
                      color: SHELL_700,
                    }}
                  >
                    {skillName}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 24,
              alignItems: "flex-end",
            }}
          >
            <div style={{ display: "flex", gap: 18 }}>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  padding: "14px 18px",
                  borderRadius: 20,
                  background: SHELL_50,
                  border: `1px solid ${SHELL_300}`,
                  minWidth: 180,
                }}
              >
                <div
                  style={{
                    fontSize: 14,
                    textTransform: "uppercase",
                    letterSpacing: 2,
                    color: SHELL_600,
                  }}
                >
                  Steps
                </div>
                <div
                  style={{
                    fontSize: 28,
                    fontWeight: 700,
                    color: SHELL_900,
                  }}
                >
                  {`${achievement.items_completed} completed`}
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  padding: "14px 18px",
                  borderRadius: 20,
                  background: SHELL_50,
                  border: `1px solid ${SHELL_300}`,
                  minWidth: 190,
                }}
              >
                <div
                  style={{
                    fontSize: 14,
                    textTransform: "uppercase",
                    letterSpacing: 2,
                    color: SHELL_600,
                  }}
                >
                  Completed
                </div>
                <div
                  style={{
                    fontSize: 28,
                    fontWeight: 700,
                    color: SHELL_900,
                  }}
                >
                  {formatAchievementDate(achievement.completed_at, "short")}
                </div>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                fontSize: 24,
                fontWeight: 700,
                color: TEAL_600,
              }}
            >
              SkillGap.ai
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
