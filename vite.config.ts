import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import fs from "node:fs";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const DIST_DIR = path.resolve(__dirname, "../packages/mioku-service-webui/dist");

function writeWebUIVersion() {
  const pkgPath = path.join(__dirname, "package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
  const version = pkg.version || "unknown";
  const versionFile = path.join(DIST_DIR, ".webui-version");
  mkdirSync(dirname(versionFile), { recursive: true });
  writeFileSync(versionFile, `${version}\n`, "utf-8");
  console.log(`[webui] wrote version ${version} to ${versionFile}`);
}

export default defineConfig({
  plugins: [
    react(),
    {
      name: "write-webui-version",
      buildStart() {
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
