import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  Bot,
  Gauge,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiFetch } from "@/lib/api";
import { useTopbar } from "@/components/layout/TopbarContext";

type UsageRange = "today" | "7d" | "30d";

type BotOption = {
  botId: number;
  label: string;
};

type BotInfo = {
  botId: number;
  qq: number;
  nickname: string;
  avatar: string;
  online: boolean;
};

type UsageSummary = {
  generatedAt: number;
  range: UsageRange;
  scope: "all" | "bot";
  botId?: number;
  bots: BotOption[];
  totals: {
    requests: number;
    successfulRequests: number;
    failedRequests: number;
    userMessages: number;
    assistantMessages: number;
    systemMessages: number;
    toolMessages: number;
    sentUserMessages: number;
    sentAssistantMessages: number;
    inputTokens: number;
    outputTokens: number;
    systemPromptTokens: number;
    totalTokens: number;
    cacheWriteTokens: number;
    cacheReadTokens: number;
    toolDefinitionTokens: number;
    toolUseTokens: number;
    chatHistoryTokens: number;
    otherContextTokens: number;
    durationMs: number;
    toolCalls: number;
  };
  rates: {
    throughputTokPerMin: number;
    averageTokensPerUserMessage: number;
    averageTokensPerSentMessage: number;
    errorRate: number;
    cacheHitRate: number;
  };
  toolRanking: Array<{ name: string; count: number }>;
  groupRanking: Array<{
    groupId: number;
    groupName: string;
    requests: number;
    totalTokens: number;
    userMessages: number;
    assistantMessages: number;
    sentUserMessages: number;
    sentAssistantMessages: number;
    errorRate: number;
  }>;
  tokenFlow: Array<{
    name: "输入" | "输出" | "缓存写入" | "缓存读取";
    value: number;
  }>;
  tokenCategories: Array<{
    name: "系统提示词" | "工具定义" | "工具使用" | "聊天上下文" | "其他上下文";
    value: number;
  }>;
  dailyActivity: Array<{
    day: string;
    requests: number;
    userMessages: number;
    assistantMessages: number;
    sentUserMessages: number;
    sentAssistantMessages: number;
    totalTokens: number;
    inputTokens: number;
    cacheReadTokens: number;
    throughputTokPerMin: number;
    averageTokensPerUserMessage: number;
    averageTokensPerSentMessage: number;
    errorRate: number;
    cacheHitRate: number;
  }>;
  hourlyActivity: Array<{
    hour: string;
    requests: number;
    userMessages: number;
    assistantMessages: number;
    sentUserMessages: number;
    sentAssistantMessages: number;
    totalTokens: number;
    inputTokens: number;
    cacheReadTokens: number;
    throughputTokPerMin: number;
    averageTokensPerUserMessage: number;
    averageTokensPerSentMessage: number;
    errorRate: number;
    cacheHitRate: number;
  }>;
};

type ApiResponse<T> = {
  ok: boolean;
  data: T;
};

type ChartDialog = {
  title: string;
  description: string;
  kind: "bars" | "lines";
  data: Array<Record<string, string | number>>;
  xKey: string;
  barLayout?: "horizontal" | "vertical";
  yAxisWidth?: number;
  bars?: Array<{ key: string; name: string; color: string }>;
  barColors?: string[];
  lines?: Array<{
    key: string;
    name: string;
    color: string;
    axis?: "left" | "right";
  }>;
  rightAxis?: {
    unit?: string;
    domain?: [number, number];
  };
};

const chartLineAnimation = {
  animationBegin: 220,
  animationDuration: 920,
  animationEasing: "ease-out" as const,
};

type TooltipPayload = {
  name?: string;
  value?: string | number;
  color?: string;
  dataKey?: string | number;
  payload?: Record<string, string | number>;
};

const rangeLabels: Record<UsageRange, string> = {
  today: "今天",
  "7d": "7天",
  "30d": "30天",
};

const flowColors = ["#14b8a6", "#38bdf8", "#a78bfa", "#f59e0b", "#f472b6"];

