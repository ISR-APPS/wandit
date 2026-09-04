import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type {
	AdminManualRequest,
	AdminManualSubscriptionDetail,
} from "@/features/offline-billing/api/offline-billing.dto";

import { OfflineReceipt, OfflineRequestReceipt } from "./offline-receipt";

function normalizeIntlWhitespace(value: string): string {
	return value.replace(/[\u00a0\u202f]/g, " ");
}

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
		// A French Intl formatter would render USD as "$US" — ban every dollar sign.
		expect(html).not.toMatch(/\$/);
		expect(html).not.toContain(String(dzdPerUsdRate));
		expect(html).not.toContain(dzdPerUsdRate.toLocaleString("fr-FR"));
	});
});

describe("OfflineRequestReceipt", () => {
	it("renders a priced request receipt without subscription-period or USD details", () => {
		const dzdPerUsdRate = 271.43;
		const request: AdminManualRequest = {
			id: "abcdef12-e29b-41d4-a716-446655440000",
			status: "pending",
			organizationId: "organization-1",
			plan: "pro",
			tierCredits: 500,
			interval: "month",
			fullName: "Nadia Bensalem",
			phone: "+213 555 123 456",
			company: "Bensalem Studio",
			country: "DZ",
			city: "Oran",
			preferredPaymentMethod: "cash_on_delivery",
			notes: null,
			subscriptionId: null,
			handledAt: null,
			createdAt: "2028-01-01T10:00:00.000Z",
			updatedAt: "2028-01-02T10:00:00.000Z",
			user: {
				id: "user-2",
				name: "Nadia",
				email: "nadia@example.com",
				image: null,
			},
			organization: {
				id: "organization-1",
				name: "Bensalem Workspace",
				slug: "bensalem-workspace",
			},
			adminNotes: null,
			handledBy: null,
			currentSubscription: null,
		};

		const html = normalizeIntlWhitespace(
			renderToStaticMarkup(
				createElement(OfflineRequestReceipt, {
					request,
					generatedAt: new Date("2028-01-03T10:00:00.000Z"),
					dzdPerUsdRate,
				}),
			),
		);

		expect(html).toContain('id="offline-receipt-print-root"');
		expect(html).toContain("REC-ABCDEF12");
		expect(html).toContain("Nadia Bensalem");
		expect(html).toContain("nadia@example.com");
		expect(html).toContain("+213 555 123 456");
		expect(html).toContain("13 572 DZD / mois");
		expect(html).toContain("ID demande");
		expect(html).toContain(request.id);
		expect(html).toContain("Paiement à la livraison");
		expect(html).toContain("L’accès à votre abonnement sera activé");
		expect(html).toContain("Veuillez prendre en photo ce reçu");
		expect(html).toContain("WhatsApp");
		expect(html).not.toContain("Période");
		expect(html).not.toContain("USD");
		// A French Intl formatter would render USD as "$US" — ban every dollar sign.
		expect(html).not.toMatch(/\$/);
		expect(html).not.toContain(String(dzdPerUsdRate));
		expect(html).not.toContain(dzdPerUsdRate.toLocaleString("fr-FR"));
	});

	it("renders the Starter name, price, and included credits", () => {
		const request: AdminManualRequest = {
			id: "12345678-e29b-41d4-a716-446655440000",
			status: "pending",
			organizationId: null,
			plan: "starter",
			tierCredits: 50,
			interval: "month",
			fullName: "Amel Mansouri",
			phone: "+213 555 987 654",
			company: null,
			country: "DZ",
			city: "Alger",
			preferredPaymentMethod: "ccp",
			notes: null,
			subscriptionId: null,
			handledAt: null,
			createdAt: "2028-01-01T10:00:00.000Z",
			updatedAt: "2028-01-02T10:00:00.000Z",
			user: {
				id: "user-3",
				name: "Amel",
				email: "amel@example.com",
				image: null,
			},
			organization: null,
			adminNotes: null,
			handledBy: null,
			currentSubscription: null,
		};

		const html = normalizeIntlWhitespace(
			renderToStaticMarkup(
				createElement(OfflineRequestReceipt, {
					request,
					generatedAt: new Date("2028-01-03T10:00:00.000Z"),
					dzdPerUsdRate: 271.43,
				}),
			),
		);

		expect(html).toContain("Wandit Starter");
		expect(html).toContain("2 443 DZD / mois");
		expect(html).toContain("50 crédits chaque mois");
	});
});
