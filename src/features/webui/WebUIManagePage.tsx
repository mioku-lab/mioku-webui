import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Github, Loader2, RefreshCw, Save } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTopbar } from "@/components/layout/TopbarContext";
import { AnimatedClockChip } from "@/components/layout/AnimatedClockChip";
import { apiFetch, clearAuth } from "@/lib/api";
import { useAppDispatch } from "@/app/hooks";
import { setToken } from "@/features/auth/authSlice";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges";

interface WebUIUpdateInfo {
  currentVersion: string;
  latestVersion: string;
  releaseTag: string;
  releaseUrl: string;
  sourceRepo: string;
  hasUpdates: boolean;
  canUpdate: boolean;
  assetName: string;
  checkedAt: number;
  error?: string;
}

interface WebUISettings {
  port: number;
  host: string;
  packageManager: string;
}

export function WebUIManagePage() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { setLeftContent, setCenterContent, setRightContent, setDenseHeader } =
    useTopbar();
  const [checking, setChecking] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<WebUIUpdateInfo | null>(null);
  const [settings, setSettings] = useState<WebUISettings>({
    port: 3339,
    host: "0.0.0.0",
    packageManager: "bun",
  });
  const [hasSettingsChanges, setHasSettingsChanges] = useState(false);
  const initialSettingsRef = useRef("");
  const updateNowRef = useRef<() => void>(() => {});

  useUnsavedChanges(hasSettingsChanges, {
    message: "WebUI 设置还没有保存，确定要离开吗？",
  });

  useEffect(() => {
    const current = JSON.stringify(settings);
    setHasSettingsChanges(
      initialSettingsRef.current.length > 0 &&
        current !== initialSettingsRef.current,
    );
  }, [settings]);

  const loadSettings = useCallback(async () => {
    const res = await apiFetch<{ ok: boolean; data: WebUISettings }>(
      "/api/settings",
    );
    const nextSettings = res.data || {
      port: 3339,
      host: "0.0.0.0",
      packageManager: "bun",
    };
    setSettings(nextSettings);
    initialSettingsRef.current = JSON.stringify(nextSettings);
    setHasSettingsChanges(false);
  }, []);

  const saveSettings = useCallback(async () => {
    setSavingSettings(true);
    try {
      await apiFetch("/api/settings", {
        method: "PUT",
        body: JSON.stringify(settings),
      });
      initialSettingsRef.current = JSON.stringify(settings);
      setHasSettingsChanges(false);
      toast.success("WebUI 设置已保存");
    } finally {
      setSavingSettings(false);
    }
  }, [settings]);

  useEffect(() => {
    setDenseHeader(true);
    setLeftContent(null);
    setCenterContent(<AnimatedClockChip />);
    setRightContent(
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => void saveSettings()}
          disabled={savingSettings || !hasSettingsChanges}
          title={savingSettings ? "保存中..." : "保存设置"}
          aria-label={savingSettings ? "保存中..." : "保存设置"}
        >
          <Save className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            window.open(
              "https://github.com/Jerryplusy/mioku-webui",
              "_blank",
              "noopener,noreferrer",
            )
          }
          title="打开 Mioku WebUI 仓库"
          aria-label="打开 Mioku WebUI 仓库"
        >
          <Github className="h-4 w-4" />
        </Button>
      </div>,
    );
    return () => {
      setDenseHeader(false);
      setLeftContent(null);
      setCenterContent(null);
      setRightContent(null);
    };
  }, [
    hasSettingsChanges,
    saveSettings,
    savingSettings,
    setCenterContent,
    setDenseHeader,
    setLeftContent,
    setRightContent,
  ]);

  const checkUpdate = useCallback(
    async ({
      force = false,
      notifyLatest = false,
    }: {
      force?: boolean;
      notifyLatest?: boolean;
    } = {}) => {
      setChecking(true);
      try {
        const query = force ? "?force=1" : "";
        const res = await apiFetch<{ ok: boolean; data: WebUIUpdateInfo }>(
          `/api/settings/update/check${query}`,
        );
        const data = res.data;
        setUpdateInfo(data);

        if (data.hasUpdates) {
          toast.info(`检测到 WebUI 新版本 ${data.latestVersion}`, {
            description: `当前版本 ${data.currentVersion}`,
            action: data.canUpdate
              ? {
                  label: "立刻更新",
                  onClick: () => updateNowRef.current(),
                }
              : undefined,
            duration: 10000,
          });
        } else if (notifyLatest) {
          toast.success(`当前已是最新版本 ${data.currentVersion}`);
        }

        if (!data.hasUpdates && data.error && notifyLatest) {
          toast.error(data.error);
        }
      } finally {
        setChecking(false);
      }
    },
    [],
  );

  const updateNow = useCallback(async () => {
    setUpdating(true);
    const loadingId = toast.loading("正在下载并更新 WebUI...");
    try {
      const res = await apiFetch<{
        ok: boolean;
        data: {
          updated: boolean;
          message?: string;
          version?: string;
        };
      }>("/api/settings/update/apply", { method: "POST" });
      toast.dismiss(loadingId);
      if (res.data.updated) {
        toast.success(`WebUI 已更新到 ${res.data.version || "最新版本"}`);
      } else {
        toast.info(res.data.message || "当前已是最新版本");
      }
      await checkUpdate({ force: true });
    } catch (error: any) {
      toast.dismiss(loadingId);
      toast.error(error?.message || "更新失败");
    } finally {
      setUpdating(false);
    }
  }, [checkUpdate]);

  updateNowRef.current = () => {
    void updateNow();
  };

  useEffect(() => {
    void checkUpdate();
  }, [checkUpdate]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  return (
    <div className="animate-soft-pop space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>WebUI 设置</CardTitle>
          <CardDescription>管理 WebUI 自身的端口、主机和包管理器。</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">端口</label>
            <NumberInput
              value={settings.port}
              onValueChange={(value) => {
                if (value === null) return;
                setSettings((prev) => ({
                  ...prev,
                  port: value,
                }));
              }}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">主机</label>
            <Input
              value={settings.host}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  host: e.target.value,
                }))
              }
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <label className="text-xs text-muted-foreground">包管理器</label>
            <select
              className="form-select w-full"
              value={settings.packageManager}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  packageManager: e.target.value,
                }))
              }
            >
              <option value="bun">bun</option>
              <option value="npm">npm</option>
              <option value="pnpm">pnpm</option>
            </select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>WebUI 管理</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border bg-card/80 p-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">当前版本</span>
              <span className="font-medium">
                {updateInfo?.currentVersion || "unknown"}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-3">
              <span className="text-muted-foreground">最新版本</span>
              <span className="font-medium">
                {updateInfo?.latestVersion || "-"}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-3">
              <span className="text-muted-foreground">更新状态</span>
              <span className="font-medium">
                {updateInfo?.hasUpdates ? "有更新" : "已最新"}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              onClick={() =>
                void checkUpdate({ force: true, notifyLatest: true })
              }
              disabled={checking || updating}
            >
              {checking ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              检查更新
            </Button>
            <Button
              onClick={() => void updateNow()}
              disabled={
                updating ||
                checking ||
                !updateInfo?.hasUpdates ||
                !updateInfo?.canUpdate
              }
            >
              {updating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              立刻更新
            </Button>
          </div>

          <Button
            variant="outline"
            onClick={() => {
              clearAuth();
              dispatch(setToken(null));
              navigate("/login");
            }}
          >
            退出登录
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
