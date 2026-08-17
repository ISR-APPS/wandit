import type { RequiredDomainRecord } from "@wandit/contracts";
import { describe, expect, it, vi } from "vitest";

import { ApexHostnameStep } from "./apex-hostname.step";
import type {
	CustomHostnameResult,
	DomainApexDnsPatch,
	DomainFulfillmentLogger,
	DomainFulfillmentRow,
} from "./domain-fulfillment.contracts";
import { OrderFulfillmentStoppedError } from "./domain-fulfillment.errors";

const domainId = "11111111-1111-4111-8111-111111111111";
const fallbackOrigin = "customers.wandit.app";

const wwwTrafficRecord = {
	name: "www",
	purpose: "traffic",
	type: "CNAME",
	value: fallbackOrigin,
} satisfies RequiredDomainRecord;

const wwwValidationRecord = {
	name: "_cf-custom-hostname.www.example.com",
	purpose: "ownership_or_ssl_validation",
	type: "TXT",
	value: "www-token",
} satisfies RequiredDomainRecord;

const apexChallenge = {
	name: "_cf-custom-hostname.example.com",
	type: "TXT" as const,
	value: "apex-token",
};

const apexValidationRecord = {
	...apexChallenge,
	purpose: "ownership_or_ssl_validation",
} satisfies RequiredDomainRecord;

const apexTrafficRecord = {
	name: "@",
	purpose: "traffic",
	type: "ANAME",
	value: fallbackOrigin,
} satisfies RequiredDomainRecord;

function domainRow(
	overrides: Partial<DomainFulfillmentRow> = {},
): DomainFulfillmentRow {
	return {
		cfCustomHostnameId: "cf_www",
		dns: {
			customHostnameDnsConfigured: true,
			purchaseDnsConfigured: true,
			records: [wwwTrafficRecord, wwwValidationRecord],
		},
		error: null,
		expiresAt: new Date("2027-01-01T00:00:00.000Z"),
		id: domainId,
		isPrimary: false,
		name: "example.com",
		paymentOrderId: "22222222-2222-4222-8222-222222222222",
		projectId: "44444444-4444-4444-8444-444444444444",
		provider: "namecom",
		providerDomainId: "example.com",
		providerOrderId: "registrar-order-42",
		providerTotalPaidUsd: "12.99",
		registrant: null,
		source: "purchased",
		status: "registering",
		transferLockExpiresAt: null,
		updatedAt: new Date("2026-01-01T00:00:00.000Z"),
		whoisPrivacy: false,
		...overrides,
	};
}

function customHostname(
	id: string,
	requiredRecords: Array<{ name: string; type: "TXT"; value: string }> = [
		apexChallenge,
	],
): CustomHostnameResult {
	return {
		hostnameStatus: "pending",
		id,
		requiredRecords,
		sslStatus: "pending_validation",
		status: "pending_validation",
	};
}

/** Mirrors the runtime adapter: shallow merge, `null` removes the key. */
function mergeDns(dns: unknown, patch: DomainApexDnsPatch): unknown {
	const merged: Record<string, unknown> = {
		...((dns ?? {}) as Record<string, unknown>),
	};

	for (const [key, value] of Object.entries(patch)) {
		if (value === null) {
			delete merged[key];
		} else if (value !== undefined) {
			merged[key] = value;
		}
	}

	return merged;
}

function setup() {
	const events: string[] = [];
	const customHostnames = {
		createApexCustomHostname: vi.fn(async (_host: string) => {
			events.push("create-apex-hostname");
			return customHostname("cf_apex");
		}),
		deleteCustomHostname: vi.fn(async (_id: string) => {
			events.push("delete-apex-hostname");
		}),
		findCustomHostnameByName: vi.fn(
			async (_hostname: string): Promise<CustomHostnameResult | null> => {
				events.push("find-apex-hostname");
				return null;
			},
		),
		getCustomHostnameStatus: vi.fn(async (_id: string) => {
			events.push("get-apex-hostname");
			return customHostname("cf_apex");
		}),
	};
	const dnsProvider = {
		clearUrlForwarding: vi.fn(async (_name: string) => {
			events.push("clear-forwarding");
		}),
		setDnsRecords: vi.fn(async (_name: string, _records: unknown[]) => {
			events.push("set-dns");
		}),
	};
	const state = {
		persistApexDns: vi.fn(
			async (row: DomainFulfillmentRow, patch: DomainApexDnsPatch) => {
				events.push("persist");
				return { ...row, dns: mergeDns(row.dns, patch) };
			},
		),
	};
	const logger = {
		error: vi.fn(),
		warn: vi.fn(),
	} satisfies DomainFulfillmentLogger;

	return {
		customHostnames,
		dnsProvider,
		events,
		logger,
		state,
		step: new ApexHostnameStep(
			customHostnames,
			dnsProvider,
			state,
			logger,
			fallbackOrigin,
		),
	};
}

