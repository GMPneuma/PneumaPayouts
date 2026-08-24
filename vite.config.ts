import { defineConfig } from "vite";

export default defineConfig({
  publicDir: "static",
  build: {
    emptyOutDir: true,
    lib: {
      entry: "src/main.ts",
      formats: ["es"],
      fileName: () => "scripts/pneuma-payouts.js",
    },
    rollupOptions: {
      output: {
        assetFileNames: (assetInfo) =>
          assetInfo.name?.endsWith(".css")
            ? "styles/pneuma-payouts.css"
            : "assets/[name]-[hash][extname]",
      },
    },
    sourcemap: true,
  },
});
