import type { McpServerConfig, McpServerDraft } from "./types";

export function emptyDraft(): McpServerDraft {
  return {
    name: "",
    enabled: false,
    transport: "stdio",
    description: "",
    command: "",
    argsText: "",
    cwd: "",
    env: [],
    url: "",
    headers: [],
    maxTools: 0,
    timeoutMs: 30_000,
    connectTimeoutMs: 15_000,
    approval: "always",
    allowText: "",
    denyText: "",
    isEdit: false,
  };
}

export function draftFromConfig(config: McpServerConfig): McpServerDraft {
  return {
    ...emptyDraft(),
    name: config.name,
    enabled: config.enabled,
    transport: config.transport,
    description: config.description ?? "",
    command: config.command ?? "",
    argsText: (config.args ?? []).join("\n"),
    cwd: config.cwd ?? "",
    env: Object.entries(config.env ?? {}).map(([key, value]) => ({ key, value })),
    url: config.url ?? "",
    headers: Object.entries(config.headers ?? {}).map(([key, value]) => ({
      key,
      value,
    })),
    maxTools: config.maxTools ?? 0,
    timeoutMs: config.timeoutMs,
    connectTimeoutMs: config.connectTimeoutMs,
    approval: config.approval,
    allowText: (config.toolFilter?.allow ?? []).join("\n"),
    denyText: (config.toolFilter?.deny ?? []).join("\n"),
    isEdit: true,
  };
}

/** 草稿 → 写接口入参；空字段直接省略，让服务端用默认值 */
export function draftToPayload(
  draft: McpServerDraft,
): Record<string, unknown> {
  const kv = (
    list: Array<{ key: string; value: string }>,
  ): Record<string, string> | undefined => {
    const out: Record<string, string> = {};
    for (const item of list) {
      const key = item.key.trim();
      if (key) out[key] = item.value;
    }
    return Object.keys(out).length > 0 ? out : undefined;
  };
  const lines = (text: string): string[] | undefined => {
    const out = text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    return out.length > 0 ? out : undefined;
  };

  const payload: Record<string, unknown> = {
    name: draft.name.trim().toLowerCase(),
    enabled: draft.enabled,
    transport: draft.transport,
    description: draft.description.trim(),
    timeoutMs: draft.timeoutMs,
    connectTimeoutMs: draft.connectTimeoutMs,
    approval: draft.approval,
  };

  if (draft.transport === "stdio") {
    payload.command = draft.command.trim();
    const args = lines(draft.argsText);
    if (args) payload.args = args;
    if (draft.cwd.trim()) payload.cwd = draft.cwd.trim();
    const env = kv(draft.env);
    if (env) payload.env = env;
  } else {
    payload.url = draft.url.trim();
    const headers = kv(draft.headers);
    if (headers) payload.headers = headers;
  }

  if (draft.maxTools > 0) payload.maxTools = draft.maxTools;
  const allow = lines(draft.allowText);
  const deny = lines(draft.denyText);
  if (allow || deny) {
    payload.toolFilter = {
      ...(allow ? { allow } : {}),
      ...(deny ? { deny } : {}),
    };
  }

  return payload;
}

/** 表单只做最基础的拦截，真正的校验在服务端 */
export function validateDraft(draft: McpServerDraft): string | null {
  const name = draft.name.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9_-]{0,23}$/.test(name)) {
    return "名称只能用小写字母、数字、下划线与短横，1-24 字符，且以字母或数字开头";
  }
  if (draft.transport === "stdio" && !draft.command.trim()) {
    return "stdio 传输需要填写启动命令";
  }
  if (draft.transport !== "stdio" && !draft.url.trim()) {
    return "http / sse 传输需要填写服务器地址";
  }
  return null;
}
