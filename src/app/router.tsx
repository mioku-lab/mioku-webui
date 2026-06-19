import { createBrowserRouter } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { RouteError } from "@/components/layout/RouteError";
import {
  AboutPage,
  AIConfigPage,
  AIUsagePage,
  DashboardPage,
  DataManagementPage,
  LazyWrap,
  LoginPage,
  MiokuConfigPage,
  PluginConfigPage,
  PluginManagePage,
  PluginStorePage,
  Protected,
  ServiceConfigPage,
  ServiceManagePage,
  WebUIManagePage,
} from "./router-elements";

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
        path: "service-config",
        element: (
          <LazyWrap>
            <ServiceConfigPage />
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
        path: "ai-usage",
        element: (
          <LazyWrap>
            <AIUsagePage />
          </LazyWrap>
        ),
      },
      {
        path: "data-management",
        element: (
          <LazyWrap>
            <DataManagementPage />
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
      {
        path: "about",
        element: (
          <LazyWrap>
            <AboutPage />
          </LazyWrap>
        ),
      },
      {
        path: "store",
        element: (
          <LazyWrap>
            <PluginStorePage />
          </LazyWrap>
        ),
      },
    ],
  },
]);
