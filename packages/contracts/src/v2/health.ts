/**
 * Shared contract for `GET /api/v2/health`.
 *
 * The API answers it; the response reports the rollout state and which V2
 * environment values exist. Booleans only — a secret value never leaves
 * the process.
 */
import { z } from "zod";

/**
 * The optional V2 environment values the health route reports. Kept
 * alphabetical; the API reads `env` keys by these names.
 */
export const v2EnvNames = [
	"ANTHROPIC_API_KEY",
	"APPETIZE_API_TOKEN",
	"APP_SECRETS_ENCRYPTION_KEY",
	"CLOUDFLARE_V2_DEPLOY_TOKEN",
	"CODE_STORAGE_ORG",
	"CODE_STORAGE_PRIVATE_KEY",
	"EXPO_TOKEN",
	"LLM_PROXY_SIGNING_KEY",
	"PREVIEW_DOMAIN",
	"PREVIEW_TOKEN_SIGNING_KEY",
	"RESEND_PLATFORM_API_KEY",
	"SUPABASE_PLATFORM_INSTANCE_SIZE",
	"SUPABASE_PLATFORM_ORG_ID",
	"SUPABASE_PLATFORM_REGION",
	"SUPABASE_PLATFORM_TOKEN",
	"V2_DEFAULT_MODEL",
	"V2_LLM_UPSTREAM_BASE_URL",
	"VERCEL_PROJECT_ID",
	"VERCEL_SANDBOX_IMAGE",
	"VERCEL_SANDBOX_TOKEN",
	"VERCEL_TEAM_ID",
] as const;

/** One name out of `v2EnvNames`; the API uses it to index `env`. */
export type V2EnvName = (typeof v2EnvNames)[number];

// One z.boolean() per name: the health response answers "is it set", never
// the value.
const envPresenceShape = Object.fromEntries(
	v2EnvNames.map((name) => [name, z.boolean()]),
	// SAFETY: the map above assigns exactly one ZodBoolean per V2EnvName key.
) as Record<V2EnvName, z.ZodBoolean>;

/**
 * Response of `GET /api/v2/health`. `enabled` is always literal `true` —
 * the route only exists when the module loaded, so it is a presence marker.
 */
export const v2HealthResponseSchema = z.object({
	enabled: z.literal(true),
	harness: z.enum(["claude-code", "opencode"]),
	// `V2_DEFAULT_MODEL`, or null when the deploy carries no default model.
	model: z.string().nullable(),
	env: z.object(envPresenceShape),
});

/** TypeScript health response type. */
export type V2HealthResponse = z.infer<typeof v2HealthResponseSchema>;
