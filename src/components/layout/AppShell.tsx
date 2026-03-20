import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { Button } from "@/components/ui/button";
import { TopbarContext } from "./TopbarContext";
import type { ReactNode, WheelEvent } from "react";

const navItems = [
  { to: "/", label: "状态总览" },
  { to: "/config", label: "Mioku配置" },
  { to: "/ai", label: "AI设置" },
  { to: "/plugins", label: "插件管理" },
  { to: "/services", label: "服务管理" },
  { to: "/plugin-config", label: "插件配置" },
  { to: "/database", label: "数据库" },
  { to: "/webui", label: "WebUI管理" },
];

export function AppShell() {
  const islandHideDelay = 260;
  const islandHideDistance = 56;
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [topbarMode, setTopbarMode] = useState<"initial" | "island" | "hidden">(
    "initial",
  );
  const [compactWidth, setCompactWidth] = useState<number>(760);
  const [leftContent, setLeftContent] = useState<ReactNode>(null);
  const [rightContent, setRightContent] = useState<ReactNode>(null);
  const lastScrollYRef = useRef(0);
  const topbarModeRef = useRef<"initial" | "island" | "hidden">("initial");
  const islandEnterYRef = useRef(0);
  const islandEnteredAtRef = useRef(0);
  const islandHideStartYRef = useRef<number | null>(null);
  const maxWidthRef = useRef<HTMLDivElement | null>(null);
  const leftSlotRef = useRef<HTMLDivElement | null>(null);
  const rightSlotRef = useRef<HTMLDivElement | null>(null);
  const topbarValue = useMemo(
    () => ({ leftContent, setLeftContent, rightContent, setRightContent }),
    [leftContent, rightContent],
  );

  const handleTopbarHorizontalWheel = useCallback(
    (event: WheelEvent<HTMLDivElement>) => {
      const el = event.currentTarget;
      if (el.scrollWidth <= el.clientWidth) return;

      const delta =
        Math.abs(event.deltaY) > Math.abs(event.deltaX)
          ? event.deltaY
          : event.deltaX;
      if (!delta) return;

      el.scrollLeft += delta;
      event.preventDefault();
    },
    [],
  );

  const calcCompactWidth = useCallback(() => {
    const layoutWidth = maxWidthRef.current?.clientWidth || window.innerWidth;
    const viewportWidth = window.innerWidth;
    const isMobile = viewportWidth < 768;

    if (isMobile) {
      const next = layoutWidth + 24;
      setCompactWidth((prev) => (Math.abs(prev - next) > 2 ? next : prev));
    } else {
      const oneThird = Math.floor(viewportWidth / 3);
      const next = Math.min(layoutWidth, oneThird);
      setCompactWidth((prev) => (Math.abs(prev - next) > 2 ? next : prev));
    }
  }, []);

  useEffect(() => {
    topbarModeRef.current = topbarMode;
  }, [topbarMode]);

  useEffect(() => {
    const onScroll = () => {
      const currentY = window.scrollY;
      const delta = currentY - lastScrollYRef.current;
      const mode = topbarModeRef.current;

      if (currentY < 16) {
        islandHideStartYRef.current = null;
        if (mode !== "initial") setTopbarMode("initial");
      } else if (delta > 3) {
        if (mode === "initial") {
          islandEnterYRef.current = currentY;
          islandEnteredAtRef.current = Date.now();
          islandHideStartYRef.current = null;
          setTopbarMode("island");
        } else if (mode === "island") {
          const elapsed = Date.now() - islandEnteredAtRef.current;

          if (elapsed >= islandHideDelay) {
            if (islandHideStartYRef.current === null) {
              islandHideStartYRef.current = currentY;
            } else if (currentY - islandHideStartYRef.current > islandHideDistance) {
              islandHideStartYRef.current = null;
              setTopbarMode("hidden");
            }
          }
        }
      } else if (delta < -3) {
        if (mode === "hidden") {
          islandEnterYRef.current = currentY;
          islandEnteredAtRef.current = Date.now();
          islandHideStartYRef.current = null;
          setTopbarMode("island");
        } else if (mode === "island") {
          islandHideStartYRef.current = null;
        }
      }

      lastScrollYRef.current = currentY;
    };

    calcCompactWidth();
    const resizeObserver = new ResizeObserver(() => calcCompactWidth());
    if (maxWidthRef.current) resizeObserver.observe(maxWidthRef.current);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", calcCompactWidth, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", calcCompactWidth);
      resizeObserver.disconnect();
    };
  }, [calcCompactWidth]);

  useEffect(() => {
    const raf = window.requestAnimationFrame(() => {
      calcCompactWidth();
    });
    return () => window.cancelAnimationFrame(raf);
  }, [calcCompactWidth, location.pathname, leftContent]);

  return (
    <TopbarContext.Provider value={topbarValue}>
      <div className="min-h-screen w-full p-3 md:p-6">
        <div
          className={`fixed inset-0 z-30 bg-black/45 transition-opacity duration-300 md:hidden ${
            mobileMenuOpen
              ? "pointer-events-auto opacity-100"
              : "pointer-events-none opacity-0"
          }`}
          onClick={() => setMobileMenuOpen(false)}
        />
        <aside
          className={`fixed inset-y-0 left-0 z-40 w-[272px] border-r bg-card p-4 panel-glow transition-transform duration-300 ease-out md:hidden ${
            mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="mb-5 flex items-center justify-between">
            <Link
              to="/"
              onClick={() => setMobileMenuOpen(false)}
              className="text-lg font-bold text-primary"
            >
              Mioku WebUI
            </Link>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMobileMenuOpen(false)}
              aria-label="关闭菜单"
            >
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

        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-3 px-3 md:grid-cols-[240px_minmax(0,1fr)] md:gap-6 md:px-0">
          <aside className="hidden md:block">
            <div className="topbar-scroll sticky top-6 h-[calc(100vh-3rem)] overflow-y-auto rounded-xl border bg-card p-3 panel-glow animate-soft-pop">
              <div className="sticky top-0 z-10 bg-card/95 pb-3 pt-1 backdrop-blur">
                <Link
                  to="/"
                  className="block rounded-lg px-2 py-1 text-lg font-bold text-primary"
                >
                  Mioku WebUI
                </Link>
              </div>
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
            </div>
          </aside>

          <main ref={maxWidthRef} className="space-y-3 px-3 md:space-y-5 md:px-0">
            <div className="sticky top-3 z-20 flex justify-center md:px-0">
              <header
                className={`relative flex items-center justify-between gap-3 border bg-card panel-glow animate-soft-pop transition-all duration-500 ease-[cubic-bezier(0.2,0.9,0.3,1.1)] motion-reduce:transition-none ${
                  topbarMode === "initial"
                    ? "translate-y-0 rounded-xl p-4"
                    : topbarMode === "island"
                      ? "topbar-island-fade translate-y-2 rounded-2xl px-4 py-2.5 shadow-xl shadow-black/10 backdrop-blur-md -mx-3 md:mx-0"
                      : "topbar-island-fade -translate-y-[140%] rounded-2xl px-4 py-2.5 opacity-0 pointer-events-none"
                }`}
                style={{
                  width: topbarMode === "initial" ? "100%" : `${compactWidth}px`,
                  minWidth: "320px",
                  maxWidth: topbarMode === "initial" ? "100%" : `${compactWidth}px`,
                }}
              >
                <div
                  ref={leftSlotRef}
                  className="flex min-w-0 flex-1 items-center gap-2"
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    className="md:hidden"
                    onClick={() => setMobileMenuOpen(true)}
                    aria-label="打开菜单"
                  >
                    <Menu className="h-4 w-4" />
                  </Button>
                  <div
                    className={`topbar-chip-scroll flex min-w-0 flex-1 items-center gap-2 overflow-x-auto touch-pan-x ${
                      topbarMode === "initial" ? "" : "topbar-island-content-fade"
                    }`}
                    onWheel={handleTopbarHorizontalWheel}
                  >
                    <div key={location.pathname} className="animate-soft-pop">
                      {leftContent}
                    </div>
                  </div>
                </div>
                <div ref={rightSlotRef} className="flex shrink-0 items-center gap-2">
                  {rightContent}
                  <ThemeToggle />
                </div>
              </header>
            </div>
            <Outlet />
          </main>
        </div>
      </div>
    </TopbarContext.Provider>
  );
}
