import { useEffect, useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";
import { useTopbar } from "@/components/layout/TopbarContext";
import { Plus, Trash2, Save } from "lucide-react";
import { toast } from "sonner";
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges";

type MiokuConfig = {
  owners: number[];
  admins: number[];
  napcat: NapCatConfig[];
  plugins: string[];
};

type NapCatConfig = {
  name: string;
  protocol: string;
  port: number;
  host: string;
  token: string;
};

type WebUISettings = {
  port: number;
  host: string;
  packageManager: string;
  autoOpen: boolean;
};

type ConfigTab = "owners" | "admins" | "napcat" | "plugins" | "webui";

const tabLabels: Record<ConfigTab, string> = {
  owners: "主人配置",
  admins: "管理员配置",
  napcat: "Onebot配置",
  plugins: "插件开关",
  webui: "WebUI配置",
};

export function MiokuConfigPage() {
  const [miokuConfig, setMiokuConfig] = useState<MiokuConfig>({
    owners: [],
    admins: [],
    napcat: [],
    plugins: [],
  });
  const [webuiSettings, setWebuiSettings] = useState<WebUISettings>({
    port: 3339,
    host: "0.0.0.0",
    packageManager: "bun",
    autoOpen: false,
  });
  const [availablePlugins, setAvailablePlugins] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<ConfigTab>("owners");
  const { setLeftContent, setRightContent } = useTopbar();

  const initialConfigRef = useRef<string>("");
  const [hasChanges, setHasChanges] = useState(false);

  useUnsavedChanges(hasChanges);

  const load = async () => {
    setLoading(true);
    try {
      const [miokuRes, webuiRes, pluginsRes] = await Promise.all([
        apiFetch<{ data: MiokuConfig }>("/api/config/mioku"),
        apiFetch<{ data: WebUISettings }>("/api/settings"),
        apiFetch<{ data: string[] }>("/api/config/plugins/available"),
      ]);
      const config = miokuRes.data || {
        owners: [],
        admins: [],
        napcat: [],
        plugins: [],
      };
      setMiokuConfig(config);
      setWebuiSettings(
        webuiRes.data || {
          port: 3339,
          host: "0.0.0.0",
          packageManager: "bun",
          autoOpen: false,
        },
      );
      setAvailablePlugins(pluginsRes.data || []);
      initialConfigRef.current = JSON.stringify({
        mioku: config,
        webui: webuiRes.data,
      });
    } catch {
      toast.error("加载配置失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const current = JSON.stringify({
      mioku: miokuConfig,
      webui: webuiSettings,
    });
    setHasChanges(current !== initialConfigRef.current);
  }, [miokuConfig, webuiSettings]);

  useEffect(() => {
    setLeftContent(
      <div className="topbar-scroll flex items-center gap-1 overflow-x-auto">
        {(Object.keys(tabLabels) as ConfigTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
              activeTab === tab
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-secondary/50 text-secondary-foreground hover:bg-secondary"
            }`}
          >
            {tabLabels[tab]}
          </button>
        ))}
      </div>,
    );
    return () => setLeftContent(null);
  }, [activeTab, setLeftContent]);

  useEffect(() => {
    setRightContent(
      <Button onClick={saveAll} disabled={saving || !hasChanges} size="sm">
        <Save className="h-4 w-4 sm:mr-1" />
        <span className="hidden sm:inline">保存配置</span>
      </Button>,
    );
    return () => setRightContent(null);
  }, [saving, hasChanges, setRightContent]);

  const saveAll = async () => {
    setSaving(true);
    try {
      await Promise.all([
        apiFetch("/api/config/mioku", {
          method: "PUT",
          body: JSON.stringify(miokuConfig),
        }),
        apiFetch("/api/settings", {
          method: "PUT",
          body: JSON.stringify(webuiSettings),
        }),
      ]);
      toast.success("配置保存成功");
      initialConfigRef.current = JSON.stringify({
        mioku: miokuConfig,
        webui: webuiSettings,
      });
      setHasChanges(false);
    } catch {
      toast.error("保存失败");
    } finally {
      setSaving(false);
    }
  };

  const addOwner = () => {
    setMiokuConfig((prev) => ({ ...prev, owners: [...prev.owners, 0] }));
  };

  const removeOwner = (index: number) => {
    setMiokuConfig((prev) => ({
      ...prev,
      owners: prev.owners.filter((_, i) => i !== index),
    }));
  };

  const updateOwner = (index: number, value: number) => {
    setMiokuConfig((prev) => ({
      ...prev,
      owners: prev.owners.map((o, i) => (i === index ? value : o)),
    }));
  };

  const addAdmin = () => {
    setMiokuConfig((prev) => ({ ...prev, admins: [...prev.admins, 0] }));
  };

  const removeAdmin = (index: number) => {
    setMiokuConfig((prev) => ({
      ...prev,
      admins: prev.admins.filter((_, i) => i !== index),
    }));
  };

  const updateAdmin = (index: number, value: number) => {
    setMiokuConfig((prev) => ({
      ...prev,
      admins: prev.admins.map((a, i) => (i === index ? value : a)),
    }));
  };

  const addNapCat = () => {
    setMiokuConfig((prev) => ({
      ...prev,
      napcat: [
        ...prev.napcat,
        { name: "", protocol: "ws", port: 3001, host: "localhost", token: "" },
      ],
    }));
  };

  const removeNapCat = (index: number) => {
    setMiokuConfig((prev) => ({
      ...prev,
      napcat: prev.napcat.filter((_, i) => i !== index),
    }));
  };

  const updateNapCat = (
    index: number,
    field: keyof NapCatConfig,
    value: string | number,
  ) => {
    setMiokuConfig((prev) => ({
      ...prev,
      napcat: prev.napcat.map((n, i) =>
        i === index ? { ...n, [field]: value } : n,
      ),
    }));
  };

  const togglePlugin = (plugin: string) => {
    setMiokuConfig((prev) => {
      const enabled = prev.plugins.includes(plugin);
      return {
        ...prev,
        plugins: enabled
          ? prev.plugins.filter((p) => p !== plugin)
          : [...prev.plugins, plugin],
      };
    });
  };

  return (
    <div className="space-y-4 animate-soft-pop">
      {activeTab === "owners" && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>主人配置</CardTitle>
            <Button variant="outline" size="sm" onClick={addOwner}>
              <Plus className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {miokuConfig.owners.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                暂无主人，点击右上角添加
              </p>
            ) : (
              miokuConfig.owners.map((owner, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={owner || ""}
                    onChange={(e) =>
                      updateOwner(index, parseInt(e.target.value) || 0)
                    }
                    placeholder="QQ 号"
                    className="flex-1 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeOwner(index)}
                    className="text-red-500 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === "admins" && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>管理员配置</CardTitle>
            <Button variant="outline" size="sm" onClick={addAdmin}>
              <Plus className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {miokuConfig.admins.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                暂无管理员，点击右上角添加
              </p>
            ) : (
              miokuConfig.admins.map((admin, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={admin || ""}
                    onChange={(e) =>
                      updateAdmin(index, parseInt(e.target.value) || 0)
                    }
                    placeholder="QQ 号"
                    className="flex-1 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeAdmin(index)}
                    className="text-red-500 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === "napcat" && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>NapCat/Onebot 实例配置</CardTitle>
            <Button variant="outline" size="sm" onClick={addNapCat}>
              <Plus className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {miokuConfig.napcat.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                暂无实例，点击右上角添加
              </p>
            ) : (
              miokuConfig.napcat.map((napcat, index) => (
                <div key={index} className="space-y-2 rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      {napcat.name || `实例 ${index + 1}`}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeNapCat(index)}
                      className="text-red-500 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    <Input
                      value={napcat.name}
                      onChange={(e) =>
                        updateNapCat(index, "name", e.target.value)
                      }
                      placeholder="实例名称"
                    />
                    <select
                      className="form-select"
                      value={napcat.protocol}
                      onChange={(e) =>
                        updateNapCat(index, "protocol", e.target.value)
                      }
                    >
                      <option value="ws">ws</option>
                      <option value="wss">wss</option>
                    </select>
                    <Input
                      value={napcat.host}
                      onChange={(e) =>
                        updateNapCat(index, "host", e.target.value)
                      }
                      placeholder="主机地址"
                    />
                    <Input
                      type="number"
                      value={napcat.port}
                      onChange={(e) =>
                        updateNapCat(
                          index,
                          "port",
                          parseInt(e.target.value) || 0,
                        )
                      }
                      placeholder="端口"
                      className="[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                    <Input
                      type="password"
                      value={napcat.token}
                      onChange={(e) =>
                        updateNapCat(index, "token", e.target.value)
                      }
                      placeholder="Token"
                      className="md:col-span-2"
                    />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === "plugins" && (
        <Card>
          <CardHeader>
            <CardTitle>插件开关</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {availablePlugins.length === 0 ? (
              <p className="text-sm text-muted-foreground">暂无可用插件</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {availablePlugins.map((plugin) => (
                  <button
                    key={plugin}
                    onClick={() => togglePlugin(plugin)}
                    className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-all ${
                      miokuConfig.plugins.includes(plugin)
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "bg-secondary/50 text-secondary-foreground hover:bg-secondary"
                    }`}
                  >
                    {plugin}
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === "webui" && (
        <Card>
          <CardHeader>
            <CardTitle>WebUI 配置</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">端口</label>
                <Input
                  type="number"
                  value={webuiSettings.port}
                  onChange={(e) =>
                    setWebuiSettings((prev) => ({
                      ...prev,
                      port: parseInt(e.target.value) || 3339,
                    }))
                  }
                  className="[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">主机</label>
                <Input
                  value={webuiSettings.host}
                  onChange={(e) =>
                    setWebuiSettings((prev) => ({
                      ...prev,
                      host: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">
                  包管理器
                </label>
                <select
                  className="form-select w-full"
                  value={webuiSettings.packageManager}
                  onChange={(e) =>
                    setWebuiSettings((prev) => ({
                      ...prev,
                      packageManager: e.target.value,
                    }))
                  }
                >
                  <option value="bun">bun</option>
                  <option value="npm">npm</option>
                  <option value="yarn">yarn</option>
                  <option value="pnpm">pnpm</option>
                </select>
              </div>
              <div className="flex items-center gap-2 pt-5">
                <input
                  type="checkbox"
                  id="autoOpen"
                  className="form-checkbox"
                  checked={webuiSettings.autoOpen}
                  onChange={(e) =>
                    setWebuiSettings((prev) => ({
                      ...prev,
                      autoOpen: e.target.checked,
                    }))
                  }
                />
                <label htmlFor="autoOpen" className="text-sm">
                  自动打开浏览器
                </label>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
