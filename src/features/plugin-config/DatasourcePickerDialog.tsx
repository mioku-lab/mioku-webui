import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Search, Users, UserRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface DatasourceOption {
  value: string;
  label: string;
  description?: string;
  meta?: {
    avatarUrl?: string;
    qq?: string;
    nickname?: string;
    remark?: string;
    groupId?: string;
    groupName?: string;
    memberCount?: number;
    searchText?: string;
    isCustom?: boolean;
    [key: string]: unknown;
  };
}

interface DatasourcePickerDialogProps {
  open: boolean;
  title: string;
  source?: string;
  options: DatasourceOption[];
  multiple?: boolean;
  value: string | string[] | null | undefined;
  onClose: () => void;
  onChange: (value: string | string[]) => void;
}

function normalizeText(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function matchesQuery(option: DatasourceOption, query: string): boolean {
  const q = normalizeText(query);
  if (!q) {
    return true;
  }

  const haystacks = [
    option.label,
    option.value,
    option.description,
    option.meta?.searchText,
    option.meta?.qq,
    option.meta?.nickname,
    option.meta?.remark,
    option.meta?.groupId,
    option.meta?.groupName,
  ]
    .map((item) => normalizeText(item))
    .filter(Boolean);

  return haystacks.some((item) => item.includes(q));
}

function getDialogTitle(source?: string, title?: string): string {
  if (title) {
    return title;
  }
  if (source === "qq_groups") {
    return "选择群聊";
  }
  if (source === "qq_friends") {
    return "选择好友";
  }
  return "选择项目";
}

function getDialogSearchPlaceholder(source?: string): string {
  if (source === "qq_groups") {
    return "输入群名称或群号搜索";
  }
  if (source === "qq_friends") {
    return "输入昵称、备注或 QQ 号搜索";
  }
  return "输入关键词搜索";
}

function getDialogEmptyText(source?: string): string {
  if (source === "qq_groups") {
    return "当前没有可选群聊";
  }
  if (source === "qq_friends") {
    return "当前没有可选好友";
  }
  return "当前没有可选项";
}

function getSelection(values: string | string[] | null | undefined): string[] {
  if (Array.isArray(values)) {
    return values.map((item) => String(item));
  }
  if (values == null || values === "") {
    return [];
  }
  return [String(values)];
}

function getAvatarFallback(source?: string) {
  return source === "qq_groups" ? Users : UserRound;
}

const NICKNAME_FETCH_DEBOUNCE_MS = 350;

function useDebouncedNickname(
  userId: string | null,
  source: string | undefined,
  enabled: boolean,
): { nickname: string | null; loading: boolean } {
  const [nickname, setNickname] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const lastRequestedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || !userId) {
      setNickname(null);
      setLoading(false);
      return;
    }

    setNickname(null);
    setLoading(true);
    lastRequestedRef.current = userId;

    const timer = setTimeout(async () => {
      if (source !== "qq_friends") {
        // 仅对好友号码异步拉昵称，群号不拉。
        setLoading(false);
        return;
      }
      try {
        const res = await fetch("/api/stranger/info", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: userId }),
        });
        if (lastRequestedRef.current !== userId) return;
        if (res.ok) {
          const data = await res.json().catch(() => null);
          const nick = data?.data?.nickname;
          if (typeof nick === "string" && nick.trim()) {
            setNickname(nick.trim());
          }
        }
      } catch {
        // 接口失败时静默，仍展示号码占位
      } finally {
        if (lastRequestedRef.current === userId) setLoading(false);
      }
    }, NICKNAME_FETCH_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [userId, source, enabled]);

  return { nickname, loading };
}

function isPureQQNumber(query: string): boolean {
  const trimmed = query.trim();
  // QQ 号码 / 群号通常为 5-12 位纯数字
  return /^\d{5,12}$/.test(trimmed);
}

/**
 * 构造一个“手动添加”的 QQ/群号条目。
 * 当用户搜索的号码不在当前列表中（既不是好友也不是已加群）时，
 * 用 QQ 服务器的头像地址 + 号码本身作为昵称生成一个临时条目，
 * 选中后直接把该号码写入配置。
 */
