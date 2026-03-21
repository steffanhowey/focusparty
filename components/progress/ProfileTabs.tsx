"use client";

export type ProfileTabId = "profile" | "work" | "activity";

interface ProfileTabsProps {
  activeTab: ProfileTabId;
  onTabChange: (tab: ProfileTabId) => void;
}

const TABS: Array<{ id: ProfileTabId; label: string }> = [
  { id: "profile", label: "Profile" },
  { id: "work", label: "Work" },
  { id: "activity", label: "Activity" },
];

export function ProfileTabs({
  activeTab,
  onTabChange,
}: ProfileTabsProps) {
  return (
    <div className="flex justify-start">
      <div
        role="tablist"
        aria-label="Profile sections"
        className="inline-flex rounded-full border border-[var(--sg-shell-border)] bg-[var(--sg-shell-50)] p-1"
      >
        {TABS.map((tab) => {
          const isActive = tab.id === activeTab;

          return (
            <button
              key={tab.id}
              id={`profile-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`profile-panel-${tab.id}`}
              onClick={() => onTabChange(tab.id)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-white text-[var(--sg-shell-900)] shadow-sm"
                  : "text-[var(--sg-shell-500)] hover:text-[var(--sg-shell-700)]"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
