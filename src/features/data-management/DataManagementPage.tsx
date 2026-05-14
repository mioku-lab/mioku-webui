import { JSX, useCallback, useEffect, useMemo, useState } from "react";
import {
  Archive,
  Check,
  ChevronDown,
  ChevronRight,
  Download,
  FileText,
  Folder,
  HardDrive,
  Loader2,
  Package,
  RefreshCw,
  RotateCw,
  Shield,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { useTopbar } from "@/components/layout/TopbarContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { confirm } from "@/components/ui/confirm";
import { apiFetch, apiForm, getAuthToken } from "@/lib/api";
import { cn } from "@/lib/utils";

type DataTab = "cache" | "backup" | "restore";
type CacheAreaKey = "config" | "data" | "logs" | "nodeModules" | "temp";
type DeletableArea = "data" | "temp";
type BackupScope = "all" | "config-data";

interface CacheEntry {
  name: string;
  type: "file" | "directory";
  size: number;
  files: number;
  directories: number;
  mtimeMs: number;
  children?: CacheEntry[];
}

interface ItemArea {
  path: string;
  exists: boolean;
  size: number;
  files: number;
  directories: number;
  items: CacheEntry[];
  deletable: boolean;
}

interface SimpleArea {
  path: string;
  exists: boolean;
  size: number;
  files: number;
  directories: number;
  mtimeMs: number;
}

interface CacheOverview {
  generatedAt: number;
  totalSize: number;
  areas: {
    config: ItemArea;
    data: ItemArea;
    logs: SimpleArea;
    nodeModules: SimpleArea;
    temp: ItemArea;
  };
}

interface BackupInfo {
  name: string;
  size: number;
  createdAt: number;
  modifiedAt: number;
  scope?: BackupScope;
  downloadUrl: string;
}

interface RestoreResult {
  restoredFiles: number;
  rollback: BackupInfo;
}

const tabLabels: Record<DataTab, string> = {
  cache: "缓存",
  backup: "备份",
  restore: "恢复",
};

const areaLabels: Record<CacheAreaKey, string> = {
  config: "配置文件",
  data: "插件数据",
  logs: "日志",
  nodeModules: "依赖包缓存",
  temp: "临时文件",
};

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / 1024 ** index;
  return `${value >= 10 || index === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`;
}

function formatTime(value?: number): string {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

async function downloadFile(url: string, filename: string) {
  const token = getAuthToken();
  const headers = new Headers();
  if (token) headers.set("authorization", `Bearer ${token}`);

  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`下载失败: HTTP ${res.status}`);
  }

  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

