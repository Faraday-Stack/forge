import { stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { exec } from "./exec.js";
import { configureIdentity, setRemoteWithToken, shallowClone } from "./clone.js";
import { restoreSnapshot } from "./snapshot.js";

export interface PrepareInput {
  dir: string;
  owner: string;
  repo: string;
  defaultBranch: string;
  token: string;
  snapshotKey?: string;
  expectedLockfileHash?: string;
  blobToken?: string;
}

export interface PrepareResult {
  snapshotHit: boolean;
  lockfileChanged: boolean;
  packageManager: "pnpm" | "npm" | "yarn" | "none";
  lockfileHash: string | null;
}

const LOCKFILES: Array<{ name: string; pm: PrepareResult["packageManager"] }> = [
  { name: "pnpm-lock.yaml", pm: "pnpm" },
  { name: "package-lock.json", pm: "npm" },
  { name: "yarn.lock", pm: "yarn" },
];

async function exists(p: string): Promise<boolean> {
  return (await stat(p).catch(() => null)) !== null;
}

async function detectLockfile(dir: string): Promise<{ pm: PrepareResult["packageManager"]; hash: string | null }> {
  for (const { name, pm } of LOCKFILES) {
    const p = path.join(dir, name);
    if (await exists(p)) {
      const buf = await readFile(p);
      const hash = createHash("sha256").update(buf).digest("hex");
      return { pm, hash };
    }
  }
  return { pm: "none", hash: null };
}

async function installDeps(dir: string, pm: PrepareResult["packageManager"]): Promise<void> {
  if (pm === "pnpm") {
    await exec("pnpm", ["install", "--frozen-lockfile", "--prefer-offline"], { cwd: dir });
  } else if (pm === "npm") {
    await exec("npm", ["ci", "--prefer-offline"], { cwd: dir });
  } else if (pm === "yarn") {
    await exec("yarn", ["install", "--frozen-lockfile", "--prefer-offline"], { cwd: dir });
  }
}

export async function prepareWorkdir(input: PrepareInput): Promise<PrepareResult> {
  const { dir, owner, repo, defaultBranch, token } = input;
  let snapshotHit = false;

  if (input.snapshotKey) {
    try {
      await restoreSnapshot(input.snapshotKey, dir, input.blobToken);
      snapshotHit = true;
    } catch (e) {
      // Fall through to clone path.
      snapshotHit = false;
    }
  }

  if (!snapshotHit) {
    await shallowClone(owner, repo, token, defaultBranch, dir);
  } else {
    await configureIdentity(dir);
    await setRemoteWithToken(dir, owner, repo, token);
    await exec("git", ["-C", dir, "fetch", "origin", defaultBranch, "--depth=50"]);
    await exec("git", ["-C", dir, "reset", "--hard", `origin/${defaultBranch}`]);
    await exec("git", ["-C", dir, "clean", "-fdx", "-e", "node_modules"]);
  }

  const { pm, hash: lockfileHash } = await detectLockfile(dir);
  const lockfileChanged =
    !!input.expectedLockfileHash && !!lockfileHash && input.expectedLockfileHash !== lockfileHash;

  if (pm !== "none") {
    await installDeps(dir, pm);
  }

  return { snapshotHit, lockfileChanged, packageManager: pm, lockfileHash };
}
