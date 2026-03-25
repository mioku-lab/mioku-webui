import { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { useTopbar } from "@/components/layout/TopbarContext";
import { ConfigPageRenderer } from "./ConfigPageRenderer";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges";

type JSONValue =
  | string
  | number
  | boolean
  | null
  | JSONValue[]
  | { [k: string]: JSONValue };

interface ConfigPageData {
  plugin: string;
  title: string;
  description?: string;
  markdown: string;
  fields: any[];
  hasCustomPage: boolean;
  configs: Record<string, JSONValue>;
}

interface ConfigurablePlugin {
  name: string;
  title?: string;
  description?: string;
  hasPage?: boolean;
  configFiles?: string[];
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

function configsEqual(a: Record<string, JSONValue>, b: Record<string, JSONValue>): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function PluginConfigPage() {
  const [plugins, setPlugins] = useState<ConfigurablePlugin[]>([]);
  const [selected, setSelected] = useState("");
  const [configs, setConfigs] = useState<Record<string, JSONValue>>({});
  const [pageData, setPageData] = useState<ConfigPageData | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [navAnimSeed, setNavAnimSeed] = useState(0);
  const lastPluginNavSignatureRef = useRef("");
  const { setLeftContent, setRightContent } = useTopbar();

  const initialConfigsRef = useRef<string>("");
  const [hasChanges, setHasChanges] = useState(false);

  useUnsavedChanges(hasChanges);

  const loadConfigurablePlugins = async (preferredSelected?: string) => {
    try {
      const res = await apiFetch<any>("/api/plugin-config/overview");
      const items = (res.data || []) as ConfigurablePlugin[];

      const configurable = items.filter((item) => item.configFiles && item.configFiles.length > 0);
      setPlugins(configurable);

      if (configurable.length === 0) {
        setSelected("");
        setConfigs({});
        return;
      }

      const nextSelected =
        preferredSelected && configurable.some((item) => item.name === preferredSelected)
          ? preferredSelected
          : configurable[0].name;

      setSelected(nextSelected);
    } catch (error) {
      setMsg(error instanceof Error ? error.message : "加载插件配置失败");
    }
  };

  useEffect(() => {
    loadConfigurablePlugins().then();
  }, []);

  useEffect(() => {
    if (!selected) return;

    const loadConfigs = async () => {
      setLoading(true);
      try {
        const [pageRes, configRes] = await Promise.all([
          apiFetch<any>(`/api/plugin-config/${encodeURIComponent(selected)}/page`).catch(() => ({ data: null })),
          apiFetch<any>(`/api/plugin-config/${encodeURIComponent(selected)}`),
        ]);

        const filteredConfigs = filterConfigFiles(configRes.data || {});
        
        if (Object.keys(filteredConfigs).length === 0) {
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

        setConfigs(filteredConfigs);
        initialConfigsRef.current = JSON.stringify(filteredConfigs);

        if (pageRes.data) {
          setPageData({
            ...pageRes.data,
            configs: filteredConfigs,
          });
        } else {
          setPageData(null);
        }
      } catch (error) {
        setMsg(error instanceof Error ? error.message : "加载插件配置失败");
      } finally {
        setLoading(false);
      }
    };

    loadConfigs();
  }, [selected]);

  useEffect(() => {
    const current = JSON.stringify(configs);
    setHasChanges(current !== initialConfigsRef.current);
  }, [configs]);

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

  const handleConfigChange = useCallback((newConfigs: Record<string, JSONValue>) => {
    setConfigs(newConfigs);
  }, []);

  const saveAll = async () => {
    if (!selected) return;
    setSaving(true);

    try {
      for (const [fileName, value] of Object.entries(configs)) {
        await apiFetch(`/api/plugin-config/${encodeURIComponent(selected)}/${fileName}`, {
          method: "PUT",
          body: JSON.stringify(value),
        });
      }

      toast.success("配置已保存");
      initialConfigsRef.current = JSON.stringify(configs);
      setHasChanges(false);
      await loadConfigurablePlugins(selected);
    } catch (error) {
      toast.error("保存失败");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    setRightContent(
      <Button
        onClick={saveAll}
        disabled={saving || !hasChanges}
        size="sm"
        className="animate-fade-in"
      >
        <Save className="h-4 w-4 sm:mr-1" />
        <span className="hidden sm:inline">保存配置</span>
      </Button>,
    );
    return () => setRightContent(null);
  }, [saving, hasChanges, setRightContent]);

  const updateConfigText = (fileName: string, raw: string) => {
    try {
      const parsed = JSON.parse(raw) as JSONValue;
      setConfigs((prev) => ({ ...prev, [fileName]: parsed }));
    } catch {
      // ignore invalid json while typing
    }
  };

  const configEntries = Object.entries(configs);

  if (loading && !selected) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-muted-foreground">加载中...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-soft-pop">
      {!pageData?.hasCustomPage && (
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
              </div>
            ))}

            {msg ? <p className="text-sm text-primary">{msg}</p> : null}
          </CardContent>
        </Card>
      )}

      {pageData?.hasCustomPage && pageData && (
        <Card>
          <CardHeader className="gap-1.5">
            <CardTitle className="text-base">{pageData.title}</CardTitle>
            {pageData.description && (
              <p className="text-sm text-muted-foreground">{pageData.description}</p>
            )}
          </CardHeader>
          <CardContent>
            <ConfigPageRenderer
              pageData={pageData}
              configs={configs}
              onConfigChange={handleConfigChange}
            />
          </CardContent>
        </Card>
      )}

      {msg && !pageData?.hasCustomPage ? <p className="text-sm text-primary">{msg}</p> : null}
    </div>
  );
}
