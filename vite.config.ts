import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import fs from "node:fs";

const DIST_DIR = path.resolve(__dirname, "../packages/mioku-service-webui/dist");
const VERSION_FILE = path.join(DIST_DIR, ".webui-version");

function writeWebUIVersion() {
  const pkgPath = path.join(__dirname, "package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
  const version = pkg.version || "unknown";
  fs.writeFileSync(VERSION_FILE, `${version}\n`, "utf-8");
  console.log(`[webui] wrote version ${version} to ${VERSION_FILE}`);
}

writeWebUIVersion();

export default defineConfig({
  plugins: [
    react(),
    {
      name: "write-webui-version",
      closeBundle() {
        writeWebUIVersion();
      },
    },
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  build: {
    outDir: DIST_DIR,
    emptyOutDir: true,
  },
  server: {
    port: 5178,
  },
});
