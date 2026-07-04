import { Inject, Injectable } from "@nestjs/common";
import type {
	BillingInterval,
	BillingPlanId,
	CreditTier,
} from "@wandit/contracts";
import { and, desc, eq, sql } from "@wandit/db";
import { subscriptions } from "@wandit/db/schema/billing";

import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";

export type SubscriptionRow = typeof subscriptions.$inferSelect;

export type UpsertSubscriptionInput = {
	cancelAtPeriodEnd: boolean;
	currentPeriodEnd: Date;
	currentPeriodStart: Date;
	interval: BillingInterval;
	organizationId?: string | null;
	plan: BillingPlanId;
	priceLookupKey: string;
	provider: string;
	providerSubscriptionId: string;
	status: string;
	tierCredits: CreditTier;
	userId: string;
};

@Injectable()
export class SubscriptionsRepository {
	constructor(@Inject(DATABASE) private readonly db: Database) {}

	async upsertByProviderSubscriptionId(
		input: UpsertSubscriptionInput,
	): Promise<SubscriptionRow> {
		const values = {
			cancelAtPeriodEnd: input.cancelAtPeriodEnd,
			currentPeriodEnd: input.currentPeriodEnd,
			currentPeriodStart: input.currentPeriodStart,
			interval: input.interval,
			organizationId: input.organizationId ?? null,
			plan: input.plan,
			priceLookupKey: input.priceLookupKey,
			provider: input.provider,
			providerSubscriptionId: input.providerSubscriptionId,
			status: input.status,
			tierCredits: input.tierCredits,
			userId: input.userId,
		};
		const [row] = await this.db
			.insert(subscriptions)
			.values(values)
			.onConflictDoUpdate({
				set: {
					...values,
					updatedAt: new Date(),
				},
				target: subscriptions.providerSubscriptionId,
			})
			.returning();

		return this.expectRow(row);
	}

	async findActiveByUserId(userId: string): Promise<SubscriptionRow | null> {
		const [row] = await this.db
			.select()
			.from(subscriptions)
			.where(
				and(
					eq(subscriptions.userId, userId),
					sql`${subscriptions.status} NOT IN ('canceled', 'incomplete_expired')`,
				),
			)
			.orderBy(desc(subscriptions.updatedAt), desc(subscriptions.createdAt))
			.limit(1);

		return row ?? null;
	}

	async findByProviderSubscriptionId(
		providerSubscriptionId: string,
	): Promise<SubscriptionRow | null> {
		const [row] = await this.db
			.select()
			.from(subscriptions)
			.where(eq(subscriptions.providerSubscriptionId, providerSubscriptionId))
			.limit(1);

		return row ?? null;
	}

	async updateStatus(
		providerSubscriptionId: string,
		status: string,
	): Promise<SubscriptionRow | null> {
		const [row] = await this.db
			.update(subscriptions)
			.set({
				status,
				updatedAt: new Date(),
			})
			.where(eq(subscriptions.providerSubscriptionId, providerSubscriptionId))
			.returning();

		return row ?? null;
	}

	async updateCancelAtPeriodEnd(
		providerSubscriptionId: string,
		cancelAtPeriodEnd: boolean,
	): Promise<SubscriptionRow | null> {
		const [row] = await this.db
			.update(subscriptions)
			.set({
				cancelAtPeriodEnd,
				updatedAt: new Date(),
			})
			.where(eq(subscriptions.providerSubscriptionId, providerSubscriptionId))
			.returning();

		return row ?? null;
	}

	private expectRow(row: SubscriptionRow | undefined) {
		if (!row) {
			throw new Error("Subscription write did not return a row");
		}

		return row;
	}
}
