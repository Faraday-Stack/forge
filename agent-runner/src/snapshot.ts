import { spawn } from "node:child_process";
import { stat, mkdir } from "node:fs/promises";
import { Readable } from "node:stream";
import { ReadableStream as NodeReadableStream } from "node:stream/web";
import { put, head, del } from "@vercel/blob";

export interface SnapshotInfo {
  bytes: number;
  url: string;
}

export interface UploadOpts {
  maxBytes: number;
  token?: string;
}

/**
 * Stream-download the snapshot from Vercel Blob and untar+unzstd into `dir`.
 * Uses system `tar` (with `--use-compress-program=unzstd`) so we don't need
 * native zstd bindings.
 */
export async function restoreSnapshot(key: string, dir: string, token?: string): Promise<void> {
  await mkdir(dir, { recursive: true });
  const meta = await head(key, token ? { token } : undefined);
  const r = await fetch(meta.url);
  if (!r.ok || !r.body) throw new Error(`snapshot fetch failed (${r.status})`);

  const child = spawn("tar", ["-x", "--use-compress-program=unzstd", "-C", dir], {
    stdio: ["pipe", "inherit", "inherit"],
  });

  const nodeStream = Readable.fromWeb(r.body as unknown as NodeReadableStream);
  await new Promise<void>((resolve, reject) => {
    nodeStream.on("error", reject);
    child.on("error", reject);
    child.on("exit", (code, signal) =>
      code === 0 ? resolve() : reject(new Error(`tar exited ${code ?? `signal ${signal}`}`)),
    );
    nodeStream.pipe(child.stdin!);
  });
}

/**
 * Create `tar | zstd` of `dir` (including .git and node_modules) and upload to
 * Vercel Blob. Refuses if the resulting tarball would exceed `maxBytes`.
 *
 * We tee the compressed stream to (a) a size counter and (b) Blob's `put`.
 * Because Blob currently needs a known body, we buffer in chunks and abort if
 * the running total exceeds the cap before sending.
 */
export async function uploadSnapshot(key: string, dir: string, opts: UploadOpts): Promise<SnapshotInfo | { skipped: true; reason: string }> {
  const tar = spawn(
    "tar",
    [
      "-c",
      "--use-compress-program=zstd -3 -T0",
      "-C",
      dir,
      "--exclude=.faraday",
      ".",
    ],
    { stdio: ["ignore", "pipe", "inherit"] },
  );

  const chunks: Uint8Array[] = [];
  let bytes = 0;
  let aborted: string | null = null;

  for await (const chunk of tar.stdout!) {
    if (aborted) continue;
    bytes += chunk.length;
    if (bytes > opts.maxBytes) {
      aborted = `snapshot exceeded ${opts.maxBytes} bytes`;
      tar.kill("SIGTERM");
      continue;
    }
    chunks.push(chunk);
  }

  await new Promise<void>((resolve, reject) => {
    tar.on("error", reject);
    tar.on("exit", (code, signal) => {
      if (aborted) return resolve();
      code === 0 ? resolve() : reject(new Error(`tar exited ${code ?? `signal ${signal}`}`));
    });
  });

  if (aborted) return { skipped: true, reason: aborted };

  const body = Buffer.concat(chunks);
  // Idempotent overwrite: snapshots are content-addressed by lockfile hash, so
  // rewriting the same key after restore-then-modify is the intended behavior.
  // Vercel Blob refuses overwrites by default, so delete first.
  await del(key, opts.token ? { token: opts.token } : undefined).catch(() => {});
  const blob = await put(key, body, {
    access: "public",
    contentType: "application/zstd",
    addRandomSuffix: false,
    token: opts.token,
  });
  return { bytes, url: blob.url };
}

export async function deleteSnapshot(key: string, token?: string): Promise<void> {
  await del(key, token ? { token } : undefined);
}

export async function snapshotSizeOnDisk(dir: string): Promise<number> {
  const s = await stat(dir).catch(() => null);
  return s?.size ?? 0;
}
