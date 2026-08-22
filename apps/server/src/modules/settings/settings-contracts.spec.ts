import {
	adminAnalyticsCollectedRevenuePointSchema,
	adminAnalyticsCreditsSchema,
	adminAnalyticsRevenueBySourceSchema,
	adminCreditLedgerEntrySchema,
	backfillSignupGrantsBodySchema,
	backfillSignupGrantsResponseSchema,
	productSettingsUpdateResponseSchema,
} from "@wandit/contracts";
import { describe, expect, it } from "vitest";

describe("workstream 5 contract round-trips", () => {
	it("parses the signup grant backfill action and its response", () => {
		expect(backfillSignupGrantsBodySchema.parse({})).toEqual({ dryRun: false });
		expect(
			backfillSignupGrantsBodySchema.parse({
				createdAfter: "2026-08-01T00:00:00.000Z",
				dryRun: true,
			}),
		).toEqual({ createdAfter: "2026-08-01T00:00:00.000Z", dryRun: true });
		expect(
			backfillSignupGrantsResponseSchema.parse({ requeued: 3, skipped: 12 }),
		).toEqual({ requeued: 3, skipped: 12 });
		expect(
			backfillSignupGrantsResponseSchema.safeParse({ requeued: -1, skipped: 0 })
				.success,
		).toBe(false);
	});

	it("keeps the settings update response compatible with and without the skipped count", () => {
		const settings = {
			emailAuthEnabled: false,
			id: 1,
			manualGraceDays: 3,
			manualPaymentsEnabled: false,
			organizationsEnabled: false,
			paidSubscriptionsEnabled: true,
			signupGrantCredits: 50,
			signupGrantEnabled: true,
			topupsEnabled: true,
			updatedAt: "2026-08-22T10:00:00.000Z",
			updatedByUserId: "admin_1",
			version: 4,
		};

		expect(productSettingsUpdateResponseSchema.parse(settings)).toEqual(
			settings,
		);
		expect(
			productSettingsUpdateResponseSchema.parse({
				...settings,
				signupGrantSkippedCount: 12,
			}).signupGrantSkippedCount,
		).toBe(12);
	});

	it("parses the admin analytics additions", () => {
		expect(
			adminAnalyticsRevenueBySourceSchema.parse({
				domainCostCents: 0,
				domainCostUnknownOrders: 0,
				domainMarginCents: 0,
				domainMarginPct: null,
				domainOrders: 0,
				domainsCents: 0,
				subscriptionsCents: 2_500,
				topupsCents: 2_500,
			}).topupsCents,
		).toBe(2_500);
		expect(
			adminAnalyticsCollectedRevenuePointSchema.parse({
				date: "2026-08-22",
				ordersMinor: 0,
				subscriptionsMinor: 0,
				topupsMinor: 2_500,
			}).topupsMinor,
		).toBe(2_500);
		expect(
			adminAnalyticsCreditsSchema.parse({
				avgConsumedPerFreeUser: 0,
				avgConsumedPerPaidUser: 0,
				avgCreditsBeforeUpgrade: 0,
				billableProviderCostMicros: 120_000,
				consumedInRange: 50,
				consumptionBuckets: [],
				grantedInRange: 100,
				providerCostByProvenanceMicros: {
					contract: 30_000,
					estimate: 20_000,
					measured: 150_000,
				},
				providerCostPerCreditMicros: 2_400,
				totalProviderCostMicros: 200_000,
				usersAtZeroBalance: 0,
			}),
		).toMatchObject({ billableProviderCostMicros: 120_000 });
		expect(
			adminAnalyticsCreditsSchema.safeParse({
				avgConsumedPerFreeUser: 0,
				avgConsumedPerPaidUser: 0,
				avgCreditsBeforeUpgrade: 0,
				billableProviderCostMicros: 0,
				consumedInRange: -1,
				consumptionBuckets: [],
				grantedInRange: 0,
				providerCostByProvenanceMicros: {
					contract: 0,
					estimate: 0,
					measured: 0,
				},
				providerCostPerCreditMicros: 0,
				totalProviderCostMicros: 0,
				usersAtZeroBalance: 0,
			}).success,
		).toBe(false);
		expect(
			adminCreditLedgerEntrySchema.parse({
				aiCostProvenance: "measured",
				aiCostUsdMicros: 1_200,
				aiModel: "openai/gpt-5",
				aiProvider: "openai",
				bucket: "plan",
				createdAt: "2026-08-22T10:00:00.000Z",
				delta: -0.37,
				id: "11111111-1111-4111-8111-111111111111",
				kind: "consume",
				meta: null,
			}).aiCostProvenance,
		).toBe("measured");
	});
});
