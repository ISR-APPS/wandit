import { creditTierSchema, type Subscription } from "@wandit/contracts";

import type { SubscriptionRow } from "../persistence/subscriptions.repository";

export function mapSubscriptionRow(row: SubscriptionRow): Subscription {
	return {
		cancelAtPeriodEnd: row.cancelAtPeriodEnd,
		createdAt: row.createdAt.toISOString(),
		currentPeriodEnd: row.currentPeriodEnd.toISOString(),
		currentPeriodStart: row.currentPeriodStart.toISOString(),
		id: row.id,
		interval: row.interval,
		organizationId: row.organizationId,
		plan: row.plan,
		priceLookupKey: row.priceLookupKey,
		provider: row.provider,
		providerSubscriptionId: row.providerSubscriptionId,
		status: row.status,
		tierCredits: creditTierSchema.parse(row.tierCredits),
		updatedAt: row.updatedAt.toISOString(),
		userId: row.userId,
	};
}