export function buildCustomOption(
  id: string,
  source?: string,
): DatasourceOption {
  const value = id.trim();
  if (source === "qq_groups") {
    return {
      value,
      label: value,
      description: `群号 ${value}`,
      meta: {
        type: "qq_group_custom",
        groupId: value,
        groupName: value,
        avatarUrl: `https://p.qlogo.cn/gh/${encodeURIComponent(value)}/${encodeURIComponent(value)}/100`,
        searchText: value,
        isCustom: true,
      },
    };
  }
  return {
    value,
    label: value,
    description: `QQ ${value}`,
    meta: {
      type: "qq_friend_custom",
      qq: value,
      nickname: value,
      avatarUrl: `https://q1.qlogo.cn/g?b=qq&nk=${encodeURIComponent(value)}&s=100`,
      searchText: value,
      isCustom: true,
    },
  };
}

/**
 * 解析已选中的值：当某个值不在 `options` 中（说明它是手动添加的），
 * 用 `buildCustomOption` 生成一个用于展示的条目。
 */
export function resolveDatasourceOption(
  value: string,
  options: DatasourceOption[],
  source?: string,
): DatasourceOption | null {
  const found = options.find((option) => option.value === String(value));
  if (found) return found;
  if (isPureQQNumber(value)) {
    return buildCustomOption(value, source);
  }
  return null;
}

interface CustomOptionCardProps {
  option: DatasourceOption;
  source?: string;
  multiple: boolean;
  selected: boolean;
  onSelect: () => void;
}

function CustomOptionCard({
  option,
  source,
  multiple,
  selected,
  onSelect,
}: CustomOptionCardProps) {
  const FallbackIcon = getAvatarFallback(source);
  const isFriend = source !== "qq_groups";
  const { nickname, loading } = useDebouncedNickname(
    option.value,
    source,
    isFriend,
  );

  const displayName = nickname || option.label;
  const secondaryText =
    source === "qq_groups"
      ? `群号 ${option.meta?.groupId || option.value}`
      : `QQ ${option.meta?.qq || option.value}`;

  return (
    <button
      type="button"
      className={cn(
        "relative flex items-center gap-3 rounded-xl border p-3 text-left transition-all duration-200",
        selected
          ? "border-primary/55 bg-secondary/35 shadow-sm"
          : "border-dashed border-primary/40 bg-primary/5 hover:border-primary/60 hover:bg-primary/10",
      )}
      onClick={onSelect}
    >
      <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary/40">
        {option.meta?.avatarUrl ? (
          <img
            src={option.meta.avatarUrl}
            alt={displayName}
            className="h-full w-full object-cover"
          />
        ) : (
          <FallbackIcon className="h-5 w-5 text-muted-foreground" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "truncate text-sm font-semibold text-card-foreground",
            loading && "opacity-70",
          )}
        >
          {displayName}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{secondaryText}</p>
      </div>
      {multiple ? (
        <input
          type="checkbox"
          className="form-checkbox shrink-0"
          checked={selected}
          onChange={onSelect}
          onClick={(event) => event.stopPropagation()}
        />
      ) : null}
    </button>
  );
}

