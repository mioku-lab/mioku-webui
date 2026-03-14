import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ExternalLink,
  LoaderCircle,
  RefreshCw,
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
import { Input } from "@/components/ui/input";
import { Markdown } from "@/components/ui/markdown";
import { confirm } from "@/components/ui/confirm";
import { useTopbar } from "@/components/layout/TopbarContext";
import { apiFetch } from "@/lib/api";
import { toast } from "@/lib/toast";

type ViewMode = "overview" | "detail" | "install";
type UpdateState = "up-to-date" | "has-updates" | "unknown" | "no-git";

interface ServiceOverviewItem {
  name: string;
  version: string;
  description: string;
  hasGit: boolean;
  isSystemService?: boolean;
  repository?: string;
  requiredServices: string[];
  updateState: UpdateState;
  hasUpdates: boolean;
  behind: number;
  updateError?: string;
}

interface ServiceDetail {
  name: string;
  version: string;
  description: string;
  hasGit: boolean;
  isSystemService?: boolean;
  repository: string;
  originUrl: string;
  requiredServices: string[];
  missingServices: string[];
  readme: string;
  readmeFile: string;
  updateState: UpdateState;
  hasUpdates: boolean;
  behind: number;
  changelog: string[];
  updateError?: string;
}

function sortServices(items: ServiceOverviewItem[]): ServiceOverviewItem[] {
  return [...items].sort((a, b) => {
    const sysA = a.isSystemService ? 1 : 0;
    const sysB = b.isSystemService ? 1 : 0;
    if (sysA !== sysB) return sysB - sysA;
    return a.name.localeCompare(b.name, "zh-Hans-CN");
  });
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

function getUpdateBadge(state: UpdateState, behind: number) {
  if (state === "has-updates") {
    return (
      <Badge className="bg-orange-500/15 text-orange-700 dark:text-orange-300">
        有更新{behind > 0 ? ` +${behind}` : ""}
      </Badge>
    );
  }
  if (state === "up-to-date") {
    return (
      <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
        最新
      </Badge>
    );
  }
  if (state === "no-git") return null;
  return (
    <Badge className="bg-yellow-500/15 text-yellow-700 dark:text-yellow-300">
      未知
    </Badge>
  );
}

export function ServiceManagePage() {
  const { setLeftContent, setRightContent } = useTopbar();

  const [mode, setMode] = useState<ViewMode>("overview");
  const [services, setServices] = useState<ServiceOverviewItem[]>([]);
  const [selectedName, setSelectedName] = useState("");
  const [detail, setDetail] = useState<ServiceDetail | null>(null);

  const [repoUrlInput, setRepoUrlInput] = useState("");
  const [repoEditInput, setRepoEditInput] = useState("");
  const [installOutput, setInstallOutput] = useState("");
  const [missingServices, setMissingServices] = useState<string[]>([]);

  const [loadingOverview, setLoadingOverview] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [updatingAll, setUpdatingAll] = useState(false);
  const [updatingName, setUpdatingName] = useState("");
  const [removingName, setRemovingName] = useState("");
  const [savingRepo, setSavingRepo] = useState(false);

  const loadOverview = async () => {
    setLoadingOverview(true);
    try {
      const res = await apiFetch<{ ok: true; data: ServiceOverviewItem[] }>(
        "/api/manage/services/overview",
      );
      const next = sortServices(res.data || []);
      setServices(next);

      if (!selectedName && next[0]?.name) {
        setSelectedName(next[0].name);
      }
      if (selectedName && !next.some((item) => item.name === selectedName)) {
        setSelectedName(next[0]?.name || "");
        setDetail(null);
        setMode("overview");
      }
    } catch (error) {
      if (!(error instanceof Error)) {
        toast.error("加载服务列表失败");
      }
    } finally {
      setLoadingOverview(false);
    }
  };

  const loadDetail = async (name: string) => {
    setLoadingDetail(true);
    setDetail(null);
    try {
      const res = await apiFetch<{ ok: true; data: ServiceDetail }>(
        `/api/manage/services/${encodeURIComponent(name)}`,
      );
      setDetail(res.data);
      setRepoEditInput(res.data.originUrl || res.data.repository || "");
    } catch (error) {
      if (!(error instanceof Error)) {
        toast.error("加载服务详情失败");
      }
    } finally {
      setLoadingDetail(false);
    }
  };

  useEffect(() => {
    loadOverview().then();
  }, []);

  useEffect(() => {
    const chips = (
      <div className="flex items-center gap-2 whitespace-nowrap">
        <button
          type="button"
          onClick={() => setMode("overview")}
          className={`topbar-chip rounded-md px-2.5 py-1.5 text-xs transition-all duration-300 ${
            mode === "overview"
              ? "scale-105 bg-primary text-primary-foreground shadow-md"
              : "bg-secondary text-secondary-foreground hover:-translate-y-0.5"
          }`}
        >
          总览
        </button>
        <button
          type="button"
          onClick={() => setMode("install")}
          className={`topbar-chip rounded-md px-2.5 py-1.5 text-xs transition-all duration-300 ${
            mode === "install"
              ? "scale-105 bg-primary text-primary-foreground shadow-md"
              : "bg-secondary text-secondary-foreground hover:-translate-y-0.5"
          }`}
        >
          安装
        </button>
        {services.map((service) => (
          <button
            key={service.name}
            type="button"
            onClick={() => {
              setSelectedName(service.name);
              setMode("detail");
              loadDetail(service.name).then();
            }}
            className={`topbar-chip rounded-md px-2.5 py-1.5 text-xs transition-all duration-300 ${
              mode === "detail" && selectedName === service.name
                ? "scale-105 bg-primary text-primary-foreground shadow-md"
                : "bg-secondary text-secondary-foreground hover:-translate-y-0.5"
            }`}
          >
            {service.name}
          </button>
        ))}
      </div>
    );
    setLeftContent(chips);
    setRightContent(null);
    return () => {
      setLeftContent(null);
      setRightContent(null);
    };
  }, [mode, services, selectedName, setLeftContent, setRightContent]);

  const updateService = async (name: string) => {
    setUpdatingName(name);
    try {
      await apiFetch("/api/manage/update", {
        method: "POST",
        body: JSON.stringify({ name, target: "service" }),
      });
      toast.success(`${name} 更新完成，请重启 Mioku`);
      await loadOverview();
      if (selectedName === name && mode === "detail") {
        await loadDetail(name);
      }
    } catch (error) {
      if (!(error instanceof Error)) {
        toast.error("更新失败");
      }
    } finally {
      setUpdatingName("");
    }
  };

  const removeService = async (name: string) => {
    const target = services.find((item) => item.name === name);
    if (target?.isSystemService) {
      toast.warning(`${name} 是 system 服务，无法卸载`);
      return;
    }

    const ok = await confirm({
      title: "卸载服务",
      message: `确认卸载 ${name} 吗？`,
      confirmText: "卸载",
      cancelText: "取消",
    });
    if (!ok) return;

    setRemovingName(name);
    try {
      await apiFetch("/api/manage/remove", {
        method: "POST",
        body: JSON.stringify({ name, target: "service" }),
      });
      toast.success(`${name} 已卸载，请重启 Mioku`);
      if (selectedName === name) {
        setMode("overview");
        setDetail(null);
      }
      await loadOverview();
    } catch (error) {
      if (!(error instanceof Error)) {
        toast.error("卸载失败");
      }
    } finally {
      setRemovingName("");
    }
  };

  const updateAllServices = async () => {
    setUpdatingAll(true);
    try {
      const result = await apiFetch<any>("/api/manage/update-all", {
        method: "POST",
        body: JSON.stringify({ target: "service" }),
      });
      toast.success(
        `全部更新完成：更新 ${result.updatedCount || 0} 个，失败 ${result.failedCount || 0} 个，跳过 ${result.skippedCount || 0} 个`,
      );
      await loadOverview();
      if (selectedName && mode === "detail") {
        await loadDetail(selectedName);
      }
    } catch (error) {
      if (!(error instanceof Error)) {
        toast.error("全部更新失败");
      }
    } finally {
      setUpdatingAll(false);
    }
  };

  const installService = async () => {
    if (!repoUrlInput.trim()) {
      toast.warning("请输入服务 Git 地址");
      return;
    }

    setInstalling(true);
    setInstallOutput("");
    try {
      const result = await apiFetch<any>("/api/manage/install", {
        method: "POST",
        body: JSON.stringify({
          repoUrl: repoUrlInput.trim(),
          target: "service",
        }),
      });
      setInstallOutput(result.installOutput || "");
      toast.success(`安装成功：${result.name}，请重启 Mioku`);
      if (
        Array.isArray(result.missingServices) &&
        result.missingServices.length
      ) {
        setMissingServices(result.missingServices);
      }
      setRepoUrlInput("");
      await loadOverview();
    } catch (error) {
      if (!(error instanceof Error)) {
        toast.error("安装失败");
      }
    } finally {
      setInstalling(false);
    }
  };

  const changeRepo = async () => {
    if (!selectedName) return;
    if (!repoEditInput.trim()) {
      toast.warning("请输入新的仓库地址");
      return;
    }
    setSavingRepo(true);
    try {
      await apiFetch("/api/manage/change-repo", {
        method: "POST",
        body: JSON.stringify({
          name: selectedName,
          target: "service",
          repoUrl: repoEditInput.trim(),
        }),
      });
      toast.success(`${selectedName} 仓库地址已更新`);
      await loadOverview();
      await loadDetail(selectedName);
    } catch (error) {
      if (!(error instanceof Error)) {
        toast.error("修改仓库地址失败");
      }
    } finally {
      setSavingRepo(false);
    }
  };

  const openRepo = () => {
    const raw = detail?.originUrl || detail?.repository || "";
    const href = toBrowserRepoUrl(raw);
    if (!href) {
      toast.warning("该服务没有可用仓库地址");
      return;
    }
    window.open(href, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="space-y-4 animate-soft-pop">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card/80 p-3 backdrop-blur">
        <Button
          size="sm"
          onClick={updateAllServices}
          disabled={updatingAll || loadingOverview || services.length === 0}
        >
          {updatingAll ? (
            <>
              <LoaderCircle className="mr-1.5 h-4 w-4 animate-spin" />
              全部更新中
            </>
          ) : (
            "全部更新"
          )}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => loadOverview().then()}
          disabled={loadingOverview}
        >
          <RefreshCw
            className={`mr-1.5 h-4 w-4 ${loadingOverview ? "animate-spin" : ""}`}
          />
          刷新状态
        </Button>
      </div>

      {mode === "overview" ? (
        <Card className="animate-soft-pop">
          <CardHeader>
            <CardTitle>服务总览</CardTitle>
            <CardDescription>点击某服务查看其详情 :)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {services.map((service) => (
              <button
                key={service.name}
                type="button"
                onClick={() => {
                  setSelectedName(service.name);
                  setMode("detail");
                  loadDetail(service.name).then();
                }}
                className="group w-full rounded-xl border bg-card/70 p-3 text-left transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold">
                        {service.name}
                      </p>
                      {service.isSystemService ? (
                        <Badge>system</Badge>
                      ) : (
                        <Badge>{service.version}</Badge>
                      )}
                      {getUpdateBadge(service.updateState, service.behind)}
                    </div>
                    {service.description ? (
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {service.description}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      onClick={(event) => {
                        event.stopPropagation();
                        updateService(service.name).then();
                      }}
                      disabled={
                        !service.hasGit ||
                        updatingName === service.name ||
                        removingName === service.name
                      }
                    >
                      {updatingName === service.name ? (
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                      ) : (
                        "更新"
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={(event) => {
                        event.stopPropagation();
                        removeService(service.name).then();
                      }}
                      disabled={
                        Boolean(service.isSystemService) ||
                        updatingName === service.name ||
                        removingName === service.name
                      }
                    >
                      {service.isSystemService ? (
                        "system"
                      ) : removingName === service.name ? (
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                      ) : (
                        "卸载"
                      )}
                    </Button>
                  </div>
                </div>
              </button>
            ))}
            {!loadingOverview && services.length === 0 ? (
              <p className="text-sm text-muted-foreground">暂无服务</p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {mode === "install" ? (
        <Card className="animate-soft-pop">
          <CardHeader>
            <CardTitle>安装服务</CardTitle>
            <CardDescription>
              输入服务 Git 仓库地址，服务端会 clone 并安装依赖。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="https://github.com/owner/repo.git"
              value={repoUrlInput}
              onChange={(event) => setRepoUrlInput(event.target.value)}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={installService} disabled={installing}>
                {installing ? (
                  <>
                    <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
                    安装中
                  </>
                ) : (
                  "安装"
                )}
              </Button>
            </div>
            {installing ? (
              <div className="flex items-center gap-2 rounded-lg border bg-secondary/30 p-3 text-sm">
                <LoaderCircle className="h-4 w-4 animate-spin text-primary" />
                正在 clone 仓库并安装依赖，请稍候...
              </div>
            ) : null}
            {installOutput ? (
              <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-lg border bg-secondary/20 p-3 text-xs">
                {installOutput}
              </pre>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {mode === "detail" ? (
        <div className="space-y-4 animate-soft-pop">
          {loadingDetail ? (
            <Card>
              <CardContent className="flex items-center gap-2 p-5 text-sm text-muted-foreground">
                <LoaderCircle className="h-4 w-4 animate-spin" />
                正在加载服务详情...
              </CardContent>
            </Card>
          ) : null}

          {!loadingDetail && detail ? (
            <>
              <Card>
                <CardHeader>
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle>{detail.name}</CardTitle>
                    {detail.isSystemService ? (
                      <Badge>system</Badge>
                    ) : (
                      <Badge>{detail.version}</Badge>
                    )}
                    {getUpdateBadge(detail.updateState, detail.behind)}
                  </div>
                  <CardDescription>{detail.description || "无描述"}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      onClick={openRepo}
                      disabled={!detail.originUrl && !detail.repository}
                    >
                      <ExternalLink className="mr-1.5 h-4 w-4" />
                      打开仓库
                    </Button>
                    <Button
                      onClick={() => updateService(detail.name)}
                      disabled={!detail.hasGit || updatingName === detail.name}
                    >
                      {updatingName === detail.name ? (
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                      ) : (
                        "更新"
                      )}
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => removeService(detail.name)}
                      disabled={
                        Boolean(detail.isSystemService) ||
                        removingName === detail.name
                      }
                    >
                      {detail.isSystemService ? (
                        "system"
                      ) : removingName === detail.name ? (
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                      ) : (
                        "卸载"
                      )}
                    </Button>
                  </div>

                  <div className="space-y-2 rounded-xl border bg-secondary/15 p-3">
                    <p className="text-sm font-medium">仓库原地址</p>
                    <div className="flex flex-col gap-2 md:flex-row">
                      <Input
                        value={repoEditInput}
                        onChange={(event) => setRepoEditInput(event.target.value)}
                        placeholder="输入新的 Git 仓库地址"
                      />
                      <Button onClick={changeRepo} disabled={savingRepo || !detail.hasGit}>
                        {savingRepo ? (
                          <LoaderCircle className="h-4 w-4 animate-spin" />
                        ) : (
                          "保存地址"
                        )}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-medium">依赖服务</p>
                    <div className="flex flex-wrap gap-2">
                      {detail.requiredServices.length > 0 ? (
                        detail.requiredServices.map((service) => (
                          <Badge key={service}>{service}</Badge>
                        ))
                      ) : (
                        <p className="text-xs text-muted-foreground">无额外服务依赖</p>
                      )}
                    </div>
                    {detail.missingServices.length > 0 ? (
                      <p className="text-xs text-yellow-600 dark:text-yellow-400">
                        缺失服务: {detail.missingServices.join(", ")}
                      </p>
                    ) : null}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>
                    README {detail.readmeFile ? `(${detail.readmeFile})` : ""}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {detail.readme ? (
                    <div className="max-h-[540px] overflow-auto rounded-lg border bg-secondary/20 p-3">
                      <Markdown content={detail.readme} />
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      该服务没有 README 文件。
                    </p>
                  )}
                </CardContent>
              </Card>
            </>
          ) : null}

          {!loadingDetail && !detail && selectedName ? (
            <Card>
              <CardContent className="p-5 text-sm text-muted-foreground">
                未找到服务 <span className="font-mono">{selectedName}</span> 的详情。
              </CardContent>
            </Card>
          ) : null}
        </div>
      ) : null}

      {missingServices.length > 0 ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-xl border bg-card p-5 animate-scale-in">
            <div className="mb-3 flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-yellow-500/15">
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
              </div>
              <div>
                <p className="font-semibold">检测到缺失服务</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  服务安装完成，但以下服务未安装：
                </p>
              </div>
            </div>
            <div className="rounded-lg border bg-secondary/20 p-3 text-sm">
              {missingServices.join(", ")}
            </div>
            <div className="mt-4 flex justify-end">
              <Button onClick={() => setMissingServices([])}>知道了</Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
