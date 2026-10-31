import { useState } from "react";
import { Loader2, PlugZap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { probeServer, upsertServer } from "./api";
import { validateDraft } from "./draft";
import { McpKeyValueEditor } from "./McpKeyValueEditor";
import type {
  McpApprovalMode,
  McpProbeResult,
  McpServerDraft,
  McpTransportKind,
} from "./types";

const TRANSPORTS: Array<{
  value: McpTransportKind;
  label: string;
  hint: string;
}> = [
  { value: "stdio", label: "stdio", hint: "本地子进程，通过标准输入输出通信" },
  {
    value: "http",
    label: "Streamable HTTP",
    hint: "远端服务器，POST + 可选 SSE 流",
  },
  {
    value: "sse",
    label: "SSE（旧版）",
    hint: "2024-11-05 时代的 HTTP+SSE 传输",
  },
];

const APPROVALS: Array<{
  value: McpApprovalMode;
  label: string;
  hint: string;
}> = [
  {
    value: "always",
    label: "每次审批",
    hint: "每次调用都要在聊天里回复 .agent approve 批准",
  },
  {
    value: "auto",
    label: "执行告知",
    hint: "不审批，但每次调用都会推送一条执行通知",
  },
  { value: "never", label: "静默执行", hint: "不审批、不通知，直接执行" },
];

function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <div className="text-sm font-medium">{label}</div>
      {hint ? (
        <div className="text-xs text-muted-foreground">{hint}</div>
      ) : null}
      {children}
    </div>
  );
}

function ProbeResult({ result }: { result: McpProbeResult }) {
  if (!result.ok) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs">
        <div className="font-medium text-destructive">自检失败</div>
        <div className="mt-1 break-all text-muted-foreground">
          {result.error}
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-1 rounded-md border p-3 text-xs">
      <div className="font-medium text-emerald-600 dark:text-emerald-400">
        连接成功（{result.durationMs}ms）
      </div>
      <div className="text-muted-foreground">
        服务端：{result.serverInfo?.name ?? "?"}@
        {result.serverInfo?.version ?? "?"}
        {" · "}协议 {result.protocolVersion ?? "?"}
      </div>
      <div className="text-muted-foreground">
        能力：
        {[
          result.capabilities?.tools ? "tools" : "",
          result.capabilities?.resources ? "resources" : "",
          result.capabilities?.prompts ? "prompts" : "",
        ]
          .filter(Boolean)
          .join("、") || "无"}
      </div>
      <div className="text-muted-foreground">
        工具 {result.tools.length} 个：
        {result.tools
          .slice(0, 8)
          .map((tool) => tool.name)
          .join("、")}
        {result.tools.length > 8 ? ` …等 ${result.tools.length} 个` : ""}
      </div>
    </div>
  );
}

