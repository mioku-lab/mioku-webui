import { useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  ExternalLink,
  LoaderCircle,
  Package,
  RefreshCw,
  Search,
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
import { useTopbar } from "@/components/layout/TopbarContext";
import { apiFetch } from "@/lib/api";
import { toast } from "@/lib/toast";

type StoreViewMode = "list" | "detail" | "url-install";
type StoreType = "plugin" | "service" | "all";

interface StoreItem {
  name: string;
  npm: string;
  type: "plugin" | "service";
  description: string;
  version: string;
  keywords: string[];
  tags: string[];
  official: boolean;
  builtin: boolean;
  repo: string;
  homepage: string;
  npmUrl: string;
  date: string;
}

interface StoreSearchResponse {
  items: StoreItem[];
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
  q: string;
  type: StoreType;
}

interface StorePackageDetail extends StoreItem {
  readme: string;
  license: string;
  dependencies: Record<string, string>;
  requiredServices: string[];
  installTarget: "plugin" | "service";
  installPath: string;
}

interface InstalledPlugin {
  name: string;
  version: string;
  description: string;
  hasGit: boolean;
  isSystemPlugin?: boolean;
  repository?: string;
  requiredServices: string[];
}

const PAGE_SIZE = 12;

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

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function formatTag(tag: string): string {
  return tag.replace(/^mioku-/, "");
}

export function PluginStorePage() {
  const { setLeftContent, setRightContent } = useTopbar();

  const [installedPlugins, setInstalledPlugins] = useState<InstalledPlugin[]>([]);
  const [mode, setMode] = useState<StoreViewMode>("list");
  const [activeType, setActiveType] = useState<StoreType>("all");
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [listData, setListData] = useState<StoreSearchResponse | null>(null);
  const [loadingList, setLoadingList] = useState(false);

  const [selectedPackage, setSelectedPackage] = useState("");
  const [detail, setDetail] = useState<StorePackageDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [urlInput, setUrlInput] = useState("");
  const [urlTarget, setUrlTarget] = useState<"plugin" | "service">("plugin");
  const [installing, setInstalling] = useState(false);
  const [installingKey, setInstallingKey] = useState("");

  const [servicePickerOpen, setServicePickerOpen] = useState(false);
  const [servicePickerMissing, setServicePickerMissing] = useState<string[]>([]);
  const [servicePickerCustomUrl, setServicePickerCustomUrl] = useState("");
  const [officialServices, setOfficialServices] = useState<Record<string, string>>({});
  const navAnimSeedRef = useRef(0);
  const [navAnimSeed, setNavAnimSeed] = useState(0);

  const offset = (page - 1) * PAGE_SIZE;

  const loadOfficial = async () => {
    try {
      const res = await apiFetch<{
        ok: true;
        data: {
          services?: Record<string, { npm: string }>;
        };
      }>("/api/store/official");
      const next: Record<string, string> = {};
      for (const [name, entry] of Object.entries(res.data?.services || {})) {
        if (entry?.npm) next[name] = entry.npm;
      }
      setOfficialServices(next);
    } catch {
      // silent
    }
  };

  const loadInstalled = async () => {
    try {
      const res = await apiFetch<{ ok: true; data: InstalledPlugin[] }>(
        "/api/manage/plugins",
      );
      setInstalledPlugins(res.data || []);
    } catch {
      // silent
    }
  };

  const loadList = async (options?: { silent?: boolean }) => {
    if (!options?.silent) setLoadingList(true);
    try {
      const params = new URLSearchParams({
        type: activeType,
        q: searchQuery,
        offset: String(offset),
        limit: String(PAGE_SIZE),
      });
      const res = await apiFetch<{ ok: true; data: StoreSearchResponse }>(
        `/api/store/search?${params.toString()}`,
      );
      setListData(res.data);
      navAnimSeedRef.current += 1;
      setNavAnimSeed(navAnimSeedRef.current);
    } catch {
      if (!options?.silent) toast.error("加载插件市场失败");
    } finally {
      if (!options?.silent) setLoadingList(false);
    }
  };

  const loadDetail = async (packageName: string) => {
    setLoadingDetail(true);
    setDetail(null);
    try {
      const res = await apiFetch<{ ok: true; data: StorePackageDetail }>(
        `/api/store/package/${encodeURIComponent(packageName)}`,
      );
      setDetail(res.data);
    } catch {
      toast.error("加载详情失败");
    } finally {
      setLoadingDetail(false);
    }
  };

  useEffect(() => {
    loadOfficial().then();
    loadInstalled().then();
  }, []);

  useEffect(() => {
    if (mode === "list") {
      loadList().then();
    }
  }, [activeType, searchQuery, page, mode]);

  const isInstalled = (name: string): boolean => {
    return installedPlugins.some((p) => p.name === name);
  };

  const installFromStore = async (item: StoreItem | StorePackageDetail) => {
    if (!item.repo) {
      toast.warning("该包未提供仓库地址");
      return;
    }
    if (item.type === "plugin" && isInstalled(item.name)) {
      toast.info(`${item.name} 已安装`);
      return;
    }

    setInstallingKey(item.npm);
    try {
      const result = await apiFetch<any>("/api/manage/install", {
        method: "POST",
        body: JSON.stringify({
          repoUrl: item.repo,
          target: item.type,
        }),
      });
      toast.success(`安装成功：${result.name}，请重启 Mioku`);
      await loadInstalled();
      if (
        item.type === "plugin" &&
        Array.isArray(result.missingServices) &&
        result.missingServices.length
      ) {
        setServicePickerMissing(result.missingServices);
        setServicePickerCustomUrl("");
        setServicePickerOpen(true);
      }
    } catch (error) {
      if (!(error instanceof Error)) toast.error("安装失败");
    } finally {
      setInstallingKey("");
    }
  };

  const installFromUrl = async () => {
    if (!urlInput.trim()) {
      toast.warning("请输入 Git 仓库地址");
      return;
    }
    setInstalling(true);
    try {
      const result = await apiFetch<any>("/api/manage/install", {
        method: "POST",
        body: JSON.stringify({
          repoUrl: urlInput.trim(),
          target: urlTarget,
        }),
      });
      toast.success(`安装成功：${result.name}，请重启 Mioku`);
      setUrlInput("");
      await loadInstalled();
      if (
        Array.isArray(result.missingServices) &&
        result.missingServices.length
      ) {
        setServicePickerMissing(result.missingServices);
        setServicePickerCustomUrl("");
        setServicePickerOpen(true);
      }
    } catch (error) {
      if (!(error instanceof Error)) toast.error("安装失败");
    } finally {
      setInstalling(false);
    }
  };

  const installServiceByName = async (serviceName: string) => {
    const npm = officialServices[serviceName];
    if (!npm) {
      toast.warning(`未找到服务 ${serviceName} 的官方包`);
      return;
    }

    try {
      const res = await apiFetch<{ ok: true; data: StorePackageDetail }>(
        `/api/store/package/${encodeURIComponent(npm)}`,
      );
      if (!res.data.repo) {
        toast.warning(`服务 ${serviceName} 未提供仓库地址`);
        return;
      }
      await apiFetch<any>("/api/manage/install", {
        method: "POST",
        body: JSON.stringify({
          repoUrl: res.data.repo,
          target: "service",
        }),
      });
      toast.success(`服务 ${serviceName} 安装成功，请重启 Mioku`);
      setServicePickerMissing((prev) => prev.filter((item) => item !== serviceName));
    } catch {
      toast.error(`安装服务 ${serviceName} 失败`);
    }
  };

  const installServiceFromCustomUrl = async () => {
    if (!servicePickerCustomUrl.trim()) {
      toast.warning("请输入服务仓库地址");
      return;
    }
    try {
      await apiFetch<any>("/api/manage/install", {
        method: "POST",
        body: JSON.stringify({
          repoUrl: servicePickerCustomUrl.trim(),
          target: "service",
        }),
      });
      toast.success("服务安装成功，请重启 Mioku");
      setServicePickerOpen(false);
    } catch {
      toast.error("安装服务失败");
    }
  };

  const availableTags = useMemo(() => {
    return uniqueStrings(
      (listData?.items || []).flatMap((item) => item.tags || []),
    ).slice(0, 12);
  }, [listData]);

  const totalPages = Math.max(
    1,
    Math.ceil((listData?.total || 0) / PAGE_SIZE),
  );

  useEffect(() => {
    const chipClass = (active: boolean) =>
      `topbar-chip rounded-full border px-3 py-1.5 text-xs ${
        active
          ? "border-transparent bg-primary text-primary-foreground shadow-md"
          : "border-transparent bg-secondary text-secondary-foreground"
      }`;

    const types: Array<{ key: StoreType; label: string }> = [
      { key: "all", label: "全部" },
      { key: "plugin", label: "插件" },
      { key: "service", label: "服务" },
    ];

    const chips = (
      <div className="flex items-center gap-2 whitespace-nowrap">
        {types.map((type, index) => (
          <span
            key={`${type.key}-${navAnimSeed}`}
            className="topbar-nav-item-enter"
            style={{ animationDelay: `${index * 45}ms` }}
          >
            <button
              type="button"
              onClick={() => {
                setActiveType(type.key);
                setPage(1);
                setMode("list");
              }}
              className={chipClass(activeType === type.key && mode === "list")}
            >
              {type.label}
            </button>
          </span>
        ))}
        <span
          key={`url-install-${navAnimSeed}`}
          className="topbar-nav-item-enter"
          style={{ animationDelay: `${types.length * 45}ms` }}
        >
          <button
            type="button"
            onClick={() => setMode("url-install")}
            className={chipClass(mode === "url-install")}
          >
            从 URL 安装
          </button>
        </span>
      </div>
    );

    setLeftContent(chips);
    setRightContent(
      <Button
        size="sm"
        variant="outline"
        onClick={() => loadList().then()}
        disabled={loadingList}
      >
        <RefreshCw
          className={`mr-1.5 h-4 w-4 ${loadingList ? "animate-spin" : ""}`}
        />
        刷新
      </Button>,
    );

    return () => {
      setLeftContent(null);
      setRightContent(null);
    };
  }, [activeType, mode, navAnimSeed, loadingList, setLeftContent, setRightContent]);

  return (
    <div className="space-y-4 animate-soft-pop">
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="搜索 npm 包、描述或标签..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setSearchQuery(searchInput.trim());
                setPage(1);
              }
            }}
            className="pl-9 pr-24"
          />
          <Button
            size="sm"
            className="absolute right-1.5 top-1/2 h-8 -translate-y-1/2"
            onClick={() => {
              setSearchQuery(searchInput.trim());
              setPage(1);
            }}
          >
            搜索
          </Button>
        </div>

        {availableTags.length > 0 && mode === "list" && (
          <div className="flex flex-wrap gap-2">
            {availableTags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => {
                  setSearchInput(tag);
                  setSearchQuery(tag);
                  setPage(1);
                }}
                className="rounded-full border bg-secondary/40 px-3 py-1 text-xs text-muted-foreground transition hover:text-foreground"
              >
                #{formatTag(tag)}
              </button>
            ))}
          </div>
        )}
      </div>

      {mode === "list" && (
        <Card className="animate-soft-pop">
          <CardHeader>
            <CardTitle>
              {activeType === "all"
                ? "插件与服务市场"
                : activeType === "plugin"
                  ? "插件市场"
                  : "服务市场"}
            </CardTitle>
            <CardDescription>
              共 {listData?.total || 0} 个结果{searchQuery ? ` · 搜索：${searchQuery}` : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(listData?.items || []).map((item) => (
              <div
                key={item.npm}
                className="group rounded-xl border bg-card/70 p-3 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold">{item.name}</p>
                      <Badge className="bg-secondary">{item.type === "plugin" ? "插件" : "服务"}</Badge>
                      {item.official ? (
                        <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                          官方
                        </Badge>
                      ) : (
                        <Badge className="bg-sky-500/15 text-sky-700 dark:text-sky-300">
                          社区
                        </Badge>
                      )}
                      {item.type === "plugin" && isInstalled(item.name) && (
                        <Badge className="bg-violet-500/15 text-violet-700 dark:text-violet-300">
                          已安装
                        </Badge>
                      )}
                      {item.version && <Badge>{item.version}</Badge>}
                      {item.tags.slice(0, 3).map((tag) => (
                        <Badge key={tag} className="bg-secondary/60 text-muted-foreground">
                          #{formatTag(tag)}
                        </Badge>
                      ))}
                    </div>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {item.description || "暂无描述"}
                    </p>
                    <p className="mt-1 truncate text-[11px] text-muted-foreground/80">
                      {item.npm}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedPackage(item.npm);
                        setMode("detail");
                        loadDetail(item.npm).then();
                      }}
                    >
                      <ExternalLink className="mr-1.5 h-4 w-4" />
                      详情
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => installFromStore(item)}
                      disabled={
                        (!item.repo && item.type === "plugin") ||
                        (item.type === "plugin" && isInstalled(item.name)) ||
                        installingKey === item.npm
                      }
                    >
                      {installingKey === item.npm ? (
                        <LoaderCircle className="mr-1.5 h-4 w-4 animate-spin" />
                      ) : item.type === "plugin" && isInstalled(item.name) ? (
                        "已安装"
                      ) : (
                        <>
                          <Download className="mr-1.5 h-4 w-4" />
                          安装
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            ))}

            {!loadingList && (listData?.items?.length || 0) === 0 && (
              <p className="text-sm text-muted-foreground">
                {searchQuery ? "没有匹配的结果" : "暂无可用包"}
              </p>
            )}

            {loadingList && (
              <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
                <LoaderCircle className="h-4 w-4 animate-spin" />
                正在加载插件市场...
              </div>
            )}

            <div className="flex items-center justify-between border-t pt-3">
              <p className="text-xs text-muted-foreground">
                第 {page} / {totalPages} 页
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  disabled={page <= 1 || loadingList}
                >
                  上一页
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPage((prev) => prev + 1)}
                  disabled={!listData?.hasMore || loadingList}
                >
                  下一页
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {mode === "detail" && (
        <div className="space-y-4 animate-soft-pop">
          <Button size="sm" variant="outline" onClick={() => setMode("list")}>
            返回列表
          </Button>

          {loadingDetail && (
            <Card>
              <CardContent className="flex items-center gap-2 p-5 text-sm text-muted-foreground">
                <LoaderCircle className="h-4 w-4 animate-spin" />
                正在加载详情...
              </CardContent>
            </Card>
          )}

          {detail && (
            <>
              <Card>
                <CardHeader>
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle>{detail.name}</CardTitle>
                    <Badge className="bg-secondary">
                      {detail.type === "plugin" ? "插件" : "服务"}
                    </Badge>
                    {detail.official ? (
                      <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                        官方
                      </Badge>
                    ) : (
                      <Badge className="bg-sky-500/15 text-sky-700 dark:text-sky-300">
                        社区
                      </Badge>
                    )}
                    {detail.version && <Badge>{detail.version}</Badge>}
                    {detail.tags.slice(0, 5).map((tag) => (
                      <Badge key={tag} className="bg-secondary/60 text-muted-foreground">
                        #{formatTag(tag)}
                      </Badge>
                    ))}
                  </div>
                  <CardDescription>
                    {detail.description || "暂无描述"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        const href = toBrowserRepoUrl(detail.repo);
                        if (href) window.open(href, "_blank", "noopener,noreferrer");
                      }}
                      disabled={!detail.repo}
                    >
                      <ExternalLink className="mr-1.5 h-4 w-4" />
                      打开仓库
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        if (detail.npmUrl) {
                          window.open(detail.npmUrl, "_blank", "noopener,noreferrer");
                        }
                      }}
                    >
                      npm
                    </Button>
                    <Button
                      onClick={() => installFromStore(detail)}
                      disabled={
                        (!detail.repo && detail.type === "plugin") ||
                        (detail.type === "plugin" && isInstalled(detail.name)) ||
                        installingKey === detail.npm
                      }
                    >
                      {installingKey === detail.npm ? (
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                      ) : detail.type === "plugin" && isInstalled(detail.name) ? (
                        "已安装"
                      ) : (
                        "安装"
                      )}
                    </Button>
                  </div>

                  <div className="space-y-2 text-sm">
                    <p className="text-muted-foreground">包名：{detail.npm}</p>
                    {detail.installPath && (
                      <p className="text-muted-foreground">安装目录：{detail.installPath}</p>
                    )}
                    {detail.license && (
                      <p className="text-muted-foreground">License：{detail.license}</p>
                    )}
                  </div>

                  {detail.requiredServices.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">依赖服务</p>
                      <div className="flex flex-wrap gap-2">
                        {detail.requiredServices.map((service) => (
                          <Badge key={service}>{service}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>README</CardTitle>
                </CardHeader>
                <CardContent>
                  {detail.readme ? (
                    <div className="max-h-[540px] overflow-auto rounded-lg border bg-secondary/20 p-3">
                      <Markdown content={detail.readme} />
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">该包没有 README。</p>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}

      {mode === "url-install" && (
        <Card className="animate-soft-pop">
          <CardHeader>
            <CardTitle>从 URL 安装</CardTitle>
            <CardDescription>
              输入任意 Git 仓库地址，选择类型后安装
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="https://github.com/owner/repo.git"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
            />
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex rounded-lg border bg-secondary/30 p-1">
                <button
                  type="button"
                  onClick={() => setUrlTarget("plugin")}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                    urlTarget === "plugin"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  插件
                </button>
                <button
                  type="button"
                  onClick={() => setUrlTarget("service")}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                    urlTarget === "service"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  服务
                </button>
              </div>
              <Button onClick={installFromUrl} disabled={installing}>
                {installing ? (
                  <>
                    <LoaderCircle className="mr-1.5 h-4 w-4 animate-spin" />
                    安装中
                  </>
                ) : (
                  <>
                    <Download className="mr-1.5 h-4 w-4" />
                    安装
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {servicePickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg rounded-xl border bg-card p-5 animate-scale-in">
            <div className="mb-4 flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-yellow-500/15">
                <Package className="h-5 w-5 text-yellow-500" />
              </div>
              <div>
                <p className="font-semibold">检测到缺失服务</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  插件安装完成，但以下服务未安装：
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {servicePickerMissing.map((serviceName) => {
                const hasOfficial = Boolean(officialServices[serviceName]);
                return (
                  <div
                    key={serviceName}
                    className="rounded-lg border bg-secondary/20 p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">{serviceName}</p>
                        <p className="text-xs text-muted-foreground">
                          {hasOfficial ? "可从官方源安装" : "需手动提供仓库地址"}
                        </p>
                      </div>
                      {hasOfficial ? (
                        <Button size="sm" onClick={() => installServiceByName(serviceName)}>
                          <Download className="mr-1.5 h-4 w-4" />
                          从官方安装
                        </Button>
                      ) : (
                        <Badge className="bg-yellow-500/15 text-yellow-700 dark:text-yellow-300">
                          需手动安装
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 space-y-2 rounded-lg border bg-secondary/15 p-3">
              <p className="text-sm font-medium">手动安装服务</p>
              <div className="flex gap-2">
                <Input
                  placeholder="https://github.com/owner/service-repo.git"
                  value={servicePickerCustomUrl}
                  onChange={(e) => setServicePickerCustomUrl(e.target.value)}
                />
                <Button
                  size="sm"
                  onClick={installServiceFromCustomUrl}
                  disabled={!servicePickerCustomUrl.trim()}
                >
                  安装
                </Button>
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <Button onClick={() => setServicePickerOpen(false)}>关闭</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
