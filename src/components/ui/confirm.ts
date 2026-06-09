import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { ConfirmDialog, type ConfirmOptions } from "./ConfirmDialog";

export type { ConfirmOptions } from "./ConfirmDialog";

export function confirm(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    const cleanup = () => {
      setTimeout(() => {
        root.unmount();
        container.remove();
      }, 200);
    };

    root.render(
      createElement(ConfirmDialog, {
        ...options,
        onConfirm: () => {
          cleanup();
          resolve(true);
        },
        onCancel: () => {
          cleanup();
          resolve(false);
        },
      }),
    );
  });
}
