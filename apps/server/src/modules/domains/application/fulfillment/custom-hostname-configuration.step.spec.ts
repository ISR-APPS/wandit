import { describe, expect, it, vi } from "vitest";
import { CustomHostnameConfigurationStep } from "./custom-hostname-configuration.step";
import type {
	DomainFulfillmentLogger,
	DomainFulfillmentPatch,
	DomainFulfillmentRow,
} from "./domain-fulfillment.contracts";

const trafficRecord = {
	name: "www",
	purpose: "traffic",
	type: "CNAME" as const,
	value: "customers.wandit.app",
};

function domainRow(
	overrides: Partial<DomainFulfillmentRow> = {},
): DomainFulfillmentRow {
	return {
		cfCustomHostnameId: null,
		dns: null,
		error: null,
		expiresAt: null,
		id: "22222222-2222-4222-8222-222222222222",
		isPrimary: false,
		name: "example.com",
		paymentOrderId: "33333333-3333-4333-8333-333333333333",
		projectId: "11111111-1111-4111-8111-111111111111",
		provider: "namecom",
		providerDomainId: "example.com",
		providerOrderId: null,
		providerTotalPaidUsd: null,
		registrant: null,
		source: "purchased",
		status: "registering",
		transferLockExpiresAt: null,
		updatedAt: new Date("2027-01-01T00:00:00.000Z"),
		whoisPrivacy: false,
		...overrides,
	};
}

function customHostname(
	id: string,
	requiredRecords: Array<{ name: string; type: "TXT"; value: string }> = [],
) {
	return {
		hostnameStatus: "pending",
		id,
		requiredRecords,
		sslStatus: "pending",
		status: "pending",
	};
}

function setup() {
	const customHostnames = {
		createCustomHostname: vi.fn(async () => customHostname("cf_1")),
		deleteCustomHostname: vi.fn(async () => undefined),
		getCustomHostnameStatus: vi.fn(async () => customHostname("cf_1")),
	};
	const dnsProvider = {
		setDnsRecords: vi.fn(async () => undefined),
	};
	const state = {
		updatePostRegistrationState: vi.fn(
			async (row: DomainFulfillmentRow, patch: DomainFulfillmentPatch) => ({
				...row,
				...patch,
			}),
		),
	};
	const logger = {
		error: vi.fn(),
		warn: vi.fn(),
	} satisfies DomainFulfillmentLogger;

	return {
		customHostnames,
		dnsProvider,
		logger,
		state,
		step: new CustomHostnameConfigurationStep(
			customHostnames,
			dnsProvider,
			state,
			logger,
		),
	};
}

