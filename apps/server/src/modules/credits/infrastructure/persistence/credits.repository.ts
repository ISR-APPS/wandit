import { Inject, Injectable } from "@nestjs/common";
import {
	CREDIT_SPEND_ORDER,
	type CreditBucket,
	type CreditKind,
	type PaginationQuery,
} from "@wandit/contracts";
import { and, asc, desc, eq, gt, inArray, isNull, sql } from "@wandit/db";
import {
	aiUsageEvents,
	type aiUsageOperation,
	type aiUsageStatus,
	creditLedger,
	creditPlanHoldPools,
	creditPlanHolds,
} from "@wandit/db/schema/credits";

import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";
import {
	type CreditOwner,
	creditOwnerLockValue,
	ownerColumns,
} from "../../domain/credit-owner";

export type CreditLedgerRow = typeof creditLedger.$inferSelect;
export type CreditPlanHoldRow = typeof creditPlanHolds.$inferSelect;
export type CreditPlanHoldPoolRow = typeof creditPlanHoldPools.$inferSelect;

/** UNIT: integer centi-credits (1 = 0.01 credit) — never whole credits. */
export type CreditBalance = {
	balance: number;
	plan: number;
	promo: number;
	topup: number;
};

/** UNIT: integer centi-credits. settledBalance = settledPlan+settledPromo+settledTopup. */
export type SettledBalanceSnapshot = CreditBalance & {
	settledBalance: number;
	settledPlan: number;
	settledPromo: number;
	settledTopup: number;
};

/** One activity feed row, still in integer centi-credits and raw DB enums. */
export type CreditActivityRow =
	| {
			createdAt: Date;
			finalCredits: number | null;
			finalizedAt: Date | null;
			id: string;
			operation: AiUsageOperationValue;
			reservedCredits: number;
			source: "usage";
			status: AiUsageStatusValue;
	  }
	| {
			bucket: CreditBucket;
			createdAt: Date;
			delta: number;
			id: string;
			ledgerKind: CreditKind;
			reason: string | null;
			source: "ledger";
	  };

type AiUsageOperationValue = (typeof aiUsageOperation.enumValues)[number];
type AiUsageStatusValue = (typeof aiUsageStatus.enumValues)[number];

type RawActivityRow = {
	bucket: string | null;
	created_at: string;
	delta: number | null;
	final_credits: number | null;
	finalized_at: string | null;
	id: string;
	ledger_kind: string | null;
	operation: string | null;
	reason: string | null;
	reserved_credits: number | null;
	source: "ledger" | "usage";
	status: string | null;
};

function toCreditActivityRow(raw: RawActivityRow): CreditActivityRow {
	if (raw.source === "usage") {
		return {
			createdAt: new Date(raw.created_at),
			finalCredits: raw.final_credits,
			finalizedAt: raw.finalized_at ? new Date(raw.finalized_at) : null,
			id: raw.id,
			operation: raw.operation as AiUsageOperationValue,
			reservedCredits: Number(raw.reserved_credits ?? 0),
			source: "usage",
			status: raw.status as AiUsageStatusValue,
		};
	}

	return {
		bucket: raw.bucket as CreditBucket,
		createdAt: new Date(raw.created_at),
		delta: Number(raw.delta ?? 0),
		id: raw.id,
		ledgerKind: raw.ledger_kind as CreditKind,
		reason: raw.reason,
		source: "ledger",
	};
}

