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

export type JobEvent =
  | { type: "prepare:start"; snapshotKey?: string }
  | { type: "prepare:snapshot_hit" }
  | { type: "prepare:snapshot_miss"; reason: string }
  | { type: "prepare:done"; snapshotHit: boolean; lockfileChanged: boolean; durationMs: number }
  | { type: "agent:start" }
  | { type: "agent:text_delta"; text: string }
  | { type: "agent:tool_use"; name: string; input: unknown }
  | { type: "agent:done"; summary: string }
  | { type: "pr:opening"; branch: string }
  | { type: "pr:opened"; url: string; number: number; branch: string; summary: string }
  | { type: "pr:no_changes"; summary: string }
  | { type: "snapshot:upload_start" }
  | { type: "snapshot:upload_done"; bytes: number }
  | { type: "snapshot:upload_skipped"; reason: string }
  | { type: "failed"; error: string }
  | { type: "done" };
