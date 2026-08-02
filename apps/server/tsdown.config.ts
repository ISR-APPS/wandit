import { defineConfig } from "tsdown";

export default defineConfig({
	// instrument.ts is its own entry: the start command preloads it with
	// `node --import` so Sentry initializes before ANY external import
	// (@nestjs/core, fastify, ai, pg) evaluates. A top-of-main import is not
	// enough in the bundle — ESM hoists external imports above inlined code,
	// so OTel would patch nothing in production while dev looks fine.
	entry: ["./src/main.ts", "./src/instrument.ts"],
	format: "esm",
	outDir: "./dist",
	clean: true,
	// @sentry/* must stay external (they are in dependencies): if the SDK is
	// inlined it can't run before the externals it needs to patch.
	noExternal: [/@wandit\/.*/],
	// For Sentry stack traces. Maps stay on the Railway image (dist/ is not
	// served); upload to Sentry can be added to the build script later.
	sourcemap: true,
});
