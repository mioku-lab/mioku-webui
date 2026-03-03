import { useMemo, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { Button } from "@/components/ui/button";
import { TopbarContext } from "./TopbarContext";
import type { ReactNode } from "react";

const navItems = [
  { to: "/", label: "状态总览" },
  { to: "/plugins", label: "插件管理" },
  { to: "/services", label: "服务管理" },
  { to: "/ai", label: "AI配置" },
  { to: "/plugin-config", label: "插件配置" },
  { to: "/database", label: "数据库" },
  { to: "/webui", label: "WebUI管理" },
];

export function AppShell() {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [leftContent, setLeftContent] = useState<ReactNode>(null);
  const topbarValue = useMemo(() => ({ leftContent, setLeftContent }), [leftContent]);

  return (
    <TopbarContext.Provider value={topbarValue}>
      <div className="min-h-screen w-full p-3 md:p-6">
        <div
          className={`fixed inset-0 z-30 bg-black/45 transition-opacity duration-300 md:hidden ${
            mobileMenuOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
          }`}
          onClick={() => setMobileMenuOpen(false)}
        />
        <aside
          className={`fixed inset-y-0 left-0 z-40 w-[272px] border-r bg-card p-4 panel-glow transition-transform duration-300 ease-out md:hidden ${
            mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="mb-5 flex items-center justify-between">
            <Link to="/" onClick={() => setMobileMenuOpen(false)} className="text-lg font-bold text-primary">
              Mioku WebUI
            </Link>
            <Button variant="ghost" size="sm" onClick={() => setMobileMenuOpen(false)} aria-label="关闭菜单">
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={`mobile-${item.to}`}
                to={item.to}
                end={item.to === "/"}
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `block rounded-md px-3 py-2 text-sm transition ${isActive ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        </aside>

        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-3 md:grid-cols-[240px_minmax(0,1fr)] md:gap-6">
          <aside className="hidden rounded-xl border bg-card p-4 panel-glow animate-soft-pop md:block">
            <Link to="/" className="mb-5 block text-lg font-bold text-primary">Mioku WebUI</Link>
            <div className="space-y-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/"}
                  className={({ isActive }) =>
                    `block rounded-md px-3 py-2 text-sm transition ${isActive ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          </aside>

          <main className="space-y-3 md:space-y-5">
            <header className="flex items-center justify-between gap-3 rounded-xl border bg-card p-4 panel-glow animate-soft-pop">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="md:hidden"
                  onClick={() => setMobileMenuOpen(true)}
                  aria-label="打开菜单"
                >
                  <Menu className="h-4 w-4" />
                </Button>
                <div className="topbar-scroll flex min-w-0 flex-1 items-center gap-2 overflow-x-auto">
                  <div key={location.pathname} className="animate-soft-pop">
                    {leftContent}
                  </div>
                </div>
              </div>
              <ThemeToggle />
            </header>
            <Outlet />
          </main>
        </div>
      </div>
    </TopbarContext.Provider>
  );
}
