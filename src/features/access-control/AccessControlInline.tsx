import { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Save,
  Loader2,
  Shield,
  X,
  Plus,
  Globe,
  Users,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { useTopbar } from "@/components/layout/TopbarContext";
import { DatasourceMultiSelectField } from "@/features/mioku/DatasourceMultiSelectField";
import { AccessCatalogPickerDialog } from "./AccessCatalogPickerDialog";
import {
  resolveDatasourceOption,
  type DatasourceOption,
} from "@/features/plugin-config/datasource-utils";

type AccessAction = "allow" | "block";

type AccessScopeConfig = {
  plugins?: Record<string, { action: AccessAction }>;
  commands?: Record<string, Record<string, { action: AccessAction }>>;
};

type AccessControlConfig = {
  version: 1;
  global: AccessScopeConfig;
  groups: Record<string, AccessScopeConfig>;
  users: Record<string, AccessScopeConfig>;
};

const EMPTY_CONFIG: AccessControlConfig = {
  version: 1,
  global: { plugins: {}, commands: {} },
  groups: {},
  users: {},
};

type AccessTargetKey = string;

type AccessItemKind = "plugin" | "command";

type AccessItem = {
  kind: AccessItemKind;
  plugin: string;
  id: string;
  label: string;
  desc?: string;
  match?: string;
  event?: string;
  fromHook: boolean;
};

const itemKey = (
  it: AccessItem | { kind: AccessItemKind; plugin: string; id: string },
) => `${it.kind}:${it.plugin}:${it.id}`;

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

function parseKey(key: AccessTargetKey): {
  kind: AccessItemKind;
  plugin: string;
  id: string;
} {
  const [kind, plugin, ...rest] = key.split(":");
  return {
    kind: (kind as AccessItemKind) || "plugin",
    plugin,
    id: rest.join(":"),
  };
}

function makeEmptyScope(): AccessScopeConfig {
  return { plugins: {}, commands: {} };
}

export function AccessControlInline() {
  const { setRightContent } = useTopbar();
  const [config, setConfig] = useState<AccessControlConfig>(EMPTY_CONFIG);
  const [original, setOriginal] = useState<AccessControlConfig>(EMPTY_CONFIG);
  const [friendOptions, setFriendOptions] = useState<DatasourceOption[]>([]);
  const [groupOptions, setGroupOptions] = useState<DatasourceOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [catalogByKey, setCatalogByKey] = useState<Map<string, AccessItem>>(
    new Map(),
  );

  const isDirty = JSON.stringify(config) !== JSON.stringify(original);

  const configRef = useRef(config);
  useEffect(() => {
    configRef.current = config;
  }, [config]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cfgRes, friendsRes, groupsRes, catalogRes] = await Promise.all([
        apiFetch<{ ok: boolean; data: AccessControlConfig }>(
          "/api/access-control",
        ),
        apiFetch<{ ok: boolean; data: DatasourceOption[] }>(
          "/api/plugin-config/datasources/qq_friends",
        ).catch(() => ({ ok: true, data: [] as DatasourceOption[] })),
        apiFetch<{ ok: boolean; data: DatasourceOption[] }>(
          "/api/plugin-config/datasources/qq_groups",
        ).catch(() => ({ ok: true, data: [] as DatasourceOption[] })),
        apiFetch<{ ok: boolean; data: AccessItem[] }>(
          "/api/access-control/catalog",
        ),
      ]);
      const normalized: AccessControlConfig = {
        ...EMPTY_CONFIG,
        ...cfgRes.data,
        global: { ...makeEmptyScope(), ...(cfgRes.data.global || {}) },
        groups: cfgRes.data.groups || {},
        users: cfgRes.data.users || {},
      };
      setConfig(normalized);
      setOriginal(clone(normalized));
      setFriendOptions(friendsRes.data || []);
      setGroupOptions(groupsRes.data || []);
      const map = new Map<string, AccessItem>();
      for (const it of catalogRes.data || []) map.set(itemKey(it), it);
      setCatalogByKey(map);
    } catch (err) {
      toast.error("加载访问控制配置失败: " + String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await apiFetch<{ ok: boolean; data: AccessControlConfig }>(
        "/api/access-control",
        { method: "PUT", body: JSON.stringify(configRef.current) },
      );
      setConfig(res.data);
      setOriginal(clone(res.data));
      toast.success("访问控制已保存");
    } catch (err) {
      toast.error("保存失败: " + String(err));
    } finally {
      setSaving(false);
    }
  };

  // 把保存按钮挂到浮动导航上;卸载时清掉,避免污染其他 tab
  useEffect(() => {
    setRightContent(
      <Button
        onClick={save}
        disabled={!isDirty || saving}
        size="sm"
        className="gap-1"
      >
        {saving ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Save className="h-4 w-4" />
        )}
        <span className="hidden sm:inline">保存配置</span>
      </Button>,
    );
    return () => setRightContent(null);
  }, [isDirty, saving]); // eslint-disable-line react-hooks/exhaustive-deps

  const setGlobal = (next: AccessScopeConfig) =>
    setConfig((c) => ({ ...c, global: next }));
  const setGroupScope = (groupId: string, next: AccessScopeConfig) =>
    setConfig((c) => ({ ...c, groups: { ...c.groups, [groupId]: next } }));
  const setUserScope = (userId: string, next: AccessScopeConfig) =>
    setConfig((c) => ({ ...c, users: { ...c.users, [userId]: next } }));

  const addItemToScope = (
    scope: AccessScopeConfig,
    key: AccessTargetKey,
    action: AccessAction,
  ): AccessScopeConfig => {
    const { kind, plugin, id } = parseKey(key);
    if (kind === "plugin") {
      // 已存在同 plugin 的规则时不覆盖,避免白/黑名单互相污染
      if (scope.plugins?.[plugin]) return scope;
      return {
        ...scope,
        plugins: { ...(scope.plugins || {}), [plugin]: { action } },
      };
    }
    if (scope.commands?.[plugin]?.[id]) return scope;
    const cmds = { ...(scope.commands || {}) };
    cmds[plugin] = { ...(cmds[plugin] || {}), [id]: { action } };
    return { ...scope, commands: cmds };
  };

  const removeItemFromScope = (
    scope: AccessScopeConfig,
    key: AccessTargetKey,
  ): AccessScopeConfig => {
    const { kind, plugin, id } = parseKey(key);
    if (kind === "plugin") {
      const next = { ...(scope.plugins || {}) };
      delete next[plugin];
      return { ...scope, plugins: next };
    }
    const cmds = { ...(scope.commands || {}) };
    if (cmds[plugin]) {
      const next = { ...cmds[plugin] };
      delete next[id];
      if (Object.keys(next).length === 0) delete cmds[plugin];
      else cmds[plugin] = next;
    }
    return { ...scope, commands: cmds };
  };

  const listScopeKeys = (scope: AccessScopeConfig): AccessTargetKey[] => {
    const out: AccessTargetKey[] = [];
    for (const p of Object.keys(scope.plugins || {})) {
      out.push(itemKey({ kind: "plugin", plugin: p, id: p }));
    }
    for (const p of Object.keys(scope.commands || {})) {
      for (const c of Object.keys(scope.commands![p] || {})) {
        out.push(itemKey({ kind: "command", plugin: p, id: c }));
      }
    }
    return out;
  };

  const getActionOfKey = (
    scope: AccessScopeConfig,
    key: AccessTargetKey,
  ): AccessAction | undefined => {
    const { kind, plugin, id } = parseKey(key);
    if (kind === "plugin") return scope.plugins?.[plugin]?.action;
    return scope.commands?.[plugin]?.[id]?.action;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-10 text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 加载中...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card/60 px-4 py-3 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" />
          访问控制:未匹配规则时一律放行,主人/管理员始终不受限制
        </div>
      </div>

      <ScopeBlock
        icon={<Globe className="h-4 w-4" />}
        title="全局"
        description="对所有人/全部群生效"
        scope={config.global}
        catalogByKey={catalogByKey}
        onAdd={(key, action) =>
          setGlobal(addItemToScope(config.global, key, action))
        }
        onUpdate={setGlobal}
        onRemove={(key) => setGlobal(removeItemFromScope(config.global, key))}
        onToggle={(key, action) =>
          setGlobal(addItemToScope(config.global, key, action))
        }
        getAction={(key) => getActionOfKey(config.global, key)}
        listKeys={() => listScopeKeys(config.global)}
      />

      <ScopeMultiEditor
        icon={<Users className="h-4 w-4" />}
        title="群聊"
        description="针对单个 QQ 群聊的访问控制,可多选"
        scopeType="group"
        scopeIds={Object.keys(config.groups)}
        scopeConfigs={config.groups}
        catalogByKey={catalogByKey}
        options={groupOptions}
        onAddScope={(id) =>
          setConfig((c) => ({
            ...c,
            groups: { ...c.groups, [id]: makeEmptyScope() },
          }))
        }
        onRemoveScope={(id) => {
          setConfig((c) => {
            const next = { ...c.groups };
            delete next[id];
            return { ...c, groups: next };
          });
        }}
        onUpdateScope={(id, scope) => setGroupScope(id, scope)}
      />

      <ScopeMultiEditor
        icon={<User className="h-4 w-4" />}
        title="用户"
        description="针对单个 QQ 用户的访问控制,可多选"
        scopeType="user"
        scopeIds={Object.keys(config.users)}
        scopeConfigs={config.users}
        catalogByKey={catalogByKey}
        options={friendOptions}
        onAddScope={(id) =>
          setConfig((c) => ({
            ...c,
            users: { ...c.users, [id]: makeEmptyScope() },
          }))
        }
        onRemoveScope={(id) => {
          setConfig((c) => {
            const next = { ...c.users };
            delete next[id];
            return { ...c, users: next };
          });
        }}
        onUpdateScope={(id, scope) => setUserScope(id, scope)}
      />
    </div>
  );
}

