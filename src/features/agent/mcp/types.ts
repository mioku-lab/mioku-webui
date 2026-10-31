export type McpTransportKind = "stdio" | "http" | "sse";

export type McpApprovalMode = "never" | "always" | "auto";

export type McpServerState = "idle" | "connecting" | "ready" | "error";

export interface McpToolSchema {
  type: "object";
  properties: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
}

export interface McpServerCapabilities {
  tools: boolean;
  resources: boolean;
  prompts: boolean;
}

export interface McpServerStatus {
  name: string;
  transport: McpTransportKind;
  enabled: boolean;
  approval: McpApprovalMode;
  description: string;
  state: McpServerState;
  target: string;
  serverInfo?: { name: string; version: string };
  protocolVersion?: string;
  capabilities: McpServerCapabilities;
  toolCount: number;
  catalogOnlyCount: number;
  lastError?: string;
  lastConnectedAt?: number;
  reconnectAttempts: number;
}

export interface McpToolFilter {
  allow?: string[];
  deny?: string[];
}

export interface McpServerConfig {
  name: string;
  enabled: boolean;
  transport: McpTransportKind;
  description?: string;
  command?: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
  maxTools?: number;
  timeoutMs: number;
  connectTimeoutMs: number;
  toolFilter?: McpToolFilter;
  approval: McpApprovalMode;
}

export interface McpGlobalConfig {
  autoConnect: boolean;
  reconnectDelayMs: number;
  maxConcurrency: number;
  maxTools: number;
  maxResultChars: number;
  maxResultImages: number;
}

export interface McpOverview extends McpGlobalConfig {
  revision: number;
  toolCount: number;
  catalogOnlyCount: number;
  servers: McpServerStatus[];
  configs: McpServerConfig[];
}

export interface McpToolItem {
  publicName: string;
  tool: string;
  description: string;
  catalogOnly: boolean;
  parameters: McpToolSchema;
}

export interface McpLogEntry {
  at: number;
  server: string;
  level: "debug" | "info" | "warn" | "error";
  message: string;
}

export interface McpProbeResult {
  ok: boolean;
  durationMs: number;
  protocolVersion?: string;
  serverInfo?: { name: string; version: string };
  capabilities?: McpServerCapabilities;
  instructions?: string;
  tools: Array<{ name: string; description: string }>;
  error?: string;
}

/** 表单草稿：args 与 toolFilter 用字符串编辑，提交前拆开 */
export interface McpServerDraft {
  name: string;
  enabled: boolean;
  transport: McpTransportKind;
  description: string;
  command: string;
  argsText: string;
  cwd: string;
  env: Array<{ key: string; value: string }>;
  url: string;
  headers: Array<{ key: string; value: string }>;
  maxTools: number;
  timeoutMs: number;
  connectTimeoutMs: number;
  approval: McpApprovalMode;
  allowText: string;
  denyText: string;
  /** 编辑既有服务器时为 true，名字不可改 */
  isEdit: boolean;
}
