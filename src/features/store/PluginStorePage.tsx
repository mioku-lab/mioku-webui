import { useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  ExternalLink,
  LoaderCircle,
  Package,
  Plus,
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
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/input";
import { Markdown } from "@/components/ui/markdown";
import { useTopbar } from "@/components/layout/TopbarContext";
import { apiFetch } from "@/lib/api";
import { toast } from "@/lib/toast";
import { confirm } from "@/components/ui/confirm";

type StoreViewMode = "list" | "detail";
type StoreType = "plugin" | "service" | "adapter" | "all";

const PAGE_SIZE = 12;
const NPM_SEARCH_URL = "https://registry.npmjs.org/-/v1/search";
const NPM_PACKAGE_URL = "https://registry.npmjs.org";
const GITHUB_RAW = "https://raw.githubusercontent.com/mioku-lab/mioku/main";

interface OfficialEntry {
  npm?: string;
  builtin?: boolean;
}

interface OfficialRegistry {
  plugins: Record<string, OfficialEntry>;
  services: Record<string, OfficialEntry>;
  adapters: Record<string, OfficialEntry>;
}

interface NpmSearchObject {
  package: {
    name: string;
    description?: string;
    version?: string;
    keywords?: string[];
    date?: string;
    links?: {
      npm?: string;
      repository?: string;
      homepage?: string;
    };
  };
  searchScore?: number;
  score?: { final?: number };
}

interface StoreItem {
  name: string;
  npm: string;
  type: "plugin" | "service" | "adapter";
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
  searchScore: number;
}

interface StorePackageDetail extends StoreItem {
  readme: string;
  license: string;
  dependencies: Record<string, string>;
  requiredServices: string[];
  installTarget: "plugin" | "service" | "adapter";
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

type InstalledService = InstalledPlugin;

function inferType(name: string): "plugin" | "service" | "adapter" | null {
  if (name.startsWith("mioku-plugin-")) return "plugin";
  if (name.startsWith("mioku-service-")) return "service";
  if (name.startsWith("mioku-adapter-")) return "adapter";
  return null;
}

function stripPrefix(name: string, type: "plugin" | "service" | "adapter"): string {
  const prefix =
    type === "plugin" ? "mioku-plugin-" : type === "service" ? "mioku-service-" : "mioku-adapter-";
  return name.startsWith(prefix) ? name.slice(prefix.length) : name;
}

function normalizeKeywords(keywords: unknown): string[] {
  if (!Array.isArray(keywords)) return [];
  return keywords.map((k) => String(k));
}

function extractTags(keywords: string[]): string[] {
  return keywords.filter((k) => k !== "mioku");
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

function formatTag(tag: string): string {
  return tag.replace(/^mioku-/, "");
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

async function loadOfficialRegistry(): Promise<OfficialRegistry> {
  try {
    return await fetchJson<OfficialRegistry>(
      `${GITHUB_RAW}/official-registry.json`,
    );
  } catch {
    return { plugins: {}, services: {}, adapters: {} };
  }
}

async function searchNpmPackages(): Promise<NpmSearchObject[]> {
  const url = new URL(NPM_SEARCH_URL);
  url.searchParams.set("text", "mioku");
  url.searchParams.set("size", "200");

  const data = await fetchJson<{ objects?: NpmSearchObject[] }>(url.toString());
  return data.objects || [];
}

async function fetchBuiltinPkgJson(
  type: "plugin" | "service",
  key: string,
): Promise<any> {
  const dir = type === "plugin" ? `plugins/${key}` : `src/services/${key}`;
  try {
    return await fetchJson<any>(`${GITHUB_RAW}/${dir}/package.json`);
  } catch {
    return null;
  }
}

async function fetchNpmPackage(name: string): Promise<any> {
  return fetchJson<any>(`${NPM_PACKAGE_URL}/${encodeURIComponent(name)}`);
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

export function PluginStorePage() {
  const { setLeftContent, setRightContent } = useTopbar();

  const [installedPlugins, setInstalledPlugins] = useState<InstalledPlugin[]>(
    [],
  );
  const [installedServices, setInstalledServices] = useState<
    InstalledService[]
  >([]);
  const [installedAdapters, setInstalledAdapters] = useState<
    InstalledService[]
  >([]);
  const [mode, setMode] = useState<StoreViewMode>("list");
  const [activeType, setActiveType] = useState<StoreType>("all");
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [allItems, setAllItems] = useState<StoreItem[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  const [officialServices, setOfficialServices] = useState<
    Record<string, string>
  >({});

  const [selectedPackage, setSelectedPackage] = useState("");
  const [detail, setDetail] = useState<StorePackageDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [urlInstallOpen, setUrlInstallOpen] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [urlTarget, setUrlTarget] = useState<"plugin" | "service" | "adapter">("plugin");
  const [installing, setInstalling] = useState(false);
  const [installingKey, setInstallingKey] = useState("");

  const [servicePickerOpen, setServicePickerOpen] = useState(false);
  const [servicePickerMissing, setServicePickerMissing] = useState<string[]>(
    [],
  );
  const [servicePickerCustomUrl, setServicePickerCustomUrl] = useState("");

  const navAnimSeedRef = useRef(0);
  const [navAnimSeed, setNavAnimSeed] = useState(0);

  const loadInstalled = async () => {
    try {
      const [pluginsRes, servicesRes, adaptersRes] = await Promise.all([
        apiFetch<{ ok: true; data: InstalledPlugin[] }>("/api/manage/plugins"),
        apiFetch<{ ok: true; data: InstalledService[] }>(
          "/api/manage/services",
        ),
        apiFetch<{ ok: true; data: InstalledService[] }>(
          "/api/manage/adapters",
        ),
      ]);
      setInstalledPlugins(pluginsRes.data || []);
      setInstalledServices(servicesRes.data || []);
      setInstalledAdapters(adaptersRes.data || []);
    } catch {
      // silent
    }
  };

  const loadOfficialServices = async () => {
    try {
      const res = await apiFetch<{
        ok: true;
        data: { services?: Record<string, { npm: string }> };
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

  const loadStore = async () => {
    setLoadingList(true);
    try {
      const [registry, npmResults] = await Promise.all([
        loadOfficialRegistry(),
        searchNpmPackages(),
      ]);

      const officialPlugins = registry.plugins || {};
      const officialServices = registry.services || {};
      const officialAdapters = registry.adapters || {};
      const seen = new Map<string, StoreItem>();

      for (const obj of npmResults) {
        const pkg = obj.package;
        if (!pkg) continue;
        const npm = String(pkg.name || "").trim();
        if (!npm || seen.has(npm)) continue;

        const type = inferType(npm);
        if (!type) continue;

        const keywords = normalizeKeywords(pkg.keywords);
        if (!keywords.includes("mioku")) continue;
        const entry =
          type === "plugin"
            ? officialPlugins[stripPrefix(npm, type)]
            : type === "service"
              ? officialServices[stripPrefix(npm, type)]
              : officialAdapters[stripPrefix(npm, type)];

        seen.set(npm, {
          name: stripPrefix(npm, type),
          npm,
          type,
          description: String(pkg.description || "").trim(),
          version: String(pkg.version || "").trim(),
          keywords,
          tags: extractTags(keywords),
          official: Boolean(entry),
          builtin: Boolean(entry?.builtin),
          repo: toBrowserRepoUrl(
            typeof pkg.links?.repository === "string"
              ? pkg.links.repository
              : "",
          ),
          homepage: String(pkg.links?.homepage || "").trim(),
          npmUrl: String(
            pkg.links?.npm || `https://www.npmjs.com/package/${npm}`,
          ),
          date: String(pkg.date || "").trim(),
          searchScore: Number(obj.searchScore || obj.score?.final || 0),
        });
      }

      const builtinTasks: Promise<void>[] = [];

      const processBuiltin = async (
        entries: Record<string, OfficialEntry>,
        type: "plugin" | "service",
      ) => {
        for (const [key, entry] of Object.entries(entries)) {
          if (!entry.builtin) continue;
          const npm = `mioku-${type === "plugin" ? "plugin" : "service"}-${key}`;
          if (seen.has(npm)) {
            const existing = seen.get(npm)!;
            existing.official = true;
            existing.builtin = true;
          } else {
            const pkgJson = await fetchBuiltinPkgJson(type, key);
            seen.set(npm, {
              name: key,
              npm,
              type,
              description: pkgJson
                ? String(pkgJson.description || "").trim()
                : "",
              version: pkgJson ? String(pkgJson.version || "").trim() : "",
              keywords: ["mioku"],
              tags: [],
              official: true,
              builtin: true,
              repo: `https://github.com/mioku-lab/mioku/tree/main/${
                type === "plugin" ? "plugins" : "src/services"
              }/${key}`,
              homepage: "",
              npmUrl: `https://www.npmjs.com/package/${npm}`,
              date: "",
              searchScore: 0,
            });
          }
        }
      };

      await Promise.all([
        processBuiltin(officialPlugins, "plugin"),
        processBuiltin(officialServices, "service"),
      ]);

      const items = Array.from(seen.values());

      items.sort((a, b) => {
        if (a.official !== b.official) return a.official ? -1 : 1;
        const scoreDiff = b.searchScore - a.searchScore;
        if (scoreDiff !== 0) return scoreDiff;
        return a.npm.localeCompare(b.npm);
      });

      setAllItems(items);
      navAnimSeedRef.current += 1;
      setNavAnimSeed(navAnimSeedRef.current);
    } catch {
      toast.error("加载插件市场失败");
    } finally {
      setLoadingList(false);
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
      setMode("list");
    } finally {
      setLoadingDetail(false);
    }
  };

  useEffect(() => {
    loadInstalled().then();
    loadOfficialServices().then();
  }, []);

  useEffect(() => {
    if (mode === "list") {
      loadStore().then();
    }
  }, [mode]);

  const filteredItems = useMemo(() => {
    let list = [...allItems];

    if (activeType !== "all") {
      list = list.filter((item) => item.type === activeType);
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          item.npm.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          item.keywords.some((k) => k.toLowerCase().includes(q)),
      );
    }

    return list;
  }, [allItems, activeType, searchQuery]);

  const pagedItems = useMemo(() => {
    const offset = (page - 1) * PAGE_SIZE;
    return filteredItems.slice(offset, offset + PAGE_SIZE);
  }, [filteredItems, page]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const hasMore = page < totalPages;

  const availableTags = useMemo(() => {
    return uniqueStrings(
      filteredItems.flatMap((item) => item.tags || []),
    ).slice(0, 12);
  }, [filteredItems]);

  const isInstalled = (name: string, type: "plugin" | "service" | "adapter"): boolean => {
    if (type === "plugin") return installedPlugins.some((p) => p.name === name);
    if (type === "service") return installedServices.some((s) => s.name === name);
    return installedAdapters.some((a) => a.name === name);
  };

  const resolveDetailPackageName = (item: StoreItem) => item.npm;

  const installFromStore = async (item: StoreItem | StorePackageDetail) => {
    if (isInstalled(item.name, item.type)) {
      toast.info(`${item.name} 已安装`);
      return;
    }

    const typeLabel = item.type === "plugin" ? "插件" : item.type === "service" ? "服务" : "适配器";
    const ok = await confirm({
      title: item.official ? `安装${typeLabel}` : `安装社区${typeLabel}`,
      message: `确认安装 ${item.name}${item.version ? ` v${item.version}` : ""}？`,
      confirmText: "安装",
      cancelText: "取消",
      variant: item.official ? "default" : "danger",
      children: item.official ? undefined : (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-400">
          <p className="font-medium">提示</p>
          <p className="mt-1">
            此{typeLabel}来自开发者社区，请确认其中可能存在的风险
          </p>
        </div>
      ),
    });
    if (!ok) return;

    setInstallingKey(item.npm);
    try {
      const result = await apiFetch<any>("/api/manage/install", {
        method: "POST",
        body: JSON.stringify({
          repoUrl: item.npm,
          target: item.type,
        }),
      });
      await loadInstalled();

      if (
        item.type === "plugin" &&
        Array.isArray(result.missingServices) &&
        result.missingServices.length
      ) {
        const missingServices = result.missingServices.filter(
          (serviceName: string) => !isInstalled(serviceName, "service"),
        );

        const officialMissingServices = missingServices.filter(
          (serviceName: string) => Boolean(officialServices[serviceName]),
        );
        const customMissingServices = missingServices.filter(
          (serviceName: string) => !officialServices[serviceName],
        );

        for (const serviceName of officialMissingServices) {
          await installServiceByName(serviceName, { silent: true });
        }

        await loadInstalled();

        if (customMissingServices.length) {
          setServicePickerMissing(customMissingServices);
          setServicePickerCustomUrl("");
          setServicePickerOpen(true);
        }
      }

      toast.info(`安装完成：${result.name}`);
    } catch (error) {
      if (!(error instanceof Error)) toast.error("安装失败");
    } finally {
      setInstallingKey("");
    }
  };

  const installFromUrl = async () => {
    if (!urlInput.trim()) {
      toast.warning("请输入 npm 包名");
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
      setUrlInput("");
      await loadInstalled();
      if (
        Array.isArray(result.missingServices) &&
        result.missingServices.length
      ) {
        const missingServices = result.missingServices.filter(
          (serviceName: string) => !isInstalled(serviceName, "service"),
        );

        const officialMissingServices = missingServices.filter(
          (serviceName: string) => Boolean(officialServices[serviceName]),
        );
        const customMissingServices = missingServices.filter(
          (serviceName: string) => !officialServices[serviceName],
        );

        for (const serviceName of officialMissingServices) {
          await installServiceByName(serviceName, { silent: true });
        }

        await loadInstalled();

        if (customMissingServices.length) {
          setServicePickerMissing(customMissingServices);
          setServicePickerCustomUrl("");
          setServicePickerOpen(true);
        }
      }
      toast.info(`安装完成：${result.name}`);
    } catch (error) {
      if (!(error instanceof Error)) toast.error("安装失败");
    } finally {
      setInstalling(false);
    }
  };

  const installServiceByName = async (
    serviceName: string,
    options?: { silent?: boolean },
  ) => {
    const npm = officialServices[serviceName];
    if (!npm) {
      toast.warning(`未找到服务 ${serviceName} 的官方包`);
      return;
    }

    try {
      await apiFetch<any>("/api/manage/install", {
        method: "POST",
        body: JSON.stringify({
          repoUrl: npm,
          target: "service",
        }),
      });
      if (!options?.silent) {
        toast.info(`服务安装完成：${serviceName}`);
      }
      setServicePickerMissing((prev) =>
        prev.filter((item) => item !== serviceName),
      );
    } catch {
      toast.error(`安装服务 ${serviceName} 失败`);
    }
  };

  const installServiceFromCustomUrl = async () => {
    if (!servicePickerCustomUrl.trim()) {
      toast.warning("请输入服务包名");
      return;
    }

    const repoUrl = servicePickerCustomUrl.trim();
    setServicePickerOpen(false);
    setServicePickerCustomUrl("");

    try {
      const result = await apiFetch<any>("/api/manage/install", {
        method: "POST",
        body: JSON.stringify({
          repoUrl,
          target: "service",
        }),
      });
      await loadInstalled();
      toast.info(`安装完成：${result.name}`);
    } catch {
      toast.error("安装服务失败");
    }
  };

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
      { key: "adapter", label: "适配器" },
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
            onClick={() => setUrlInstallOpen(true)}
            className={chipClass(false)}
          >
            从包名安装
          </button>
        </span>
      </div>
    );

    setLeftContent(chips);
    setRightContent(
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => loadStore().then()}
          disabled={loadingList}
        >
          <RefreshCw
            className={`mr-1.5 h-4 w-4 ${loadingList ? "animate-spin" : ""}`}
          />
          刷新
        </Button>
        <Button size="sm" onClick={() => setUrlInstallOpen(true)}>
          <Plus className="h-4 w-4 sm:mr-1" />
          <span className="hidden sm:inline">添加</span>
        </Button>
      </div>,
    );

    return () => {
      setLeftContent(null);
      setRightContent(null);
    };
  }, [
    activeType,
    mode,
    navAnimSeed,
    loadingList,
    setLeftContent,
    setRightContent,
  ]);

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
                ? "插件市场"
                : activeType === "plugin"
                  ? "插件市场"
                  : activeType === "service"
                    ? "服务市场"
                    : "适配器市场"}
            </CardTitle>
            <CardDescription>
              共 {filteredItems.length} 个结果
              {searchQuery ? ` · 搜索：${searchQuery}` : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {(pagedItems || []).map((item) => (
                <div
                  key={item.npm}
                  className="group cursor-pointer border-l-2 border-border px-4 py-3 transition-[border-color,background-color,transform] duration-150 hover:border-primary hover:bg-secondary/30 active:scale-[0.99]"
                  onClick={() => {
                    setSelectedPackage(resolveDetailPackageName(item));
                    setMode("detail");
                    loadDetail(resolveDetailPackageName(item)).then();
                  }}
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold">
                          {item.name}
                        </p>
                        <Badge className="bg-secondary">
                          {item.type === "plugin"
                            ? "插件"
                            : item.type === "service"
                              ? "服务"
                              : "适配器"}
                        </Badge>
                        {item.builtin ? (
                          <Badge className="bg-violet-500/15 text-violet-700 dark:text-violet-300">
                            内置
                          </Badge>
                        ) : item.official ? (
                          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                            官方
                          </Badge>
                        ) : (
                          <Badge className="bg-sky-500/15 text-sky-700 dark:text-sky-300">
                            社区
                          </Badge>
                        )}
                        {item.version && <Badge>{item.version}</Badge>}
                        {item.tags.slice(0, 3).map((tag) => (
                          <Badge
                            key={tag}
                            className="bg-secondary/60 text-muted-foreground"
                          >
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
                        onClick={(e) => {
                          e.stopPropagation();
                          installFromStore(item);
                        }}
                        disabled={
                          isInstalled(item.name, item.type) ||
                          installingKey === item.npm
                        }
                      >
                        {installingKey === item.npm ? (
                          <LoaderCircle className="mr-1.5 h-4 w-4 animate-spin" />
                        ) : isInstalled(item.name, item.type) ? (
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

              {!loadingList && pagedItems.length === 0 && (
                <p className="col-span-2 text-sm text-muted-foreground">
                  {searchQuery ? "没有匹配的结果" : "暂无可用包"}
                </p>
              )}

              {loadingList && (
                <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  正在加载插件市场...
                </div>
              )}
            </div>

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
                  disabled={!hasMore || loadingList}
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
                      {detail.type === "plugin"
                        ? "插件"
                        : detail.type === "service"
                          ? "服务"
                          : "适配器"}
                    </Badge>
                    {detail.builtin ? (
                      <Badge className="bg-violet-500/15 text-violet-700 dark:text-violet-300">
                        内置
                      </Badge>
                    ) : detail.official ? (
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
                      <Badge
                        key={tag}
                        className="bg-secondary/60 text-muted-foreground"
                      >
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
                        if (href)
                          window.open(href, "_blank", "noopener,noreferrer");
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
                          window.open(
                            detail.npmUrl,
                            "_blank",
                            "noopener,noreferrer",
                          );
                        }
                      }}
                    >
                      npm
                    </Button>
                    <Button
                      onClick={() => installFromStore(detail)}
                      disabled={
                        isInstalled(detail.name, detail.type) ||
                        installingKey === detail.npm
                      }
                    >
                      {installingKey === detail.npm ? (
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                      ) : isInstalled(detail.name, detail.type) ? (
                        "已安装"
                      ) : (
                        "安装"
                      )}
                    </Button>
                  </div>

                  <div className="space-y-2 text-sm">
                    <p className="text-muted-foreground">包名：{detail.npm}</p>
                    {detail.installPath && (
                      <p className="text-muted-foreground">
                        安装目录：{detail.installPath}
                      </p>
                    )}
                    {detail.license && (
                      <p className="text-muted-foreground">
                        License：{detail.license}
                      </p>
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
                    <div className="max-h-[540px] overflow-auto border-l-2 border-border px-4 py-1">
                      <Markdown content={detail.readme} />
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      该包没有 README。
                    </p>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}

      <Dialog
        open={urlInstallOpen}
        title="从包名安装"
        description="输入 npm 包名（如 mioku-plugin-xxx），选择类型后通过 bun 安装"
        onClose={() => {
          setUrlInstallOpen(false);
          setUrlInput("");
          setInstalling(false);
        }}
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setUrlInstallOpen(false);
                setUrlInput("");
                setInstalling(false);
              }}
              disabled={installing}
            >
              取消
            </Button>
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
          </>
        }
      >
        <div className="space-y-3">
          <Input
            placeholder="mioku-plugin-xxx"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") installFromUrl().then();
            }}
            autoFocus
          />
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
            <button
              type="button"
              onClick={() => setUrlTarget("adapter")}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                urlTarget === "adapter"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              适配器
            </button>
          </div>
        </div>
      </Dialog>

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
                    className="border-l-2 border-border px-4 py-1"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">{serviceName}</p>
                        <p className="text-xs text-muted-foreground">
                          {hasOfficial
                            ? "可从官方源安装"
                            : "需手动输入包名安装"}
                        </p>
                      </div>
                      {hasOfficial ? (
                        <Button
                          size="sm"
                          onClick={() => installServiceByName(serviceName)}
                        >
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

            <div className="mt-4 space-y-2 border-l-2 border-border px-4 py-1">
              <p className="text-sm font-medium">手动安装服务</p>
              <div className="flex gap-2">
                <Input
                  placeholder="mioku-service-xxx"
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
