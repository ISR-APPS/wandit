// Server-side environment config.
//
// API, worker, auth, Redis, queue, and database code import values from here.
// Zod validates process.env so the app fails early when required config is bad.
//
// AI_GATEWAY_API_KEY is optional at startup, but AI generation/transcription
// will fail later if it is missing.
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createEnv } from "@t3-oss/env-core";
import { config } from "dotenv";
import { z } from "zod";
import { corsExtraOriginsSchema } from "./cors-origins";
import { parseLlmProviderOverrides } from "./llm-routing";

// Build paths from this file location so loading works from different cwd values.
const currentDir = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(currentDir, "..");
const workspaceRoot = resolve(packageRoot, "../..");

// Try several possible .env file locations.
const envFileCandidates = [
	...(process.env.ENV_FILE
		? [resolve(process.cwd(), process.env.ENV_FILE)]
		: []),
	resolve(workspaceRoot, "apps/server/.env"),
	resolve(process.cwd(), "apps/server/.env"),
	resolve(process.cwd(), ".env"),
];

// Load each existing env file. Existing process env values win.
for (const envFile of new Set(envFileCandidates)) {
	if (existsSync(envFile)) {
		config({ path: envFile });
	}
}

/**
 * Cross-field rules the per-variable schemas cannot express. Exported so the
 * rules are unit-testable without booting createEnv against process.env.
 */
export function refineServerEnv(
	values: { GENERATION_BILLING_MODE?: string; NODE_ENV?: string },
	ctx: {
		addIssue: (issue: {
			code: "custom";
			message: string;
			path?: string[];
		}) => void;
	},
): void {
	// Billing off in production silently gives every operation away for free.
	if (
		values.NODE_ENV === "production" &&
		values.GENERATION_BILLING_MODE === "off"
	) {
		ctx.addIssue({
			code: "custom",
			message:
				"GENERATION_BILLING_MODE=off is not allowed when NODE_ENV=production",
			path: ["GENERATION_BILLING_MODE"],
		});
	}
}

