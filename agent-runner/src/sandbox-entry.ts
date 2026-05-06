#!/usr/bin/env node
/**
 * CLI entrypoint executed inside the Vercel Sandbox.
 *
 * Reads JSON job input from $JOB_INPUT, runs the executor, and emits each
 * event as NDJSON to stdout AND mirrors it to Firestore at
 * `integrations/{uid}/requests/{requestId}/events/{seq}`. The terminal event
 * also updates `pr.status` on the parent request doc.
 *
 * Webapp dispatcher streams stdout back to the dashboard via SSE; Firestore
 * is the durable record so reconnects and refreshes can replay.
 */
import { runJob } from "./runJob.js";
import type { JobEvent, JobInput, RunnerEnvironment } from "./types.js";

function emit(line: object): void {
  process.stdout.write(JSON.stringify(line) + "\n");
}

async function main(): Promise<void> {
  const env = process.env as unknown as RunnerEnvironment;
  const input = JSON.parse(env.JOB_INPUT) as JobInput;
  const snapshotMaxBytes = Number(env.FARADAY_SNAPSHOT_MAX_BYTES);

  const firestoreWriter = await createFirestoreWriter({
    saBase64: env.FARADAY_FIREBASE_SA_BASE64,
    projectId: env.FIREBASE_PROJECT_ID,
    uid: input.uid,
    requestId: input.requestId,
    jobId: input.jobId,
    repoFullName: input.repoFullName,
  });

  let exitCode = 0;
  try {
    for await (const event of runJob(input, {
      workdir: env.FARADAY_WORKDIR,
      githubToken: env.GITHUB_TOKEN,
      blobToken: env.BLOB_READ_WRITE_TOKEN,
      snapshotMaxBytes,
    })) {
      emit({ event: event, ts: Date.now() });
      try {
        await firestoreWriter.write(event);
      } catch (e) {
        // Don't let a Firestore write error tank the job — SSE still works.
        process.stderr.write(
          `firestore mirror failed: ${(e as Error).message}\n`,
        );
      }
      if (event.type === "failed") exitCode = 1;
    }
  } catch (e) {
    const msg = (e as Error).message;
    emit({ event: { type: "failed", error: msg }, ts: Date.now() });
    await firestoreWriter.write({ type: "failed", error: msg }).catch(() => {});
    exitCode = 1;
  } finally {
    await firestoreWriter.flush().catch(() => {});
  }

  process.exit(exitCode);
}

interface WriterOpts {
  saBase64: string;
  projectId: string;
  uid: string;
  requestId: string;
  jobId: string;
  repoFullName: string;
}

function phaseForEvent(ev: JobEvent): string | null {
  switch (ev.type) {
    case "prepare:start":
      return "preparing";
    case "agent:start":
      return "agent_running";
    case "pr:opening":
      return "opening_pr";
    case "snapshot:upload_start":
      return "uploading_snapshot";
    default:
      return null;
  }
}

interface FirestoreWriter {
  write(ev: JobEvent): Promise<void>;
  flush(): Promise<void>;
}

async function createFirestoreWriter(
  opts: WriterOpts,
): Promise<FirestoreWriter> {
  const { initializeApp, cert, getApps } = await import("firebase-admin/app");
  const { getFirestore, FieldValue, Timestamp } =
    await import("firebase-admin/firestore");

  if (getApps().length === 0) {
    const json = Buffer.from(opts.saBase64, "base64").toString("utf-8");
    initializeApp({
      credential: cert(JSON.parse(json)),
      projectId: opts.projectId,
    });
  }
  const db = getFirestore();
  const reqRef = db
    .collection("integrations")
    .doc(opts.uid)
    .collection("requests")
    .doc(opts.requestId);
  const eventsCol = reqRef.collection("events");

  let seq = 0;
  return {
    async write(ev: JobEvent) {
      const idx = seq++;
      await eventsCol.doc(String(idx).padStart(6, "0")).set({
        seq: idx,
        jobId: opts.jobId,
        ts: Timestamp.now(),
        ...ev,
      });

      const phase = phaseForEvent(ev);
      if (phase) {
        // Non-terminal phase progress; terminal events are handled below.
        await reqRef.set(
          { pr: { phase, lastEventAt: FieldValue.serverTimestamp() } },
          { merge: true },
        );
      }

      // Mirror terminal state onto the parent doc's pr field so the dashboard
      // doesn't need to scan the events subcollection to know status.
      if (ev.type === "pr:opened") {
        await reqRef.set(
          {
            pr: {
              status: "pr_opened",
              phase: "done",
              url: ev.url,
              number: ev.number,
              branch: ev.branch,
              summary: ev.summary,
              repoFullName: opts.repoFullName,
              openedAt: FieldValue.serverTimestamp(),
              lastEventAt: FieldValue.serverTimestamp(),
              error: null,
            },
          },
          { merge: true },
        );
      } else if (ev.type === "pr:no_changes") {
        await reqRef.set(
          {
            pr: {
              status: "failed",
              phase: "done",
              error: "Agent produced no edits.",
              summary: ev.summary,
              repoFullName: opts.repoFullName,
              lastEventAt: FieldValue.serverTimestamp(),
            },
          },
          { merge: true },
        );
      } else if (ev.type === "failed") {
        await reqRef.set(
          {
            pr: {
              status: "failed",
              phase: "failed",
              error: ev.error,
              repoFullName: opts.repoFullName,
              lastEventAt: FieldValue.serverTimestamp(),
            },
          },
          { merge: true },
        );
      }
    },
    async flush() {
      // No batched writes today; placeholder for future buffering.
    },
  };
}

main().catch((e) => {
  emit({
    event: { type: "failed", error: (e as Error).message },
    ts: Date.now(),
  });
  process.exit(1);
});
