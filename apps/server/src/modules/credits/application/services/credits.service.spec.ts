import { describe, expect, it } from "vitest";

import {
	type CreditOwner,
	ownerColumns,
	userOwner,
} from "../../domain/credit-owner";
import { InsufficientCreditsError } from "../../domain/errors/insufficient-credits.error";
import type {
	CreditLedgerRow,
	CreditPlanHoldPoolRow,
	CreditPlanHoldRow,
	CreditsRepository,
	CreditsTransaction,
	InsertCreditLedgerEntry,
} from "../../infrastructure/persistence/credits.repository";
import { CreditsService } from "./credits.service";

type SeedLedgerEntry = Pick<
	InsertCreditLedgerEntry,
	"bucket" | "delta" | "kind" | "userId"
> &
	Partial<
		Pick<InsertCreditLedgerEntry, "idempotencyKey" | "meta" | "organizationId">
	>;

class InMemoryCreditsRepository {
	readonly planHoldPools = new Map<string, CreditPlanHoldPoolRow>();
	readonly planHolds = new Map<string, CreditPlanHoldRow>();
	readonly rows: CreditLedgerRow[] = [];
	readonly transactionInputs: Array<CreditsTransaction | undefined> = [];
	readonly writeClients: unknown[] = [];
	private lock: Promise<void> = Promise.resolve();
	private nextId = 1;
	private nextPoolId = 1;
	private readonly tx = {} as CreditsTransaction;

	async withOwnerLock<T>(
		_owner: CreditOwner,
		fn: (tx: CreditsTransaction) => Promise<T>,
		transaction?: CreditsTransaction,
	): Promise<T> {
		this.transactionInputs.push(transaction);

		if (transaction) {
			return fn(transaction);
		}

		return this.runLocked(fn);
	}

	async withLockValue<T>(
		_lockValue: string,
		fn: (tx: CreditsTransaction) => Promise<T>,
		transaction?: CreditsTransaction,
	): Promise<T> {
		if (transaction) {
			return fn(transaction);
		}

		return this.runLocked(fn);
	}

	async getBalance(owner: CreditOwner, _client?: unknown) {
		const balance = {
			balance: 0,
			plan: 0,
			promo: 0,
			topup: 0,
		};

		for (const row of this.rows) {
			if (!this.ownerMatches(row, owner)) {
				continue;
			}

			balance[row.bucket] += row.delta;
		}

		balance.balance = balance.plan + balance.promo + balance.topup;

		return balance;
	}

	async insertLedgerEntry(
		input: InsertCreditLedgerEntry,
		client?: unknown,
	): Promise<CreditLedgerRow> {
		this.writeClients.push(client);

		if (input.idempotencyKey) {
			const existing = this.rows.find(
				(row) => row.idempotencyKey === input.idempotencyKey,
			);

			if (existing) {
				return existing;
			}
		}

		const row = this.makeRow(input);
		this.rows.push(row);

		return row;
	}

	async findByIdempotencyKeys(
		owner: CreditOwner,
		idempotencyKeys: string[],
		_client?: unknown,
	): Promise<CreditLedgerRow[]> {
		return this.rows.filter(
			(row) =>
				this.ownerMatches(row, owner) &&
				row.idempotencyKey !== null &&
				idempotencyKeys.includes(row.idempotencyKey),
		);
	}

	async findByIdempotencyKey(
		idempotencyKey: string,
		_client?: unknown,
	): Promise<CreditLedgerRow | null> {
		return (
			this.rows.find((row) => row.idempotencyKey === idempotencyKey) ?? null
		);
	}

	async findPlanHold(
		consumeIdempotencyKey: string,
		_client?: unknown,
	): Promise<CreditPlanHoldRow | null> {
		return this.planHolds.get(consumeIdempotencyKey) ?? null;
	}

