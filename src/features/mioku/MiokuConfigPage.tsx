import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiFetch } from "@/lib/api";
import { useTopbar } from "@/components/layout/TopbarContext";
import { Plus, Trash2, Save, Package } from "lucide-react";
import { toast } from "sonner";
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges";
import type { DatasourceOption } from "@/features/plugin-config/datasource-utils";
import { AccessControlInline } from "@/features/access-control/AccessControlInline";

type CoreSystemConfig = {
  likeCommand: {
    enabled: boolean;
    keyword: string;
    likeTimes: number;
    reactionEmojiId: number;
  };
  friend: {
    autoApprove: boolean;
  };
  group: {
    minMemberCount: number;
  };
  autoUpdate: {
    enabled: boolean;
    time: string;
    frequency: "daily" | "weekly" | "monthly";
  };
};

type MiokuConfig = {
  owners: string[];
  admins: string[];
  core: CoreSystemConfig;
};

type PluginStatusItem = {
  name: string;
  enabled: boolean;
  system: boolean;
  description: string;
};

type ConfigTab =
  | "owners"
  | "admins"
  | "access"
  | "system"
  | "plugins";

const emptyCoreConfig: CoreSystemConfig = {
  likeCommand: {
    enabled: true,
    keyword: "赞我",
    likeTimes: 10,
    reactionEmojiId: 201,
  },
  friend: {
    autoApprove: true,
  },
  group: {
    minMemberCount: 0,
  },
  autoUpdate: {
    enabled: true,
    time: "03:00",
    frequency: "daily",
  },
};

const tabLabels: Record<ConfigTab, string> = {
  owners: "主人配置",
  admins: "管理员配置",
  access: "访问控制",
  system: "系统功能",
  plugins: "插件管理",
};

function cloneConfig<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalizeCoreConfig(
  input?: Partial<CoreSystemConfig> | null,
): CoreSystemConfig {
  const raw = input || {};
  const validFreq = ["daily", "weekly", "monthly"].includes(
    raw.autoUpdate?.frequency || "",
  );
  const merged: CoreSystemConfig = {
    likeCommand: {
      ...emptyCoreConfig.likeCommand,
      ...(raw.likeCommand || {}),
    },
    friend: {
      ...emptyCoreConfig.friend,
      ...(raw.friend || {}),
    },
    group: {
      ...emptyCoreConfig.group,
      ...(raw.group || {}),
      minMemberCount:
        Number(raw.group?.minMemberCount) ||
        emptyCoreConfig.group.minMemberCount,
    },
    autoUpdate: {
      ...emptyCoreConfig.autoUpdate,
      ...(raw.autoUpdate || {}),
      time: raw.autoUpdate?.time || emptyCoreConfig.autoUpdate.time,
      frequency: validFreq
        ? raw.autoUpdate!.frequency
        : emptyCoreConfig.autoUpdate.frequency,
    },
  };
  return merged;
}

