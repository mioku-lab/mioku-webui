import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bot, Construction } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiFetch } from "@/lib/api";
import type { DatasourceOption } from "@/features/plugin-config/datasource-utils";

export const CONTEXT_WINDOW_CHOICES = [
  { label: "128K", value: 131072 },
  { label: "256K", value: 262144 },
  { label: "512K", value: 524288 },
  { label: "1M", value: 1048576 },
  { label: "10M", value: 10485760 },
];

export const DEFAULT_CONTEXT_WINDOW = 524288;

export function formatTokens(value: number): string {
  if (value >= 1048576) {
    const millions = value / 1048576;
    return `${Number.isInteger(millions) ? millions : millions.toFixed(1)}M`;
  }
  const thousands = value / 1024;
  return `${Number.isInteger(thousands) ? thousands : thousands.toFixed(0)}K`;
}

export function formatWindowLabel(value: number): string {
  const known = CONTEXT_WINDOW_CHOICES.find((choice) => choice.value === value);
  if (known) return known.label;
  return `${formatTokens(value)}（自定义）`;
}

export function useAgentInstalled(): boolean | null {
  const [installed, setInstalled] = useState<boolean | null>(null);
  useEffect(() => {
    apiFetch<{ data: string[] }>("/api/config/plugins/available")
      .then((res) => setInstalled((res.data ?? []).includes("agent")))
      .catch(() => setInstalled(false));
  }, []);
  return installed;
}

export function useFriendOptions(): DatasourceOption[] {
  const [options, setOptions] = useState<DatasourceOption[]>([]);
  useEffect(() => {
    apiFetch<{ data: DatasourceOption[] }>(
      "/api/plugin-config/datasources/qq_friends",
    )
      .then((res) => setOptions(res.data ?? []))
      .catch(() => setOptions([]));
  }, []);
  return options;
}

export interface AgentModelOption {
  id: string;
  providerId: string;
  modelId: string;
  name: string;
}

interface AgentProviderOption {
  id: string;
  name: string;
}

export function useAgentModels(): {
  providers: AgentProviderOption[];
  models: AgentModelOption[];
} {
  const [providers, setProviders] = useState<AgentProviderOption[]>([]);
  const [models, setModels] = useState<AgentModelOption[]>([]);
  useEffect(() => {
    Promise.all([
      apiFetch<{ data: AgentProviderOption[] }>("/api/ai/providers"),
      apiFetch<{ data: AgentModelOption[] }>("/api/ai/models"),
    ])
      .then(([providersRes, modelsRes]) => {
        setProviders(providersRes.data ?? []);
        setModels(modelsRes.data ?? []);
      })
      .catch(() => {
        setProviders([]);
        setModels([]);
      });
  }, []);
  return { providers, models };
}

/**
 * 模型覆盖选择：与 AI 设置「提供商与模型」里的角色绑定下拉同款，
 * 按提供商分组列出全部模型，值为 `providerId/modelId`。
 */
export function ModelOverrideSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const { providers, models } = useAgentModels();
  const modelsByProvider = useMemo(() => {
    const map = new Map<string, AgentModelOption[]>();
    for (const model of models) {
      const list = map.get(model.providerId) || [];
      list.push(model);
      map.set(model.providerId, list);
    }
    return map;
  }, [models]);

  const known = models.some((model) => model.id === value);

  return (
    <Select
      value={value || "__default__"}
      onValueChange={(next) => onChange(next === "__default__" ? "" : next)}
    >
      <SelectTrigger>
        <SelectValue placeholder="跟随主模型" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__default__">跟随主模型</SelectItem>
        {value && !known ? (
          <SelectItem value={value}>{value}（当前值）</SelectItem>
        ) : null}
        {providers.map((provider) =>
          (modelsByProvider.get(provider.id) || []).map((model) => (
            <SelectItem key={model.id} value={model.id}>
              {provider.name} / {model.name || model.modelId}
            </SelectItem>
          )),
        )}
      </SelectContent>
    </Select>
  );
}

export function AgentTodoTab({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary">
          <Construction className="h-7 w-7 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <div className="text-base font-semibold">{title} 即将上线</div>
          <p className="max-w-xl text-sm text-muted-foreground">{description}</p>
        </div>
        <span className="rounded-full border border-dashed px-3 py-1 text-xs text-muted-foreground">
          TODO
        </span>
      </CardContent>
    </Card>
  );
}

export function AgentNotInstalled() {
  const navigate = useNavigate();
  return (
    <div className="mx-auto w-full max-w-6xl">
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary">
            <Bot className="h-7 w-7 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <div className="text-base font-semibold">Agent 插件暂未安装</div>
            <p className="text-sm text-muted-foreground">
              安装 mioku-plugin-agent 后即可在这里管理私聊 Agent
              的权限、工作区、工具与网络搜索配置。
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate("/store")}>
            去插件市场看看
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