	async insertPlanHold(input: {
		active: boolean;
		consumeIdempotencyKey: string;
		consumeLedgerId: string;
		originalCredits: number;
		owner: CreditOwner;
	}): Promise<CreditPlanHoldRow> {
		const existing = this.planHolds.get(input.consumeIdempotencyKey);

		if (existing) {
			return existing;
		}

		const now = new Date(this.nextId * 1000);
		const row = {
			active: input.active,
			consumeIdempotencyKey: input.consumeIdempotencyKey,
			consumeLedgerId: input.consumeLedgerId,
			createdAt: now,
			originalCredits: input.originalCredits,
			poolId: null,
			refundableCredits: input.originalCredits,
			updatedAt: now,
			...ownerColumns(input.owner),
		} satisfies CreditPlanHoldRow;

		this.planHolds.set(input.consumeIdempotencyKey, row);
		return row;
	}

	async listRefundablePlanHolds(
		owner: CreditOwner,
		_client?: unknown,
	): Promise<CreditPlanHoldRow[]> {
		return [...this.planHolds.values()]
			.filter(
				(hold) => this.ownerMatches(hold, owner) && hold.refundableCredits > 0,
			)
			.sort(
				(left, right) =>
					left.createdAt.getTime() - right.createdAt.getTime() ||
					left.consumeIdempotencyKey.localeCompare(right.consumeIdempotencyKey),
			);
	}

	async findPlanHoldPools(
		poolIds: string[],
		_client?: unknown,
	): Promise<CreditPlanHoldPoolRow[]> {
		return poolIds.flatMap((poolId) => {
			const pool = this.planHoldPools.get(poolId);
			return pool ? [pool] : [];
		});
	}

	async insertPlanHoldPool(input: {
		boundaryIdempotencyKey: string;
		remainingCredits: number;
		owner: CreditOwner;
	}): Promise<CreditPlanHoldPoolRow> {
		const existing = [...this.planHoldPools.values()].find(
			(pool) => pool.boundaryIdempotencyKey === input.boundaryIdempotencyKey,
		);

		if (existing) {
			return existing;
		}

		const now = new Date(this.nextId * 1000);
		const pool = {
			boundaryIdempotencyKey: input.boundaryIdempotencyKey,
			closedAt: null,
			createdAt: now,
			id: `hold_pool_${this.nextPoolId}`,
			remainingCredits: input.remainingCredits,
			updatedAt: now,
			...ownerColumns(input.owner),
		} satisfies CreditPlanHoldPoolRow;

		this.nextPoolId += 1;
		this.planHoldPools.set(pool.id, pool);
		return pool;
	}

	async updatePlanHoldRefundable(
		consumeIdempotencyKey: string,
		owner: CreditOwner,
		expectedCredits: number,
		refundableCredits: number,
	): Promise<CreditPlanHoldRow | null> {
		const hold = this.planHolds.get(consumeIdempotencyKey);

		if (
			!hold ||
			!this.ownerMatches(hold, owner) ||
			hold.refundableCredits !== expectedCredits
		) {
			return null;
		}

		const updated = { ...hold, refundableCredits, updatedAt: new Date() };
		this.planHolds.set(consumeIdempotencyKey, updated);
		return updated;
	}

	async updatePlanHoldPoolRemaining(
		poolId: string,
		owner: CreditOwner,
		expectedCredits: number,
		remainingCredits: number,
	): Promise<CreditPlanHoldPoolRow | null> {
		const pool = this.planHoldPools.get(poolId);

		if (
			!pool ||
			!this.ownerMatches(pool, owner) ||
			pool.remainingCredits !== expectedCredits
		) {
			return null;
		}

		const updated = { ...pool, remainingCredits, updatedAt: new Date() };
		this.planHoldPools.set(poolId, updated);
		return updated;
	}

	async markPlanHoldInactive(
		consumeIdempotencyKey: string,
		owner: CreditOwner,
	): Promise<CreditPlanHoldRow | null> {
		const hold = this.planHolds.get(consumeIdempotencyKey);

		if (!hold || !this.ownerMatches(hold, owner)) {
			return null;
		}

		const updated = { ...hold, active: false, updatedAt: new Date() };
		this.planHolds.set(consumeIdempotencyKey, updated);
		return updated;
	}

	async closePlanHold(
		consumeIdempotencyKey: string,
		owner: CreditOwner,
	): Promise<CreditPlanHoldRow | null> {
		const hold = this.planHolds.get(consumeIdempotencyKey);

		if (!hold || !this.ownerMatches(hold, owner)) {
			return null;
		}

		const updated = {
			...hold,
			active: false,
			poolId: null,
			refundableCredits: 0,
			updatedAt: new Date(),
		};
		this.planHolds.set(consumeIdempotencyKey, updated);
		return updated;
	}