export function DataManagementPage() {
  const { setLeftContent, setCenterContent, setRightContent, setDenseHeader } =
    useTopbar();
  const [activeTab, setActiveTab] = useState<DataTab>("cache");
  const [overview, setOverview] = useState<CacheOverview | null>(null);
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [backupScopeOpen, setBackupScopeOpen] = useState(false);

  const loadOverview = useCallback(async () => {
    setLoadingOverview(true);
    try {
      const res = await apiFetch<{ ok: boolean; data: CacheOverview }>(
        "/api/data-management/cache/overview",
      );
      setOverview(res.data);
    } finally {
      setLoadingOverview(false);
    }
  }, []);

  const loadBackups = useCallback(async () => {
    setLoadingBackups(true);
    try {
      const res = await apiFetch<{ ok: boolean; data: BackupInfo[] }>(
        "/api/data-management/backups",
      );
      setBackups(res.data || []);
    } finally {
      setLoadingBackups(false);
    }
  }, []);

  useEffect(() => {
    void loadOverview();
    void loadBackups();
  }, [loadBackups, loadOverview]);

  useEffect(() => {
    const chipClass = (active: boolean) =>
      `topbar-chip whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium ${
        active
          ? "border-transparent bg-primary text-primary-foreground shadow-sm"
          : "border-transparent bg-secondary/50 text-secondary-foreground hover:bg-secondary"
      }`;

    setDenseHeader(true);
    setLeftContent(
      <div className="topbar-chip-scroll flex items-center gap-1 overflow-x-auto">
        {(Object.keys(tabLabels) as DataTab[]).map((tab, index) => (
          <span
            key={tab}
            className="topbar-nav-item-enter"
            style={{ animationDelay: `${index * 45}ms` }}
          >
            <button
              type="button"
              onClick={() => setActiveTab(tab)}
              className={chipClass(activeTab === tab)}
            >
              {tabLabels[tab]}
            </button>
          </span>
        ))}
      </div>,
    );
    setCenterContent(null);
    setRightContent(
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          if (activeTab === "cache") void loadOverview();
          else void loadBackups();
        }}
        disabled={loadingOverview || loadingBackups || Boolean(busyAction)}
        title="刷新"
        aria-label="刷新"
      >
        <RefreshCw
          className={cn(
            "h-4 w-4",
            (loadingOverview || loadingBackups) && "animate-spin",
          )}
        />
      </Button>,
    );

    return () => {
      setDenseHeader(false);
      setLeftContent(null);
      setCenterContent(null);
      setRightContent(null);
    };
  }, [
    activeTab,
    busyAction,
    loadBackups,
    loadOverview,
    loadingBackups,
    loadingOverview,
    setCenterContent,
    setDenseHeader,
    setLeftContent,
    setRightContent,
  ]);

  const cleanableSize = useMemo(() => {
    if (!overview) return 0;
    return overview.areas.temp.size;
  }, [overview]);

  const backupScopeSizes = useMemo(() => {
    if (!overview) {
      return {
        configData: 0,
        all: 0,
      };
    }

    return {
      configData: overview.areas.config.size + overview.areas.data.size,
      all: overview.totalSize,
    };
  }, [overview]);

  const deleteCacheEntry = async (area: DeletableArea, item: CacheEntry) => {
    const isDirectory = item.type === "directory";
    const ok = await confirm({
      title: isDirectory ? "清空缓存目录" : "删除缓存文件",
      message: isDirectory
        ? `确定清空 ${area}/${item.name} 内的文件？此操作不可撤销`
        : `确定删除 ${area}/${item.name}？此操作不可撤销。`,
      confirmText: isDirectory ? "清空" : "删除",
      cancelText: "取消",
    });
    if (!ok) return;

    setBusyAction(`delete-${area}-${item.name}`);
    try {
      await apiFetch("/api/data-management/cache/delete", {
        method: "POST",
        body: JSON.stringify({ area, name: item.name }),
      });
      toast.success(isDirectory ? "已清空缓存目录" : "已删除缓存文件");
      await loadOverview();
    } finally {
      setBusyAction(null);
    }
  };

  const deleteSelectedCacheEntries = async (
    area: DeletableArea,
    paths: string[],
  ) => {
    const ok = await confirm({
      title: "删除所选项",
      message: `确定删除 ${area} 下选中的 ${paths.length} 个项目？此操作无法撤销`,
      confirmText: "删除所选项",
      cancelText: "取消",
    });
    if (!ok) return;

    setBusyAction(`delete-selected-${area}`);
    try {
      const res = await apiFetch<{
        ok: boolean;
        data: { deleted: number };
      }>("/api/data-management/cache/delete-selected", {
        method: "POST",
        body: JSON.stringify({ area, paths }),
      });
      toast.success(`已删除 ${res.data.deleted} 个所选项`);
      await loadOverview();
    } finally {
      setBusyAction(null);
    }
  };

  const cleanupLogs = async (mode: "all" | "keep-days", days?: 3 | 7) => {
    const message =
      mode === "all" ? "确定删除全部日志？" : `确定删除 ${days} 天以前的日志？`;
    const ok = await confirm({
      title: "清理日志",
      message,
      confirmText: "清理",
      cancelText: "取消",
    });
    if (!ok) return;

    setBusyAction(`logs-${mode}-${days || "all"}`);
    try {
      const res = await apiFetch<{
        ok: boolean;
        data: { deleted: number; kept: number };
      }>("/api/data-management/logs/cleanup", {
        method: "POST",
        body: JSON.stringify({ mode, days }),
      });
      toast.success(`已清理 ${res.data.deleted} 项日志`);
      await loadOverview();
    } finally {
      setBusyAction(null);
    }
  };

  const refreshNodeModules = async () => {
    const ok = await confirm({
      title: "刷新包缓存",
      message: "将重新执行项目包安装命令，可能需要一段时间",
      confirmText: "执行",
      cancelText: "取消",
    });
    if (!ok) return;

    setBusyAction("refresh-node-modules");
    const id = toast.loading("正在刷新包缓存...");
    try {
      const res = await apiFetch<{
        ok: boolean;
        data: { command: string; code: number };
      }>("/api/data-management/node-modules/refresh", {
        method: "POST",
      });
      toast.dismiss(id);
      toast.success(`包缓存已刷新：${res.data.command}`);
      await loadOverview();
    } catch (error: any) {
      toast.dismiss(id);
      toast.error(error?.message || "刷新包缓存失败");
    } finally {
      setBusyAction(null);
    }
  };

  const openBackupScopeDialog = () => {
    setBackupScopeOpen(true);
    if (!overview) void loadOverview();
  };

  const createBackup = async (scope: BackupScope) => {
    setBackupScopeOpen(false);
    setBusyAction("create-backup");
    const id = toast.loading("正在创建备份...");
    try {
      const res = await apiFetch<{ ok: boolean; data: BackupInfo }>(
        "/api/data-management/backups",
        {
          method: "POST",
          body: JSON.stringify({ scope }),
        },
      );
      await loadBackups();
      await downloadFile(res.data.downloadUrl, res.data.name);
      toast.dismiss(id);
      toast.success("备份已创建并开始下载");
    } catch (error: any) {
      toast.dismiss(id);
      toast.error(error?.message || "创建备份失败");
    } finally {
      setBusyAction(null);
    }
  };

  const downloadBackup = async (backup: BackupInfo) => {
    setBusyAction(`download-${backup.name}`);
    try {
      await downloadFile(backup.downloadUrl, backup.name);
    } catch (error: any) {
      toast.error(error?.message || "下载备份失败");
    } finally {
      setBusyAction(null);
    }
  };

  const deleteBackup = async (backup: BackupInfo) => {
    const ok = await confirm({
      title: "删除备份",
      message: `确定删除备份文件 ${backup.name}？此操作不可撤销`,
      confirmText: "删除",
      cancelText: "取消",
    });
    if (!ok) return;

    setBusyAction(`delete-backup-${backup.name}`);
    try {
      await apiFetch(
        `/api/data-management/backups/${encodeURIComponent(backup.name)}`,
        {
          method: "DELETE",
        },
      );
      toast.success("备份文件已删除");
      await loadBackups();
    } finally {
      setBusyAction(null);
    }
  };

  const restoreBackup = async (backup: BackupInfo) => {
    const ok = await confirm({
      title: "恢复备份",
      message: `确定恢复 ${backup.name}？恢复前会自动创建当前状态回滚包。`,
      confirmText: "恢复",
      cancelText: "取消",
    });
    if (!ok) return;

    setBusyAction(`restore-${backup.name}`);
    try {
      const res = await apiFetch<{ ok: boolean; data: RestoreResult }>(
        "/api/data-management/restore/from-backup",
        {
          method: "POST",
          body: JSON.stringify({ name: backup.name }),
        },
      );
      toast.success(`已恢复 ${res.data.restoredFiles} 个文件`, {
        description: `回滚包：${res.data.rollback.name}`,
      });
      await Promise.all([loadOverview(), loadBackups()]);
    } finally {
      setBusyAction(null);
    }
  };

  const restoreUpload = async () => {
    if (!uploadFile) return;
    const ok = await confirm({
      title: "导入并恢复",
      message: `确定导入 ${uploadFile.name} 并恢复？恢复前会自动创建当前状态回滚包。`,
      confirmText: "恢复",
      cancelText: "取消",
    });
    if (!ok) return;

    const form = new FormData();
    form.append("file", uploadFile);
    setBusyAction("restore-upload");
    try {
      const res = await apiForm<{ ok: boolean; data: RestoreResult }>(
        "/api/data-management/restore/upload",
        form,
      );
      toast.success(`已恢复 ${res.data.restoredFiles} 个文件`, {
        description: `回滚包：${res.data.rollback.name}`,
      });
      setUploadFile(null);
      await Promise.all([loadOverview(), loadBackups()]);
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <div className="animate-soft-pop space-y-4">
      {activeTab === "cache" ? (
        <CacheTab
          overview={overview}
          cleanableSize={cleanableSize}
          loading={loadingOverview}
          busyAction={busyAction}
          onDelete={deleteCacheEntry}
          onDeleteSelected={deleteSelectedCacheEntries}
          onCleanupLogs={cleanupLogs}
          onRefreshNodeModules={refreshNodeModules}
        />
      ) : null}

      {activeTab === "backup" ? (
        <BackupTab
          backups={backups}
          loading={loadingBackups}
          busyAction={busyAction}
          onCreateBackup={openBackupScopeDialog}
          onDownload={(backup) => void downloadBackup(backup)}
          onDelete={(backup) => void deleteBackup(backup)}
        />
      ) : null}

      {activeTab === "restore" ? (
        <RestoreTab
          backups={backups}
          loading={loadingBackups}
          busyAction={busyAction}
          uploadFile={uploadFile}
          onUploadFile={setUploadFile}
          onRestoreBackup={restoreBackup}
          onRestoreUpload={restoreUpload}
          onDownload={(backup) => void downloadBackup(backup)}
          onDelete={(backup) => void deleteBackup(backup)}
        />
      ) : null}

      {backupScopeOpen ? (
        <BackupScopeDialog
          configDataSize={backupScopeSizes.configData}
          allSize={backupScopeSizes.all}
          loadingSizes={loadingOverview}
          busy={Boolean(busyAction)}
          onClose={() => setBackupScopeOpen(false)}
          onSelect={(scope) => void createBackup(scope)}
        />
      ) : null}
    </div>
  );
}