export function McpServerDialog({
  open,
  draft,
  onChange,
  onClose,
  onSaved,
}: {
  open: boolean;
  draft: McpServerDraft;
  onChange: (draft: McpServerDraft) => void;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}) {
  const [saving, setSaving] = useState(false);
  const [probing, setProbing] = useState(false);
  const [probe, setProbe] = useState<McpProbeResult | null>(null);

  const patch = (next: Partial<McpServerDraft>) =>
    onChange({ ...draft, ...next });

  async function runProbe() {
    const error = validateDraft(draft);
    if (error) {
      toast.error(error);
      return;
    }
    setProbing(true);
    setProbe(null);
    try {
      setProbe(await probeServer(draft));
    } finally {
      setProbing(false);
    }
  }

  async function save() {
    const error = validateDraft(draft);
    if (error) {
      toast.error(error);
      return;
    }
    setSaving(true);
    try {
      await upsertServer(draft);
      await onSaved();
      toast.success(
        draft.isEdit ? `已保存 ${draft.name}` : `已添加 ${draft.name}`,
      );
      onClose();
    } finally {
      setSaving(false);
    }
  }

  const transportHint = TRANSPORTS.find(
    (item) => item.value === draft.transport,
  )?.hint;

  return (
    <Dialog
      open={open}
      title={draft.isEdit ? `编辑 ${draft.name}` : "添加 MCP 服务器"}
      description="密钥字段显示为 **** 时表示保留原值；改动只作用于这一项。"
      onClose={onClose}
      className="max-w-2xl"
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            onClick={runProbe}
            disabled={probing}
          >
            {probing ? (
              <Loader2 className="h-4 w-4 animate-spin sm:mr-1" />
            ) : (
              <PlugZap className="h-4 w-4 sm:mr-1" />
            )}
            <span className="hidden sm:inline">自检</span>
          </Button>
          <Button type="button" onClick={save} disabled={saving}>
            {saving ? "保存中..." : "保存"}
          </Button>
        </>
      }
    >
      <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="名称" hint="同时作为工具名前缀：mcp__<名称>__<工具>">
            <Input
              value={draft.name}
              disabled={draft.isEdit}
              placeholder="github"
              onChange={(e) => patch({ name: e.target.value })}
            />
          </Field>
          <Field label="备注" hint="仅 WebUI 展示">
            <Input
              value={draft.description}
              placeholder="GitHub 远端服务器"
              onChange={(e) => patch({ description: e.target.value })}
            />
          </Field>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="传输方式" hint={transportHint}>
            <Select
              value={draft.transport}
              onValueChange={(value) =>
                patch({ transport: value as McpTransportKind })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRANSPORTS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field
            label="调用审批"
            hint={APPROVALS.find((item) => item.value === draft.approval)?.hint}
          >
            <Select
              value={draft.approval}
              onValueChange={(value) =>
                patch({ approval: value as McpApprovalMode })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {APPROVALS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        {draft.transport === "stdio" ? (
          <>
            <Field
              label="启动命令"
              hint="等价于把这条命令交给 shell 执行，请只填可信来源"
            >
              <Input
                value={draft.command}
                placeholder="npx"
                className="font-mono text-xs"
                onChange={(e) => patch({ command: e.target.value })}
              />
            </Field>
            <Field label="参数" hint="每行一个参数">
              <Textarea
                value={draft.argsText}
                rows={3}
                placeholder={
                  "-y\n@modelcontextprotocol/server-filesystem\n/srv/data"
                }
                className="font-mono text-xs"
                onChange={(e) => patch({ argsText: e.target.value })}
              />
            </Field>
            <Field label="工作目录" hint="留空使用机器人根目录">
              <Input
                value={draft.cwd}
                placeholder="/srv/data"
                className="font-mono text-xs"
                onChange={(e) => patch({ cwd: e.target.value })}
              />
            </Field>
            <McpKeyValueEditor
              label="环境变量"
              hint="子进程只继承 PATH / HOME 等安全变量，这里追加的会覆盖同名项"
              rows={draft.env}
              onChange={(env) => patch({ env })}
              keyPlaceholder="GITHUB_TOKEN"
              valuePlaceholder="ghp_…"
            />
          </>
        ) : (
          <>
            <Field label="服务器地址">
              <Input
                value={draft.url}
                placeholder="https://api.example.com/mcp"
                className="font-mono text-xs"
                onChange={(e) => patch({ url: e.target.value })}
              />
            </Field>
            <McpKeyValueEditor
              label="请求头"
              hint="用于 Bearer Token 等鉴权头"
              rows={draft.headers}
              onChange={(headers) => patch({ headers })}
              keyPlaceholder="Authorization"
              valuePlaceholder="Bearer …"
            />
          </>
        )}

        <div className="grid gap-4 md:grid-cols-3">
          <Field
            label="工具数上限"
            hint="0 表示跟随全局；溢出的工具仍可用 mcp_call 调用"
          >
            <NumberInput
              min={0}
              value={draft.maxTools}
              onValueChange={(value) => {
                if (value !== null) patch({ maxTools: value });
              }}
            />
          </Field>
          <Field label="调用超时 (秒)">
            <NumberInput
              min={1}
              value={Math.round(draft.timeoutMs / 1000)}
              onValueChange={(value) => {
                if (value !== null) patch({ timeoutMs: value * 1000 });
              }}
            />
          </Field>
          <Field label="连接超时 (秒)">
            <NumberInput
              min={1}
              value={Math.round(draft.connectTimeoutMs / 1000)}
              onValueChange={(value) => {
                if (value !== null) patch({ connectTimeoutMs: value * 1000 });
              }}
            />
          </Field>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Field
            label="工具白名单"
            hint="每行一条 glob，如 get_*；留空表示不按白名单过滤"
          >
            <Textarea
              value={draft.allowText}
              rows={2}
              className="font-mono text-xs"
              onChange={(e) => patch({ allowText: e.target.value })}
            />
          </Field>
          <Field label="工具黑名单" hint="每行一条 glob，如 delete_*">
            <Textarea
              value={draft.denyText}
              rows={2}
              className="font-mono text-xs"
              onChange={(e) => patch({ denyText: e.target.value })}
            />
          </Field>
        </div>

        <div className="flex items-center justify-between gap-4 rounded-md border p-3">
          <div className="space-y-1">
            <div className="text-sm font-medium">启用并自动连接</div>
          </div>
          <Switch
            className="shrink-0"
            checked={draft.enabled}
            onCheckedChange={(enabled) => patch({ enabled })}
          />
        </div>

        {probe ? <ProbeResult result={probe} /> : null}
      </div>
    </Dialog>
  );
}
