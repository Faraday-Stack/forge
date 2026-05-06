import { exec } from "./exec.js";
import { createPullRequest } from "./github.js";

export interface PushAndOpenInput {
  dir: string;
  owner: string;
  repo: string;
  baseBranch: string;
  requestId: string;
  jobId: string;
  prompt: string;
  summary: string;
  token: string;
}

export interface PushAndOpenResult {
  url: string;
  number: number;
  branch: string;
}

function shortId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 12) || "req";
}

export async function pushBranchAndOpenPR(input: PushAndOpenInput): Promise<PushAndOpenResult | null> {
  const { dir, owner, repo, token } = input;
  const branch = `faraday/${shortId(input.requestId)}-${input.jobId.slice(0, 8)}`;

  await exec("git", ["-C", dir, "checkout", "-B", branch]);
  await exec("git", ["-C", dir, "add", "-A"]);

  const { stdout } = await exec("git", ["-C", dir, "status", "--porcelain"]);
  if (!stdout.trim()) return null;

  const promptSlice = (input.prompt || "apply user request").slice(0, 60);
  await exec("git", ["-C", dir, "commit", "-m", `Faraday: ${promptSlice}`]);

  const remoteUrl = `https://x-access-token:${token}@github.com/${owner}/${repo}.git`;
  await exec("git", ["-C", dir, "push", remoteUrl, `HEAD:refs/heads/${branch}`]);

  const title = `Faraday: ${(input.prompt || `request ${shortId(input.requestId)}`).slice(0, 70)}`;
  const body = [
    "This PR was opened from a Faraday user request.",
    "",
    `**Request:** ${input.prompt || "(empty)"}`,
    "",
    input.summary ? `**Agent summary:** ${input.summary}` : "",
    "",
    "---",
    `Faraday-Request-Id: ${input.requestId}`,
  ]
    .filter((l) => l !== null && l !== undefined)
    .join("\n");

  const pr = await createPullRequest(token, owner, repo, {
    title,
    head: branch,
    base: input.baseBranch,
    body,
  });

  return { url: pr.url, number: pr.number, branch };
}
