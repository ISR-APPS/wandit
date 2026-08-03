import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	assertBillingDatabaseConfiguration,
	assertBillingFinancialConfiguration,
	assertMeteringConfiguration,
} from "./billing-maintenance.config";

const CONFIGURATION_KEYS = [
	"AI_GATEWAY_API_KEY",
	"DATABASE_URL",
	"STRIPE_SECRET_KEY",
] as const;

const VALID_CONFIGURATION = {
	AI_GATEWAY_API_KEY: "gateway-task-key",
	DATABASE_URL: "postgresql://task.test/database",
	STRIPE_SECRET_KEY: "sk_test_task",
} as const;

function setConfiguration(
	keys: readonly (keyof typeof VALID_CONFIGURATION)[],
): void {
	for (const key of keys) {
		vi.stubEnv(key, VALID_CONFIGURATION[key]);
	}
}

describe("billing maintenance task configuration", () => {
	beforeEach(() => {
		for (const key of CONFIGURATION_KEYS) {
			vi.stubEnv(key, "");
		}
	});

	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it("keeps DB-only maintenance independent of Stripe and AI Gateway", () => {
		setConfiguration(["DATABASE_URL"]);

		expect(() => assertBillingDatabaseConfiguration()).not.toThrow();
	});

	it("requires Stripe only for financial maintenance", () => {
		setConfiguration(["DATABASE_URL", "STRIPE_SECRET_KEY"]);

		expect(() => assertBillingFinancialConfiguration()).not.toThrow();
		expect(() => assertMeteringConfiguration()).toThrow(
			"AI_GATEWAY_API_KEY is required",
		);
	});

	it("requires AI Gateway only for metering maintenance", () => {
		setConfiguration(["AI_GATEWAY_API_KEY", "DATABASE_URL"]);

		expect(() => assertMeteringConfiguration()).not.toThrow();
		expect(() => assertBillingFinancialConfiguration()).toThrow(
			"STRIPE_SECRET_KEY is required",
		);
	});

	it.each([
		[assertBillingDatabaseConfiguration, "DATABASE_URL"],
		[assertBillingFinancialConfiguration, "STRIPE_SECRET_KEY"],
		[assertMeteringConfiguration, "AI_GATEWAY_API_KEY"],
	] as const)("rejects blank required values", (assertConfiguration, key) => {
		setConfiguration(CONFIGURATION_KEYS);
		vi.stubEnv(key, "   ");

		expect(() => assertConfiguration()).toThrow(`${key} is required`);
	});
});
