import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api";
import { useTopbar } from "@/components/layout/TopbarContext";

type JSONValue =
  | string
  | number
  | boolean
  | null
  | JSONValue[]
  | { [k: string]: JSONValue };

interface ConfigurablePlugin {
  name: string;
}

function isEmptyConfigValue(value: JSONValue): boolean {
  if (value == null) return true;
  if (typeof value === "string") return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") return Object.keys(value).length === 0;
  return false;
}

function filterConfigFiles(
  input: Record<string, JSONValue>,
): Record<string, JSONValue> {
  return Object.fromEntries(
    Object.entries(input || {}).filter(([, value]) => !isEmptyConfigValue(value)),
  ) as Record<string, JSONValue>;
}

export function PluginConfigPage() {
  const [plugins, setPlugins] = useState<ConfigurablePlugin[]>([]);
  const [selected, setSelected] = useState("");
  const [configs, setConfigs] = useState<Record<string, JSONValue>>({});
  const [msg, setMsg] = useState("");
  const [navAnimSeed, setNavAnimSeed] = useState(0);
  const lastPluginNavSignatureRef = useRef("");
  const { setLeftContent } = useTopbar();

  const loadConfigurablePlugins = async (preferredSelected?: string) => {
    try {
      const pluginRes = await apiFetch<any>("/api/manage/plugins");
      const names = (pluginRes.data || [])
        .map((item: any) => String(item?.name || ""))
        .filter(Boolean);

      const allConfigs = await Promise.all(
        names.map(async (name: string) => {
          try {
            const configRes = await apiFetch<any>(
              `/api/plugin-config/${encodeURIComponent(name)}`,
            );
            return {
              name,
              configs: filterConfigFiles(configRes.data || {}),
            };
          } catch {
            return { name, configs: {} as Record<string, JSONValue> };
          }
        }),
      );

      const configurable = allConfigs.filter(
        (item) => Object.keys(item.configs).length > 0,
      );
      const nextPlugins = configurable.map((item) => ({ name: item.name }));
      setPlugins(nextPlugins);

      if (nextPlugins.length === 0) {
        setSelected("");
        setConfigs({});
        return;
      }

      const nextSelected =
        preferredSelected && nextPlugins.some((item) => item.name === preferredSelected)
          ? preferredSelected
          : nextPlugins[0].name;

      setSelected(nextSelected);
      const target = configurable.find((item) => item.name === nextSelected);
      setConfigs(target?.configs || {});
    } catch (error) {
      setMsg(error instanceof Error ? error.message : "加载插件配置失败");
    }
  };

  useEffect(() => {
    loadConfigurablePlugins().then();
  }, []);

  useEffect(() => {
    if (!selected) return;
    apiFetch<any>(`/api/plugin-config/${encodeURIComponent(selected)}`)
      .then((res) => {
        const nextConfigs = filterConfigFiles(res.data || {});
        if (Object.keys(nextConfigs).length === 0) {
          setPlugins((prev) => {
            const next = prev.filter((item) => item.name !== selected);
            if (next.length === 0) {
              setSelected("");
              setConfigs({});
            } else {
              setSelected(next[0].name);
            }
            return next;
          });
          return;
        }
        setConfigs(nextConfigs);
      })
      .catch((e) => {
        setMsg(e instanceof Error ? e.message : "加载插件配置失败");
      });
  }, [selected]);

  const pluginNavSignature = plugins.map((plugin) => plugin.name).join("|");

  useEffect(() => {
    if (!pluginNavSignature) return;
    if (pluginNavSignature === lastPluginNavSignatureRef.current) return;
    lastPluginNavSignatureRef.current = pluginNavSignature;
    setNavAnimSeed((value) => value + 1);
  }, [pluginNavSignature, plugins]);

  useEffect(() => {
    const chipClass = (active: boolean) =>
      `topbar-chip rounded-full border px-3 py-1.5 text-xs ${
        active
          ? "border-transparent bg-primary text-primary-foreground shadow-md"
          : "border-transparent bg-secondary text-secondary-foreground"
      }`;

    setLeftContent(
      <div className="topbar-chip-scroll flex items-center gap-2 overflow-x-auto whitespace-nowrap py-1">
        {plugins.map((plugin, index) => (
          <span
            key={`${plugin.name}-${navAnimSeed}`}
            className="topbar-nav-item-enter"
            style={{ animationDelay: `${index * 45}ms` }}
          >
            <button
              type="button"
              onClick={() => setSelected(plugin.name)}
              className={chipClass(selected === plugin.name)}
            >
              {plugin.name}
            </button>
          </span>
        ))}
      </div>,
    );

    return () => setLeftContent(null);
  }, [navAnimSeed, plugins, selected, setLeftContent]);

  const updateConfigText = (fileName: string, raw: string) => {
    try {
      const parsed = JSON.parse(raw) as JSONValue;
      setConfigs((prev) => ({ ...prev, [fileName]: parsed }));
    } catch {
      // ignore invalid json while typing
    }
  };

  const save = async (fileName: string) => {
    if (!selected) return;
    await apiFetch(`/api/plugin-config/${encodeURIComponent(selected)}/${fileName}`, {
      method: "PUT",
      body: JSON.stringify(configs[fileName]),
    });
    setMsg(`${selected}/${fileName}.json 已保存`);
    await loadConfigurablePlugins(selected);
  };

  const configEntries = Object.entries(configs);

  return (
    <div className="space-y-4 animate-soft-pop">
      <Card>
        <CardHeader>
          <CardTitle>插件配置管理</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {plugins.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无可配置插件</p>
          ) : null}

          {plugins.length > 0 && selected && configEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground">当前插件没有可配置内容</p>
          ) : null}

          {configEntries.map(([name, value]) => (
            <div key={name} className="space-y-3 rounded-md border p-3">
              <p className="text-sm font-semibold">{name}.json</p>
              <Textarea
                className="min-h-32 font-mono text-xs"
                value={JSON.stringify(value, null, 2)}
                onChange={(event) => updateConfigText(name, event.target.value)}
              />
              <Button onClick={() => save(name)}>保存</Button>
            </div>
          ))}

          {msg ? <p className="text-sm text-primary">{msg}</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
