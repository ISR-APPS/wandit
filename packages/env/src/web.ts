import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
	clientPrefix: "VITE_",
	client: {
		VITE_SERVER_URL: z.url(),
		// Sentry error tracking. Unset = Sentry disabled (local dev).
		VITE_SENTRY_DSN: z.url().optional(),
		// Overrides the MODE-based guess so Railway preview builds report as
		// "preview" instead of "production".
		VITE_SENTRY_ENVIRONMENT: z
			.enum(["production", "preview", "development"])
			.optional(),
		// PostHog product analytics. Unset = analytics disabled (local dev).
		VITE_POSTHOG_KEY: z.string().startsWith("phc_").optional(),
		// Defaults to the EU cloud in the package when unset.
		VITE_POSTHOG_HOST: z.url().optional(),
	},
	runtimeEnv: (import.meta as any).env,
	skipValidation: !!process.env.SKIP_ENV_VALIDATION,
	emptyStringAsUndefined: true,
});
