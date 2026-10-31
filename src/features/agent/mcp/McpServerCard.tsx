import { useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Pencil,
  Plug,
  PlugZap,
  ScrollText,
  Trash2,
  Wrench,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { McpServerStatus } from "./types";

const STATE_LABEL: Record<McpServerStatus["state"], string> = {
  idle: "未连接",
  connecting: "连接中",
  ready: "已连接",
  error: "错误",
};

const STATE_CLASS: Record<McpServerStatus["state"], string> = {
  idle: "text-muted-foreground",
  connecting: "text-amber-600 dark:text-amber-400",
  ready: "text-emerald-600 dark:text-emerald-400",
  error: "text-destructive",
};

function StateIcon({ state }: { state: McpServerStatus["state"] }) {
  if (state === "connecting") {
    return <Loader2 className="h-3.5 w-3.5 animate-spin" />;
  }
  if (state === "error") return <AlertCircle className="h-3.5 w-3.5" />;
  if (state === "ready") return <CheckCircle2 className="h-3.5 w-3.5" />;
  return <Plug className="h-3.5 w-3.5" />;
}

export function McpServerCard({
  server,
  busy,
  onToggleEnabled,
  onAction,
  onEdit,
  onTools,
  onLogs,
  onDelete,
}: {
  server: McpServerStatus;
  busy: boolean;
  onToggleEnabled: (enabled: boolean) => void;
  onAction: (action: "connect" | "disconnect" | "reconnect") => void;
  onEdit: () => void;
  onTools: () => void;
  onLogs: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className={cn("flex items-center gap-1.5 text-xs font-medium", STATE_CLASS[server.state])}>
          <StateIcon state={server.state} />
          {STATE_LABEL[server.state]}
        </div>
        <div className="text-sm font-semibold">{server.name}</div>
        <Badge className="font-normal">{server.transport}</Badge>
        <Badge className="font-normal">{server.toolCount} 工具</Badge>
        {server.catalogOnlyCount > 0 ? (
          <Badge className="font-normal">{server.catalogOnlyCount} 需 mcp_call</Badge>
        ) : null}
        {server.approval !== "always" ? (
          <Badge className="font-normal">
            审批：{server.approval === "never" ? "免审批" : "按档位"}
          </Badge>
        ) : null}
        <div className="ml-auto flex items-center gap-1">
          <Switch
            checked={server.enabled}
            disabled={busy}
            onCheckedChange={onToggleEnabled}
            aria-label="启用该服务器"
          />
          {server.state === "ready" ? (
            <Button variant="outline" size="sm" disabled={busy} onClick={() => onAction("disconnect")}>
              断开
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled={busy} onClick={() => onAction("connect")}>
              连接
            </Button>
          )}
          {server.state === "error" ? (
            <Button variant="outline" size="sm" disabled={busy} onClick={() => onAction("reconnect")}>
              <PlugZap className="h-3.5 w-3.5 sm:mr-1" />
              <span className="hidden sm:inline">重连</span>
            </Button>
          ) : null}
          <Button variant="ghost" size="sm" disabled={busy} onClick={onTools} aria-label="工具清单">
            <Wrench className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" disabled={busy} onClick={onLogs} aria-label="日志">
            <ScrollText className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" disabled={busy} onClick={onEdit} aria-label="编辑">
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" disabled={busy} onClick={onDelete} aria-label="删除">
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </div>

      {server.description ? (
        <div className="mt-2 text-xs text-muted-foreground">{server.description}</div>
      ) : null}

      <button
        type="button"
        className="mt-2 w-full truncate text-left font-mono text-[11px] text-muted-foreground transition hover:text-foreground"
        onClick={() => setExpanded((prev) => !prev)}
        title={server.target}
      >
        {server.target}
      </button>

      {expanded ? (
        <div className="mt-2 space-y-0.5 text-[11px] text-muted-foreground">
          {server.serverInfo ? (
            <div>
              服务端：{server.serverInfo.name}@{server.serverInfo.version}
            </div>
          ) : null}
          {server.protocolVersion ? <div>协议版本：{server.protocolVersion}</div> : null}
          <div>
            能力：
            {[
              server.capabilities.tools ? "tools" : "",
              server.capabilities.resources ? "resources" : "",
              server.capabilities.prompts ? "prompts" : "",
            ]
              .filter(Boolean)
              .join("、") || "无"}
          </div>
          {server.lastConnectedAt ? (
            <div>最近连接：{new Date(server.lastConnectedAt).toLocaleString()}</div>
          ) : null}
          {server.reconnectAttempts > 0 ? (
            <div>重连次数：{server.reconnectAttempts}</div>
          ) : null}
        </div>
      ) : null}

      {server.lastError ? (
        <div className="mt-2 rounded-md border border-destructive/40 bg-destructive/5 p-2 text-[11px] text-destructive">
          {server.lastError}
        </div>
      ) : null}
    </div>
  );
}
