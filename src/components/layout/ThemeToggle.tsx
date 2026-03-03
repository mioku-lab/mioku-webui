import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

type ThemeMode = "light" | "dark" | "auto";

function resolveAutoTheme(): "light" | "dark" {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeToggle() {
  const [mode, setMode] = useState<ThemeMode>((localStorage.getItem("mioku_theme_mode") as ThemeMode) || "auto");
  const nextMode = mode === "auto" ? "light" : mode === "light" ? "dark" : "auto";

  useEffect(() => {
    const apply = (target: ThemeMode) => {
      const theme = target === "auto" ? resolveAutoTheme() : target;
      document.documentElement.classList.toggle("dark", theme === "dark");
      localStorage.setItem("mioku_theme_mode", target);
    };

    apply(mode);
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = () => mode === "auto" && apply("auto");
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [mode]);

  const icon = mode === "light" ? <Sun className="h-4 w-4" /> : mode === "dark" ? <Moon className="h-4 w-4" /> : <Monitor className="h-4 w-4" />;
  const title = mode === "light" ? "当前: 日间模式，点击切换到夜间" : mode === "dark" ? "当前: 夜间模式，点击切换到自动" : "当前: 自动模式，点击切换到日间";

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={() => setMode(nextMode)}
      title={title}
      aria-label={title}
      className="transition-all duration-300 hover:-translate-y-0.5"
    >
      <span className="animate-soft-pop">{icon}</span>
    </Button>
  );
}
