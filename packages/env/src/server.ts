import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
	server: {
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
		QUEUE_ENABLED: z
			.enum(["true", "false"])
			.default("false")
			.transform((value) => value === "true"),
		QUEUE_PREFIX: z.string().min(1).default("isr-ai"),
		REDIS_URL: z.url().default("redis://127.0.0.1:6379"),
		STRIPE_SECRET_KEY: z.string().startsWith("sk_").optional(),
		STRIPE_WEBHOOK_SECRET: z.string().startsWith("whsec_").optional(),
		OPENPROVIDER_API_URL: z.url().optional(),
		OPENPROVIDER_USERNAME: z.string().min(1).optional(),
		OPENPROVIDER_PASSWORD: z.string().min(1).optional(),
		CLOUDFLARE_API_TOKEN: z.string().min(1).optional(),
		CLOUDFLARE_KV_NAMESPACE_ID: z.string().min(1).optional(),
		CLOUDFLARE_ZONE_ID_WANDIT_APP: z.string().min(1).optional(),
		DOMAINS_FALLBACK_ORIGIN: z.string().min(1).default("customers.wandit.app"),
	},
	runtimeEnv: process.env,
	skipValidation: !!process.env.SKIP_ENV_VALIDATION,
	emptyStringAsUndefined: true,
});