function CacheTab({
  overview,
  cleanableSize,
  loading,
  busyAction,
  onDelete,
  onDeleteSelected,
  onCleanupLogs,
  onRefreshNodeModules,
}: {
  overview: CacheOverview | null;
  cleanableSize: number;
  loading: boolean;
  busyAction: string | null;
  onDelete: (area: DeletableArea, item: CacheEntry) => Promise<void>;
  onDeleteSelected: (area: DeletableArea, paths: string[]) => Promise<void>;
  onCleanupLogs: (mode: "all" | "keep-days", days?: 3 | 7) => Promise<void>;
  onRefreshNodeModules: () => Promise<void>;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <MetricCard
          label="项目数据占用"
          value={formatBytes(overview?.totalSize || 0)}
        />
        <MetricCard label="临时缓存" value={formatBytes(cleanableSize)} />
        <MetricCard
          label="最后统计"
          value={
            overview
              ? formatTime(overview.generatedAt)
              : loading
                ? "统计中..."
                : "-"
          }
        />
      </div>

      <div className="space-y-3">
        <ItemAreaPanel
          area="config"
          data={overview?.areas.config}
          icon={<Shield className="h-4 w-4" />}
          busyAction={busyAction}
          defaultExpanded={false}
        />
        <ItemAreaPanel
          area="data"
          data={overview?.areas.data}
          icon={<HardDrive className="h-4 w-4" />}
          busyAction={busyAction}
          defaultExpanded={false}
          onDelete={(item) => onDelete("data", item)}
          onDeleteSelected={(paths) => onDeleteSelected("data", paths)}
        />
        <LogsPanel
          data={overview?.areas.logs}
          busyAction={busyAction}
          onCleanupLogs={onCleanupLogs}
        />
        <NodeModulesPanel
          data={overview?.areas.nodeModules}
          busyAction={busyAction}
          onRefresh={onRefreshNodeModules}
        />
        <ItemAreaPanel
          area="temp"
          data={overview?.areas.temp}
          icon={<Folder className="h-4 w-4" />}
          busyAction={busyAction}
          onDelete={(item) => onDelete("temp", item)}
          onDeleteSelected={(paths) => onDeleteSelected("temp", paths)}
        />
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
      </CardContent>
    </Card>
  );
}