export type InsertCreditLedgerEntry = {
	bucket: CreditBucket;
	/** UNIT: integer centi-credits (signed). */
	delta: number;
	idempotencyKey?: string;
	kind: CreditKind;
	meta: Record<string, unknown>;
	organizationId?: string | null;
	userId: string | null;
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

	/**
	 * Serializes every balance mutation for one pool owner.
	 * Lock-value rules live in creditOwnerLockValue — personal keys stay the
	 * raw user id for byte-compatibility with the four sibling repositories.
	 */
	async withOwnerLock<T>(
		owner: CreditOwner,
		fn: (tx: CreditsTransaction) => Promise<T>,
		transaction?: CreditsTransaction,
	): Promise<T> {
		return this.withLockValue(creditOwnerLockValue(owner), fn, transaction);
	}

	/**
	 * Raw advisory-lock variant for non-owner serialization points (the global
	 * consume/refund operation locks keyed by idempotency key). Shares the
	 * hashtext namespace with owner locks on purpose — key shapes are disjoint.
	 */
	async withLockValue<T>(
		lockValue: string,
		fn: (tx: CreditsTransaction) => Promise<T>,
		transaction?: CreditsTransaction,
	): Promise<T> {
		if (transaction) {
			await this.acquireLock(lockValue, transaction);

			return fn(transaction);
		}

		return this.db.transaction(async (tx) => {
			await this.acquireLock(lockValue, tx);

			return fn(tx);
		});
	}

	getBalance(owner: CreditOwner, client: CreditsDbClient = this.db) {
		return this.sumBalances(owner, client);
	}

	/**
	 * Net lifetime personal consumption in integer centi-credits.
	 *
	 * Reservations are consume rows. Settlement/reconciliation/failure refunds
	 * reverse those rows with narrowly keyed grants, so subtracting the matching
	 * refunds keeps failed or over-reserved work from counting as credits used.
	 * Organization rows are deliberately excluded even when user_id records the
	 * acting member.
	 */
	async netConsumedCentiCredits(
		userId: string,
		client: CreditsDbClient = this.db,
	): Promise<number> {
		const result = await client.execute(sql`
			select coalesce(-sum(${creditLedger.delta}), 0)::int as total
			from ${creditLedger}
			where ${creditLedger.userId} = ${userId}
				and ${creditLedger.organizationId} is null
				and (
					${creditLedger.kind} = 'consume'
					or (
						${creditLedger.kind} = 'grant'
						and (
							${creditLedger.idempotencyKey} like 'settle-refund:%'
							or ${creditLedger.idempotencyKey} like 'reconcile-refund:%'
							or ${creditLedger.idempotencyKey} like 'refund:%'
						)
					)
				)
		`);
		const row = result.rows[0] as { total?: unknown } | undefined;

		return Number(row?.total ?? 0);
	}

	/**
	 * Reserved add-back for the settled balance. While an ai_usage_events row
	 * is in flight, its ledger dip equals exactly reserved_credits (every
	 * ledger adjustment commits atomically with a status transition), so
	 * settled = balance + this sum. UNIT: integer centi-credits.
	 */
	async sumReservedCentiCredits(
		owner: CreditOwner,
		client: CreditsDbClient = this.db,
	): Promise<number> {
		const [row] = await this.buildSumReservedQuery(owner, client);

		return Number(row?.total ?? 0);
	}

	/**
	 * Balance plus the per-bucket reserve holds as ONE SQL statement, so every
	 * sum comes from the same snapshot under READ COMMITTED. Two separate reads
	 * let a settle commit between them and double- or zero-count the hold.
	 *
	 * The hold per bucket comes from the reserve consume rows (idempotency key
	 * `reserve:<eventId>:<bucket>`, one row per bucket the spend order touched)
	 * of the owner's in-flight events. settledBalance is the sum of the three
	 * settled buckets. UNIT: integer centi-credits.
	 */
	async getSettledBalanceSnapshot(
		owner: CreditOwner,
		client: CreditsDbClient = this.db,
	): Promise<SettledBalanceSnapshot> {
		const result = await client.execute(sql`
			with ledger as (
				select ${creditLedger.bucket} as bucket,
					coalesce(sum(${creditLedger.delta}), 0)::int as total
				from ${creditLedger}
				where ${this.ledgerOwnerPredicate(owner)}
				group by ${creditLedger.bucket}
			),
			inflight as (
				select ${aiUsageEvents.id} as id
				from ${aiUsageEvents}
				where ${this.inflightUsageEventPredicate()}
					and ${this.usageEventOwnerPredicate(owner)}
			),
			holds as (
				select ${creditLedger.bucket} as bucket,
					coalesce(sum(-${creditLedger.delta}), 0)::int as total
				from inflight
				join ${creditLedger}
					on ${creditLedger.idempotencyKey} = any(array[
						'reserve:' || inflight.id::text || ':plan',
						'reserve:' || inflight.id::text || ':promo',
						'reserve:' || inflight.id::text || ':topup'
					])
				where ${creditLedger.kind} = 'consume'
				group by ${creditLedger.bucket}
			)
			select
				coalesce((select total from ledger where bucket = 'plan'), 0) as plan,
				coalesce((select total from ledger where bucket = 'promo'), 0) as promo,
				coalesce((select total from ledger where bucket = 'topup'), 0) as topup,
				coalesce((select total from holds where bucket = 'plan'), 0) as hold_plan,
				coalesce((select total from holds where bucket = 'promo'), 0) as hold_promo,
				coalesce((select total from holds where bucket = 'topup'), 0) as hold_topup
		`);
		const row = result.rows[0] as
			| {
					hold_plan: unknown;
					hold_promo: unknown;
					hold_topup: unknown;
					plan: unknown;
					promo: unknown;
					topup: unknown;
			  }
			| undefined;
		const plan = Number(row?.plan ?? 0);
		const promo = Number(row?.promo ?? 0);
		const topup = Number(row?.topup ?? 0);
		const settledPlan = plan + Number(row?.hold_plan ?? 0);
		const settledPromo = promo + Number(row?.hold_promo ?? 0);
		const settledTopup = topup + Number(row?.hold_topup ?? 0);

		return {
			balance: plan + promo + topup,
			plan,
			promo,
			settledBalance: settledPlan + settledPromo + settledTopup,
			settledPlan,
			settledPromo,
			settledTopup,
			topup,
		};
	}

	/**
	 * Activity feed as ONE statement: every usage event (each event, child or
	 * not, owns its own ledger debit; gateway helper refs have no event row)
	 * UNION ALL ledger rows that belong to no usage event (grants, topups,
	 * expire, revoke). Refunded events that left no charge are dropped here.
	 * An in-flight event (reserved, or reconcile_failed straight from reserved)
	 * has no finalized_at. The count and the page come from the same snapshot.
	 */
	async listActivityByOwner(
		owner: CreditOwner,
		pagination: PaginationQuery,
		client: CreditsDbClient = this.db,
	): Promise<{
		items: CreditActivityRow[];
		page: number;
		pageSize: number;
		total: number;
	}> {
		const offset = (pagination.page - 1) * pagination.pageSize;
		const result = await client.execute(sql`
			with usage_rows as (
				select ${aiUsageEvents.id} as id,
					'usage' as source,
					${aiUsageEvents.operation}::text as operation,
					${aiUsageEvents.status}::text as status,
					${aiUsageEvents.reservedCredits} as reserved_credits,
					${aiUsageEvents.finalCredits} as final_credits,
					null::text as ledger_kind,
					null::text as bucket,
					null::text as reason,
					null::int as delta,
					${aiUsageEvents.createdAt} as created_at,
					case when ${this.inflightUsageEventPredicate()} then null
						else coalesce(${aiUsageEvents.reconciledAt}, ${aiUsageEvents.settledAt})
					end as finalized_at
				from ${aiUsageEvents}
				where ${this.usageEventOwnerPredicate(owner)}
					and not (
						${aiUsageEvents.status} = 'refunded'
						and coalesce(${aiUsageEvents.finalCredits}, 0) = 0
					)
			),
			ledger_rows as (
				select ${creditLedger.id} as id,
					'ledger' as source,
					null::text as operation,
					null::text as status,
					null::int as reserved_credits,
					null::int as final_credits,
					${creditLedger.kind}::text as ledger_kind,
					${creditLedger.bucket}::text as bucket,
					${creditLedger.meta} ->> 'reason' as reason,
					${creditLedger.delta} as delta,
					${creditLedger.createdAt} as created_at,
					null::timestamptz as finalized_at
				from ${creditLedger}
				where ${this.ledgerOwnerPredicate(owner)}
					and ${creditLedger.meta} ->> 'usageEventId' is null
			),
			combined as (
				select * from usage_rows
				union all
				select * from ledger_rows
			),
			page as (
				select * from combined
				order by created_at desc, id desc
				limit ${pagination.pageSize} offset ${offset}
			)
			select
				(select count(*)::int from combined) as total,
				coalesce((select json_agg(page) from page), '[]'::json) as items
		`);
		const row = result.rows[0] as
			| { items: unknown; total: unknown }
			| undefined;
		const rawItems = row?.items;
		const items = (
			typeof rawItems === "string" ? JSON.parse(rawItems) : (rawItems ?? [])
		) as RawActivityRow[];

		return {
			items: items.map(toCreditActivityRow),
			page: pagination.page,
			pageSize: pagination.pageSize,
			total: Number(row?.total ?? 0),
		};
	}

	async listByOwner(owner: CreditOwner, pagination: PaginationQuery) {
		const where = this.ledgerOwnerPredicate(owner);
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
		owner: CreditOwner,
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
					this.ledgerOwnerPredicate(owner),
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
			owner: CreditOwner;
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
				...ownerColumns(input.owner),
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
		owner: CreditOwner,
		client: CreditsDbClient = this.db,
	): Promise<CreditPlanHoldRow[]> {
		return client
			.select()
			.from(creditPlanHolds)
			.where(
				and(
					this.holdOwnerPredicate(owner),
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
			owner: CreditOwner;
		},
		client: CreditsDbClient = this.db,
	): Promise<CreditPlanHoldPoolRow> {
		const [inserted] = await client
			.insert(creditPlanHoldPools)
			.values({
				boundaryIdempotencyKey: input.boundaryIdempotencyKey,
				remainingCredits: input.remainingCredits,
				...ownerColumns(input.owner),
			})
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
		owner: CreditOwner,
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
					this.holdOwnerPredicate(owner),
					eq(creditPlanHolds.refundableCredits, expectedCredits),
				),
			)
			.returning();

		return updated ?? null;
	}

	async updatePlanHoldPoolRemaining(
		poolId: string,
		owner: CreditOwner,
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
					this.poolOwnerPredicate(owner),
					eq(creditPlanHoldPools.remainingCredits, expectedCredits),
				),
			)
			.returning();

		return updated ?? null;
	}

	async markPlanHoldInactive(
		consumeIdempotencyKey: string,
		owner: CreditOwner,
		client: CreditsDbClient = this.db,
	): Promise<CreditPlanHoldRow | null> {
		const [updated] = await client
			.update(creditPlanHolds)
			.set({ active: false, updatedAt: new Date() })
			.where(
				and(
					eq(creditPlanHolds.consumeIdempotencyKey, consumeIdempotencyKey),
					this.holdOwnerPredicate(owner),
				),
			)
			.returning();

		return updated ?? null;
	}

	async closePlanHold(
		consumeIdempotencyKey: string,
		owner: CreditOwner,
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
					this.holdOwnerPredicate(owner),
				),
			)
			.returning();

		return updated ?? null;
	}

	async applyPlanHoldBoundary(
		owner: CreditOwner,
		poolId: string | null,
		client: CreditsDbClient = this.db,
	): Promise<void> {
		await client
			.update(creditPlanHolds)
			.set({ poolId: null, refundableCredits: 0, updatedAt: new Date() })
			.where(
				and(
					this.holdOwnerPredicate(owner),
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
					this.holdOwnerPredicate(owner),
					eq(creditPlanHolds.active, true),
					gt(creditPlanHolds.refundableCredits, 0),
				),
			);
	}

	async closePlanHoldPools(
		owner: CreditOwner,
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
					this.poolOwnerPredicate(owner),
					inArray(creditPlanHoldPools.id, poolIds),
				),
			);
	}

	async forfeitAllPlanHolds(
		owner: CreditOwner,
		client: CreditsDbClient = this.db,
	): Promise<void> {
		const holds = await this.listRefundablePlanHolds(owner, client);
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
					this.holdOwnerPredicate(owner),
					gt(creditPlanHolds.refundableCredits, 0),
				),
			);

		await this.closePlanHoldPools(owner, poolIds, client);
	}

	// Personal predicates require organization_id IS NULL so an org row whose
	// userId records the acting member can never leak into a personal balance.
	private ledgerOwnerPredicate(owner: CreditOwner) {
		return owner.type === "user"
			? and(
					eq(creditLedger.userId, owner.userId),
					isNull(creditLedger.organizationId),
				)
			: eq(creditLedger.organizationId, owner.organizationId);
	}

	private holdOwnerPredicate(owner: CreditOwner) {
		return owner.type === "user"
			? and(
					eq(creditPlanHolds.userId, owner.userId),
					isNull(creditPlanHolds.organizationId),
				)
			: eq(creditPlanHolds.organizationId, owner.organizationId);
	}

	// Mirrors ledgerOwnerPredicate: a personal pool requires organization_id
	// IS NULL because org usage events record the acting member in user_id, and
	// those reserves must never inflate the member's personal settled balance.
	private usageEventOwnerPredicate(owner: CreditOwner) {
		return owner.type === "user"
			? and(
					eq(aiUsageEvents.userId, owner.userId),
					isNull(aiUsageEvents.organizationId),
				)
			: eq(aiUsageEvents.organizationId, owner.organizationId);
	}

	// An event whose reserve debit is still the only ledger movement. A
	// reconcile_failed row with no final_credits came straight from reserved
	// (terminalizeReconciliationFailure writes no refund), so its hold is still
	// open until a later reconcile adjusts from reserved_credits.
	private inflightUsageEventPredicate() {
		return sql`(${aiUsageEvents.status} = 'reserved' or (${aiUsageEvents.status} = 'reconcile_failed' and ${aiUsageEvents.finalCredits} is null))`;
	}

	// Kept as a builder so specs can assert the compiled SQL. The partial index
	// ai_usage_events_reserved_status_idx serves the common status filter.
	private buildSumReservedQuery(
		owner: CreditOwner,
		client: CreditsDbClient = this.db,
	) {
		return client
			.select({
				total: sql<number>`coalesce(sum(${aiUsageEvents.reservedCredits}), 0)::int`,
			})
			.from(aiUsageEvents)
			.where(
				and(
					this.inflightUsageEventPredicate(),
					this.usageEventOwnerPredicate(owner),
				),
			);
	}

	private poolOwnerPredicate(owner: CreditOwner) {
		return owner.type === "user"
			? and(
					eq(creditPlanHoldPools.userId, owner.userId),
					isNull(creditPlanHoldPools.organizationId),
				)
			: eq(creditPlanHoldPools.organizationId, owner.organizationId);
	}

	private async sumBalances(
		owner: CreditOwner,
		client: CreditsDbClient,
	): Promise<CreditBalance> {
		const rows = await client
			.select({
				bucket: creditLedger.bucket,
				total: sql<number>`coalesce(sum(${creditLedger.delta}), 0)::int`,
			})
			.from(creditLedger)
			.where(this.ledgerOwnerPredicate(owner))
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

	private async acquireLock(
		lockValue: string,
		transaction: CreditsTransaction,
	): Promise<void> {
		await transaction.execute(
			sql`select pg_advisory_xact_lock(hashtext(${lockValue}))`,
		);
	}

	private expectInsertedRow(row: CreditLedgerRow | undefined | null) {
		if (!row) {
			throw new Error("Credit ledger write did not return a row");
		}

		return row;
	}
}