function ScopeBlock(props: {
  icon: React.ReactNode;
  title: string;
  description: string;
  scope: AccessScopeConfig;
  catalogByKey: Map<string, AccessItem>;
  onAdd: (key: string, action: AccessAction) => void;
  onUpdate: (next: AccessScopeConfig) => void;
  onRemove: (key: string) => void;
  onToggle: (key: string, action: AccessAction) => void;
  getAction: (key: string) => AccessAction | undefined;
  listKeys: () => string[];
}) {
  const [pickerMode, setPickerMode] = useState<"allow" | "block" | null>(null);
  const keys = props.listKeys();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {props.icon}
          {props.title}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{props.description}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPickerMode("allow")}
            className="gap-1"
          >
            <Plus className="h-3 w-3" /> 添加白名单
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPickerMode("block")}
            className="gap-1"
          >
            <Plus className="h-3 w-3" /> 添加黑名单
          </Button>
        </div>

        {keys.length === 0 ? (
          <p className="text-sm text-muted-foreground">还没有任何规则</p>
        ) : (
          <div className="space-y-1.5">
            {keys.map((key) => (
              <EntryRow
                key={key}
                itemKey={key}
                action={props.getAction(key)}
                catalogByKey={props.catalogByKey}
                onToggle={(action) => props.onToggle(key, action)}
                onRemove={() => props.onRemove(key)}
              />
            ))}
          </div>
        )}
      </CardContent>

      <AccessCatalogPickerDialog
        open={pickerMode !== null}
        title={
          pickerMode === "block"
            ? "选择要禁用的插件/命令"
            : "选择要允许的插件/命令"
        }
        existingKeys={keys}
        onClose={() => setPickerMode(null)}
        onChange={(picked) => {
          const action: AccessAction =
            pickerMode === "block" ? "block" : "allow";
          let next = props.scope;
          for (const k of picked) {
            const { kind, plugin, id } = parseKey(k);
            if (kind === "plugin") {
              next = {
                ...next,
                plugins: { ...(next.plugins || {}), [plugin]: { action } },
              };
            } else {
              const cmds = { ...(next.commands || {}) };
              cmds[plugin] = { ...(cmds[plugin] || {}), [id]: { action } };
              next = { ...next, commands: cmds };
            }
          }
          props.onUpdate(next);
        }}
      />
    </Card>
  );
}

