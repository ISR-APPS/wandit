/**
 * Vitest config for the observability package specs.
 * Called by `pnpm -F @wandit/observability test` and by `turbo run test`.
 */
import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "node",
		include: ["src/**/*.spec.ts"],
	},
});
