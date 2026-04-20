import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Textarea } from "@/components/ui/textarea";
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
import { Plus, Trash2, Save } from "lucide-react";
import { toast } from "sonner";
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges";
import { DatasourceMultiSelectField } from "./DatasourceMultiSelectField";
import type { DatasourceOption } from "@/features/plugin-config/DatasourcePickerDialog";

type AccessRuleConfig = {
  whitelist: string[];
  blacklist: string[];
};

type BootSystemConfig = {
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
    welcome: {
      enabled: boolean;
      mode: "ai" | "text";
      text: string;
      aiPrompt: string;
    };
  };
  messageFilter: {
    user: AccessRuleConfig;
    group: AccessRuleConfig;
  };
};

type MiokuConfig = {
  owners: number[];
  admins: number[];
  napcat: NapCatConfig[];
  plugins: string[];
  boot: BootSystemConfig;
};

type NapCatConfig = {
  name: string;
  protocol: string;
  port: number;
  host: string;
  token: string;
};

type ConfigTab = "owners" | "admins" | "napcat" | "plugins" | "system";

const emptyBootConfig: BootSystemConfig = {
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
    welcome: {
      enabled: true,
      mode: "ai",
      text: "欢迎新人～",
      aiPrompt: "",
    },
  },
  messageFilter: {
    user: {
      whitelist: [],
      blacklist: [],
    },
    group: {
      whitelist: [],
      blacklist: [],
    },
  },
};

const tabLabels: Record<ConfigTab, string> = {
  owners: "主人配置",
  admins: "管理员配置",
  napcat: "Onebot配置",
  plugins: "插件开关",
  system: "系统功能",
};

function cloneConfig<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalizeBootConfig(
  input?: Partial<BootSystemConfig> | null,
): BootSystemConfig {
  const raw = input || {};
  const userFilterSource =
    raw?.messageFilter?.user || (raw as any)?.messageFilter?.private;
  return {
    likeCommand: {
      ...emptyBootConfig.likeCommand,
      ...(raw.likeCommand || {}),
    },
    friend: {
      ...emptyBootConfig.friend,
      ...(raw.friend || {}),
    },
    group: {
      ...emptyBootConfig.group,
      ...(raw.group || {}),
      welcome: {
        ...emptyBootConfig.group.welcome,
        ...(raw.group?.welcome || {}),
      },
    },
    messageFilter: {
      user: {
        ...emptyBootConfig.messageFilter.user,
        ...(userFilterSource || {}),
      },
      group: {
        ...emptyBootConfig.messageFilter.group,
        ...(raw.messageFilter?.group || {}),
      },
    },
  };
}

