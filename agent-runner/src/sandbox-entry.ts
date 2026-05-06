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
import type { JobEvent, JobInput } from "./types.js";

interface SandboxEnv {
  JOB_INPUT: string;
  GITHUB_TOKEN: string;
  ANTHROPIC_API_KEY?: string;
  ANTHROPIC_MODEL?: string;
  BLOB_READ_WRITE_TOKEN?: string;
  FARADAY_FIREBASE_SA_BASE64?: string;
  FIREBASE_PROJECT_ID?: string;
  FARADAY_SNAPSHOT_MAX_BYTES?: string;
  FARADAY_WORKDIR?: string;
}

function emit(line: object): void {
  process.stdout.write(JSON.stringify(line) + "\n");
}

async function main(): Promise<void> {
  const env = process.env as unknown as SandboxEnv;
  if (!env.JOB_INPUT) throw new Error("JOB_INPUT env var missing");
  if (!env.GITHUB_TOKEN) throw new Error("GITHUB_TOKEN env var missing");

  const input = JSON.parse(env.JOB_INPUT) as JobInput;
  const workdir = env.FARADAY_WORKDIR ?? "/work";
  const snapshotMaxBytes = Number(env.FARADAY_SNAPSHOT_MAX_BYTES ?? 1_073_741_824);

  let firestoreWriter: FirestoreWriter | null = null;
  if (env.FARADAY_FIREBASE_SA_BASE64 && env.FIREBASE_PROJECT_ID) {
    firestoreWriter = await createFirestoreWriter({
      saBase64: env.FARADAY_FIREBASE_SA_BASE64,
      projectId: env.FIREBASE_PROJECT_ID,
      uid: input.uid,
      requestId: input.requestId,
      jobId: input.jobId,
      repoFullName: input.repoFullName,
    });
  }

  let exitCode = 0;
  try {
    for await (const ev of runJob(input, {
      workdir,
      githubToken: env.GITHUB_TOKEN,
      blobToken: env.BLOB_READ_WRITE_TOKEN,
      snapshotMaxBytes,
    })) {
      emit({ event: ev, ts: Date.now() });
      if (firestoreWriter) {
        try {
          await firestoreWriter.write(ev);
        } catch (e) {
          // Don't let a Firestore write error tank the job — SSE still works.
          process.stderr.write(`firestore mirror failed: ${(e as Error).message}\n`);
        }
      }
      if (ev.type === "failed") exitCode = 1;
    }
  } catch (e) {
    const msg = (e as Error).message;
    emit({ event: { type: "failed", error: msg }, ts: Date.now() });
    if (firestoreWriter) await firestoreWriter.write({ type: "failed", error: msg }).catch(() => {});
    exitCode = 1;
  } finally {
    if (firestoreWriter) await firestoreWriter.flush().catch(() => {});
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

interface FirestoreWriter {
  write(ev: JobEvent): Promise<void>;
  flush(): Promise<void>;
}

async function createFirestoreWriter(opts: WriterOpts): Promise<FirestoreWriter> {
  const { initializeApp, cert, getApps } = await import("firebase-admin/app");
  const { getFirestore, FieldValue, Timestamp } = await import("firebase-admin/firestore");

  if (getApps().length === 0) {
    const json = Buffer.from(opts.saBase64, "base64").toString("utf-8");
    initializeApp({ credential: cert(JSON.parse(json)), projectId: opts.projectId });
  }
  const db = getFirestore();
  const reqRef = db.collection("integrations").doc(opts.uid).collection("requests").doc(opts.requestId);
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

      // Mirror terminal state onto the parent doc's pr field so the dashboard
      // doesn't need to scan the events subcollection to know status.
      if (ev.type === "pr:opened") {
        await reqRef.set(
          {
            pr: {
              status: "pr_opened",
              url: ev.url,
              number: ev.number,
              branch: ev.branch,
              summary: ev.summary,
              repoFullName: opts.repoFullName,
              openedAt: FieldValue.serverTimestamp(),
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
              error: "Agent produced no edits.",
              summary: ev.summary,
              repoFullName: opts.repoFullName,
            },
          },
          { merge: true },
        );
      } else if (ev.type === "failed") {
        await reqRef.set(
          {
            pr: {
              status: "failed",
              error: ev.error,
              repoFullName: opts.repoFullName,
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
  emit({ event: { type: "failed", error: (e as Error).message }, ts: Date.now() });
  process.exit(1);
});
