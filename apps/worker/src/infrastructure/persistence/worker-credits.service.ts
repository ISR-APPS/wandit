// Worker-side credit spending.
//
// The API checks if the user can start generation. The worker spends credits
// only after it saved the final assistant message. This avoids charging for a
// failed generation that never produced a saved answer.
//
// The job id is used in idempotency keys, so retrying the same job does not
// charge twice.
import { Inject, Injectable } from "@nestjs/common";
import { CREDIT_COSTS } from "@wandit/contracts";
import { and, eq, inArray, sql } from "@wandit/db";
import { creditLedger } from "@wandit/db/schema/credits";
import { env } from "@wandit/env/server";
import type { AiGenerationJobData } from "@wandit/jobs";

import {
	WORKER_DATABASE,
	type WorkerDatabase,
} from "../database/database.constants";

// Type of one credit ledger row.
type CreditLedgerRow = typeof creditLedger.$inferSelect;
// Type of the transaction object Drizzle gives us inside db.transaction().
type WorkerTransaction = Parameters<
	Parameters<WorkerDatabase["transaction"]>[0]
>[0];

// Error used when the balance is too low at charge time.
export class InsufficientCreditsError extends Error {
	constructor(
		readonly required: number,
		readonly available: number,
	) {
		super(
			`Insufficient credits for completed generation: required ${required}, available ${available}`,
		);
		this.name = "InsufficientCreditsError";
	}
}

// `@Injectable()` lets the processor inject this service.
@Injectable()
export class WorkerCreditsService {
	constructor(
		// Ask Nest for the worker database connection.
		@Inject(WORKER_DATABASE)
		private readonly db: WorkerDatabase,
	) {}

	// Spend credits for a finished generation. Safe to call again for same job id.
	async consumeForGeneration(
		userId: string,
		action: AiGenerationJobData["action"],
		jobId: string,
	): Promise<void> {
		// Local/dev mode can disable billing side effects.
		if (env.GENERATION_BILLING_MODE === "off") {
			return;
		}

		const amount = CREDIT_COSTS[action];
		const baseIdempotencyKey = `consume:${jobId}`;

		// Transaction keeps balance check and ledger writes together.
		// Advisory lock makes one user's credit writes run one at a time.
		await this.db.transaction(async (tx) => {
			await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${userId}))`);

			// If this job already charged credits, do nothing.
			const existingRows = await this.findExistingConsumeRows(
				userId,
				baseIdempotencyKey,
				tx,
			);

			if (existingRows.length > 0) {
				return;
			}

			// Balance is calculated from ledger rows.
			const balance = await this.getBalance(userId, tx);

			if (balance.balance < amount) {
				throw new InsufficientCreditsError(amount, balance.balance);
			}

			const planAmount = Math.min(Math.max(balance.plan, 0), amount);
			const topupAmount = amount - planAmount;

			// Spend plan credits first, then top-up credits.
			if (planAmount > 0) {
				await this.insertLedgerEntry(
					{
						bucket: "plan",
						delta: -planAmount,
						idempotencyKey: `${baseIdempotencyKey}:plan`,
						kind: "consume",
						meta: { action, jobId, reason: "generation_complete" },
						userId,
					},
					tx,
				);
			}

			if (topupAmount > 0) {
				await this.insertLedgerEntry(
					{
						bucket: "topup",
						delta: -topupAmount,
						idempotencyKey: `${baseIdempotencyKey}:topup`,
						kind: "consume",
						meta: { action, jobId, reason: "generation_complete" },
						userId,
					},
					tx,
				);
			}
		});
	}

	// Calculate balance from all ledger deltas.
	private async getBalance(userId: string, tx: WorkerTransaction) {
		const rows = await tx
			.select({
				bucket: creditLedger.bucket,
				total: sql<number>`coalesce(sum(${creditLedger.delta}), 0)::int`,
			})
			.from(creditLedger)
			.where(eq(creditLedger.userId, userId))
			.groupBy(creditLedger.bucket);

		const balance = {
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

	// Check if this job already wrote consume rows.
	private findExistingConsumeRows(
		userId: string,
		baseIdempotencyKey: string,
		tx: WorkerTransaction,
	): Promise<CreditLedgerRow[]> {
		return tx
			.select()
			.from(creditLedger)
			.where(
				and(
					eq(creditLedger.userId, userId),
					inArray(creditLedger.idempotencyKey, [
						`${baseIdempotencyKey}:plan`,
						`${baseIdempotencyKey}:topup`,
					]),
				),
			);
	}

	// Add one negative ledger row.
	private async insertLedgerEntry(
		input: {
			bucket: "plan" | "topup";
			delta: number;
			idempotencyKey: string;
			kind: "consume";
			meta: Record<string, unknown>;
			userId: string;
		},
		tx: WorkerTransaction,
	): Promise<void> {
		await tx
			.insert(creditLedger)
			.values({
				bucket: input.bucket,
				delta: input.delta,
				idempotencyKey: input.idempotencyKey,
				kind: input.kind,
				meta: input.meta,
				userId: input.userId,
			})
			.onConflictDoNothing({
				target: creditLedger.idempotencyKey,
				where: sql`${creditLedger.idempotencyKey} IS NOT NULL`,
			});
	}
}
