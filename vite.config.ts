import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import dts from "vite-plugin-dts";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [
    react(),
    dts({
      include: ["src"],
      exclude: ["src/**/__tests__/**", "src/test/**"],
      tsconfigPath: "./tsconfig.json",
      rollupTypes: true,
    }),
  ],
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, "src/index.ts"),
        "testing/index": resolve(__dirname, "src/testing/index.ts"),
      },
      formats: ["es", "cjs"],
      fileName: (format, entryName) =>
        format === "es" ? `${entryName}.js` : `${entryName}.cjs`,
    },
    rollupOptions: {
      external: ["react", "react-dom", "react/jsx-runtime"],
    },
    sourcemap: true,
    cssCodeSplit: false,
  },
});
