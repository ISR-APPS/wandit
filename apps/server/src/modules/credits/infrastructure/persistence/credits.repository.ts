import { Inject, Injectable } from "@nestjs/common";
import {
	CREDIT_SPEND_ORDER,
	type CreditBucket,
	type CreditKind,
	type PaginationQuery,
} from "@wandit/contracts";
import { and, asc, desc, eq, gt, inArray, sql } from "@wandit/db";
import {
	creditLedger,
	creditPlanHoldPools,
	creditPlanHolds,
} from "@wandit/db/schema/credits";

import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";

export type CreditLedgerRow = typeof creditLedger.$inferSelect;
export type CreditPlanHoldRow = typeof creditPlanHolds.$inferSelect;
export type CreditPlanHoldPoolRow = typeof creditPlanHoldPools.$inferSelect;

export type CreditBalance = {
	balance: number;
	plan: number;
	promo: number;
	topup: number;
};

export type InsertCreditLedgerEntry = {
	bucket: CreditBucket;
	delta: number;
	idempotencyKey?: string;
	kind: CreditKind;
	meta: Record<string, unknown>;
	organizationId?: string | null;
	userId: string;
};

export type CreditsTransaction = Parameters<
	Parameters<Database["transaction"]>[0]
>[0];

type CreditsDbClient = Pick<
	Database,
	"execute" | "insert" | "select" | "update"
>;

@Injectable()
export class CreditsRepository {
	constructor(@Inject(DATABASE) private readonly db: Database) {}

	async withUserLock<T>(
		userId: string,
		fn: (tx: CreditsTransaction) => Promise<T>,
		transaction?: CreditsTransaction,
	): Promise<T> {
		if (transaction) {
			await this.acquireUserLock(userId, transaction);

			return fn(transaction);
		}

		return this.db.transaction(async (tx) => {
			await this.acquireUserLock(userId, tx);

			return fn(tx);
		});
	}

	getBalance(userId: string, client: CreditsDbClient = this.db) {
		return this.sumBalances(userId, client);
	}

	async listByUser(userId: string, pagination: PaginationQuery) {
		const where = eq(creditLedger.userId, userId);
		const offset = (pagination.page - 1) * pagination.pageSize;

		const [totalRow] = await this.db
			.select({ total: sql<number>`count(*)::int` })
			.from(creditLedger)
			.where(where);

		const items = await this.db
			.select()
			.from(creditLedger)
			.where(where)
			.orderBy(desc(creditLedger.createdAt), desc(creditLedger.id))
			.limit(pagination.pageSize)
			.offset(offset);

		return {
			items,
			page: pagination.page,
			pageSize: pagination.pageSize,
			total: totalRow?.total ?? 0,
		};
	}

	async insertLedgerEntry(
		input: InsertCreditLedgerEntry,
		client: CreditsDbClient = this.db,
	): Promise<CreditLedgerRow> {
		const values = {
			bucket: input.bucket,
			delta: input.delta,
			idempotencyKey: input.idempotencyKey ?? null,
			kind: input.kind,
			meta: input.meta,
			organizationId: input.organizationId ?? null,
			userId: input.userId,
		};

		if (!input.idempotencyKey) {
			const [inserted] = await client
				.insert(creditLedger)
				.values(values)
				.returning();

			return this.expectInsertedRow(inserted);
		}

		const [inserted] = await client
			.insert(creditLedger)
			.values(values)
			.onConflictDoNothing({
				target: creditLedger.idempotencyKey,
				where: sql`${creditLedger.idempotencyKey} IS NOT NULL`,
			})
			.returning();

		if (inserted) {
			return inserted;
		}

		const existing = await this.findByIdempotencyKey(
			input.idempotencyKey,
			client,
		);

		return this.expectInsertedRow(existing);
	}

	async findByIdempotencyKeys(
		userId: string,
		idempotencyKeys: string[],
		client: CreditsDbClient = this.db,
	): Promise<CreditLedgerRow[]> {
		if (idempotencyKeys.length === 0) {
			return [];
		}

		return client
			.select()
			.from(creditLedger)
			.where(
				and(
					eq(creditLedger.userId, userId),
					inArray(creditLedger.idempotencyKey, idempotencyKeys),
				),
			)
			.orderBy(desc(creditLedger.createdAt), desc(creditLedger.id));
	}

	async findByIdempotencyKey(
		idempotencyKey: string,
		client: CreditsDbClient = this.db,
	): Promise<CreditLedgerRow | null> {
		const [row] = await client
			.select()
			.from(creditLedger)
			.where(eq(creditLedger.idempotencyKey, idempotencyKey))
			.limit(1);

		return row ?? null;
	}

