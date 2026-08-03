import { Inject, Injectable } from "@nestjs/common";
import { and, eq, ne, sql } from "@wandit/db";

import {
	type CreditOwner,
	creditOwnerLockValue,
} from "../../../credits/domain/credit-owner";
import { billingChangeIntents } from "@wandit/db/schema/billing";

import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";

export type BillingChangeIntentRow = typeof billingChangeIntents.$inferSelect;
export type BillingChangeIntentTransaction = Parameters<
	Parameters<Database["transaction"]>[0]
>[0];

type BillingChangeIntentClient = Pick<
	Database,
	"execute" | "insert" | "select" | "update"
>;

@Injectable()
export class BillingChangeIntentsRepository {
	constructor(@Inject(DATABASE) private readonly db: Database) {}

	withUserLock<T>(
		userId: string,
		fn: (tx: BillingChangeIntentTransaction) => Promise<T>,
	): Promise<T> {
		return this.db.transaction(async (tx) => {
			await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${userId}))`);

			return fn(tx);
		});
	}

	/**
	 * Owner-scoped variant (creditOwnerLockValue; personal = raw user id).
	 * Change EXECUTION must serialize on the SUBSCRIPTION'S owner: an org can
	 * have several owners, and per-actor locks let two of them race conflicting
	 * Stripe changes (confirmed money-review finding).
	 */
	withOwnerLock<T>(
		owner: CreditOwner,
		fn: (tx: BillingChangeIntentTransaction) => Promise<T>,
	): Promise<T> {
		return this.db.transaction(async (tx) => {
			await tx.execute(
				sql`select pg_advisory_xact_lock(hashtext(${creditOwnerLockValue(owner)}))`,
			);

			return fn(tx);
		});
	}

	async create(
		input: typeof billingChangeIntents.$inferInsert,
		client: BillingChangeIntentClient = this.db,
	): Promise<BillingChangeIntentRow> {
		const [row] = await client
			.insert(billingChangeIntents)
			.values(input)
			.returning();

		if (!row) {
			throw new Error("Billing change intent insert returned no row");
		}

		return row;
	}

	async findById(
		id: string,
		client: BillingChangeIntentClient = this.db,
	): Promise<BillingChangeIntentRow | null> {
		const [row] = await client
			.select()
			.from(billingChangeIntents)
			.where(eq(billingChangeIntents.id, id))
			.limit(1);

		return row ?? null;
	}

	async beginProviderAttempt(
		id: string,
		userId: string,
		now: Date,
		client: BillingChangeIntentClient = this.db,
	): Promise<BillingChangeIntentRow | null> {
		const [row] = await client
			.update(billingChangeIntents)
			.set({ providerAttemptedAt: now, status: "processing" })
			.where(
				and(
					eq(billingChangeIntents.id, id),
					eq(billingChangeIntents.userId, userId),
					eq(billingChangeIntents.status, "open"),
					sql`${billingChangeIntents.expiresAt} > ${now}`,
				),
			)
			.returning();

		return row ?? null;
	}

	async completeProviderAttempt(
		input: {
			hostedInvoiceUrl?: string;
			id: string;
			now: Date;
			outcome: "applied" | "failed" | "payment_required";
			pendingExpiresAt?: Date;
			userId: string;
		},
		client: BillingChangeIntentClient = this.db,
	): Promise<BillingChangeIntentRow | null> {
		const [row] = await client
			.update(billingChangeIntents)
			.set({
				consumedAt: input.now,
				providerHostedInvoiceUrl: input.hostedInvoiceUrl ?? null,
				providerOutcome: input.outcome,
				providerPendingExpiresAt: input.pendingExpiresAt ?? null,
				status: "consumed",
			})
			.where(
				and(
					eq(billingChangeIntents.id, input.id),
					eq(billingChangeIntents.userId, input.userId),
					eq(billingChangeIntents.status, "processing"),
				),
			)
			.returning();

		if (row) {
			return row;
		}

		const existing = await this.findById(input.id, client);

		return existing?.userId === input.userId &&
			existing.status === "consumed" &&
			existing.providerOutcome === input.outcome &&
			existing.providerHostedInvoiceUrl === (input.hostedInvoiceUrl ?? null) &&
			existing.providerPendingExpiresAt?.getTime() ===
				input.pendingExpiresAt?.getTime()
			? existing
			: null;
	}

	async findOtherProcessingForSubscription(
		subscriptionId: string,
		excludedIntentId: string,
		client: BillingChangeIntentClient = this.db,
	): Promise<BillingChangeIntentRow | null> {
		const [row] = await client
			.select()
			.from(billingChangeIntents)
			.where(
				and(
					eq(billingChangeIntents.subscriptionId, subscriptionId),
					eq(billingChangeIntents.status, "processing"),
					ne(billingChangeIntents.id, excludedIntentId),
				),
			)
			.limit(1);

		return row ?? null;
	}

	async expireIfOpen(
		id: string,
		now: Date,
		client: BillingChangeIntentClient = this.db,
	): Promise<boolean> {
		const [row] = await client
			.update(billingChangeIntents)
			.set({ status: "expired" })
			.where(
				and(
					eq(billingChangeIntents.id, id),
					eq(billingChangeIntents.status, "open"),
					sql`${billingChangeIntents.expiresAt} <= ${now}`,
				),
			)
			.returning({ id: billingChangeIntents.id });

		return row !== undefined;
	}
}
