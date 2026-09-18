import { useEffect, useRef, useState } from "react";
import {
  ExternalLink,
  LoaderCircle,
  Package,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/input";
import { confirm } from "@/components/ui/confirm";
import { useTopbar } from "@/components/layout/TopbarContext";
import { apiFetch } from "@/lib/api";
import { toast } from "@/lib/toast";

type ViewMode = "overview" | "detail";
type UpdateState = "up-to-date" | "has-updates" | "unknown" | "no-git";

interface AdapterOverviewItem {
  name: string;
  version: string;
  description: string;
  hasGit: boolean;
  repository?: string;
  updateState: UpdateState;
  hasUpdates: boolean;
  behind: number;
  updateChecking?: boolean;
  updateError?: string;
  updateCheckedAt?: number;
}

interface AdapterDetail extends AdapterOverviewItem {
  originUrl: string;
  readme: string;
  readmeFile: string;
}

function toBrowserRepoUrl(raw: string): string {
  const value = String(raw || "").trim();
  if (!value) return "";
  if (value.startsWith("git@")) {
    const matched = value.match(/^git@([^:]+):(.+)$/);
    if (!matched) return value;
    return `https://${matched[1]}/${matched[2].replace(/\.git$/, "")}`;
  }
  if (value.startsWith("ssh://git@")) {
    return value
      .replace(/^ssh:\/\/git@/, "https://")
      .replace(/:/, "/")
      .replace(/\.git$/, "");
  }
  return value.replace(/^git\+/, "").replace(/\.git$/, "");
}

export function AdapterManagePage() {
  const { setLeftContent, setRightContent } = useTopbar();
  const [mode, setMode] = useState<ViewMode>("overview");
  const [adapters, setAdapters] = useState<AdapterOverviewItem[]>([]);
  const [selectedName, setSelectedName] = useState("");
  const [detail, setDetail] = useState<AdapterDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [installOpen, setInstallOpen] = useState(false);
  const [installInput, setInstallInput] = useState("");
  const [installing, setInstalling] = useState(false);
  const [installOutput, setInstallOutput] = useState("");
  const [updatingName, setUpdatingName] = useState("");
  const navAnimSeedRef = useRef(0);
  const [navAnimSeed, setNavAnimSeed] = useState(0);

  const loadOverview = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ ok: true; data: AdapterOverviewItem[] }>(
        "/api/manage/adapters/overview",
      );
      setAdapters(res.data || []);
      navAnimSeedRef.current += 1;
      setNavAnimSeed(navAnimSeedRef.current);
    } catch {
      toast.error("加载适配器列表失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const needPoll = adapters.some(
      (item) =>
        item.updateChecking ||
        (item.updateState === "unknown" && !item.updateCheckedAt),
    );
    if (!needPoll) return;
    const timer = setTimeout(() => {
      loadOverview().then();
    }, 1200);
    return () => clearTimeout(timer);
  }, [adapters]);

  const updateAdapter = async (name: string) => {
    setUpdatingName(name);
    try {
      await apiFetch("/api/manage/update", {
        method: "POST",
        body: JSON.stringify({ name, target: "adapter" }),
      });
      toast.success(`${name} 更新完成，请重启 Mioku`);
      await loadOverview();
    } catch (error) {
      if (!(error instanceof Error)) {
        toast.error("更新失败");
      }
    } finally {
      setUpdatingName("");
    }
  };

  const loadDetail = async (name: string) => {
    setLoading(true);
    try {
      const res = await apiFetch<{ ok: true; data: AdapterDetail }>(
        `/api/manage/adapters/${encodeURIComponent(name)}`,
      );
      setDetail(res.data);
    } catch {
      toast.error("加载适配器详情失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOverview().then();
  }, []);

  useEffect(() => {
    if (mode === "detail" && selectedName) {
      loadDetail(selectedName).then();
    }
  }, [mode, selectedName]);

  useEffect(() => {
    const chipClass = (active: boolean) =>
      `topbar-chip whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium ${
        active
          ? "border-transparent bg-primary text-primary-foreground shadow-sm"
          : "border-transparent bg-secondary/50 text-secondary-foreground hover:bg-secondary"
      }`;

    setLeftContent(
      <div className="topbar-chip-scroll flex items-center gap-1 overflow-x-auto">
        <span
          key={`overview-${navAnimSeed}`}
          className="topbar-nav-item-enter"
        >
          <button
            onClick={() => setMode("overview")}
            className={chipClass(mode === "overview")}
          >
            适配器列表
          </button>
        </span>
        <span key={`install-${navAnimSeed}`} className="topbar-nav-item-enter">
          <button
            onClick={() => setInstallOpen(true)}
            className={chipClass(false)}
          >
            安装适配器
          </button>
        </span>
      </div>,
    );
    setRightContent(
      <Button
        variant="outline"
        size="sm"
        onClick={() => setInstallOpen(true)}
      >
        <Plus className="h-4 w-4 sm:mr-1" />
        <span className="hidden sm:inline">添加适配器</span>
      </Button>,
    );
    return () => {
      setLeftContent(null);
      setRightContent(null);
    };
  }, [mode, navAnimSeed]);

  const removeAdapter = async (name: string) => {
    const ok = await confirm({
      title: `卸载适配器 ${name}`,
      message: "确认卸载该适配器？",
      confirmText: "卸载",
      cancelText: "取消",
      variant: "danger",
    });
    if (!ok) return;

    try {
      await apiFetch("/api/manage/remove", {
        method: "POST",
        body: JSON.stringify({ name, target: "adapter" }),
      });
      toast.success(`适配器 ${name} 已卸载`);
      setMode("overview");
      await loadOverview();
    } catch {
      toast.error("卸载失败");
    }
  };

  const installAdapter = async () => {
    const pkgName = installInput.trim();
    if (!pkgName) {
      toast.warning("请输入适配器包名");
      return;
    }
    setInstalling(true);
    setInstallOutput("");
    try {
      const result = await apiFetch<any>("/api/manage/install", {
        method: "POST",
        body: JSON.stringify({
          repoUrl: pkgName,
          target: "adapter",
        }),
      });
      setInstallOutput(result.installOutput || "");
      toast.success(`适配器安装完成：${result.name}`);
      setInstallInput("");
      await loadOverview();
    } catch (error: any) {
      toast.error(error?.message || "安装失败");
    } finally {
      setInstalling(false);
    }
  };

  const closeInstall = () => {
    setInstallOpen(false);
    setInstallInput("");
    setInstallOutput("");
    setInstalling(false);
  };

  return (
    <div className="space-y-4 animate-soft-pop">
      {mode === "overview" && (
        <Card>
          <CardHeader>
            <CardTitle>适配器管理</CardTitle>
            <CardDescription>
              已安装的 mioku-adapter-* 适配器，共 {adapters.length} 个
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground py-4">加载中...</p>
            ) : adapters.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">
                暂无已安装适配器，点击右上角「添加适配器」从 npm 安装
              </p>
            ) : (
              <div className="space-y-1">
                {adapters.map((adapter) => (
                  <div
                    key={adapter.name}
                    className="flex items-center justify-between gap-4 border-l-2 border-border px-4 py-3 transition hover:border-primary"
                  >
                    <div
                      className="min-w-0 flex-1 cursor-pointer"
                      onClick={() => {
                        setSelectedName(adapter.name);
                        setMode("detail");
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="text-sm font-medium">
                          {adapter.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          v{adapter.version}
                        </span>
                        {adapter.updateChecking ? (
                          <Badge className="bg-sky-500/15 text-sky-700 dark:text-sky-300">
                            <LoaderCircle className="mr-1 h-3.5 w-3.5 animate-spin" />
                            检查中
                          </Badge>
                        ) : adapter.hasUpdates ? (
                          <Badge className="bg-orange-500/15 text-orange-700 dark:text-orange-300">
                            有更新
                          </Badge>
                        ) : adapter.updateState === "up-to-date" ? (
                          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                            最新
                          </Badge>
                        ) : null}
                      </div>
                      {adapter.description && (
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {adapter.description}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {adapter.repository ? (
                        <a
                          href={toBrowserRepoUrl(adapter.repository)}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-md p-2 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      ) : null}
                      <Button
                        variant="ghost"
                        size="sm"
                        title="更新"
                        onClick={() => updateAdapter(adapter.name).then()}
                        disabled={updatingName === adapter.name}
                      >
                        {updatingName === adapter.name ? (
                          <LoaderCircle className="h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:text-red-600"
                        onClick={() => removeAdapter(adapter.name).then()}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {mode === "detail" && (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>{detail?.name}</CardTitle>
              {detail ? (
                <span className="text-sm text-muted-foreground">
                  v{detail.version}
                </span>
              ) : null}
            </div>
            {detail?.description ? (
              <CardDescription>{detail.description}</CardDescription>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <p className="text-sm text-muted-foreground">加载中...</p>
            ) : detail ? (
              <>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setMode("overview")}
                  >
                    返回列表
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => removeAdapter(detail.name).then()}
                  >
                    卸载适配器
                  </Button>
                </div>
                {detail.readme ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none rounded-lg border p-4">
                    <pre className="max-h-96 overflow-auto whitespace-pre-wrap text-xs">
                      {detail.readme}
                    </pre>
                  </div>
                ) : null}
              </>
            ) : null}
          </CardContent>
        </Card>
      )}

      <Dialog
        open={installOpen}
        title="安装适配器"
        description="输入 npm 包名（如 mioku-adapter-onebotv11），或到插件市场浏览适配器"
        onClose={closeInstall}
        footer={
          <>
            <Button variant="outline" onClick={closeInstall} disabled={installing}>
              取消
            </Button>
            <Button onClick={installAdapter} disabled={installing}>
              {installing ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                "安装"
              )}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Input
            value={installInput}
            onChange={(e) => setInstallInput(e.target.value)}
            placeholder="mioku-adapter-xxx"
            onKeyDown={(e) => {
              if (e.key === "Enter") installAdapter().then();
            }}
            autoFocus
          />
          {installOutput ? (
            <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-muted p-3 text-xs">
              {installOutput}
            </pre>
          ) : null}
        </div>
      </Dialog>
    </div>
  );
}