function ScopeMultiEditor(props: {
  icon: React.ReactNode;
  title: string;
  description: string;
  scopeType: "user" | "group";
  scopeIds: string[];
  scopeConfigs: Record<string, AccessScopeConfig>;
  catalogByKey: Map<string, AccessItem>;
  options: DatasourceOption[];
  onAddScope: (id: string) => void;
  onRemoveScope: (id: string) => void;
  onUpdateScope: (id: string, next: AccessScopeConfig) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {props.icon}
          {props.title}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{props.description}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <DatasourceMultiSelectField
          id={`access-${props.scopeType}-picker`}
          label={`选择${props.scopeType === "user" ? "用户" : "群聊"}`}
          placeholder={`点击选择${props.scopeType === "user" ? "用户" : "群聊"}`}
          source={props.scopeType === "user" ? "qq_friends" : "qq_groups"}
          options={props.options}
          value={props.scopeIds}
          onChange={(ids) => {
            const existing = new Set(props.scopeIds);
            for (const id of ids) {
              if (!existing.has(String(id))) props.onAddScope(String(id));
            }
            const wanted = new Set(ids.map(String));
            for (const id of props.scopeIds) {
              if (!wanted.has(id)) props.onRemoveScope(id);
            }
          }}
        />

        {props.scopeIds.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            尚未选择任何{props.scopeType === "user" ? "用户" : "群聊"}
          </p>
        ) : (
          props.scopeIds.map((id) => (
            <SingleScopeCard
              key={id}
              scopeId={id}
              scopeType={props.scopeType}
              scope={props.scopeConfigs[id] || makeEmptyScope()}
              catalogByKey={props.catalogByKey}
              options={props.options}
              onUpdate={(next) => props.onUpdateScope(id, next)}
              onRemove={() => props.onRemoveScope(id)}
            />
          ))
        )}
      </CardContent>
    </Card>
  );
}

