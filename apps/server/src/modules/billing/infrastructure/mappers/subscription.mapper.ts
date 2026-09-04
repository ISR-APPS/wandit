import {
	billingPlanIdSchema,
	creditTierSchema,
	ENTITLED_SUBSCRIPTION_STATUSES,
	type Subscription,
} from "@wandit/contracts";

import type { SubscriptionRow } from "../persistence/subscriptions.repository";

export function mapSubscriptionRow(row: SubscriptionRow): Subscription {
	return {
		cancelAtPeriodEnd: row.cancelAtPeriodEnd,
		createdAt: row.createdAt.toISOString(),
		currentPeriodEnd: row.currentPeriodEnd.toISOString(),
		currentPeriodStart: row.currentPeriodStart.toISOString(),
		entitled: (ENTITLED_SUBSCRIPTION_STATUSES as readonly string[]).includes(
			row.status,
		),
		id: row.id,
		interval: row.interval,
		organizationId: row.organizationId,
		pendingPlan: row.pendingPlan ?? null,
		pendingInterval: row.pendingInterval ?? null,
		pendingTierCredits:
			row.pendingTierCredits === null
				? null
				: creditTierSchema.parse(row.pendingTierCredits),
		plan: billingPlanIdSchema.parse(row.plan),
		priceLookupKey: row.priceLookupKey,
		provider: row.provider,
		providerSubscriptionId: row.providerSubscriptionId,
		status: row.status,
		tierCredits: creditTierSchema.parse(row.tierCredits),
		updatedAt: row.updatedAt.toISOString(),
		userId: row.userId,
	};
}
