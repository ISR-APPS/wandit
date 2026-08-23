import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
	const close = vi.fn(async () => undefined);
	const db = { $client: { end: close } };
	const approval = vi.fn();
	const attribution = vi.fn();
	const commission = vi.fn();
	const connectorRecovery = vi.fn();
	const financialReconciliation = vi.fn();
	const modelPrices = vi.fn();
	const reconciliation = vi.fn();
	const reconcileRetries = vi.fn();
	const refills = vi.fn();
	const reservations = vi.fn();
	const settledWithoutRefs = vi.fn();
	const signup = vi.fn();
	const webhookEvent = vi.fn();
	const webhookSweep = vi.fn();

	return {
		approval,
		assertDatabase: vi.fn(),
		assertFinancial: vi.fn(),
		assertMetering: vi.fn(),
		attribution,
		close,
		commission,
		connectorRecovery,
		createAffiliate: vi.fn(() => ({
			approval: { sweepEligible: approval },
			attribution: { retryLock: attribution },
			commission: { reconcilePendingAttributedCandidates: commission },
		})),
		createDb: vi.fn(() => db),
		createFinancialReconciliation: vi.fn(() => ({
			reconciliation: { sweep: financialReconciliation },
		})),
		createMetering: vi.fn(() => ({
			recoverSettledWithoutRefs: settledWithoutRefs,
			recoverUnreconciledSettled: reconciliation,
			retryFailedReconciliations: reconcileRetries,
		})),
		createMeteringRecovery: vi.fn(() => ({
			connectorRecovery: { recoverCompletionCheckpoints: connectorRecovery },
			metering: { recoverStaleReservations: reservations },
		})),
		createModelPrices: vi.fn(() => ({
			modelPricing: { refreshFromGateway: modelPrices },
		})),
		createRefills: vi.fn(() => ({ refills: { sweepDueSlots: refills } })),
		createSignup: vi.fn(() => ({ outbox: { sweep: signup } })),
		createWebhooks: vi.fn(() => ({
			retry: { retryEvent: webhookEvent, sweep: webhookSweep },
		})),
		db,
		financialReconciliation,
		info: vi.fn(),
		modelPrices,
		queue: vi.fn((definition: unknown) => definition),
		reconciliation,
		reconcileRetries,
		refills,
		reservations,
		settledWithoutRefs,
		scheduledTask: vi.fn((definition: unknown) => definition),
		schemaTask: vi.fn((definition: unknown) => definition),
		signup,
		triggerAnalytics: { capture: vi.fn() },
		webhookEvent,
		webhookSweep,
	};
});

vi.mock("@trigger.dev/sdk", () => ({
	logger: { info: mocks.info },
	queue: mocks.queue,
	schedules: { task: mocks.scheduledTask },
	schemaTask: mocks.schemaTask,
}));
vi.mock("@wandit/db", () => ({ createDb: mocks.createDb }));
vi.mock("./billing-maintenance.config", () => ({
	assertBillingDatabaseConfiguration: mocks.assertDatabase,
	assertBillingFinancialConfiguration: mocks.assertFinancial,
	assertMeteringConfiguration: mocks.assertMetering,
}));
vi.mock("./billing-maintenance.runtime", () => ({
	createAffiliateMaintenanceRuntime: mocks.createAffiliate,
	createBillingWebhookRuntime: mocks.createWebhooks,
	createFinancialReconciliationRuntime: mocks.createFinancialReconciliation,
	createModelPriceRefreshRuntime: mocks.createModelPrices,
	createSignupGrantRuntime: mocks.createSignup,
	createSubscriptionRefillRuntime: mocks.createRefills,
}));
vi.mock("./metering.runtime", () => ({
	createTriggerMetering: mocks.createMetering,
	createTriggerMeteringRecovery: mocks.createMeteringRecovery,
}));
vi.mock("./init", () => ({ triggerAnalytics: mocks.triggerAnalytics }));

import { affiliateCommissionApprovalSweepTask } from "./affiliate-approval.task";
import { affiliateAttributionRetryTask } from "./affiliate-attribution-retry.task";
import { meteringReconciliationSweepTask } from "./reconcile-metering.task";
import { strandedMeteringRecoveryTask } from "./recover-stranded-metering.task";
import { modelPriceRefreshTask } from "./refresh-model-prices.task";
import {
	billingWebhookRetryEventTask,
	billingWebhookRetrySweepTask,
} from "./retry-billing-webhooks.task";
import { subscriptionRefillSweepTask } from "./subscription-refill.task";
import { financialReconciliationSweepTask } from "./sweep-financial-reconciliation.task";
import {
	signupGrantDeliveryTask,
	signupGrantOutboxSweepTask,
} from "./sweep-signup-grants.task";

type CapturedTask = {
	cron?: { pattern: string; timezone: string };
	id: string;
	maxDuration: number;
	queue: unknown;
	retry: {
		factor?: number;
		maxAttempts: number;
		maxTimeoutInMs?: number;
		minTimeoutInMs?: number;
		randomize?: boolean;
	};
	run(
		payload: unknown,
		context: { ctx: { run: { id: string } } },
	): Promise<unknown>;
	ttl?: string;
};

