// Ensure the repository's standard .env lookup runs before task assertions.
import "@wandit/env/server";

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
	requiredValue("AI_GATEWAY_API_KEY");
}

function requiredValue(name: string): string {
	const value = process.env[name];

	if (typeof value !== "string" || value.trim().length === 0) {
		throw new Error(`${name} is required for this Trigger task`);
	}

	return value;
}
