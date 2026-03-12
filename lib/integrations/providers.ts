import type { IntegrationProviderDef } from "./types";

export const PROVIDERS: Record<string, IntegrationProviderDef> = {
  github: {
    id: "github",
    displayName: "GitHub",
    description: "Link issues and PRs to your sprints",
    color: "#24292f",
    defaultScopes: ["repo"],
    hasScopeSelection: true,
    scopeTypes: ["repo", "org"],
  },
  google: {
    id: "google",
    displayName: "Google Calendar",
    description: "Smart sprint timing based on your schedule",
    color: "#4285F4",
    defaultScopes: [
      "https://www.googleapis.com/auth/calendar.readonly",
    ],
    hasScopeSelection: true,
    scopeTypes: ["calendar"],
  },
  linear: {
    id: "linear",
    displayName: "Linear",
    description: "Pull assigned issues into sprints",
    color: "#5E6AD2",
    defaultScopes: ["read", "write"],
    hasScopeSelection: true,
    scopeTypes: ["linear_team"],
  },
  slack: {
    id: "slack",
    displayName: "Slack",
    description: "Share sprint momentum with your team",
    color: "#4A154B",
    defaultScopes: ["chat:write", "channels:read"],
    hasScopeSelection: true,
    scopeTypes: ["slack_channel"],
  },
  discord: {
    id: "discord",
    displayName: "Discord",
    description: "Post sprint updates to your community",
    color: "#5865F2",
    defaultScopes: ["webhook.incoming"],
    hasScopeSelection: false,
    scopeTypes: [],
  },
};

/** Ordered list for display in settings */
export const PROVIDER_ORDER: IntegrationProviderDef["id"][] = [
  "github",
  "google",
  "linear",
  "slack",
  "discord",
];
