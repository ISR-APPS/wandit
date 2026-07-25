import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
	resolve: {
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
