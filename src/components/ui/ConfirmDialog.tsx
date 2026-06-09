import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
}

export interface ConfirmDialogProps extends ConfirmOptions {
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title = "确认",
  message,
  confirmText = "确认",
  cancelText = "取消",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  const handleConfirm = () => {
    setVisible(false);
    setTimeout(onConfirm, 200);
  };

  const handleCancel = () => {
    setVisible(false);
    setTimeout(onCancel, 200);
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center transition-all duration-200 ${
        visible ? "bg-black/50 backdrop-blur-sm" : "bg-transparent"
      }`}
      onClick={handleCancel}
    >
      <div
        className={`mx-4 w-full max-w-sm rounded-xl border bg-card p-4 shadow-xl transition-all duration-200 ${
          visible ? "scale-100 opacity-100" : "scale-95 opacity-0"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-yellow-500/10">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">{title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{message}</p>
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={handleCancel}
            className="rounded-lg border bg-secondary/50 px-4 py-2 text-sm font-medium transition-all hover:bg-secondary"
          >
            {cancelText}
          </button>
          <button
            onClick={handleConfirm}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-all hover:opacity-90"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