	async findPlanHold(
		consumeIdempotencyKey: string,
		client: CreditsDbClient = this.db,
	): Promise<CreditPlanHoldRow | null> {
		const [row] = await client
			.select()
			.from(creditPlanHolds)
			.where(eq(creditPlanHolds.consumeIdempotencyKey, consumeIdempotencyKey))
			.limit(1);

		return row ?? null;
	}

	async insertPlanHold(
		input: {
			active: boolean;
			consumeIdempotencyKey: string;
			consumeLedgerId: string;
			originalCredits: number;
			userId: string;
		},
		client: CreditsDbClient = this.db,
	): Promise<CreditPlanHoldRow> {
		const [inserted] = await client
			.insert(creditPlanHolds)
			.values({
				active: input.active,
				consumeIdempotencyKey: input.consumeIdempotencyKey,
				consumeLedgerId: input.consumeLedgerId,
				originalCredits: input.originalCredits,
				refundableCredits: input.originalCredits,
				userId: input.userId,
			})
			.onConflictDoNothing({
				target: creditPlanHolds.consumeIdempotencyKey,
			})
			.returning();

		if (inserted) {
			return inserted;
		}

		const existing = await this.findPlanHold(
			input.consumeIdempotencyKey,
			client,
		);

		if (!existing) {
			throw new Error(
				`Credit plan hold ${input.consumeIdempotencyKey} disappeared after conflict`,
			);
		}

		return existing;
	}

	listRefundablePlanHolds(
		userId: string,
		client: CreditsDbClient = this.db,
	): Promise<CreditPlanHoldRow[]> {
		return client
			.select()
			.from(creditPlanHolds)
			.where(
				and(
					eq(creditPlanHolds.userId, userId),
					gt(creditPlanHolds.refundableCredits, 0),
				),
			)
			.orderBy(
				asc(creditPlanHolds.createdAt),
				asc(creditPlanHolds.consumeIdempotencyKey),
			);
	}

	async findPlanHoldPools(
		poolIds: string[],
		client: CreditsDbClient = this.db,
	): Promise<CreditPlanHoldPoolRow[]> {
		if (poolIds.length === 0) {
			return [];
		}

		return client
			.select()
			.from(creditPlanHoldPools)
			.where(inArray(creditPlanHoldPools.id, poolIds));
	}

	async insertPlanHoldPool(
		input: {
			boundaryIdempotencyKey: string;
			remainingCredits: number;
			userId: string;
		},
		client: CreditsDbClient = this.db,
	): Promise<CreditPlanHoldPoolRow> {
		const [inserted] = await client
			.insert(creditPlanHoldPools)
			.values(input)
			.onConflictDoNothing({
				target: creditPlanHoldPools.boundaryIdempotencyKey,
			})
			.returning();

		if (inserted) {
			return inserted;
		}

		const [existing] = await client
			.select()
			.from(creditPlanHoldPools)
			.where(
				eq(
					creditPlanHoldPools.boundaryIdempotencyKey,
					input.boundaryIdempotencyKey,
				),
			)
			.limit(1);

		if (!existing) {
			throw new Error(
				`Credit plan hold pool ${input.boundaryIdempotencyKey} disappeared after conflict`,
			);
		}

		return existing;
	}

	async updatePlanHoldRefundable(
		consumeIdempotencyKey: string,
		userId: string,
		expectedCredits: number,
		refundableCredits: number,
		client: CreditsDbClient = this.db,
	): Promise<CreditPlanHoldRow | null> {
		const [updated] = await client
			.update(creditPlanHolds)
			.set({ refundableCredits, updatedAt: new Date() })
			.where(
				and(
					eq(creditPlanHolds.consumeIdempotencyKey, consumeIdempotencyKey),
					eq(creditPlanHolds.userId, userId),
					eq(creditPlanHolds.refundableCredits, expectedCredits),
				),
			)
			.returning();

		return updated ?? null;
	}

	async updatePlanHoldPoolRemaining(
		poolId: string,
		userId: string,
		expectedCredits: number,
		remainingCredits: number,
		client: CreditsDbClient = this.db,
	): Promise<CreditPlanHoldPoolRow | null> {
		const [updated] = await client
			.update(creditPlanHoldPools)
			.set({ remainingCredits, updatedAt: new Date() })
			.where(
				and(
					eq(creditPlanHoldPools.id, poolId),
					eq(creditPlanHoldPools.userId, userId),
					eq(creditPlanHoldPools.remainingCredits, expectedCredits),
				),
			)
			.returning();

		return updated ?? null;
	}

