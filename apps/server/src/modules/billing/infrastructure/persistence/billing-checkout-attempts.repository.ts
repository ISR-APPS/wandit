/**
 * Stores the Stripe Checkout attempts of billing: one row per started checkout.
 * BillingService writes top-up attempts. The webhook services attach, complete, and expire them.
 * Reads and writes `billing_checkout_attempts` through Drizzle.
 */
import { Inject, Injectable } from "@nestjs/common";
import type { CheckoutPurpose } from "@wandit/contracts";
import { and, asc, eq, inArray, isNull, sql } from "@wandit/db";
import { billingCheckoutAttempts } from "@wandit/db/schema/billing";
import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";
import {
	type CreditOwner,
	creditOwnerLockValue,
} from "../../../credits/domain/credit-owner";

export type BillingCheckoutAttemptRow =
	typeof billingCheckoutAttempts.$inferSelect;
export type BillingCheckoutAttemptTransaction = Parameters<
	Parameters<Database["transaction"]>[0]
>[0];

type BillingCheckoutAttemptClient = Pick<
	Database,
	"execute" | "insert" | "select" | "update"
>;

type PersistedCheckoutPurpose = Exclude<CheckoutPurpose, "order">;

@Injectable()
export class BillingCheckoutAttemptsRepository {
	constructor(@Inject(DATABASE) private readonly db: Database) {}

	withUserLock<T>(
		userId: string,
		fn: (tx: BillingCheckoutAttemptTransaction) => Promise<T>,
	): Promise<T> {
		return this.db.transaction(async (tx) => {
			await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${userId}))`);

			return fn(tx);
		});
	}

	/** Owner-scoped variant: personal keys stay the raw user id (byte-compat). */
	withOwnerLock<T>(
		owner: CreditOwner,
		fn: (tx: BillingCheckoutAttemptTransaction) => Promise<T>,
	): Promise<T> {
		return this.db.transaction(async (tx) => {
			await tx.execute(
				sql`select pg_advisory_xact_lock(hashtext(${creditOwnerLockValue(owner)}))`,
			);

			return fn(tx);
		});
	}

	/**
	 * Inserts a wallet top-up attempt. Call it under `withOwnerLock`.
	 * The webhook later grants `credits` and compares `amountUsdCents` with the Stripe subtotal.
	 */
	async create(
		input: {
			id: string;
			organizationId: string | null;
			/** UNIT: USD cents. A positive integer. */
			amountUsdCents: number;
			/** UNIT: centi-credits. A positive integer. */
			credits: number;
			userId: string;
		},
		client: BillingCheckoutAttemptClient = this.db,
	): Promise<BillingCheckoutAttemptRow> {
		// A wrong amount here grants wrong credits later. Fail before the insert.
		if (
			!Number.isSafeInteger(input.amountUsdCents) ||
			input.amountUsdCents <= 0 ||
			!Number.isSafeInteger(input.credits) ||
			input.credits <= 0
		) {
			throw new Error(
				`Top-up checkout attempt ${input.id} needs positive integer amounts`,
			);
		}

		const [row] = await client
			.insert(billingCheckoutAttempts)
			.values({
				amountUsdCents: input.amountUsdCents,
				credits: input.credits,
				id: input.id,
				organizationId: input.organizationId,
				purpose: "topup",
				status: "created",
				userId: input.userId,
			})
			.returning();

		if (!row) {
			throw new Error("Billing checkout attempt insert returned no row");
		}

		return row;
	}

	async attachSession(
		id: string,
		providerSessionId: string,
		client: BillingCheckoutAttemptClient = this.db,
	): Promise<BillingCheckoutAttemptRow | null> {
		const [row] = await client
			.update(billingCheckoutAttempts)
			.set({
				providerSessionId,
				status: "session_attached",
				updatedAt: new Date(),
			})
			.where(
				and(
					eq(billingCheckoutAttempts.id, id),
					eq(billingCheckoutAttempts.status, "created"),
					sql`${billingCheckoutAttempts.providerSessionId} IS NULL`,
				),
			)
			.returning();

		return row ?? null;
	}

	async findByProviderSessionId(
		providerSessionId: string,
		client: BillingCheckoutAttemptClient = this.db,
	): Promise<BillingCheckoutAttemptRow | null> {
		const [row] = await client
			.select()
			.from(billingCheckoutAttempts)
			.where(eq(billingCheckoutAttempts.providerSessionId, providerSessionId))
			.limit(1);

		return row ?? null;
	}

	async findById(
		id: string,
		client: BillingCheckoutAttemptClient = this.db,
	): Promise<BillingCheckoutAttemptRow | null> {
		const [row] = await client
			.select()
			.from(billingCheckoutAttempts)
			.where(eq(billingCheckoutAttempts.id, id))
			.limit(1);

		return row ?? null;
	}

	/**
	 * Open attempts are serialized PER OWNER: an org's open checkout must block
	 * another org checkout, but never the same owner's personal checkout.
	 */
	async findOpenForOwner(
		owner: CreditOwner,
		purpose: PersistedCheckoutPurpose,
		client: BillingCheckoutAttemptClient = this.db,
	): Promise<BillingCheckoutAttemptRow[]> {
		const ownerPredicate =
			owner.type === "user"
				? and(
						eq(billingCheckoutAttempts.userId, owner.userId),
						isNull(billingCheckoutAttempts.organizationId),
					)
				: eq(billingCheckoutAttempts.organizationId, owner.organizationId);

		return client
			.select()
			.from(billingCheckoutAttempts)
			.where(
				and(
					ownerPredicate,
					eq(billingCheckoutAttempts.purpose, purpose),
					inArray(billingCheckoutAttempts.status, [
						"created",
						"session_attached",
					]),
				),
			)
			.orderBy(asc(billingCheckoutAttempts.createdAt));
	}

	async markCompletedBySession(
		providerSessionId: string,
		client: BillingCheckoutAttemptClient = this.db,
	): Promise<BillingCheckoutAttemptRow | null> {
		const [row] = await client
			.update(billingCheckoutAttempts)
			.set({ status: "completed", updatedAt: new Date() })
			.where(
				and(
					eq(billingCheckoutAttempts.providerSessionId, providerSessionId),
					eq(billingCheckoutAttempts.status, "session_attached"),
				),
			)
			.returning();

		if (row) {
			return row;
		}

		const existing = await this.findByProviderSessionId(
			providerSessionId,
			client,
		);

		return existing?.status === "completed" ? existing : null;
	}

	async markExpired(
		id: string,
		client: BillingCheckoutAttemptClient = this.db,
	): Promise<boolean> {
		const [row] = await client
			.update(billingCheckoutAttempts)
			.set({ status: "expired", updatedAt: new Date() })
			.where(
				and(
					eq(billingCheckoutAttempts.id, id),
					inArray(billingCheckoutAttempts.status, [
						"created",
						"session_attached",
					]),
				),
			)
			.returning({ id: billingCheckoutAttempts.id });

		return row !== undefined;
	}
}
