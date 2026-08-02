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

export type SubscriptionsTransaction = Parameters<
	Parameters<Database["transaction"]>[0]
>[0];

type SubscriptionsClient = Pick<Database, "insert" | "select" | "update">;

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

export type UpdateSubscriptionProviderStateInput = {
	cancelAtPeriodEnd: boolean;
	currentPeriodEnd: Date;
	currentPeriodStart: Date;
	providerSubscriptionId: string;
	status: string;
};

@Injectable()
export class SubscriptionsRepository {
	constructor(@Inject(DATABASE) private readonly db: Database) {}

	async withStripeCustomerSyncLock<T>(
		providerCustomerId: string,
		fn: (tx: SubscriptionsTransaction) => Promise<T>,
	): Promise<T> {
		return this.db.transaction(async (tx) => {
			await tx.execute(
				sql`select pg_advisory_xact_lock(hashtext('stripe-sub-sync:' || ${providerCustomerId}::text))`,
			);

			return fn(tx);
		});
	}

	async upsertByProviderSubscriptionId(
		input: UpsertSubscriptionInput,
		client: SubscriptionsClient = this.db,
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
		const [row] = await client
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

	async findActiveByUserId(
		userId: string,
		client: SubscriptionsClient = this.db,
	): Promise<SubscriptionRow | null> {
		const [row] = await client
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
		client: SubscriptionsClient = this.db,
	): Promise<SubscriptionRow | null> {
		const [row] = await client
			.select()
			.from(subscriptions)
			.where(eq(subscriptions.providerSubscriptionId, providerSubscriptionId))
			.limit(1);

		return row ?? null;
	}

	async findById(
		id: string,
		client: SubscriptionsClient = this.db,
	): Promise<SubscriptionRow | null> {
		const [row] = await client
			.select()
			.from(subscriptions)
			.where(eq(subscriptions.id, id))
			.limit(1);

		return row ?? null;
	}

	async setPendingTierCredits(
		providerSubscriptionId: string,
		pendingTierCredits: CreditTier | null,
		client: SubscriptionsClient = this.db,
	): Promise<SubscriptionRow | null> {
		const [row] = await client
			.update(subscriptions)
			.set({
				pendingAppliedBy: null,
				pendingTierCredits,
				updatedAt: new Date(),
			})
			.where(eq(subscriptions.providerSubscriptionId, providerSubscriptionId))
			.returning();

		return row ?? null;
	}

	async markPendingTierApplied(
		providerSubscriptionId: string,
		appliedBy: string,
		client: SubscriptionsClient = this.db,
	): Promise<SubscriptionRow | null> {
		const [row] = await client
			.update(subscriptions)
			.set({ pendingAppliedBy: appliedBy, updatedAt: new Date() })
			.where(
				and(
					eq(subscriptions.providerSubscriptionId, providerSubscriptionId),
					sql`${subscriptions.pendingTierCredits} IS NOT NULL`,
					sql`${subscriptions.pendingAppliedBy} IS NULL`,
				),
			)
			.returning();

		return row ?? null;
	}

	async clearAppliedPendingTier(
		providerSubscriptionId: string,
		client: SubscriptionsClient = this.db,
	): Promise<SubscriptionRow | null> {
		const [row] = await client
			.update(subscriptions)
			.set({
				pendingAppliedBy: null,
				pendingTierCredits: null,
				updatedAt: new Date(),
			})
			.where(
				and(
					eq(subscriptions.providerSubscriptionId, providerSubscriptionId),
					sql`${subscriptions.pendingAppliedBy} IS NOT NULL`,
				),
			)
			.returning();

		return row ?? null;
	}

	async clearMatchingPendingTier(
		providerSubscriptionId: string,
		tierCredits: number,
		client: SubscriptionsClient = this.db,
	): Promise<SubscriptionRow | null> {
		const [row] = await client
			.update(subscriptions)
			.set({
				pendingAppliedBy: null,
				pendingTierCredits: null,
				updatedAt: new Date(),
			})
			.where(
				and(
					eq(subscriptions.providerSubscriptionId, providerSubscriptionId),
					eq(subscriptions.pendingTierCredits, tierCredits),
				),
			)
			.returning();

		return row ?? null;
	}

	async updateStatus(
		providerSubscriptionId: string,
		status: string,
		client: SubscriptionsClient = this.db,
	): Promise<SubscriptionRow | null> {
		const [row] = await client
			.update(subscriptions)
			.set({
				status,
				updatedAt: new Date(),
			})
			.where(eq(subscriptions.providerSubscriptionId, providerSubscriptionId))
			.returning();

		return row ?? null;
	}

	async updateProviderState(
		input: UpdateSubscriptionProviderStateInput,
		client: SubscriptionsClient = this.db,
	): Promise<SubscriptionRow | null> {
		const [row] = await client
			.update(subscriptions)
			.set({
				cancelAtPeriodEnd: input.cancelAtPeriodEnd,
				currentPeriodEnd: input.currentPeriodEnd,
				currentPeriodStart: input.currentPeriodStart,
				status: input.status,
				updatedAt: new Date(),
			})
			.where(
				eq(subscriptions.providerSubscriptionId, input.providerSubscriptionId),
			)
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
