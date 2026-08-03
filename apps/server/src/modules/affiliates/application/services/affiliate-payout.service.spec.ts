import { ConflictException, ForbiddenException } from "@nestjs/common";
import type { BuildAffiliatePayoutInput } from "@wandit/contracts";
import { describe, expect, it } from "vitest";

import {
	type AffiliateCommissionRow,
	AffiliatePayoutConflictError,
	AffiliatePayoutIneligibleError,
	type AffiliatePayoutRow,
	type AffiliatesRepository,
	type AffiliateTransaction,
} from "../../infrastructure/persistence/affiliates.repository";
import { AffiliatePayoutService } from "./affiliate-payout.service";

const affiliateId = "11111111-1111-4111-8111-111111111111";
const otherAffiliateId = "22222222-2222-4222-8222-222222222222";
const adminId = "admin_1";
const transaction = {} as AffiliateTransaction;

function commission(
	id: string,
	amountCents: number,
	createdAt: Date,
	overrides: Partial<AffiliateCommissionRow> = {},
): AffiliateCommissionRow {
	return {
		affiliateId,
		amountCents,
		attributionId: "33333333-3333-4333-8333-333333333333",
		baseAmountCents: 10_000,
		createdAt,
		currency: "usd",
		entryType: "earning",
		holdUntil: new Date("2026-02-01T00:00:00.000Z"),
		id,
		originalCommissionId: null,
		payoutId: null,
		rateBps: 2_000,
		reversalReason: null,
		status: "approved",
		stripeChargeId: `ch_${id}`,
		stripeDisputeId: null,
		stripeInvoiceId: `in_${id}`,
		stripeRefundId: null,
		updatedAt: createdAt,
		...overrides,
	};
}

function payout(
	id: string,
	overrides: Partial<AffiliatePayoutRow> = {},
): AffiliatePayoutRow {
	const now = new Date("2026-03-01T00:00:00.000Z");
	return {
		affiliateId,
		createdAt: now,
		createdByUserId: adminId,
		currency: "usd",
		externalRef: null,
		id,
		method: "wise",
		paidAt: null,
		periodEnd: now,
		periodStart: now,
		requestId: "44444444-4444-4444-8444-444444444444",
		status: "processing",
		totalCents: 1_000,
		updatedAt: now,
		...overrides,
	};
}

function buildInput(
	overrides: Partial<BuildAffiliatePayoutInput> = {},
): BuildAffiliatePayoutInput {
	return {
		affiliateId,
		currency: "usd",
		requestId: "44444444-4444-4444-8444-444444444444",
		...overrides,
	};
}

type CreatePayoutInput = {
	affiliateId: string;
	createdByUserId: string;
	currency: string;
	method: AffiliatePayoutRow["method"];
	periodEnd: Date;
	periodStart: Date;
	requestId: string;
	totalCents: number;
};

type MarkPaidInput = {
	externalRef: string;
	method: AffiliatePayoutRow["method"];
	paidAt: Date;
	payoutId: string;
};

class FakeAffiliatesRepository {
	readonly createPayoutInputs: CreatePayoutInput[] = [];
	readonly failedPayoutIds: string[] = [];
	readonly lockKeys: string[] = [];
	readonly markPaidInputs: MarkPaidInput[] = [];
	readonly methods = new Map<string, AffiliatePayoutRow["method"]>([
		[affiliateId, "wise"],
		[otherAffiliateId, "manual"],
	]);
	readonly entries: AffiliateCommissionRow[] = [
		commission(
			"55555555-5555-4555-8555-555555555555",
			1_250,
			new Date("2026-01-01T00:00:00.000Z"),
		),
		commission(
			"66666666-6666-4666-8666-666666666666",
			-250,
			new Date("2026-02-01T00:00:00.000Z"),
			{ entryType: "adjustment" },
		),
	];
	readonly payouts: AffiliatePayoutRow[] = [];
	claimLimit: number | null = null;
	failPayoutError: Error | null = null;
	markPaidError: Error | null = null;
	private payoutSequence = 0;
	private readonly lockTails = new Map<string, Promise<void>>();

	async withPayoutLock<T>(
		lockedAffiliateId: string,
		currency: string,
		operation: (tx: AffiliateTransaction) => Promise<T>,
	): Promise<T> {
		const key = `${lockedAffiliateId}:${currency}`;
		this.lockKeys.push(key);
		const previous = this.lockTails.get(key) ?? Promise.resolve();
		let release: () => void = () => undefined;
		const gate = new Promise<void>((resolve) => {
			release = () => resolve();
		});
		this.lockTails.set(
			key,
			previous.then(() => gate),
		);

		await previous;
		const entrySnapshot = this.entries.map((entry) => ({ ...entry }));
		const payoutSnapshot = this.payouts.map((row) => ({ ...row }));
		try {
			return await operation(transaction);
		} catch (error) {
			this.entries.splice(0, this.entries.length, ...entrySnapshot);
			this.payouts.splice(0, this.payouts.length, ...payoutSnapshot);
			throw error;
		} finally {
			release();
		}
	}

