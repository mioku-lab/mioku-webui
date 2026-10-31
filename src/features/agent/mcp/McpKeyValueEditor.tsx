import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface KeyValueRow {
  key: string;
  value: string;
}

/** env / headers 的键值编辑器；值默认掩码，聚焦后可直接覆盖 */
export function McpKeyValueEditor({
  label,
  hint,
  rows,
  onChange,
  keyPlaceholder,
  valuePlaceholder,
}: {
  label: string;
  hint?: string;
  rows: KeyValueRow[];
  onChange: (rows: KeyValueRow[]) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
}) {
  const update = (index: number, patch: Partial<KeyValueRow>) => {
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">{label}</div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange([...rows, { key: "", value: "" }])}
        >
          <Plus className="h-3.5 w-3.5 sm:mr-1" />
          <span className="hidden sm:inline">添加</span>
        </Button>
      </div>
      {hint ? <div className="text-xs text-muted-foreground">{hint}</div> : null}
      {rows.length === 0 ? (
        <div className="rounded-md border border-dashed py-3 text-center text-xs text-muted-foreground">
          没有条目
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((row, index) => (
            <div key={index} className="flex items-center gap-2">
              <Input
                value={row.key}
                placeholder={keyPlaceholder ?? "名称"}
                onChange={(e) => update(index, { key: e.target.value })}
                className="flex-1"
              />
              <Input
                value={row.value}
                placeholder={valuePlaceholder ?? "值"}
                onChange={(e) => update(index, { value: e.target.value })}
                className="flex-[2] font-mono text-xs"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onChange(rows.filter((_, i) => i !== index))}
                aria-label="删除该条目"
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