	async markPlanHoldInactive(
		consumeIdempotencyKey: string,
		userId: string,
		client: CreditsDbClient = this.db,
	): Promise<CreditPlanHoldRow | null> {
		const [updated] = await client
			.update(creditPlanHolds)
			.set({ active: false, updatedAt: new Date() })
			.where(
				and(
					eq(creditPlanHolds.consumeIdempotencyKey, consumeIdempotencyKey),
					eq(creditPlanHolds.userId, userId),
				),
			)
			.returning();

		return updated ?? null;
	}

	async closePlanHold(
		consumeIdempotencyKey: string,
		userId: string,
		client: CreditsDbClient = this.db,
	): Promise<CreditPlanHoldRow | null> {
		const [updated] = await client
			.update(creditPlanHolds)
			.set({
				active: false,
				poolId: null,
				refundableCredits: 0,
				updatedAt: new Date(),
			})
			.where(
				and(
					eq(creditPlanHolds.consumeIdempotencyKey, consumeIdempotencyKey),
					eq(creditPlanHolds.userId, userId),
				),
			)
			.returning();

		return updated ?? null;
	}

	async applyPlanHoldBoundary(
		userId: string,
		poolId: string | null,
		client: CreditsDbClient = this.db,
	): Promise<void> {
		await client
			.update(creditPlanHolds)
			.set({ poolId: null, refundableCredits: 0, updatedAt: new Date() })
			.where(
				and(
					eq(creditPlanHolds.userId, userId),
					eq(creditPlanHolds.active, false),
					gt(creditPlanHolds.refundableCredits, 0),
				),
			);

		await client
			.update(creditPlanHolds)
			.set(
				poolId
					? { poolId, updatedAt: new Date() }
					: { poolId: null, refundableCredits: 0, updatedAt: new Date() },
			)
			.where(
				and(
					eq(creditPlanHolds.userId, userId),
					eq(creditPlanHolds.active, true),
					gt(creditPlanHolds.refundableCredits, 0),
				),
			);
	}

	async closePlanHoldPools(
		userId: string,
		poolIds: string[],
		client: CreditsDbClient = this.db,
	): Promise<void> {
		if (poolIds.length === 0) {
			return;
		}

		await client
			.update(creditPlanHoldPools)
			.set({
				closedAt: new Date(),
				remainingCredits: 0,
				updatedAt: new Date(),
			})
			.where(
				and(
					eq(creditPlanHoldPools.userId, userId),
					inArray(creditPlanHoldPools.id, poolIds),
				),
			);
	}

	async forfeitAllPlanHolds(
		userId: string,
		client: CreditsDbClient = this.db,
	): Promise<void> {
		const holds = await this.listRefundablePlanHolds(userId, client);
		const poolIds = [...new Set(holds.flatMap((hold) => hold.poolId ?? []))];

		await client
			.update(creditPlanHolds)
			.set({
				active: false,
				poolId: null,
				refundableCredits: 0,
				updatedAt: new Date(),
			})
			.where(
				and(
					eq(creditPlanHolds.userId, userId),
					gt(creditPlanHolds.refundableCredits, 0),
				),
			);

		await this.closePlanHoldPools(userId, poolIds, client);
	}

	private async sumBalances(
		userId: string,
		client: CreditsDbClient,
	): Promise<CreditBalance> {
		const rows = await client
			.select({
				bucket: creditLedger.bucket,
				total: sql<number>`coalesce(sum(${creditLedger.delta}), 0)::int`,
			})
			.from(creditLedger)
			.where(eq(creditLedger.userId, userId))
			.groupBy(creditLedger.bucket);

		const balance: CreditBalance = {
			balance: 0,
			plan: 0,
			promo: 0,
			topup: 0,
		};

		for (const row of rows) {
			balance[row.bucket] = Number(row.total);
		}

		balance.balance = CREDIT_SPEND_ORDER.reduce(
			(sum, bucket) => sum + balance[bucket],
			0,
		);

		return balance;
	}

	private async acquireUserLock(
		userId: string,
		transaction: CreditsTransaction,
	): Promise<void> {
		await transaction.execute(
			sql`select pg_advisory_xact_lock(hashtext(${userId}))`,
		);
	}

	private expectInsertedRow(row: CreditLedgerRow | undefined | null) {
		if (!row) {
			throw new Error("Credit ledger write did not return a row");
		}

		return row;
	}
}
