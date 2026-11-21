import { describe, expect, it } from "vitest";

import {
	type BlockingWebhookEvent,
	type BucketBalance,
	type CutoverDependencies,
	type CutoverSubscription,
	cutoverExitCode,
	type ExpireLedgerRow,
	type OpenSubscriptionCheckout,
	runPayAsYouGoCutover,
} from "../../../scripts/cutover-pay-as-you-go";

const RELEASED_AT = new Date("2026-11-13T08:00:00.000Z");

function subscription(
	overrides: Partial<CutoverSubscription> = {},
): CutoverSubscription {
	return {
		currentPeriodEnd: new Date("2026-12-01T00:00:00.000Z"),
		currentPeriodStart: new Date("2026-11-01T00:00:00.000Z"),
		id: "sub_local_1",
		organizationId: null,
		plan: "pro",
		priceLookupKey: "pro_250_month",
		provider: "stripe",
		providerSubscriptionId: "sub_remote_1",
		status: "active",
		tierCredits: 250,
		userId: "user_1",
		...overrides,
	};
}

/**
 * In-memory database and Stripe. A Stripe cancel only marks the remote row;
 * the sync copies the remote status into the local row, as the real sync does.
 */
class FakeCutoverWorld implements CutoverDependencies {
	readonly blockingEvents: BlockingWebhookEvent[] = [];
	readonly canceledRemote = new Set<string>();
	readonly checkouts: Array<OpenSubscriptionCheckout & { status: string }> = [];
	readonly expireRows: ExpireLedgerRow[] = [];
	readonly ledger = new Map<string, BucketBalance>();
	readonly rows = new Map<string, CutoverSubscription>();
	readonly slots: Array<{
		credits: number;
		id: string;
		status: "granted" | "pending";
		subscriptionId: string;
	}> = [];
	readonly stateEvents = new Set<string>();
	readonly stripeCancelKeys: string[] = [];
	/** Status that Stripe returns when the script expires the session. */
	sessionStatus = "expired";
	writes = 0;

	async listBlockingWebhookEvents() {
		return this.blockingEvents;
	}

	async listOpenSubscriptionCheckouts() {
		return this.checkouts.filter((checkout) => checkout.status === "open");
	}

	async expireCheckoutSession() {
		return this.sessionStatus;
	}

	async markCheckoutExpired(attemptId: string) {
		this.writes += 1;
		for (const checkout of this.checkouts) {
			if (checkout.attemptId === attemptId) {
				checkout.status = "expired";
			}
		}
	}

	async listCandidateIds() {
		return [...this.rows.values()]
			.filter(
				(row) =>
					!["canceled", "incomplete_expired"].includes(row.status) ||
					this.slots.some(
						(slot) =>
							slot.subscriptionId === row.id && slot.status === "pending",
					),
			)
			.map((row) => row.id);
	}

	async reloadSubscription(subscriptionId: string) {
		const row = this.rows.get(subscriptionId);
		return row ? { ...row } : null;
	}

	async listPendingSlotIds(subscriptionId: string) {
		return this.slots
			.filter(
				(slot) =>
					slot.subscriptionId === subscriptionId && slot.status === "pending",
			)
			.map((slot) => slot.id);
	}

	async ledgerBalance() {
		return this.ledger.get("user_1") ?? { plan: 0, promo: 0, topup: 0 };
	}

	async stripeCustomerBalance(row: CutoverSubscription) {
		return row.provider === "stripe" ? -500 : null;
	}

	async grantPendingSlot(slotId: string) {
		const slot = this.slots.find((candidate) => candidate.id === slotId);

		if (slot?.status !== "pending") {
			return "skipped" as const;
		}

		this.writes += 1;
		slot.status = "granted";
		const balance = await this.ledgerBalance();
		this.ledger.set("user_1", {
			...balance,
			plan: balance.plan + slot.credits,
		});

		return "granted" as const;
	}

	async cancelStripeSubscription(
		providerSubscriptionId: string,
		idempotencyKey: string,
	) {
		this.writes += 1;
		this.stripeCancelKeys.push(idempotencyKey);
		this.canceledRemote.add(providerSubscriptionId);
	}

	async syncStripeCustomer() {
		for (const row of this.rows.values()) {
			if (this.canceledRemote.has(row.providerSubscriptionId)) {
				row.status = "canceled";
			}
		}
	}

	async setLocalStatus(providerSubscriptionId: string, status: string) {
		this.writes += 1;
		for (const row of this.rows.values()) {
			if (row.providerSubscriptionId === providerSubscriptionId) {
				row.status = status;
			}
		}
	}

	async endManualSubscription(snapshot: CutoverSubscription) {
		this.writes += 1;
		const row = this.rows.get(snapshot.id);

		if (row) {
			row.status = "canceled";
			this.stateEvents.add(`manual:${row.id}:ended`);
		}
	}

	async listExpireRowsSince(releasedAt: Date) {
		return this.expireRows.filter((row) => row.createdAt > releasedAt);
	}

	seed(row: CutoverSubscription) {
		this.rows.set(row.id, row);
	}
}