export function AIUsagePage() {
  const [range, setRange] = useState<UsageRange>("today");
  const [botId, setBotId] = useState<number | "all">("all");
  const [summary, setSummary] = useState<UsageSummary | null>(null);
  const [bots, setBots] = useState<BotInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dialog, setDialog] = useState<ChartDialog | null>(null);
  const [navAnimSeed, setNavAnimSeed] = useState(0);
  const lastBotNavSignatureRef = useRef("");
  const { setLeftContent, setRightContent, setDenseHeader } = useTopbar();

  const load = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({ range });
      if (botId !== "all") query.set("botId", String(botId));
      const res = await apiFetch<ApiResponse<UsageSummary>>(
        `/api/ai/usage?${query.toString()}`,
      );
      setSummary(res.data);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载使用统计失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [range, botId]);

  useEffect(() => {
    let cancelled = false;
    const loadBots = async () => {
      try {
        const res =
          await apiFetch<ApiResponse<{ bots?: BotInfo[] }>>("/api/overview");
        if (cancelled) return;
        setBots(res.data?.bots || []);
      } catch {
        if (!cancelled) setBots([]);
      }
    };
    void loadBots();
    return () => {
      cancelled = true;
    };
  }, []);

  const botNavSignature = bots.map((bot) => String(bot.botId)).join("|");

  useEffect(() => {
    if (!botNavSignature) return;
    if (botNavSignature === lastBotNavSignatureRef.current) return;
    lastBotNavSignatureRef.current = botNavSignature;
    setNavAnimSeed((value) => value + 1);
  }, [botNavSignature]);

  useEffect(() => {
    setDenseHeader(true);
    const usageBots =
      bots.length > 0
        ? bots
        : (summary?.bots || []).map((bot) => ({
            botId: bot.botId,
            qq: bot.botId,
            nickname: `Bot ${bot.label}`,
            avatar: "/miku-logo.png",
            online: true,
          }));

    setLeftContent(
      <div className="flex min-w-0 items-center gap-2">
        <div className="topbar-chip-scroll flex items-center gap-1.5 overflow-x-auto">
          <span key={`all-${navAnimSeed}`} className="topbar-nav-item-enter">
            <button
              type="button"
              onClick={() => setBotId("all")}
              className={`topbar-chip flex h-[44px] items-center rounded-full border px-4 py-1.5 text-xs ${
                botId === "all"
                  ? "border-primary/45 bg-card text-foreground shadow-sm"
                  : "border-border/70 bg-card/85 text-muted-foreground hover:-translate-y-0.5 hover:border-primary/35 hover:bg-card hover:text-foreground"
              }`}
              title="总计"
            >
              <span className="font-medium">总计</span>
            </button>
          </span>
          {usageBots.map((bot, index) => (
            <span
              key={`${bot.botId}-${navAnimSeed}`}
              className="topbar-nav-item-enter"
              style={{ animationDelay: `${(index + 1) * 45}ms` }}
            >
              <button
                type="button"
                onClick={() => setBotId(bot.botId)}
                className={`topbar-chip group flex items-center gap-2 rounded-full border px-2.5 py-1.5 text-xs ${
                  botId === bot.botId
                    ? "border-primary/45 bg-card text-foreground shadow-sm"
                    : "border-border/70 bg-card/85 text-muted-foreground hover:-translate-y-0.5 hover:border-primary/35 hover:bg-card hover:text-foreground"
                }`}
                title={`${bot.nickname} (${bot.qq})`}
              >
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
                <span className="max-w-[110px] truncate font-medium">
                  {bot.nickname}
                </span>
              </button>
            </span>
          ))}
          {usageBots.length === 0 ? (
            <span className="text-xs text-muted-foreground">暂无实例</span>
          ) : null}
        </div>
      </div>,
    );
    setRightContent(null);
    return () => {
      setLeftContent(null);
      setRightContent(null);
      setDenseHeader(false);
    };
  }, [
    setDenseHeader,
    setLeftContent,
    setRightContent,
    bots,
    botId,
    navAnimSeed,
    summary?.bots,
  ]);

  const metricRows = useMemo(() => {
    if (!summary) return [];
    return [
      {
        label: "消息量",
        value: formatNumber(
          summary.totals.userMessages + summary.totals.assistantMessages,
        ),
        detail: `用户 ${summary.totals.userMessages} / 助手 ${summary.totals.assistantMessages}`,
        icon: Activity,
        dialog: {
          title: "总消息量趋势",
          description: "不同时间段的使用趋势",
          kind: "lines" as const,
          xKey: "time",
          data: activityData(summary),
          lines: [
            { key: "userMessages", name: "用户消息", color: "#14b8a6" },
            { key: "assistantMessages", name: "助手消息", color: "#38bdf8" },
          ],
        },
      },
      {
        label: "吞吐量",
        value: formatNumber(summary.rates.throughputTokPerMin),
        detail: "tok/s 消耗速率",
        icon: Gauge,
        dialog: activityDialog(summary),
      },
      {
        label: "平均 token/对话",
        value: formatNumber(summary.rates.averageTokensPerSentMessage),
        detail: `完整 token / 对话请求，${formatNumber(summary.totals.requests)} 次`,
        icon: Sparkles,
        dialog: averageTokenDialog(summary),
      },
      {
        label: "错误率",
        value: formatPercent(summary.rates.errorRate),
        detail: `${summary.totals.failedRequests} / ${summary.totals.requests} 请求`,
        icon: AlertTriangle,
        dialog: errorRateDialog(summary),
      },
      {
        label: "缓存命中率",
        value: formatPercent(summary.rates.cacheHitRate),
        detail: `读 ${summary.totals.cacheReadTokens} / 写 ${summary.totals.cacheWriteTokens}`,
        icon: Bot,
        dialog: cacheHitDialog(summary),
      },
    ];
  }, [summary]);

  return (
    <div className="space-y-4 animate-soft-pop">
      <section className="rounded-3xl border bg-card/80 p-5 panel-glow">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-[0.28em] text-primary">
              AI Usage
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">
              使用情况统计
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              部分请求数按照输入/输出字符数推算，可能存在部分偏差
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[170px_auto] xl:shrink-0">
            <ControlBlock label="粒度">
              <Select
                value={range}
                onValueChange={(value) => setRange(value as UsageRange)}
              >
                <SelectTrigger className="h-9 rounded-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(rangeLabels) as UsageRange[]).map((item) => (
                    <SelectItem key={item} value={item}>
                      {rangeLabels[item]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </ControlBlock>
            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={load}
                disabled={loading}
                className="h-9 w-full rounded-full"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                {loading ? "在刷新了:(" : "刷新"}
              </Button>
            </div>
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-500">
          {error}
        </div>
      ) : null}

      <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
        {metricRows.map((metric) => {
          const Icon = metric.icon;
          return (
            <button
              key={metric.label}
              type="button"
              onClick={() => setDialog(metric.dialog)}
              className="group min-h-[142px] rounded-3xl border bg-card/80 p-5 text-left panel-glow transition duration-300 hover:-translate-y-1 hover:border-primary/50"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-muted-foreground">
                  {metric.label}
                </span>
                <Icon className="h-4 w-4 text-primary" />
              </div>
              <div className="mt-4 tabular-nums text-3xl font-semibold tracking-tight">
                {metric.value}
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                {metric.detail}
              </div>
            </button>
          );
        })}
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <InsightPanel
          title="群使用排行"
          description="看看哪个群用的最厉害"
          onClick={() => summary && setDialog(groupDialog(summary))}
        >
          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              data={summary?.groupRanking || []}
              margin={{ top: 8, right: 12, left: 0, bottom: 8 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--border))"
              />
              <XAxis
                dataKey="groupName"
                interval={0}
                tick={{ fontSize: 11 }}
                tickLine={false}
                height={42}
                tickFormatter={shortChartLabel}
              />
              <YAxis tick={{ fontSize: 11 }} />
              <ChartTooltip />
              <Bar dataKey="totalTokens" name="tokens" radius={[8, 8, 0, 0]}>
                {(summary?.groupRanking || []).map((item, index) => (
                  <Cell
                    key={item.groupId}
                    fill={flowColors[index % flowColors.length]}
                    className="ai-usage-bar-cell"
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </InsightPanel>

        <InsightPanel
          title="工具使用排行"
          description="看看哪个工具用的最多"
          onClick={() => summary && setDialog(toolDialog(summary))}
        >
          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              data={summary?.toolRanking || []}
              layout="vertical"
              margin={{ top: 8, right: 16, left: 6, bottom: 8 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--border))"
              />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis
                type="category"
                dataKey="name"
                width={120}
                tick={{ fontSize: 11 }}
              />
              <ChartTooltip />
              <Bar dataKey="count" name="调用次数" radius={[0, 8, 8, 0]}>
                {(summary?.toolRanking || []).map((item) => (
                  <Cell
                    key={item.name}
                    fill="#14b8a6"
                    className="ai-usage-bar-cell"
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </InsightPanel>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <InsightPanel
          title="Token 流向"
          description="我的Token都去哪了"
          onClick={() => summary && setDialog(tokenFlowDialog(summary))}
        >
          <ResponsiveContainer width="100%" height={260}>
            <BarChart
              data={summary?.tokenFlow || []}
              margin={{ top: 8, right: 12, left: 0, bottom: 8 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--border))"
              />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <ChartTooltip />
              <Bar dataKey="value" name="tokens" radius={[8, 8, 0, 0]}>
                {(summary?.tokenFlow || []).map((item, index) => (
                  <Cell
                    key={item.name}
                    fill={flowColors[index % flowColors.length]}
                    className="ai-usage-bar-cell"
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </InsightPanel>

        <InsightPanel
          title="使用分类"
          description="我的Token都去哪了"
          onClick={() => summary && setDialog(categoryDialog(summary))}
        >
          <ResponsiveContainer width="100%" height={260}>
            <BarChart
              data={summary?.tokenCategories || []}
              margin={{ top: 8, right: 12, left: 0, bottom: 8 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--border))"
              />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <ChartTooltip />
              <Bar dataKey="value" name="tokens" radius={[8, 8, 0, 0]}>
                {(summary?.tokenCategories || []).map((item, index) => (
                  <Cell
                    key={item.name}
                    fill={flowColors[index % flowColors.length]}
                    className="ai-usage-bar-cell"
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </InsightPanel>
      </section>

      <InsightPanel
        title="按时间查看活动"
        description="要越用越多了吗"
        onClick={() => summary && setDialog(activityDialog(summary))}
      >
        <ResponsiveContainer width="100%" height={320}>
          <LineChart
            data={activityData(summary)}
            margin={{ top: 8, right: 14, left: 0, bottom: 8 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="time" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 11 }}
            />
            <ChartTooltip />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="requests"
              name="请求"
              stroke="#14b8a6"
              strokeWidth={2}
              dot={false}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="totalTokens"
              name="tokens"
              stroke="#38bdf8"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </InsightPanel>

      {dialog ? (
        <ChartModal dialog={dialog} onClose={() => setDialog(null)} />
      ) : null}
    </div>
  );
}

function ControlBlock({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="space-y-1.5">
      <span className="block text-xs text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function InsightPanel({
  title,
  description,
  children,
  onClick,
}: {
  title: string;
  description: string;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <section
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") onClick();
      }}
      className="rounded-3xl border bg-card/80 p-5 panel-glow transition duration-300 hover:-translate-y-0.5 hover:border-primary/45"
    >
      <div className="mb-4 flex flex-col gap-1">
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}

function ChartModal({
  dialog,
  onClose,
}: {
  dialog: ChartDialog;
  onClose: () => void;
}) {
  const chartKey = `${dialog.kind}-${dialog.title}-${dialog.data.length}`;

  return (
    <div
      className="ai-chart-modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
      onClick={onClose}
    >
      <div
        className="ai-chart-modal-panel w-full max-w-5xl rounded-3xl border bg-card p-5 panel-glow"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold">{dialog.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {dialog.description}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={onClose}>
            关闭
          </Button>
        </div>
        <div className="ai-chart-stage h-[420px]">
          <ResponsiveContainer width="100%" height="100%">
            {dialog.kind === "bars" ? (
              <BarChart
                key={chartKey}
                data={dialog.data}
                layout={dialog.barLayout || "vertical"}
                margin={{ top: 10, right: 24, left: 18, bottom: 8 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis
                  type="category"
                  dataKey={dialog.xKey}
                  width={dialog.yAxisWidth || 150}
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  interval={0}
                />
                <ChartTooltip />
                {(dialog.bars || []).map((bar) => (
                  <Bar
                    key={bar.key}
                    dataKey={bar.key}
                    name={bar.name}
                    fill={bar.color}
                    radius={[0, 8, 8, 0]}
                    isAnimationActive
                    animationBegin={140}
                    animationDuration={640}
                    animationEasing="ease-out"
                  >
                    {dialog.barColors
                      ? dialog.data.map((item, index) => (
                          <Cell
                            key={`${bar.key}-${String(item[dialog.xKey])}`}
                            fill={
                              dialog.barColors?.[
                                index % dialog.barColors.length
                              ] || bar.color
                            }
                            className="ai-usage-bar-cell"
                          />
                        ))
                      : null}
                  </Bar>
                ))}
              </BarChart>
            ) : (
              <LineChart
                key={chartKey}
                data={dialog.data}
                margin={{ top: 10, right: 18, left: 0, bottom: 8 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                />
                <XAxis dataKey={dialog.xKey} tick={{ fontSize: 12 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
                {dialog.rightAxis ? (
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fontSize: 12 }}
                    domain={dialog.rightAxis.domain}
                    tickFormatter={(value) =>
                      dialog.rightAxis?.unit
                        ? `${value}${dialog.rightAxis.unit}`
                        : String(value)
                    }
                  />
                ) : null}
                <ChartTooltip />
                {(dialog.lines || []).map((line) => (
                  <Line
                    key={line.key}
                    yAxisId={line.axis || "left"}
                    type="monotone"
                    dataKey={line.key}
                    name={line.name}
                    stroke={line.color}
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive
                    {...chartLineAnimation}
                  />
                ))}
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function tokenFlowDialog(summary: UsageSummary): ChartDialog {
  return {
    title: "Token 流向",
    description: "我的Token都去哪了",
    kind: "bars",
    xKey: "name",
    data: summary.tokenFlow,
    yAxisWidth: 96,
    barColors: flowColors,
    bars: [{ key: "value", name: "tokens", color: "#38bdf8" }],
  };
}

function categoryDialog(summary: UsageSummary): ChartDialog {
  return {
    title: "Token 使用分类",
    description: "我的Token都去哪了",
    kind: "bars",
    xKey: "name",
    data: summary.tokenCategories,
    yAxisWidth: 104,
    barColors: flowColors,
    bars: [{ key: "value", name: "tokens", color: "#a78bfa" }],
  };
}

function toolDialog(summary: UsageSummary): ChartDialog {
  return {
    title: "工具使用排行",
    description: "哪些工具用的最多",
    kind: "bars",
    xKey: "name",
    data: summary.toolRanking,
    yAxisWidth: 190,
    barColors: ["#14b8a6"],
    bars: [{ key: "count", name: "调用次数", color: "#14b8a6" }],
  };
}

function groupDialog(summary: UsageSummary): ChartDialog {
  return {
    title: "群使用统计",
    description: "哪个群用的最厉害",
    kind: "bars",
    xKey: "groupName",
    data: summary.groupRanking.map((group) => ({
      groupName: group.groupName,
      requests: group.requests,
      totalTokens: group.totalTokens,
      userMessages: group.userMessages,
      assistantMessages: group.assistantMessages,
    })),
    yAxisWidth: 210,
    bars: [
      { key: "totalTokens", name: "tokens", color: "#38bdf8" },
      { key: "requests", name: "请求", color: "#14b8a6" },
    ],
  };
}

function activityDialog(summary: UsageSummary): ChartDialog {
  return {
    title: "时间活动走势",
    description: "要越用越多了吗",
    kind: "lines",
    xKey: "time",
    data: activityData(summary),
    lines: [
      { key: "requests", name: "请求", color: "#14b8a6" },
      { key: "totalTokens", name: "tokens", color: "#38bdf8" },
    ],
  };
}

function averageTokenDialog(summary: UsageSummary): ChartDialog {
  return {
    title: "平均 token/对话趋势",
    description: "完整 token 消耗除以对话请求次数。",
    kind: "lines",
    xKey: "time",
    data: activityData(summary),
    lines: [
      {
        key: "averageTokensPerSentMessage",
        name: "平均 token/对话",
        color: "#a78bfa",
      },
      {
        key: "totalTokens",
        name: "总 tokens",
        color: "#38bdf8",
        axis: "right",
      },
    ],
    rightAxis: {},
  };
}

function errorRateDialog(summary: UsageSummary): ChartDialog {
  return {
    title: "错误率趋势",
    description: "没出错最好",
    kind: "lines",
    xKey: "time",
    data: activityData(summary),
    lines: [{ key: "errorRatePercent", name: "错误率", color: "#f97316" }],
    rightAxis: undefined,
  };
}

function cacheHitDialog(summary: UsageSummary): ChartDialog {
  return {
    title: "缓存命中率趋势",
    description: "很难命中",
    kind: "lines",
    xKey: "time",
    data: activityData(summary),
    lines: [
      { key: "cacheHitRatePercent", name: "缓存命中率", color: "#22c55e" },
      {
        key: "cacheReadTokens",
        name: "缓存读取",
        color: "#38bdf8",
        axis: "right",
      },
    ],
    rightAxis: {},
  };
}

function activityData(summary: UsageSummary | null) {
  if (!summary) return [];
  if (summary.range === "today") {
    return summary.hourlyActivity.map((item) => ({
      time: item.hour,
      requests: item.requests,
      userMessages: item.userMessages,
      assistantMessages: item.assistantMessages,
      sentUserMessages: item.sentUserMessages,
      sentAssistantMessages: item.sentAssistantMessages,
      totalTokens: item.totalTokens,
      inputTokens: item.inputTokens,
      cacheReadTokens: item.cacheReadTokens,
      averageTokensPerUserMessage: item.averageTokensPerUserMessage,
      averageTokensPerSentMessage: item.averageTokensPerSentMessage,
      throughputTokPerMin: item.throughputTokPerMin,
      errorRatePercent: roundDisplay(item.errorRate * 100),
      cacheHitRatePercent: roundDisplay(item.cacheHitRate * 100),
    }));
  }
  return summary.dailyActivity.map((item) => ({
    time: item.day.slice(5),
    requests: item.requests,
    userMessages: item.userMessages,
    assistantMessages: item.assistantMessages,
    sentUserMessages: item.sentUserMessages,
    sentAssistantMessages: item.sentAssistantMessages,
    totalTokens: item.totalTokens,
    inputTokens: item.inputTokens,
    cacheReadTokens: item.cacheReadTokens,
    averageTokensPerUserMessage: item.averageTokensPerUserMessage,
    averageTokensPerSentMessage: item.averageTokensPerSentMessage,
    throughputTokPerMin: item.throughputTokPerMin,
    errorRatePercent: roundDisplay(item.errorRate * 100),
    cacheHitRatePercent: roundDisplay(item.cacheHitRate * 100),
  }));
}

function ChartTooltip() {
  return (
    <Tooltip
      content={<ChartTooltipContent />}
      cursor={false}
      isAnimationActive={false}
      offset={16}
      wrapperStyle={{ pointerEvents: "none", zIndex: 20 }}
    />
  );
}

function ChartTooltipContent({
  active,
  label,
  payload,
}: {
  active?: boolean;
  label?: string | number;
  payload?: TooltipPayload[];
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-2xl border bg-card/95 px-3 py-2 text-xs text-foreground shadow-xl backdrop-blur-md">
      <div className="mb-1 font-medium">{label}</div>
      <div className="space-y-1">
        {payload.map((item) => (
          <div
            key={`${String(item.dataKey)}-${String(item.name)}`}
            className="flex min-w-[150px] items-center justify-between gap-4"
          >
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: item.color || "hsl(var(--primary))" }}
              />
              {item.name}
            </span>
            <span className="font-medium">{formatTooltipValue(item)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatTooltipValue(item: TooltipPayload): string {
  const value =
    typeof item.value === "number" ? item.value : Number(item.value);
  if (!Number.isFinite(value)) return String(item.value ?? "");
  if (String(item.name || "").includes("率")) {
    return `${value.toFixed(1)}%`;
  }
  return formatNumber(value);
}

function shortChartLabel(value: string | number): string {
  const text = String(value);
  return text.length > 7 ? `${text.slice(0, 7)}…` : text;
}

function roundDisplay(value: number): number {
  return Math.round(value * 10) / 10;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("zh-CN", {
    maximumFractionDigits: value >= 100 ? 0 : 2,
  }).format(value);
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}
