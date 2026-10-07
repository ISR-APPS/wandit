/**
 * Build-time env of the web app. Vite inlines each VITE_* value into the bundle.
 * Six files in apps/web import `env`, for example main.tsx and server-url.ts.
 * Zod validates the values through @t3-oss/env-core.
 */
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
		// Optional override for the browser release. Must match the sourcemap
		// upload name exactly — "wandit-web@<full-sha>" — or stacks stay
		// minified. Unset = the Sentry vite plugin's injected release is used.
		VITE_SENTRY_RELEASE: z
			.string()
			.min(1)
			.refine((value) => !value.endsWith("@"), {
				message: "must include a version after '@'",
			})
			.optional(),
		// PostHog product analytics. Unset = analytics disabled (local dev).
		VITE_POSTHOG_KEY: z.string().startsWith("phc_").optional(),
		// Defaults to the EU cloud in the package when unset.
		// Staging sets https://preview.wandit.dev/lumen. apps/web/vercel.json proxies
		// that path to PostHog, because ad blockers block the PostHog hosts.
		VITE_POSTHOG_HOST: z.url().optional(),
		// Cloudflare Turnstile site key. Unset = no captcha widget; must match
		// the server's TURNSTILE_SECRET_KEY pair when email auth is live.
		VITE_TURNSTILE_SITE_KEY: z.string().min(1).optional(),
		// Chatwoot live chat (website inbox). Both unset = widget not loaded
		// (local dev). BASE_URL is the Chatwoot installation, e.g.
		// https://app.chatwoot.com; the token is the inbox's public website token.
		VITE_CHATWOOT_BASE_URL: z.url().optional(),
		VITE_CHATWOOT_WEBSITE_TOKEN: z.string().min(1).optional(),
	},
	// SAFETY: Vite sets import.meta.env in the web build. This package has no Vite types.
	runtimeEnv: (
		import.meta as ImportMeta & { env: Record<string, string | undefined> }
	).env,
	skipValidation: !!process.env.SKIP_ENV_VALIDATION,
	emptyStringAsUndefined: true,
});
