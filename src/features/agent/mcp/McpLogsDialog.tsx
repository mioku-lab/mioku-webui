import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/Dialog";
import { cn } from "@/lib/utils";
import { fetchLogs } from "./api";
import type { McpLogEntry } from "./types";

const LEVEL_CLASS: Record<McpLogEntry["level"], string> = {
  debug: "text-muted-foreground",
  info: "text-foreground",
  warn: "text-amber-600 dark:text-amber-400",
  error: "text-destructive",
};

function formatTime(at: number): string {
  const date = new Date(at);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function McpLogsDialog({
  open,
  server,
  onClose,
}: {
  open: boolean;
  server: string;
  onClose: () => void;
}) {
  const [logs, setLogs] = useState<McpLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!server) return;
    setLoading(true);
    try {
      setLogs(await fetchLogs(server, 100));
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [server]);

  useEffect(() => {
    if (open) void reload();
  }, [open, reload]);

  return (
    <Dialog
      open={open}
      title={`${server} 的日志`}
      description="每个服务器保留最近 100 条"
      onClose={onClose}
      className="max-w-3xl"
      footer={
        <Button variant="outline" onClick={reload} disabled={loading}>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin sm:mr-1" />
          ) : (
            <RefreshCw className="h-4 w-4 sm:mr-1" />
          )}
          <span className="hidden sm:inline">刷新</span>
        </Button>
      }
    >
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          正在加载...
        </div>
      ) : logs.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          还没有日志
        </div>
      ) : (
        <div className="max-h-[60vh] space-y-1 overflow-y-auto rounded-md bg-secondary/40 p-3 font-mono text-[11px]">
          {logs.map((entry, index) => (
            <div key={index} className="flex gap-2">
              <span className="shrink-0 text-muted-foreground">
                {formatTime(entry.at)}
              </span>
              <span
                className={cn("shrink-0 uppercase", LEVEL_CLASS[entry.level])}
              >
                {entry.level}
              </span>
              <span className="break-all whitespace-pre-wrap">
                {entry.message}
              </span>
            </div>
          ))}
        </div>
      )}
    </Dialog>
  );
}
