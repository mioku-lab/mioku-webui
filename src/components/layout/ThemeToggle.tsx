import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

type ThemeMode = "light" | "dark" | "auto";

function resolveAutoTheme(): "light" | "dark" {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeToggle() {
  const [mode, setMode] = useState<ThemeMode>((localStorage.getItem("mioku_theme_mode") as ThemeMode) || "auto");

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

  return (
    <div className="flex items-center gap-2">
      <Button variant={mode === "light" ? "default" : "secondary"} size="sm" onClick={() => setMode("light")}>日间</Button>
      <Button variant={mode === "dark" ? "default" : "secondary"} size="sm" onClick={() => setMode("dark")}>夜间</Button>
      <Button variant={mode === "auto" ? "default" : "secondary"} size="sm" onClick={() => setMode("auto")}>
        {mode === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />} 自动
      </Button>
    </div>
  );
}
