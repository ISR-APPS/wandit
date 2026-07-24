import { describe, expect, it } from "vitest";

import type { DomainRow } from "../persistence/domains.repository";
import { mapDomain } from "./domain.mapper";

describe("mapDomain", () => {
	it("projects a Name.com domain without leaking registrar or orchestration fields", () => {
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
		expect(mapped.provider).toBe("namecom");
		expect(JSON.stringify(mapped.dns)).not.toContain("purchaseDnsConfigured");
		expect(mapped).not.toHaveProperty("providerDomainId");
		expect(mapped).not.toHaveProperty("providerOrderId");
		expect(mapped).not.toHaveProperty("providerTotalPaidUsd");
		expect(mapped).not.toHaveProperty("transferLockExpiresAt");
	});
});

function domainRow(overrides: Partial<DomainRow> = {}): DomainRow {
	const now = new Date("2026-07-04T00:00:00.000Z");

	return {
		autoRenew: true,
		cfCustomHostnameId: null,
		createdAt: now,
		dns: null,
		error: null,
		expiresAt: null,
		id: "22222222-2222-4222-8222-000000000001",
		isPrimary: false,
		name: "brand.com",
		priceSnapshot: null,
		projectId: "11111111-1111-4111-8111-111111111111",
		provider: "namecom",
		providerDomainId: "namecom_1",
		providerOrderId: "namecom_order_1",
		providerTotalPaidUsd: "12.50",
		registrant: null,
		source: "purchased",
		status: "active",
		tld: "com",
		transferLockExpiresAt: new Date("2027-03-02T00:00:00.000Z"),
		updatedAt: now,
		userId: "user_1",
		whoisPrivacy: true,
		...overrides,
	};
}
