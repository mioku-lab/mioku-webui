import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch, apiForm } from "@/lib/api";

export function AIConfigPage() {
  const [base, setBase] = useState("{}");
  const [personalization, setPersonalization] = useState("{}");
  const [settings, setSettings] = useState("{}");
  const [instances, setInstances] = useState<string[]>([]);
  const [skills, setSkills] = useState<string[]>([]);
  const [tools, setTools] = useState<string[]>([]);
  const [msg, setMsg] = useState("");

  const [newInstance, setNewInstance] = useState({ name: "", apiUrl: "", apiKey: "", modelType: "text" });
  const [memeMeta, setMemeMeta] = useState({ character: "hatsune_miku", emotion: "happy" });
  const [memeFile, setMemeFile] = useState<File | null>(null);

  const load = async () => {
    const [b, p, s, i, st] = await Promise.all([
      apiFetch<any>("/api/ai/base"),
      apiFetch<any>("/api/ai/personalization"),
      apiFetch<any>("/api/ai/settings"),
      apiFetch<any>("/api/ai/instances"),
      apiFetch<any>("/api/ai/skills"),
    ]);
    setBase(JSON.stringify(b.data, null, 2));
    setPersonalization(JSON.stringify(p.data, null, 2));
    setSettings(JSON.stringify(s.data, null, 2));
    setInstances(i.data || []);
    setSkills(st.data?.skills || []);
    setTools(st.data?.tools || []);
  };

  useEffect(() => {
    load().catch(() => {});
  }, []);

  const save = async (endpoint: string, value: string) => {
    await apiFetch(endpoint, { method: "PUT", body: value });
    setMsg("保存成功");
  };

  const createInstance = async () => {
    await apiFetch("/api/ai/instances", { method: "POST", body: JSON.stringify(newInstance) });
    setMsg("实例创建成功");
    load();
  };

  const uploadMeme = async () => {
    if (!memeFile) return;
    const form = new FormData();
    form.append("character", memeMeta.character);
    form.append("emotion", memeMeta.emotion);
    form.append("file", memeFile);
    await apiForm("/api/meme/upload", form);
    setMsg("表情上传成功");
    setMemeFile(null);
  };

  return (
    <div className="space-y-4 animate-soft-pop">
      <GridCard title="基础配置 base.json" value={base} onChange={setBase} onSave={() => save("/api/ai/base", base)} />
      <GridCard title="人设配置 personalization.json" value={personalization} onChange={setPersonalization} onSave={() => save("/api/ai/personalization", personalization)} />
      <GridCard title="聊天配置 settings.json" value={settings} onChange={setSettings} onSave={() => save("/api/ai/settings", settings)} />

      <Card>
        <CardHeader><CardTitle>AI 实例与 Skill/Tool</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
            <Input placeholder="实例名" value={newInstance.name} onChange={(e) => setNewInstance({ ...newInstance, name: e.target.value })} />
            <Input placeholder="API URL" value={newInstance.apiUrl} onChange={(e) => setNewInstance({ ...newInstance, apiUrl: e.target.value })} />
            <Input placeholder="API Key" value={newInstance.apiKey} onChange={(e) => setNewInstance({ ...newInstance, apiKey: e.target.value })} />
            <select className="h-10 rounded-md border bg-card px-3 text-sm" value={newInstance.modelType} onChange={(e) => setNewInstance({ ...newInstance, modelType: e.target.value })}>
              <option value="text">text</option>
              <option value="multimodal">multimodal</option>
            </select>
          </div>
          <Button onClick={createInstance}>创建实例</Button>
          <p className="text-sm">实例: {instances.join(", ") || "无"}</p>
          <p className="text-sm">Skills: {skills.join(", ") || "无"}</p>
          <p className="text-sm">Tools: {tools.join(", ") || "无"}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>表情包管理</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            <Input value={memeMeta.character} onChange={(e) => setMemeMeta({ ...memeMeta, character: e.target.value })} placeholder="角色名" />
            <Input value={memeMeta.emotion} onChange={(e) => setMemeMeta({ ...memeMeta, emotion: e.target.value })} placeholder="情绪" />
            <input type="file" onChange={(e) => setMemeFile(e.target.files?.[0] || null)} />
          </div>
          <Button onClick={uploadMeme}>上传表情</Button>
        </CardContent>
      </Card>

      {msg ? <p className="rounded-md border bg-secondary/40 p-2 text-sm">{msg}</p> : null}
    </div>
  );
}

function GridCard({ title, value, onChange, onSave }: { title: string; value: string; onChange: (v: string) => void; onSave: () => void }) {
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        <Textarea className="min-h-52 font-mono text-xs" value={value} onChange={(e) => onChange(e.target.value)} />
        <Button onClick={onSave}>保存</Button>
      </CardContent>
    </Card>
  );
}
