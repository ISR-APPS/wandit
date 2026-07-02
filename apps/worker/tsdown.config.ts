import { defineConfig } from "tsdown";

export default defineConfig({
	clean: true,
	entry: "./src/main.ts",
	format: "esm",
	noExternal: [/@wandit\/.*/],
	outDir: "./dist",
});
