import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ChevronDown, Eye, EyeOff, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  DatasourcePickerDialog,
  type DatasourceOption,
} from "./DatasourcePickerDialog";

interface ConfigField {
  key: string;
  label: string;
  type: string;
  description?: string;
  placeholder?: string;
  required?: boolean;
  multiple?: boolean;
  source?: string;
  options?: DatasourceOption[];
  defaultValue?: any;
  currentValue?: any;
}

interface ConfigPageData {
  plugin: string;
  title: string;
  description?: string;
  markdown: string;
  fields: ConfigField[];
  hasCustomPage: boolean;
  configs: Record<string, any>;
}

interface ConfigPageRendererProps {
  pageData: ConfigPageData;
  configs: Record<string, any>;
  onConfigChange: (configs: Record<string, any>) => void;
}

const fieldCardClass = "space-y-3";
const emptySelectValue = "__mioku_empty_option__";

function shouldIgnoreCardToggle(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return Boolean(
    target.closest(
      "input, textarea, select, button, a, label, [role='button'], [data-stop-card-toggle='true']",
    ),
  );
}

function getCheckboxCardClass(active: boolean): string {
  return cn(
    "rounded-xl border bg-card/78 p-4 transition-all duration-200 ease-out",
    "active:scale-[0.992] active:bg-secondary/45",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
    active ? "border-primary/45 bg-secondary/35" : "border-border/85",
  );
}

function stripLeadingHeading(markdown: string, title: string): string {
  const normalizedTitle = String(title || "").trim();
  if (!normalizedTitle) {
    return markdown;
  }

  const escapedTitle = normalizedTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return markdown.replace(new RegExp(`^#\\s+${escapedTitle}\\s*\\n+`, "u"), "");
}

function normalizeEscapedNewlines(value: unknown): string {
  return String(value ?? "")
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n");
}

function SecretInputField({
  field,
  value,
  onChange,
}: {
  field: ConfigField;
  value: string;
  onChange: (value: string) => void;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Input
        id={field.key}
        type={visible ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
        className="pr-11"
      />
      <button
        type="button"
        aria-label={visible ? "隐藏内容" : "显示内容"}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground transition hover:text-foreground"
        onClick={() => setVisible((current) => !current)}
      >
        {visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
      </button>
    </div>
  );
}

function parseConfigKey(key: string): { configName: string; path: string } | null {
  const parts = key.split(".");
  if (parts.length < 2) return null;
  return {
    configName: parts[0],
    path: parts.slice(1).join("."),
  };
}

function getValueByPath(obj: any, path: string): any {
  const keys = path.split(".");
  let current = obj;
  for (const key of keys) {
    if (current == null || typeof current !== "object") return undefined;
    current = current[key];
  }
  return current;
}

function setValueByPath(obj: any, path: string, value: any): any {
  const keys = path.split(".");
  const result = JSON.parse(JSON.stringify(obj)); // deep clone
  let current = result;

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!(key in current) || typeof current[key] !== "object") {
      current[key] = {};
    }
    current = current[key];
  }

  current[keys[keys.length - 1]] = value;
  return result;
}

