import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTopbar } from "@/components/layout/TopbarContext";
import { apiFetch, clearAuth } from "@/lib/api";
import { useAppDispatch } from "@/app/hooks";
import { setToken } from "@/features/auth/authSlice";
import { toast } from "sonner";

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

export function WebUIManagePage() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { setLeftContent, setRightContent } = useTopbar();
  const [checking, setChecking] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<WebUIUpdateInfo | null>(null);
  const updateNowRef = useRef<() => void>(() => {});

  useEffect(() => {
    setLeftContent(
      <span className="topbar-nav-item-enter" style={{ animationDelay: "0ms" }}>
        <img
          src="/miku-logo.png"
          alt="Mioku Logo"
          className="h-12 w-12 shrink-0 object-contain translate-y-0.5"
        />
      </span>,
    );
    setRightContent(null);
    return () => {
      setLeftContent(null);
      setRightContent(null);
    };
  }, [setLeftContent, setRightContent]);

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

  return (
    <div className="animate-soft-pop space-y-4">
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
