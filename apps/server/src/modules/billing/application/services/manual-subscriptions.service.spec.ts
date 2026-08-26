import { ConflictException, Logger } from "@nestjs/common";
import type {
	AdminGrantManualSubscriptionInput,
	AdminRenewManualSubscriptionInput,
	ProductSettings,
} from "@wandit/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CreditOwner } from "../../../credits/domain/credit-owner";
import type { LifecycleEventsService } from "../../../lifecycle-events/application/services/lifecycle-events.service";
import { ActiveSubscriptionExistsError } from "../../domain/errors/active-subscription-exists.error";
import type { ManualSubscriptionPaymentRow } from "../../infrastructure/persistence/manual-subscription-payments.repository";
import type { ManualSubscriptionRequestRow } from "../../infrastructure/persistence/manual-subscription-requests.repository";
import type {
	AdminManualSubscriptionRow,
	SubscriptionRow,
} from "../../infrastructure/persistence/subscriptions.repository";
import { ManualSubscriptionsService } from "./manual-subscriptions.service";

const NOW = new Date("2026-08-21T12:00:00.000Z");
const PERIOD_START = new Date("2026-08-01T00:00:00.000Z");
const PERIOD_END = new Date("2027-08-01T00:00:00.000Z");
const SUBSCRIPTION_ID = "11111111-1111-4111-8111-111111111111";
const REQUEST_ID = "22222222-2222-4222-8222-222222222222";
const PAYMENT_ID = "33333333-3333-4333-8333-333333333333";
const IDEMPOTENCY_KEY = "44444444-4444-4444-8444-444444444444";
const TRANSACTION = { transaction: true };

const USER = {
	email: "owner@example.com",
	id: "user_1",
	image: null,
	name: "Owner",
};

function productSettings(
	overrides: Partial<ProductSettings> = {},
): ProductSettings {
	return {
		emailAuthEnabled: false,
		id: 1,
		lifecycleEmailsEnabled: false,
		manualGraceDays: 0,
		manualPaymentsEnabled: true,
		organizationsEnabled: false,
		paidSubscriptionsEnabled: true,
		signupGrantCredits: 5000,
		signupGrantEnabled: false,
		topupsEnabled: true,
		updatedAt: NOW.toISOString(),
		updatedByUserId: null,
		version: 1,
		...overrides,
	};
}

function subscription(
	overrides: Partial<SubscriptionRow> = {},
): SubscriptionRow {
	return {
		cancelAtPeriodEnd: false,
		createdAt: PERIOD_START,
		currentPeriodEnd: PERIOD_END,
		currentPeriodStart: PERIOD_START,
		id: SUBSCRIPTION_ID,
		interval: "year",
		organizationId: null,
		pendingAppliedBy: null,
		pendingTierCredits: null,
		plan: "pro",
		priceLookupKey: "pro_250_year",
		provider: "manual",
		providerSubscriptionId: `manual_${IDEMPOTENCY_KEY}`,
		status: "active",
		tierCredits: 250,
		updatedAt: PERIOD_START,
		userId: USER.id,
		...overrides,
	};
}

function request(
	overrides: Partial<ManualSubscriptionRequestRow> = {},
): ManualSubscriptionRequestRow {
	return {
		adminNotes: "Called once",
		city: "Algiers",
		company: null,
		country: "DZ",
		createdAt: PERIOD_START,
		fullName: "Owner",
		handledAt: null,
		handledByUserId: null,
		id: REQUEST_ID,
		interval: "year",
		notes: null,
		organizationId: null,
		phone: "+213555000000",
		plan: "pro",
		preferredPaymentMethod: "bank_transfer",
		status: "pending",
		subscriptionId: null,
		tierCredits: 250,
		updatedAt: PERIOD_START,
		userId: USER.id,
		...overrides,
	};
}

function grantInput(
	overrides: Partial<AdminGrantManualSubscriptionInput> = {},
): AdminGrantManualSubscriptionInput {
	return {
		adminNotes: "Payment confirmed",
		idempotencyKey: IDEMPOTENCY_KEY,
		interval: "year",
		payment: {
			amountMinor: 250_000,
			currency: "DZD",
			method: "bank_transfer",
			reference: "CCP-42",
		},
		periodEnd: PERIOD_END.toISOString(),
		periodStart: PERIOD_START.toISOString(),
		plan: "pro",
		requestId: REQUEST_ID,
		tierCredits: 250,
		userId: USER.id,
		...overrides,
	};
}

function renewalInput(
	overrides: Partial<AdminRenewManualSubscriptionInput> = {},
): AdminRenewManualSubscriptionInput {
	return {
		idempotencyKey: "55555555-5555-4555-8555-555555555555",
		payment: {
			amountMinor: 30_000,
			currency: "DZD",
			method: "cash_on_delivery",
		},
		...overrides,
	};
}

