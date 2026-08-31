import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { AdminManualSubscriptionDetail } from "@/features/offline-billing/api/offline-billing.dto";

import { OfflineReceipt } from "./offline-receipt";

describe("OfflineReceipt", () => {
	it("renders mixed DZD and USD payments only as DZD without exposing the rate", () => {
		const dzdPerUsdRate = 271.43;
		const subscription: AdminManualSubscriptionDetail = {
			id: "550e8400-e29b-41d4-a716-446655440000",
			provider: "manual",
			status: "active",
			entitled: true,
			inGrace: false,
			plan: "pro",
			tierCredits: 500,
			interval: "month",
			priceLookupKey: "pro_500_month",
			currentPeriodStart: "2028-01-01T10:00:00.000Z",
			currentPeriodEnd: "2028-02-01T10:00:00.000Z",
			accessEndsAt: "2028-02-04T10:00:00.000Z",
			cancelAtPeriodEnd: false,
			user: {
				id: "user-1",
				name: "Samir Benali",
				email: "samir@example.com",
				image: null,
			},
			organization: null,
			paymentsCount: 2,
			lastPaymentAt: "2028-01-02T10:00:00.000Z",
			createdAt: "2028-01-01T10:00:00.000Z",
			updatedAt: "2028-01-02T10:00:00.000Z",
			payments: [
				{
					id: "11111111-1111-4111-8111-111111111111",
					kind: "initial",
					method: "ccp",
					amountMinor: 1_500_000,
					currency: "DZD",
					reference: "CCP-001",
					note: null,
					periodStart: "2028-01-01T10:00:00.000Z",
					periodEnd: "2028-02-01T10:00:00.000Z",
					recordedBy: null,
					createdAt: "2028-01-01T10:00:00.000Z",
				},
				{
					id: "22222222-2222-4222-8222-222222222222",
					kind: "renewal",
					method: "bank_transfer",
					amountMinor: 5_000,
					currency: "USD",
					reference: "BANK-002",
					note: null,
					periodStart: "2028-02-01T10:00:00.000Z",
					periodEnd: "2028-03-01T10:00:00.000Z",
					recordedBy: null,
					createdAt: "2028-01-02T10:00:00.000Z",
				},
			],
			request: null,
		};

		const html = renderToStaticMarkup(
			createElement(OfflineReceipt, {
				subscription,
				generatedAt: new Date("2028-01-03T10:00:00.000Z"),
				dzdPerUsdRate,
			}),
		);

		expect(html).toContain('id="offline-receipt-print-root"');
		expect(html).toContain("DZD");
		expect(html).not.toContain("USD");
		expect(html).not.toContain(String(dzdPerUsdRate));
	});
});
