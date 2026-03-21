"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { ProgressDashboard } from "@/components/progress/ProgressDashboard";
import { CapabilitySnapshot } from "@/components/progress/CapabilitySnapshot";
import { CurrentFocusPanel } from "@/components/progress/CurrentFocusPanel";
import { EvidenceArchive } from "@/components/progress/EvidenceArchive";
import { FeaturedEvidenceSection } from "@/components/progress/FeaturedEvidenceSection";
import { ProfileHeader } from "@/components/progress/ProfileHeader";
import {
  ProfileTabs,
  type ProfileTabId,
} from "@/components/progress/ProfileTabs";
import { useProfilePageData } from "@/lib/useProfilePageData";

function TabPanel({
  activeTab,
  tabId,
  children,
}: {
  activeTab: ProfileTabId;
  tabId: ProfileTabId;
  children: ReactNode;
}) {
  const isActive = activeTab === tabId;

  return (
    <section
      id={`profile-panel-${tabId}`}
      role="tabpanel"
      aria-labelledby={`profile-tab-${tabId}`}
      hidden={!isActive}
      className={isActive ? "block" : "hidden"}
    >
      {children}
    </section>
  );
}

export function ProgressPage() {
  const [activeTab, setActiveTab] = useState<ProfileTabId>("profile");
  const [loadedTabs, setLoadedTabs] = useState<Set<ProfileTabId>>(
    () => new Set(["profile"]),
  );

  const {
    currentUser,
    functionLabel,
    capabilityLine,
    focusedNowLine,
    primaryAction,
    recommendationsLoading,
    skillProfile,
    featuredAchievement,
    secondaryAchievements,
    evidenceArchive,
    evidenceArchiveLoading,
    evidenceArchiveError,
  } = useProfilePageData({
    loadEvidenceArchive: loadedTabs.has("work"),
  });

  const handleTabChange = (tab: ProfileTabId) => {
    setActiveTab(tab);
    setLoadedTabs((previous) => {
      if (previous.has(tab)) return previous;
      const next = new Set(previous);
      next.add(tab);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <ProfileTabs activeTab={activeTab} onTabChange={handleTabChange} />

      <div className="space-y-8">
        <TabPanel activeTab={activeTab} tabId="profile">
          <div className="space-y-8">
            <ProfileHeader
              displayName={currentUser.displayName}
              username={currentUser.username}
              avatarUrl={currentUser.avatarUrl}
              functionLabel={functionLabel}
              capabilityLine={capabilityLine}
              focusedNowLine={focusedNowLine}
              isLoading={currentUser.isLoading || skillProfile.isLoading}
            />

            <CapabilitySnapshot
              gaps={skillProfile.gaps}
              achievements={skillProfile.achievements}
              isLoading={skillProfile.isLoading}
            />

            <FeaturedEvidenceSection
              featuredAchievement={featuredAchievement}
              secondaryAchievements={secondaryAchievements}
              isLoading={skillProfile.isLoading}
              onOpenEvidenceArchive={() => handleTabChange("work")}
            />

            <CurrentFocusPanel
              primaryAction={primaryAction}
              isLoading={
                skillProfile.isLoading ||
                recommendationsLoading ||
                currentUser.isLoading
              }
            />
          </div>
        </TabPanel>

        {loadedTabs.has("work") ? (
          <TabPanel activeTab={activeTab} tabId="work">
            <EvidenceArchive
              achievements={evidenceArchive}
              isLoading={evidenceArchiveLoading}
              error={evidenceArchiveError}
            />
          </TabPanel>
        ) : null}

        {loadedTabs.has("activity") ? (
          <TabPanel activeTab={activeTab} tabId="activity">
            <div className="space-y-4">
              <div className="space-y-1">
                <h2 className="text-xl font-semibold text-[var(--sg-shell-900)]">
                  Activity
                </h2>
                <p className="text-sm leading-6 text-[var(--sg-shell-500)]">
                  Room activity and focus telemetry live here as supporting
                  context.
                </p>
              </div>

              <ProgressDashboard />
            </div>
          </TabPanel>
        ) : null}
      </div>
    </div>
  );
}
