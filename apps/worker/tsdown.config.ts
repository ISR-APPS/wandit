import { defineConfig } from "tsdown";

export default defineConfig({
	clean: true,
	// instrument.ts is its own entry: the start command preloads it with
	// `node --import` so Sentry initializes before ANY external import
	// (@nestjs/core, bullmq, ioredis) evaluates — in the bundle, a top-of-main
	// import is hoisted below externals and OTel would patch nothing.
	entry: ["./src/main.ts", "./src/instrument.ts"],
	format: "esm",
	noExternal: [/@wandit\/.*/],
	outDir: "./dist",
	// For Sentry stack traces (dist/ is never served).
	sourcemap: true,
});
