import { useEffect, useRef, useState } from "react";
import { Bot, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { apiFetch } from "@/lib/api";
import { useTopbar } from "@/components/layout/TopbarContext";
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges";
import { cn } from "@/lib/utils";
import { DatasourceMultiSelectField } from "@/features/mioku/DatasourceMultiSelectField";
import {
  AgentNotInstalled,
  AgentTodoTab,
  CONTEXT_WINDOW_CHOICES,
  DEFAULT_CONTEXT_WINDOW,
  ModelOverrideSelect,
  formatTokens,
  formatWindowLabel,
  useAgentInstalled,
  useFriendOptions,
} from "./shared";

type PermissionLevel =
  | "read-only"
  | "workspace-write"
  | "auto"
  | "full"
  | "yolo";

type AgentBase = {
  access: { allowAdmins: boolean; users: number[] };
  workspaceDir: string;
  permissionLevel: PermissionLevel;
  model: string;
};

type WebSearchConfig = {
  enabled: boolean;
  baseUrl: string;
  timeoutMs: number;
  defaultLimit: number;
  maxLimit: number;
  maxSearchCount: number;
};

type WebFetchConfig = {
  enabled: boolean;
  timeoutMs: number;
  maxChars: number;
};

type AgentSettings = {
  maxIterations: number;
  maxContextTokens: number;
  stream: boolean;
  enableMarkdownScreenshot: boolean;
  compaction: { enabled: boolean; keepRecentMessages: number };
  bash: { enabled: boolean; timeoutMs: number; approvalTimeoutMs: number };
  dataCollection: { enabled: boolean };
  debug: boolean;
  webSearch: WebSearchConfig;
  webFetch: WebFetchConfig;
};

const emptyBase: AgentBase = {
  access: { allowAdmins: false, users: [] },
  workspaceDir: "",
  permissionLevel: "workspace-write",
  model: "",
};

const emptySettings: AgentSettings = {
  maxIterations: 500,
  maxContextTokens: DEFAULT_CONTEXT_WINDOW,
  stream: true,
  enableMarkdownScreenshot: true,
  compaction: { enabled: true, keepRecentMessages: 20 },
  bash: { enabled: true, timeoutMs: 120000, approvalTimeoutMs: 300000 },
  dataCollection: { enabled: true },
  debug: false,
  webSearch: {
    enabled: true,
    baseUrl: "",
    timeoutMs: 8000,
    defaultLimit: 5,
    maxLimit: 8,
    maxSearchCount: 50,
  },
  webFetch: { enabled: true, timeoutMs: 15000, maxChars: 12000 },
};

const permissionOptions = [
  {
    value: "read-only",
    label: "只读",
    hint: "只能读文件和搜索，bash 全部需要审批",
  },
  {
    value: "workspace-write",
    label: "工作区内写入",
    hint: "文件写入限制在个人工作区内，bash 需要审批",
  },
  {
    value: "auto",
    label: "auto 自动",
    hint: "文件与命令自动执行；每条命令先由工作模型审查，危险操作由用户审批。执行通知与审批请求即时推送",
  },
  {
    value: "full",
    label: "完全访问",
    hint: "无沙箱，文件与命令直接执行；命令与文件改动在回复前合并成一条转发记录",
  },
  {
    value: "yolo",
    label: "yolo 静默",
    hint: "最高权限。不审批、不推送任何中间通知，只把最终结果发给用户",
  },
] as const;

type AgentTab = "base" | "runtime" | "search" | "skills" | "mcp" | "knowledge";

const agentTabs: Array<{ id: AgentTab; label: string; todo?: boolean }> = [
  { id: "base", label: "基本设置" },
  { id: "runtime", label: "运行时" },
  { id: "search", label: "网页搜索" },
  { id: "skills", label: "skills", todo: true },
  { id: "mcp", label: "MCP", todo: true },
  { id: "knowledge", label: "知识库", todo: true },
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

function ToggleField({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-md border p-3">
      <div className="space-y-1">
        <div className="text-sm font-medium">{label}</div>
        {hint ? (
          <div className="text-xs text-muted-foreground">{hint}</div>
        ) : null}
      </div>
      <Switch
        className="shrink-0"
        checked={checked}
        onCheckedChange={onChange}
      />
    </div>
  );
}

export function AgentSettingsPage() {
  const installed = useAgentInstalled();
  const [base, setBase] = useState<AgentBase>(emptyBase);
  const [settings, setSettings] = useState<AgentSettings>(emptySettings);
  const [activeTab, setActiveTab] = useState<AgentTab>("base");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const snapshotRef = useRef("");
  const { setLeftContent, setRightContent } = useTopbar();

  const hasChanges =
    snapshotRef.current.length > 0 &&
    JSON.stringify({ base, settings }) !== snapshotRef.current;

  useUnsavedChanges(hasChanges, {
    message: "Agent 设置还没有保存，确定要离开吗？",
  });

  useEffect(() => {
    if (installed === null) return;
    if (!installed) {
      setLoading(false);
      return;
    }
    const load = async () => {
      setLoading(true);
      try {
        const [baseRes, settingsRes] = await Promise.all([
          apiFetch<{ data: Partial<AgentBase> }>("/api/agent/base"),
          apiFetch<{ data: Partial<AgentSettings> }>("/api/agent/settings"),
        ]);
        const nextBase: AgentBase = {
          access: { ...emptyBase.access, ...(baseRes.data?.access ?? {}) },
          workspaceDir: String(baseRes.data?.workspaceDir ?? ""),
          permissionLevel: permissionOptions.some(
            (option) => option.value === baseRes.data?.permissionLevel,
          )
            ? (baseRes.data?.permissionLevel as PermissionLevel)
            : emptyBase.permissionLevel,
          model: String(baseRes.data?.model ?? ""),
        };
        const nextSettings: AgentSettings = {
          ...emptySettings,
          ...(settingsRes.data ?? {}),
          compaction: {
            ...emptySettings.compaction,
            ...(settingsRes.data?.compaction ?? {}),
          },
          bash: { ...emptySettings.bash, ...(settingsRes.data?.bash ?? {}) },
          dataCollection: {
            ...emptySettings.dataCollection,
            ...(settingsRes.data?.dataCollection ?? {}),
          },
          webSearch: {
            ...emptySettings.webSearch,
            ...(settingsRes.data?.webSearch ?? {}),
          },
          webFetch: {
            ...emptySettings.webFetch,
            ...(settingsRes.data?.webFetch ?? {}),
          },
        };
        setBase(nextBase);
        setSettings(nextSettings);
        snapshotRef.current = JSON.stringify({
          base: nextBase,
          settings: nextSettings,
        });
      } finally {
        setLoading(false);
      }
    };
    load().catch(() => setLoading(false));
  }, [installed]);

  useEffect(() => {
    setLeftContent(
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Bot className="h-4 w-4 text-primary" />
        <span>Agent 设置</span>
      </div>,
    );
    return () => setLeftContent(null);
  }, [setLeftContent]);

  useEffect(() => {
    setRightContent(
      <Button
        onClick={save}
        disabled={saving || loading || !hasChanges || installed === false}
        size="sm"
      >
        <Save className="h-4 w-4 sm:mr-1" />
        <span className="hidden sm:inline">
          {saving ? "保存中..." : "保存"}
        </span>
      </Button>,
    );
    return () => setRightContent(null);
  }, [base, hasChanges, installed, loading, saving, setRightContent, settings]);

  async function save() {
    setSaving(true);
    try {
      await Promise.all([
        apiFetch("/api/agent/base", {
          method: "PUT",
          body: JSON.stringify(base),
        }),
        apiFetch("/api/agent/settings", {
          method: "PUT",
          body: JSON.stringify(settings),
        }),
      ]);
      snapshotRef.current = JSON.stringify({ base, settings });
      toast.success("Agent 设置已保存~");
    } catch {
      toast.error("保存失败，请稍后再试");
    } finally {
      setSaving(false);
    }
  }

  if (installed === false) {
    return <AgentNotInstalled />;
  }

  if (loading || installed === null) {
    return (
      <div className="mx-auto w-full max-w-6xl border-y py-10 text-center text-sm text-muted-foreground">
        正在加载 Agent 配置...
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5">
      <nav aria-label="Agent 设置分类" className="overflow-x-auto border-b">
        <div className="flex min-w-max items-end gap-1">
          {agentTabs.map(({ id, label, todo }) => (
            <button
              key={id}
              type="button"
              aria-current={activeTab === id ? "page" : undefined}
              onClick={() => setActiveTab(id)}
              className={cn(
                "flex h-11 items-center gap-2 border-b-2 px-3 text-sm font-medium transition-[border-color,color,background-color,transform] duration-150 active:scale-[0.98]",
                activeTab === id
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:bg-secondary/50 hover:text-foreground",
              )}
            >
              {label}
              {todo ? (
                <span className="rounded-full border border-dashed px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground">
                  TODO
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </nav>

      {activeTab === "base" ? <BaseTab base={base} setBase={setBase} /> : null}
      {activeTab === "runtime" ? (
        <RuntimeTab settings={settings} setSettings={setSettings} />
      ) : null}
      {activeTab === "search" ? (
        <SearchTab settings={settings} setSettings={setSettings} />
      ) : null}
      {activeTab === "skills" ? (
        <AgentTodoTab
          title="skills"
          description="计划支持从工作区加载外部 skill 并注册到 AI 服务，让 Agent 按需调用可复用的任务说明。"
        />
      ) : null}
      {activeTab === "mcp" ? (
        <AgentTodoTab
          title="MCP"
          description="计划支持接入 Model Context Protocol 服务器，把外部工具以 MCP 客户端的形式暴露给 Agent。"
        />
      ) : null}
      {activeTab === "knowledge" ? (
        <AgentTodoTab
          title="知识库"
          description="计划支持混合检索（向量 + BM25 + 重排）的个人知识库，让 Agent 在回答前先检索长期记忆。"
        />
      ) : null}
    </div>
  );
}

function BaseTab({
  base,
  setBase,
}: {
  base: AgentBase;
  setBase: React.Dispatch<React.SetStateAction<AgentBase>>;
}) {
  const friendOptions = useFriendOptions();

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Agent 基础</CardTitle>
          <CardDescription>
            私聊 Agent 的接入范围。人设与情绪读取 chat
            插件「回复与角色」中的配置，chat 未安装时不下发人设提示词。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ToggleField
            label="允许管理员私聊"
            hint="开启后 bot 管理员也能使用 agent（主人始终可用）"
            checked={base.access.allowAdmins}
            onChange={(checked) =>
              setBase((prev) => ({
                ...prev,
                access: { ...prev.access, allowAdmins: checked },
              }))
            }
          />
          <DatasourceMultiSelectField
            id="agent-access-users"
            label="额外允许的用户"
            description="主人始终可用；这里选中的好友也可以私聊 Agent。"
            placeholder="点击选择好友"
            source="qq_friends"
            options={friendOptions}
            value={(base.access.users ?? []).map(String)}
            onChange={(ids) =>
              setBase((prev) => ({
                ...prev,
                access: {
                  ...prev.access,
                  users: ids
                    .map((id) => Number(id))
                    .filter((id) => Number.isFinite(id) && id > 0),
                },
              }))
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>权限与工作区</CardTitle>
          <CardDescription>
            文件工具按权限级别限制路径；workspace-write / read-only 下每条 bash
            命令都需要你在聊天里回复 .agent approve 批准。
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field
            label="权限级别"
            hint={
              permissionOptions.find(
                (item) => item.value === base.permissionLevel,
              )?.hint
            }
          >
            <Select
              value={base.permissionLevel}
              onValueChange={(value) =>
                setBase((prev) => ({
                  ...prev,
                  permissionLevel: value as PermissionLevel,
                }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {permissionOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field
            label="工作区根目录"
            hint="留空使用 data/agent/workspace；每个 QQ 号使用其下的独立子目录"
          >
            <Input
              value={base.workspaceDir}
              onChange={(e) =>
                setBase((prev) => ({ ...prev, workspaceDir: e.target.value }))
              }
              placeholder="data/agent/workspace"
            />
          </Field>
          <Field
            label="模型覆盖"
            hint="留空跟随 AI 设置中绑定的主模型"
            className="md:col-span-2"
          >
            <ModelOverrideSelect
              value={base.model}
              onChange={(value) =>
                setBase((prev) => ({ ...prev, model: value }))
              }
            />
          </Field>
        </CardContent>
      </Card>
    </div>
  );
}

function RuntimeTab({
  settings,
  setSettings,
}: {
  settings: AgentSettings;
  setSettings: React.Dispatch<React.SetStateAction<AgentSettings>>;
}) {
  const patch = (patchValue: Partial<AgentSettings>) =>
    setSettings((prev) => ({ ...prev, ...patchValue }));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>功能开关</CardTitle>
          <CardDescription>
            Agent 的能力开关，关闭后对应的工具或行为不再生效。
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <ToggleField
            label="流式输出"
            hint="按段落分条发送；full 模式因要先发操作记录，本轮不逐段推送"
            checked={settings.stream}
            onChange={(checked) => patch({ stream: checked })}
          />
          <ToggleField
            label="Markdown 截图"
            hint="<MARKDOWN> 块渲染为图片发送"
            checked={settings.enableMarkdownScreenshot}
            onChange={(checked) => patch({ enableMarkdownScreenshot: checked })}
          />
          <ToggleField
            label="bash 执行"
            hint="关闭后 agent 不再获得命令工具"
            checked={settings.bash.enabled}
            onChange={(checked) =>
              patch({ bash: { ...settings.bash, enabled: checked } })
            }
          />
          <ToggleField
            label="网页阅读"
            hint="web_fetch 抓取 URL 并提取正文纯文本"
            checked={settings.webFetch.enabled}
            onChange={(checked) =>
              patch({ webFetch: { ...settings.webFetch, enabled: checked } })
            }
          />
          <ToggleField
            label="自动压缩"
            hint="超过压缩阈值时把较早对话压成摘要"
            checked={settings.compaction.enabled}
            onChange={(checked) =>
              patch({
                compaction: { ...settings.compaction, enabled: checked },
              })
            }
          />
          <ToggleField
            label="数据收集"
            hint="记录运行与工具调用明细到本地数据库"
            checked={settings.dataCollection.enabled}
            onChange={(checked) =>
              patch({ dataCollection: { enabled: checked } })
            }
          />
          <ToggleField
            label="调试日志"
            hint="输出完整请求 prompt、AI 回复与工具调用明细"
            checked={settings.debug}
            onChange={(checked) => patch({ debug: checked })}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>运行参数</CardTitle>
          <CardDescription>
            Agent 循环与流式输出。温度固定为 1，不对外调整。
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <Field label="最大工具循环轮次">
            <NumberInput
              min={1}
              value={settings.maxIterations}
              onValueChange={(value) => {
                if (value !== null) patch({ maxIterations: value });
              }}
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>上下文窗口与压缩</CardTitle>
          <CardDescription>
            选择上下文窗口后，压缩阈值自动按窗口的 15/16 调整（例如 512K 窗口在
            480K 时压缩），无需手动设置。
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <Field label="上下文窗口">
            <Select
              value={String(settings.maxContextTokens)}
              onValueChange={(value) =>
                patch({ maxContextTokens: Number(value) })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(() => {
                  const known = CONTEXT_WINDOW_CHOICES.some(
                    (choice) => choice.value === settings.maxContextTokens,
                  );
                  return [
                    ...(!known
                      ? [
                          {
                            label: formatWindowLabel(settings.maxContextTokens),
                            value: settings.maxContextTokens,
                          },
                        ]
                      : []),
                    ...CONTEXT_WINDOW_CHOICES,
                  ].map((choice) => (
                    <SelectItem key={choice.value} value={String(choice.value)}>
                      {choice.label}
                    </SelectItem>
                  ));
                })()}
              </SelectContent>
            </Select>
          </Field>
          <Field label="压缩阈值" hint="随窗口自动调整">
            <Input
              value={formatTokens(
                Math.floor(settings.maxContextTokens * 0.9375),
              )}
              disabled
            />
          </Field>
          <Field label="压缩保留最近消息条数">
            <NumberInput
              min={2}
              value={settings.compaction.keepRecentMessages}
              onValueChange={(value) => {
                if (value !== null) {
                  patch({
                    compaction: {
                      ...settings.compaction,
                      keepRecentMessages: value,
                    },
                  });
                }
              }}
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>命令执行</CardTitle>
          <CardDescription>
            bash 在非完全访问权限下需要聊天内审批，超时未审批自动拒绝。
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <Field label="bash 超时 (秒)">
            <NumberInput
              min={5}
              value={settings.bash.timeoutMs / 1000}
              onValueChange={(value) => {
                if (value !== null) {
                  patch({
                    bash: { ...settings.bash, timeoutMs: value * 1000 },
                  });
                }
              }}
            />
          </Field>
          <Field label="审批等待 (秒)" hint="超时自动拒绝">
            <NumberInput
              min={30}
              value={settings.bash.approvalTimeoutMs / 1000}
              onValueChange={(value) => {
                if (value !== null) {
                  patch({
                    bash: { ...settings.bash, approvalTimeoutMs: value * 1000 },
                  });
                }
              }}
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>网页阅读</CardTitle>
          <CardDescription>
            Agent 的 web_fetch 工具抓取指定 URL 并提取正文纯文本。
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <Field label="请求超时 (秒)">
            <NumberInput
              min={1}
              value={settings.webFetch.timeoutMs / 1000}
              onValueChange={(value) => {
                if (value !== null) {
                  patch({
                    webFetch: { ...settings.webFetch, timeoutMs: value * 1000 },
                  });
                }
              }}
            />
          </Field>
          <Field label="正文长度上限" hint="提取文本的最大字符数">
            <NumberInput
              min={500}
              value={settings.webFetch.maxChars}
              onValueChange={(value) => {
                if (value !== null) {
                  patch({
                    webFetch: { ...settings.webFetch, maxChars: value },
                  });
                }
              }}
            />
          </Field>
        </CardContent>
      </Card>
    </div>
  );
}

function SearchTab({
  settings,
  setSettings,
}: {
  settings: AgentSettings;
  setSettings: React.Dispatch<React.SetStateAction<AgentSettings>>;
}) {
  const { webSearch } = settings;
  const updateSearch = (patchValue: Partial<WebSearchConfig>) =>
    setSettings((prev) => ({
      ...prev,
      webSearch: { ...prev.webSearch, ...patchValue },
    }));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>SearXNG 搜索</CardTitle>
          <CardDescription>
            Agent 的 web_search 工具通过 SearXNG 实例检索网页，支持自建实例。
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <ToggleField
            label="启用网页搜索"
            checked={webSearch.enabled}
            onChange={(checked) => updateSearch({ enabled: checked })}
          />
          <Field
            label="SearXNG 实例地址"
            hint="需开启 JSON 输出格式（format=json）"
            className="md:col-span-2"
          >
            <Input
              value={webSearch.baseUrl}
              onChange={(e) => updateSearch({ baseUrl: e.target.value })}
              placeholder="https://searx.example.com/"
            />
          </Field>
          <Field label="请求超时 (秒)">
            <NumberInput
              min={1}
              value={webSearch.timeoutMs / 1000}
              onValueChange={(value) => {
                if (value !== null) updateSearch({ timeoutMs: value * 1000 });
              }}
            />
          </Field>
          <Field label="默认结果数" hint="模型未指定时返回的结果数">
            <NumberInput
              min={1}
              value={webSearch.defaultLimit}
              onValueChange={(value) => {
                if (value !== null) updateSearch({ defaultLimit: value });
              }}
            />
          </Field>
          <Field label="单次结果上限" hint="模型单次搜索最多返回的结果数">
            <NumberInput
              min={1}
              value={webSearch.maxLimit}
              onValueChange={(value) => {
                if (value !== null) updateSearch({ maxLimit: value });
              }}
            />
          </Field>
          <Field
            label="单轮对话搜索上限"
            hint="一轮会话中 agent 最多发起的搜索次数，超过后提示模型停止搜索"
          >
            <NumberInput
              min={1}
              value={webSearch.maxSearchCount}
              onValueChange={(value) => {
                if (value !== null) updateSearch({ maxSearchCount: value });
              }}
            />
          </Field>
        </CardContent>
      </Card>
    </div>
  );
}
