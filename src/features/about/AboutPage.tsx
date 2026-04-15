import { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink, Github, RefreshCw } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { useTopbar } from "@/components/layout/TopbarContext";
import { AnimatedClockChip } from "@/components/layout/AnimatedClockChip";
import { toast } from "sonner";

type MiokuUpdateInfo = {
  currentVersion: string;
  latestVersion: string;
  sourceRepo: string;
  currentBranch: string;
  targetRef: string;
  hasUpdates: boolean;
  behind: number;
  changelog: string[];
  checkedAt: number;
  error?: string;
};

type OverviewResponse = {
  versions?: {
    mioku?: string;
  };
};

const introText =
  "Mioku 是一个以初音未来为主题，AI优先，使用napcat-sdk与mioki现代机器人核心所构建的机器人框架。在Mioku中，AI将掌控一切。像真人一样思考、水群、发表情包、网络搜索，甚至是自己使用自己的插件通通不在话下。";

export function AboutPage() {
  const { setLeftContent, setCenterContent, setRightContent, setDenseHeader } =
    useTopbar();
  const [checkingMioku, setCheckingMioku] = useState(false);
  const [updatingMioku, setUpdatingMioku] = useState(false);
  const [miokuUpdate, setMiokuUpdate] = useState<MiokuUpdateInfo | null>(null);
  const [heroVersions, setHeroVersions] = useState<{
    current: string;
    target: string;
  }>({
    current: "unknown",
    target: "unknown",
  });

  const loadHeroVersions = useCallback(async () => {
    const res = await apiFetch<{ ok: boolean; data: OverviewResponse }>(
      "/api/overview",
    );
    const current = String(res.data?.versions?.mioku || "").trim();
    if (!current) return;

    setHeroVersions((prev) => ({
      current,
      target: prev.target === "unknown" ? current : prev.target,
    }));
  }, []);

  const checkMiokuUpdate = useCallback(
    async (force = false, notify = false) => {
      setCheckingMioku(true);
      try {
        const query = force ? "?force=1" : "";
        const res = await apiFetch<{ ok: boolean; data: MiokuUpdateInfo }>(
          `/api/config/mioku/update/check${query}`,
        );
        const data = res.data;
        setMiokuUpdate(data);
        setHeroVersions((prev) => ({
          current:
            data.currentVersion && data.currentVersion !== "unknown"
              ? data.currentVersion
              : prev.current,
          target:
            !data.error &&
            data.latestVersion &&
            data.latestVersion !== "unknown"
              ? data.latestVersion
              : prev.target,
        }));

        if (!notify) return;

        if (data.error) {
          toast.error(data.error);
          return;
        }

        if (data.hasUpdates) {
          toast.info(`${data.targetRef} 有 ${data.behind} 个新提交`, {
            description: `当前分支 ${data.currentBranch}`,
          });
          return;
        }

        toast.success(`当前已经和 ${data.targetRef} 保持同步`);
      } finally {
        setCheckingMioku(false);
      }
    },
    [],
  );

  const updateMioku = useCallback(async () => {
    setUpdatingMioku(true);
    const loadingId = toast.loading("正在执行 git pull origin main ...");
    try {
      const res = await apiFetch<{
        ok: boolean;
        data: {
          restartRequired: boolean;
          currentVersion: string;
        };
      }>("/api/config/mioku/update/apply", { method: "POST" });
      toast.dismiss(loadingId);
      toast.success(`Mioku 已更新到 ${res.data.currentVersion}，请重启进程`);
      await checkMiokuUpdate(true);
    } catch (error: any) {
      toast.dismiss(loadingId);
      toast.error(error?.message || "Mioku 更新失败");
    } finally {
      setUpdatingMioku(false);
    }
  }, [checkMiokuUpdate]);

  useEffect(() => {
    setDenseHeader(true);
    setLeftContent(null);
    setCenterContent(<AnimatedClockChip />);
    setRightContent(
      <Button
        variant="outline"
        size="sm"
        onClick={() =>
          window.open(
            "https://github.com/mioku-lab/mioku",
            "_blank",
            "noopener,noreferrer",
          )
        }
        title="打开 Mioku 仓库"
        aria-label="打开 Mioku 仓库"
      >
        <Github className="h-4 w-4" />
      </Button>,
    );

    return () => {
      setDenseHeader(false);
      setLeftContent(null);
      setCenterContent(null);
      setRightContent(null);
    };
  }, [setCenterContent, setDenseHeader, setLeftContent, setRightContent]);

  useEffect(() => {
    void (async () => {
      await loadHeroVersions();
      await checkMiokuUpdate();
    })();
  }, [checkMiokuUpdate, loadHeroVersions]);

  const repoUrl = useMemo(() => {
    if (!miokuUpdate?.sourceRepo) return "";
    return `https://github.com/${miokuUpdate.sourceRepo}`;
  }, [miokuUpdate?.sourceRepo]);

  const statusText = miokuUpdate?.error
    ? miokuUpdate.error
    : miokuUpdate?.hasUpdates
      ? `检测到 ${miokuUpdate.behind} 个新提交，当前分支 ${miokuUpdate.currentBranch} 落后于 ${miokuUpdate.targetRef}。`
      : `当前分支 ${miokuUpdate?.currentBranch || "unknown"} 已和 ${miokuUpdate?.targetRef || "origin/unknown"} 保持同步。`;

  return (
    <div className="space-y-4 animate-soft-pop">
      <Card className="overflow-hidden">
        <CardContent className="grid gap-0 p-0 lg:grid-cols-[1.35fr_minmax(0,0.95fr)]">
          <div className="min-h-[240px] bg-secondary/20">
            <img
              src="/about-hero.jpg"
              alt="Mioku Hero (Light)"
              className="h-full w-full object-cover dark:hidden"
            />
            <img
              src="/about-hero-dark.jpg"
              alt="Mioku Hero (Dark)"
              className="hidden h-full w-full object-cover dark:block"
            />
          </div>
          <div className="flex flex-col justify-center space-y-4 p-6">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                About Mioku
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight">
                Mioku
              </h1>
            </div>
            <p className="text-sm leading-7 text-muted-foreground">
              {introText}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <InfoStat label="当前版本" value={heroVersions.current} />
              <InfoStat label="目标版本" value={heroVersions.target} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>仓库更新</CardTitle>
          <CardDescription>
            检查当前仓库相对远端同名分支的更新情况，并按需执行更新。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-xl border bg-card/70 p-4">
            <p className="text-sm font-semibold">状态</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {statusText}
            </p>
            {miokuUpdate?.changelog?.length ? (
              <div className="mt-3 space-y-1 rounded-lg border bg-secondary/20 p-3 text-xs text-muted-foreground">
                {miokuUpdate.changelog.slice(0, 5).map((line) => (
                  <p key={line} className="break-all">
                    {line}
                  </p>
                ))}
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="min-w-[124px] justify-center"
              onClick={() => void checkMiokuUpdate(true, true)}
              disabled={checkingMioku || updatingMioku}
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${checkingMioku ? "animate-spin" : ""}`}
              />
              检查更新
            </Button>
            <Button
              className="min-w-[124px] justify-center"
              onClick={() => void updateMioku()}
              disabled={
                updatingMioku || checkingMioku || !miokuUpdate?.hasUpdates
              }
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${updatingMioku ? "animate-spin" : ""}`}
              />
              更新 Mioku
            </Button>
            <Button
              variant="outline"
              className="min-w-[124px] justify-center"
              onClick={() =>
                repoUrl
                  ? window.open(repoUrl, "_blank", "noopener,noreferrer")
                  : null
              }
              disabled={!repoUrl}
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              查看仓库
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function InfoStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card/72 p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-2 text-lg font-semibold break-words">{value}</p>
    </div>
  );
}
