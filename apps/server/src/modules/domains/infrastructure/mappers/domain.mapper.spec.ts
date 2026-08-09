import { describe, expect, it } from "vitest";

import type { DomainRow } from "../persistence/domains.repository";
import { mapDomain } from "./domain.mapper";

describe("mapDomain", () => {
	it("projects DNS records without leaking internal orchestration flags", () => {
		const mapped = mapDomain(
			domainRow({
				dns: {
					purchaseDnsConfigured: true,
					records: [
						{
							name: "www",
							purpose: "traffic",
							type: "CNAME",
							value: "customers.wandit.app",
						},
					],
					triggerConfiguration: {
						nextAttempt: 4,
						nextProbeAt: "2026-07-04T00:15:00.000Z",
						nonce: "manual:private",
					},
				},
			}),
		);

		expect(mapped.dns).toEqual({
			records: [
				{
					name: "www",
					purpose: "traffic",
					type: "CNAME",
					value: "customers.wandit.app",
				},
			],
		});
		expect(JSON.stringify(mapped.dns)).not.toContain("purchaseDnsConfigured");
		expect(JSON.stringify(mapped.dns)).not.toContain("triggerConfiguration");
		expect(JSON.stringify(mapped.dns)).not.toContain("manual:private");
	});

	it("never exposes the internal price snapshot", () => {
		const mapped = mapDomain(
			domainRow({
				priceSnapshot: {
					chargedAmountCents: 3000,
					chargedCurrency: "usd",
					quotedWholesaleUsd: 11.06,
					tld: "com",
					wholesaleCeilingUsd: 24,
				},
			}),
		);

		expect(mapped).not.toHaveProperty("priceSnapshot");
		expect(JSON.stringify(mapped)).not.toContain("wholesale");
	});

	it("passes through known providers and nulls anything else", () => {
		expect(mapDomain(domainRow({ provider: "namecom" })).provider).toBe(
			"namecom",
		);
		expect(mapDomain(domainRow({ provider: "openprovider" })).provider).toBe(
			"openprovider",
		);
		expect(mapDomain(domainRow({ provider: "legacy-x" })).provider).toBeNull();
		expect(mapDomain(domainRow({ provider: null })).provider).toBeNull();
	});
});

function domainRow(overrides: Partial<DomainRow> = {}): DomainRow {
	const now = new Date("2026-07-04T00:00:00.000Z");

	return {
		autoRenew: false,
		cfCustomHostnameId: null,
		createdAt: now,
		dns: null,
		error: null,
		expiresAt: null,
		id: "22222222-2222-4222-8222-000000000001",
		isPrimary: false,
		name: "brand.com",
		paymentOrderId: null,
		priceSnapshot: null,
		projectId: "11111111-1111-4111-8111-111111111111",
		provider: null,
		providerDomainId: null,
		providerOrderId: null,
		providerTotalPaidUsd: null,
		registrant: null,
		source: "external",
		status: "configuring",
		tld: "com",
		transferLockExpiresAt: null,
		updatedAt: now,
		userId: "user_1",
		whoisPrivacy: false,
		...overrides,
	};
}
