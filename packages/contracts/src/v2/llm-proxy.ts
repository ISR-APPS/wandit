/**
 * Shared contract for the V2 LLM proxy (`/api/v2/llm/*`).
 * The API mints short-lived run tokens for sandboxes, verifies them on each
 * proxied call, and prices usage against the shared tables here.
 * WANDIT-174 imports the price and status types for settlement.
 */
import { z } from "zod";

import { type BillingPlanId, billingPlanIdSchema } from "../v1/billing";
import { uuidSchema } from "../v1/shared/primitives";

/**
 * Claims inside a signed LLM run token. The token is the only auth on the
 * proxy route; the sandbox never sees the provider key.
 */
export const llmProxyTokenClaimsSchema = z.object({
	// Trigger.dev run id of the builder turn that owns the token.
	runId: z.string().min(1),
	// `builder_turns.id` for the turn; ties usage rows to one turn attempt.
	turnId: uuidSchema,
	userId: z.string().min(1),
	projectId: uuidSchema,
	// Organization id; null when the project lives in a personal workspace.
	workspaceId: z.string().min(1).nullable(),
	plan: billingPlanIdSchema,
	// Per-run spend ceiling in USD. Decimal dollars, for example 0.5.
	capUsd: z.number().nonnegative(),
	// Expiry in unix seconds. The API mints exp = now + 65 minutes so a
	// 60-minute turn never loses its token mid-call.
	exp: z.int().positive(),
});

/** TypeScript run-token claims type. */
export type LlmProxyTokenClaims = z.infer<typeof llmProxyTokenClaimsSchema>;

/**
 * Anthropic and OpenAI inbound shapes the proxy accepts. `openai` is
 * reserved for the OpenCode follow-up; no route reads it yet.
 */
export const llmProxyInboundFormats = ["anthropic", "openai"] as const;

/** Zod schema for `llmProxyInboundFormats`. */
export const llmProxyInboundFormatSchema = z.enum(llmProxyInboundFormats);

/** TypeScript inbound-format type. */
export type LlmProxyInboundFormat = z.infer<typeof llmProxyInboundFormatSchema>;

/**
 * Every status an `llm_proxy_requests` row can hold. Matches the
 * `llm_proxy_request_status` database enum one to one.
 */
export const llmProxyRequestStatuses = [
	"ok",
	"upstream_error",
	"cap_rejected",
	"model_denied",
	"client_aborted",
	"rate_limited",
] as const;

/** Zod schema for `llmProxyRequestStatuses`. */
export const llmProxyRequestStatusSchema = z.enum(llmProxyRequestStatuses);

/** TypeScript proxy-request status type. */
export type LlmProxyRequestStatus = z.infer<typeof llmProxyRequestStatusSchema>;

/**
 * One row of the model price table, in USD per million tokens. Cache prices
 * use the provider's 1-hour cache-write rate where two rates exist.
 */
export const llmModelPriceSchema = z.object({
	// Provider of the model, for example `anthropic`.
	provider: z.string().min(1),
	// Allow-list model id, for example `anthropic/claude-sonnet-5`.
	modelId: z.string().min(1),
	inputUsdPerMTok: z.number().nonnegative(),
	outputUsdPerMTok: z.number().nonnegative(),
	// Zero when the provider has no prompt-cache read rate.
	cacheReadUsdPerMTok: z.number().nonnegative(),
	// 1-hour cache-write rate; zero when the provider has no cache writes.
	cacheWriteUsdPerMTok: z.number().nonnegative(),
});

/** TypeScript price-row type. */
export type LlmModelPrice = z.infer<typeof llmModelPriceSchema>;

/** Validates a plan → model-id map; every billing plan must appear. */
export const llmProxyModelAllowListSchema = z.record(
	billingPlanIdSchema,
	z.array(z.string().min(1)),
);

/**
 * Anthropic models each plan may call beyond the deploy default.
 * `allowedLlmModels` adds `V2_DEFAULT_MODEL` for every plan at call time.
 * The `billing_plan` enum has no `free` value; starter is the free tier.
 * Claude Code runs its subagents and helper calls on haiku, on every plan.
 */
export const llmProxyAllowedModels = {
	starter: ["anthropic/claude-haiku-4-5"],
	pro: ["anthropic/claude-sonnet-5", "anthropic/claude-haiku-4-5"],
	business: [
		"anthropic/claude-sonnet-5",
		"anthropic/claude-opus-5",
		"anthropic/claude-haiku-4-5",
	],
} as const satisfies Record<BillingPlanId, readonly string[]>;

/**
 * Model ids a plan may send to the proxy: the deploy's `V2_DEFAULT_MODEL`
 * plus the plan's paid list. The proxy rejects any other named model.
 */
export function allowedLlmModels(
	plan: BillingPlanId,
	defaultModel: string,
): string[] {
	return [...new Set([defaultModel, ...llmProxyAllowedModels[plan]])];
}
