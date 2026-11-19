import type { DomainStatus, RequiredDomainRecord } from "@wandit/contracts";
import { describe, expect, it, vi } from "vitest";

import { CustomHostnameMissingError } from "../../domain/errors/domain.errors";
import { CustomHostnameVerificationStep } from "./custom-hostname-verification.step";
import type {
	CustomHostnameResult,
	DomainFulfillmentRow,
} from "./domain-fulfillment.contracts";

const wwwTrafficRecord = {
	name: "www",
	purpose: "traffic",
	type: "CNAME",
	value: "customers.wandit.app",
} satisfies RequiredDomainRecord;

function domainRow(): DomainFulfillmentRow {
	return {
		cfCustomHostnameId: "cf_old",
		dns: {
			records: [
				wwwTrafficRecord,
				{
					name: "_cf-custom-hostname.www.example.com",
					purpose: "ownership_or_ssl_validation",
					type: "TXT",
					value: "old-token",
				},
			],
		},
		error: null,
		expiresAt: null,
		id: "11111111-1111-4111-8111-111111111111",
		isPrimary: false,
		name: "example.com",
		paymentOrderId: null,
		projectId: "33333333-3333-4333-8333-333333333333",
		provider: null,
		providerDomainId: null,
		providerOrderId: null,
		providerTotalPaidUsd: null,
		registrant: null,
		source: "external",
		status: "configuring",
		transferLockExpiresAt: null,
		updatedAt: new Date("2026-08-01T00:00:00.000Z"),
		whoisPrivacy: false,
	};
}

function hostname(
	id: string,
	hostnameStatus: string | null,
	sslStatus: string | null,
): CustomHostnameResult {
	return {
		hostnameStatus,
		id,
		requiredRecords: [
			{
				name: "_cf-custom-hostname.www.example.com",
				type: "TXT",
				value: `${id}-token`,
			},
		],
		sslStatus,
		status: sslStatus ?? "pending",
	};
}

function setup(status: () => Promise<CustomHostnameResult>) {
	let row = domainRow();
	const provider = {
		deleteCustomHostname: vi.fn(async (_id: string) => undefined),
		findOrCreateCustomHostname: vi.fn(async (_host: string) =>
			hostname("cf_new", "pending", "pending_validation"),
		),
		getCustomHostnameStatus: vi.fn(async (_id: string) => status()),
	};
	const domains = {
		mergeDnsIfStatus: vi.fn(
			async (
				_id: string,
				statuses: DomainStatus[],
				patch: { records: RequiredDomainRecord[] },
			) => {
				if (!statuses.includes(row.status)) {
					return null;
				}

				// The fixture dns holds only `records`, so the patch replaces all of it.
				row = { ...row, dns: patch };
				return row;
			},
		),
		updateIfStatusOrNull: vi.fn(
			async (
				_id: string,
				statuses: DomainStatus[],
				patch: { cfCustomHostnameId: string },
			) => {
				if (!statuses.includes(row.status)) {
					return null;
				}

				row = { ...row, ...patch };
				return row;
			},
		),
	};

	return {
		domains,
		provider,
		get row() {
			return row;
		},
		step: new CustomHostnameVerificationStep(provider, domains),
	};
}

describe("CustomHostnameVerificationStep", () => {
	it.each([
		["active", "active", "active"],
		["pending", "pending_validation", "pending"],
		["blocked", "active", "pending"],
		["", "active", "pending"],
		["ACTIVE", "active", "pending"],
		["active", "pending_validation", "pending"],
	] as const)("normalizes hostname %j and SSL %j to %j while preserving both", async (hostnameStatus, sslStatus, expected) => {
		const fixture = setup(async () =>
			hostname("cf_old", hostnameStatus, sslStatus),
		);

		await expect(fixture.step.execute("cf_old", domainRow())).resolves.toEqual({
			hostnameStatus,
			sslStatus,
			status: expected,
		});
		expect(fixture.provider.getCustomHostnameStatus).toHaveBeenCalledOnce();
		expect(fixture.provider.findOrCreateCustomHostname).not.toHaveBeenCalled();
	});

	it.each([
		new Error("Cloudflare timed out"),
		"network unavailable",
	])("returns a transient result for a thrown provider value", async (error) => {
		const fixture = setup(async () => {
			throw error;
		});

		await expect(fixture.step.execute("cf_old", domainRow())).resolves.toEqual({
			error,
			status: "transient",
		});
		expect(fixture.provider.findOrCreateCustomHostname).not.toHaveBeenCalled();
	});

	it("creates a deleted hostname again, stores its id, and replaces the old validation records", async () => {
		const fixture = setup(async () => {
			throw new CustomHostnameMissingError();
		});

		const result = await fixture.step.execute("cf_old", domainRow());

		expect(fixture.provider.findOrCreateCustomHostname).toHaveBeenCalledWith(
			"example.com",
		);
		expect(result).toEqual({
			hostnameStatus: "pending",
			row: fixture.row,
			sslStatus: "pending_validation",
			status: "recreated",
		});
		expect(fixture.row.cfCustomHostnameId).toBe("cf_new");
		expect(fixture.row.dns).toEqual({
			records: [
				wwwTrafficRecord,
				{
					name: "_cf-custom-hostname.www.example.com",
					purpose: "ownership_or_ssl_validation",
					type: "TXT",
					value: "cf_new-token",
				},
			],
		});
		expect(fixture.provider.deleteCustomHostname).not.toHaveBeenCalled();
	});
});
