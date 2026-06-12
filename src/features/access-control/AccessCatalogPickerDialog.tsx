import { useEffect, useMemo, useState } from "react";
import { Search, X, Check, Puzzle, Terminal } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";

type AccessItem = {
  kind: "plugin" | "command";
  plugin: string;
  id: string;
  label: string;
  desc?: string;
  match?: string;
  event?: string;
  fromHook: boolean;
};

interface AccessCatalogPickerDialogProps {
  open: boolean;
  title: string;
  /**
   * 已存在的作用域下条目 key 集合(用于去重 + 标记已存在)
   * 这些条目会被展示为"已添加"但不可在本次 picker 中重复选
   */
  existingKeys: string[];
  keyOf?: (item: AccessItem) => string;
  multiple?: boolean;
  onClose: () => void;
  onChange: (keys: string[]) => void;
}

const DEFAULT_KEY = (it: AccessItem) => `${it.kind}:${it.plugin}:${it.id}`;

export function AccessCatalogPickerDialog({
  open,
  title,
  existingKeys,
  keyOf = DEFAULT_KEY,
  multiple = true,
  onClose,
  onChange,
}: AccessCatalogPickerDialogProps) {
  const [items, setItems] = useState<AccessItem[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  // 本次打开期间用户新选中的项
  const [pending, setPending] = useState<string[]>([]);

  // 打开时重置 pending 与 query;关闭时也清,避免下次打开看到上次的勾
  useEffect(() => {
    if (open) {
      setPending([]);
      setQuery("");
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    apiFetch<{ ok: boolean; data: AccessItem[] }>("/api/access-control/catalog")
      .then((res) => setItems(res.data || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (it) =>
        it.id.toLowerCase().includes(q) ||
        it.label.toLowerCase().includes(q) ||
        it.plugin.toLowerCase().includes(q) ||
        (it.desc || "").toLowerCase().includes(q),
    );
  }, [items, query]);

  const toggle = (key: string) => {
    setPending((prev) => {
      if (prev.includes(key)) {
        return prev.filter((k) => k !== key);
      }
      if (!multiple) return [key];
      return [...prev, key];
    });
  };

  if (!open) return null;

  const existingSet = new Set(existingKeys);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 animate-soft-pop"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="text-sm font-semibold">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-secondary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="border-b px-4 py-2">
          <div className="flex items-center gap-2 rounded-md border bg-background px-3 py-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索插件或命令(如 meme、点歌、/mc 状态)"
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="rounded p-0.5 text-muted-foreground hover:bg-secondary"
              >
                <X className="h-3 w-3" />
              </button>
            ) : null}
          </div>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-2">
          {loading ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              加载中...
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              没有匹配项
            </div>
          ) : (
            <div className="space-y-1">
              {filtered.map((it) => {
                const key = keyOf(it);
                const isExisting = existingSet.has(key);
                const isPending = pending.includes(key);
                const isPlugin = it.kind === "plugin";
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      if (isExisting) return;
                      toggle(key);
                    }}
                    disabled={isExisting}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition",
                      isExisting
                        ? "cursor-not-allowed border-dashed bg-muted/40 opacity-60"
                        : isPending
                          ? "border-primary bg-primary/10"
                          : "hover:bg-secondary",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
                        isPlugin
                          ? "bg-primary/15 text-primary"
                          : "bg-secondary text-secondary-foreground",
                      )}
                    >
                      {isPlugin ? (
                        <Puzzle className="h-4 w-4" />
                      ) : (
                        <Terminal className="h-4 w-4" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 text-sm">
                        <span className="font-mono font-medium">
                          {isPlugin ? it.label : it.id}
                        </span>
                        {!isPlugin ? (
                          <span className="text-xs text-muted-foreground">
                            · {it.plugin}
                          </span>
                        ) : null}
                        {it.fromHook ? (
                          <span className="rounded bg-emerald-500/15 px-1 text-[10px] text-emerald-700 dark:text-emerald-300">
                            hook
                          </span>
                        ) : null}
                      </div>
                      {it.desc ? (
                        <div className="mt-0.5 truncate text-xs text-muted-foreground">
                          {it.desc}
                        </div>
                      ) : null}
                    </div>
                    {isExisting ? (
                      <span className="shrink-0 rounded bg-muted px-1.5 text-[10px] text-muted-foreground">
                        已添加
                      </span>
                    ) : isPending ? (
                      <Check className="h-4 w-4 shrink-0 text-primary" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t px-4 py-3 text-xs text-muted-foreground">
          <div>本次新增 {pending.length} 项</div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-3 py-1.5 text-sm hover:bg-secondary"
            >
              取消
            </button>
            <button
              type="button"
              onClick={() => {
                onChange(pending);
                onClose();
              }}
              disabled={pending.length === 0}
              className={cn(
                "rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground",
                pending.length === 0
                  ? "cursor-not-allowed opacity-50"
                  : "hover:bg-primary/90",
              )}
            >
              确认
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
