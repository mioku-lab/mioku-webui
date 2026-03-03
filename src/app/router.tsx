import { Navigate, createBrowserRouter } from "react-router-dom";
import { Suspense, lazy, type ReactNode } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { getAuthToken } from "@/lib/api";

const LoginPage = lazy(() => import("@/features/auth/LoginPage").then((m) => ({ default: m.LoginPage })));
const DashboardPage = lazy(() =>
  import("@/features/dashboard/DashboardPage").then((m) => ({ default: m.DashboardPage })),
);
const PackagePage = lazy(() => import("@/features/management/PackagePage").then((m) => ({ default: m.PackagePage })));
const AIConfigPage = lazy(() => import("@/features/ai/AIConfigPage").then((m) => ({ default: m.AIConfigPage })));
const PluginConfigPage = lazy(() =>
  import("@/features/plugin-config/PluginConfigPage").then((m) => ({ default: m.PluginConfigPage })),
);
const DatabasePage = lazy(() => import("@/features/database/DatabasePage").then((m) => ({ default: m.DatabasePage })));
const WebUIManagePage = lazy(() =>
  import("@/features/webui/WebUIManagePage").then((m) => ({ default: m.WebUIManagePage })),
);

function Protected({ children }: { children: ReactNode }) {
  const token = getAuthToken();
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function LazyWrap({ children }: { children: ReactNode }) {
  return <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">加载中...</div>}>{children}</Suspense>;
}

export const router = createBrowserRouter([
  {
    path: "/login",
    element: (
      <LazyWrap>
        <LoginPage />
      </LazyWrap>
    ),
  },
  {
    path: "/",
    element: (
      <Protected>
        <AppShell />
      </Protected>
    ),
    children: [
      {
        index: true,
        element: (
          <LazyWrap>
            <DashboardPage />
          </LazyWrap>
        ),
      },
      {
        path: "plugins",
        element: (
          <LazyWrap>
            <PackagePage target="plugin" />
          </LazyWrap>
        ),
      },
      {
        path: "services",
        element: (
          <LazyWrap>
            <PackagePage target="service" />
          </LazyWrap>
        ),
      },
      {
        path: "ai",
        element: (
          <LazyWrap>
            <AIConfigPage />
          </LazyWrap>
        ),
      },
      {
        path: "plugin-config",
        element: (
          <LazyWrap>
            <PluginConfigPage />
          </LazyWrap>
        ),
      },
      {
        path: "database",
        element: (
          <LazyWrap>
            <DatabasePage />
          </LazyWrap>
        ),
      },
      {
        path: "webui",
        element: (
          <LazyWrap>
            <WebUIManagePage />
          </LazyWrap>
        ),
      },
    ],
  },
]);
