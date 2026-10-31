import { apiFetch } from "@/lib/api";
import { draftToPayload } from "./draft";
import type {
  McpLogEntry,
  McpOverview,
  McpProbeResult,
  McpServerDraft,
  McpServerStatus,
  McpToolItem,
} from "./types";

interface Envelope<T> {
  ok: boolean;
  data: T;
}

export async function fetchOverview(): Promise<McpOverview> {
  const res = await apiFetch<Envelope<McpOverview>>("/api/mcp/overview");
  return res.data;
}

export async function upsertServer(
  draft: McpServerDraft,
): Promise<McpServerStatus> {
  const res = await apiFetch<Envelope<McpServerStatus>>("/api/mcp/servers", {
    method: "POST",
    body: JSON.stringify(draftToPayload(draft)),
  });
  return res.data;
}

export async function deleteServer(name: string): Promise<void> {
  await apiFetch(`/api/mcp/servers/${encodeURIComponent(name)}`, {
    method: "DELETE",
  });
}

export async function setServerEnabled(
  name: string,
  enabled: boolean,
): Promise<McpServerStatus> {
  const res = await apiFetch<Envelope<McpServerStatus>>(
    `/api/mcp/servers/${encodeURIComponent(name)}/enabled`,
    { method: "PUT", body: JSON.stringify({ enabled }) },
  );
  return res.data;
}

export async function serverAction(
  name: string,
  action: "connect" | "disconnect" | "reconnect",
): Promise<McpServerStatus> {
  const res = await apiFetch<Envelope<McpServerStatus>>(
    `/api/mcp/servers/${encodeURIComponent(name)}/${action}`,
    { method: "POST" },
  );
  return res.data;
}

export async function fetchServerTools(name: string): Promise<McpToolItem[]> {
  const res = await apiFetch<Envelope<McpToolItem[]>>(
    `/api/mcp/servers/${encodeURIComponent(name)}/tools`,
  );
  return res.data;
}

export async function probeServer(
  draft: McpServerDraft,
): Promise<McpProbeResult> {
  const res = await apiFetch<Envelope<McpProbeResult>>("/api/mcp/probe", {
    method: "POST",
    body: JSON.stringify(draftToPayload(draft)),
  });
  return res.data;
}

export async function fetchLogs(
  server?: string,
  limit = 100,
): Promise<McpLogEntry[]> {
  const query = new URLSearchParams({ limit: String(limit) });
  if (server) query.set("server", server);
  const res = await apiFetch<Envelope<McpLogEntry[]>>(
    `/api/mcp/logs?${query.toString()}`,
  );
  return res.data;
}
