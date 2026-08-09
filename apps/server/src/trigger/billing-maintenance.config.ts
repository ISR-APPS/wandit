// Ensure the repository's standard .env lookup runs before task assertions.
import "@wandit/env/server";

import { parseLlmProviderOverrides } from "@wandit/env/llm-routing";

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
	// Media generations always reconcile against the Vercel gateway; when any
	// text task runs on OpenRouter its refs additionally need that key.
	requiredValue("AI_GATEWAY_API_KEY");

	const { overrides } = parseLlmProviderOverrides(
		process.env.AI_PROVIDER_OVERRIDES,
	);
	const usesOpenRouter =
		process.env.AI_PROVIDER === "openrouter" ||
		Object.values(overrides).includes("openrouter");

	if (usesOpenRouter) {
		requiredValue("OPENROUTER_API_KEY");
	}
}

function requiredValue(name: string): string {
	const value = process.env[name];

	if (typeof value !== "string" || value.trim().length === 0) {
		throw new Error(`${name} is required for this Trigger task`);
	}

	return value;
}
