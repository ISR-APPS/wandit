import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
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
