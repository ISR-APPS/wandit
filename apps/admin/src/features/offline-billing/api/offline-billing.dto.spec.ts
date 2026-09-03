import { describe, expect, it } from "vitest";

import {
	mapManualBillingReceiptConfigDto,
	mapManualBillingStatsDto,
	mapManualRequestDto,
	mapManualSubscriptionsDto,
} from "./offline-billing.dto";

describe("offline billing DTO mapping", () => {
	it("validates and preserves an admin manual request", () => {
		const payload = {
			id: "11111111-1111-4111-8111-111111111111",
			status: "pending",
			organizationId: null,
			plan: "pro",
			tierCredits: 500,
			interval: "month",
			fullName: "Samir Benali",
			phone: "+213 555 000 000",
			company: null,
			country: "DZ",
			city: "Algiers",
			preferredPaymentMethod: "ccp",
			notes: null,
			subscriptionId: null,
			handledAt: null,
			createdAt: "2028-01-01T10:00:00.000Z",
			updatedAt: "2028-01-01T10:00:00.000Z",
			user: {
				id: "user-1",
				name: "Samir Benali",
				email: "samir@example.com",
				image: null,
			},
			organization: null,
			adminNotes: null,
			handledBy: null,
			currentSubscription: null,
		} as const;

		expect(mapManualRequestDto(payload)).toEqual(payload);
	});

	it("maps the subscription pagination payload", () => {
		const subscription = {
			id: "22222222-2222-4222-8222-222222222222",
			provider: "manual",
			status: "active",
			entitled: true,
			inGrace: true,
			plan: "business",
			tierCredits: 1000,
			interval: "year",
			priceLookupKey: "business_1000_year",
			currentPeriodStart: "2028-01-01T10:00:00.000Z",
			currentPeriodEnd: "2029-01-01T10:00:00.000Z",
			accessEndsAt: "2029-01-04T10:00:00.000Z",
			cancelAtPeriodEnd: false,
			user: {
				id: "user-1",
				name: "Samir Benali",
				email: "samir@example.com",
				image: null,
			},
			organization: {
				id: "org-1",
				name: "Acme",
				slug: "acme",
			},
			paymentsCount: 1,
			lastPaymentAt: "2028-01-01T10:00:00.000Z",
			createdAt: "2028-01-01T10:00:00.000Z",
			updatedAt: "2028-01-01T10:00:00.000Z",
		} as const;

		expect(
			mapManualSubscriptionsDto({
				items: [subscription],
				page: 1,
				pageSize: 25,
				total: 1,
			}),
		).toEqual({
			items: [subscription],
			page: 1,
			pageSize: 25,
			total: 1,
		});
	});

	it("maps the grace-period aggregate", () => {
		const payload = {
			activeSubscriptions: 12,
			openRequests: 3,
			expiringWithin7Days: 4,
			inGrace: 2,
			collectedThisMonth: [],
			collectedPreviousMonth: [],
		};

		expect(mapManualBillingStatsDto(payload)).toEqual(payload);
	});

	it("maps the receipt exchange-rate config", () => {
		const payload = { dzdPerUsdRate: 270.5 };

		expect(mapManualBillingReceiptConfigDto(payload)).toEqual(payload);
	});
});