function createContext(
	seed: SubscriptionRow[] = [],
	settingsOverrides: Partial<ProductSettings> = {},
) {
	const subscriptions = new Map(seed.map((row) => [row.id, row]));
	const requests = new Map<string, ManualSubscriptionRequestRow>([
		[REQUEST_ID, request()],
	]);
	const payments: ManualSubscriptionPaymentRow[] = [];
	const creditGrants: unknown[][] = [];
	let subscriptionSequence = subscriptions.size;
	let paymentSequence = 0;

	const subscriptionsRepository = {
		countManualActive: vi.fn(async (_now: Date) => 12),
		countManualExpiringBetween: vi.fn(async (_from: Date, _until: Date) => 2),
		findActiveByOwner: vi.fn(
			async (owner: CreditOwner): Promise<SubscriptionRow | null> =>
				[...subscriptions.values()].find(
					(row) =>
						ownerMatches(row, owner) &&
						row.status !== "canceled" &&
						row.status !== "incomplete_expired",
				) ?? null,
		),
		findById: vi.fn(
			async (id: string): Promise<SubscriptionRow | null> =>
				subscriptions.get(id) ?? null,
		),
		findByProviderSubscriptionId: vi.fn(
			async (providerId: string): Promise<SubscriptionRow | null> =>
				[...subscriptions.values()].find(
					(row) => row.providerSubscriptionId === providerId,
				) ?? null,
		),
		findManualAdminById: vi.fn(async (id: string) => {
			const row = subscriptions.get(id);

			return row?.provider === "manual"
				? {
						lastPaymentAt:
							payments.find((payment) => payment.subscriptionId === id)
								?.createdAt ?? null,
						organization: null,
						paymentsCount: payments.filter(
							(payment) => payment.subscriptionId === id,
						).length,
						subscription: row,
						user: USER,
					}
				: null;
		}),
		findManualBillingOwner: vi.fn(async () => ({
			organization: null,
			user: USER,
		})),
		insertManual: vi.fn(
			async (
				input: Omit<
					SubscriptionRow,
					| "id"
					| "createdAt"
					| "pendingAppliedBy"
					| "pendingTierCredits"
					| "provider"
					| "updatedAt"
				>,
			) => {
				subscriptionSequence += 1;
				const row = subscription({
					...input,
					id:
						subscriptionSequence === 1
							? SUBSCRIPTION_ID
							: `11111111-1111-4111-8111-${String(subscriptionSequence).padStart(12, "0")}`,
					provider: "manual",
				});
				subscriptions.set(row.id, row);

				return row;
			},
		),
		listManualDueForExpiry: vi.fn(
			async (_now: Date, _limit: number) => [] as SubscriptionRow[],
		),
		listManualForAdmin: vi.fn(
			async (_query: unknown, _entitlementCutoff: Date) => ({
				items: [] as AdminManualSubscriptionRow[],
				page: 1,
				pageSize: 20,
				total: 0,
			}),
		),
		updatePeriod: vi.fn(
			async (
				id: string,
				input: Pick<
					SubscriptionRow,
					| "cancelAtPeriodEnd"
					| "currentPeriodEnd"
					| "currentPeriodStart"
					| "status"
				>,
			): Promise<SubscriptionRow | null> => {
				const current = subscriptions.get(id);

				if (!current) {
					return null;
				}

				const updated = { ...current, ...input, updatedAt: NOW };
				subscriptions.set(id, updated);

				return updated;
			},
		),
	};
	const subscriptionCreditsRepository = {
		cancelPendingSlotsForSubscription: vi.fn(async () => 1),
		findCanonicalEntitledByOwner: vi.fn(
			async (owner: CreditOwner): Promise<SubscriptionRow | null> =>
				[...subscriptions.values()].find(
					(row) =>
						ownerMatches(row, owner) &&
						(row.status === "active" || row.status === "trialing"),
				) ?? null,
		),
		insertRefillSlots: vi.fn(async () => []),
		withOwnerLock: vi.fn(
			async <T>(
				_owner: CreditOwner,
				fn: (transaction: typeof TRANSACTION) => Promise<T>,
			): Promise<T> => {
				const subscriptionSnapshot = new Map(subscriptions);
				const requestSnapshot = new Map(requests);
				const paymentSnapshot = [...payments];
				const grantCount = creditGrants.length;

				try {
					return await fn(TRANSACTION);
				} catch (error) {
					subscriptions.clear();
					for (const [id, row] of subscriptionSnapshot) {
						subscriptions.set(id, row);
					}
					requests.clear();
					for (const [id, row] of requestSnapshot) {
						requests.set(id, row);
					}
					payments.splice(0, payments.length, ...paymentSnapshot);
					creditGrants.splice(grantCount);

					throw error;
				}
			},
		),
	};
	const creditsService = {
		applyCappedRefill: vi.fn(async () => ({})),
		expirePlanRemainder: vi.fn(async () => 0),
		grant: vi.fn(async (...args: unknown[]) => {
			creditGrants.push(args);

			return {};
		}),
	};
	const subscriptionRefillService = {
		createYearlySlots: vi.fn(async () => 11),
	};
	const paymentsRepository = {
		sumByCurrencyBetween: vi.fn(async (from: Date) =>
			from.getUTCMonth() === NOW.getUTCMonth()
				? [{ amountMinor: 480_000_00, currency: "DZD", payments: 4 }]
				: [{ amountMinor: 120_000_00, currency: "DZD", payments: 1 }],
		),
		findByIdempotencyKey: vi.fn(
			async (key: string): Promise<ManualSubscriptionPaymentRow | null> =>
				payments.find((payment) => payment.idempotencyKey === key) ?? null,
		),
		insert: vi.fn(
			async (input: Omit<ManualSubscriptionPaymentRow, "id" | "createdAt">) => {
				const replay = payments.find(
					(payment) => payment.idempotencyKey === input.idempotencyKey,
				);

				if (replay) {
					return replay;
				}

				paymentSequence += 1;
				const row: ManualSubscriptionPaymentRow = {
					...input,
					createdAt: NOW,
					id:
						paymentSequence === 1
							? PAYMENT_ID
							: `33333333-3333-4333-8333-${String(paymentSequence).padStart(12, "0")}`,
				};
				payments.push(row);

				return row;
			},
		),
		listBySubscription: vi.fn(async (id: string) =>
			payments
				.filter((payment) => payment.subscriptionId === id)
				.map((payment) => ({ payment, recordedBy: USER })),
		),
	};
	const requestsRepository = {
		countOpen: vi.fn(async () => 3),
		findAdminById: vi.fn(),
		findOpenByOwner: vi.fn(
			async (): Promise<ManualSubscriptionRequestRow | null> =>
				[...requests.values()].find(
					(row) => row.status === "pending" || row.status === "contacted",
				) ?? null,
		),
		findById: vi.fn(
			async (id: string): Promise<ManualSubscriptionRequestRow | null> =>
				requests.get(id) ?? null,
		),
		findBySubscriptionId: vi.fn(
			async (id: string): Promise<ManualSubscriptionRequestRow | null> =>
				[...requests.values()].find((row) => row.subscriptionId === id) ?? null,
		),
		listForAdmin: vi.fn(),
		update: vi.fn(
			async (
				id: string,
				input: Partial<ManualSubscriptionRequestRow>,
			): Promise<ManualSubscriptionRequestRow | null> => {
				const current = requests.get(id);

				if (!current) {
					return null;
				}

				const updated = { ...current, ...input, updatedAt: NOW };
				requests.set(id, updated);

				return updated;
			},
		),
		updateIfNotTerminal: vi.fn(
			async (
				id: string,
				input: Partial<ManualSubscriptionRequestRow>,
			): Promise<ManualSubscriptionRequestRow | null> => {
				const current = requests.get(id);

				if (
					!current ||
					current.status === "approved" ||
					current.status === "canceled"
				) {
					return null;
				}

				const updated = { ...current, ...input, updatedAt: NOW };
				requests.set(id, updated);

				return updated;
			},
		),
	};
	const stateEventsRepository = { tryInsert: vi.fn(async () => true) };
	const checkoutAttemptsRepository = {
		findOpenForOwner: vi.fn(async () => [] as unknown[]),
	};
	const productSettingsService = {
		get: vi.fn(async () => productSettings(settingsOverrides)),
	};
	const analyticsService = { capture: vi.fn() };
	const lifecycleEvents = { enqueue: vi.fn(async () => null) };
	const service = new ManualSubscriptionsService(
		subscriptionsRepository as never,
		subscriptionCreditsRepository as never,
		creditsService as never,
		subscriptionRefillService as never,
		paymentsRepository as never,
		requestsRepository as never,
		stateEventsRepository as never,
		checkoutAttemptsRepository as never,
		productSettingsService as never,
		lifecycleEvents as unknown as LifecycleEventsService,
		analyticsService as never,
	);

	return {
		analyticsService,
		checkoutAttemptsRepository,
		creditGrants,
		creditsService,
		lifecycleEvents,
		payments,
		paymentsRepository,
		productSettingsService,
		requests,
		requestsRepository,
		service,
		stateEventsRepository,
		subscriptionCreditsRepository,
		subscriptionRefillService,
		subscriptions,
		subscriptionsRepository,
	};
}