	async applyPlanHoldBoundary(
		owner: CreditOwner,
		poolId: string | null,
	): Promise<void> {
		for (const [key, hold] of this.planHolds) {
			if (!this.ownerMatches(hold, owner) || hold.refundableCredits === 0) {
				continue;
			}

			this.planHolds.set(
				key,
				hold.active && poolId
					? { ...hold, poolId, updatedAt: new Date() }
					: {
							...hold,
							poolId: null,
							refundableCredits: 0,
							updatedAt: new Date(),
						},
			);
		}
	}

	async closePlanHoldPools(owner: CreditOwner, poolIds: string[]): Promise<void> {
		for (const poolId of poolIds) {
			const pool = this.planHoldPools.get(poolId);

			if (pool && this.ownerMatches(pool, owner)) {
				this.planHoldPools.set(poolId, {
					...pool,
					closedAt: new Date(),
					remainingCredits: 0,
					updatedAt: new Date(),
				});
			}
		}
	}

	async forfeitAllPlanHolds(owner: CreditOwner): Promise<void> {
		const poolIds = new Set<string>();

		for (const [key, hold] of this.planHolds) {
			if (!this.ownerMatches(hold, owner) || hold.refundableCredits === 0) {
				continue;
			}

			if (hold.poolId) {
				poolIds.add(hold.poolId);
			}

			this.planHolds.set(key, {
				...hold,
				active: false,
				poolId: null,
				refundableCredits: 0,
				updatedAt: new Date(),
			});
		}

		await this.closePlanHoldPools(owner, [...poolIds]);
	}

	seed(input: SeedLedgerEntry) {
		const row = this.makeRow({
			...input,
			meta: input.meta ?? { reason: "seed" },
		});
		this.rows.push(row);

		return row;
	}

	private async runLocked<T>(
		fn: (tx: CreditsTransaction) => Promise<T>,
	): Promise<T> {
		const previousLock = this.lock;
		let releaseLock!: () => void;

		this.lock = new Promise((resolve) => {
			releaseLock = resolve;
		});

		await previousLock;

		try {
			return await fn(this.tx);
		} finally {
			releaseLock();
		}
	}

	private ownerMatches(
		row: { organizationId: string | null; userId: string | null },
		owner: CreditOwner,
	): boolean {
		return owner.type === "user"
			? row.userId === owner.userId && row.organizationId === null
			: row.organizationId === owner.organizationId;
	}

	private makeRow(input: InsertCreditLedgerEntry): CreditLedgerRow {
		const row = {
			bucket: input.bucket,
			createdAt: new Date(this.nextId * 1000),
			delta: input.delta,
			id: `ledger_${this.nextId}`,
			idempotencyKey: input.idempotencyKey ?? null,
			kind: input.kind,
			meta: input.meta,
			organizationId: input.organizationId ?? null,
			userId: input.userId,
		} satisfies CreditLedgerRow;

		this.nextId += 1;

		return row;
	}
}

function setup() {
	const repository = new InMemoryCreditsRepository();
	const service = new CreditsService(
		repository as unknown as CreditsRepository,
	);

	return { repository, service };
}

