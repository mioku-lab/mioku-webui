import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiFetch } from "@/lib/api";

export type AIProtocol =
  | "openai-chat"
  | "openai-response"
  | "anthropic"
  | "gemini";

export type AIModelRole = "main" | "working" | "vision";

export type AIProvider = {
  id: string;
  name: string;
  protocol: AIProtocol;
  apiUrl: string;
  apiKey?: string;
  hasApiKey?: boolean;
  enabled: boolean;
};

export type AIModel = {
  id: string;
  providerId: string;
  modelId: string;
  name: string;
  capabilities: string[];
  isCustom?: boolean;
  thinkingLevel?: string;
};

export type RoleBindings = Record<AIModelRole, string | undefined>;

const PROTOCOL_OPTIONS: Array<{
  value: AIProtocol;
  label: string;
  defaultUrl: string;
}> = [
  {
    value: "openai-chat",
    label: "OpenAI Chat",
    defaultUrl: "https://api.openai.com/v1",
  },
  {
    value: "openai-response",
    label: "OpenAI Response",
    defaultUrl: "https://api.openai.com/v1",
  },
  {
    value: "anthropic",
    label: "Anthropic",
    defaultUrl: "https://api.anthropic.com",
  },
  {
    value: "gemini",
    label: "Gemini",
    defaultUrl: "https://generativelanguage.googleapis.com",
  },
];

const ROLE_META: Array<{
  role: AIModelRole;
  title: string;
  hint: string;
}> = [
  { role: "main", title: "主模型", hint: "正式回复，智商优先" },
  { role: "working", title: "工作模型", hint: "planner 等轻量任务，速度优先" },
  { role: "vision", title: "视觉模型", hint: "图片/视频描述，成本优先" },
];

const THINKING_LEVEL_OPTIONS = [
  { value: "off", label: "off" },
  { value: "low", label: "low" },
  { value: "medium", label: "medium" },
  { value: "high", label: "high" },
  { value: "xhigh", label: "xhigh" },
  { value: "max", label: "max" },
] as const;

// gemini 协议只有 off / low / medium / high 四档
const GEMINI_THINKING_LEVEL_OPTIONS = THINKING_LEVEL_OPTIONS.filter((option) =>
  ["off", "low", "medium", "high"].includes(option.value),
);

const thinkingOptionsFor = (protocol?: AIProtocol) =>
  protocol === "gemini"
    ? GEMINI_THINKING_LEVEL_OPTIONS
    : THINKING_LEVEL_OPTIONS;

type AddModelFormState = {
  providerId: string;
  modelId: string;
  name: string;
  vision: boolean;
  toolUse: boolean;
};

const emptyAddModelForm = (): AddModelFormState => ({
  providerId: "",
  modelId: "",
  name: "",
  vision: false,
  toolUse: false,
});

type ProviderForm = {
  id?: string;
  name: string;
  protocol: AIProtocol;
  apiUrl: string;
  apiKey: string;
  enabled: boolean;
};

const emptyForm = (): ProviderForm => ({
  name: "",
  protocol: "openai-chat",
  apiUrl: "https://api.openai.com/v1",
  apiKey: "",
  enabled: true,
});

type Props = {
  temperature: number;
  maxIterations: number;
  onBaseChange: (patch: {
    temperature?: number;
    maxIterations?: number;
  }) => void;
};