function SingleScopeCard(props: {
  scopeId: string;
  scopeType: "user" | "group";
  scope: AccessScopeConfig;
  catalogByKey: Map<string, AccessItem>;
  options: DatasourceOption[];
  onUpdate: (next: AccessScopeConfig) => void;
  onRemove: () => void;
}) {
  const [pickerMode, setPickerMode] = useState<"allow" | "block" | null>(null);
  const resolved = resolveDatasourceOption(
    props.scopeId,
    props.options,
    props.scopeType === "user" ? "qq_friends" : "qq_groups",
  );
  const displayName =
    resolved?.label && resolved.label !== resolved.value
      ? resolved.label
      : null;
  const isUser = props.scopeType === "user";
  const listKeys = (scope: AccessScopeConfig): string[] => {
    const out: string[] = [];
    for (const p of Object.keys(scope.plugins || {})) {
      out.push(itemKey({ kind: "plugin", plugin: p, id: p }));
    }
    for (const p of Object.keys(scope.commands || {})) {
      for (const c of Object.keys(scope.commands![p] || {})) {
        out.push(itemKey({ kind: "command", plugin: p, id: c }));
      }
    }
    return out;
  };
  const keys = listKeys(props.scope);

  const getAction = (key: string): AccessAction | undefined => {
    const { kind, plugin, id } = parseKey(key);
    if (kind === "plugin") return props.scope.plugins?.[plugin]?.action;
    return props.scope.commands?.[plugin]?.[id]?.action;
  };

  return (
    <div className="rounded-xl border bg-card/50 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex min-w-0 items-center gap-2">
          {resolved?.meta?.avatarUrl ? (
            <img
              src={String(resolved.meta.avatarUrl)}
              alt={displayName || props.scopeId}
              className="h-6 w-6 shrink-0 rounded-full bg-secondary object-cover"
            />
          ) : null}
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">
              {displayName ||
                (isUser ? `用户 ${props.scopeId}` : `群 ${props.scopeId}`)}
            </div>
            <div className="truncate text-[11px] text-muted-foreground">
              {isUser ? "QQ" : "群号"} {props.scopeId}
            </div>
          </div>
        </div>
        <Button size="sm" variant="ghost" onClick={props.onRemove}>
          <X className="h-3 w-3" /> 移除
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setPickerMode("allow")}
          className="gap-1"
        >
          <Plus className="h-3 w-3" /> 添加白名单
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setPickerMode("block")}
          className="gap-1"
        >
          <Plus className="h-3 w-3" /> 添加黑名单
        </Button>
      </div>
      {keys.length === 0 ? (
        <p className="text-xs text-muted-foreground">该作用域下还没有规则</p>
      ) : (
        <div className="space-y-1.5">
          {keys.map((key) => (
            <EntryRow
              key={key}
              itemKey={key}
              action={getAction(key)}
              catalogByKey={props.catalogByKey}
              onToggle={(action) => {
                const { kind, plugin, id } = parseKey(key);
                if (kind === "plugin") {
                  props.onUpdate({
                    ...props.scope,
                    plugins: {
                      ...(props.scope.plugins || {}),
                      [plugin]: { action },
                    },
                  });
                } else {
                  const cmds = { ...(props.scope.commands || {}) };
                  cmds[plugin] = { ...(cmds[plugin] || {}), [id]: { action } };
                  props.onUpdate({ ...props.scope, commands: cmds });
                }
              }}
              onRemove={() => {
                const { kind, plugin, id } = parseKey(key);
                if (kind === "plugin") {
                  const next = { ...(props.scope.plugins || {}) };
                  delete next[plugin];
                  props.onUpdate({ ...props.scope, plugins: next });
                } else {
                  const cmds = { ...(props.scope.commands || {}) };
                  if (cmds[plugin]) {
                    const next = { ...cmds[plugin] };
                    delete next[id];
                    if (Object.keys(next).length === 0) delete cmds[plugin];
                    else cmds[plugin] = next;
                  }
                  props.onUpdate({ ...props.scope, commands: cmds });
                }
              }}
            />
          ))}
        </div>
      )}

      <AccessCatalogPickerDialog
        open={pickerMode !== null}
        title={
          pickerMode === "block"
            ? "选择要禁用的插件/命令"
            : "选择要允许的插件/命令"
        }
        existingKeys={keys}
        onClose={() => setPickerMode(null)}
        onChange={(picked) => {
          const action: AccessAction =
            pickerMode === "block" ? "block" : "allow";
          let next = props.scope;
          for (const k of picked) {
            const { kind, plugin, id } = parseKey(k);
            if (kind === "plugin") {
              next = {
                ...next,
                plugins: { ...(next.plugins || {}), [plugin]: { action } },
              };
            } else {
              const cmds = { ...(next.commands || {}) };
              cmds[plugin] = { ...(cmds[plugin] || {}), [id]: { action } };
              next = { ...next, commands: cmds };
            }
          }
          props.onUpdate(next);
        }}
      />
    </div>
  );
}

