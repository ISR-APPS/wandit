// Ensure the repository's standard .env lookup runs before task assertions.
import "@wandit/env/server";

import { LLM_TASKS, parseLlmProviderOverrides } from "@wandit/env/llm-routing";

import { assertDatabaseConfiguration } from "./domain-operations.config";

export function assertBillingDatabaseConfiguration(): void {
	assertDatabaseConfiguration();
}

/** Stripe-backed refill, webhook, and affiliate tasks fail before opening DB. */
export function assertBillingFinancialConfiguration(): void {
	assertDatabaseConfiguration();
	requiredValue("STRIPE_SECRET_KEY");
}

/** Reconciliation contacts AI Gateway after selecting durable generation refs. */
export function assertMeteringConfiguration(): void {
	assertDatabaseConfiguration();

	const { overrides } = parseLlmProviderOverrides(
		process.env.AI_PROVIDER_OVERRIDES,
	);
	const defaultProvider =
		process.env.AI_PROVIDER === "openrouter" ? "openrouter" : "vercel";
	const usesOpenRouter =
		defaultProvider === "openrouter" ||
		Object.values(overrides).includes("openrouter");
	// Any text task effectively routed to the Vercel gateway needs its key.
	const usesVercelText = LLM_TASKS.some(
		(task) => (overrides[task] ?? defaultProvider) !== "openrouter",
	);
	// Media generations (image edit/generation) always reconcile
	// against the Vercel gateway — gate on the same env switches that enable
	// those features.
	const gatewayMediaEnabled = [
		process.env.AI_IMAGE_MODEL,
		process.env.AI_IMAGE_EDIT_MODEL,
	].some((value) => typeof value === "string" && value.trim().length > 0);

	if (usesVercelText || gatewayMediaEnabled) {
		requiredValue("AI_GATEWAY_API_KEY");
	}

	if (usesOpenRouter) {
		requiredValue("OPENROUTER_API_KEY");
	}

	// A reconciler with neither key can never resolve any generation ref.
	if (!hasValue("AI_GATEWAY_API_KEY") && !hasValue("OPENROUTER_API_KEY")) {
		throw new Error(
			"AI_GATEWAY_API_KEY or OPENROUTER_API_KEY is required for this Trigger task",
		);
	}
}

function requiredValue(name: string): string {
	const value = process.env[name];

	if (typeof value !== "string" || value.trim().length === 0) {
		throw new Error(`${name} is required for this Trigger task`);
	}

	return value;
}

function hasValue(name: string): boolean {
	const value = process.env[name];

	return typeof value === "string" && value.trim().length > 0;
}
