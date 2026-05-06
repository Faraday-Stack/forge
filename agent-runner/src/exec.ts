import { execFile } from "node:child_process";
import { promisify } from "node:util";

const _execFile = promisify(execFile);

export interface ExecOpts {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  maxBuffer?: number;
}

export async function exec(cmd: string, args: string[], opts: ExecOpts = {}): Promise<{ stdout: string; stderr: string }> {
  const { stdout, stderr } = await _execFile(cmd, args, {
    cwd: opts.cwd,
    env: opts.env ?? process.env,
    maxBuffer: opts.maxBuffer ?? 64 * 1024 * 1024,
  });
  return { stdout: stdout.toString(), stderr: stderr.toString() };
}
