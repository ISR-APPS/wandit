import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	assertDatabaseConfiguration,
	assertDomainConfigurationConfiguration,
	assertDomainPurchaseConfiguration,
	assertDomainRegistrarSyncConfiguration,
	assertOrderRefundConfiguration,
} from "./domain-operations.config";

const CONFIGURATION_KEYS = [
	"CLOUDFLARE_API_TOKEN",
	"CLOUDFLARE_KV_NAMESPACE_ID",
	"CLOUDFLARE_ZONE_ID_WANDIT_APP",
	"DATABASE_URL",
	"DOMAINS_FALLBACK_ORIGIN",
	"NAMECOM_API_TOKEN",
	"NAMECOM_ENVIRONMENT",
	"NAMECOM_USERNAME",
	"STRIPE_SECRET_KEY",
] as const;

const VALID_CONFIGURATION = {
	CLOUDFLARE_API_TOKEN: "cf-token",
	CLOUDFLARE_KV_NAMESPACE_ID: "kv-namespace",
	CLOUDFLARE_ZONE_ID_WANDIT_APP: "zone-id",
	DATABASE_URL: "postgresql://task.test/database",
	DOMAINS_FALLBACK_ORIGIN: "customers.wandit.app",
	NAMECOM_API_TOKEN: "name-token",
	NAMECOM_ENVIRONMENT: "sandbox",
	NAMECOM_USERNAME: "wandit-test",
	STRIPE_SECRET_KEY: "sk_test_task",
} as const;

function setConfiguration(
	keys: readonly (keyof typeof VALID_CONFIGURATION)[],
): void {
	for (const key of keys) {
		vi.stubEnv(key, VALID_CONFIGURATION[key]);
	}
}

describe("domain operation task configuration", () => {
	beforeEach(() => {
		for (const key of CONFIGURATION_KEYS) {
			vi.stubEnv(key, "");
		}
	});

	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it("returns the validated purchase values only when every spend and recovery dependency is ready", () => {
		setConfiguration(CONFIGURATION_KEYS);

		expect(assertDomainPurchaseConfiguration()).toEqual({
			cloudflareApiToken: VALID_CONFIGURATION.CLOUDFLARE_API_TOKEN,
			cloudflareKvNamespaceId: VALID_CONFIGURATION.CLOUDFLARE_KV_NAMESPACE_ID,
			cloudflareZoneId: VALID_CONFIGURATION.CLOUDFLARE_ZONE_ID_WANDIT_APP,
			databaseUrl: VALID_CONFIGURATION.DATABASE_URL,
			fallbackOrigin: VALID_CONFIGURATION.DOMAINS_FALLBACK_ORIGIN,
			namecomApiToken: VALID_CONFIGURATION.NAMECOM_API_TOKEN,
			namecomEnvironment: "sandbox",
			namecomUsername: VALID_CONFIGURATION.NAMECOM_USERNAME,
			stripeSecretKey: VALID_CONFIGURATION.STRIPE_SECRET_KEY,
		});
	});

	it("keeps BYO configuration independent of Name.com and Stripe", () => {
		setConfiguration([
			"CLOUDFLARE_API_TOKEN",
			"CLOUDFLARE_KV_NAMESPACE_ID",
			"CLOUDFLARE_ZONE_ID_WANDIT_APP",
			"DATABASE_URL",
		]);

		expect(assertDomainConfigurationConfiguration()).toEqual({
			cloudflareApiToken: VALID_CONFIGURATION.CLOUDFLARE_API_TOKEN,
			cloudflareKvNamespaceId: VALID_CONFIGURATION.CLOUDFLARE_KV_NAMESPACE_ID,
			cloudflareZoneId: VALID_CONFIGURATION.CLOUDFLARE_ZONE_ID_WANDIT_APP,
			databaseUrl: VALID_CONFIGURATION.DATABASE_URL,
		});
	});

	it("keeps refund, registrar sync, and DB-only task assertions narrowly scoped", () => {
		setConfiguration(["DATABASE_URL", "STRIPE_SECRET_KEY"]);
		expect(assertOrderRefundConfiguration()).toEqual({
			databaseUrl: VALID_CONFIGURATION.DATABASE_URL,
			stripeSecretKey: VALID_CONFIGURATION.STRIPE_SECRET_KEY,
		});

		for (const key of CONFIGURATION_KEYS) {
			vi.stubEnv(key, "");
		}
		setConfiguration([
			"DATABASE_URL",
			"NAMECOM_API_TOKEN",
			"NAMECOM_ENVIRONMENT",
			"NAMECOM_USERNAME",
		]);
		expect(assertDomainRegistrarSyncConfiguration()).toEqual({
			databaseUrl: VALID_CONFIGURATION.DATABASE_URL,
			namecomApiToken: VALID_CONFIGURATION.NAMECOM_API_TOKEN,
			namecomEnvironment: "sandbox",
			namecomUsername: VALID_CONFIGURATION.NAMECOM_USERNAME,
		});

		for (const key of CONFIGURATION_KEYS) {
			vi.stubEnv(key, "");
		}
		setConfiguration(["DATABASE_URL"]);
		expect(assertDatabaseConfiguration()).toEqual({
			databaseUrl: VALID_CONFIGURATION.DATABASE_URL,
		});
	});

	it.each([
		["sandbox", "wandit"],
		["production", "wandit-test"],
	] as const)("rejects %s Name.com credential mismatches", (environment, username) => {
		setConfiguration([
			"DATABASE_URL",
			"NAMECOM_API_TOKEN",
			"NAMECOM_ENVIRONMENT",
			"NAMECOM_USERNAME",
		]);
		vi.stubEnv("NAMECOM_ENVIRONMENT", environment);
		vi.stubEnv("NAMECOM_USERNAME", username);

		expect(() => assertDomainRegistrarSyncConfiguration()).toThrow(
			`NAMECOM_USERNAME does not match NAMECOM_ENVIRONMENT=${environment}`,
		);
	});

	it("rejects a defaultable or invalid Name.com environment instead of guessing", () => {
		setConfiguration(["DATABASE_URL", "NAMECOM_API_TOKEN", "NAMECOM_USERNAME"]);

		expect(() => assertDomainRegistrarSyncConfiguration()).toThrow(
			"NAMECOM_ENVIRONMENT is required",
		);

		vi.stubEnv("NAMECOM_ENVIRONMENT", "staging");
		expect(() => assertDomainRegistrarSyncConfiguration()).toThrow(
			"NAMECOM_ENVIRONMENT must be exactly sandbox or production",
		);
	});

	it.each([
		"DATABASE_URL",
		"CLOUDFLARE_API_TOKEN",
		"CLOUDFLARE_KV_NAMESPACE_ID",
		"CLOUDFLARE_ZONE_ID_WANDIT_APP",
		"NAMECOM_ENVIRONMENT",
		"NAMECOM_USERNAME",
		"NAMECOM_API_TOKEN",
		"DOMAINS_FALLBACK_ORIGIN",
		"STRIPE_SECRET_KEY",
	] as const)("fails a purchase before runtime construction when %s is blank", (key) => {
		setConfiguration(CONFIGURATION_KEYS);
		vi.stubEnv(key, "   ");

		expect(() => assertDomainPurchaseConfiguration()).toThrow(key);
	});
});
