import { affiliatesRoutes } from "@wandit/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";

import { apiGet } from "@/lib/api-client";

import { listAffiliates } from "./affiliates.services";

vi.mock("@/lib/api-client", () => ({
	apiDelete: vi.fn(),
	apiGet: vi.fn(),
	apiGetRaw: vi.fn(),
	apiPatch: vi.fn(),
	apiPost: vi.fn(),
}));

const apiGetMock = vi.mocked(apiGet);
const now = "2026-08-16T08:00:00.000Z";

const response = {
	items: [
		{
			affiliate: {
				id: "00000000-0000-4000-8000-000000000001",
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
				currencies: [],
			},
		},
	],
	page: 2,
	pageSize: 10,
	total: 1,
	summary: {
		affiliateCount: 1,
		activeAffiliateCount: 1,
		linkCount: 3,
		activeLinkCount: 2,
		clickCount: 220,
		uniqueVisitorCount: 180,
		attributedUserCount: 24,
		paidCustomerCount: 8,
		paidInvoiceCount: 11,
		currencies: [],
	},
};

afterEach(() => {
	vi.clearAllMocks();
});

describe("affiliate services", () => {
	it("parses referred-user quality aggregates from the list contract", async () => {
		apiGetMock.mockResolvedValueOnce(response);

		await expect(
			listAffiliates({ page: 2, pageSize: 10 }),
		).resolves.toMatchObject({
			items: [
				{
					aggregates: {
						healthyTrials: 5,
						churnedCustomers: 2,
						referredMrrCents: 43_500,
						referredLtvCents: null,
					},
				},
			],
		});
		expect(apiGetMock).toHaveBeenCalledWith(affiliatesRoutes.adminAffiliates, {
			page: 2,
			pageSize: 10,
			sort: "newest",
		});
	});

	it("rejects an affiliate response missing a required aggregate", async () => {
		const { referredMrrCents: _missing, ...aggregates } =
			response.items[0].aggregates;
		apiGetMock.mockResolvedValueOnce({
			...response,
			items: [{ ...response.items[0], aggregates }],
		});

		await expect(listAffiliates()).rejects.toThrow();
	});
});
