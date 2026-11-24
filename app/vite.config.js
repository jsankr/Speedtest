import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

// One self-contained index.html (React, styles, fonts inlined) so the app still deploys as a single file
// and works offline once installed. scripts/place.mjs copies it to the repository root.
export default defineConfig({
  plugins: [react(), viteSingleFile({ removeViteModuleLoader: true })],
  build: { target: "es2020", assetsInlineLimit: 100000000, cssCodeSplit: false, reportCompressedSize: false },
  server: { fs: { allow: [".."] } },
});
