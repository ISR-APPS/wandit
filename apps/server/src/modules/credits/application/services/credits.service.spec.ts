import { describe, expect, it } from "vitest";

import { InsufficientCreditsError } from "../../domain/errors/insufficient-credits.error";
import type {
	CreditLedgerRow,
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
		Pick<
			InsertCreditLedgerEntry,
			"idempotencyKey" | "meta" | "organizationId"
		>
	>;

class InMemoryCreditsRepository {
	readonly rows: CreditLedgerRow[] = [];
	private lock: Promise<void> = Promise.resolve();
	private nextId = 1;
	private readonly tx = {} as CreditsTransaction;

	async withUserLock<T>(
		_userId: string,
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

	async getBalance(userId: string, _client?: unknown) {
		const balance = {
			balance: 0,
			plan: 0,
			topup: 0,
		};

		for (const row of this.rows) {
			if (row.userId !== userId) {
				continue;
			}

			balance[row.bucket] += row.delta;
		}

		balance.balance = balance.plan + balance.topup;

		return balance;
	}

	async insertLedgerEntry(
		input: InsertCreditLedgerEntry,
		_client?: unknown,
	): Promise<CreditLedgerRow> {
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
		userId: string,
		idempotencyKeys: string[],
		_client?: unknown,
	): Promise<CreditLedgerRow[]> {
		return this.rows.filter(
			(row) =>
				row.userId === userId &&
				row.idempotencyKey !== null &&
				idempotencyKeys.includes(row.idempotencyKey),
		);
	}

	seed(input: SeedLedgerEntry) {
		const row = this.makeRow({
			...input,
			meta: input.meta ?? { reason: "seed" },
		});
		this.rows.push(row);

		return row;
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
	it("consumes plan credits before top-up credits", async () => {
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

		const rows = await service.consume("user_1", 8, {
			idempotencyKey: "consume:job_1",
		});

		expect(rows).toMatchObject([
			{
				bucket: "plan",
				delta: -5,
				idempotencyKey: "consume:job_1:plan",
				kind: "consume",
			},
			{
				bucket: "topup",
				delta: -3,
				idempotencyKey: "consume:job_1:topup",
				kind: "consume",
			},
		]);
		expect(await service.getBalance("user_1")).toEqual({
			balance: 7,
			plan: 0,
			topup: 7,
		});
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

		await expect(service.consume("user_1", 8)).rejects.toBeInstanceOf(
			InsufficientCreditsError,
		);
		expect(repository.rows).toHaveLength(2);

		const rows = await service.consume("user_1", 5);

		expect(rows).toMatchObject([
			{
				bucket: "plan",
				delta: -5,
				kind: "consume",
			},
		]);
		expect(await service.getBalance("user_1")).toEqual({
			balance: 0,
			plan: 10,
			topup: -10,
		});
	});

	it("replays consume idempotently without writing new rows", async () => {
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

		const firstRows = await service.consume("user_1", 8, {
			idempotencyKey: "consume:job_1",
		});
		const rowCount = repository.rows.length;
		const secondRows = await service.consume("user_1", 8, {
			idempotencyKey: "consume:job_1",
		});

		expect(secondRows).toEqual(firstRows);
		expect(repository.rows).toHaveLength(rowCount);
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
			service.expirePlanRemainder("user_1", {
				idempotencyKey: "expire:cycle_1",
			}),
		).resolves.toBe(7);
		expect(await service.getBalance("user_1")).toEqual({
			balance: 4,
			plan: 0,
			topup: 4,
		});
		const rowCount = repository.rows.length;

		await expect(
			service.expirePlanRemainder("user_1", {
				idempotencyKey: "expire:cycle_2",
			}),
		).resolves.toBe(0);
		await expect(
			service.expirePlanRemainder("user_1", {
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
			service.expireAmount("user_1", 10, {
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

	it("grants signup credits with the expected amount and idempotency key", async () => {
		const { service } = setup();

		const row = await service.grantSignupCredits("user_1");

		expect(row).toMatchObject({
			bucket: "plan",
			delta: 100,
			idempotencyKey: "signup:user_1",
			kind: "grant",
			meta: { reason: "signup_grant" },
		});
	});

	it("rejects zero, negative, and non-integer amounts", async () => {
		const { service } = setup();

		for (const amount of [0, -1, 1.5]) {
			await expect(service.consume("user_1", amount)).rejects.toThrow(
				"Credit amount must be a positive integer",
			);
		}
	});
});