export function MiokuConfigPage() {
  const [miokuConfig, setMiokuConfig] = useState<MiokuConfig>({
    owners: [],
    admins: [],
    napcat: [],
    plugins: [],
    boot: cloneConfig(emptyBootConfig),
  });
  const [availablePlugins, setAvailablePlugins] = useState<string[]>([]);
  const [friendOptions, setFriendOptions] = useState<DatasourceOption[]>([]);
  const [groupOptions, setGroupOptions] = useState<DatasourceOption[]>([]);
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
      const [miokuRes, pluginsRes, friendsRes, groupsRes] = await Promise.all([
        apiFetch<{ data: MiokuConfig }>("/api/config/mioku"),
        apiFetch<{ data: string[] }>("/api/config/plugins/available"),
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
        napcat: [],
        plugins: [],
        boot: cloneConfig(emptyBootConfig),
      };
      const normalizedConfig = {
        ...config,
        boot: normalizeBootConfig(config.boot),
      };
      setMiokuConfig(normalizedConfig);
      setAvailablePlugins(pluginsRes.data || []);
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
      await apiFetch("/api/config/mioku", {
        method: "PUT",
        body: JSON.stringify(miokuConfig),
      });
      toast.success("配置保存成功");
      initialConfigRef.current = JSON.stringify(miokuConfig);
      setHasChanges(false);
    } catch {
      toast.error("保存失败");
    } finally {
      setSaving(false);
    }
  };

  const updateBootConfig = (
    updater: (boot: BootSystemConfig) => BootSystemConfig,
  ) => {
    setMiokuConfig((prev) => ({
      ...prev,
      boot: updater(prev.boot),
    }));
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
                  <NumberInput
                    value={owner || null}
                    onValueChange={(value) => {
                      if (value !== null) updateOwner(index, value);
                    }}
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
                  <NumberInput
                    value={admin || null}
                    onValueChange={(value) => {
                      if (value !== null) updateAdmin(index, value);
                    }}
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

      {!loading && activeTab === "napcat" && (
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
                    <Select
                      value={napcat.protocol}
                      onValueChange={(value) =>
                        updateNapCat(index, "protocol", value)
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="选择协议" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ws">ws</SelectItem>
                        <SelectItem value="wss">wss</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      value={napcat.host}
                      onChange={(e) =>
                        updateNapCat(index, "host", e.target.value)
                      }
                      placeholder="主机地址"
                    />
                    <NumberInput
                      value={napcat.port}
                      onValueChange={(value) => {
                        if (value !== null) updateNapCat(index, "port", value);
                      }}
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

      {!loading && activeTab === "plugins" && (
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

      {!loading && activeTab === "system" && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>赞我功能</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between rounded-xl border p-4">
                <div className="space-y-1">
                  <Label className="text-sm font-medium">赞我</Label>
                  <p className="text-sm text-muted-foreground">
                    开启后收到指定指令会给发送者点赞
                  </p>
                </div>
                <Switch
                  checked={miokuConfig.boot.likeCommand.enabled}
                  onCheckedChange={(checked) =>
                    updateBootConfig((boot) => ({
                      ...boot,
                      likeCommand: { ...boot.likeCommand, enabled: checked },
                    }))
                  }
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="boot-like-keyword">触发指令</Label>
                  <Input
                    id="boot-like-keyword"
                    value={miokuConfig.boot.likeCommand.keyword}
                    onChange={(event) =>
                      updateBootConfig((boot) => ({
                        ...boot,
                        likeCommand: {
                          ...boot.likeCommand,
                          keyword: event.target.value,
                        },
                      }))
                    }
                    placeholder="赞我"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="boot-like-times">点赞次数</Label>
                  <NumberInput
                    id="boot-like-times"
                    value={miokuConfig.boot.likeCommand.likeTimes}
                    onValueChange={(value) => {
                      if (value == null) return;
                      updateBootConfig((boot) => ({
                        ...boot,
                        likeCommand: { ...boot.likeCommand, likeTimes: value },
                      }));
                    }}
                    placeholder="10"
                    className="[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="boot-like-emoji-id">贴表情 ID</Label>
                  <NumberInput
                    id="boot-like-emoji-id"
                    value={miokuConfig.boot.likeCommand.reactionEmojiId}
                    onValueChange={(value) => {
                      if (value == null) return;
                      updateBootConfig((boot) => ({
                        ...boot,
                        likeCommand: {
                          ...boot.likeCommand,
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
              <div className="flex items-center justify-between rounded-xl border p-4">
                <div className="space-y-1">
                  <Label className="text-sm font-medium">
                    自动通过好友申请
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    开启后会自动同意新的好友申请
                  </p>
                </div>
                <Switch
                  checked={miokuConfig.boot.friend.autoApprove}
                  onCheckedChange={(checked) =>
                    updateBootConfig((boot) => ({
                      ...boot,
                      friend: { ...boot.friend, autoApprove: checked },
                    }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="boot-group-min-members">加群最低人数</Label>
                <NumberInput
                  id="boot-group-min-members"
                  value={miokuConfig.boot.group.minMemberCount}
                  onValueChange={(value) => {
                    if (value == null) return;
                    updateBootConfig((boot) => ({
                      ...boot,
                      group: { ...boot.group, minMemberCount: value },
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
              <CardTitle>消息白名单与黑名单</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <p className="text-sm text-muted-foreground">
                某一类配置了白名单后，该类黑名单自动失效，主人和管理员不受这些名单限制。
              </p>

              <DatasourceMultiSelectField
                id="boot-user-whitelist"
                label="用户白名单"
                description="只有这些人可以用"
                placeholder="点击选择用户"
                source="qq_friends"
                options={friendOptions}
                value={miokuConfig.boot.messageFilter.user.whitelist}
                onChange={(value) =>
                  updateBootConfig((boot) => ({
                    ...boot,
                    messageFilter: {
                      ...boot.messageFilter,
                      user: { ...boot.messageFilter.user, whitelist: value },
                    },
                  }))
                }
              />

              <DatasourceMultiSelectField
                id="boot-user-blacklist"
                label="用户黑名单"
                description="这些人不能使用"
                placeholder="点击选择用户"
                source="qq_friends"
                options={friendOptions}
                value={miokuConfig.boot.messageFilter.user.blacklist}
                onChange={(value) =>
                  updateBootConfig((boot) => ({
                    ...boot,
                    messageFilter: {
                      ...boot.messageFilter,
                      user: { ...boot.messageFilter.user, blacklist: value },
                    },
                  }))
                }
              />

              <DatasourceMultiSelectField
                id="boot-group-whitelist"
                label="群聊白名单"
                description="只有这些群可以用"
                placeholder="点击选择群聊"
                source="qq_groups"
                options={groupOptions}
                value={miokuConfig.boot.messageFilter.group.whitelist}
                onChange={(value) =>
                  updateBootConfig((boot) => ({
                    ...boot,
                    messageFilter: {
                      ...boot.messageFilter,
                      group: { ...boot.messageFilter.group, whitelist: value },
                    },
                  }))
                }
              />

              <DatasourceMultiSelectField
                id="boot-group-blacklist"
                label="群聊黑名单"
                description="这些群不能用"
                placeholder="点击选择群聊"
                source="qq_groups"
                options={groupOptions}
                value={miokuConfig.boot.messageFilter.group.blacklist}
                onChange={(value) =>
                  updateBootConfig((boot) => ({
                    ...boot,
                    messageFilter: {
                      ...boot.messageFilter,
                      group: { ...boot.messageFilter.group, blacklist: value },
                    },
                  }))
                }
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>新人入群欢迎</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between rounded-xl border p-4">
                <div className="space-y-1">
                  <Label className="text-sm font-medium">启用入群欢迎</Label>
                  <p className="text-sm text-muted-foreground">
                    有新人入群时发送欢迎消息
                  </p>
                </div>
                <Switch
                  checked={miokuConfig.boot.group.welcome.enabled}
                  onCheckedChange={(checked) =>
                    updateBootConfig((boot) => ({
                      ...boot,
                      group: {
                        ...boot.group,
                        welcome: { ...boot.group.welcome, enabled: checked },
                      },
                    }))
                  }
                />
              </div>

              <div className="space-y-2 max-w-sm">
                <Label htmlFor="boot-welcome-mode">欢迎模式</Label>
                <Select
                  value={miokuConfig.boot.group.welcome.mode}
                  onValueChange={(value: "ai" | "text") =>
                    updateBootConfig((boot) => ({
                      ...boot,
                      group: {
                        ...boot.group,
                        welcome: { ...boot.group.welcome, mode: value },
                      },
                    }))
                  }
                >
                  <SelectTrigger id="boot-welcome-mode">
                    <SelectValue placeholder="选择欢迎模式" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ai">使用AI生成</SelectItem>
                    <SelectItem value="text">固定文本</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="boot-welcome-text">固定欢迎文本</Label>
                <Textarea
                  id="boot-welcome-text"
                  value={miokuConfig.boot.group.welcome.text}
                  onChange={(event) =>
                    updateBootConfig((boot) => ({
                      ...boot,
                      group: {
                        ...boot.group,
                        welcome: {
                          ...boot.group.welcome,
                          text: event.target.value,
                        },
                      },
                    }))
                  }
                  placeholder="欢迎新人～"
                  className="min-h-28"
                />
                <p className="text-sm text-muted-foreground">
                  支持 <code>{"{user}"}</code> 和 <code>{"{group}"}</code>{" "}
                  占位符。
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="boot-welcome-ai-prompt">AI欢迎额外提示词</Label>
                <Textarea
                  id="boot-welcome-ai-prompt"
                  value={miokuConfig.boot.group.welcome.aiPrompt}
                  onChange={(event) =>
                    updateBootConfig((boot) => ({
                      ...boot,
                      group: {
                        ...boot.group,
                        welcome: {
                          ...boot.group.welcome,
                          aiPrompt: event.target.value,
                        },
                      },
                    }))
                  }
                  placeholder="例如：提醒新成员查看群公告"
                  className="min-h-28"
                />
                <p className="text-sm text-muted-foreground">
                  作为额外要求传给模型，默认留空即可
                </p>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
