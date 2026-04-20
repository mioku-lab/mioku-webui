import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  DatasourcePickerDialog,
  type DatasourceOption,
} from "@/features/plugin-config/DatasourcePickerDialog";

interface DatasourceMultiSelectFieldProps {
  id: string;
  label: string;
  description?: string;
  placeholder?: string;
  source: "qq_friends" | "qq_groups";
  options: DatasourceOption[];
  value: string[];
  onChange: (value: string[]) => void;
}

function getSecondaryText(
  source: "qq_friends" | "qq_groups",
  option: DatasourceOption,
): string {
  if (source === "qq_friends") {
    return `QQ ${option.meta?.qq || option.value}`;
  }
  return `群号 ${option.meta?.groupId || option.value}${option.meta?.memberCount ? ` · ${option.meta.memberCount} 人` : ""}`;
}

export function DatasourceMultiSelectField({
  id,
  label,
  description,
  placeholder,
  source,
  options,
  value,
  onChange,
}: DatasourceMultiSelectFieldProps) {
  const [open, setOpen] = useState(false);
  const selectedOptions = useMemo(
    () =>
      value
        .map((item) => options.find((option) => option.value === String(item)))
        .filter(Boolean) as DatasourceOption[],
    [options, value],
  );

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <div className="space-y-3 max-w-2xl">
      <Label htmlFor={id} className="block text-sm font-medium">
        {label}
      </Label>
      <button
        id={id}
        type="button"
        className="flex min-h-10 w-full items-center justify-between rounded-md border border-input bg-card px-3 py-2 text-left text-sm transition hover:border-primary/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        onClick={() => setOpen(true)}
      >
        <span className={cn(selectedOptions.length === 0 && "text-muted-foreground")}>
          {selectedOptions.length > 0
            ? `已选择 ${selectedOptions.length} 项`
            : placeholder || "点击选择"}
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
                    src={String(option.meta.avatarUrl)}
                    alt={option.label}
                    className="h-full w-full object-cover"
                  />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{option.label}</p>
                <p className="text-xs text-muted-foreground">
                  {getSecondaryText(source, option)}
                </p>
              </div>
              <button
                type="button"
                className="rounded-full p-1.5 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                onClick={() =>
                  onChange(
                    value.filter((item) => String(item) !== String(option.value)),
                  )
                }
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      ) : null}
      {description ? (
        <p className="text-sm leading-6 text-muted-foreground">{description}</p>
      ) : null}
      <DatasourcePickerDialog
        open={open}
        title={label}
        source={source}
        options={options}
        multiple
        value={value}
        onClose={() => setOpen(false)}
        onChange={(nextValue) => {
          onChange(Array.isArray(nextValue) ? nextValue.map(String) : []);
          setOpen(false);
        }}
      />
    </div>
  );
}
