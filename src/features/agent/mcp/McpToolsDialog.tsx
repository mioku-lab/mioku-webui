import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/Dialog";
import { fetchServerTools } from "./api";
import type { McpToolItem } from "./types";

export function McpToolsDialog({
  open,
  server,
  onClose,
}: {
  open: boolean;
  server: string;
  onClose: () => void;
}) {
  const [tools, setTools] = useState<McpToolItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState("");

  useEffect(() => {
    if (!open || !server) return;
    setLoading(true);
    fetchServerTools(server)
      .then(setTools)
      .catch(() => setTools([]))
      .finally(() => setLoading(false));
  }, [open, server]);

  return (
    <Dialog
      open={open}
      title={`${server} 的工具`}
      description={`共 ${tools.length} 个；标注「需 mcp_call」的没有进模型工具表，要用 mcp_call 调用。`}
      onClose={onClose}
      className="max-w-3xl"
    >
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          正在加载...
        </div>
      ) : tools.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          该服务器没有暴露工具
        </div>
      ) : (
        <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
          {tools.map((tool) => (
            <div key={tool.publicName} className="rounded-md border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <code className="font-mono text-xs font-semibold">{tool.publicName}</code>
                {tool.catalogOnly ? (
                  <Badge className="border-dashed font-normal">需 mcp_call</Badge>
                ) : null}
                <button
                  type="button"
                  className="ml-auto text-[11px] text-muted-foreground transition hover:text-foreground"
                  onClick={() =>
                    setExpanded((prev) =>
                      prev === tool.publicName ? "" : tool.publicName,
                    )
                  }
                >
                  {expanded === tool.publicName ? "收起参数" : "查看参数"}
                </button>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                服务器上的名字：<code className="font-mono">{tool.tool}</code>
              </div>
              {tool.description ? (
                <div className="mt-1 text-xs">{tool.description}</div>
              ) : null}
              {expanded === tool.publicName ? (
                <pre className="mt-2 max-h-64 overflow-auto rounded bg-secondary/50 p-2 text-[11px]">
                  {JSON.stringify(tool.parameters, null, 2)}
                </pre>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </Dialog>
  );
}
