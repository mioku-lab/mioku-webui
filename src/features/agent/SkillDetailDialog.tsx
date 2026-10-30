import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/Dialog";
import { Markdown } from "@/components/ui/markdown";
import { apiFetch } from "@/lib/api";
import type { AgentSkillDetail } from "./shared";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 text-sm">
      <span className="w-20 shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 break-all">{value}</span>
    </div>
  );
}

export function SkillDetailDialog({
  open,
  name,
  rootId,
  onClose,
}: {
  open: boolean;
  name: string;
  rootId: string;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<AgentSkillDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !name) return;
    setLoading(true);
    setDetail(null);
    apiFetch<{ data: AgentSkillDetail }>(
      `/api/agent/skills/${encodeURIComponent(name)}?rootId=${encodeURIComponent(rootId)}`,
    )
      .then((res) => setDetail(res.data))
      .catch(() => setDetail(null))
      .finally(() => setLoading(false));
  }, [open, name, rootId]);

  return (
    <Dialog
      open={open}
      title={name || "技能详情"}
      description={detail?.description}
      className="max-w-3xl"
      onClose={onClose}
    >
      {loading ? (
        <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          加载中...
        </div>
      ) : !detail ? (
        <div className="py-8 text-sm text-muted-foreground">读取失败</div>
      ) : (
        <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
          <div className="space-y-1.5 rounded-md border p-3">
            <Row label="目录" value={detail.dir} />
            <Row label="来源" value={`${detail.rootLabel}（${detail.rootPath}）`} />
            {detail.origin ? (
              <Row label="安装自" value={detail.origin.display} />
            ) : null}
            {detail.license ? <Row label="许可" value={detail.license} /> : null}
            {detail.compatibility ? (
              <Row label="环境要求" value={detail.compatibility} />
            ) : null}
            {detail.metadata && Object.keys(detail.metadata).length > 0 ? (
              <Row
                label="metadata"
                value={Object.entries(detail.metadata)
                  .map(([key, value]) => `${key}=${value}`)
                  .join("  ")}
              />
            ) : null}
            {detail.allowedTools.length > 0 ? (
              <Row label="allowed-tools" value={detail.allowedTools.join(" ")} />
            ) : null}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <Badge
                className={
                  detail.modelInvocable
                    ? "border-emerald-500/40 text-emerald-600"
                    : "border-amber-500/40 text-amber-600"
                }
              >
                {detail.modelInvocable ? "模型可调用" : "仅手动调用"}
              </Badge>
              {detail.userInvocable ? null : (
                <Badge className="border-amber-500/40 text-amber-600">
                  禁止用户调用
                </Badge>
              )}
              {detail.enabled ? null : (
                <Badge className="border-muted-foreground/40">已停用</Badge>
              )}
              <Badge>{detail.resources} 个附带文件</Badge>
            </div>
          </div>

          {detail.diagnostics.length > 0 ? (
            <div className="space-y-1 rounded-md border border-amber-500/40 bg-amber-500/5 p-3">
              {detail.diagnostics.map((item, index) => (
                <div key={index} className="text-xs text-amber-700">
                  [{item.level}] {item.code}：{item.message}
                </div>
              ))}
            </div>
          ) : null}

          {detail.resourceList.length > 0 ? (
            <div className="space-y-1">
              <div className="text-sm font-medium">附带文件</div>
              <div className="flex flex-wrap gap-1">
                {detail.resourceList.map((item) => (
                  <span
                    key={item}
                    className="rounded border px-1.5 py-0.5 font-mono text-xs text-muted-foreground"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          <div className="space-y-1">
            <div className="text-sm font-medium">SKILL.md</div>
            <div className="rounded-md border p-3">
              <Markdown content={detail.content} />
            </div>
          </div>
        </div>
      )}
    </Dialog>
  );
}