export function ProvidersModelsTab({
  temperature,
  maxIterations,
  onBaseChange,
}: Props) {
  const [providers, setProviders] = useState<AIProvider[]>([]);
  const [models, setModels] = useState<AIModel[]>([]);
  const [roles, setRoles] = useState<RoleBindings>({
    main: undefined,
    working: undefined,
    vision: undefined,
  });
  const [fallbackChain, setFallbackChain] = useState<string[]>([]);
  const [fallbackOn, setFallbackOn] = useState<boolean>(true);
  const [fallbackSaving, setFallbackSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<ProviderForm>(emptyForm());
  const [addModelOpen, setAddModelOpen] = useState(false);
  const [addModelForm, setAddModelForm] = useState<AddModelFormState>(
    emptyAddModelForm(),
  );
  const [addModelSaving, setAddModelSaving] = useState(false);
  const [fallbackAddOpen, setFallbackAddOpen] = useState(false);
  const [fallbackCandidate, setFallbackCandidate] = useState("");

  const load = async (options: { silent?: boolean } = {}) => {
    // silent：后台刷新数据但不显示加载占位，避免每次改动都整页闪烁
    if (!options.silent) setLoading(true);
    try {
      const [providersRes, modelsRes, rolesRes, fallbackRes] =
        await Promise.all([
          apiFetch<{ data: AIProvider[] }>("/api/ai/providers"),
          apiFetch<{ data: AIModel[] }>("/api/ai/models"),
          apiFetch<{ data: RoleBindings }>("/api/ai/roles"),
          apiFetch<{
            data: {
              fallback: string[];
              fallbackOnError: boolean;
              liveFallback: string[];
            };
          }>("/api/ai/fallback"),
        ]);
      setProviders(providersRes.data || []);
      setModels(modelsRes.data || []);
      setRoles({
        main: rolesRes.data?.main,
        working: rolesRes.data?.working,
        vision: rolesRes.data?.vision,
      });
      setFallbackChain(fallbackRes.data?.fallback ?? []);
      setFallbackOn(fallbackRes.data?.fallbackOnError ?? true);
    } finally {
      if (!options.silent) setLoading(false);
    }
  };

  useEffect(() => {
    load().catch(() => {});
  }, []);

  const modelsByProvider = useMemo(() => {
    const map = new Map<string, AIModel[]>();
    for (const model of models) {
      const list = map.get(model.providerId) || [];
      list.push(model);
      map.set(model.providerId, list);
    }
    return map;
  }, [models]);

  const openCreate = () => {
    setForm(emptyForm());
    setFormOpen(true);
  };

  const openEdit = (provider: AIProvider) => {
    setForm({
      id: provider.id,
      name: provider.name,
      protocol: provider.protocol,
      apiUrl: provider.apiUrl,
      apiKey: "",
      enabled: provider.enabled,
    });
    setFormOpen(true);
  };

  const saveProvider = async () => {
    setSaving(true);
    try {
      if (form.id) {
        await apiFetch(`/api/ai/providers/${form.id}`, {
          method: "PUT",
          body: JSON.stringify({
            name: form.name,
            protocol: form.protocol,
            apiUrl: form.apiUrl,
            enabled: form.enabled,
            ...(form.apiKey ? { apiKey: form.apiKey } : {}),
          }),
        });
        toast.success("提供商已更新");
      } else {
        await apiFetch("/api/ai/providers", {
          method: "POST",
          body: JSON.stringify(form),
        });
        toast.success("提供商已创建");
      }
      setFormOpen(false);
      await load({ silent: true });
    } finally {
      setSaving(false);
    }
  };

  const removeProvider = async (id: string) => {
    if (!window.confirm("确定删除该提供商？相关模型与角色绑定也会清理。"))
      return;
    await apiFetch(`/api/ai/providers/${id}`, { method: "DELETE" });
    toast.success("提供商已删除");
    await load({ silent: true });
  };

  const testProvider = async (id: string) => {
    setTestingId(id);
    try {
      const res = await apiFetch<{
        data: { ok: boolean; error?: string; models?: AIModel[] };
      }>(`/api/ai/providers/${id}/test`, { method: "POST" });
      if (res.data?.ok) {
        toast.success(
          `连通成功${res.data.models?.length ? `，模型 ${res.data.models.length} 个` : ""}`,
        );
        await load({ silent: true });
      } else {
        toast.error(res.data?.error || "连通失败");
      }
    } finally {
      setTestingId(null);
    }
  };

  const refreshModels = async (id: string) => {
    await apiFetch(`/api/ai/providers/${id}/models/refresh`, {
      method: "POST",
    });
    toast.success("模型列表已刷新");
    await load({ silent: true });
  };

  const saveRoles = async (next: RoleBindings) => {
    setRoles(next);
    await apiFetch("/api/ai/roles", {
      method: "PUT",
      body: JSON.stringify(next),
    });
    toast.success("角色绑定已保存");
  };

  const saveFallback = async (chain: string[], _on?: boolean) => {
    setFallbackSaving(true);
    try {
      const res = await apiFetch<{
        data: { fallback: string[]; liveFallback: string[] };
      }>("/api/ai/fallback", {
        method: "PUT",
        body: JSON.stringify({ fallback: chain }),
      });
      setFallbackChain(res.data?.fallback ?? chain);
      toast.success(
        chain.length > 0
          ? `主模型错误转移链已保存（${chain.length} 项）`
          : "主模型错误转移已关闭",
      );
    } finally {
      setFallbackSaving(false);
    }
  };

  const modelLabel = (id: string): string => {
    const found = models.find((m) => m.id === id);
    if (!found) return id;
    const provider = providers.find((p) => p.id === found.providerId);
    return `${provider?.name ?? found.providerId} / ${found.name || found.modelId}`;
  };

  const submitAddModel = async () => {
    if (!addModelForm.providerId || !addModelForm.modelId.trim()) {
      toast.error("请填写提供商和模型 ID");
      return;
    }
    setAddModelSaving(true);
    try {
      const capabilities = ["text"];
      if (addModelForm.vision) capabilities.push("vision");
      if (addModelForm.toolUse) capabilities.push("tool-use");
      const res = await apiFetch<{ data: AIModel }>("/api/ai/models", {
        method: "POST",
        body: JSON.stringify({
          providerId: addModelForm.providerId,
          modelId: addModelForm.modelId.trim(),
          name: addModelForm.name.trim() || undefined,
          capabilities,
        }),
      });
      // 本地直接插入新模型，避免整页重新加载
      if (res.data?.id) {
        setModels((prev) => [
          ...prev.filter((m) => m.id !== res.data!.id),
          res.data!,
        ]);
      }
      toast.success("自定义模型已添加");
      setAddModelOpen(false);
      setAddModelForm(emptyAddModelForm());
    } finally {
      setAddModelSaving(false);
    }
  };

  const setModelThinkingLevel = async (model: AIModel, value: string) => {
    const thinkingLevel = value === "__default__" ? null : value;
    try {
      const res = await apiFetch<{ ok: boolean }>(
        `/api/ai/models/${encodeURIComponent(model.id)}`,
        {
          method: "PUT",
          body: JSON.stringify({ thinkingLevel }),
        },
      );
      if (!res.ok) {
        toast.error("思考等级更新失败");
        return;
      }
      // 原地更新当前行的思考等级，不整页刷新
      setModels((prev) =>
        prev.map((m) =>
          m.id === model.id
            ? { ...m, thinkingLevel: thinkingLevel ?? undefined }
            : m,
        ),
      );
      toast.success("思考等级已更新");
    } catch {
      // apiFetch 已对请求失败弹出过提示
    }
  };

  const removeModel = async (model: AIModel) => {
    if (
      !window.confirm(
        `确定删除模型 ${model.name || model.modelId}？相关角色绑定会一并清理。`,
      )
    ) {
      return;
    }
    // 先从界面移除，再后台同步角色绑定等关联数据
    setModels((prev) => prev.filter((m) => m.id !== model.id));
    try {
      await apiFetch(`/api/ai/models/${encodeURIComponent(model.id)}`, {
        method: "DELETE",
      });
      toast.success("模型已删除");
    } catch {
      // 删除失败时恢复界面数据（apiFetch 已弹出错误提示）
      await load({ silent: true });
      return;
    }
    await load({ silent: true });
  };

  if (loading) {
    return (
      <div className="border-y py-10 text-center text-sm text-muted-foreground">
        正在加载提供商与模型...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>AI 提供商</CardTitle>
            <CardDescription>
              在 AI 服务中配置协议、密钥；chat 只消费角色绑定的模型
            </CardDescription>
          </div>
          <Button size="sm" onClick={openCreate}>
            <Plus className="mr-1 h-4 w-4" />
            新增
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {providers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              还没有提供商。先新增一个 OpenAI / Anthropic / Gemini 配置。
            </p>
          ) : null}
          {providers.map((provider) => (
            <div
              key={provider.id}
              className="flex flex-col gap-3 rounded-md border p-3 md:flex-row md:items-center md:justify-between"
            >
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{provider.name}</span>
                  <span className="rounded bg-secondary px-2 py-0.5 text-xs">
                    {PROTOCOL_OPTIONS.find((p) => p.value === provider.protocol)
                      ?.label || provider.protocol}
                  </span>
                  {provider.enabled ? (
                    <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      启用
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <XCircle className="h-3.5 w-3.5" />
                      停用
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {provider.apiUrl}
                </p>
                <p className="text-xs text-muted-foreground">
                  模型 {(modelsByProvider.get(provider.id) || []).length} 个 ·{" "}
                  {provider.hasApiKey ? "已配置 Key" : "未配置 Key"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => testProvider(provider.id)}
                  disabled={testingId === provider.id}
                >
                  {testingId === provider.id ? (
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  ) : null}
                  测试
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => refreshModels(provider.id)}
                >
                  <RefreshCw className="mr-1 h-4 w-4" />
                  拉模型
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openEdit(provider)}
                >
                  编辑
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => removeProvider(provider.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <ModalDialog
        open={formOpen}
        title={form.id ? "编辑提供商" : "新增提供商"}
        onClose={() => setFormOpen(false)}
        footer={
          <>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              取消
            </Button>
            <Button onClick={saveProvider} disabled={saving}>
              {saving ? "保存中..." : "保存"}
            </Button>
          </>
        }
      >
        <div className="space-y-1">
          <p className="text-sm font-medium">名称</p>
          <Input
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            placeholder="OpenAI 主号"
          />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium">协议</p>
          <Select
            value={form.protocol}
            onValueChange={(value: AIProtocol) => {
              const option = PROTOCOL_OPTIONS.find((p) => p.value === value);
              setForm((p) => ({
                ...p,
                protocol: value,
                apiUrl: option?.defaultUrl || p.apiUrl,
              }));
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PROTOCOL_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium">API URL</p>
          <Input
            value={form.apiUrl}
            onChange={(e) => setForm((p) => ({ ...p, apiUrl: e.target.value }))}
          />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium">
            API Key{form.id ? "（留空表示不修改）" : ""}
          </p>
          <Input
            type="password"
            value={form.apiKey}
            onChange={(e) => setForm((p) => ({ ...p, apiKey: e.target.value }))}
            placeholder="sk-..."
          />
        </div>
        <div className="flex items-center gap-2">
          <Switch
            checked={form.enabled}
            onCheckedChange={(checked) =>
              setForm((p) => ({ ...p, enabled: checked }))
            }
          />
          <span className="text-sm">启用</span>
        </div>
      </ModalDialog>

      <Card>
        <CardHeader>
          <CardTitle>角色绑定</CardTitle>
          <CardDescription>
            chat 插件按角色取实例：主模型 / 工作模型 / 视觉模型
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          {ROLE_META.map((item) => (
            <div key={item.role} className="space-y-2">
              <div>
                <p className="text-sm font-medium">{item.title}</p>
                <p className="text-xs text-muted-foreground">{item.hint}</p>
              </div>
              <Select
                value={roles[item.role] || "__none__"}
                onValueChange={(value) => {
                  const next = {
                    ...roles,
                    [item.role]: value === "__none__" ? undefined : value,
                  };
                  void saveRoles(next);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择模型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">未绑定</SelectItem>
                  {providers.map((provider) =>
                    (modelsByProvider.get(provider.id) || []).map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        {provider.name} / {model.name || model.modelId}
                      </SelectItem>
                    )),
                  )}
                </SelectContent>
              </Select>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>主模型错误转移链</CardTitle>
            <CardDescription>
              主模型报错时按顺序使用此处配置的模型重试
            </CardDescription>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {fallbackChain.length > 0 ? (
              <Button
                size="sm"
                variant="outline"
                disabled={fallbackSaving}
                onClick={() => void saveFallback([], fallbackOn)}
              >
                清空
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="outline"
              aria-label="添加错误转移模型"
              title="添加错误转移模型"
              disabled={fallbackSaving}
              onClick={() => {
                setFallbackCandidate("");
                setFallbackAddOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {fallbackChain.length === 0 ? (
            <p className="text-sm text-muted-foreground">尚未配置错误转移</p>
          ) : (
            <div className="space-y-2">
              {fallbackChain.map((id, index) => (
                <div
                  key={`${id}-${index}`}
                  className="flex items-center gap-2 rounded-md border p-2"
                >
                  <span className="w-6 text-center text-xs text-muted-foreground">
                    {index + 1}
                  </span>
                  <Select
                    value={id}
                    onValueChange={(value) => {
                      if (!value || value === "__none__") return;
                      const next = [...fallbackChain];
                      next[index] = value;
                      void saveFallback(next, fallbackOn);
                    }}
                    disabled={fallbackSaving}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {providers.map((provider) =>
                        (modelsByProvider.get(provider.id) || []).map(
                          (model) => (
                            <SelectItem key={model.id} value={model.id}>
                              {provider.name} / {model.name || model.modelId}
                            </SelectItem>
                          ),
                        ),
                      )}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={index === 0 || fallbackSaving}
                    onClick={() => {
                      const next = [...fallbackChain];
                      [next[index - 1], next[index]] = [
                        next[index],
                        next[index - 1],
                      ];
                      void saveFallback(next, fallbackOn);
                    }}
                  >
                    ↑
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={
                      index === fallbackChain.length - 1 || fallbackSaving
                    }
                    onClick={() => {
                      const next = [...fallbackChain];
                      [next[index], next[index + 1]] = [
                        next[index + 1],
                        next[index],
                      ];
                      void saveFallback(next, fallbackOn);
                    }}
                  >
                    ↓
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={fallbackSaving}
                    onClick={() => {
                      const next = fallbackChain.filter((_, i) => i !== index);
                      void saveFallback(next, fallbackOn);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>模型列表</CardTitle>
            <CardDescription>拉取或手动添加模型，供角色绑定使用</CardDescription>
          </div>
          <Button
            size="sm"
            onClick={() => {
              setAddModelForm(emptyAddModelForm());
              setAddModelOpen(true);
            }}
          >
            <Plus className="mr-1 h-4 w-4" />
            添加模型
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="border-b text-muted-foreground">
                <tr>
                  <th className="py-2 pr-3 font-medium">提供商</th>
                  <th className="py-2 pr-3 font-medium">模型</th>
                  <th className="py-2 pr-3 font-medium">能力</th>
                  <th className="py-2 pr-3 font-medium">思考等级</th>
                  <th className="py-2 pr-3 font-medium">来源</th>
                  <th className="py-2 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {models.map((model) => {
                  const provider = providers.find(
                    (item) => item.id === model.providerId,
                  );
                  return (
                    <tr key={model.id} className="border-b last:border-0">
                      <td className="py-2 pr-3">
                        {provider?.name || model.providerId}
                      </td>
                      <td className="py-2 pr-3">
                        <div className="font-medium">
                          {model.name || model.modelId}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {model.modelId}
                        </div>
                      </td>
                      <td className="py-2 pr-3">
                        <div className="flex flex-wrap gap-1">
                          {(model.capabilities || []).map((cap) => (
                            <span
                              key={cap}
                              className="rounded bg-secondary px-1.5 py-0.5 text-xs"
                            >
                              {cap}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-2 pr-3">
                        <Select
                          value={model.thinkingLevel || "__default__"}
                          onValueChange={(value) => {
                            if (value === (model.thinkingLevel || "__default__"))
                              return;
                            void setModelThinkingLevel(model, value);
                          }}
                        >
                          <SelectTrigger className="h-8 w-28 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__default__">默认</SelectItem>
                            {thinkingOptionsFor(provider?.protocol).map(
                              (option) => (
                                <SelectItem
                                  key={option.value}
                                  value={option.value}
                                >
                                  {option.label}
                                </SelectItem>
                              ),
                            )}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="py-2 pr-3">
                        {model.isCustom ? "自定义" : "拉取"}
                      </td>
                      <td className="py-2">
                        <Button
                          size="sm"
                          variant="outline"
                          aria-label={`删除模型 ${model.name || model.modelId}`}
                          onClick={() => void removeModel(model)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {models.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">
                暂无模型。可对提供商点「拉模型」，或点右上角「添加模型」手动添加。
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>生成参数</CardTitle>
          <CardDescription>仍保存在 chat/base（与提供商无关）</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <p className="text-sm font-medium">温度</p>
            <Input
              type="number"
              step="0.1"
              value={temperature}
              onChange={(e) =>
                onBaseChange({ temperature: Number(e.target.value) })
              }
            />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium">最大迭代次数</p>
            <Input
              type="number"
              value={maxIterations}
              onChange={(e) =>
                onBaseChange({ maxIterations: Number(e.target.value) })
              }
            />
          </div>
        </CardContent>
      </Card>

      <ModalDialog
        open={addModelOpen}
        title="添加自定义模型"
        onClose={() => setAddModelOpen(false)}
        footer={
          <>
            <Button variant="outline" onClick={() => setAddModelOpen(false)}>
              取消
            </Button>
            <Button onClick={submitAddModel} disabled={addModelSaving}>
              {addModelSaving ? "添加中..." : "添加"}
            </Button>
          </>
        }
      >
        <div className="space-y-1">
          <p className="text-sm font-medium">提供商</p>
          <Select
            value={addModelForm.providerId || "__none__"}
            onValueChange={(value) =>
              setAddModelForm((p) => ({
                ...p,
                providerId: value === "__none__" ? "" : value,
              }))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="选择提供商" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">选择提供商</SelectItem>
              {providers.map((provider) => (
                <SelectItem key={provider.id} value={provider.id}>
                  {provider.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium">模型 ID</p>
          <Input
            value={addModelForm.modelId}
            onChange={(e) =>
              setAddModelForm((p) => ({ ...p, modelId: e.target.value }))
            }
            placeholder="例如 gpt-4o-mini"
          />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium">显示名（可选）</p>
          <Input
            value={addModelForm.name}
            onChange={(e) =>
              setAddModelForm((p) => ({ ...p, name: e.target.value }))
            }
            placeholder="留空时直接使用模型 ID"
          />
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium">模型能力</p>
          <label className="flex cursor-pointer items-center justify-between rounded-md border px-3 py-2 text-sm">
            <span>支持视觉（图片 / 视频理解）</span>
            <input
              type="checkbox"
              className="form-checkbox"
              checked={addModelForm.vision}
              onChange={(e) =>
                setAddModelForm((p) => ({ ...p, vision: e.target.checked }))
              }
            />
          </label>
          <label className="flex cursor-pointer items-center justify-between rounded-md border px-3 py-2 text-sm">
            <span>支持工具调用（function calling）</span>
            <input
              type="checkbox"
              className="form-checkbox"
              checked={addModelForm.toolUse}
              onChange={(e) =>
                setAddModelForm((p) => ({ ...p, toolUse: e.target.checked }))
              }
            />
          </label>
        </div>
      </ModalDialog>

      <ModalDialog
        open={fallbackAddOpen}
        title="添加错误转移模型"
        onClose={() => setFallbackAddOpen(false)}
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setFallbackAddOpen(false)}
            >
              取消
            </Button>
            <Button
              disabled={!fallbackCandidate || fallbackSaving}
              onClick={() => {
                if (!fallbackCandidate) return;
                void saveFallback([...fallbackChain, fallbackCandidate], fallbackOn);
                setFallbackAddOpen(false);
              }}
            >
              添加
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          新模型会追加到错误转移链末尾，之后可以在列表中调整顺序。
        </p>
        <Select
          value={fallbackCandidate || "__none__"}
          onValueChange={(value) =>
            setFallbackCandidate(value === "__none__" ? "" : value)
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="选择模型" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">选择模型</SelectItem>
            {providers
              .flatMap((provider) =>
                (modelsByProvider.get(provider.id) || []).map((model) => ({
                  ...model,
                  providerName: provider.name,
                })),
              )
              .filter((model) => !fallbackChain.includes(model.id))
              .map((model) => (
                <SelectItem key={model.id} value={model.id}>
                  {model.providerName} / {model.name || model.modelId}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </ModalDialog>
    </div>
  );
}

function ModalDialog({
  open,
  title,
  onClose,
  children,
  footer,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="text-sm font-semibold">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-secondary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-4 px-4 py-4">{children}</div>
        <div className="flex items-center justify-end gap-2 border-t px-4 py-3">
          {footer}
        </div>
      </div>
    </div>
  );
}