function ItemAreaPanel({
  area,
  data,
  icon,
  busyAction,
  defaultExpanded = true,
  onDelete,
  onDeleteSelected,
}: {
  area: "config" | "data" | "temp";
  data?: ItemArea;
  icon: JSX.Element;
  busyAction: string | null;
  defaultExpanded?: boolean;
  onDelete?: (item: CacheEntry) => void;
  onDeleteSelected?: (paths: string[]) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(
    () => new Set(),
  );

  useEffect(() => {
    setSelectedPaths(new Set());
  }, [data]);

  const updateSelectedPath = (itemPath: string, selected: boolean) => {
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      if (selected) next.add(itemPath);
      else next.delete(itemPath);
      return next;
    });
  };

  const handleDeleteSelected = async (paths: string[]) => {
    if (!onDeleteSelected) return;
    await onDeleteSelected(paths);
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      for (const item of paths) next.delete(item);
      return next;
    });
  };

  return (
    <Card>
      <CardHeader
        className="cursor-pointer gap-3 rounded-t-lg transition hover:bg-secondary/30 sm:flex-row sm:items-start sm:justify-between"
        role="button"
        tabIndex={0}
        onClick={() => setExpanded((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setExpanded((value) => !value);
          }
        }}
      >
        <div
          className="flex min-w-0 items-start gap-3 rounded-md text-left"
        >
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-secondary">
            {icon}
          </div>
          <div className="min-w-0">
            <span className="font-semibold leading-none tracking-tight">
              {areaLabels[area]}
            </span>
            <span className="mt-1 block text-sm text-muted-foreground">
              {data?.path || area} ·{" "}
              {data?.exists ? `${data.files} 个文件` : "不存在"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge>{formatBytes(data?.size || 0)}</Badge>
        </div>
      </CardHeader>
      {expanded ? (
        <CardContent>
          {!data?.items?.length ? (
            <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
              没有可展示的一级条目。
            </div>
          ) : (
            <div className="divide-y rounded-md border">
              {data.items.map((item) => (
                <CacheEntryRow
                  key={item.name}
                  item={item}
                  itemPath={item.name}
                  level={0}
                  busyAction={busyAction}
                  onDelete={onDelete}
                  selectedPaths={selectedPaths}
                  onSelectedChange={updateSelectedPath}
                  onDeleteSelected={
                    onDeleteSelected ? handleDeleteSelected : undefined
                  }
                />
              ))}
            </div>
          )}
        </CardContent>
      ) : null}
    </Card>
  );
}

