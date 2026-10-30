import { useMemo, useState } from "react";
import {
  FolderOpen,
  Info,
  Loader2,
  RefreshCw,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { NumberInput } from "@/components/ui/number-input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import { SkillDetailDialog } from "./SkillDetailDialog";
import { SkillInstallDialog } from "./SkillInstallDialog";
import { useAgentSkills, type AgentSkillItem } from "./shared";

export interface SkillsTabConfig {
  enabled: boolean;
  extraRoots: string[];
  maxInPrompt: number;
  descriptionMaxLength: number;
  activationTtlMs: number;
  rescanIntervalMs: number;
  maxResourceFiles: number;
}

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

export function SkillsTab({
  value,
  onChange,
}: {
  value: SkillsTabConfig;
  onChange: (patch: Partial<SkillsTabConfig>) => void;
}) {
  const { skills, roots, loading, reload } = useAgentSkills();
  const [filter, setFilter] = useState("__all__");
  const [installOpen, setInstallOpen] = useState(false);
  const [detail, setDetail] = useState<AgentSkillItem | null>(null);
  const [pendingRemove, setPendingRemove] = useState<AgentSkillItem | null>(
    null,
  );
  const [busy, setBusy] = useState("");

  const visible = useMemo(
    () =>
      filter === "__all__"
        ? skills
        : skills.filter((skill) => skill.rootId === filter),
    [skills, filter],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, AgentSkillItem[]>();
    for (const skill of visible) {
      const list = map.get(skill.rootId) ?? [];
      list.push(skill);
      map.set(skill.rootId, list);
    }
    return map;
  }, [visible]);

  async function toggleEnabled(skill: AgentSkillItem, enabled: boolean) {
    setBusy(skill.name);
    try {
      await apiFetch("/api/agent/skills/state", {
        method: "PUT",
        body: JSON.stringify({ name: skill.name, enabled }),
      });
      await reload();
      toast.success(`${enabled ? "已启用" : "已停用"} ${skill.name}`);
    } finally {
      setBusy("");
    }
  }

  async function updateSkill(skill: AgentSkillItem) {
    setBusy(skill.name);
    try {
      await apiFetch(
        `/api/agent/skills/${encodeURIComponent(skill.name)}/update?rootId=${encodeURIComponent(skill.rootId)}`,
        { method: "POST" },
      );
      await reload();
      toast.success(`${skill.name} 已更新`);
    } finally {
      setBusy("");
    }
  }

  async function removeSkill(skill: AgentSkillItem) {
    try {
      await apiFetch(
        `/api/agent/skills/${encodeURIComponent(skill.name)}?rootId=${encodeURIComponent(skill.rootId)}`,
        { method: "DELETE" },
      );
      await reload();
      toast.success(`已卸载 ${skill.name}`);
    } finally {
      setPendingRemove(null);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>技能</CardTitle>
          <CardDescription>
            技能是 Agent 使用的指令包。开启后，Agent
            会把技能名与描述放进系统提示词，按需调用。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4 rounded-md border p-3">
            <div className="space-y-1">
              <div className="text-sm font-medium">启用技能</div>
            </div>
            <Switch
              className="shrink-0"
              checked={value.enabled}
              onCheckedChange={(checked) => onChange({ enabled: checked })}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-4">
            <Field label="提示词技能上限" hint="超出后只列前 N 个">
              <NumberInput
                min={1}
                value={value.maxInPrompt}
                onValueChange={(next) => {
                  if (next !== null) onChange({ maxInPrompt: next });
                }}
              />
            </Field>
            <Field label="描述截断长度" hint="每条描述渲染进提示词的最大字符数">
              <NumberInput
                min={40}
                value={value.descriptionMaxLength}
                onValueChange={(next) => {
                  if (next !== null) onChange({ descriptionMaxLength: next });
                }}
              />
            </Field>
            <Field label="激活有效期 (分钟)">
              <NumberInput
                min={1}
                value={Math.round(value.activationTtlMs / 60_000)}
                onValueChange={(next) => {
                  if (next !== null)
                    onChange({ activationTtlMs: next * 60_000 });
                }}
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>技能库</CardTitle>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => void reload()}>
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                <span className="ml-1">刷新</span>
              </Button>
              <Button size="sm" onClick={() => setInstallOpen(true)}>
                <Upload className="h-4 w-4" />
                <span className="ml-1">安装技能</span>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setFilter("__all__")}
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition-colors",
                filter === "__all__"
                  ? "border-primary bg-primary/10 text-foreground"
                  : "text-muted-foreground hover:bg-secondary/60",
              )}
            >
              全部 {skills.length}
            </button>
            {roots.map((root) => (
              <button
                key={root.id}
                type="button"
                title={root.path}
                onClick={() => setFilter(root.id)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs transition-colors",
                  filter === root.id
                    ? "border-primary bg-primary/10 text-foreground"
                    : "text-muted-foreground hover:bg-secondary/60",
                  root.exists ? "" : "border-dashed opacity-70",
                )}
              >
                {root.label} {root.skills}
              </button>
            ))}
          </div>

          {!value.enabled ? (
            <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              技能功能已关闭
            </div>
          ) : loading ? (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              正在扫描技能目录...
            </div>
          ) : visible.length === 0 ? (
            <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              这个目录下还没有技能，点右上角「安装技能」进行安装
            </div>
          ) : (
            [...grouped.entries()].map(([rootId, items]) => {
              const root = roots.find((item) => item.id === rootId);
              return (
                <div key={rootId} className="space-y-1.5">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <FolderOpen className="h-3.5 w-3.5" />
                    <span className="font-medium text-foreground">
                      {root?.label ?? rootId}
                    </span>
                    <span className="truncate">{root?.path}</span>
                  </div>
                  {items.map((skill) => (
                    <div
                      key={`${skill.rootId}/${skill.name}`}
                      className="flex items-start gap-3 rounded-md border p-3"
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-sm font-medium">
                            {skill.name}
                          </span>
                          {skill.modelInvocable ? null : (
                            <Badge className="border-amber-500/40 text-amber-600">
                              仅手动调用
                            </Badge>
                          )}
                          {skill.userInvocable ? null : (
                            <Badge className="border-amber-500/40 text-amber-600">
                              禁止用户调用
                            </Badge>
                          )}
                          {skill.origin ? (
                            <Badge className="border-sky-500/40 text-sky-600">
                              可更新
                            </Badge>
                          ) : null}
                          {skill.diagnostics.some(
                            (item) => item.level === "error",
                          ) ? (
                            <Badge className="border-red-500/40 text-red-500">
                              有错误
                            </Badge>
                          ) : null}
                        </div>
                        <div className="line-clamp-2 text-xs text-muted-foreground">
                          {skill.description}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {skill.resources} 个附带文件 · {skill.dir}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        {busy === skill.name ? (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        ) : null}
                        <Button
                          variant="ghost"
                          size="sm"
                          title="详情"
                          onClick={() => setDetail(skill)}
                        >
                          <Info className="h-4 w-4" />
                        </Button>
                        {skill.origin ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            title="重新拉取"
                            onClick={() => void updateSkill(skill)}
                          >
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                        ) : null}
                        {skill.canUninstall ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            title="卸载"
                            onClick={() => setPendingRemove(skill)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        ) : null}
                        <Switch
                          checked={skill.enabled}
                          onCheckedChange={(checked) =>
                            void toggleEnabled(skill, checked)
                          }
                        />
                      </div>
                    </div>
                  ))}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <SkillInstallDialog
        open={installOpen}
        roots={roots}
        onClose={() => setInstallOpen(false)}
        onInstalled={reload}
      />
      <SkillDetailDialog
        open={detail !== null}
        name={detail?.name ?? ""}
        rootId={detail?.rootId ?? ""}
        onClose={() => setDetail(null)}
      />
      {pendingRemove ? (
        <ConfirmDialog
          title="卸载技能"
          message={`确定要删除 ${pendingRemove.name} 吗？这会从磁盘上移除 ${pendingRemove.dir}`}
          confirmText="卸载"
          variant="danger"
          onConfirm={() => void removeSkill(pendingRemove)}
          onCancel={() => setPendingRemove(null)}
        />
      ) : null}
    </div>
  );
}
