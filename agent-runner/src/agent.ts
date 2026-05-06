import { mkdir, readFile, writeFile } from "node:fs/promises";
import { query } from "@anthropic-ai/claude-agent-sdk";
import path from "node:path";

export const SYSTEM_PROMPT = `You are a senior FDE turning a real end-user feature request into a real pull request.
You are operating inside a fresh shallow clone of the customer's repository.

Your job:
1. Read the request, the recorded chat transcript, the page context (modifiable elements with source file/line where
   known), and the runtime overrides the in-page agent applied.
2. Navigate the repo (use Read, Grep, and Bash) to find the existing files that own the relevant UI and any backend
   routes/handlers/data models the change requires.
3. Edit the existing files in place using Edit. Touch backend code when the request needs data or behavior the frontend
   alone cannot deliver. Prefer minimal, surgical changes.
4. Match the project's existing patterns (framework, file layout, naming, tests).
5. Do NOT create a brand-new isolated component file unless that genuinely is the right shape — the goal is the change
   a human FDE would make.

When you finish, write a one-paragraph summary of what you changed and why to .faraday/summary.txt (overwrite it). Keep
the summary under 8 lines.`;

export interface AgentEvent {
  type: "text_delta" | "tool_use";
  text?: string;
  toolName?: string;
  toolInput?: unknown;
}

export interface AgentResult {
  summary: string;
}

export interface RunAgentInput {
  dir: string;
  systemPrompt: string;
  userPrompt: string;
}

export async function* runAgent(
  input: RunAgentInput,
): AsyncGenerator<AgentEvent, AgentResult, void> {
  const meta = path.join(input.dir, ".faraday");
  await mkdir(meta, { recursive: true });
  await writeFile(
    path.join(meta, "prompt.json"),
    JSON.stringify(
      { system: input.systemPrompt, user: input.userPrompt },
      null,
      2,
    ),
  );

  let lastText = "";
  const allText: string[] = [];

  const stream = query({
    prompt: input.userPrompt,
    options: {
      cwd: input.dir,
      systemPrompt: input.systemPrompt,
      allowedTools: ["Read", "Grep", "Edit", "Bash"],
      permissionMode: "acceptEdits",
    },
  });

  for await (const event of stream) {
    if (event.type === "assistant")
      for (const block of event.message.content) {
        if (block.type === "text") {
          lastText = block.text;
          allText.push(block.text);
          yield { type: "text_delta", text: block.text };
        } else {
          yield {
            type: "tool_use",
            toolName: block.name,
            toolInput: block.input,
          };
        }
      }
  }

  const summaryPath = path.join(meta, "summary.txt");
  const summary = (
    await readFile(summaryPath, "utf-8").catch(
      () => lastText || allText.join("\n\n"),
    )
  ).trim();
  return { summary: summary || "(agent produced no summary)" };
}
