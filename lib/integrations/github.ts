import type { ExternalWorkItem, IntegrationScope, WritebackPayload } from "./types";

const API_BASE = "https://api.github.com";

function headers(accessToken: string) {
  return {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

/* ─── Types from GitHub API ─────────────────────────────── */

interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  html_url: string;
  state: string;
  labels: { name: string; color: string }[];
  assignees: { login: string }[];
  repository_url: string;
  pull_request?: { html_url: string };
  updated_at: string;
  created_at: string;
}

interface GitHubRepo {
  full_name: string;
  html_url: string;
}

/* ─── Fetch Issues & PRs ────────────────────────────────── */

/**
 * Fetch assigned issues and PRs for the user from enabled repos.
 * Returns a unified list sorted by most recently updated.
 */
export async function fetchGitHubItems(
  accessToken: string,
  scopes: IntegrationScope[]
): Promise<ExternalWorkItem[]> {
  const enabledRepos = scopes
    .filter((s) => s.scope_type === "repo" && s.enabled)
    .map((s) => s.external_id);

  // Fetch issues assigned to the authenticated user
  const res = await fetch(
    `${API_BASE}/issues?filter=assigned&state=open&sort=updated&per_page=50`,
    { headers: headers(accessToken) }
  );

  if (!res.ok) {
    throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
  }

  const issues: GitHubIssue[] = await res.json();

  // Filter to enabled repos and map to ExternalWorkItem
  return issues
    .filter((issue) => {
      // If no scopes configured, include all
      if (enabledRepos.length === 0) return true;
      // Extract repo full_name from repository_url
      const repoName = issue.repository_url.replace(
        "https://api.github.com/repos/",
        ""
      );
      return enabledRepos.includes(repoName);
    })
    .map((issue) => {
      const repoName = issue.repository_url.replace(
        "https://api.github.com/repos/",
        ""
      );
      const isPR = !!issue.pull_request;

      return {
        externalId: `github:${repoName}#${issue.number}`,
        provider: "github" as const,
        resourceType: isPR ? ("pr" as const) : ("issue" as const),
        title: issue.title,
        url: issue.html_url,
        metadata: {
          number: issue.number,
          repo: repoName,
          state: issue.state,
          isPR,
          labels: issue.labels.map((l) => l.name),
          assignees: issue.assignees.map((a) => a.login),
          updatedAt: issue.updated_at,
        },
      };
    });
}

/* ─── Fetch Repos (for scope picker) ────────────────────── */

export async function fetchGitHubRepos(
  accessToken: string
): Promise<{ id: string; name: string }[]> {
  const res = await fetch(
    `${API_BASE}/user/repos?sort=updated&per_page=100&affiliation=owner,collaborator,organization_member`,
    { headers: headers(accessToken) }
  );

  if (!res.ok) {
    throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
  }

  const repos: GitHubRepo[] = await res.json();
  return repos.map((r) => ({
    id: r.full_name,
    name: r.full_name,
  }));
}

/* ─── Writeback ─────────────────────────────────────────── */

/**
 * Post a comment on a GitHub issue or PR.
 */
export async function writeBackToGitHub(
  accessToken: string,
  externalId: string,
  payload: WritebackPayload
): Promise<void> {
  // externalId format: "github:owner/repo#123"
  const match = externalId.match(/^github:(.+)#(\d+)$/);
  if (!match) throw new Error(`Invalid GitHub external ID: ${externalId}`);

  const [, repo, number] = match;

  if (payload.action === "comment" && payload.body) {
    const res = await fetch(
      `${API_BASE}/repos/${repo}/issues/${number}/comments`,
      {
        method: "POST",
        headers: {
          ...headers(accessToken),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ body: payload.body }),
      }
    );

    if (!res.ok) {
      const error = await res.text();
      throw new Error(`GitHub comment failed: ${res.status} ${error}`);
    }
  }
}
