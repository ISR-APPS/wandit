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

// Routing and feature switches the metering assertion reads — reset for
// hermetic tests (the dev .env may set any of them).
const ROUTING_KEYS = [
	"AI_IMAGE_EDIT_MODEL",
	"AI_IMAGE_MODEL",
	"AI_PROVIDER",
	"AI_PROVIDER_OVERRIDES",
	"OPENROUTER_API_KEY",
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
		for (const key of [...CONFIGURATION_KEYS, ...ROUTING_KEYS]) {
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

	it("additionally requires the OpenRouter key when it serves LLM traffic", () => {
		setConfiguration(["AI_GATEWAY_API_KEY", "DATABASE_URL"]);
		vi.stubEnv("AI_PROVIDER", "openrouter");

		expect(() => assertMeteringConfiguration()).toThrow(
			"OPENROUTER_API_KEY is required",
		);

		vi.stubEnv("OPENROUTER_API_KEY", "sk-or-task-key");

		expect(() => assertMeteringConfiguration()).not.toThrow();
	});

	it("requires the OpenRouter key when only a task override routes there", () => {
		setConfiguration(["AI_GATEWAY_API_KEY", "DATABASE_URL"]);
		vi.stubEnv("AI_PROVIDER_OVERRIDES", "page_build=openrouter");

		expect(() => assertMeteringConfiguration()).toThrow(
			"OPENROUTER_API_KEY is required",
		);

		vi.stubEnv("OPENROUTER_API_KEY", "sk-or-task-key");

		expect(() => assertMeteringConfiguration()).not.toThrow();
	});

	it("passes openrouter-only routing without the gateway key while media is off", () => {
		setConfiguration(["DATABASE_URL"]);
		vi.stubEnv("AI_PROVIDER", "openrouter");
		vi.stubEnv("OPENROUTER_API_KEY", "sk-or-task-key");

		expect(() => assertMeteringConfiguration()).not.toThrow();
	});

	it("requires the gateway key for openrouter routing once media generation is on", () => {
		setConfiguration(["DATABASE_URL"]);
		vi.stubEnv("AI_PROVIDER", "openrouter");
		vi.stubEnv("OPENROUTER_API_KEY", "sk-or-task-key");
		vi.stubEnv("AI_IMAGE_MODEL", "test/image-model");

		expect(() => assertMeteringConfiguration()).toThrow(
			"AI_GATEWAY_API_KEY is required",
		);
	});

	it("fails with neither reconciliation key", () => {
		setConfiguration(["DATABASE_URL"]);
		vi.stubEnv("AI_PROVIDER", "openrouter");

		expect(() => assertMeteringConfiguration()).toThrow(
			"OPENROUTER_API_KEY is required",
		);
	});

	it("still requires the gateway key when any text task stays on vercel", () => {
		setConfiguration(["DATABASE_URL"]);
		vi.stubEnv("AI_PROVIDER", "openrouter");
		vi.stubEnv("OPENROUTER_API_KEY", "sk-or-task-key");
		vi.stubEnv("AI_PROVIDER_OVERRIDES", "page_build=vercel");

		expect(() => assertMeteringConfiguration()).toThrow(
			"AI_GATEWAY_API_KEY is required",
		);
	});

	it("needs no OpenRouter key when overrides only name vercel", () => {
		setConfiguration(["AI_GATEWAY_API_KEY", "DATABASE_URL"]);
		vi.stubEnv("AI_PROVIDER_OVERRIDES", "page_build=vercel");

		expect(() => assertMeteringConfiguration()).not.toThrow();
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
