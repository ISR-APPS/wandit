import type { BillingPlanId } from "@wandit/contracts";
import { describe, expect, it } from "vitest";

import type { CreditOwner } from "../../../credits/domain/credit-owner";
import type {
	SubscriptionRow,
	SubscriptionsRepository,
} from "../../infrastructure/persistence/subscriptions.repository";
import { resolveBillingPlan } from "./resolve-billing-plan";

const NOW = new Date("2026-09-16T00:00:00.000Z");

function subscriptionRow(plan: BillingPlanId): SubscriptionRow {
	return {
		cancelAtPeriodEnd: false,
		createdAt: NOW,
		currentPeriodEnd: NOW,
		currentPeriodStart: NOW,
		id: "sub_1",
		interval: "year",
		organizationId: null,
		pendingAppliedBy: null,
		pendingInterval: null,
		pendingPlan: null,
		pendingTierCredits: null,
		plan,
		priceLookupKey: "pro_250_year",
		provider: "stripe",
		providerSubscriptionId: "sub_stripe_1",
		status: "active",
		tierCredits: 250,
		updatedAt: NOW,
		userId: "user_1",
	};
}

describe("resolveBillingPlan", () => {
	it("returns the payer's plan when a subscription exists", async () => {
		const subscriptions: Pick<SubscriptionsRepository, "findActiveByOwner"> = {
			findActiveByOwner: async () => subscriptionRow("pro"),
		};

		await expect(
			resolveBillingPlan(subscriptions, { actorUserId: "user_1" }),
		).resolves.toBe("pro");
	});

	it("returns starter when the payer has no subscription", async () => {
		const subscriptions: Pick<SubscriptionsRepository, "findActiveByOwner"> = {
			findActiveByOwner: async () => null,
		};

		await expect(
			resolveBillingPlan(subscriptions, { actorUserId: "user_1" }),
		).resolves.toBe("starter");
	});

	it("looks up the organization pool for an org subject", async () => {
		const owners: CreditOwner[] = [];
		const subscriptions: Pick<SubscriptionsRepository, "findActiveByOwner"> = {
			findActiveByOwner: async (owner) => {
				owners.push(owner);
				return null;
			},
		};

		await resolveBillingPlan(subscriptions, {
			actorUserId: "user_1",
			organizationId: "org_1",
		});

		expect(owners).toEqual([{ type: "org", organizationId: "org_1" }]);
	});
});