export function DatasourcePickerDialog({
  open,
  title,
  source,
  options,
  multiple,
  value,
  onClose,
  onChange,
}: DatasourcePickerDialogProps) {
  const [visible, setVisible] = useState(false);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<string[]>([]);

  useEffect(() => {
    if (!open) {
      setVisible(false);
      return;
    }
    setDraft(getSelection(value));
    setQuery("");
    requestAnimationFrame(() => setVisible(true));
  }, [open, value]);

  const filteredOptions = useMemo(
    () => options.filter((option) => matchesQuery(option, query)),
    [options, query],
  );

  // 当用户输入了合法的 QQ 号码/群号，且在当前数据源中未找到完全匹配时，
  // 渲染一个“手动添加”卡片：头像来自 QQ 服务器、昵称就是这个号码，
  // 选中后直接把号码写入配置。
  const trimmedQuery = query.trim();
  const hasExactMatch = useMemo(() => {
    if (!trimmedQuery) return false;
    return options.some(
      (opt) =>
        String(opt.value) === trimmedQuery ||
        String(opt.meta?.qq) === trimmedQuery ||
        String(opt.meta?.groupId) === trimmedQuery,
    );
  }, [options, trimmedQuery]);
  const customOption =
    trimmedQuery && isPureQQNumber(trimmedQuery) && !hasExactMatch
      ? buildCustomOption(trimmedQuery, source)
      : null;

  const FallbackIcon = getAvatarFallback(source);

  const commitAndClose = (nextValue: string | string[]) => {
    onChange(nextValue);
    setVisible(false);
    setTimeout(onClose, 180);
  };

  const toggleDraft = (optionValue: string) => {
    setDraft((prev) =>
      prev.includes(optionValue)
        ? prev.filter((item) => item !== optionValue)
        : [...prev, optionValue],
    );
  };

  if (!open) {
    return null;
  }

  return createPortal(
    <div
      className={cn(
        "fixed left-0 top-0 z-[100] flex h-dvh w-dvw items-center justify-center transition-all duration-200",
        visible ? "bg-black/45 backdrop-blur-sm" : "bg-transparent",
      )}
      onClick={() => {
        setVisible(false);
        setTimeout(onClose, 180);
      }}
    >
      <div
        className={cn(
          "mx-4 flex max-h-[80vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border bg-card shadow-2xl transition-all duration-200",
          visible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
        )}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold">
                {getDialogTitle(source, title)}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {multiple ? "支持多选" : "选择后立即写入字段"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setVisible(false);
                setTimeout(onClose, 180);
              }}
              className="rounded-full p-2 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-4 relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={getDialogSearchPlaceholder(source)}
              className="pl-9"
              autoFocus
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 space-y-4">
          {customOption ? (
            <div className="space-y-2">
              <p className="px-1 text-xs text-muted-foreground">
                未在当前列表中找到该号码，可点击下方卡片手动添加
              </p>
              <div className="grid gap-3 md:grid-cols-2">
                <CustomOptionCard
                  option={customOption}
                  source={source}
                  multiple={Boolean(multiple)}
                  selected={draft.includes(customOption.value)}
                  onSelect={() => {
                    if (multiple) {
                      toggleDraft(customOption.value);
                      return;
                    }
                    commitAndClose(customOption.value);
                  }}
                />
              </div>
            </div>
          ) : null}

          {filteredOptions.length > 0 ? (
            <div className="space-y-2">
              {customOption ? (
                <p className="px-1 text-xs text-muted-foreground">已有匹配项</p>
              ) : null}
              <div className="grid gap-3 md:grid-cols-2">
                {filteredOptions.map((option) => {
                  const selected = draft.includes(option.value);
                  const secondaryText =
                    source === "qq_groups"
                      ? `群号 ${option.meta?.groupId || option.value}${option.meta?.memberCount ? ` · ${option.meta.memberCount} 人` : ""}`
                      : `QQ ${option.meta?.qq || option.value}${option.meta?.nickname && option.meta?.remark && option.meta.nickname !== option.meta.remark ? ` · ${option.meta.nickname}` : ""}`;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      className={cn(
                        "flex items-center gap-3 rounded-xl border p-3 text-left transition-all duration-200",
                        selected
                          ? "border-primary/45 bg-secondary/35 shadow-sm"
                          : "border-border/80 bg-card hover:border-primary/20 hover:bg-secondary/20",
                      )}
                      onClick={() => {
                        if (multiple) {
                          toggleDraft(option.value);
                          return;
                        }
                        commitAndClose(option.value);
                      }}
                    >
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary/40">
                        {option.meta?.avatarUrl ? (
                          <img
                            src={option.meta.avatarUrl}
                            alt={option.label}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <FallbackIcon className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <p className="truncate text-sm font-semibold text-card-foreground">
                            {option.label}
                          </p>
                          {multiple ? (
                            <input
                              type="checkbox"
                              className="form-checkbox mt-0.5"
                              checked={selected}
                              onChange={() => toggleDraft(option.value)}
                              onClick={(event) => event.stopPropagation()}
                            />
                          ) : null}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {secondaryText}
                        </p>
                        {option.description ? (
                          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                            {option.description}
                          </p>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {!customOption && filteredOptions.length === 0 ? (
            <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              {getDialogEmptyText(source)}
            </div>
          ) : null}
        </div>

        {multiple ? (
          <div className="flex items-center justify-between gap-3 border-t p-4">
            <p className="text-sm text-muted-foreground">
              已选择 {draft.length} 项
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setDraft([])}
                disabled={draft.length === 0}
              >
                清空
              </Button>
              <Button onClick={() => commitAndClose(draft)}>确认选择</Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