	async findPayoutByRequestId(requestId: string) {
		return this.payouts.find((row) => row.requestId === requestId) ?? null;
	}

	async lockEligiblePayoutEntries(
		requestedAffiliateId: string,
		currency: string,
	) {
		return this.entries.filter(
			(entry) =>
				entry.affiliateId === requestedAffiliateId &&
				entry.currency === currency &&
				entry.status === "approved" &&
				entry.payoutId === null,
		);
	}

	async affiliatePayoutMethod(requestedAffiliateId: string) {
		return this.methods.get(requestedAffiliateId) ?? null;
	}

	async createPayout(input: CreatePayoutInput) {
		this.createPayoutInputs.push(input);
		this.payoutSequence += 1;
		const row = payout(`payout_${this.payoutSequence}`, input);
		this.payouts.push(row);
		return row;
	}

	async claimPayoutEntries(
		entryIds: string[],
		requestedAffiliateId: string,
		currency: string,
		payoutId: string,
	) {
		const eligible = this.entries.filter(
			(entry) =>
				entryIds.includes(entry.id) &&
				entry.affiliateId === requestedAffiliateId &&
				entry.currency === currency &&
				entry.status === "approved" &&
				entry.payoutId === null,
		);
		const claimed =
			this.claimLimit === null ? eligible : eligible.slice(0, this.claimLimit);

		return claimed.map((entry) => {
			const index = this.entries.findIndex(
				(candidate) => candidate.id === entry.id,
			);
			const updated = { ...entry, payoutId };
			this.entries[index] = updated;
			return updated;
		});
	}

	async getPayout(id: string) {
		return this.payouts.find((row) => row.id === id) ?? null;
	}

	async markPayoutPaid(input: MarkPaidInput) {
		this.markPaidInputs.push(input);

		if (this.markPaidError) {
			throw this.markPaidError;
		}

		const index = this.payouts.findIndex((row) => row.id === input.payoutId);
		const current = this.payouts[index];
		if (!current) {
			return null;
		}

		for (
			let entryIndex = 0;
			entryIndex < this.entries.length;
			entryIndex += 1
		) {
			const entry = this.entries[entryIndex];
			if (entry?.payoutId === input.payoutId) {
				this.entries[entryIndex] = {
					...entry,
					status: "paid",
					updatedAt: input.paidAt,
				};
			}
		}

		const updated = {
			...current,
			externalRef: input.externalRef,
			paidAt: input.paidAt,
			status: "paid" as const,
			updatedAt: input.paidAt,
		};
		this.payouts[index] = updated;
		return updated;
	}

	async failAndReleasePayout(payoutId: string) {
		this.failedPayoutIds.push(payoutId);

		if (this.failPayoutError) {
			throw this.failPayoutError;
		}

		const index = this.payouts.findIndex((row) => row.id === payoutId);
		const current = this.payouts[index];
		if (!current) {
			return null;
		}

		for (
			let entryIndex = 0;
			entryIndex < this.entries.length;
			entryIndex += 1
		) {
			const entry = this.entries[entryIndex];
			if (entry?.payoutId === payoutId) {
				this.entries[entryIndex] = { ...entry, payoutId: null };
			}
		}

		const updated = {
			...current,
			status: "failed" as const,
		};
		this.payouts[index] = updated;
		return updated;
	}
}

function setup() {
	const repository = new FakeAffiliatesRepository();
	const service = new AffiliatePayoutService(
		repository as unknown as AffiliatesRepository,
	);

	return { repository, service };
}

