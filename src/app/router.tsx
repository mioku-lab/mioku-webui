import { Navigate, createBrowserRouter } from "react-router-dom";
import { Suspense, lazy, type ReactNode } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { getAuthToken } from "@/lib/api";
import { RouteError } from "@/components/layout/RouteError";

const LoginPage = lazy(() =>
  import("@/features/auth/LoginPage").then((m) => ({ default: m.LoginPage })),
);
const DashboardPage = lazy(() =>
  import("@/features/dashboard/DashboardPage").then((m) => ({
    default: m.DashboardPage,
  })),
);
const MiokuConfigPage = lazy(() =>
  import("@/features/mioku/MiokuConfigPage").then((m) => ({
    default: m.MiokuConfigPage,
  })),
);
const PluginManagePage = lazy(() =>
  import("@/features/management/PluginManagePage").then((m) => ({
    default: m.PluginManagePage,
  })),
);
const ServiceManagePage = lazy(() =>
  import("@/features/management/ServiceManagePage").then((m) => ({
    default: m.ServiceManagePage,
  })),
);
const PluginConfigPage = lazy(() =>
  import("@/features/plugin-config/PluginConfigPage").then((m) => ({
    default: m.PluginConfigPage,
  })),
);
const DatabasePage = lazy(() =>
  import("@/features/database/DatabasePage").then((m) => ({
    default: m.DatabasePage,
  })),
);
const WebUIManagePage = lazy(() =>
  import("@/features/webui/WebUIManagePage").then((m) => ({
    default: m.WebUIManagePage,
  })),
);
const AIConfigPage = lazy(() =>
  import("@/features/ai/AIConfigPage").then((m) => ({
    default: m.AIConfigPage,
  })),
);

function Protected({ children }: { children: ReactNode }) {
  const token = getAuthToken();
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function LazyWrap({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="p-4 text-sm text-muted-foreground">加载中...</div>
      }
    >
      {children}
    </Suspense>
  );
}

export const router = createBrowserRouter([
  {
    path: "/login",
    errorElement: <RouteError />,
    element: (
      <LazyWrap>
        <LoginPage />
      </LazyWrap>
    ),
  },
  {
    path: "/",
    errorElement: <RouteError />,
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
        path: "config",
        element: (
          <LazyWrap>
            <MiokuConfigPage />
          </LazyWrap>
        ),
      },
      {
        path: "plugins",
        element: (
          <LazyWrap>
            <PluginManagePage />
          </LazyWrap>
        ),
      },
      {
        path: "services",
        element: (
          <LazyWrap>
            <ServiceManagePage />
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
        path: "ai",
        element: (
          <LazyWrap>
            <AIConfigPage />
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
