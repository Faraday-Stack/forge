import { mkdir, rm } from "node:fs/promises";
import { exec } from "./exec.js";

export async function shallowClone(
  owner: string,
  repo: string,
  token: string,
  branch: string,
  dir: string,
): Promise<void> {
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });

  const remoteUrl = `https://x-access-token:${token}@github.com/${owner}/${repo}.git`;
  await exec("git", [
    "clone",
    "--depth",
    "1",
    "--branch",
    branch,
    remoteUrl,
    dir,
  ]);
  await configureIdentity(dir);
}

export async function configureIdentity(dir: string): Promise<void> {
  await exec("git", [
    "-C",
    dir,
    "config",
    "user.email",
    "agent@faradaystack.dev",
  ]);
  await exec("git", ["-C", dir, "config", "user.name", "Faraday Agent"]);
}

export async function setRemoteWithToken(
  dir: string,
  owner: string,
  repo: string,
  token: string,
): Promise<void> {
  const remoteUrl = `https://x-access-token:${token}@github.com/${owner}/${repo}.git`;
  await exec("git", ["-C", dir, "remote", "set-url", "origin", remoteUrl]);
}

export async function stripTokenFromRemote(
  dir: string,
  owner: string,
  repo: string,
): Promise<void> {
  const remoteUrl = `https://github.com/${owner}/${repo}.git`;
  await exec("git", ["-C", dir, "remote", "set-url", "origin", remoteUrl]);
}
