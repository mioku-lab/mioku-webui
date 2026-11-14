import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ThemeCatalog } from "@/features/ai/theme-packs";

const INLINE_VALUE = "__inline";
const NAME_MAX_LENGTH = 40;

type ThemeOption =
  | ThemeCatalog["reply"][number]
  | ThemeCatalog["emotion"][number];

type ThemePackSectionProps = {
  title: string;
  description: string;
  themes: ThemeOption[];
  selectedId: string;
  editing: boolean;
  onSelect: (id: string) => void;
  onEdit: () => void;
  onCreate: (name: string) => void;
  onFork: (name: string) => void;
  onRename: (name: string) => void;
  onDelete: () => void;
};

type DialogMode = "new" | "fork" | "rename";

const dialogTitles: Record<DialogMode, string> = {
  new: "新建主题包",
  fork: "复制为自定义主题包",
  rename: "重命名主题包",
};

export function ThemePackSection({
  title,
  description,
  themes,
  selectedId,
  editing,
  onSelect,
  onEdit,
  onCreate,
  onFork,
  onRename,
  onDelete,
}: ThemePackSectionProps) {
  const [dialogMode, setDialogMode] = useState<DialogMode | null>(null);
  const [name, setName] = useState("");

  const selected = themes.find((theme) => theme.id === selectedId);
  const builtinSelected = Boolean(selected?.builtin);
  const customSelected = Boolean(selected && !selected.builtin);

  const openDialog = (mode: DialogMode) => {
    setName(
      mode === "rename"
        ? (selected?.name ?? "")
        : mode === "fork"
          ? `${selected?.name ?? "主题"} 副本`
          : "新主题",
    );
    setDialogMode(mode);
  };

  const closeDialog = () => setDialogMode(null);

  const handleEdit = () => {
    if (editing) {
      onEdit();
      return;
    }
    if (builtinSelected) {
      openDialog("fork");
      return;
    }
    onEdit();
  };

  const submit = () => {
    const value = name.trim();
    if (!value) return;
    if (dialogMode === "new") onCreate(value);
    else if (dialogMode === "fork") onFork(value);
    else if (dialogMode === "rename") onRename(value);
    closeDialog();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <Select
            value={selectedId || INLINE_VALUE}
            onValueChange={(value) =>
              onSelect(value === INLINE_VALUE ? "" : value)
            }
          >
            <SelectTrigger className="w-full lg:max-w-xs">
              <SelectValue placeholder="选择主题包" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={INLINE_VALUE}>自定义</SelectItem>
              {themes.map((theme) => (
                <SelectItem key={theme.id} value={theme.id}>
                  {theme.name}
                  {theme.builtin ? "（内置）" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={editing ? "secondary" : "outline"}
              onClick={handleEdit}
            >
              <Pencil className="mr-1 h-4 w-4" />
              {editing ? "收起" : "编辑"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => openDialog("new")}
            >
              <Plus className="mr-1 h-4 w-4" />
              新建
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!customSelected}
              onClick={() => openDialog("rename")}
            >
              重命名
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              aria-label="删除主题包"
              disabled={!customSelected}
              onClick={onDelete}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {builtinSelected ? (
          <p className="text-xs text-muted-foreground">
            内置主题包来自插件代码，不能直接修改。可复制为自己的主题包后进行编辑。
          </p>
        ) : null}
      </CardContent>

      <Dialog
        open={dialogMode !== null}
        title={dialogMode ? dialogTitles[dialogMode] : ""}
        description={
          dialogMode === "fork"
            ? "内置主题包不能直接修改，复制后可以自由编辑。"
            : undefined
        }
        onClose={closeDialog}
        footer={
          <>
            <Button type="button" variant="outline" onClick={closeDialog}>
              取消
            </Button>
            <Button type="button" onClick={submit} disabled={!name.trim()}>
              确定
            </Button>
          </>
        }
      >
        <Input
          autoFocus
          value={name}
          maxLength={NAME_MAX_LENGTH}
          placeholder="主题包名称"
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              submit();
            }
          }}
        />
      </Dialog>
    </Card>
  );
}