describe("AffiliatePayoutService", () => {
	it("atomically builds a payout and claims the locked approved ledger entries", async () => {
		const { repository, service } = setup();

		const result = await service.build(buildInput(), adminId);

		expect(result).toEqual(
			expect.objectContaining({
				createdByUserId: adminId,
				method: "wise",
				status: "processing",
				totalCents: 1_000,
			}),
		);
		expect(repository.createPayoutInputs[0]).toEqual(
			expect.objectContaining({
				periodEnd: new Date("2026-02-01T00:00:00.000Z"),
				periodStart: new Date("2026-01-01T00:00:00.000Z"),
				totalCents: 1_000,
			}),
		);
		expect(
			repository.entries.every((entry) => entry.payoutId === result.id),
		).toBe(true);
	});

	it("rolls back payout creation and all claims when the claim count changes", async () => {
		const { repository, service } = setup();
		repository.claimLimit = 1;

		await expect(service.build(buildInput(), adminId)).rejects.toBeInstanceOf(
			ConflictException,
		);
		expect(repository.payouts).toHaveLength(0);
		expect(repository.entries.every((entry) => entry.payoutId === null)).toBe(
			true,
		);
	});

	it("returns the original payout for an exact requestId replay", async () => {
		const { repository, service } = setup();
		const input = buildInput();

		const first = await service.build(input, adminId);
		const replay = await service.build(input, "admin_2");

		expect(replay).toBe(first);
		expect(repository.createPayoutInputs).toHaveLength(1);
		expect(repository.payouts).toHaveLength(1);
	});

	it("rejects a requestId replay whose affiliate or currency differs", async () => {
		const { repository, service } = setup();
		const input = buildInput();
		await service.build(input, adminId);

		await expect(
			service.build(buildInput({ affiliateId: otherAffiliateId }), adminId),
		).rejects.toBeInstanceOf(ConflictException);
		expect(repository.payouts).toHaveLength(1);
	});

	it("forbids a payout when the net approved balance is zero or negative", async () => {
		const { repository, service } = setup();
		repository.entries.splice(
			0,
			repository.entries.length,
			commission(
				"55555555-5555-4555-8555-555555555555",
				500,
				new Date("2026-01-01T00:00:00.000Z"),
			),
			commission(
				"66666666-6666-4666-8666-666666666666",
				-500,
				new Date("2026-02-01T00:00:00.000Z"),
				{ entryType: "adjustment" },
			),
		);

		await expect(service.build(buildInput(), adminId)).rejects.toBeInstanceOf(
			ForbiddenException,
		);
		expect(repository.payouts).toHaveLength(0);
		expect(repository.entries.every((entry) => entry.payoutId === null)).toBe(
			true,
		);
	});

	it("serializes concurrent admins so the approved entries are claimed once", async () => {
		const { repository, service } = setup();
		const outcomes = await Promise.allSettled([
			service.build(buildInput(), "admin_1"),
			service.build(
				buildInput({
					requestId: "77777777-7777-4777-8777-777777777777",
				}),
				"admin_2",
			),
		]);

		expect(
			outcomes.filter((outcome) => outcome.status === "fulfilled"),
		).toHaveLength(1);
		expect(
			outcomes.filter((outcome) => outcome.status === "rejected"),
		).toHaveLength(1);
		const rejected = outcomes.find((outcome) => outcome.status === "rejected");
		expect(rejected?.reason).toBeInstanceOf(ForbiddenException);
		expect(repository.payouts).toHaveLength(1);
		expect(new Set(repository.entries.map((entry) => entry.payoutId))).toEqual(
			new Set([repository.payouts[0]?.id]),
		);
		expect(repository.lockKeys).toEqual([
			`${affiliateId}:usd`,
			`${affiliateId}:usd`,
		]);
	});

	it("delegates mark-paid and failed payout state transitions to the repository", async () => {
		const paidSetup = setup();
		const paidPayout = await paidSetup.service.build(buildInput(), adminId);

		await expect(
			paidSetup.service.markPaid(paidPayout.id, "wise-transfer-123"),
		).resolves.toEqual(expect.objectContaining({ status: "paid" }));
		expect(paidSetup.repository.markPaidInputs).toEqual([
			expect.objectContaining({
				externalRef: "wise-transfer-123",
				method: "wise",
				paidAt: expect.any(Date),
				payoutId: paidPayout.id,
			}),
		]);
		expect(
			paidSetup.repository.entries.every((entry) => entry.status === "paid"),
		).toBe(true);

		const failedSetup = setup();
		const failedPayout = await failedSetup.service.build(buildInput(), adminId);
		await expect(
			failedSetup.service.markFailed(failedPayout.id, "provider rejected"),
		).resolves.toEqual(expect.objectContaining({ status: "failed" }));
		expect(failedSetup.repository.failedPayoutIds).toEqual([failedPayout.id]);
		expect(
			failedSetup.repository.entries.every((entry) => entry.payoutId === null),
		).toBe(true);
	});

	it("rejects mark-paid when a claimed entry became fraud-ineligible", async () => {
		const { repository, service } = setup();
		const built = await service.build(buildInput(), adminId);
		repository.markPaidError = new AffiliatePayoutIneligibleError(built.id);

		await expect(
			service.markPaid(built.id, "wise-transfer-blocked"),
		).rejects.toBeInstanceOf(ConflictException);
		expect(
			repository.entries.every((entry) => entry.status === "approved"),
		).toBe(true);
	});

	it("maps terminal payout state and replay mismatches to conflicts", async () => {
		const paidSetup = setup();
		const paidPayout = await paidSetup.service.build(buildInput(), adminId);
		paidSetup.repository.markPaidError = new AffiliatePayoutConflictError(
			"Paid affiliate payout replay payload mismatch",
		);

		await expect(
			paidSetup.service.markPaid(paidPayout.id, "different-transfer"),
		).rejects.toBeInstanceOf(ConflictException);

		const failedSetup = setup();
		const failedPayout = await failedSetup.service.build(buildInput(), adminId);
		failedSetup.repository.failPayoutError = new AffiliatePayoutConflictError(
			`Affiliate payout ${failedPayout.id} is not processing`,
		);

		await expect(
			failedSetup.service.markFailed(failedPayout.id),
		).rejects.toBeInstanceOf(ConflictException);
	});
});
