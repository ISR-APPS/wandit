import { Inject, Injectable } from "@nestjs/common";
import type {
	CreditBucket,
	CreditKind,
	PaginationQuery,
} from "@wandit/contracts";
import { and, desc, eq, inArray, sql } from "@wandit/db";
import { creditLedger } from "@wandit/db/schema/credits";

import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";

export type CreditLedgerRow = typeof creditLedger.$inferSelect;

export type CreditBalance = {
	balance: number;
	plan: number;
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

type CreditsDbClient = Pick<Database, "execute" | "insert" | "select">;

@Injectable()
export class CreditsRepository {
	constructor(@Inject(DATABASE) private readonly db: Database) {}

	async withUserLock<T>(
		userId: string,
		fn: (tx: CreditsTransaction) => Promise<T>,
	): Promise<T> {
		return this.db.transaction(async (tx) => {
			await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${userId}))`);

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
			topup: 0,
		};

		for (const row of rows) {
			balance[row.bucket] = Number(row.total);
		}

		balance.balance = balance.plan + balance.topup;

		return balance;
	}

	private expectInsertedRow(row: CreditLedgerRow | undefined | null) {
		if (!row) {
			throw new Error("Credit ledger write did not return a row");
		}

		return row;
	}
}
