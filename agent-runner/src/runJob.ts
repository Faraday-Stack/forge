import { stripTokenFromRemote } from "./clone.js";
import { prepareWorkdir } from "./prepare.js";
import { runAgent, SYSTEM_PROMPT } from "./agent.js";
import { pushBranchAndOpenPR } from "./pr.js";
import { uploadSnapshot } from "./snapshot.js";
import type { JobEvent, JobInput } from "./types.js";

export interface RunJobDeps {
  workdir: string;
  githubToken: string;
  blobToken?: string;
  snapshotMaxBytes: number;
}

function buildUserPrompt(input: JobInput): string {
  const chat = (input.messages ?? [])
    .filter((m) => m && typeof m === "object" && m.role && m.content)
    .map(
      (m) =>
        `${m.role}: ${typeof m.content === "string" ? m.content : JSON.stringify(m.content)}`,
    )
    .join("\n");

  return `A user of a customer's app made the following customization request via the Faraday SDK:

REQUEST: "${input.prompt}"

REPO: ${input.repoFullName}

CHAT TRANSCRIPT:
${chat || "(none)"}

PAGE CONTEXT (modifiable elements present on the page when the request was saved, including source file/line where known):
${JSON.stringify(input.pageContext ?? {}, null, 2)}

OVERRIDES THE IN-PAGE AGENT APPLIED:
${JSON.stringify(input.savedSnapshot?.overrides ?? {}, null, 2)}

INSERTED COMPONENTS (per container id):
${JSON.stringify(input.savedSnapshot?.insertedComponents ?? {}, null, 2)}

RECORDED TOOL CALLS:
${JSON.stringify(input.toolCalls ?? [], null, 2)}

Make the change real in this repo. Edit existing files, add backend support if needed.`;
}

export async function* runJob(
  input: JobInput,
  deps: RunJobDeps,
): AsyncGenerator<JobEvent, void, void> {
  const startedAt = Date.now();
  yield { type: "prepare:start", snapshotKey: input.snapshotKey };

  let prepareResult;
  try {
    prepareResult = await prepareWorkdir({
      dir: deps.workdir,
      owner: input.owner,
      repo: input.repo,
      defaultBranch: input.defaultBranch,
      token: deps.githubToken,
      snapshotKey: input.snapshotKey,
      blobToken: deps.blobToken,
    });
  } catch (e) {
    yield { type: "failed", error: `prepare failed: ${(e as Error).message}` };
    yield { type: "done" };
    return;
  }

  if (input.snapshotKey) {
    yield prepareResult.snapshotHit
      ? { type: "prepare:snapshot_hit" }
      : {
          type: "prepare:snapshot_miss",
          reason: "blob fetch failed or absent",
        };
  }
  yield {
    type: "prepare:done",
    snapshotHit: prepareResult.snapshotHit,
    lockfileChanged: prepareResult.lockfileChanged,
    durationMs: Date.now() - startedAt,
  };

  yield { type: "agent:start" };
  const userPrompt = buildUserPrompt(input);
  let summary = "";
  try {
    const stream = runAgent({
      dir: deps.workdir,
      systemPrompt: SYSTEM_PROMPT,
      userPrompt,
    });
    while (true) {
      const next = await stream.next();
      if (next.done) {
        summary = next.value.summary;
        break;
      }
      const ev = next.value;
      if (ev.type === "text_delta" && ev.text)
        yield { type: "agent:text_delta", text: ev.text };
      else if (ev.type === "tool_use" && ev.toolName)
        yield {
          type: "agent:tool_use",
          name: ev.toolName,
          input: ev.toolInput,
        };
    }
  } catch (error) {
    yield {
      type: "failed",
      error: `agent failed: ${(error as Error).message}`,
    };
    yield { type: "done" };
    return;
  }
  yield { type: "agent:done", summary };

  let prResult: Awaited<ReturnType<typeof pushBranchAndOpenPR>>;
  try {
    yield { type: "pr:opening", branch: "" };
    prResult = await pushBranchAndOpenPR({
      dir: deps.workdir,
      owner: input.owner,
      repo: input.repo,
      baseBranch: input.defaultBranch,
      requestId: input.requestId,
      jobId: input.jobId,
      prompt: input.prompt,
      summary,
      token: deps.githubToken,
    });
  } catch (e) {
    yield { type: "failed", error: `pr failed: ${(e as Error).message}` };
    yield { type: "done" };
    return;
  }

  if (!prResult) {
    yield { type: "pr:no_changes", summary };
  } else {
    yield {
      type: "pr:opened",
      url: prResult.url,
      number: prResult.number,
      branch: prResult.branch,
      summary,
    };
  }

  // Snapshot upload — only if we missed cache or the lockfile drifted, and only
  // after stripping the live token from the remote URL so we never persist it.
  const shouldUpload =
    !!input.snapshotKey &&
    (!prepareResult.snapshotHit || prepareResult.lockfileChanged);
  if (shouldUpload && input.snapshotKey) {
    try {
      await stripTokenFromRemote(deps.workdir, input.owner, input.repo);
      yield { type: "snapshot:upload_start" };
      const upload = await uploadSnapshot(input.snapshotKey, deps.workdir, {
        maxBytes: deps.snapshotMaxBytes,
        token: deps.blobToken,
      });
      if ("skipped" in upload) {
        yield { type: "snapshot:upload_skipped", reason: upload.reason };
      } else {
        yield { type: "snapshot:upload_done", bytes: upload.bytes };
      }
    } catch (e) {
      yield { type: "snapshot:upload_skipped", reason: (e as Error).message };
    }
  }

  yield { type: "done" };
}
