export interface JobInput {
  uid: string;
  requestId: string;
  jobId: string;
  repoFullName: string;
  owner: string;
  repo: string;
  defaultBranch: string;
  snapshotKey?: string;
  prompt: string;
  pageContext?: Record<string, unknown> | null;
  messages?: Array<{ role?: string; content?: unknown }>;
  savedSnapshot?: { overrides?: unknown; insertedComponents?: unknown };
  toolCalls?: unknown;
}

/**
 * The single contract for the agent runner's process environment.
 *
 * Two consumers:
 *   1. The webapp dispatcher (`webapp/src/lib/server/sandbox-dispatch.ts`)
 *      builds a literal of this exact shape and ships it to the sandbox.
 *   2. The runner itself (`sandbox-entry.ts`) casts `process.env` to this
 *      type to read its inputs.
 *
 * Every field is required: the dispatcher reads each contributing webapp env
 * var via `$env/static/private`, so the SvelteKit build fails if any are
 * missing. There are no runtime fallbacks — misconfiguration fails fast.
 *
 * Bedrock is the only agent provider. The dispatcher mints a short-term
 * bearer token from its static AWS credentials and forwards it as
 * AWS_BEARER_TOKEN_BEDROCK — raw access keys never enter the sandbox. The
 * Claude Agent SDK's `CLAUDE_CODE_USE_BEDROCK=1` flag is forced inside the
 * runner itself, so it isn't part of this typed surface.
 */
export type RunnerEnvironment = {
  JOB_INPUT: string;
  GITHUB_TOKEN: string;

  // Working directory the runner clones the customer repo into.
  FARADAY_WORKDIR: "/vercel/sandbox/.faraday-work";

  // Bedrock auth — short-term bearer minted on the host.
  AWS_REGION: string;
  AWS_BEARER_TOKEN_BEDROCK: string;
  // Internal Claude Agent SDK flag. Must be present in process.env at node
  // startup — setting it inside the runner is too late, since the SDK reads
  // it at module-load time. Hardcoded by the dispatcher.
  CLAUDE_CODE_USE_BEDROCK: "1";

  // Snapshot caching.
  BLOB_READ_WRITE_TOKEN: string;
  // Process env values are strings; pin to the 1 GiB default we ship with.
  FARADAY_SNAPSHOT_MAX_BYTES: string;

  // Firestore event mirror.
  FARADAY_FIREBASE_SA_BASE64: string;
  FIREBASE_PROJECT_ID: string;
};

export type JobEvent =
  | { type: "prepare:start"; snapshotKey?: string }
  | { type: "prepare:snapshot_hit" }
  | { type: "prepare:snapshot_miss"; reason: string }
  | {
      type: "prepare:done";
      snapshotHit: boolean;
      lockfileChanged: boolean;
      durationMs: number;
    }
  | { type: "agent:start" }
  | { type: "agent:text_delta"; text: string }
  | { type: "agent:tool_use"; name: string; input: unknown }
  | { type: "agent:done"; summary: string }
  | { type: "pr:opening"; branch: string }
  | {
      type: "pr:opened";
      url: string;
      number: number;
      branch: string;
      summary: string;
    }
  | { type: "pr:no_changes"; summary: string }
  | { type: "snapshot:upload_start" }
  | { type: "snapshot:upload_done"; bytes: number }
  | { type: "snapshot:upload_skipped"; reason: string }
  | { type: "failed"; error: string }
  | { type: "done" };