describe("runPayAsYouGoCutover", () => {
	it("writes nothing on a dry run and reports each subscription", async () => {
		const world = new FakeCutoverWorld();
		world.seed(subscription());
		world.slots.push({
			credits: 25_000,
			id: "slot_1",
			status: "pending",
			subscriptionId: "sub_local_1",
		});
		world.checkouts.push({
			attemptId: "attempt_1",
			sessionId: "cs_1",
			status: "open",
		});

		const report = await runPayAsYouGoCutover(
			{ apply: false, releasedAt: null },
			world,
		);

		expect(world.writes).toBe(0);
		expect(report.rows).toEqual([
			expect.objectContaining({
				customerBalanceMinor: -500,
				pendingSlots: 1,
				result: "dry_run",
			}),
		]);
		expect(report.checkouts).toEqual([
			expect.objectContaining({ result: "dry_run" }),
		]);
		expect(cutoverExitCode(report)).toBe(0);
	});

	it("cancels and syncs a Stripe row, ends a manual row, and a second apply is a no-op", async () => {
		const world = new FakeCutoverWorld();
		world.seed(subscription());
		world.seed(
			subscription({
				id: "sub_local_manual",
				provider: "manual",
				providerSubscriptionId: "manual:sub_local_manual",
			}),
		);

		const first = await runPayAsYouGoCutover(
			{ apply: true, releasedAt: null },
			world,
		);

		expect(world.stripeCancelKeys).toEqual(["payg-cutover:sub_local_1"]);
		expect(world.rows.get("sub_local_1")?.status).toBe("canceled");
		expect(world.rows.get("sub_local_manual")?.status).toBe("canceled");
		expect(world.stateEvents).toEqual(
			new Set(["manual:sub_local_manual:ended"]),
		);
		expect(first.rows.map((row) => row.result)).toEqual(["applied", "applied"]);

		const writesAfterFirst = world.writes;
		const second = await runPayAsYouGoCutover(
			{ apply: true, releasedAt: null },
			world,
		);

		expect(second.rows).toEqual([]);
		expect(world.writes).toBe(writesAfterFirst);
		expect(cutoverExitCode(second)).toBe(0);
	});

	it("grants a pending slot of a canceled row one time and does not cancel the row again", async () => {
		const world = new FakeCutoverWorld();
		world.seed(subscription({ status: "canceled" }));
		world.slots.push({
			credits: 25_000,
			id: "slot_1",
			status: "pending",
			subscriptionId: "sub_local_1",
		});

		const first = await runPayAsYouGoCutover(
			{ apply: true, releasedAt: null },
			world,
		);
		const writesAfterFirst = world.writes;
		await runPayAsYouGoCutover({ apply: true, releasedAt: null }, world);

		expect(world.slots[0]?.status).toBe("granted");
		expect(world.writes).toBe(writesAfterFirst);
		expect(world.stripeCancelKeys).toEqual([]);
		expect(first.rows).toEqual([
			expect.objectContaining({
				creditsAfter: 250,
				creditsBefore: 0,
				grantedSlots: 1,
			}),
		]);
	});

	it("ends an incomplete Stripe row as incomplete_expired", async () => {
		const world = new FakeCutoverWorld();
		world.seed(subscription({ status: "incomplete" }));

		await runPayAsYouGoCutover({ apply: true, releasedAt: null }, world);

		expect(world.rows.get("sub_local_1")?.status).toBe("incomplete_expired");
	});

	it("stops before any write when a subscription webhook is not processed", async () => {
		const world = new FakeCutoverWorld();
		world.seed(subscription());
		world.blockingEvents.push({
			error: "timeout",
			id: "evt_1",
			status: "failed",
			type: "invoice.paid",
		});

		const report = await runPayAsYouGoCutover(
			{ apply: true, releasedAt: null },
			world,
		);

		expect(world.writes).toBe(0);
		expect(report.rows).toEqual([]);
		expect(cutoverExitCode(report)).toBe(1);
	});

	it("fails when Stripe says an open subscription checkout is complete", async () => {
		const world = new FakeCutoverWorld();
		world.sessionStatus = "complete";
		world.checkouts.push({
			attemptId: "attempt_1",
			sessionId: "cs_1",
			status: "open",
		});

		const report = await runPayAsYouGoCutover(
			{ apply: true, releasedAt: null },
			world,
		);

		expect(report.checkouts).toEqual([
			expect.objectContaining({ result: "complete" }),
		]);
		expect(cutoverExitCode(report)).toBe(1);
	});

	it("fails when an expire row exists after --released-at", async () => {
		const world = new FakeCutoverWorld();
		world.expireRows.push({
			createdAt: new Date("2026-11-13T09:00:00.000Z"),
			delta: -25_000,
			id: "ledger_1",
			idempotencyKey: "subdel:sub_remote_1",
			organizationId: null,
			userId: "user_1",
		});

		const report = await runPayAsYouGoCutover(
			{ apply: false, releasedAt: RELEASED_AT },
			world,
		);

		expect(report.expireRows).toHaveLength(1);
		expect(cutoverExitCode(report)).toBe(1);
	});
});
