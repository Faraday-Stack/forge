import type { AgentConnectionConfig, Override, InsertedComponent } from "../types";

const FARADAY_API_BASE = "https://api.faraday.ai";

export interface Snapshot {
  overrides: Record<string, Override>;
  insertedComponents: Record<string, InsertedComponent[]>;
}

function resolveBase(connection: AgentConnectionConfig): string {
  if (connection.apiUrl) {
    return connection.apiUrl.replace(/\/v1\/stream\/?$/, "").replace(/\/$/, "");
  }
  return FARADAY_API_BASE;
}

function authHeaders(connection: AgentConnectionConfig): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Faraday-Key": connection.publishableKey ?? "",
  };
  if (connection.userToken) {
    headers.Authorization = `Bearer ${connection.userToken}`;
  }
  return headers;
}

export async function saveOverrides(
  connection: AgentConnectionConfig,
  payload: Snapshot & { email: string; messages?: Array<{ role: string; content: unknown }>; pageContext?: unknown },
): Promise<void> {
  const res = await fetch(`${resolveBase(connection)}/v1/save`, {
    method: "POST",
    headers: authHeaders(connection),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Save failed: ${res.status}`);
  }
}

export async function loadOverrides(
  connection: AgentConnectionConfig,
): Promise<Snapshot | null> {
  const res = await fetch(`${resolveBase(connection)}/v1/load`, {
    method: "GET",
    headers: authHeaders(connection),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as Snapshot;
  return data;
}