export function ConfigPageRenderer({
  pageData,
  configs,
  onConfigChange,
}: ConfigPageRendererProps) {
  const [datasources, setDatasources] = useState<Record<string, DatasourceOption[]>>({});
  const [activePickerField, setActivePickerField] = useState<ConfigField | null>(null);
  const pageDataRef = useRef(pageData);
  const configsRef = useRef(configs);

  pageDataRef.current = pageData;
  configsRef.current = configs;

  useEffect(() => {
    // Load datasources for fields that need them
    const sourcesToLoad = new Set<string>();
    for (const field of pageData.fields) {
      if (field.source) {
        sourcesToLoad.add(field.source);
      }
    }

    Promise.all(
      Array.from(sourcesToLoad).map(async (source) => {
        try {
          const res = await apiFetch<any>(
            `/api/plugin-config/datasources/${encodeURIComponent(source)}`,
          );
          return { source, data: (res.data || []) as DatasourceOption[] };
        } catch {
          return { source, data: [] };
        }
      }),
    ).then((results) => {
      const map: Record<string, any[]> = {};
      for (const { source, data } of results) {
        map[source] = data;
      }
      setDatasources(map);
    });
  }, [pageData.fields]);

  const handleFieldChange = useCallback((field: ConfigField, value: any) => {
    const parsed = parseConfigKey(field.key);
    if (!parsed) return;

    const { configName, path } = parsed;
    const currentConfig = configsRef.current[configName] || {};
    const updatedConfig = setValueByPath(currentConfig, path, value);

    onConfigChange({
      ...configsRef.current,
      [configName]: updatedConfig,
    });
  }, [onConfigChange]);

  const getFieldValue = useCallback((field: ConfigField): any => {
    const parsed = parseConfigKey(field.key);
    if (!parsed) return field.defaultValue;

    const { configName, path } = parsed;
    const config = configsRef.current[configName];
    if (!config) return field.defaultValue;

    const value = getValueByPath(config, path);
    return value !== undefined ? value : field.defaultValue;
  }, []);

  const renderField = useCallback((field: ConfigField) => {
    const value = getFieldValue(field);
    const dynamicSourceOptions =
      field.source ? datasources[field.source] || [] : [];

    switch (field.type) {
      case "text":
      case "secret":
        return (
          <div key={field.key} className={fieldCardClass}>
            <Label htmlFor={field.key} className="text-sm font-medium">
              {field.label}
              {field.required && <span className="text-destructive ml-1">*</span>}
            </Label>
            {field.type === "secret" ? (
              <SecretInputField
                field={field}
                value={value || ""}
                onChange={(nextValue) => handleFieldChange(field, nextValue)}
              />
            ) : (
              <Input
                id={field.key}
                type="text"
                value={value || ""}
                onChange={(e) => handleFieldChange(field, e.target.value)}
                placeholder={field.placeholder}
              />
            )}
            {field.description && (
              <p className="text-sm leading-6 text-muted-foreground">{field.description}</p>
            )}
          </div>
        );

      case "textarea":
        return (
          <div key={field.key} className={fieldCardClass}>
            <div className="flex flex-col gap-1">
              <Label htmlFor={field.key} className="text-sm font-medium">
                {field.label}
                {field.required && <span className="text-destructive ml-1">*</span>}
              </Label>
            </div>
            <Textarea
              id={field.key}
              value={normalizeEscapedNewlines(value)}
              onChange={(e) => handleFieldChange(field, e.target.value)}
              placeholder={field.placeholder}
              className="min-h-40 whitespace-pre-wrap"
            />
            {field.description && (
              <p className="text-sm leading-6 text-muted-foreground">{field.description}</p>
            )}
          </div>
        );

      case "number":
        return (
          <div key={field.key} className={fieldCardClass}>
            <Label htmlFor={field.key} className="text-sm font-medium">
              {field.label}
              {field.required && <span className="text-destructive ml-1">*</span>}
            </Label>
            <NumberInput
              id={field.key}
              value={typeof value === "number" ? value : null}
              emptyBehavior="null"
              onValueChange={(nextValue) => handleFieldChange(field, nextValue)}
              placeholder={field.placeholder}
            />
            {field.description && (
              <p className="text-sm leading-6 text-muted-foreground">{field.description}</p>
            )}
          </div>
        );

      case "switch":
        return (
          <div
            key={field.key}
            role="checkbox"
            aria-checked={!!value}
            tabIndex={0}
            className={getCheckboxCardClass(!!value)}
            onClick={(e) => {
              if (shouldIgnoreCardToggle(e.target)) {
                return;
              }
              handleFieldChange(field, !value);
            }}
            onKeyDown={(e) => {
              if (e.key === " " || e.key === "Enter") {
                e.preventDefault();
                handleFieldChange(field, !value);
              }
            }}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <Label htmlFor={field.key} className="text-sm font-semibold">
                  {field.label}
                </Label>
                {field.description && (
                  <p className="mt-1 text-xs text-muted-foreground">{field.description}</p>
                )}
              </div>
              <input
                id={field.key}
                className="form-checkbox mt-1"
                type="checkbox"
                checked={!!value}
                onChange={(e) => handleFieldChange(field, e.target.checked)}
              />
            </div>
          </div>
        );

      case "select":
        if (field.source) {
          const selectedOption =
            dynamicSourceOptions.find(
              (option) => option.value === String(value ?? ""),
            ) || null;

          return (
            <div key={field.key} className={`${fieldCardClass} max-w-md`}>
              <div className="space-y-1">
                <Label htmlFor={field.key} className="block text-sm font-medium">
                  {field.label}
                  {field.required && <span className="text-destructive ml-1">*</span>}
                </Label>
              </div>
              <button
                id={field.key}
                type="button"
                className="flex min-h-10 w-full items-center justify-between rounded-md border border-input bg-card px-3 py-2 text-left text-sm transition hover:border-primary/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                onClick={() => setActivePickerField(field)}
              >
                <span className={cn("truncate", !selectedOption && "text-muted-foreground")}>
                  {selectedOption
                    ? `${selectedOption.label} (${selectedOption.meta?.qq || selectedOption.meta?.groupId || selectedOption.value})`
                    : field.placeholder || "点击选择"}
                </span>
                <Search className="ml-3 h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
              {selectedOption ? (
                <div className="flex items-center gap-3 rounded-xl border bg-card/70 p-3">
                  <div className="h-10 w-10 overflow-hidden rounded-full bg-secondary/40">
                    {selectedOption.meta?.avatarUrl ? (
                      <img
                        src={selectedOption.meta.avatarUrl}
                        alt={selectedOption.label}
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{selectedOption.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {selectedOption.meta?.qq
                        ? `QQ ${selectedOption.meta.qq}`
                        : `群号 ${selectedOption.meta?.groupId || selectedOption.value}`}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="rounded-full p-1.5 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                    onClick={() => handleFieldChange(field, "")}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : null}
              {field.description && (
                <p className="text-sm leading-6 text-muted-foreground">{field.description}</p>
              )}
            </div>
          );
        }

        const options = field.options || [];
        const selectValue = value == null ? "" : String(value);

        return (
          <div key={field.key} className={`${fieldCardClass} max-w-md`}>
            <div className="space-y-1">
              <Label htmlFor={field.key} className="block text-sm font-medium">
                {field.label}
                {field.required && <span className="text-destructive ml-1">*</span>}
              </Label>
            </div>
            <Select
              value={selectValue || emptySelectValue}
              onValueChange={(nextValue) =>
                handleFieldChange(
                  field,
                  nextValue === emptySelectValue ? "" : nextValue,
                )
              }
            >
              <SelectTrigger id={field.key} className="w-full">
                <SelectValue placeholder={field.placeholder || "请选择"} />
              </SelectTrigger>
              <SelectContent>
                {!field.required ? (
                  <SelectItem value={emptySelectValue}>
                    {field.placeholder || "请选择"}
                  </SelectItem>
                ) : null}
                {options.map((opt: any) => (
                  <SelectItem key={opt.value} value={String(opt.value)}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {field.description && (
              <p className="text-sm leading-6 text-muted-foreground">{field.description}</p>
            )}
          </div>
        );

      case "multi-select":
        const selectedValues = Array.isArray(value) ? value : [];
        if (field.source) {
          const selectedOptions = selectedValues
            .map((item: string) =>
              dynamicSourceOptions.find((option) => option.value === String(item)),
            )
            .filter(Boolean) as DatasourceOption[];

          return (
            <div key={field.key} className="space-y-3 max-w-2xl">
              <Label className="block text-sm font-medium">
                {field.label}
                {field.required && <span className="text-destructive ml-1">*</span>}
              </Label>
              <button
                type="button"
                className="flex min-h-10 w-full items-center justify-between rounded-md border border-input bg-card px-3 py-2 text-left text-sm transition hover:border-primary/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                onClick={() => setActivePickerField(field)}
              >
                <span className={cn(selectedOptions.length === 0 && "text-muted-foreground")}>
                  {selectedOptions.length > 0
                    ? `已选择 ${selectedOptions.length} 项`
                    : field.placeholder || "点击选择"}
                </span>
                <div className="ml-3 flex shrink-0 items-center gap-2 text-muted-foreground">
                  <Search className="h-4 w-4" />
                  <ChevronDown className="h-4 w-4" />
                </div>
              </button>
              {selectedOptions.length > 0 ? (
                <div className="grid gap-2 md:grid-cols-2">
                  {selectedOptions.map((option) => (
                    <div
                      key={option.value}
                      className="flex items-center gap-3 rounded-xl border bg-card/70 p-3"
                    >
                      <div className="h-10 w-10 overflow-hidden rounded-full bg-secondary/40">
                        {option.meta?.avatarUrl ? (
                          <img
                            src={option.meta.avatarUrl}
                            alt={option.label}
                            className="h-full w-full object-cover"
                          />
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{option.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {option.meta?.qq
                            ? `QQ ${option.meta.qq}`
                            : `群号 ${option.meta?.groupId || option.value}${option.meta?.memberCount ? ` · ${option.meta.memberCount} 人` : ""}`}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="rounded-full p-1.5 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                        onClick={() =>
                          handleFieldChange(
                            field,
                            selectedValues.filter(
                              (item: string) => String(item) !== option.value,
                            ),
                          )
                        }
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
              {field.description && (
                <p className="text-sm leading-6 text-muted-foreground">{field.description}</p>
              )}
            </div>
          );
        }
        const multiOptions = field.options || [];

        return (
          <div key={field.key} className="space-y-2">
            <Label className="text-sm font-medium">
              {field.label}
              {field.required && <span className="text-destructive ml-1">*</span>}
            </Label>
            <div className="max-h-56 space-y-2 overflow-y-auto rounded-xl border bg-card/70 p-3">
              {multiOptions.map((opt: any) => (
                <label
                  key={opt.value}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border border-transparent px-3 py-2 transition-colors hover:border-primary/20 hover:bg-secondary/60"
                >
                  <input
                    type="checkbox"
                    checked={selectedValues.includes(opt.value)}
                    onChange={(e) => {
                      const newValues = e.target.checked
                        ? [...selectedValues, opt.value]
                        : selectedValues.filter((v: any) => v !== opt.value);
                      handleFieldChange(field, newValues);
                    }}
                    className="form-checkbox"
                  />
                  <span className="text-sm text-card-foreground/95">{opt.label}</span>
                </label>
              ))}
            </div>
            {field.description && (
              <p className="text-sm leading-6 text-muted-foreground">{field.description}</p>
            )}
          </div>
        );

      case "json":
        return (
          <div key={field.key} className="space-y-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor={field.key} className="text-sm font-medium">
                {field.label}
                {field.required && <span className="text-destructive ml-1">*</span>}
              </Label>
            </div>
            <Textarea
              id={field.key}
              value={JSON.stringify(value, null, 2)}
              onChange={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value);
                  handleFieldChange(field, parsed);
                } catch {
                  // ignore invalid JSON while typing
                }
              }}
              placeholder={field.placeholder}
              className="min-h-40 font-mono text-xs whitespace-pre-wrap"
            />
            {field.description && (
              <p className="text-sm leading-6 text-muted-foreground">{field.description}</p>
            )}
          </div>
        );

      default:
        return null;
    }
  }, [datasources, getFieldValue, handleFieldChange]);

  // Keep markdown renderers stable so inputs are not remounted on each keystroke.
  const components = useMemo(() => ({
    code({ node, inline, className, children, ...props }: any) {
      const match = /language-mioku-field/.test(className || "");
      const matchFields = /language-mioku-fields/.test(className || "");
      const matchFile = /language-mioku-file/.test(className || "");

      if (!inline && (match || matchFields || matchFile)) {
        const content = String(children).replace(/\n$/, "");

        if (match) {
          // Parse single field block
          const keyMatch = content.match(/key:\s*(\S+)/);
          if (keyMatch) {
            const field = pageDataRef.current.fields.find(
              (f) => f.key === keyMatch[1],
            );
            if (field) {
              return (
                <div className="my-4" data-mioku-block="field">
                  {renderField(field)}
                </div>
              );
            }
          }
        }

        if (matchFields) {
          // Parse multiple fields block
          const keysMatch = content.match(/keys:\s*\n((?:\s*-\s*\S+\n?)+)/);
          if (keysMatch) {
            const keys = keysMatch[1]
              .split("\n")
              .map((line) => line.trim().replace(/^-\s*/, ""))
              .filter(Boolean);

            const fields = keys
              .map((key) =>
                pageDataRef.current.fields.find((f) => f.key === key),
              )
              .filter(Boolean) as ConfigField[];

            return (
              <div className="my-4 space-y-4" data-mioku-block="fields">
                {fields.map((field) => renderField(field))}
              </div>
            );
          }
        }

        if (matchFile) {
          const configMatch = content.match(/config:\s*(\S+)/);
          if (configMatch) {
            const configName = configMatch[1];
            const configValue = configsRef.current[configName] || {};

            return (
              <div className="my-4 space-y-3" data-mioku-block="file">
                <div className="flex flex-col pt-2">
                  <Label>{configName}.json (原始配置)</Label>
                </div>
                <Textarea
                  value={JSON.stringify(configValue, null, 2)}
                  onChange={(e) => {
                    try {
                      const parsed = JSON.parse(e.target.value);
                      onConfigChange({
                        ...configsRef.current,
                        [configName]: parsed,
                      });
                    } catch {
                      // ignore invalid JSON
                    }
                  }}
                  className="min-h-48 font-mono text-xs whitespace-pre-wrap"
                />
              </div>
            );
          }
        }

        return null;
      }

        const isBlock = Boolean(className);
        if (isBlock) {
          return <code className="font-mono text-xs leading-6">{children}</code>;
        }

        return (
          <code className="rounded bg-secondary/60 px-1 py-0.5 font-mono text-[0.82em]" {...props}>
            {children}
          </code>
        );
      },
      pre({ children }: any) {
        const child = Array.isArray(children) ? children[0] : children;
        if (child?.props?.["data-mioku-block"]) {
          return child;
        }
        return <pre className="overflow-auto rounded-xl border bg-secondary/20 p-3">{children}</pre>;
      },
      h1({ children }: any) {
        return <h1 className="text-base font-semibold leading-6 tracking-tight">{children}</h1>;
      },
      h2({ children }: any) {
        return (
          <h2 className="pt-2 text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {children}
          </h2>
        );
      },
      h3({ children }: any) {
        return <h3 className="text-sm font-semibold leading-6">{children}</h3>;
      },
      p({ children }: any) {
        return <p className="text-sm leading-6 text-card-foreground/95">{children}</p>;
      },
      ul({ children }: any) {
        return <ul className="list-inside list-disc space-y-1 text-sm leading-6">{children}</ul>;
      },
      ol({ children }: any) {
        return <ol className="list-inside list-decimal space-y-1 text-sm leading-6">{children}</ol>;
      },
      hr() {
        return <hr className="border-border/80" />;
      },
    }), [getFieldValue, handleFieldChange, onConfigChange, renderField]);

  return (
    <div className="space-y-4">
      {activePickerField ? (
        <DatasourcePickerDialog
          open={Boolean(activePickerField)}
          title={activePickerField.label}
          source={activePickerField.source}
          options={
            activePickerField.source
              ? datasources[activePickerField.source] || []
              : []
          }
          multiple={activePickerField.type === "multi-select"}
          value={getFieldValue(activePickerField)}
          onClose={() => setActivePickerField(null)}
          onChange={(nextValue) => {
            handleFieldChange(activePickerField, nextValue);
            setActivePickerField(null);
          }}
        />
      ) : null}
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={components}
      >
        {stripLeadingHeading(pageData.markdown, pageData.title)}
      </ReactMarkdown>
    </div>
  );
}
