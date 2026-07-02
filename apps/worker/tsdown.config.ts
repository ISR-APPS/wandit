import { defineConfig } from "tsdown";

export default defineConfig({
  clean: true,
  entry: "./src/main.ts",
  format: "esm",
  noExternal: [/@my-better-t-app\/.*/],
  outDir: "./dist",
});
