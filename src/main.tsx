import ReactDOM from "react-dom/client";
import { Provider } from "react-redux";
import { RouterProvider } from "react-router-dom";
import { Toaster, toast } from "sonner";
import { store } from "@/app/store";
import { router } from "@/app/router";
import { ThemeBootstrap } from "@/components/layout/ThemeBootstrap";
import "@/styles/globals.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <Provider store={store}>
    <ThemeBootstrap />
    <RouterProvider router={router} />
    <Toaster
      position="bottom-right"
      closeButton
      duration={3000}
      theme="system"
      toastOptions={{
        style: {
          background: "hsl(var(--card))",
          color: "hsl(var(--card-foreground))",
          borderColor: "hsl(var(--border))",
        },
      }}
    />
  </Provider>,
);

export { toast };
