import { useEffect, useState } from "react";
import { Check, Download, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { AgentSkillProbe, AgentSkillRoot } from "./shared";

export function SkillInstallDialog({
  open,
  roots,
  onClose,
  onInstalled,
}: {
  open: boolean;
  roots: AgentSkillRoot[];
  onClose: () => void;
  onInstalled: () => void | Promise<void>;
}) {
  const writableRoots = roots.filter((root) => root.writable);
  const [input, setInput] = useState("");
  const [rootId, setRootId] = useState("");
  const [probing, setProbing] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [probe, setProbe] = useState<AgentSkillProbe | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    setInput("");
    setProbe(null);
    setSelected(new Set());
    setProbing(false);
    setInstalling(false);
    setRootId(writableRoots[0]?.id ?? "");
  }, [open]);

  async function probeSource() {
    const value = input.trim();
    if (!value) {
      toast.error("请填写技能来源");
      return;
    }
    setProbing(true);
    setProbe(null);
    try {
      const res = await apiFetch<{ data: AgentSkillProbe }>(
        "/api/agent/skills/probe",
        { method: "POST", body: JSON.stringify({ input: value }) },
      );
      setProbe(res.data);
      const valid = res.data.candidates.filter((item) => item.valid);
      setSelected(new Set(valid.length > 0 ? [valid[0]!.rel] : []));
    } catch {
      // apiFetch 已经弹过错误
    } finally {
      setProbing(false);
    }
  }

  async function install() {
    if (!probe || selected.size === 0) return;
    if (!rootId) {
      toast.error("请选择安装目录");
      return;
    }
    setInstalling(true);
    let done = 0;
    try {
      for (const rel of selected) {
        const candidate = probe.candidates.find((item) => item.rel === rel);
        if (!candidate) continue;
        try {
          await apiFetch("/api/agent/skills/install", {
            method: "POST",
            body: JSON.stringify({
              rootId,
              stagingId: probe.stagingId,
              rel,
              input: input.trim(),
              overwrite: true,
            }),
          });
          done += 1;
        } catch {
          // 单个失败继续，最后统一汇报
        }
      }
      if (done > 0) {
        toast.success(`已安装 ${done} 个技能`);
        await onInstalled();
        onClose();
      } else {
        toast.error("安装失败，目标目录可能已存在同名技能");
      }
    } finally {
      setInstalling(false);
    }
  }

  function toggle(rel: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(rel)) next.delete(rel);
      else next.add(rel);
      return next;
    });
  }

  return (
    <Dialog
      open={open}
      title="安装技能"
      description="支持 GitHub 简写（owner/repo、owner/repo/sub/path）、仓库链接、zip 包，以及本机目录"
      className="max-w-2xl"
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={installing}>
            取消
          </Button>
          <Button
            onClick={install}
            disabled={installing || !probe || selected.size === 0}
          >
            {installing ? (
              <Loader2 className="h-4 w-4 animate-spin sm:mr-1" />
            ) : (
              <Download className="h-4 w-4 sm:mr-1" />
            )}
            安装{selected.size > 0 ? ` (${selected.size})` : ""}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void probeSource();
            }}
            placeholder="anthropics/skills 或 https://github.com/owner/repo/tree/main/skills/pdf"
          />
          <Button
            variant="outline"
            onClick={probeSource}
            disabled={probing}
            className="shrink-0"
          >
            {probing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            <span className="ml-1">检测</span>
          </Button>
        </div>

        <div className="space-y-2">
          <div className="text-sm font-medium">安装到</div>
          <Select value={rootId} onValueChange={setRootId}>
            <SelectTrigger>
              <SelectValue placeholder="选择技能目录" />
            </SelectTrigger>
            <SelectContent>
              {writableRoots.map((root) => (
                <SelectItem key={root.id} value={root.id}>
                  {root.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {probe ? (
          <div className="space-y-2">
            <div className="text-sm font-medium">
              找到 {probe.candidates.length} 个技能
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                来源：{probe.display}
              </span>
            </div>
            <div className="max-h-72 space-y-1 overflow-y-auto rounded-md border p-1">
              {probe.candidates.map((candidate) => {
                const active = selected.has(candidate.rel);
                return (
                  <button
                    key={candidate.rel}
                    type="button"
                    disabled={!candidate.valid}
                    onClick={() => toggle(candidate.rel)}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-md p-2 text-left transition-colors",
                      candidate.valid
                        ? "hover:bg-secondary/60"
                        : "cursor-not-allowed opacity-60",
                      active && "bg-secondary",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                        active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-muted-foreground/40",
                      )}
                    >
                      {active ? <Check className="h-3 w-3" /> : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                          {candidate.name}
                        </span>
                        {candidate.valid ? null : (
                          <Badge className="border-red-500/40 text-red-500">
                            不可用
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {candidate.files} 个文件
                        </span>
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                        {candidate.description ||
                          candidate.diagnostics[0]?.message ||
                          candidate.rel}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </Dialog>
  );
}
