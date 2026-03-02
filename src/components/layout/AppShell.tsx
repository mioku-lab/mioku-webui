import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { clearAuth } from "@/lib/api";
import { useAppDispatch } from "@/app/hooks";
import { setToken } from "@/features/auth/authSlice";
import { ThemeToggle } from "./ThemeToggle";
import { Button } from "@/components/ui/button";

const navItems = [
  { to: "/", label: "状态总览" },
  { to: "/plugins", label: "插件管理" },
  { to: "/services", label: "服务管理" },
  { to: "/ai", label: "AI配置" },
  { to: "/plugin-config", label: "插件配置" },
  { to: "/database", label: "数据库" },
];

export function AppShell() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  return (
    <div className="min-h-screen w-full p-3 md:p-6">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-3 md:grid-cols-[240px_minmax(0,1fr)] md:gap-6">
        <aside className="rounded-xl border bg-card p-4 panel-glow animate-soft-pop">
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
          <header className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4 panel-glow animate-soft-pop">
            <ThemeToggle />
            <Button
              variant="outline"
              onClick={() => {
                clearAuth();
                dispatch(setToken(null));
                navigate("/login");
              }}
            >
              退出登录
            </Button>
          </header>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
