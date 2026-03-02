import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiFetch, apiForm } from "@/lib/api";

export function DatabasePage() {
  const [table, setTable] = useState("messages");
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [payload, setPayload] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [msg, setMsg] = useState("");
  const [backupFile, setBackupFile] = useState<File | null>(null);

  const load = async () => {
    const [rows, s] = await Promise.all([
      apiFetch<any>(`/api/db/messages?table=${table}&keyword=${encodeURIComponent(keyword)}&page=${page}&pageSize=20`),
      apiFetch<any>("/api/db/stats"),
    ]);
    setPayload(rows.data);
    setStats(s.data);
  };

  useEffect(() => {
    load().catch(() => {});
  }, [table, keyword, page]);

  const exportData = async (format: "json" | "csv") => {
    const res = await apiFetch<any>(`/api/db/export?format=${format}`);
    setMsg(`导出完成: ${res.data.filePath}`);
  };

  const importData = async () => {
    if (!backupFile) return;
    const form = new FormData();
    form.append("file", backupFile);
    await apiForm("/api/db/import", form);
    setMsg("导入完成");
    load();
  };

  const rows = useMemo(() => payload?.rows || [], [payload]);

  return (
    <div className="space-y-4 animate-soft-pop">
      <Card>
        <CardHeader><CardTitle>数据库统计</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 gap-2 md:grid-cols-4">
          <Info label="消息总数" value={String(stats?.messageTotal ?? 0)} />
          <Info label="活跃用户" value={String(stats?.activeUsers ?? 0)} />
          <Info label="AI调用" value={String(stats?.aiCalls ?? 0)} />
          <Info label="表情统计项" value={String(stats?.imageStats?.length ?? 0)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>聊天记录查询</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Input className="max-w-xs" value={table} onChange={(e) => setTable(e.target.value)} placeholder="表名，默认 messages" />
            <Input className="max-w-xs" value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="关键词" />
            <Button variant="outline" onClick={() => setPage((p) => Math.max(1, p - 1))}>上一页</Button>
            <Button variant="outline" onClick={() => setPage((p) => p + 1)}>下一页</Button>
          </div>
          <div className="overflow-auto rounded-md border">
            <table className="min-w-full text-xs">
              <thead className="bg-secondary/50">
                <tr>
                  {(payload?.columns || []).map((col: string) => (
                    <th key={col} className="px-2 py-2 text-left">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row: any, idx: number) => (
                  <tr key={idx} className="border-t">
                    {(payload?.columns || []).map((col: string) => (
                      <td key={col} className="max-w-xs truncate px-2 py-1">{String(row[col] ?? "")}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>备份导出/导入</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => exportData("json")}>导出 JSON</Button>
            <Button onClick={() => exportData("csv")} variant="outline">导出 CSV</Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <input type="file" accept=".json" onChange={(e) => setBackupFile(e.target.files?.[0] || null)} />
            <Button onClick={importData}>导入 JSON</Button>
          </div>
          {msg ? <p className="text-sm text-primary">{msg}</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold text-primary">{value}</p>
    </div>
  );
}
