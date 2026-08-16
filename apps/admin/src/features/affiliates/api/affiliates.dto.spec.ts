import {
	affiliateLinkListItemSchema,
	affiliateListItemSchema,
} from "@wandit/contracts";
import { describe, expect, it } from "vitest";

import {
	mapAffiliateLinkListItemToTableRow,
	mapAffiliateListItemToTableRow,
} from "./affiliates.dto";

const affiliateId = "00000000-0000-4000-8000-000000000001";
const linkId = "00000000-0000-4000-8000-000000000002";
const programId = "00000000-0000-4000-8000-000000000003";
const now = "2026-08-02T10:00:00.000Z";

const usdAggregate = {
	currency: "usd",
	attributedRevenueCents: 125_000,
	pendingCommissionCents: 5_000,
	approvedCommissionCents: 7_500,
	paidCommissionCents: 2_000,
	balanceCents: 12_500,
};

describe("affiliate DTO mappers", () => {
	it("maps the contract list item into a flat, multi-currency table row", () => {
		const dto = affiliateListItemSchema.parse({
			affiliate: {
				id: affiliateId,
				userId: null,
				name: "Nadia Studio",
				email: "nadia@example.com",
				company: null,
				channel: "newsletter",
				country: "DZ",
				payoutMethod: "wise",
				status: "active",
				createdAt: now,
				updatedAt: now,
			},
			aggregates: {
				linkCount: 3,
				activeLinkCount: 2,
				clickCount: 220,
				uniqueVisitorCount: 180,
				attributedUserCount: 24,
				paidCustomerCount: 8,
				healthyTrials: 5,
				churnedCustomers: 2,
				referredMrrCents: 43_500,
				referredLtvCents: null,
				paidInvoiceCount: 11,
				lastConversionAt: now,
				currencies: [
					usdAggregate,
					{ ...usdAggregate, currency: "eur", balanceCents: -250 },
				],
			},
		});

		const row = mapAffiliateListItemToTableRow(dto);

		expect(row).toMatchObject({
			id: affiliateId,
			name: "Nadia Studio",
			company: null,
			status: "active",
			linkCount: 3,
			uniqueVisitorCount: 180,
			healthyTrials: 5,
			churnedCustomers: 2,
			referredMrrCents: 43_500,
			referredLtvCents: null,
			paidInvoiceCount: 11,
		});
		expect(row.currencies).toEqual([
			usdAggregate,
			{ ...usdAggregate, currency: "eur", balanceCents: -250 },
		]);
		expect(row).not.toHaveProperty("avatarUrl");
		expect(row).not.toHaveProperty("performance");
	});

	it("maps a real link with its program identity, derived status, and expiry", () => {
		const dto = affiliateLinkListItemSchema.parse({
			link: {
				id: linkId,
				programId,
				affiliateId,
				code: "NADIA_2026",
				label: "Newsletter",
				landingPath: "/start",
				expiresAt: "2026-09-01T00:00:00.000Z",
				active: true,
				status: "active",
				createdAt: now,
				updatedAt: now,
			},
			program: {
				id: programId,
				name: "Creators 15%",
				kind: "percentage_recurring",
				status: "active",
			},
			aggregates: {
				clickCount: 40,
				uniqueVisitorCount: 35,
				attributedUserCount: 9,
				paidCustomerCount: 3,
				paidInvoiceCount: 4,
				lastConversionAt: now,
				currencies: [usdAggregate],
			},
		});

		expect(mapAffiliateLinkListItemToTableRow(dto)).toMatchObject({
			id: linkId,
			programId,
			programName: "Creators 15%",
			programKind: "percentage_recurring",
			programStatus: "active",
			code: "NADIA_2026",
			status: "active",
			expiresAt: "2026-09-01T00:00:00.000Z",
			uniqueVisitorCount: 35,
		});
	});
});
