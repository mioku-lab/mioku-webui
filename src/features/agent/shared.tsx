import { useCallback, useEffect, useMemo, useState } from "react";
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

/**
 * MCP 服务是否安装。查的是已安装的包而不是 `/api/mcp/overview`：
 * apiFetch 对非 2xx 会直接弹 toast，未安装时不该弹。
 */
export function useMcpServiceInstalled(): boolean | null {
  const [installed, setInstalled] = useState<boolean | null>(null);
  useEffect(() => {
    apiFetch<{ data: Array<{ name: string }> }>("/api/manage/services")
      .then((res) =>
        setInstalled((res.data ?? []).some((item) => item.name === "mcp")),
      )
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
            前往插件市场
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export interface AgentSkillDiagnostic {
  level: "error" | "warn";
  code: string;
  message: string;
  path: string;
}

export interface AgentSkillOrigin {
  kind: "git" | "file" | "archive" | "local";
  input: string;
  display: string;
  installedAt: number;
}

export interface AgentSkillItem {
  name: string;
  description: string;
  rootId: string;
  rootLabel: string;
  rootPath: string;
  dir: string;
  path: string;
  resources: number;
  modelInvocable: boolean;
  userInvocable: boolean;
  enabled: boolean;
  canUninstall: boolean;
  origin?: AgentSkillOrigin;
  diagnostics: AgentSkillDiagnostic[];
}

export interface AgentSkillRoot {
  id: string;
  label: string;
  kind: string;
  path: string;
  rank: number;
  writable: boolean;
  exists: boolean;
  skills: number;
}

export interface AgentSkillDetail extends AgentSkillItem {
  content: string;
  resourceList: string[];
  allowedTools: string[];
  license?: string;
  compatibility?: string;
  metadata?: Record<string, string>;
}

export interface AgentSkillInstallCandidate {
  rel: string;
  name: string;
  description: string;
  dir: string;
  path: string;
  files: number;
  valid: boolean;
  diagnostics: AgentSkillDiagnostic[];
}

export interface AgentSkillProbe {
  stagingId: string;
  display: string;
  candidates: AgentSkillInstallCandidate[];
}

interface SkillsPayload {
  skills: AgentSkillItem[];
  roots: AgentSkillRoot[];
  diagnostics: AgentSkillDiagnostic[];
}

/** 技能列表 + 扫描根；装卸 / 启停后调用 reload */
export function useAgentSkills(): {
  skills: AgentSkillItem[];
  roots: AgentSkillRoot[];
  loading: boolean;
  reload: () => Promise<void>;
} {
  const [skills, setSkills] = useState<AgentSkillItem[]>([]);
  const [roots, setRoots] = useState<AgentSkillRoot[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      const res = await apiFetch<{ data: SkillsPayload }>("/api/agent/skills");
      setSkills(res.data?.skills ?? []);
      setRoots(res.data?.roots ?? []);
    } catch {
      setSkills([]);
      setRoots([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { skills, roots, loading, reload };
}