const refill = subscriptionRefillSweepTask as unknown as CapturedTask;
const metering = meteringReconciliationSweepTask as unknown as CapturedTask;
const recovery = strandedMeteringRecoveryTask as unknown as CapturedTask;
const affiliate =
	affiliateCommissionApprovalSweepTask as unknown as CapturedTask;
const webhookSweep = billingWebhookRetrySweepTask as unknown as CapturedTask;
const webhookEvent = billingWebhookRetryEventTask as unknown as CapturedTask;
const signupSweep = signupGrantOutboxSweepTask as unknown as CapturedTask;
const signupDelivery = signupGrantDeliveryTask as unknown as CapturedTask;
const prices = modelPriceRefreshTask as unknown as CapturedTask;
const financial = financialReconciliationSweepTask as unknown as CapturedTask;
const attribution = affiliateAttributionRetryTask as unknown as CapturedTask;

const timestamp = new Date("2026-08-02T12:00:00.000Z");
const context = { ctx: { run: { id: "run_billing" } } };

describe("billing Trigger maintenance tasks", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.refills.mockResolvedValue({
			canceled: 0,
			failed: 0,
			granted: 2,
			skipped: 1,
		});
		mocks.reconciliation.mockResolvedValue({
			failed: 0,
			pending: 1,
			reconciled: 4,
			scanned: 5,
		});
		mocks.reconcileRetries.mockResolvedValue({
			failed: 0,
			pending: 0,
			reconciled: 1,
			scanned: 1,
		});
		mocks.settledWithoutRefs.mockResolvedValue({
			failed: 0,
			pending: 0,
			reconciled: 0,
			scanned: 0,
		});
		mocks.connectorRecovery.mockResolvedValue({
			failed: 0,
			recovered: 1,
			scanned: 1,
		});
		mocks.reservations.mockResolvedValue({
			failed: 0,
			pending: 0,
			reconciled: 1,
			refunded: 2,
			scanned: 3,
		});
		mocks.commission.mockResolvedValue(3);
		mocks.approval.mockResolvedValue({ approved: 2 });
		mocks.webhookSweep.mockResolvedValue({
			deadLettered: 1,
			failed: 0,
			retried: 2,
			skipped: 3,
		});
		mocks.webhookEvent.mockResolvedValue({
			attemptCount: 2,
			eventId: "evt_1",
			status: "processed",
		});
		mocks.signup.mockResolvedValue({ done: 2, failed: 0, healed: 0 });
		mocks.financialReconciliation.mockResolvedValue({ done: 3, failed: 0 });
		mocks.modelPrices.mockResolvedValue({
			fetched: 4,
			persisted: 4,
			refreshedAt: timestamp,
		});
		mocks.attribution.mockResolvedValue({ id: "attribution_1" });
	});

	it("declares the eight exact UTC schedules and bounded queues", () => {
		expect([
			[refill.id, refill.cron, refill.ttl],
			[financial.id, financial.cron, financial.ttl],
			[metering.id, metering.cron, metering.ttl],
			[recovery.id, recovery.cron, recovery.ttl],
			[affiliate.id, affiliate.cron, affiliate.ttl],
			[webhookSweep.id, webhookSweep.cron, webhookSweep.ttl],
			[signupSweep.id, signupSweep.cron, signupSweep.ttl],
			[prices.id, prices.cron, prices.ttl],
		]).toEqual([
			[
				"subscription-refill-sweep",
				{ pattern: "*/10 * * * *", timezone: "UTC" },
				"9m",
			],
			[
				"financial-reconciliation-outbox-sweep",
				{ pattern: "*/10 * * * *", timezone: "UTC" },
				"9m",
			],
			[
				"metering-reconciliation-sweep",
				{ pattern: "* * * * *", timezone: "UTC" },
				"50s",
			],
			[
				"metering-stranded-reservation-recovery",
				{ pattern: "*/15 * * * *", timezone: "UTC" },
				"14m",
			],
			[
				"affiliate-commission-approval-sweep",
				{ pattern: "0 4 * * *", timezone: "UTC" },
				undefined,
			],
			[
				"billing-webhook-dead-letter-retry-sweep",
				{ pattern: "*/10 * * * *", timezone: "UTC" },
				"9m",
			],
			[
				"signup-grant-outbox-sweep",
				{ pattern: "*/5 * * * *", timezone: "UTC" },
				"4m",
			],
			["model-price-refresh", { pattern: "0 * * * *", timezone: "UTC" }, "59m"],
		]);

		expect(refill.queue).toMatchObject({
			concurrencyLimit: 1,
			name: "billing-financial-maintenance",
		});
		expect(financial.queue).toBe(refill.queue);
		expect(metering.queue).toMatchObject({
			concurrencyLimit: 1,
			name: "metering-maintenance",
		});
		expect(prices.queue).toMatchObject({
			concurrencyLimit: 1,
			name: "model-pricing-maintenance",
		});
		expect(attribution.retry).toEqual({
			factor: 2,
			maxAttempts: 12,
			maxTimeoutInMs: 86_400_000,
			minTimeoutInMs: 60_000,
			randomize: false,
		});
		expect(affiliate.retry).toEqual({
			factor: 2,
			maxAttempts: 5,
			maxTimeoutInMs: 480_000,
			minTimeoutInMs: 60_000,
			randomize: false,
		});
	});

	it("runs refill and batched reconciliation without per-event fan-out", async () => {
		await expect(refill.run({ timestamp }, context)).resolves.toMatchObject({
			granted: 2,
		});
		await expect(metering.run({ timestamp }, context)).resolves.toMatchObject({
			settled: { reconciled: 4 },
		});

		expect(mocks.refills).toHaveBeenCalledWith(timestamp, 1_000);
		expect(mocks.reconciliation).toHaveBeenCalledWith(
			new Date("2026-08-02T11:59:00.000Z"),
			500,
			timestamp,
		);
		// After the settled sweep: due reconcile_failed retries, then the
		// settled-without-refs finalization pass.
		expect(mocks.reconcileRetries).toHaveBeenCalledWith(timestamp, 100);
		expect(mocks.settledWithoutRefs).toHaveBeenCalledWith(
			new Date("2026-08-02T11:30:00.000Z"),
			100,
		);
		expect(mocks.close).toHaveBeenCalledTimes(2);
	});

	it("drains the financial reconciliation outbox and fails loudly when rows stay pending", async () => {
		await expect(financial.run({ timestamp }, context)).resolves.toEqual({
			done: 3,
			failed: 0,
		});
		expect(mocks.assertFinancial).toHaveBeenCalled();
		expect(mocks.close).toHaveBeenCalledTimes(1);

		mocks.financialReconciliation.mockResolvedValueOnce({ done: 0, failed: 2 });
		await expect(financial.run({ timestamp }, context)).rejects.toThrow(
			"Financial reconciliation sweep left 2 row(s) pending",
		);
	});

	it("repairs connector checkpoints before stale reservation recovery", async () => {
		await recovery.run({ timestamp }, context);

		expect(mocks.connectorRecovery).toHaveBeenCalledOnce();
		expect(mocks.reservations).toHaveBeenCalledWith(
			new Date("2026-08-02T11:20:00.000Z"),
			100,
			timestamp,
		);
		expect(mocks.connectorRecovery.mock.invocationCallOrder[0]).toBeLessThan(
			mocks.reservations.mock.invocationCallOrder[0] ?? 0,
		);
		expect(mocks.close).toHaveBeenCalledOnce();
	});

	it("runs approval even when candidate reconciliation fails, then retries", async () => {
		const failure = new Error("candidate reconciliation unavailable");
		mocks.commission.mockRejectedValueOnce(failure);

		await expect(affiliate.run({}, context)).rejects.toBe(failure);

		expect(mocks.approval).toHaveBeenCalledOnce();
		expect(mocks.close).toHaveBeenCalledOnce();
	});

	it("runs scheduled and on-demand webhook retries through the full runtime", async () => {
		await webhookSweep.run({ timestamp }, context);
		await webhookEvent.run({ eventId: "evt_1" }, context);

		expect(mocks.webhookSweep).toHaveBeenCalledWith(timestamp);
		expect(mocks.webhookEvent).toHaveBeenCalledWith("evt_1");
		expect(mocks.createWebhooks).toHaveBeenCalledWith(
			mocks.db,
			mocks.triggerAnalytics,
		);
		expect(mocks.close).toHaveBeenCalledTimes(2);
	});

	it("runs both signup paths and leaves failures retryable", async () => {
		await expect(signupSweep.run({}, context)).resolves.toEqual({ done: 2 });
		await expect(
			signupDelivery.run({ userId: "user_1" }, context),
		).resolves.toEqual({ done: 2 });
		expect(mocks.signup).toHaveBeenNthCalledWith(1, undefined);
		expect(mocks.signup).toHaveBeenNthCalledWith(2, "user_1");

		mocks.signup.mockResolvedValueOnce({ done: 0, failed: 1 });
		await expect(signupSweep.run({}, context)).rejects.toThrow(
			"left 1 row(s) pending",
		);
		expect(mocks.close).toHaveBeenCalledTimes(3);
	});

	it("refreshes prices and executes token-scoped attribution retries", async () => {
		await prices.run({}, context);
		await attribution.run(
			{
				source: "signup_cookie",
				token: "signed-token",
				userId: "user_1",
			},
			context,
		);

		expect(mocks.modelPrices).toHaveBeenCalledOnce();
		expect(mocks.attribution).toHaveBeenCalledWith({
			source: "signup_cookie",
			token: "signed-token",
			userId: "user_1",
		});
		expect(mocks.close).toHaveBeenCalledTimes(2);
	});

	it("asserts configuration before opening a task-local database", async () => {
		const failure = new Error("DATABASE_URL is required");
		mocks.assertFinancial.mockImplementationOnce(() => {
			throw failure;
		});

		await expect(refill.run({ timestamp }, context)).rejects.toBe(failure);
		expect(mocks.createDb).not.toHaveBeenCalled();
		expect(mocks.close).not.toHaveBeenCalled();
	});
});