function EntryRow(props: {
  itemKey: string;
  action: AccessAction | undefined;
  catalogByKey: Map<string, AccessItem>;
  onToggle: (action: AccessAction) => void;
  onRemove: () => void;
}) {
  const { kind, plugin, id } = parseKey(props.itemKey);
  const info = props.catalogByKey.get(props.itemKey);
  const isPlugin = kind === "plugin";
  const label = isPlugin ? info?.label || plugin : id;
  return (
    <div className="flex items-center justify-between rounded-lg border bg-card px-3 py-2 text-sm">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={isPlugin ? "font-medium" : "font-mono text-xs"}>
            {label}
          </span>
          {!isPlugin ? (
            <span className="text-xs text-muted-foreground">· {plugin}</span>
          ) : null}
          <span
            className={
              props.action === "block"
                ? "rounded bg-rose-500/15 px-1.5 text-[10px] text-rose-700 dark:text-rose-300"
                : props.action === "allow"
                  ? "rounded bg-emerald-500/15 px-1.5 text-[10px] text-emerald-700 dark:text-emerald-300"
                  : "rounded bg-muted px-1.5 text-[10px] text-muted-foreground"
            }
          >
            {props.action === "block"
              ? "黑名单"
              : props.action === "allow"
                ? "白名单"
                : "未设置"}
          </span>
        </div>
        {info?.desc ? (
          <div className="mt-0.5 truncate text-xs text-muted-foreground">
            {info.desc}
          </div>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button
          size="sm"
          variant={props.action === "allow" ? "default" : "outline"}
          onClick={() => props.onToggle("allow")}
        >
          允许
        </Button>
        <Button
          size="sm"
          variant={props.action === "block" ? "destructive" : "outline"}
          onClick={() => props.onToggle("block")}
        >
          禁用
        </Button>
        <Button size="sm" variant="ghost" onClick={props.onRemove}>
          <X className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
