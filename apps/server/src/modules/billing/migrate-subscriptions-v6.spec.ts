import { v6TierForLegacy } from "@wandit/contracts";
import { describe, expect, it, vi } from "vitest";

import {
	migrateSubscriptionV6,
	migrationExitCode,
	type V6MigrationDependencies,
	type V6MigrationSubscription,
	type V6MigrationSummaryRow,
} from "../../../scripts/migrate-subscriptions-v6";

const PERIOD_END = new Date("2026-10-01T00:00:00.000Z");

function subscription(
	overrides: Partial<V6MigrationSubscription> = {},
): V6MigrationSubscription {
	return {
		cancelAtPeriodEnd: false,
		currentPeriodEnd: PERIOD_END,
		id: "subscription_1",
		interval: "month",
		organizationId: null,
		pendingAppliedBy: null,
		pendingTierCredits: null,
		plan: "pro",
		priceLookupKey: "pro_250_month",
		provider: "stripe",
		providerSubscriptionId: "sub_1",
		status: "active",
		tierCredits: 250,
		userId: "user_1",
		...overrides,
	};
}

function dependencies(
	reloadedSubscription: V6MigrationSubscription | null = subscription(),
): V6MigrationDependencies & {
	markPendingTierApplied: ReturnType<typeof vi.fn>;
	reloadSubscription: ReturnType<typeof vi.fn>;
	scheduleSubscriptionDowngrade: ReturnType<typeof vi.fn>;
	setPendingTierCredits: ReturnType<typeof vi.fn>;
	switchSubscriptionPriceWithoutProration: ReturnType<typeof vi.fn>;
	updateLocalTier: ReturnType<typeof vi.fn>;
	withOwnerLock: ReturnType<typeof vi.fn>;
} {
	return {
		markPendingTierApplied: vi.fn(async () => ({ id: "subscription_1" })),
		reloadSubscription: vi.fn(async () => reloadedSubscription),
		scheduleSubscriptionDowngrade: vi.fn(async () => "sub_sched_1"),
		setPendingTierCredits: vi.fn(async () => ({ id: "subscription_1" })),
		switchSubscriptionPriceWithoutProration: vi.fn(async () => undefined),
		updateLocalTier: vi.fn(async () => undefined),
		withOwnerLock: vi.fn(
			async (
				_subscription: V6MigrationSubscription,
				operation: () => Promise<V6MigrationSummaryRow>,
			) => operation(),
		),
	};
}

