import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Download, Loader2, Plus, RefreshCw, Server } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  deleteServer,
  fetchOverview,
  serverAction,
  setServerEnabled,
} from "./api";
import { draftFromConfig, emptyDraft } from "./draft";
import { McpLogsDialog } from "./McpLogsDialog";
import { McpServerCard } from "./McpServerCard";
import { McpServerDialog } from "./McpServerDialog";
import { McpToolsDialog } from "./McpToolsDialog";
import type { McpOverview, McpServerDraft } from "./types";

const REFRESH_INTERVAL_MS = 5000;



export function McpNotInstalled() {
  const navigate = useNavigate();
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary">
          <Server className="h-7 w-7 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <div className="text-base font-semibold">MCP 服务暂未安装</div>
          <p className="max-w-xl text-sm text-muted-foreground">
            请先安装 mioku-service-mcp 服务
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate("/store")}>
          <Download className="h-4 w-4 sm:mr-1" />
          <span className="hidden sm:inline">前往插件市场</span>
        </Button>
      </CardContent>
    </Card>
  );
}

export function McpTab() {
  const [overview, setOverview] = useState<McpOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [draft, setDraft] = useState<McpServerDraft>(emptyDraft());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [toolsFor, setToolsFor] = useState("");
  const [logsFor, setLogsFor] = useState("");
  const [pendingDelete, setPendingDelete] = useState("");

  const reload = useCallback(async () => {
    try {
      setOverview(await fetchOverview());
      setError("");
    } catch (err) {
      setError(String((err as Error)?.message ?? err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  // 只有存在中间态时才轮询，页面不可见时停下
  const unsettled =
    overview?.servers.some(
      (server) => server.state === "connecting" || server.state === "error",
    ) ?? false;
  useEffect(() => {
    if (!unsettled) return;
    const timer = setInterval(() => {
      if (document.hidden) return;
      void reload();
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [unsettled, reload]);

  async function withBusy(key: string, task: () => Promise<void>) {
    setBusy(key);
    try {
      await task();
      await reload();
    } finally {
      setBusy("");
    }
  }

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-6xl border-y py-10 text-center text-sm text-muted-foreground">
        正在加载 MCP 配置...
      </div>
    );
  }

  if (!overview) {
    return (
      <Card>
        <CardContent className="space-y-2 py-16 text-center">
          <div className="text-base font-semibold">MCP 服务没有响应</div>
          <p className="text-sm text-muted-foreground">
            {error || "服务可能已安装但初始化失败，查看日志确认原因"}
          </p>
          <Button variant="outline" onClick={() => void reload()}>
            <RefreshCw className="h-4 w-4 sm:mr-1" />
            <span className="hidden sm:inline">重试</span>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
          <div className="space-y-1">
            <CardTitle>MCP 服务器</CardTitle>
            <CardDescription>
              {overview.servers.length} 个服务器 · {overview.toolCount}{" "}
              个工具进工具表
              {overview.catalogOnlyCount > 0
                ? ` · ${overview.catalogOnlyCount} 个需 mcp_call`
                : ""}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => void reload()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setDraft(emptyDraft());
                setDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">添加服务器</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {overview.servers.length === 0 ? (
            <div className="rounded-md border border-dashed py-12 text-center">
              <div className="text-sm font-medium">还没有 MCP 服务器</div>
            </div>
          ) : (
            overview.servers.map((server) => {
              const config = overview.configs.find(
                (item) => item.name === server.name,
              );
              return (
                <McpServerCard
                  key={server.name}
                  server={server}
                  busy={busy === server.name}
                  onToggleEnabled={(enabled) =>
                    void withBusy(server.name, async () => {
                      await setServerEnabled(server.name, enabled);
                      toast.success(
                        `${enabled ? "已启用" : "已停用"} ${server.name}`,
                      );
                    })
                  }
                  onAction={(action) =>
                    void withBusy(server.name, async () => {
                      await serverAction(server.name, action);
                    })
                  }
                  onEdit={() => {
                    if (!config) return;
                    setDraft(draftFromConfig(config));
                    setDialogOpen(true);
                  }}
                  onTools={() => setToolsFor(server.name)}
                  onLogs={() => setLogsFor(server.name)}
                  onDelete={() => setPendingDelete(server.name)}
                />
              );
            })
          )}
        </CardContent>
      </Card>

      <McpServerDialog
        open={dialogOpen}
        draft={draft}
        onChange={setDraft}
        onClose={() => setDialogOpen(false)}
        onSaved={reload}
      />
      <McpToolsDialog
        open={Boolean(toolsFor)}
        server={toolsFor}
        onClose={() => setToolsFor("")}
      />
      <McpLogsDialog
        open={Boolean(logsFor)}
        server={logsFor}
        onClose={() => setLogsFor("")}
      />
      {pendingDelete ? (
        <ConfirmDialog
          title="删除 MCP 服务器"
          message={`确定删除 ${pendingDelete}？`}
          confirmText="删除"
          variant="danger"
          onCancel={() => setPendingDelete("")}
          onConfirm={() => {
            const name = pendingDelete;
            setPendingDelete("");
            void withBusy(name, async () => {
              await deleteServer(name);
              toast.success(`已删除 ${name}`);
            });
          }}
        />
      ) : null}
    </div>
  );
}
