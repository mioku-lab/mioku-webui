import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch } from "@/lib/api";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function DashboardPage() {
  const [overview, setOverview] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    apiFetch<any>("/api/overview").then((res) => setOverview(res.data)).catch(() => {});
    apiFetch<any>("/api/db/stats").then((res) => setStats(res.data)).catch(() => {});
  }, []);

  useEffect(() => {
    const wsProtocol = location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${wsProtocol}://${location.host}/api/ws/logs`);

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === "init" || payload.type === "update") {
          setLogs(payload.data || []);
        }
      } catch {
        // noop
      }
    };

    return () => ws.close();
  }, []);

  const timeline = useMemo(() => stats?.timeline?.slice().reverse() || [], [stats]);

  return (
    <div className="space-y-3 md:space-y-5 animate-soft-pop">
      <section className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <StatCard title="运行时长" value={`${Math.floor((overview?.uptimeSeconds || 0) / 3600)}h`} />
        <StatCard title="消息总数" value={String(stats?.messageTotal ?? 0)} />
        <StatCard title="活跃用户" value={String(stats?.activeUsers ?? 0)} />
        <StatCard title="AI调用次数" value={String(stats?.aiCalls ?? 0)} />
      </section>

      <section className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>消息时间分布</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timeline}>
                <XAxis dataKey="day" hide />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>最近日志（50条）</CardTitle></CardHeader>
          <CardContent>
            <div className="h-72 overflow-auto rounded-md border p-2 text-xs leading-6">
              {logs.length === 0 ? <p className="text-muted-foreground">暂无日志</p> : logs.map((line, idx) => <p key={`${idx}-${line.slice(0, 12)}`}>{line}</p>)}
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-sm text-muted-foreground">{title}</CardTitle></CardHeader>
      <CardContent><p className="text-2xl font-bold text-primary">{value}</p></CardContent>
    </Card>
  );
}
