import { Navigate } from "react-router-dom";
import { Suspense, lazy, type ReactNode } from "react";
import { getAuthToken } from "@/lib/api";

export const LoginPage = lazy(() =>
  import("@/features/auth/LoginPage").then((m) => ({ default: m.LoginPage })),
);
export const DashboardPage = lazy(() =>
  import("@/features/dashboard/DashboardPage").then((m) => ({
    default: m.DashboardPage,
  })),
);
export const MiokuConfigPage = lazy(() =>
  import("@/features/mioku/MiokuConfigPage").then((m) => ({
    default: m.MiokuConfigPage,
  })),
);
export const PluginManagePage = lazy(() =>
  import("@/features/management/PluginManagePage").then((m) => ({
    default: m.PluginManagePage,
  })),
);
export const ServiceManagePage = lazy(() =>
  import("@/features/management/ServiceManagePage").then((m) => ({
    default: m.ServiceManagePage,
  })),
);
export const PluginConfigPage = lazy(() =>
  import("@/features/plugin-config/PluginConfigPage").then((m) => ({
    default: m.PluginConfigPage,
  })),
);
export const DataManagementPage = lazy(() =>
  import("@/features/data-management/DataManagementPage").then((m) => ({
    default: m.DataManagementPage,
  })),
);
export const WebUIManagePage = lazy(() =>
  import("@/features/webui/WebUIManagePage").then((m) => ({
    default: m.WebUIManagePage,
  })),
);
export const AIConfigPage = lazy(() =>
  import("@/features/ai/AIConfigPage").then((m) => ({
    default: m.AIConfigPage,
  })),
);
export const AIUsagePage = lazy(() =>
  import("@/features/ai-usage/AIUsagePage").then((m) => ({
    default: m.AIUsagePage,
  })),
);
export const AboutPage = lazy(() =>
  import("@/features/about/AboutPage").then((m) => ({
    default: m.AboutPage,
  })),
);
export const PluginStorePage = lazy(() =>
  import("@/features/store/PluginStorePage").then((m) => ({
    default: m.PluginStorePage,
  })),
);

export function Protected({ children }: { children: ReactNode }) {
  const token = getAuthToken();
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

export function LazyWrap({ children }: { children: ReactNode }) {
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