function CacheEntryRow({
  item,
  itemPath,
  level,
  busyAction,
  onDelete,
  selectedPaths,
  onSelectedChange,
  onDeleteSelected,
}: {
  item: CacheEntry;
  itemPath: string;
  level: number;
  busyAction: string | null;
  onDelete?: (item: CacheEntry) => void;
  selectedPaths?: Set<string>;
  onSelectedChange?: (itemPath: string, selected: boolean) => void;
  onDeleteSelected?: (paths: string[]) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const isDirectory = item.type === "directory";
  const hasChildren = isDirectory && Boolean(item.children?.length);
  const canToggle = isDirectory && hasChildren;
  const selected = selectedPaths?.has(itemPath) || false;
  const selectable = level > 0 && Boolean(onSelectedChange);
  const selectedChildren = Array.from(selectedPaths || []).filter((pathItem) =>
    pathItem.startsWith(`${itemPath}/`),
  );

  return (
    <div className="divide-y">
      <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-2">
          {selectable ? (
            <label
              className={cn(
                "relative flex h-5 w-5 shrink-0 items-center justify-center rounded border transition",
                selected
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input bg-background hover:border-primary/70",
              )}
              style={{ marginLeft: `${level * 18}px` }}
            >
              <input
                type="checkbox"
                className="peer sr-only"
                checked={selected}
                onChange={(event) =>
                  onSelectedChange?.(itemPath, event.currentTarget.checked)
                }
                aria-label={`选择 ${item.name}`}
              />
              <Check
                className={cn(
                  "h-3.5 w-3.5 transition-opacity",
                  selected ? "opacity-100" : "opacity-0",
                )}
              />
              <span className="pointer-events-none absolute -inset-1 rounded-md ring-primary/30 peer-focus-visible:ring-2" />
            </label>
          ) : null}
          <button
            type="button"
            className={cn(
              "flex min-w-0 items-center gap-3 rounded-md text-left",
              canToggle ? "transition hover:text-primary" : "cursor-default",
            )}
            style={{ paddingLeft: selectable ? 0 : `${level * 18}px` }}
            onClick={() => {
              if (canToggle) setExpanded((value) => !value);
            }}
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-secondary/60">
              {isDirectory ? (
                hasChildren ? (
                  expanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )
                ) : (
                  <Folder className="h-4 w-4" />
                )
              ) : (
                <FileText className="h-4 w-4" />
              )}
            </div>
            <div className="min-w-0">
              <span className="block truncate text-sm font-medium">
                {item.name}
              </span>
              <span className="block text-xs text-muted-foreground">
                {formatBytes(item.size)} ·{" "}
                {isDirectory ? `${item.files} 个文件 · ` : ""}
                {formatTime(item.mtimeMs)}
              </span>
            </div>
          </button>
        </div>
        {onDelete && level === 0 ? (
          <Button
            variant="outline"
            size="sm"
            className="w-full sm:w-auto"
            disabled={Boolean(busyAction)}
            onClick={() => {
              if (selectedChildren.length > 0 && onDeleteSelected) {
                void onDeleteSelected(selectedChildren);
              } else {
                onDelete(item);
              }
            }}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {selectedChildren.length > 0
              ? `删除所选项 (${selectedChildren.length})`
              : isDirectory
                ? "清空"
                : "删除"}
          </Button>
        ) : null}
      </div>
      {expanded && item.children?.length ? (
        <div className="bg-secondary/20">
          {item.children.map((child) => (
            <CacheEntryRow
              key={`${item.name}/${child.name}`}
              item={child}
              itemPath={`${itemPath}/${child.name}`}
              level={level + 1}
              busyAction={busyAction}
              selectedPaths={selectedPaths}
              onSelectedChange={onSelectedChange}
              onDeleteSelected={onDeleteSelected}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function LogsPanel({
  data,
  busyAction,
  onCleanupLogs,
}: {
  data?: SimpleArea;
  busyAction: string | null;
  onCleanupLogs: (mode: "all" | "keep-days", days?: 3 | 7) => Promise<void>;
}) {
  return (
    <Card>
      <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-secondary">
            <Archive className="h-4 w-4" />
          </div>
          <div>
            <CardTitle>{areaLabels.logs}</CardTitle>
            <CardDescription className="mt-1">
              logs · {data?.exists ? `${data.files} 个文件` : "不存在"}
            </CardDescription>
          </div>
        </div>
        <Badge>{formatBytes(data?.size || 0)}</Badge>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Button
          variant="outline"
          onClick={() => void onCleanupLogs("keep-days", 7)}
          disabled={Boolean(busyAction)}
        >
          只保留 7 天
        </Button>
        <Button
          variant="outline"
          onClick={() => void onCleanupLogs("keep-days", 3)}
          disabled={Boolean(busyAction)}
        >
          只保留 3 天
        </Button>
        <Button
          variant="destructive"
          onClick={() => void onCleanupLogs("all")}
          disabled={Boolean(busyAction)}
        >
          删除全部日志
        </Button>
      </CardContent>
    </Card>
  );
}

function NodeModulesPanel({
  data,
  busyAction,
  onRefresh,
}: {
  data?: SimpleArea;
  busyAction: string | null;
  onRefresh: () => Promise<void>;
}) {
  const refreshing = busyAction === "refresh-node-modules";

  return (
    <Card>
      <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-secondary">
            <Package className="h-4 w-4" />
          </div>
          <div>
            <CardTitle>{areaLabels.nodeModules}</CardTitle>
            <CardDescription className="mt-1">
              node_modules ·{" "}
              {data?.exists ? `最后修改 ${formatTime(data.mtimeMs)}` : "不存在"}
            </CardDescription>
          </div>
        </div>
        <Badge>{formatBytes(data?.size || 0)}</Badge>
      </CardHeader>
      <CardContent>
        <Button onClick={() => void onRefresh()} disabled={Boolean(busyAction)}>
          {refreshing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RotateCw className="mr-2 h-4 w-4" />
          )}
          刷新包缓存
        </Button>
      </CardContent>
    </Card>
  );
}

function BackupTab({
  backups,
  loading,
  busyAction,
  onCreateBackup,
  onDownload,
  onDelete,
}: {
  backups: BackupInfo[];
  loading: boolean;
  busyAction: string | null;
  onCreateBackup: () => void;
  onDownload: (backup: BackupInfo) => void;
  onDelete: (backup: BackupInfo) => void;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
      <Card className="h-fit">
        <CardHeader>
          <CardTitle>创建备份</CardTitle>
          <CardDescription>
            打包 config 和 data，保存到 backup 目录并下载到本机。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            className="w-full"
            onClick={() => onCreateBackup()}
            disabled={Boolean(busyAction)}
          >
            {busyAction === "create-backup" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            创建备份并下载
          </Button>
        </CardContent>
      </Card>

      <BackupList
        backups={backups}
        loading={loading}
        busyAction={busyAction}
        mode="download"
        onDownload={onDownload}
        onDelete={onDelete}
      />
    </div>
  );
}

function RestoreTab({
  backups,
  loading,
  busyAction,
  uploadFile,
  onUploadFile,
  onRestoreBackup,
  onRestoreUpload,
  onDownload,
  onDelete,
}: {
  backups: BackupInfo[];
  loading: boolean;
  busyAction: string | null;
  uploadFile: File | null;
  onUploadFile: (file: File | null) => void;
  onRestoreBackup: (backup: BackupInfo) => Promise<void>;
  onRestoreUpload: () => Promise<void>;
  onDownload: (backup: BackupInfo) => void;
  onDelete: (backup: BackupInfo) => void;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
      <Card className="h-fit">
        <CardHeader>
          <CardTitle>导入备份</CardTitle>
          <CardDescription>
            上传 zip 后恢复。恢复前会自动创建当前状态回滚包。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="block cursor-pointer rounded-lg border border-dashed bg-secondary/20 p-4 transition hover:bg-secondary/40">
            <input
              type="file"
              accept=".zip,application/zip"
              className="sr-only"
              onChange={(event) =>
                onUploadFile(event.target.files?.[0] || null)
              }
            />
            <span className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-background">
                <Upload className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium">
                  {uploadFile ? uploadFile.name : "选择备份压缩包"}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {uploadFile
                    ? `${formatBytes(uploadFile.size)} · 点击重新选择`
                    : "支持 .zip 文件"}
                </span>
              </span>
            </span>
          </label>
          <Button
            className="w-full"
            disabled={!uploadFile || Boolean(busyAction)}
            onClick={() => void onRestoreUpload()}
          >
            {busyAction === "restore-upload" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            导入并恢复
          </Button>
        </CardContent>
      </Card>

      <BackupList
        backups={backups}
        loading={loading}
        busyAction={busyAction}
        mode="restore"
        onRestore={onRestoreBackup}
        onDownload={onDownload}
        onDelete={onDelete}
      />
    </div>
  );
}

function BackupList({
  backups,
  loading,
  busyAction,
  mode,
  onDownload,
  onDelete,
  onRestore,
}: {
  backups: BackupInfo[];
  loading: boolean;
  busyAction: string | null;
  mode: "download" | "restore";
  onDownload: (backup: BackupInfo) => void;
  onDelete: (backup: BackupInfo) => void;
  onRestore?: (backup: BackupInfo) => Promise<void>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>已有备份</CardTitle>
        <CardDescription>
          {loading ? "正在读取 backup 目录..." : `${backups.length} 个备份节点`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!backups.length ? (
          <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            暂无备份文件。
          </div>
        ) : (
          <div className="divide-y rounded-md border">
            {backups.map((backup) => (
              <div
                key={backup.name}
                className="flex flex-col gap-3 p-3 md:flex-row md:items-center md:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{backup.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatBytes(backup.size)} · {formatTime(backup.modifiedAt)}
                    {backup.scope === "all" ? " · 全部" : " · config/data"}
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={Boolean(busyAction)}
                    onClick={() => onDownload(backup)}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    下载
                  </Button>
                  {mode === "restore" && onRestore ? (
                    <Button
                      size="sm"
                      disabled={Boolean(busyAction)}
                      onClick={() => void onRestore(backup)}
                    >
                      恢复
                    </Button>
                  ) : null}
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={Boolean(busyAction)}
                    onClick={() => onDelete(backup)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    删除
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function BackupScopeDialog({
  configDataSize,
  allSize,
  loadingSizes,
  busy,
  onClose,
  onSelect,
}: {
  configDataSize: number;
  allSize: number;
  loadingSizes: boolean;
  busy: boolean;
  onClose: () => void;
  onSelect: (scope: BackupScope) => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl border bg-card p-4 shadow-xl animate-soft-pop"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4">
          <h3 className="text-base font-semibold">选择备份范围</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            备份文件会保存到 backup 目录，并在创建完成后自动下载。
          </p>
        </div>

        <div className="grid gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => onSelect("all")}
            className="rounded-lg border bg-background p-4 text-left transition hover:bg-secondary disabled:pointer-events-none disabled:opacity-50"
          >
            <span className="flex items-center justify-between gap-3">
              <span>
                <span className="block text-sm font-semibold">备份全部</span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  config / data / logs / node_modules / temp
                </span>
              </span>
              <Badge>{loadingSizes ? "统计中..." : formatBytes(allSize)}</Badge>
            </span>
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={() => onSelect("config-data")}
            className="rounded-lg border bg-background p-4 text-left transition hover:bg-secondary disabled:pointer-events-none disabled:opacity-50"
          >
            <span className="flex items-center justify-between gap-3">
              <span>
                <span className="block text-sm font-semibold">
                  仅备份 config/data
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  配置文件和插件数据
                </span>
              </span>
              <Badge>
                {loadingSizes ? "统计中..." : formatBytes(configDataSize)}
              </Badge>
            </span>
          </button>
        </div>

        <div className="mt-4 flex justify-end">
          <Button variant="outline" onClick={onClose} disabled={busy}>
            取消
          </Button>
        </div>
      </div>
    </div>
  );
}
