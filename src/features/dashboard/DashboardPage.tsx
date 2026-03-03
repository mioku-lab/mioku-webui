import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { RefreshCw } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTopbar } from "@/components/layout/TopbarContext";

type BotInfo = {
  botId: number;
  qq: number;
  nickname: string;
  avatar: string;
  online: boolean;
  napcatVersion: string;
  groupCount: number;
  friendCount: number;
  onlineDurationMs: number;
  statusText: string;
  napcatApiBase: string;
  error?: string;
};

type NetworkPoint = {
  time: string;
  upKB: number;
  downKB: number;
};

export function DashboardPage() {
  const [overview, setOverview] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedBotId, setSelectedBotId] = useState<number | null>(null);
  const [networkSeries, setNetworkSeries] = useState<NetworkPoint[]>([]);
  const [saying, setSaying] = useState("愿每一次启动都带来新的灵感。");
  const [sayingLoading, setSayingLoading] = useState(false);
  const [sayingVisible, setSayingVisible] = useState(true);
  const [displaySaying, setDisplaySaying] =
    useState("愿每一次启动都带来新的灵感。");
  const { setLeftContent } = useTopbar();

  const appendNetworkPoint = (nextOverview: any) => {
    const now = new Date();
    const label = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;
    const upKB = Number(
      ((nextOverview?.system?.networkTxPerSec || 0) / 1024).toFixed(1),
    );
    const downKB = Number(
      ((nextOverview?.system?.networkRxPerSec || 0) / 1024).toFixed(1),
    );

    setNetworkSeries((prev) => {
      const next = [...prev, { time: label, upKB, downKB }];
      return next.slice(-24);
    });
  };

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<any>("/api/overview");
      setOverview(res.data);
      appendNetworkPoint(res.data);

      const firstBot = res.data?.bots?.[0];
      if (firstBot && selectedBotId == null) {
        setSelectedBotId(firstBot.botId);
      }
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载状态失败");
    } finally {
      setLoading(false);
    }
  };

  const refreshSaying = async () => {
    if (sayingLoading) return;
    setSayingLoading(true);
    setSayingVisible(false);

    await new Promise((resolve) => setTimeout(resolve, 300));

    try {
      const res = await apiFetch<any>("/api/saying");
      const newSaying = res?.data?.text || "愿每一次启动都带来新的灵感。";
      setSaying(newSaying);
      setDisplaySaying(newSaying);
    } catch {
      setSayingVisible(true);
    } finally {
      setSayingVisible(true);
      setTimeout(() => setSayingLoading(false), 300);
    }
  };

  useEffect(() => {
    load().then();
    refreshSaying().then();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, []);

  const bots: BotInfo[] = overview?.bots || [];
  const selectedBot = useMemo(
    () => bots.find((bot) => bot.botId === selectedBotId) || bots[0] || null,
    [selectedBotId],
  );

  useEffect(() => {
    setLeftContent(
      <div className="flex min-w-0 items-center gap-2">
        <div className="topbar-scroll flex items-center gap-2 overflow-x-auto">
          {bots.map((bot) => (
            <button
              key={bot.botId}
              type="button"
              onClick={() => setSelectedBotId(bot.botId)}
              className="group relative flex items-center gap-2 rounded-lg px-2 py-1.5 transition"
              title={`${bot.nickname} (${bot.qq})`}
            >
              <span
                className={`absolute inset-0 rounded-lg transition-all duration-300 ${
                  selectedBot?.botId === bot.botId
                    ? "bg-primary/20 ring-1 ring-primary/45"
                    : "bg-transparent group-hover:bg-secondary/45"
                }`}
              />
              <span className="relative h-8 w-8 shrink-0">
                <img
                  src={bot.avatar}
                  alt={bot.nickname}
                  className="h-8 w-8 rounded-full object-cover"
                />
                <span
                  className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border border-card ${
                    bot.online ? "bg-green-500" : "bg-red-500"
                  }`}
                />
              </span>
              <span className="relative max-w-[110px] truncate text-xs font-medium">
                {bot.nickname}
              </span>
            </button>
          ))}
          {bots.length === 0 ? (
            <span className="text-xs text-muted-foreground">暂无实例</span>
          ) : null}
        </div>
      </div>,
    );

    return () => setLeftContent(null);
  }, [bots, selectedBot?.botId, setLeftContent]);

  const system = overview?.system;
  const versions = overview?.versions;
  return (
    <div className="space-y-4 animate-soft-pop">
      {selectedBot ? (
        <Card>
          <CardHeader>
            <CardTitle>机器人信息</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-4">
            <Info label="Bot 昵称" value={selectedBot.nickname} />
            <Info label="QQ 号" value={String(selectedBot.qq)} />
            <Info
              label="NapCat 版本"
              value={selectedBot.napcatVersion || "unknown"}
            />
            <Info label="群数量" value={String(selectedBot.groupCount)} />
            <Info label="好友数量" value={String(selectedBot.friendCount)} />
          </CardContent>
        </Card>
      ) : null}
      <section className="grid grid-cols-1 gap-3 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>系统信息</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={load}
              disabled={loading}
            >
              {loading ? "刷新中..." : "刷新"}
            </Button>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-2 md:grid-cols-2">
            <Info label="已配置实例" value={String(bots.length)} />
            <Info
              label="当前在线实例"
              value={String(bots.filter((bot) => bot.online).length)}
            />
            <Info
              label="系统运行时长"
              value={formatDuration(overview?.uptimeSeconds || 0)}
            />
            <Info label="CPU 型号" value={system?.cpuModel || "unknown"} />
            <Info label="CPU 主频" value={`${system?.cpuSpeedMHz || 0} MHz`} />
            <Info label="CPU 核心数" value={String(system?.cpuCores || 0)} />
            <Info
              label="系统内存"
              value={`${formatBytes(system?.memoryTotal || 0)} (已用 ${formatBytes(system?.memoryUsed || 0)})`}
            />
            <Info
              label="Mioku 进程内存"
              value={`${formatBytes(system?.processMemoryRss || 0)} (${system?.processMemoryPercent || 0}%)`}
            />
            <Info
              label="系统版本"
              value={`${system?.osType || ""} ${system?.osRelease || ""}`}
            />
            <Info
              label="系统类型"
              value={`${system?.osPlatform || ""} / ${system?.osVersion || ""}`}
            />
            <Info
              label="Mioki 版本"
              value={`${versions?.mioki || "unknown"}`}
            />
            <Info
              label="Mioku 版本"
              value={`${versions?.mioku || "unknown"}`}
            />
            <Info
              label="WebUI 版本"
              value={`${versions?.webui || "unknown"}`}
            />
            <Info
              label="WebUI 服务版本"
              value={`${versions?.webuiService || "unknown"}`}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>资源占用</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Gauge
                title="CPU"
                value={Number(system?.cpuUsagePercent || 0)}
                color="#18c4be"
              />
              <Gauge
                title="Memory"
                value={Number(system?.memoryUsagePercent || 0)}
                color="#2ba4cc"
              />
            </div>

            <div className="rounded-xl border bg-secondary/20 p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold">网络上下行 (KB/s)</p>
                <p className="text-xs text-muted-foreground">
                  最近 {networkSeries.length} 个采样
                </p>
              </div>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={networkSeries}
                    margin={{ top: 4, right: 10, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="hsl(var(--border))"
                      opacity={0.5}
                    />
                    <XAxis dataKey="time" hide />
                    <YAxis width={34} tick={{ fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 12,
                        borderColor: "hsl(var(--border))",
                        background: "hsl(var(--card))",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="upKB"
                      name="上行"
                      stroke="#2ba4cc"
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive
                      animationDuration={500}
                    />
                    <Line
                      type="monotone"
                      dataKey="downKB"
                      name="下行"
                      stroke="#18c4be"
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive
                      animationDuration={500}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <Card
        className={`cursor-pointer select-none transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md ${
          sayingLoading ? "ring-1 ring-primary/40" : ""
        }`}
        onClick={() => refreshSaying()}
      >
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>一言</CardTitle>
          <RefreshCw
            className={`h-4 w-4 text-primary transition-all duration-500 ${
              sayingLoading ? "animate-spin" : "hover:rotate-180"
            }`}
          />
        </CardHeader>
        <CardContent className="relative min-h-[60px] overflow-hidden">
          <div
            className={`transition-all duration-300 ease-out ${
              sayingVisible
                ? "translate-y-0 opacity-100"
                : "translate-y-4 opacity-0"
            }`}
          >
            <p className="text-sm leading-7">{displaySaying}</p>
          </div>
          {error ? (
            <p className="mt-2 text-xs text-red-500">
              部分数据加载失败: {error}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function Gauge({
  title,
  value,
  color,
}: {
  title: string;
  value: number;
  color: string;
}) {
  const safeValue = Math.max(
    0,
    Math.min(100, Number.isFinite(value) ? value : 0),
  );
  const data = [{ name: title, value: safeValue, fill: color }];

  return (
    <div className="rounded-xl border bg-secondary/20 p-2">
      <p className="text-center text-sm font-semibold">{title}</p>
      <div className="relative h-44">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            cx="50%"
            cy="50%"
            innerRadius="58%"
            outerRadius="88%"
            barSize={14}
            data={data}
            startAngle={90}
            endAngle={-270}
          >
            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
            <RadialBar
              dataKey="value"
              background={{ fill: "hsl(var(--muted))" }}
              cornerRadius={99}
              isAnimationActive
              animationDuration={720}
            />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <p className="text-2xl font-bold" style={{ color }}>
            {safeValue.toFixed(1)}%
          </p>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="truncate text-sm font-medium">{value}</p>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value.toFixed(value >= 100 ? 0 : 1)} ${units[i]}`;
}

function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
