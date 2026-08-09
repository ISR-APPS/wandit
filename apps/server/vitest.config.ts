import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "node",
		env: {
			CORS_ORIGIN: "http://web.test",
			NODE_ENV: "test",
			REDIS_URL: "redis://127.0.0.1:6379",
			SITES_DOMAIN: "wandit.app",
			SKIP_ENV_VALIDATION: "true",
		},
		include: ["src/**/*.spec.ts"],
	},
});
