/**
 * Test configuration for the server spec suite.
 * Vitest reads this file when `vitest run` starts in `apps/server`.
 * It sets the env values that the specs read and the spec file pattern.
 */
import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "node",
		// With SKIP_ENV_VALIDATION the env object is the raw process.env, so no
		// zod default applies. CI has no apps/server/.env. These placeholders
		// replace the values the specs read. None is a real secret.
		env: {
			ADMIN_EMAILS: "admin@wandit.test",
			AI_CHAT_MODEL: "openai/gpt-4o-mini",
			AI_IMAGE_MODEL: "test-provider/test-image-model",
			BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret-1234",
			BETTER_AUTH_URL: "http://localhost:3000",
			CORS_ORIGIN: "http://web.test",
			DATABASE_URL: "postgres://user:pass@127.0.0.1:5432/test",
			GOOGLE_CLIENT_ID: "google-client-id.test",
			GOOGLE_CLIENT_SECRET: "google-client-secret.test",
			NODE_ENV: "test",
			REDIS_URL: "redis://127.0.0.1:6379",
			SITES_DOMAIN: "wandit.app",
			SKIP_ENV_VALIDATION: "true",
		},
		include: ["src/**/*.spec.ts"],
	},
});