describe("ManualSubscriptionsService", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(NOW);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("grants credits, yearly slots, approves the request, and replays safely", async () => {
		const context = createContext();
		const input = grantInput();

		await expect(
			context.service.grant("admin_1", input),
		).resolves.toMatchObject({
			id: SUBSCRIPTION_ID,
			provider: "manual",
			status: "active",
		});

		expect(context.creditsService.grant).toHaveBeenCalledWith(
			{ type: "user", userId: USER.id },
			25_000,
			expect.objectContaining({
				bucket: "plan",
				idempotencyKey: `manual:${SUBSCRIPTION_ID}:initial`,
			}),
			TRANSACTION,
		);
		expect(
			context.subscriptionRefillService.createYearlySlots,
		).toHaveBeenCalledWith(
			expect.objectContaining({
				credits: 25_000,
				funding: {
					chargeId: null,
					invoiceId: `manual:${PAYMENT_ID}`,
					paymentIntentId: null,
				},
			}),
			TRANSACTION,
		);
		expect(context.requests.get(REQUEST_ID)).toMatchObject({
			adminNotes: "Called once\nPayment confirmed",
			handledByUserId: "admin_1",
			status: "approved",
			subscriptionId: SUBSCRIPTION_ID,
		});
		expect(context.analyticsService.capture).toHaveBeenCalledWith(
			USER.id,
			"subscription_started",
			{ plan: "pro", provider: "manual" },
		);
		expect(context.lifecycleEvents.enqueue).toHaveBeenCalledWith(
			{
				event: "payment_completed",
				idempotencyKey: `payment_completed:${USER.id}`,
				payload: { interval: "year" },
				userId: USER.id,
			},
			TRANSACTION,
		);

		await context.service.grant("admin_1", input);

		expect(context.subscriptionsRepository.insertManual).toHaveBeenCalledOnce();
		expect(context.paymentsRepository.insert).toHaveBeenCalledOnce();
		expect(context.creditsService.grant).toHaveBeenCalledOnce();
		expect(context.lifecycleEvents.enqueue).toHaveBeenCalledOnce();
		expect(context.analyticsService.capture).toHaveBeenCalledOnce();
	});

	it("captures a monthly manual payment inside the owner transaction", async () => {
		const context = createContext();

		await context.service.grant("admin_1", grantInput({ interval: "month" }));

		expect(context.lifecycleEvents.enqueue).toHaveBeenCalledWith(
			expect.objectContaining({
				idempotencyKey: `payment_completed:${USER.id}`,
				payload: { interval: "month" },
			}),
			TRANSACTION,
		);
		expect(
			context.subscriptionRefillService.createYearlySlots,
		).not.toHaveBeenCalled();
	});

	it("propagates manual payment lifecycle capture failures", async () => {
		const context = createContext();
		context.lifecycleEvents.enqueue.mockRejectedValueOnce(
			new Error("outbox unavailable"),
		);

		await expect(
			context.service.grant("admin_1", grantInput()),
		).rejects.toThrow("outbox unavailable");
		expect(
			context.subscriptionRefillService.createYearlySlots,
		).not.toHaveBeenCalled();
		expect(context.analyticsService.capture).not.toHaveBeenCalled();
		expect(context.creditGrants).toHaveLength(0);
		expect(context.payments).toHaveLength(0);
		expect(context.subscriptions.size).toBe(0);
		expect(context.requests.get(REQUEST_ID)).toMatchObject({
			status: "pending",
			subscriptionId: null,
		});
	});

	it("rejects a grant when the owner already has a live subscription", async () => {
		const context = createContext([
			subscription({
				id: "66666666-6666-4666-8666-666666666666",
				provider: "stripe",
				providerSubscriptionId: "sub_live",
			}),
		]);

		await expect(
			context.service.grant("admin_1", grantInput()),
		).rejects.toBeInstanceOf(ActiveSubscriptionExistsError);
		expect(context.subscriptionsRepository.insertManual).not.toHaveBeenCalled();
		expect(context.creditsService.grant).not.toHaveBeenCalled();
	});

	it("rejects a grant while a Stripe subscription checkout is open", async () => {
		const context = createContext();
		context.checkoutAttemptsRepository.findOpenForOwner.mockResolvedValueOnce([
			{ id: "attempt_1" },
		]);

		await expect(
			context.service.grant("admin_1", grantInput()),
		).rejects.toMatchObject({
			response: { code: "BILLING_CHECKOUT_PENDING" },
			status: 409,
		});
		expect(context.subscriptionsRepository.insertManual).not.toHaveBeenCalled();
		expect(context.creditsService.grant).not.toHaveBeenCalled();
	});

	it("aggregates grace-aware offline stats on UTC month boundaries", async () => {
		const context = createContext([], { manualGraceDays: 3 });
		const now = new Date("2026-08-21T18:00:00.000Z");
		context.subscriptionsRepository.countManualExpiringBetween
			.mockResolvedValueOnce(2)
			.mockResolvedValueOnce(4);

		const stats = await context.service.getStats(now);

		expect(stats).toEqual({
			activeSubscriptions: 12,
			collectedPreviousMonth: [
				{ amountMinor: 120_000_00, currency: "DZD", payments: 1 },
			],
			collectedThisMonth: [
				{ amountMinor: 480_000_00, currency: "DZD", payments: 4 },
			],
			expiringWithin7Days: 2,
			inGrace: 4,
			openRequests: 3,
		});
		expect(
			context.paymentsRepository.sumByCurrencyBetween,
		).toHaveBeenCalledWith(
			new Date("2026-08-01T00:00:00.000Z"),
			new Date("2026-09-01T00:00:00.000Z"),
		);
		expect(
			context.paymentsRepository.sumByCurrencyBetween,
		).toHaveBeenCalledWith(
			new Date("2026-07-01T00:00:00.000Z"),
			new Date("2026-08-01T00:00:00.000Z"),
		);
		expect(
			context.subscriptionsRepository.countManualActive,
		).toHaveBeenCalledWith(new Date("2026-08-18T18:00:00.000Z"));
		expect(
			context.subscriptionsRepository.countManualExpiringBetween,
		).toHaveBeenCalledWith(
			new Date("2026-08-18T18:00:00.000Z"),
			new Date("2026-08-25T18:00:00.000Z"),
		);
		expect(
			context.subscriptionsRepository.countManualExpiringBetween,
		).toHaveBeenCalledWith(new Date("2026-08-18T18:00:00.000Z"), now);
		expect(context.productSettingsService.get).toHaveBeenCalledOnce();
	});

	it("maps grace state and effective access end for admin subscriptions", async () => {
		const gracePeriodEnd = new Date(NOW.getTime() - 24 * 60 * 60 * 1000);
		const inGrace = createContext(
			[subscription({ currentPeriodEnd: gracePeriodEnd })],
			{ manualGraceDays: 3 },
		);

		await expect(
			inGrace.service.getSubscription(SUBSCRIPTION_ID),
		).resolves.toMatchObject({
			accessEndsAt: new Date(
				gracePeriodEnd.getTime() + 3 * 24 * 60 * 60 * 1000,
			).toISOString(),
			entitled: true,
			inGrace: true,
		});
		expect(inGrace.productSettingsService.get).toHaveBeenCalledOnce();

		const strict = createContext([
			subscription({ currentPeriodEnd: gracePeriodEnd }),
		]);

		await expect(
			strict.service.getSubscription(SUBSCRIPTION_ID),
		).resolves.toMatchObject({
			accessEndsAt: gracePeriodEnd.toISOString(),
			entitled: false,
			inGrace: false,
		});
	});

	it("keeps in-grace subscriptions in the active admin list", async () => {
		const gracePeriodEnd = new Date(NOW.getTime() - 24 * 60 * 60 * 1000);
		const row = subscription({ currentPeriodEnd: gracePeriodEnd });
		const context = createContext([], { manualGraceDays: 3 });
		context.subscriptionsRepository.listManualForAdmin.mockResolvedValueOnce({
			items: [
				{
					lastPaymentAt: null,
					organization: null,
					paymentsCount: 0,
					subscription: row,
					user: USER,
				},
			],
			page: 1,
			pageSize: 20,
			total: 1,
		});
		const query = { page: 1, pageSize: 20, status: "active" as const };

		await expect(
			context.service.listSubscriptions(query),
		).resolves.toMatchObject({
			items: [
				{
					accessEndsAt: new Date(
						gracePeriodEnd.getTime() + 3 * 24 * 60 * 60 * 1000,
					).toISOString(),
					entitled: true,
					inGrace: true,
				},
			],
		});
		expect(
			context.subscriptionsRepository.listManualForAdmin,
		).toHaveBeenCalledWith(query, new Date("2026-08-18T12:00:00.000Z"));
		expect(context.productSettingsService.get).toHaveBeenCalledOnce();
	});

	it("refuses to fund a grant from a canceled request", async () => {
		const context = createContext();
		context.requests.set(REQUEST_ID, request({ status: "canceled" }));

		await expect(
			context.service.grant("admin_1", grantInput()),
		).rejects.toMatchObject({ status: 409 });
		expect(context.subscriptionsRepository.insertManual).not.toHaveBeenCalled();
	});

	it("auto-links the owner's open request when no requestId is given", async () => {
		const context = createContext();

		await context.service.grant(
			"admin_1",
			grantInput({ requestId: undefined }),
		);

		expect(context.requestsRepository.update).toHaveBeenCalledWith(
			REQUEST_ID,
			expect.objectContaining({
				status: "approved",
				handledByUserId: "admin_1",
			}),
			TRANSACTION,
		);
	});

	it("auto-links a MATCHING open renewal request when none is passed", async () => {
		const currentEnd = new Date("2026-09-01T00:00:00.000Z");
		const context = createContext([
			subscription({
				currentPeriodEnd: currentEnd,
				interval: "month",
				priceLookupKey: "pro_250_month",
			}),
		]);
		context.requests.set(
			REQUEST_ID,
			request({ interval: "month", plan: "pro", tierCredits: 250 }),
		);

		await context.service.renew("admin_1", SUBSCRIPTION_ID, renewalInput());

		expect(context.requestsRepository.update).toHaveBeenCalledWith(
			REQUEST_ID,
			expect.objectContaining({ status: "approved" }),
			TRANSACTION,
		);
	});

	it("leaves a MISMATCHED open change request untouched on a direct renewal", async () => {
		const currentEnd = new Date("2026-09-01T00:00:00.000Z");
		const context = createContext([
			subscription({
				currentPeriodEnd: currentEnd,
				interval: "month",
				priceLookupKey: "pro_250_month",
			}),
		]);
		context.requests.set(
			REQUEST_ID,
			request({ interval: "month", plan: "pro", tierCredits: 500 }),
		);

		await context.service.renew("admin_1", SUBSCRIPTION_ID, renewalInput());

		expect(context.requestsRepository.update).not.toHaveBeenCalled();
	});

	it("refuses a renewal of an ended subscription while a Stripe checkout is open", async () => {
		const context = createContext([
			subscription({
				currentPeriodEnd: new Date("2026-08-01T00:00:00.000Z"),
				status: "canceled",
			}),
		]);
		context.checkoutAttemptsRepository.findOpenForOwner.mockResolvedValueOnce([
			{ id: "attempt_1" },
		]);

		await expect(
			context.service.renew("admin_1", SUBSCRIPTION_ID, renewalInput()),
		).rejects.toMatchObject({
			response: { code: "BILLING_CHECKOUT_PENDING" },
			status: 409,
		});
		expect(context.creditsService.applyCappedRefill).not.toHaveBeenCalled();
	});

	it("does not reopen a request that becomes terminal during an admin update", async () => {
		const context = createContext();
		context.requestsRepository.updateIfNotTerminal.mockImplementationOnce(
			async () => {
				context.requests.set(REQUEST_ID, request({ status: "canceled" }));

				return null;
			},
		);

		await expect(
			context.service.updateRequest("admin_1", REQUEST_ID, {
				status: "contacted",
			}),
		).rejects.toBeInstanceOf(ConflictException);
		expect(context.requests.get(REQUEST_ID)?.status).toBe("canceled");
	});

	it("extends an active subscription and schedules its refill at the boundary", async () => {
		const currentEnd = new Date("2026-09-01T00:00:00.000Z");
		const context = createContext([
			subscription({
				currentPeriodEnd: currentEnd,
				interval: "month",
				priceLookupKey: "pro_250_month",
			}),
		]);

		await context.service.renew("admin_1", SUBSCRIPTION_ID, renewalInput());

		expect(context.subscriptionsRepository.updatePeriod).toHaveBeenCalledWith(
			SUBSCRIPTION_ID,
			expect.objectContaining({
				currentPeriodEnd: new Date("2026-10-01T00:00:00.000Z"),
				currentPeriodStart: PERIOD_START,
				status: "active",
			}),
			TRANSACTION,
		);
		expect(
			context.subscriptionCreditsRepository.insertRefillSlots,
		).toHaveBeenCalledWith(
			[
				expect.objectContaining({
					credits: 25_000,
					dueAt: currentEnd,
					fundingInvoiceId: `manual:${PAYMENT_ID}:cycle`,
					periodOrdinal: 2,
				}),
			],
			TRANSACTION,
		);
		expect(context.creditsService.applyCappedRefill).not.toHaveBeenCalled();
		expect(context.creditsService.grant).not.toHaveBeenCalled();
	});

	it("approves and links the open request on a renewal", async () => {
		const currentEnd = new Date("2026-09-01T00:00:00.000Z");
		const context = createContext([
			subscription({
				currentPeriodEnd: currentEnd,
				interval: "month",
				priceLookupKey: "pro_250_month",
			}),
		]);

		await context.service.renew(
			"admin_1",
			SUBSCRIPTION_ID,
			renewalInput({ requestId: REQUEST_ID }),
		);

		expect(context.requestsRepository.update).toHaveBeenCalledWith(
			REQUEST_ID,
			expect.objectContaining({
				handledByUserId: "admin_1",
				status: "approved",
				subscriptionId: SUBSCRIPTION_ID,
			}),
			TRANSACTION,
		);
		expect(context.paymentsRepository.insert).toHaveBeenCalledWith(
			expect.objectContaining({ kind: "renewal", requestId: REQUEST_ID }),
			TRANSACTION,
		);
	});

	it("reactivates an ended subscription with one immediate capped refill", async () => {
		const context = createContext([
			subscription({
				currentPeriodEnd: new Date("2026-07-01T00:00:00.000Z"),
				interval: "month",
				priceLookupKey: "pro_250_month",
				status: "canceled",
			}),
		]);

		await context.service.renew("admin_1", SUBSCRIPTION_ID, renewalInput());

		expect(context.subscriptionsRepository.updatePeriod).toHaveBeenCalledWith(
			SUBSCRIPTION_ID,
			expect.objectContaining({
				currentPeriodEnd: new Date("2026-09-21T12:00:00.000Z"),
				currentPeriodStart: NOW,
				status: "active",
			}),
			TRANSACTION,
		);
		expect(context.creditsService.applyCappedRefill).toHaveBeenCalledWith(
			{ type: "user", userId: USER.id },
			25_000,
			expect.objectContaining({
				capMultiplier: 1,
				idempotencyKey: `manual:${SUBSCRIPTION_ID}:renewal:${PAYMENT_ID}`,
			}),
			TRANSACTION,
		);
		expect(
			context.subscriptionCreditsRepository.cancelPendingSlotsForSubscription,
		).toHaveBeenCalledWith(
			SUBSCRIPTION_ID,
			{ reason: "replaced" },
			TRANSACTION,
		);
		expect(context.stateEventsRepository.tryInsert).toHaveBeenCalledWith(
			expect.objectContaining({
				fromStatus: "canceled",
				kind: "status_changed",
				stripeEventId: `manual:${SUBSCRIPTION_ID}:renewed:${PAYMENT_ID}`,
				toStatus: "active",
			}),
			TRANSACTION,
		);
	});

	it("cancels stale annual slots before renewing a period-passed active row", async () => {
		const context = createContext([
			subscription({
				currentPeriodEnd: new Date("2026-07-01T00:00:00.000Z"),
				status: "active",
			}),
		]);

		await context.service.renew("admin_1", SUBSCRIPTION_ID, renewalInput());

		expect(
			context.subscriptionCreditsRepository.cancelPendingSlotsForSubscription,
		).toHaveBeenCalledWith(
			SUBSCRIPTION_ID,
			{ reason: "replaced" },
			TRANSACTION,
		);
		expect(
			context.subscriptionCreditsRepository.cancelPendingSlotsForSubscription
				.mock.invocationCallOrder[0],
		).toBeLessThan(
			context.creditsService.applyCappedRefill.mock.invocationCallOrder[0] ?? 0,
		);
		expect(
			context.subscriptionRefillService.createYearlySlots,
		).toHaveBeenCalledOnce();
	});

	it("ends a subscription and expires plan credits only without another entitlement", async () => {
		const context = createContext([subscription()]);

		await context.service.end("admin_1", SUBSCRIPTION_ID, {
			reason: "payment reversed",
		});

		expect(
			context.subscriptionCreditsRepository.cancelPendingSlotsForSubscription,
		).toHaveBeenCalledWith(SUBSCRIPTION_ID, { reason: "ended" }, TRANSACTION);
		expect(context.creditsService.expirePlanRemainder).toHaveBeenCalledWith(
			{ type: "user", userId: USER.id },
			expect.objectContaining({
				idempotencyKey: `manual:${SUBSCRIPTION_ID}:expire:${PERIOD_START.getTime()}:${PERIOD_END.getTime()}`,
				meta: expect.objectContaining({ reason: "payment reversed" }),
			}),
			TRANSACTION,
		);

		const other = subscription({
			id: "77777777-7777-4777-8777-777777777777",
			providerSubscriptionId: "manual_other",
		});
		const withOther = createContext([subscription(), other]);

		await withOther.service.end("admin_1", SUBSCRIPTION_ID, {});

		expect(withOther.creditsService.expirePlanRemainder).not.toHaveBeenCalled();
	});

	it("derives the end idempotency key from the period re-read under the lock", async () => {
		const oldPeriod = subscription({
			currentPeriodEnd: new Date("2026-09-01T00:00:00.000Z"),
		});
		const renewedPeriod = {
			...oldPeriod,
			currentPeriodEnd: new Date("2026-10-01T00:00:00.000Z"),
		};
		const context = createContext([oldPeriod]);
		context.subscriptionsRepository.findById
			.mockResolvedValueOnce(oldPeriod)
			.mockResolvedValueOnce(oldPeriod)
			.mockResolvedValueOnce(renewedPeriod);

		await context.service.end("admin_1", SUBSCRIPTION_ID, {});

		expect(context.creditsService.expirePlanRemainder).toHaveBeenCalledWith(
			{ type: "user", userId: USER.id },
			expect.objectContaining({
				idempotencyKey: `manual:${SUBSCRIPTION_ID}:expire:${renewedPeriod.currentPeriodStart.getTime()}:${renewedPeriod.currentPeriodEnd.getTime()}`,
			}),
			TRANSACTION,
		);
		expect(context.stateEventsRepository.tryInsert).toHaveBeenCalledWith(
			expect.objectContaining({
				stripeEventId: `manual:${SUBSCRIPTION_ID}:ended:${renewedPeriod.currentPeriodStart.getTime()}:${renewedPeriod.currentPeriodEnd.getTime()}`,
			}),
			TRANSACTION,
		);
	});

	it("isolates expiry failures and skips a concurrently extended period", async () => {
		const loggerError = vi
			.spyOn(Logger.prototype, "error")
			.mockImplementation(() => undefined);
		const due = subscription({
			currentPeriodEnd: new Date("2026-08-20T00:00:00.000Z"),
			id: "88888888-8888-4888-8888-888888888888",
			providerSubscriptionId: "manual_due",
		});
		const extendedCandidate = subscription({
			currentPeriodEnd: new Date("2026-08-20T01:00:00.000Z"),
			id: "99999999-9999-4999-8999-999999999999",
			providerSubscriptionId: "manual_extended",
		});
		const failed = subscription({
			currentPeriodEnd: new Date("2026-08-20T02:00:00.000Z"),
			id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
			providerSubscriptionId: "manual_failed",
		});
		const context = createContext([due, extendedCandidate, failed]);
		context.subscriptionsRepository.listManualDueForExpiry.mockResolvedValue([
			due,
			extendedCandidate,
			failed,
		]);
		const calls = new Map<string, number>();
		context.subscriptionsRepository.findById.mockImplementation(
			async (id: string) => {
				const count = (calls.get(id) ?? 0) + 1;
				calls.set(id, count);

				if (id === extendedCandidate.id && count >= 2) {
					return {
						...extendedCandidate,
						currentPeriodEnd: new Date("2026-09-20T01:00:00.000Z"),
					};
				}

				if (id === failed.id && count >= 2) {
					throw new Error("database unavailable");
				}

				return context.subscriptions.get(id) ?? null;
			},
		);

		await expect(context.service.expireDue(NOW, 500)).resolves.toEqual({
			ended: 1,
			failed: 1,
			skipped: 1,
		});
		expect(
			context.subscriptionsRepository.listManualDueForExpiry,
		).toHaveBeenCalledWith(NOW, 500);
		expect(context.subscriptions.get(extendedCandidate.id)?.status).toBe(
			"active",
		);
		expect(loggerError).toHaveBeenCalledOnce();
		loggerError.mockRestore();
	});

	it("expires only subscriptions beyond the configured grace period", async () => {
		const oneDayPast = subscription({
			currentPeriodEnd: new Date(NOW.getTime() - 24 * 60 * 60 * 1000),
			id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
			providerSubscriptionId: "manual_one_day_past",
		});
		const fourDaysPast = subscription({
			currentPeriodEnd: new Date(NOW.getTime() - 4 * 24 * 60 * 60 * 1000),
			id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
			providerSubscriptionId: "manual_four_days_past",
		});
		const context = createContext([oneDayPast, fourDaysPast], {
			manualGraceDays: 3,
		});
		context.subscriptionsRepository.listManualDueForExpiry.mockImplementation(
			async (cutoff: Date) =>
				[...context.subscriptions.values()].filter(
					(row) => row.currentPeriodEnd.getTime() <= cutoff.getTime(),
				),
		);

		await expect(context.service.expireDue(NOW, 200)).resolves.toEqual({
			ended: 1,
			failed: 0,
			skipped: 0,
		});
		expect(
			context.subscriptionsRepository.listManualDueForExpiry,
		).toHaveBeenCalledWith(new Date("2026-08-18T12:00:00.000Z"), 200);
		expect(context.subscriptions.get(oneDayPast.id)?.status).toBe("active");
		expect(context.subscriptions.get(fourDaysPast.id)?.status).toBe("canceled");
	});
});

function ownerMatches(row: SubscriptionRow, owner: CreditOwner): boolean {
	return owner.type === "user"
		? row.userId === owner.userId && row.organizationId === null
		: row.organizationId === owner.organizationId;
}
