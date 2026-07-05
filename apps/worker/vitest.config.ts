import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "node",
		env: {
			NODE_ENV: "test",
			SKIP_ENV_VALIDATION: "true",
		},
		include: ["src/**/*.spec.ts"],
	},
});
