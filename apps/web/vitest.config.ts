/**
 * Vitest config of the web app. `pnpm -F web test` reads it. It does not
 * load vite.config.ts, so it repeats the aliases and the build constants
 * that the specs need.
 */
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
	// Specs run the V2 code, like a local build. vite.config.ts sets the build value.
	define: { __V2_BUILDER_IN_BUILD__: "true" },
	resolve: {
		// Match Vite: workspace packages declare React as a peer, so their bare
		// imports must resolve to the web app's single React installation.
		dedupe: ["react", "react-dom"],
		// Mirror the app's "@/… → src/…" import alias so pure-lib specs can
		// exercise modules that reach into shared utilities.
		alias: {
			"@": fileURLToPath(new URL("./src", import.meta.url)),
		},
	},
	test: {
		environment: "node",
		include: ["src/**/*.spec.ts"],
	},
});