describe("pricing v6 subscription migration mapping", () => {
	it("maps every legacy tier to seventy percent of its credits", () => {
		expect(
			[250, 500, 1000, 2000, 3000, 5000, 7500, 10000, 12500].map((oldTier) => [
				oldTier,
				v6TierForLegacy(oldTier),
			]),
		).toEqual([
			[250, 175],
			[500, 350],
			[1000, 700],
			[2000, 1400],
			[3000, 2100],
			[5000, 3500],
			[7500, 5250],
			[10000, 7000],
			[12500, 8750],
		]);
	});

	it("does not remap active or unknown tiers", () => {
		expect(v6TierForLegacy(50)).toBeNull();
		expect(v6TierForLegacy(175)).toBeNull();
		expect(v6TierForLegacy(999)).toBeNull();
	});

	it("switches a cancel-at-period-end monthly Stripe row and only updates its local tier fields", async () => {
		const candidate = subscription({ cancelAtPeriodEnd: true });
		const deps = dependencies(candidate);
		const result = await migrateSubscriptionV6(candidate, true, deps);

		expect(result).toMatchObject({
			newTier: 175,
			provider: "stripe",
			status: "applied",
		});
		expect(deps.switchSubscriptionPriceWithoutProration).toHaveBeenCalledWith({
			currentPriceLookupKey: "pro_250_month",
			idempotencyKey: "billing-migrate-v6:month:sub_1:pro_175_month",
			newPriceLookupKey: "pro_175_month",
			providerSubscriptionId: "sub_1",
		});
		expect(deps.updateLocalTier).toHaveBeenCalledWith(
			"subscription_1",
			175,
			"pro_175_month",
		);
	});

	it("migrates a monthly manual row locally without making a Stripe call", async () => {
		const candidate = subscription({
			priceLookupKey: "pro_500_month",
			provider: "manual",
			providerSubscriptionId: "manual_1",
			tierCredits: 500,
		});
		const deps = dependencies(candidate);
		const result = await migrateSubscriptionV6(candidate, true, deps);

		expect(result).toMatchObject({
			newTier: 350,
			provider: "manual",
			status: "applied",
		});
		expect(deps.switchSubscriptionPriceWithoutProration).not.toHaveBeenCalled();
		expect(deps.updateLocalTier).toHaveBeenCalledWith(
			"subscription_1",
			350,
			"pro_350_month",
		);
	});

	it("schedules a yearly manual tier locally and makes its replay a no-op", async () => {
		const manual = subscription({
			interval: "year",
			priceLookupKey: "pro_250_year",
			provider: "manual",
			providerSubscriptionId: "manual_1",
		});
		const deps = dependencies(manual);

		const first = await migrateSubscriptionV6(manual, true, deps);
		const replay = await migrateSubscriptionV6(
			{ ...manual, pendingTierCredits: 175 },
			true,
			deps,
		);

		expect(first).toMatchObject({
			newTier: 175,
			provider: "manual",
			status: "applied",
		});
		expect(deps.setPendingTierCredits).toHaveBeenCalledOnce();
		expect(deps.setPendingTierCredits).toHaveBeenCalledWith("manual_1", 175);
		expect(deps.scheduleSubscriptionDowngrade).not.toHaveBeenCalled();
		expect(replay).toMatchObject({
			reason: "v6 renewal tier is already scheduled",
			status: "skipped",
		});
	});

	it("skips only yearly Stripe rows that are set to cancel at period end", async () => {
		const deps = dependencies();
		const result = await migrateSubscriptionV6(
			subscription({
				cancelAtPeriodEnd: true,
				interval: "year",
				priceLookupKey: "pro_250_year",
			}),
			true,
			deps,
		);

		expect(result).toMatchObject({
			reason:
				"yearly subscription is set to cancel at period end; rerun after a resume",
			status: "skipped",
		});
		expect(deps.scheduleSubscriptionDowngrade).not.toHaveBeenCalled();
		expect(deps.updateLocalTier).not.toHaveBeenCalled();
	});

	it("schedules a fresh yearly Stripe migration from a verified snapshot", async () => {
		const candidate = subscription({
			interval: "year",
			priceLookupKey: "pro_250_year",
		});
		const deps = dependencies(candidate);

		const result = await migrateSubscriptionV6(candidate, true, deps);

		expect(result).toMatchObject({
			newTier: 175,
			status: "applied",
		});
		expect(deps.withOwnerLock).toHaveBeenCalledWith(
			candidate,
			expect.any(Function),
		);
		expect(deps.reloadSubscription).toHaveBeenCalledWith("subscription_1");
		expect(deps.scheduleSubscriptionDowngrade).toHaveBeenCalledWith({
			allowSameIntentRecovery: true,
			currentPriceLookupKey: "pro_250_year",
			expectedScheduleTarget: null,
			idempotencyKey: "billing-migrate-v6:year:sub_1:pro_175_year",
			newPriceLookupKey: "pro_175_year",
			providerSubscriptionId: "sub_1",
		});
	});

	it("skips writes when a billing change already owns the subscription", async () => {
		const candidate = subscription({
			interval: "year",
			priceLookupKey: "pro_250_year",
		});
		const deps = dependencies(candidate);
		deps.withOwnerLock.mockResolvedValueOnce(null);

		const result = await migrateSubscriptionV6(candidate, true, deps);

		expect(result).toMatchObject({
			reason: "row changed since candidates were read",
			status: "skipped",
		});
		expect(deps.reloadSubscription).not.toHaveBeenCalled();
		expect(deps.scheduleSubscriptionDowngrade).not.toHaveBeenCalled();
		expect(deps.setPendingTierCredits).not.toHaveBeenCalled();
	});

	it("retargets a user-scheduled yearly legacy tier to its v6 mapping", async () => {
		const candidate = subscription({
			interval: "year",
			pendingAppliedBy: "sub_sched_legacy",
			pendingTierCredits: 1000,
			plan: "business",
			priceLookupKey: "business_2000_year",
			tierCredits: 2000,
		});
		const deps = dependencies(candidate);
		const result = await migrateSubscriptionV6(candidate, true, deps);

		expect(result).toMatchObject({
			newTier: 700,
			reason: "existing legacy renewal change retargeted to its v6 tier",
			status: "applied",
		});
		expect(deps.scheduleSubscriptionDowngrade).toHaveBeenCalledWith({
			allowSameIntentRecovery: true,
			currentPriceLookupKey: "business_2000_year",
			expectedScheduleTarget: "business_1000_year",
			idempotencyKey: "billing-migrate-v6:year:sub_1:business_700_year",
			newPriceLookupKey: "business_700_year",
			providerSubscriptionId: "sub_1",
		});
		expect(deps.setPendingTierCredits).toHaveBeenCalledWith("sub_1", 700);
		expect(deps.markPendingTierApplied).toHaveBeenCalledWith(
			"sub_1",
			"sub_sched_1",
		);
	});

	it.each([
		["price lookup key", { priceLookupKey: "pro_500_year" }],
		["pending tier", { pendingTierCredits: 350 }],
		["cancellation flag", { cancelAtPeriodEnd: true }],
		["status", { status: "past_due" }],
	] as const)("skips a yearly write when the reloaded row changed its %s", async (_field, changedFields) => {
		const candidate = subscription({
			interval: "year",
			priceLookupKey: "pro_250_year",
		});
		const deps = dependencies({ ...candidate, ...changedFields });

		const result = await migrateSubscriptionV6(candidate, true, deps);

		expect(result).toMatchObject({
			reason: "row changed since candidates were read",
			status: "skipped",
		});
		expect(deps.reloadSubscription).toHaveBeenCalledWith("subscription_1");
		expect(deps.scheduleSubscriptionDowngrade).not.toHaveBeenCalled();
		expect(deps.setPendingTierCredits).not.toHaveBeenCalled();
		expect(deps.markPendingTierApplied).not.toHaveBeenCalled();
	});

	it("records a failed row, keeps later rows runnable, and requests a non-zero exit", async () => {
		const failedDeps = dependencies();
		failedDeps.switchSubscriptionPriceWithoutProration.mockRejectedValueOnce(
			new Error("Stripe price missing"),
		);
		const appliedDeps = dependencies();

		const first = await migrateSubscriptionV6(
			subscription({ id: "subscription_failed" }),
			true,
			failedDeps,
		);
		const second = await migrateSubscriptionV6(
			subscription({ id: "subscription_applied" }),
			true,
			appliedDeps,
		);

		expect(first).toMatchObject({
			reason: "Stripe price missing",
			status: "failed",
		});
		expect(second.status).toBe("applied");
		expect(appliedDeps.updateLocalTier).toHaveBeenCalledOnce();
		expect(migrationExitCode([first, second])).toBe(1);
		expect(migrationExitCode([second])).toBe(0);
	});

	it("does not update the local tier when Stripe reports a pending update", async () => {
		const candidate = subscription();
		const deps = dependencies(candidate);
		deps.switchSubscriptionPriceWithoutProration.mockRejectedValueOnce(
			new Error("Stripe subscription sub_1 has a pending update"),
		);

		const result = await migrateSubscriptionV6(candidate, true, deps);

		expect(result).toMatchObject({
			reason: "Stripe subscription sub_1 has a pending update",
			status: "failed",
		});
		expect(deps.updateLocalTier).not.toHaveBeenCalled();
	});

	it("performs no writes in dry-run mode while reporting the planned provider", async () => {
		const deps = dependencies();
		const result = await migrateSubscriptionV6(subscription(), false, deps);

		expect(result).toMatchObject({
			provider: "stripe",
			reason: "dry run: monthly tier would be switched",
			status: "skipped",
		});
		expect(deps.switchSubscriptionPriceWithoutProration).not.toHaveBeenCalled();
		expect(deps.updateLocalTier).not.toHaveBeenCalled();
	});
});
