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

// Validated config object. Other code should import `env` instead of process.env.
export const env = createEnv({
	server: {
		// AI model settings.
		AI_CHAT_MODEL: z.string().min(1).default("openai/gpt-4o-mini"),
		// One-shot structured creative direction between the chat Brain and the
		// Builder. Kept separate so models can be tested independently.
		AI_ART_DIRECTOR_MODEL: z
			.string()
			.min(1)
			.default("anthropic/claude-sonnet-5"),
		AI_GATEWAY_API_KEY: z.string().min(1).optional(),
		// Optional: the builder's generate_image tool. Needs R2 plus
		// R2_PUBLIC_BASE_URL too; unset means the tool answers "unavailable".
		AI_IMAGE_MODEL: z.string().min(1).optional(),
		AI_TRANSCRIPTION_MODEL: z
			.string()
			.min(1)
			.default("openai/gpt-4o-mini-transcribe"),
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
		// Optional: the builder's animate_image tool (image → short ambient video).
		// Needs R2 + R2_PUBLIC_BASE_URL too; unset means the tool answers
		// "unavailable".
		AI_VIDEO_MODEL: z.string().min(1).optional(),
		TRIGGER_SECRET_KEY: z.string().min(1).optional(),
		// Lead scraping (scrape_leads chat tool). Serper.dev key for the Google
		// Maps business search. Optional: the tool checks at call time and
		// answers "unavailable" until the key exists (same contract as R2).
		SERPER_API_KEY: z.string().min(1).optional(),
		R2_ACCOUNT_ID: z.string().min(1).optional(),
		R2_ACCESS_KEY_ID: z.string().min(1).optional(),
		R2_SECRET_ACCESS_KEY: z.string().min(1).optional(),
		R2_BUCKET: z.string().min(1).optional(),
		// Public base URL of the bucket (Cloudflare public dev URL or custom
		// domain) — generated images need a browser-reachable URL.
		R2_PUBLIC_BASE_URL: z.url().optional(),
		// Core API/auth settings.
		DATABASE_URL: z.string().min(1),
		BETTER_AUTH_SECRET: z.string().min(32),
		BETTER_AUTH_URL: z.url(),
		CORS_ORIGIN: z.url(),
		GOOGLE_CLIENT_ID: z.string().min(1),
		GOOGLE_CLIENT_SECRET: z.string().min(1),
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
		STRIPE_WEBHOOK_SECRET: z.string().startsWith("whsec_").optional(),
		// Domain/Cloudflare settings are optional for chat-only flows.
		OPENPROVIDER_API_URL: z.url().optional(),
		OPENPROVIDER_USERNAME: z.string().min(1).optional(),
		OPENPROVIDER_PASSWORD: z.string().min(1).optional(),
		CLOUDFLARE_API_TOKEN: z.string().min(1).optional(),
		CLOUDFLARE_KV_NAMESPACE_ID: z.string().min(1).optional(),
		CLOUDFLARE_ZONE_ID_WANDIT_APP: z.string().min(1).optional(),
		DOMAINS_FALLBACK_ORIGIN: z.string().min(1).default("customers.wandit.app"),
	},
	// Real data source for validation.
	runtimeEnv: process.env,
	// Escape hatch for tests/local scripts. Avoid in production.
	skipValidation: !!process.env.SKIP_ENV_VALIDATION,
	// Treat empty strings as missing values.
	emptyStringAsUndefined: true,
});