export function MiokuConfigPage() {
  const [miokuConfig, setMiokuConfig] = useState<MiokuConfig>({
    owners: [],
    admins: [],
    core: cloneConfig(emptyCoreConfig),
  });
  const [friendOptions, setFriendOptions] = useState<DatasourceOption[]>([]);
  const [groupOptions, setGroupOptions] = useState<DatasourceOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<ConfigTab>("owners");
  const [plugins, setPlugins] = useState<PluginStatusItem[]>([]);
  const [loadingPlugins, setLoadingPlugins] = useState(false);
  const { setLeftContent, setRightContent } = useTopbar();

  const initialConfigRef = useRef<string>("");
  const miokuConfigRef = useRef<MiokuConfig>(miokuConfig);
  const [hasChanges, setHasChanges] = useState(false);

  useUnsavedChanges(hasChanges);

  miokuConfigRef.current = miokuConfig;

  const load = async () => {
    setLoading(true);
    try {
      const [miokuRes, friendsRes, groupsRes] = await Promise.all([
        apiFetch<{ data: MiokuConfig }>("/api/config/mioku"),
        apiFetch<{ data: DatasourceOption[] }>(
          "/api/plugin-config/datasources/qq_friends",
        ),
        apiFetch<{ data: DatasourceOption[] }>(
          "/api/plugin-config/datasources/qq_groups",
        ),
      ]);
      const config = miokuRes.data || {
        owners: [],
        admins: [],
        core: cloneConfig(emptyCoreConfig),
      };
      const normalizedConfig = {
        ...config,
        owners: Array.isArray(config.owners)
          ? config.owners.map((v: string | number) => String(v))
          : [],
        admins: Array.isArray(config.admins)
          ? config.admins.map((v: string | number) => String(v))
          : [],
        core: normalizeCoreConfig(config.core),
      };
      setMiokuConfig(normalizedConfig);
      setFriendOptions(friendsRes.data || []);
      setGroupOptions(groupsRes.data || []);
      initialConfigRef.current = JSON.stringify(normalizedConfig);
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
    if (activeTab === "plugins") {
      loadPlugins();
    }
  }, [activeTab]);

  useEffect(() => {
    const current = JSON.stringify(miokuConfig);
    setHasChanges(current !== initialConfigRef.current);
  }, [miokuConfig]);

  useEffect(() => {
    const chipClass = (active: boolean) =>
      `topbar-chip whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium ${
        active
          ? "border-transparent bg-primary text-primary-foreground shadow-sm"
          : "border-transparent bg-secondary/50 text-secondary-foreground hover:bg-secondary"
      }`;

    setLeftContent(
      <div className="topbar-chip-scroll flex items-center gap-1 overflow-x-auto">
        {(Object.keys(tabLabels) as ConfigTab[]).map((tab, index) => (
          <span
            key={tab}
            className="topbar-nav-item-enter"
            style={{ animationDelay: `${index * 45}ms` }}
          >
            <button
              onClick={() => setActiveTab(tab)}
              className={chipClass(activeTab === tab)}
            >
              {tabLabels[tab]}
            </button>
          </span>
        ))}
      </div>,
    );
    return () => setLeftContent(null);
  }, [activeTab, setLeftContent]);

  const saveAll = async () => {
    const currentConfig = miokuConfigRef.current;
    setSaving(true);
    try {
      await apiFetch("/api/config/mioku", {
        method: "PUT",
        body: JSON.stringify(currentConfig),
      });
      toast.success("配置保存成功");
      initialConfigRef.current = JSON.stringify(currentConfig);
      setHasChanges(false);
    } catch {
      toast.error("保存失败");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    setRightContent(
      <Button onClick={saveAll} disabled={saving || !hasChanges} size="sm">
        <Save className="h-4 w-4 sm:mr-1" />
        <span className="hidden sm:inline">保存配置</span>
      </Button>,
    );
    return () => setRightContent(null);
  }, [saving, hasChanges, setRightContent, miokuConfig]);

  const loadPlugins = async () => {
    setLoadingPlugins(true);
    try {
      const res = await apiFetch<{ data: PluginStatusItem[] }>(
        "/api/config/plugins",
      );
      setPlugins(res.data || []);
    } catch {
      toast.error("加载插件列表失败");
    } finally {
      setLoadingPlugins(false);
    }
  };

  const togglePlugin = async (name: string, enabled: boolean) => {
    setPlugins((prev) =>
      prev.map((p) => (p.name === name ? { ...p, enabled } : p)),
    );
    try {
      await apiFetch("/api/config/plugins/toggle", {
        method: "POST",
        body: JSON.stringify({ name, enabled }),
      });
      toast.success(enabled ? `已启用 ${name}` : `已禁用 ${name}`);
    } catch {
      toast.error(`切换插件状态失败`);
      loadPlugins();
    }
  };

  const updateCoreConfig = (
    updater: (core: CoreSystemConfig) => CoreSystemConfig,
  ) => {
    setMiokuConfig((prev) => ({
      ...prev,
      core: updater(prev.core),
    }));
  };

  const addOwner = () => {
    setMiokuConfig((prev) => ({ ...prev, owners: [...prev.owners, ""] }));
  };

  const removeOwner = (index: number) => {
    setMiokuConfig((prev) => ({
      ...prev,
      owners: prev.owners.filter((_, i) => i !== index),
    }));
  };

  const updateOwner = (index: number, value: string) => {
    setMiokuConfig((prev) => ({
      ...prev,
      owners: prev.owners.map((o, i) => (i === index ? value : o)),
    }));
  };

  const addAdmin = () => {
    setMiokuConfig((prev) => ({ ...prev, admins: [...prev.admins, ""] }));
  };

  const removeAdmin = (index: number) => {
    setMiokuConfig((prev) => ({
      ...prev,
      admins: prev.admins.filter((_, i) => i !== index),
    }));
  };

  const updateAdmin = (index: number, value: string) => {
    setMiokuConfig((prev) => ({
      ...prev,
      admins: prev.admins.map((a, i) => (i === index ? value : a)),
    }));
  };

  return (
    <div className="space-y-4 animate-soft-pop">
      {loading ? (
        <Card>
          <CardContent className="py-8 text-sm text-muted-foreground">
            加载中...
          </CardContent>
        </Card>
      ) : null}

      {!loading && activeTab === "owners" && (
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
                    value={owner}
                    onChange={(e) => updateOwner(index, e.target.value)}
                    placeholder="QQ 号"
                    inputMode="numeric"
                    className="flex-1"
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

      {!loading && activeTab === "admins" && (
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
                    value={admin}
                    onChange={(e) => updateAdmin(index, e.target.value)}
                    placeholder="QQ 号"
                    inputMode="numeric"
                    className="flex-1"
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

      {!loading && activeTab === "access" && <AccessControlInline />}

      {!loading && activeTab === "plugins" && (
        <Card>
          <CardHeader>
            <CardTitle>插件管理</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingPlugins ? (
              <p className="text-sm text-muted-foreground">加载中...</p>
            ) : plugins.length === 0 ? (
              <p className="text-sm text-muted-foreground">暂无可用插件</p>
            ) : (
              <div className="space-y-1">
                {plugins.map((plugin) => (
                  <div
                    key={plugin.name}
                    className={`flex items-center justify-between gap-4 border-l-2 px-4 py-3 ${
                      plugin.enabled ? "border-primary" : "border-border"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="text-sm font-medium">
                          {plugin.name}
                        </span>
                      </div>
                      {plugin.description && (
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {plugin.description}
                        </p>
                      )}
                    </div>
                    <Switch
                      checked={plugin.enabled}
                      onCheckedChange={(checked) =>
                        togglePlugin(plugin.name, checked)
                      }
                      className="shrink-0"
                    />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!loading && activeTab === "system" && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>赞我功能</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div
                className={`border-l-2 px-4 py-1 ${
                  miokuConfig.core.likeCommand.enabled
                    ? "border-primary"
                    : "border-border"
                }`}
              >
                <label className="flex min-h-16 cursor-pointer items-center justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-sm font-medium">赞我</span>
                    <p className="text-sm text-muted-foreground">
                      开启后收到指定指令会给发送者点赞
                    </p>
                  </div>
                  <Switch
                    checked={miokuConfig.core.likeCommand.enabled}
                    onCheckedChange={(checked) =>
                      updateCoreConfig((core) => ({
                        ...core,
                        likeCommand: { ...core.likeCommand, enabled: checked },
                      }))
                    }
                    className="shrink-0"
                  />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="core-like-keyword">触发指令</Label>
                  <Input
                    id="core-like-keyword"
                    value={miokuConfig.core.likeCommand.keyword}
                    onChange={(event) =>
                      updateCoreConfig((core) => ({
                        ...core,
                        likeCommand: {
                          ...core.likeCommand,
                          keyword: event.target.value,
                        },
                      }))
                    }
                    placeholder="赞我"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="core-like-times">点赞次数</Label>
                  <NumberInput
                    id="core-like-times"
                    value={miokuConfig.core.likeCommand.likeTimes}
                    onValueChange={(value) => {
                      if (value == null) return;
                      updateCoreConfig((core) => ({
                        ...core,
                        likeCommand: { ...core.likeCommand, likeTimes: value },
                      }));
                    }}
                    placeholder="10"
                    className="[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="core-like-emoji-id">贴表情 ID</Label>
                  <NumberInput
                    id="core-like-emoji-id"
                    value={miokuConfig.core.likeCommand.reactionEmojiId}
                    onValueChange={(value) => {
                      if (value == null) return;
                      updateCoreConfig((core) => ({
                        ...core,
                        likeCommand: {
                          ...core.likeCommand,
                          reactionEmojiId: value,
                        },
                      }));
                    }}
                    placeholder="201"
                    className="[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                  <p className="text-sm text-muted-foreground">
                    默认 id 为 201
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>好友与群设置</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div
                className={`border-l-2 px-4 py-1 ${
                  miokuConfig.core.friend.autoApprove
                    ? "border-primary"
                    : "border-border"
                }`}
              >
                <label className="flex min-h-16 cursor-pointer items-center justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-sm font-medium">
                      自动通过好友申请
                    </span>
                    <p className="text-sm text-muted-foreground">
                      开启后会自动同意新的好友申请
                    </p>
                  </div>
                  <Switch
                    checked={miokuConfig.core.friend.autoApprove}
                    onCheckedChange={(checked) =>
                      updateCoreConfig((core) => ({
                        ...core,
                        friend: { ...core.friend, autoApprove: checked },
                      }))
                    }
                    className="shrink-0"
                  />
                </label>
              </div>

              <div className="space-y-2">
                <Label htmlFor="core-group-min-members">加群最低人数</Label>
                <NumberInput
                  id="core-group-min-members"
                  value={miokuConfig.core.group.minMemberCount}
                  onValueChange={(value) => {
                    if (value == null) return;
                    updateCoreConfig((core) => ({
                      ...core,
                      group: { ...core.group, minMemberCount: value },
                    }));
                  }}
                  placeholder="0"
                  className="max-w-sm [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
                <p className="text-sm text-muted-foreground">
                  机器人新进一个群时检查。填 0 表示不限制，低于阈值自动退群
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>自动更新</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div
                className={`border-l-2 px-4 py-1 ${
                  miokuConfig.core.autoUpdate.enabled
                    ? "border-primary"
                    : "border-border"
                }`}
              >
                <label className="flex min-h-16 cursor-pointer items-center justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-sm font-medium">启用自动更新</span>
                    <p className="text-sm text-muted-foreground">
                      到达设定时间后自动检查并更新全部包到最新，更新完成后自动重启
                    </p>
                  </div>
                  <Switch
                    checked={miokuConfig.core.autoUpdate.enabled}
                    onCheckedChange={(checked) =>
                      updateCoreConfig((core) => ({
                        ...core,
                        autoUpdate: { ...core.autoUpdate, enabled: checked },
                      }))
                    }
                    className="shrink-0"
                  />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="core-autoupdate-time">更新时间</Label>
                  <Input
                    id="core-autoupdate-time"
                    type="time"
                    value={miokuConfig.core.autoUpdate.time}
                    onChange={(event) =>
                      updateCoreConfig((core) => ({
                        ...core,
                        autoUpdate: {
                          ...core.autoUpdate,
                          time: event.target.value,
                        },
                      }))
                    }
                  />
                  <p className="text-sm text-muted-foreground">
                    每天到这个时间自动检查更新
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="core-autoupdate-frequency">更新频率</Label>
                  <Select
                    value={miokuConfig.core.autoUpdate.frequency}
                    onValueChange={(value) =>
                      updateCoreConfig((core) => ({
                        ...core,
                        autoUpdate: {
                          ...core.autoUpdate,
                          frequency: value as "daily" | "weekly" | "monthly",
                        },
                      }))
                    }
                  >
                    <SelectTrigger id="core-autoupdate-frequency">
                      <SelectValue placeholder="选择频率" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">每天</SelectItem>
                      <SelectItem value="weekly">每周一</SelectItem>
                      <SelectItem value="monthly">每月1号</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