describe("CustomHostnameConfigurationStep", () => {
	it("persists the Cloudflare id and merged challenges before registrar DNS", async () => {
		const input = domainRow({
			dns: {
				purchaseDnsConfigured: true,
				records: [
					trafficRecord,
					{
						name: "_cf.example.com",
						purpose: "ownership_or_ssl_validation",
						type: "TXT",
						value: "token-1",
					},
				],
			},
		});
		const challengeOne = {
			name: "_cf.example.com",
			type: "TXT" as const,
			value: "token-1",
		};
		const challengeTwo = {
			name: "_ssl.example.com",
			type: "TXT" as const,
			value: "token-2",
		};
		const { customHostnames, dnsProvider, state, step } = setup();
		customHostnames.createCustomHostname.mockResolvedValue(
			customHostname("cf_created", [challengeOne, challengeOne, challengeTwo]),
		);

		let finishPersistence: ((row: DomainFulfillmentRow) => void) | undefined;
		const persistence = new Promise<DomainFulfillmentRow>((resolve) => {
			finishPersistence = resolve;
		});
		state.updatePostRegistrationState.mockImplementationOnce(
			async () => persistence,
		);

		const execution = step.execute(input);

		await vi.waitFor(() => {
			expect(state.updatePostRegistrationState).toHaveBeenCalledTimes(1);
		});
		expect(dnsProvider.setDnsRecords).not.toHaveBeenCalled();

		const firstPatch = state.updatePostRegistrationState.mock.calls[0]?.[1];
		expect(firstPatch).toEqual({
			cfCustomHostnameId: "cf_created",
			dns: {
				purchaseDnsConfigured: true,
				records: [
					trafficRecord,
					{
						...challengeOne,
						purpose: "ownership_or_ssl_validation",
					},
					{
						...challengeTwo,
						purpose: "ownership_or_ssl_validation",
					},
				],
			},
		});

		if (!finishPersistence || !firstPatch) {
			throw new Error("Expected hostname persistence to start");
		}
		finishPersistence({ ...input, ...firstPatch });

		await expect(execution).resolves.toMatchObject({
			cfCustomHostnameId: "cf_created",
			dns: {
				customHostnameDnsConfigured: true,
				purchaseDnsConfigured: true,
			},
		});
		expect(customHostnames.createCustomHostname).toHaveBeenCalledWith(
			"example.com",
		);
		expect(dnsProvider.setDnsRecords).toHaveBeenCalledOnce();
		expect(dnsProvider.setDnsRecords).toHaveBeenCalledWith("example.com", [
			challengeOne,
			challengeTwo,
		]);
		expect(state.updatePostRegistrationState).toHaveBeenCalledTimes(2);
	});

	it("backfills validation records for an older Cloudflare-id-only row", async () => {
		const input = domainRow({
			cfCustomHostnameId: "cf_backfill",
			dns: { purchaseDnsConfigured: true, records: [trafficRecord] },
			name: "backfill.com",
		});
		const challenge = {
			name: "_cf.backfill.com",
			type: "TXT" as const,
			value: "backfill-token",
		};
		const { customHostnames, dnsProvider, state, step } = setup();
		customHostnames.getCustomHostnameStatus.mockResolvedValue(
			customHostname("cf_backfill", [challenge]),
		);

		await expect(step.execute(input)).resolves.toMatchObject({
			dns: {
				customHostnameDnsConfigured: true,
				records: [
					trafficRecord,
					{
						...challenge,
						purpose: "ownership_or_ssl_validation",
					},
				],
			},
		});
		expect(customHostnames.createCustomHostname).not.toHaveBeenCalled();
		expect(customHostnames.getCustomHostnameStatus).toHaveBeenCalledOnce();
		expect(customHostnames.getCustomHostnameStatus).toHaveBeenCalledWith(
			"cf_backfill",
		);
		expect(dnsProvider.setDnsRecords).toHaveBeenCalledWith("backfill.com", [
			challenge,
		]);
		expect(state.updatePostRegistrationState).toHaveBeenCalledWith(input, {
			dns: {
				customHostnameDnsConfigured: true,
				purchaseDnsConfigured: true,
				records: [
					trafficRecord,
					{
						...challenge,
						purpose: "ownership_or_ssl_validation",
					},
				],
			},
		});
	});

	it("skips every provider and persistence call after the DNS marker", async () => {
		const input = domainRow({
			cfCustomHostnameId: "cf_configured",
			dns: {
				customHostnameDnsConfigured: true,
				records: [trafficRecord],
			},
		});
		const { customHostnames, dnsProvider, state, step } = setup();

		await expect(step.execute(input)).resolves.toBe(input);
		expect(customHostnames.createCustomHostname).not.toHaveBeenCalled();
		expect(customHostnames.getCustomHostnameStatus).not.toHaveBeenCalled();
		expect(customHostnames.deleteCustomHostname).not.toHaveBeenCalled();
		expect(dnsProvider.setDnsRecords).not.toHaveBeenCalled();
		expect(state.updatePostRegistrationState).not.toHaveBeenCalled();
	});

	it("persists the DNS marker when Cloudflare has no validation records", async () => {
		const input = domainRow({
			cfCustomHostnameId: "cf_without_validation",
			dns: { purchaseDnsConfigured: true, records: [trafficRecord] },
		});
		const { customHostnames, dnsProvider, state, step } = setup();
		customHostnames.getCustomHostnameStatus.mockResolvedValue(
			customHostname("cf_without_validation"),
		);

		await expect(step.execute(input)).resolves.toMatchObject({
			dns: {
				customHostnameDnsConfigured: true,
				purchaseDnsConfigured: true,
				records: [trafficRecord],
			},
		});
		expect(dnsProvider.setDnsRecords).not.toHaveBeenCalled();
		expect(state.updatePostRegistrationState).toHaveBeenCalledWith(input, {
			dns: {
				customHostnameDnsConfigured: true,
				purchaseDnsConfigured: true,
				records: [trafficRecord],
			},
		});
	});

	it("deletes an unclaimed hostname when id persistence loses its CAS", async () => {
		const persistenceError = new Error("financial race");
		const { customHostnames, dnsProvider, state, step } = setup();
		customHostnames.createCustomHostname.mockResolvedValue(
			customHostname("cf_unclaimed", [
				{ name: "_cf.example.com", type: "TXT", value: "token" },
			]),
		);
		state.updatePostRegistrationState.mockRejectedValueOnce(persistenceError);

		await expect(step.execute(domainRow())).rejects.toBe(persistenceError);
		expect(customHostnames.deleteCustomHostname).toHaveBeenCalledOnce();
		expect(customHostnames.deleteCustomHostname).toHaveBeenCalledWith(
			"cf_unclaimed",
		);
		expect(dnsProvider.setDnsRecords).not.toHaveBeenCalled();
	});

	it("preserves the persistence error when unclaimed-hostname cleanup also fails", async () => {
		const persistenceError = new Error("financial race");
		const cleanupError = new Error("Cloudflare cleanup failed");
		const { customHostnames, dnsProvider, logger, state, step } = setup();
		customHostnames.createCustomHostname.mockResolvedValue(
			customHostname("cf_cleanup_failure"),
		);
		state.updatePostRegistrationState.mockRejectedValueOnce(persistenceError);
		customHostnames.deleteCustomHostname.mockRejectedValueOnce(cleanupError);

		await expect(step.execute(domainRow())).rejects.toBe(persistenceError);
		expect(customHostnames.deleteCustomHostname).toHaveBeenCalledWith(
			"cf_cleanup_failure",
		);
		expect(logger.warn).toHaveBeenCalledWith(
			"Failed to delete unclaimed Cloudflare custom hostname cf_cleanup_failure",
			"Cloudflare cleanup failed",
		);
		expect(dnsProvider.setDnsRecords).not.toHaveBeenCalled();
	});
});
