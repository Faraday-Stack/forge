const GITHUB_API = "https://api.github.com";
const GITHUB_API_VERSION = "2022-11-28";

function headers(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": GITHUB_API_VERSION,
  };
}

export interface CreatedPR {
  number: number;
  url: string;
}

export async function createPullRequest(
  token: string,
  owner: string,
  repo: string,
  args: { title: string; head: string; base: string; body: string },
): Promise<CreatedPR> {
  const r = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/pulls`, {
    method: "POST",
    headers: { ...headers(token), "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  if (!r.ok) {
    const text = await r.text().catch(() => "");
    throw new Error(`createPullRequest failed (${r.status}): ${text}`);
  }
  const body = (await r.json()) as { number: number; html_url: string };
  return { number: body.number, url: body.html_url };
}