describe("ApexHostnameStep", () => {
	it("creates the apex hostname, writes the ANAME, clears forwarding, and persists the marker", async () => {
		const input = domainRow();
		const { customHostnames, dnsProvider, events, state, step } = setup();

		const result = await step.execute(input);

		expect(events).toEqual([
			"find-apex-hostname",
			"create-apex-hostname",
			"persist",
			"set-dns",
			"clear-forwarding",
			"persist",
		]);
		expect(customHostnames.findCustomHostnameByName).toHaveBeenCalledWith(
			"example.com",
		);
		expect(customHostnames.createApexCustomHostname).toHaveBeenCalledWith(
			"example.com",
		);
		expect(customHostnames.getCustomHostnameStatus).not.toHaveBeenCalled();
		expect(customHostnames.deleteCustomHostname).not.toHaveBeenCalled();
		// Only apex-owned keys are sent; the adapter merges them into stored dns.
		expect(state.persistApexDns).toHaveBeenNthCalledWith(1, input, {
			apexCustomHostnameId: "cf_apex",
			records: [wwwTrafficRecord, wwwValidationRecord, apexValidationRecord],
		});
		expect(dnsProvider.setDnsRecords).toHaveBeenCalledExactlyOnceWith(
			"example.com",
			[
				{ name: "@", type: "ANAME", value: fallbackOrigin },
				{ name: apexChallenge.name, type: "TXT", value: apexChallenge.value },
			],
		);
		expect(dnsProvider.clearUrlForwarding).toHaveBeenCalledExactlyOnceWith(
			"example.com",
		);
		expect(state.persistApexDns).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining({
				dns: expect.objectContaining({ apexCustomHostnameId: "cf_apex" }),
			}),
			{
				apexConfigured: true,
				apexError: null,
				records: [
					wwwTrafficRecord,
					wwwValidationRecord,
					apexValidationRecord,
					apexTrafficRecord,
				],
			},
		);
		expect(result).toMatchObject({
			cfCustomHostnameId: "cf_www",
			dns: {
				apexConfigured: true,
				apexCustomHostnameId: "cf_apex",
				customHostnameDnsConfigured: true,
				purchaseDnsConfigured: true,
			},
		});
		expect(result.dns).not.toHaveProperty("apexError");
	});

	it("skips every provider and persistence call once the apex marker is durable", async () => {
		const input = domainRow({
			dns: {
				apexConfigured: true,
				apexCustomHostnameId: "cf_apex",
				records: [wwwTrafficRecord, apexTrafficRecord],
			},
		});
		const { customHostnames, dnsProvider, state, step } = setup();

		await expect(step.execute(input)).resolves.toBe(input);
		expect(customHostnames.findCustomHostnameByName).not.toHaveBeenCalled();
		expect(customHostnames.createApexCustomHostname).not.toHaveBeenCalled();
		expect(customHostnames.getCustomHostnameStatus).not.toHaveBeenCalled();
		expect(dnsProvider.setDnsRecords).not.toHaveBeenCalled();
		expect(dnsProvider.clearUrlForwarding).not.toHaveBeenCalled();
		expect(state.persistApexDns).not.toHaveBeenCalled();
	});

	it("does nothing for external domains", async () => {
		const input = domainRow({
			paymentOrderId: null,
			provider: null,
			source: "external",
			status: "configuring",
		});
		const { customHostnames, dnsProvider, state, step } = setup();

		await expect(step.execute(input)).resolves.toBe(input);
		expect(customHostnames.findCustomHostnameByName).not.toHaveBeenCalled();
		expect(dnsProvider.setDnsRecords).not.toHaveBeenCalled();
		expect(state.persistApexDns).not.toHaveBeenCalled();
	});

	it("adopts an already-existing apex hostname instead of creating a duplicate", async () => {
		const { customHostnames, events, state, step } = setup();
		customHostnames.findCustomHostnameByName.mockImplementationOnce(
			async () => {
				events.push("find-apex-hostname");
				return customHostname("cf_apex_existing");
			},
		);

		await expect(step.execute(domainRow())).resolves.toMatchObject({
			dns: { apexConfigured: true, apexCustomHostnameId: "cf_apex_existing" },
		});
		expect(customHostnames.createApexCustomHostname).not.toHaveBeenCalled();
		expect(events).toEqual([
			"find-apex-hostname",
			"persist",
			"set-dns",
			"clear-forwarding",
			"persist",
		]);
		expect(state.persistApexDns).toHaveBeenNthCalledWith(1, expect.anything(), {
			apexCustomHostnameId: "cf_apex_existing",
			records: [wwwTrafficRecord, wwwValidationRecord, apexValidationRecord],
		});
	});

	it("resumes from a persisted apex hostname id, re-reads its challenges, and clears a stale apexError", async () => {
		const input = domainRow({
			dns: {
				apexCustomHostnameId: "cf_apex",
				apexError: "Registrar request failed",
				purchaseDnsConfigured: true,
				records: [wwwTrafficRecord, apexValidationRecord],
			},
		});
		const { customHostnames, dnsProvider, events, state, step } = setup();

		const result = await step.execute(input);

		expect(events).toEqual([
			"get-apex-hostname",
			"set-dns",
			"clear-forwarding",
			"persist",
		]);
		expect(customHostnames.getCustomHostnameStatus).toHaveBeenCalledWith(
			"cf_apex",
		);
		expect(customHostnames.findCustomHostnameByName).not.toHaveBeenCalled();
		expect(customHostnames.createApexCustomHostname).not.toHaveBeenCalled();
		expect(dnsProvider.setDnsRecords).toHaveBeenCalledWith("example.com", [
			{ name: "@", type: "ANAME", value: fallbackOrigin },
			{ name: apexChallenge.name, type: "TXT", value: apexChallenge.value },
		]);
		expect(state.persistApexDns).toHaveBeenCalledExactlyOnceWith(input, {
			apexConfigured: true,
			apexError: null,
			records: [wwwTrafficRecord, apexValidationRecord, apexTrafficRecord],
		});
		expect(result).toMatchObject({
			dns: {
				apexConfigured: true,
				apexCustomHostnameId: "cf_apex",
				purchaseDnsConfigured: true,
			},
		});
		expect(result.dns).not.toHaveProperty("apexError");
	});

	it("writes only the ANAME when Cloudflare reports no apex challenges", async () => {
		const { customHostnames, dnsProvider, step } = setup();
		customHostnames.createApexCustomHostname.mockResolvedValueOnce(
			customHostname("cf_apex", []),
		);

		await expect(step.execute(domainRow())).resolves.toMatchObject({
			dns: {
				apexConfigured: true,
				records: [wwwTrafficRecord, wwwValidationRecord, apexTrafficRecord],
			},
		});
		expect(dnsProvider.setDnsRecords).toHaveBeenCalledWith("example.com", [
			{ name: "@", type: "ANAME", value: fallbackOrigin },
		]);
	});

	it("records a Cloudflare failure as apexError and returns the row without throwing", async () => {
		const input = domainRow();
		const { customHostnames, dnsProvider, logger, state, step } = setup();
		customHostnames.createApexCustomHostname.mockRejectedValueOnce(
			new Error("Cloudflare custom hostname request failed"),
		);

		const result = await step.execute(input);

		expect(result).toMatchObject({
			dns: {
				apexError: "Cloudflare custom hostname request failed",
				customHostnameDnsConfigured: true,
				purchaseDnsConfigured: true,
			},
		});
		expect(result.dns).not.toHaveProperty("apexConfigured");
		expect(dnsProvider.setDnsRecords).not.toHaveBeenCalled();
		expect(dnsProvider.clearUrlForwarding).not.toHaveBeenCalled();
		expect(customHostnames.deleteCustomHostname).not.toHaveBeenCalled();
		expect(state.persistApexDns).toHaveBeenCalledExactlyOnceWith(input, {
			apexError: "Cloudflare custom hostname request failed",
		});
		expect(logger.warn).toHaveBeenCalledWith(
			`Apex hostname configuration deferred for domain ${domainId}`,
			"Cloudflare custom hostname request failed",
		);
	});

	it("keeps the persisted apex hostname id when the registrar ANAME write fails", async () => {
		const { customHostnames, dnsProvider, state, step } = setup();
		dnsProvider.setDnsRecords.mockRejectedValueOnce(
			new Error("Registrar request failed"),
		);

		const result = await step.execute(domainRow());

		expect(result).toMatchObject({
			dns: {
				apexCustomHostnameId: "cf_apex",
				apexError: "Registrar request failed",
			},
		});
		expect(result.dns).not.toHaveProperty("apexConfigured");
		expect(dnsProvider.clearUrlForwarding).not.toHaveBeenCalled();
		// The id is durable, so the hostname is kept for the next pass to resume.
		expect(customHostnames.deleteCustomHostname).not.toHaveBeenCalled();
		expect(state.persistApexDns).toHaveBeenCalledTimes(2);
		expect(state.persistApexDns).toHaveBeenLastCalledWith(
			expect.objectContaining({
				dns: expect.objectContaining({ apexCustomHostnameId: "cf_apex" }),
			}),
			{ apexError: "Registrar request failed" },
		);
	});

	it("records a forwarding-cleanup failure after the ANAME is already written", async () => {
		const { dnsProvider, state, step } = setup();
		dnsProvider.clearUrlForwarding.mockRejectedValueOnce(
			new Error("Registrar request failed"),
		);

		const result = await step.execute(domainRow());

		expect(dnsProvider.setDnsRecords).toHaveBeenCalledOnce();
		expect(result).toMatchObject({
			dns: {
				apexCustomHostnameId: "cf_apex",
				apexError: "Registrar request failed",
			},
		});
		expect(result.dns).not.toHaveProperty("apexConfigured");
		expect(state.persistApexDns).toHaveBeenCalledTimes(2);
	});

	it("truncates long apex errors and stringifies non-Error failures", async () => {
		const { customHostnames, step } = setup();
		customHostnames.findCustomHostnameByName.mockRejectedValueOnce(
			"x".repeat(1_000),
		);

		const result = await step.execute(domainRow());
		const dns = result.dns as { apexError?: string };

		expect(dns.apexError).toHaveLength(240);
		expect(dns.apexError).toBe("x".repeat(240));
	});

	it("returns the input row when even the apex error cannot be persisted", async () => {
		const input = domainRow();
		const { customHostnames, logger, state, step } = setup();
		customHostnames.createApexCustomHostname.mockRejectedValueOnce(
			new Error("Cloudflare custom hostname request failed"),
		);
		state.persistApexDns.mockRejectedValueOnce(
			new OrderFulfillmentStoppedError("financial_race"),
		);

		await expect(step.execute(input)).resolves.toBe(input);
		expect(logger.warn).toHaveBeenCalledWith(
			`Apex hostname configuration deferred for domain ${domainId}`,
			"Cloudflare custom hostname request failed",
		);
		expect(logger.warn).toHaveBeenCalledWith(
			`Failed to persist apex error for domain ${domainId}`,
			"Payment order changed after registrar registration",
		);
	});

	it("releases a hostname it just created when its id cannot be persisted, and never throws", async () => {
		const input = domainRow();
		const { customHostnames, dnsProvider, events, logger, state, step } =
			setup();
		state.persistApexDns
			.mockRejectedValueOnce(new Error("Domain changed from registering"))
			.mockRejectedValueOnce(new Error("Domain changed from registering"));

		await expect(step.execute(input)).resolves.toBe(input);
		expect(events).toEqual([
			"find-apex-hostname",
			"create-apex-hostname",
			"delete-apex-hostname",
		]);
		expect(state.persistApexDns).toHaveBeenCalledTimes(2);
		expect(
			customHostnames.deleteCustomHostname,
		).toHaveBeenCalledExactlyOnceWith("cf_apex");
		expect(dnsProvider.setDnsRecords).not.toHaveBeenCalled();
		expect(logger.warn).toHaveBeenCalledWith(
			`Apex hostname configuration deferred for domain ${domainId}`,
			"Domain changed from registering",
		);
	});

	it("keeps an adopted hostname when its id cannot be persisted", async () => {
		const { customHostnames, state, step } = setup();
		customHostnames.findCustomHostnameByName.mockResolvedValueOnce(
			customHostname("cf_apex_existing"),
		);
		state.persistApexDns.mockRejectedValueOnce(
			new Error("Domain changed from registering"),
		);

		await expect(step.execute(domainRow())).resolves.toMatchObject({
			dns: expect.objectContaining({
				apexError: "Domain changed from registering",
			}),
		});
		expect(customHostnames.deleteCustomHostname).not.toHaveBeenCalled();
		expect(customHostnames.createApexCustomHostname).not.toHaveBeenCalled();
	});

	it("still records the apex error when releasing the unclaimed hostname fails", async () => {
		const { customHostnames, logger, state, step } = setup();
		state.persistApexDns.mockRejectedValueOnce(
			new Error("Domain changed from registering"),
		);
		customHostnames.deleteCustomHostname.mockRejectedValueOnce(
			new Error("Cloudflare unavailable"),
		);

		await expect(step.execute(domainRow())).resolves.toMatchObject({
			dns: expect.objectContaining({
				apexError: "Domain changed from registering",
			}),
		});
		expect(logger.warn).toHaveBeenCalledWith(
			"Failed to delete unclaimed Cloudflare apex custom hostname cf_apex",
			"Cloudflare unavailable",
		);
	});

	it("rebuilds from malformed stored DNS instead of failing", async () => {
		const input = domainRow({ dns: { records: [{ malformed: true }] } });
		const { state, step } = setup();

		await expect(step.execute(input)).resolves.toMatchObject({
			dns: {
				apexConfigured: true,
				apexCustomHostnameId: "cf_apex",
				records: [apexValidationRecord, apexTrafficRecord],
			},
		});
		expect(state.persistApexDns).toHaveBeenNthCalledWith(1, input, {
			apexCustomHostnameId: "cf_apex",
			records: [apexValidationRecord],
		});
	});
});
