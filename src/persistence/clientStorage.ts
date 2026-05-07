import type { Snapshot } from "./client";

/**
 * Browser-local mirror of the agent's overrides. Used as an offline cache so
 * mutations survive page reloads even when the host app hasn't wired up the
 * Faraday backend save/load. Backend snapshots remain authoritative — this
 * cache is only consulted when the backend returns nothing.
 *
 * Storage is keyed by `{publishableKey}:{path}` so different routes don't
 * clobber each other. Failures (private mode, quota exceeded) are swallowed —
 * persistence is best-effort.
 */

type PersistMode = "none" | "session" | "user";

function makeKey(publishableKey: string | undefined, path: string): string {
  return `faraday:${publishableKey ?? "anon"}:${path}`;
}

function getStorage(persist: PersistMode): Storage | null {
  if (persist === "none") return null;
  if (typeof window === "undefined") return null;
  try {
    return persist === "session" ? window.sessionStorage : window.localStorage;
  } catch {
    return null;
  }
}

export function loadClientSnapshot(
  persist: PersistMode,
  publishableKey: string | undefined,
  path: string,
): Snapshot | null {
  const storage = getStorage(persist);
  if (!storage) return null;
  try {
    const raw = storage.getItem(makeKey(publishableKey, path));
    if (!raw) return null;
    return JSON.parse(raw) as Snapshot;
  } catch {
    return null;
  }
}

export function saveClientSnapshot(
  persist: PersistMode,
  publishableKey: string | undefined,
  path: string,
  snapshot: Snapshot,
): void {
  const storage = getStorage(persist);
  if (!storage) return;
  try {
    storage.setItem(makeKey(publishableKey, path), JSON.stringify(snapshot));
  } catch {
    /* QuotaExceededError, security exception, etc. — fail silent. */
  }
}

export function clearClientSnapshot(
  persist: PersistMode,
  publishableKey: string | undefined,
  path: string,
): void {
  const storage = getStorage(persist);
  if (!storage) return;
  try {
    storage.removeItem(makeKey(publishableKey, path));
  } catch {
    /* ignore */
  }
}