describe("CreditsService", () => {
	it("consumes plan, promo, then top-up credits across bucket boundaries", async () => {
		const { repository, service } = setup();

		repository.seed({
			bucket: "plan",
			delta: 2,
			kind: "grant",
			userId: "user_1",
		});
		repository.seed({
			bucket: "promo",
			delta: 3,
			kind: "grant",
			userId: "user_1",
		});
		repository.seed({
			bucket: "topup",
			delta: 10,
			kind: "topup",
			userId: "user_1",
		});

		const rows = await service.consume(userOwner("user_1"), 7, {
			idempotencyKey: "consume:job_1",
		});

		expect(rows).toMatchObject([
			{
				bucket: "plan",
				delta: -2,
				idempotencyKey: "consume:job_1:plan",
				kind: "consume",
			},
			{
				bucket: "promo",
				delta: -3,
				idempotencyKey: "consume:job_1:promo",
				kind: "consume",
			},
			{
				bucket: "topup",
				delta: -2,
				idempotencyKey: "consume:job_1:topup",
				kind: "consume",
			},
		]);
		expect(await service.getBalance(userOwner("user_1"))).toEqual({
			balance: 8,
			plan: 0,
			promo: 0,
			topup: 8,
		});
	});

	it("allows metering settlement debt only when explicitly requested", async () => {
		const { repository, service } = setup();

		repository.seed({
			bucket: "plan",
			delta: 1,
			kind: "grant",
			userId: "user_1",
		});

		const rows = await service.consume(userOwner("user_1"), 3, {
			allowOverdraft: true,
			idempotencyKey: "settle:event_1",
			meta: { action: "chat" },
		});

		expect(rows).toMatchObject([
			{
				bucket: "plan",
				delta: -1,
				idempotencyKey: "settle:event_1:plan",
			},
			{
				bucket: "topup",
				delta: -2,
				idempotencyKey: "settle:event_1:topup",
			},
		]);
		expect(await service.getBalance(userOwner("user_1"))).toMatchObject({
			balance: -2,
			plan: 0,
			topup: -2,
		});
		await expect(
			service.consume(userOwner("user_1"), 3, {
				idempotencyKey: "settle:event_1",
				meta: { action: "chat" },
			}),
		).rejects.toThrow("Credit consume idempotency replay conflict");
	});

	it("rejects when total balance is below the amount, including top-up debt", async () => {
		const { repository, service } = setup();

		repository.seed({
			bucket: "plan",
			delta: 15,
			kind: "grant",
			userId: "user_1",
		});
		repository.seed({
			bucket: "topup",
			delta: -10,
			kind: "revoke",
			userId: "user_1",
		});

		await expect(service.consume(userOwner("user_1"), 8)).rejects.toBeInstanceOf(
			InsufficientCreditsError,
		);
		expect(repository.rows).toHaveLength(2);

		const rows = await service.consume(userOwner("user_1"), 5);

		expect(rows).toMatchObject([
			{
				bucket: "plan",
				delta: -5,
				kind: "consume",
			},
		]);
		expect(await service.getBalance(userOwner("user_1"))).toEqual({
			balance: 0,
			plan: 10,
			promo: 0,
			topup: -10,
		});
	});

	it("serializes concurrent reservations so credits cannot be overspent", async () => {
		const { repository, service } = setup();

		repository.seed({
			bucket: "plan",
			delta: 25,
			kind: "grant",
			userId: "user_1",
		});

		const results = await Promise.allSettled([
			service.consume(userOwner("user_1"), 25, {
				idempotencyKey: "media-generation:attempt_1",
			}),
			service.consume(userOwner("user_1"), 25, {
				idempotencyKey: "media-generation:attempt_2",
			}),
		]);
		const fulfilled = results.filter((result) => result.status === "fulfilled");
		const rejected = results.filter((result) => result.status === "rejected");

		expect(fulfilled).toHaveLength(1);
		expect(rejected).toMatchObject([
			{ reason: expect.any(InsufficientCreditsError) },
		]);
		expect(
			repository.rows.filter((row) => row.kind === "consume"),
		).toHaveLength(1);
		expect(await service.getBalance(userOwner("user_1"))).toEqual({
			balance: 0,
			plan: 0,
			promo: 0,
			topup: 0,
		});
	});

	it("returns the original consume result for an identical replay", async () => {
		const { repository, service } = setup();

		repository.seed({
			bucket: "plan",
			delta: 5,
			kind: "grant",
			userId: "user_1",
		});
		repository.seed({
			bucket: "topup",
			delta: 10,
			kind: "topup",
			userId: "user_1",
		});

		const firstRows = await service.consume(userOwner("user_1"), 8, {
			idempotencyKey: "consume:job_1",
			meta: { action: "chatMessage" },
		});
		const rowCount = repository.rows.length;
		const secondRows = await service.consume(userOwner("user_1"), 8, {
			idempotencyKey: "consume:job_1",
			meta: { action: "chatMessage" },
		});

		expect(firstRows).toHaveLength(2);
		for (const row of firstRows) {
			expect(row.meta).toMatchObject({
				idempotencyFingerprint: {
					action: "chatMessage",
					amount: 8,
					bucketSplit: { plan: 5, promo: 0, topup: 3 },
					userId: "user_1",
				},
			});
		}
		expect(secondRows).toEqual(firstRows);
		expect(repository.rows).toHaveLength(rowCount);
	});

	it("rejects a consume replay whose amount fingerprint does not match", async () => {
		const { repository, service } = setup();

		repository.seed({
			bucket: "plan",
			delta: 5,
			kind: "grant",
			userId: "user_1",
		});
		repository.seed({
			bucket: "topup",
			delta: 10,
			kind: "topup",
			userId: "user_1",
		});

		await service.consume(userOwner("user_1"), 8, {
			idempotencyKey: "consume:job_1",
			meta: { action: "chatMessage" },
		});
		const rowCount = repository.rows.length;

		await expect(
			service.consume(userOwner("user_1"), 9, {
				idempotencyKey: "consume:job_1",
				meta: { action: "chatMessage" },
			}),
		).rejects.toThrow("Credit consume idempotency replay conflict");
		expect(repository.rows).toHaveLength(rowCount);
	});

	it("rejects a consume replay whose action fingerprint does not match", async () => {
		const { repository, service } = setup();

		repository.seed({
			bucket: "plan",
			delta: 10,
			kind: "grant",
			userId: "user_1",
		});
		await service.consume(userOwner("user_1"), 5, {
			idempotencyKey: "consume:job_1",
			meta: { action: "imageGeneration" },
		});

		await expect(
			service.consume(userOwner("user_1"), 5, {
				idempotencyKey: "consume:job_1",
				meta: { action: "marketingAssetGeneration" },
			}),
		).rejects.toThrow("Credit consume idempotency replay conflict");
	});

	it("rejects a consume key already owned by another user", async () => {
		const { repository, service } = setup();

		for (const userId of ["user_1", "user_2"]) {
			repository.seed({
				bucket: "plan",
				delta: 10,
				kind: "grant",
				userId,
			});
		}
		await service.consume(userOwner("user_1"), 5, {
			idempotencyKey: "consume:job_1",
			meta: { action: "imageGeneration" },
		});

		await expect(
			service.consume(userOwner("user_2"), 5, {
				idempotencyKey: "consume:job_1",
				meta: { action: "imageGeneration" },
			}),
		).rejects.toThrow("Credit consume idempotency replay conflict");
	});

	it("rejects a consume replay with an incomplete bucket split", async () => {
		const { repository, service } = setup();

		repository.seed({
			bucket: "plan",
			delta: -5,
			idempotencyKey: "consume:job_1:plan",
			kind: "consume",
			meta: {
				action: "chatMessage",
				idempotencyFingerprint: {
					action: "chatMessage",
					amount: 8,
					bucketSplit: { plan: 5, promo: 0, topup: 3 },
					userId: "user_1",
				},
			},
			userId: "user_1",
		});

		await expect(
			service.consume(userOwner("user_1"), 8, {
				idempotencyKey: "consume:job_1",
				meta: { action: "chatMessage" },
			}),
		).rejects.toThrow("Credit consume idempotency replay conflict");
	});

	it("refunds the original plan/promo/top-up split exactly once", async () => {
		const { repository, service } = setup();

		repository.seed({
			bucket: "plan",
			delta: 2,
			kind: "grant",
			userId: "user_1",
		});
		repository.seed({
			bucket: "promo",
			delta: 3,
			kind: "grant",
			userId: "user_1",
		});
		repository.seed({
			bucket: "topup",
			delta: 10,
			kind: "topup",
			userId: "user_1",
		});
		await service.consume(userOwner("user_1"), 8, {
			idempotencyKey: "media-generation:attempt_1",
		});

		const firstRefund = await service.refundConsume(
			userOwner("user_1"),
			"media-generation:attempt_1",
			{ attemptId: "attempt_1" },
		);
		const rowCount = repository.rows.length;
		const replayedRefund = await service.refundConsume(
			userOwner("user_1"),
			"media-generation:attempt_1",
			{ attemptId: "attempt_1" },
		);

		expect(firstRefund).toMatchObject([
			{
				bucket: "plan",
				delta: 2,
				idempotencyKey: "refund:media-generation:attempt_1:plan",
				kind: "grant",
				meta: {
					attemptId: "attempt_1",
					consumeLedgerId: "ledger_4",
					reason: "generation_refund",
				},
			},
			{
				bucket: "promo",
				delta: 3,
				idempotencyKey: "refund:media-generation:attempt_1:promo",
				kind: "grant",
				meta: {
					attemptId: "attempt_1",
					consumeLedgerId: "ledger_5",
					reason: "generation_refund",
				},
			},
			{
				bucket: "topup",
				delta: 3,
				idempotencyKey: "refund:media-generation:attempt_1:topup",
				kind: "grant",
				meta: {
					attemptId: "attempt_1",
					consumeLedgerId: "ledger_6",
					reason: "generation_refund",
				},
			},
		]);
		expect(replayedRefund).toEqual(firstRefund);
		expect(repository.rows).toHaveLength(rowCount);
		expect(await service.getBalance(userOwner("user_1"))).toEqual({
			balance: 15,
			plan: 2,
			promo: 3,
			topup: 10,
		});
	});

	it("partially refunds a reservation in reverse spend order with stable keys", async () => {
		const { repository, service } = setup();

		for (const [bucket, delta, kind] of [
			["plan", 2, "grant"],
			["promo", 3, "grant"],
			["topup", 10, "topup"],
		] as const) {
			repository.seed({ bucket, delta, kind, userId: "user_1" });
		}
		await service.consume(userOwner("user_1"), 8, {
			idempotencyKey: "reserve:event_1",
		});

		const first = await service.refundConsumeAmount(
			userOwner("user_1"),
			"reserve:event_1",
			{
				amount: 4,
				idempotencyKey: "settle-refund:event_1",
			},
		);
		const rowCount = repository.rows.length;
		const replay = await service.refundConsumeAmount(
			userOwner("user_1"),
			"reserve:event_1",
			{
				amount: 4,
				idempotencyKey: "settle-refund:event_1",
			},
		);

		expect(first).toMatchObject([
			{
				bucket: "promo",
				delta: 1,
				idempotencyKey: "settle-refund:event_1:promo",
			},
			{
				bucket: "topup",
				delta: 3,
				idempotencyKey: "settle-refund:event_1:topup",
			},
		]);
		expect(replay).toEqual(first);
		expect(repository.rows).toHaveLength(rowCount);
		expect(await service.getBalance(userOwner("user_1"))).toEqual({
			balance: 11,
			plan: 0,
			promo: 1,
			topup: 10,
		});
	});

	it("caps an in-flight plan reservation at a refill boundary before settlement can restore it", async () => {
		const { repository, service } = setup();

		repository.seed({
			bucket: "plan",
			delta: 200,
			kind: "grant",
			userId: "user_1",
		});
		await service.consume(userOwner("user_1"), 200, {
			idempotencyKey: "reserve:event_1",
			meta: { action: "chat" },
			planHold: "active",
		});

		await expect(
			service.applyCappedRefill(userOwner("user_1"), 100, {
				idempotencyKey: "inv:in_renewal:grant",
			}),
		).resolves.toMatchObject({
			carriedCredits: 100,
			expiredCredits: 100,
			preRefillPlanBalance: 200,
			replayed: false,
		});
		expect(await service.getBalance(userOwner("user_1"))).toMatchObject({ plan: 100 });

		const refund = await service.refundConsumeAmount(
			userOwner("user_1"),
			"reserve:event_1",
			{
				amount: 200,
				idempotencyKey: "settle-refund:event_1",
			},
		);
		const rowCount = repository.rows.length;

		expect(refund).toMatchObject([
			{
				bucket: "plan",
				delta: 100,
				meta: {
					idempotencyFingerprint: {
						forfeitedPlanCredits: 100,
						grantedAmount: 100,
					},
				},
			},
		]);
		expect(await service.getBalance(userOwner("user_1"))).toEqual({
			balance: 200,
			plan: 200,
			promo: 0,
			topup: 0,
		});

		await expect(
			service.refundConsumeAmount(userOwner("user_1"), "reserve:event_1", {
				amount: 200,
				idempotencyKey: "settle-refund:event_1",
			}),
		).resolves.toEqual(refund);
		expect(repository.rows).toHaveLength(rowCount);
	});

	it("forfeits held plan entitlement on deletion while still refunding non-plan reservation buckets", async () => {
		const { repository, service } = setup();

		repository.seed({
			bucket: "plan",
			delta: 100,
			kind: "grant",
			userId: "user_1",
		});
		repository.seed({
			bucket: "topup",
			delta: 25,
			kind: "topup",
			userId: "user_1",
		});
		await service.consume(userOwner("user_1"), 125, {
			idempotencyKey: "reserve:event_deleted",
			meta: { action: "chat" },
			planHold: "active",
		});

		await expect(
			service.expirePlanRemainder(userOwner("user_1"), {
				idempotencyKey: "sub-delete:sub_1:expire",
			}),
		).resolves.toBe(0);

		await expect(
			service.refundConsumeAmount(userOwner("user_1"), "reserve:event_deleted", {
				amount: 125,
				idempotencyKey: "settle-refund:event_deleted",
			}),
		).resolves.toMatchObject([
			{
				bucket: "topup",
				delta: 25,
				meta: {
					idempotencyFingerprint: {
						forfeitedPlanCredits: 100,
						grantedAmount: 25,
					},
				},
			},
		]);
		expect(await service.getBalance(userOwner("user_1"))).toEqual({
			balance: 25,
			plan: 0,
			promo: 0,
			topup: 25,
		});
		expect(repository.planHolds.get("reserve:event_deleted")).toMatchObject({
			active: false,
			poolId: null,
			refundableCredits: 0,
		});
	});

	it("expires only positive plan remainder and is replay-safe", async () => {
		const { repository, service } = setup();

		repository.seed({
			bucket: "plan",
			delta: 7,
			kind: "grant",
			userId: "user_1",
		});
		repository.seed({
			bucket: "topup",
			delta: 4,
			kind: "topup",
			userId: "user_1",
		});

		await expect(
			service.expirePlanRemainder(userOwner("user_1"), {
				idempotencyKey: "expire:cycle_1",
			}),
		).resolves.toBe(7);
		expect(await service.getBalance(userOwner("user_1"))).toEqual({
			balance: 4,
			plan: 0,
			promo: 0,
			topup: 4,
		});
		const rowCount = repository.rows.length;

		await expect(
			service.expirePlanRemainder(userOwner("user_1"), {
				idempotencyKey: "expire:cycle_2",
			}),
		).resolves.toBe(0);
		await expect(
			service.expirePlanRemainder(userOwner("user_1"), {
				idempotencyKey: "expire:cycle_1",
			}),
		).resolves.toBe(7);
		expect(repository.rows).toHaveLength(rowCount);
	});

	it("caps expireAmount at the current plan balance", async () => {
		const { repository, service } = setup();

		repository.seed({
			bucket: "plan",
			delta: 4,
			kind: "grant",
			userId: "user_1",
		});

		await expect(
			service.expireAmount(userOwner("user_1"), 10, {
				idempotencyKey: "expire:amount_1",
			}),
		).resolves.toBe(4);
		expect(repository.rows.at(-1)).toMatchObject({
			bucket: "plan",
			delta: -4,
			idempotencyKey: "expire:amount_1",
			kind: "expire",
		});
	});

	it("revokes from top-up by default and replays the idempotency key without a new row", async () => {
		const { repository, service } = setup();

		const first = await service.revoke(userOwner("user_1"), 25, {
			idempotencyKey: "refund:ch_1:250",
			meta: {
				chargeId: "ch_1",
				reason: "charge_refunded",
			},
		});
		const rowCount = repository.rows.length;
		const replay = await service.revoke(userOwner("user_1"), 25, {
			idempotencyKey: "refund:ch_1:250",
			meta: {
				chargeId: "ch_1",
				reason: "charge_refunded",
			},
		});

		expect(first).toMatchObject({
			bucket: "topup",
			delta: -25,
			idempotencyKey: "refund:ch_1:250",
			kind: "revoke",
			meta: {
				chargeId: "ch_1",
				reason: "charge_refunded",
			},
		});
		expect(replay).toEqual(first);
		expect(repository.rows).toHaveLength(rowCount);
	});

	it("revokes from an explicitly selected original bucket", async () => {
		const { repository, service } = setup();

		const row = await service.revoke(userOwner("user_1"), 40, {
			bucket: "plan",
			idempotencyKey: "refund:ch_plan:400",
			meta: {
				chargeId: "ch_plan",
				reason: "charge_refunded",
			},
		});

		expect(row).toMatchObject({
			bucket: "plan",
			delta: -40,
			idempotencyKey: "refund:ch_plan:400",
			kind: "revoke",
		});
		expect(repository.rows).toHaveLength(1);
	});

	it("reuses an existing transaction for a charge-locked revocation", async () => {
		const { repository, service } = setup();
		const transaction = {
			kind: "existing-charge-lock-transaction",
		} as unknown as CreditsTransaction;

		await service.revoke(
			userOwner("user_1"),
			40,
			{
				bucket: "plan",
				idempotencyKey: "dispute:dp_1",
				meta: { chargeId: "ch_1" },
			},
			transaction,
		);

		expect(repository.transactionInputs).toEqual([transaction]);
		expect(repository.writeClients).toEqual([transaction]);
	});

	it("reuses an external transaction for grants", async () => {
		const { repository, service } = setup();
		const transaction = {
			kind: "existing-beta-enroll-transaction",
		} as unknown as CreditsTransaction;

		await service.grant(
			userOwner("user_1"),
			20,
			{
				bucket: "promo",
				idempotencyKey:
					"beta-enroll:user_1:11111111-1111-4111-8111-111111111111",
			},
			transaction,
		);

		expect(repository.transactionInputs).toEqual([transaction]);
		expect(repository.writeClients).toEqual([transaction]);
	});

	it("rejects a grant replay whose amount fingerprint does not match", async () => {
		const { service } = setup();
		const idempotencyKey =
			"beta-enroll:user_1:11111111-1111-4111-8111-111111111111";

		await service.grant(userOwner("user_1"), 20, {
			bucket: "promo",
			idempotencyKey,
		});

		await expect(
			service.grant(userOwner("user_1"), 21, {
				bucket: "promo",
				idempotencyKey,
			}),
		).rejects.toThrow("Credit grant idempotency replay conflict");
	});

	it("rejects a grant replay owned by another user", async () => {
		const { service } = setup();
		const idempotencyKey =
			"admin-grant:user_1:11111111-1111-4111-8111-111111111111";

		await service.grant(userOwner("user_1"), 20, {
			bucket: "promo",
			idempotencyKey,
		});

		await expect(
			service.grant(userOwner("user_2"), 20, {
				bucket: "promo",
				idempotencyKey,
			}),
		).rejects.toThrow("Credit grant idempotency replay conflict");
	});

	it("rejects a grant replay without the owner and amount fingerprint", async () => {
		const { repository, service } = setup();
		const idempotencyKey = "signup:user_legacy";
		repository.seed({
			bucket: "promo",
			delta: 20,
			idempotencyKey,
			kind: "grant",
			meta: { reason: "legacy_signup_grant" },
			userId: "user_legacy",
		});

		await expect(
			service.grant(userOwner("user_legacy"), 20, {
				bucket: "promo",
				idempotencyKey,
			}),
		).rejects.toThrow("Credit grant idempotency replay conflict");
	});

	it("grants signup credits with the expected amount and idempotency key", async () => {
		const { service } = setup();

		const row = await service.grantSignupCredits("user_1");

		expect(row).toMatchObject({
			bucket: "promo",
			delta: 20,
			idempotencyKey: "signup:user_1",
			kind: "grant",
			meta: { reason: "signup_grant" },
		});
	});

	it("rejects zero, negative, and non-integer amounts", async () => {
		const { service } = setup();

		for (const amount of [0, -1, 1.5]) {
			await expect(service.consume(userOwner("user_1"), amount)).rejects.toThrow(
				"Credit amount must be a positive integer",
			);
		}
	});
});