// Validated config object. Other code should import `env` instead of process.env.
export const env = createEnv({
	createFinalSchema: (shape) => z.object(shape).superRefine(refineServerEnv),
	server: {
		// AI model settings.
		AI_CHAT_MODEL: z.string().min(1).default("openai/gpt-4o-mini"),
		AI_TITLE_MODEL: z.string().min(1).default("openai/gpt-5.6-luna"),
		AI_GATEWAY_API_KEY: z.string().min(1).optional(),
		// Default provider for TEXT-model traffic (chat, page builds, titles,
		// marketing, prompt refinement). Media models (image/video/transcription)
		// always stay on the Vercel gateway. "openrouter" needs
		// OPENROUTER_API_KEY; model ids keep the Vercel `creator/model` form and
		// are translated at the provider boundary.
		AI_PROVIDER: z.enum(["openrouter", "vercel"]).default("vercel"),
		// Per-task exceptions to AI_PROVIDER, e.g.
		// "page_build=openrouter,project_title=openrouter". Tasks: chat,
		// marketing, page_build, project_title, prompt_refine. A task named here
		// runs on the given provider; every other task follows AI_PROVIDER.
		AI_PROVIDER_OVERRIDES: z
			.string()
			.optional()
			.superRefine((value, ctx) => {
				for (const error of parseLlmProviderOverrides(value).errors) {
					ctx.addIssue({ code: "custom", message: error });
				}
			}),
		OPENROUTER_API_KEY: z.string().min(1).optional(),
		// Optional: the builder's generate_image tool. Needs R2 plus
		// R2_PUBLIC_BASE_URL too; unset means the tool answers "unavailable".
		AI_IMAGE_MODEL: z.string().min(1).optional(),
		// Optional: multimodal model used when a generation EDITS user-provided
		// source images (product photo, logo). Must accept image inputs and
		// return image outputs through generateText (e.g. a Gemini image
		// model). Unset means source-image requests degrade to text-only.
		AI_IMAGE_EDIT_MODEL: z.string().min(1).optional(),
		// Optional override for marketing HTML documents; falls back to
		// AI_CHAT_MODEL when unset.
		AI_MARKETING_MODEL: z.string().min(1).optional(),
		// Rewrites the brain's Higgsfield image/video intent into a polished
		// generation prompt before the MCP call. Falls back to the raw prompt
		// when it cannot run (no gateway key, timeout, error).
		AI_PROMPT_REFINER_MODEL: z.string().min(1).default("openai/gpt-5.6-luna"),
		AI_TRANSCRIPTION_MODEL: z
			.string()
			.min(1)
			.default("openai/gpt-4o-mini-transcribe"),
		// USD of provider cost per WHOLE credit. Settlement debits integer
		// centi-credits (1 credit = 100 cc); the conversion function owns the
		// x100, so this value stays per whole credit. $0.04/credit is the
		// pricing v5 anchor: 1 credit = $0.04 of provider cost, so the 50-credit
		// signup grant carries $2.00 of provider value.
		AI_USD_PER_CREDIT: z.coerce.number().positive().default(0.04),
		// Page generation foundation (Trigger.dev queue + Cloudflare R2 storage).
		// All optional: the server must boot before these creds exist; the
		// generate_page tool checks at call time and answers gracefully when
		// unconfigured.
		//
		// AI_PAGE_BUILDER_MODEL is the explicit new name. The older
		// AI_PAGE_DESIGN_MODEL remains as a fallback so existing deployments and
		// .env files keep working during the migration.
		AI_PAGE_BUILDER_MODEL: z.string().min(1).optional(),
		AI_PAGE_DESIGN_MODEL: z
			.string()
			.min(1)
			.default("anthropic/claude-sonnet-5"),
		// Builder reasoning knob, read at build time inside runSiteBuild() and
		// forwarded as providerOptions (openai.reasoningEffort; mapped onto
		// Gemini's two thinking levels and Grok's three efforts). "auto" sends
		// no reasoning parameter at all — the provider picks. Defaults to
		// "high": an unset var once silently meant provider-default effort (a
		// misnamed .env entry hid the knob for weeks) — design quality must
		// never again depend on a typo, so turning it off is an explicit value.
		AI_PAGE_DESIGN_REASONING: z
			.enum(["auto", "minimal", "low", "medium", "high", "xhigh"])
			.default("high"),
		// Optional: the "creative director" that rewrites a video brief into one
		// domain-language provider prompt at queue time. Falls back to
		// AI_PROMPT_REFINER_MODEL; failures degrade to a deterministic prompt,
		// never blocking a paid generation.
		AI_VIDEO_DIRECTOR_MODEL: z.string().min(1).optional(),
		TRIGGER_SECRET_KEY: z.string().min(1).optional(),
		// Lead scraping (scrape_leads chat tool). Serper.dev key for the Google
		// Maps business search. Optional: the tool checks at call time and
		// answers "unavailable" until the key exists (same contract as R2).
		SERPER_API_KEY: z.string().min(1).optional(),
		// Provider cost of one Serper Maps page (USD micros): $0.001 on the
		// Starter plan. Recorded on lead_scrape events as provider cost; the
		// customer price is the per-lead product price, not this.
		SERPER_USD_MICROS_PER_SEARCH: z.coerce
			.number()
			.int()
			.nonnegative()
			.default(1000),
		R2_ACCOUNT_ID: z.string().min(1).optional(),
		R2_ACCESS_KEY_ID: z.string().min(1).optional(),
		R2_SECRET_ACCESS_KEY: z.string().min(1).optional(),
		R2_BUCKET: z.string().min(1).optional(),
		// Public base URL of the bucket (Cloudflare public dev URL or custom
		// domain) — generated images need a browser-reachable URL.
		R2_PUBLIC_BASE_URL: z.url().optional(),
		// Core API/auth settings.
		// Admin dashboard origin (apps/admin). Optional: unset means no admin
		// origin is trusted for CORS/auth.
		ADMIN_ORIGIN: z.url().optional(),
		// Comma-separated emails auto-promoted to the admin role on signup.
		ADMIN_EMAILS: z.string().optional(),
		DATABASE_URL: z.string().min(1),
		BETTER_AUTH_SECRET: z.string().min(32),
		BETTER_AUTH_URL: z.url(),
		// The single canonical web origin used as a URL base by server features.
		CORS_ORIGIN: z.url(),
		// Optional aliases that can call the API but are never canonical URL bases.
		CORS_EXTRA_ORIGINS: corsExtraOriginsSchema,
		GOOGLE_CLIENT_ID: z.string().min(1),
		GOOGLE_CLIENT_SECRET: z.string().min(1),
		// Email auth + invitation delivery (Resend). All optional: without a
		// key, non-production logs magic links/OTPs to the server console and
		// production refuses email sends with a loud error. The feature is
		// additionally dark behind the emailAuthEnabled product setting.
		RESEND_API_KEY: z.string().min(1).optional(),
		// RFC 5322 From for outgoing auth/invite mail. The resend.dev sender
		// only delivers to the Resend account owner's inbox — set a verified
		// domain sender before enabling email auth for real users.
		EMAIL_FROM: z.string().min(1).default("Wandit <onboarding@resend.dev>"),
		// Cloudflare Turnstile server secret. Unset = captcha plugin not
		// registered (local dev); set in any env that exposes email auth.
		TURNSTILE_SECRET_KEY: z.string().min(1).optional(),
		// Chatwoot website-inbox HMAC secret (Inbox > Configuration > Identity
		// Validation). Signs the user id the widget sends, so a visitor cannot
		// impersonate another account. Unset = identity sent without a hash
		// (local dev). Never ship this to the browser.
		CHATWOOT_HMAC_TOKEN: z.string().min(1).optional(),
		// Comma-separated CIDRs of the proxies in front of this API (the
		// platform edge, Cloudflare, a load balancer). REQUIRED in any
		// deployment that terminates behind a proxy: Better Auth refuses to
		// trust a multi-hop X-Forwarded-For without it, and an unresolvable
		// client IP makes every caller share ONE rate-limit bucket — which a
		// single client can then exhaust for everybody, Google sign-in
		// included. With it set, the address is taken from the last hop the
		// proxy actually appended, so a spoofed header cannot shift it.
		TRUSTED_PROXY_CIDRS: z.string().optional(),
		META_APP_ID: z.string().min(1).optional(),
		META_APP_SECRET: z.string().min(1).optional(),
		NODE_ENV: z
			.enum(["development", "production", "test"])
			.default("development"),
		PORT: z.coerce.number().int().positive().default(3000),
		// Queue/Redis settings. API and worker must share these values.
		QUEUE_ENABLED: z
			.enum(["true", "false"])
			.default("false")
			.transform((value) => value === "true"),
		QUEUE_PREFIX: z.string().min(1).default("isr-ai"),
		REDIS_URL: z.url().default("redis://127.0.0.1:6379"),
		// Billing mode. `off` is useful for local/dev.
		GENERATION_BILLING_MODE: z.enum(["enforce", "off"]).default("enforce"),
		// Stripe is optional at boot.
		STRIPE_SECRET_KEY: z.string().startsWith("sk_").optional(),
		STRIPE_PORTAL_CONFIGURATION_ID: z.string().startsWith("bpc_").optional(),
		STRIPE_WEBHOOK_SECRET: z.string().startsWith("whsec_").optional(),
		// Domain/Cloudflare settings are optional for chat-only flows.
		// Sandbox is the safe default: switching to production requires one
		// explicit environment change plus production-only credentials.
		NAMECOM_ENVIRONMENT: z.enum(["sandbox", "production"]).default("sandbox"),
		NAMECOM_USERNAME: z.string().min(1).optional(),
		NAMECOM_API_TOKEN: z.string().min(1).optional(),
		CLOUDFLARE_API_TOKEN: z.string().min(1).optional(),
		CLOUDFLARE_KV_NAMESPACE_ID: z.string().min(1).optional(),
		CLOUDFLARE_ZONE_ID_WANDIT_APP: z.string().min(1).optional(),
		// Account that hosts the per-domain Cloudflare zones created for the
		// apex of purchased domains (POST /zones needs it). Unset means the apex
		// zone step records an error and the domain stays www-only.
		CLOUDFLARE_ACCOUNT_ID: z.string().min(1).optional(),
		// Kill switch for the purchased-domain apex zone step. "false" restores
		// the previous behavior exactly: Name.com URL forwarding for the apex.
		DOMAINS_APEX_ZONE_ENABLED: z
			.enum(["true", "false"])
			.default("true")
			.transform((value) => value === "true"),
		// Local API-only escape hatch. Hosted publishing must keep this false so
		// a missing edge-routing pointer cannot be reported as live.
		ALLOW_PUBLISH_WITHOUT_KV: z
			.enum(["true", "false"])
			.default("false")
			.transform((value) => value === "true"),
		DOMAINS_FALLBACK_ORIGIN: z.string().min(1).default("customers.wandit.app"),
		// Zone serving published customer sites: {slug}.SITES_DOMAIN.
		SITES_DOMAIN: z.string().min(1).default("wandit.app"),
		// Publish preflight over the final bytes: relative asset URLs and
		// provably-gone media (404/410/403) block the publish. "false" is the
		// emergency bypass when an asset host flaps and blocks every publish.
		SITE_PUBLISH_ASSET_CHECK: z
			.enum(["true", "false"])
			.default("true")
			.transform((value) => value === "true"),
		// Sentry error tracking. Unset DSN = Sentry disabled (local dev).
		SENTRY_DSN: z.url().optional(),
		SENTRY_ENVIRONMENT: z
			.enum(["production", "preview", "development"])
			.optional(),
		// Release tag, e.g. server@<RAILWAY_GIT_COMMIT_SHA>.
		SENTRY_RELEASE: z.string().min(1).optional(),
		// PostHog product analytics. Unset = analytics disabled (local dev).
		POSTHOG_KEY: z.string().startsWith("phc_").optional(),
		// Defaults to the EU cloud in the package when unset.
		POSTHOG_HOST: z.url().optional(),
		// Linear, for in-app user feedback. Unset = the feedback route answers
		// 503 while the rest of the API boots normally.
		LINEAR_API_KEY: z.string().min(1).optional(),
		LINEAR_FEEDBACK_TEAM_ID: z.string().min(1).optional(),
	},
	// Real data source for validation.
	runtimeEnv: process.env,
	// Escape hatch for tests/local scripts. Avoid in production.
	skipValidation: !!process.env.SKIP_ENV_VALIDATION,
	// Treat empty strings as missing values.
	emptyStringAsUndefined: true,
});
