import {
	BadRequestException,
	ConflictException,
	Inject,
	Injectable,
	Logger,
	NotFoundException,
	Optional,
} from "@nestjs/common";
import {
	type AdminEndManualSubscriptionInput,
	type AdminGrantManualSubscriptionInput,
	type AdminListManualRequestsQuery,
	type AdminListManualRequestsResponse,
	type AdminListManualSubscriptionsQuery,
	type AdminListManualSubscriptionsResponse,
	type AdminManualBillingStats,
	type AdminManualPayment,
	type AdminManualRequest,
	type AdminManualSubscription,
	type AdminManualSubscriptionDetail,
	type AdminRenewManualSubscriptionInput,
	type AdminUpdateManualRequestBody,
	addBillingInterval,
	ENTITLED_SUBSCRIPTION_STATUSES,
	type ManualSubscriptionRequest,
	OPEN_MANUAL_REQUEST_STATUSES,
	type ProductSettings,
	priceLookupKey,
} from "@wandit/contracts";

import { AnalyticsService } from "../../../../infrastructure/analytics/analytics.service";
import { CreditsService } from "../../../credits/application/services/credits.service";
import {
	type CreditOwner,
	orgOwner,
	ownerFromIds,
	userOwner,
} from "../../../credits/domain/credit-owner";
import { ProductSettingsService } from "../../../settings/application/services/product-settings.service";
import { ActiveSubscriptionExistsError } from "../../domain/errors/active-subscription-exists.error";
import { ManualSubscriptionUnsupportedError } from "../../domain/errors/manual-billing.errors";
import { BillingCheckoutAttemptsRepository } from "../../infrastructure/persistence/billing-checkout-attempts.repository";
import {
	type ManualSubscriptionPaymentAdminRow,
	type ManualSubscriptionPaymentRow,
	ManualSubscriptionPaymentsRepository,
} from "../../infrastructure/persistence/manual-subscription-payments.repository";
import {
	type AdminManualRequestRow,
	type ManualSubscriptionRequestRow,
	ManualSubscriptionRequestsRepository,
} from "../../infrastructure/persistence/manual-subscription-requests.repository";
import { SubscriptionCreditsRepository } from "../../infrastructure/persistence/subscription-credits.repository";
import { SubscriptionStateEventsRepository } from "../../infrastructure/persistence/subscription-state-events.repository";
import {
	type AdminManualSubscriptionRow,
	type SubscriptionRow,
	SubscriptionsRepository,
} from "../../infrastructure/persistence/subscriptions.repository";
import { SubscriptionRefillService } from "./subscription-refill.service";

const TERMINAL_SUBSCRIPTION_STATUSES = ["canceled", "incomplete_expired"];
const DAY_MS = 86_400_000;

export type ManualSubscriptionExpiryResult = {
	ended: number;
	failed: number;
	skipped: number;
};

type TerminationOutcome = "ended" | "skipped";

@Injectable()
export class ManualSubscriptionsService {
	private readonly logger = new Logger(ManualSubscriptionsService.name);

	constructor(
		@Inject(SubscriptionsRepository)
		private readonly subscriptionsRepository: SubscriptionsRepository,
		@Inject(SubscriptionCreditsRepository)
		private readonly subscriptionCreditsRepository: SubscriptionCreditsRepository,
		@Inject(CreditsService)
		private readonly creditsService: CreditsService,
		@Inject(SubscriptionRefillService)
		private readonly subscriptionRefillService: SubscriptionRefillService,
		@Inject(ManualSubscriptionPaymentsRepository)
		private readonly paymentsRepository: ManualSubscriptionPaymentsRepository,
		@Inject(ManualSubscriptionRequestsRepository)
		private readonly requestsRepository: ManualSubscriptionRequestsRepository,
		@Inject(SubscriptionStateEventsRepository)
		private readonly stateEventsRepository: SubscriptionStateEventsRepository,
		@Inject(BillingCheckoutAttemptsRepository)
		private readonly checkoutAttemptsRepository: BillingCheckoutAttemptsRepository,
		@Inject(ProductSettingsService)
		private readonly productSettingsService: ProductSettingsService,
		@Optional()
		@Inject(AnalyticsService)
		private readonly analyticsService?: AnalyticsService,
	) {}

	/**
	 * Header aggregates for the admin Offline billing page. Offline money never
	 * joins the USD MRR analytics — the collected totals come from the real
	 * recorded payment rows, per currency, on UTC calendar months.
	 */
	async getStats(now = new Date()): Promise<AdminManualBillingStats> {
		const settings = await this.productSettingsService.get();
		const graceMs = this.graceMs(settings);
		const monthStart = startOfUtcMonth(now);
		const previousMonthStart = startOfUtcMonth(
			new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)),
		);
		const effectiveNow = new Date(now.getTime() - graceMs);
		const effectiveIn7Days = new Date(now.getTime() + 7 * DAY_MS - graceMs);
		const [
			activeSubscriptions,
			expiringWithin7Days,
			inGrace,
			openRequests,
			collectedThisMonth,
			collectedPreviousMonth,
		] = await Promise.all([
			this.subscriptionsRepository.countManualActive(effectiveNow),
			this.subscriptionsRepository.countManualExpiringBetween(
				effectiveNow,
				effectiveIn7Days,
			),
			this.subscriptionsRepository.countManualExpiringBetween(
				effectiveNow,
				now,
			),
			this.requestsRepository.countOpen(),
			this.paymentsRepository.sumByCurrencyBetween(
				monthStart,
				nextUtcMonth(monthStart),
			),
			this.paymentsRepository.sumByCurrencyBetween(
				previousMonthStart,
				monthStart,
			),
		]);

		return {
			activeSubscriptions,
			collectedPreviousMonth,
			collectedThisMonth,
			expiringWithin7Days,
			inGrace,
			openRequests,
		};
	}

	async grant(
		adminId: string,
		input: AdminGrantManualSubscriptionInput,
	): Promise<AdminManualSubscriptionDetail> {
		const organizationId = input.organizationId ?? null;
		const owner = organizationId
			? orgOwner(organizationId)
			: userOwner(input.userId);
		this.assertPlanMatchesOwner(input.plan, owner);

		const billingOwner =
			await this.subscriptionsRepository.findManualBillingOwner(
				input.userId,
				organizationId,
			);

		if (!billingOwner) {
			throw new NotFoundException("Billing user or organization was not found");
		}

		const providerSubscriptionId = `manual_${input.idempotencyKey}`;
		const replay =
			await this.subscriptionsRepository.findByProviderSubscriptionId(
				providerSubscriptionId,
			);

		if (replay) {
			return this.getManualReplayDetail(replay);
		}

		const now = new Date();
		const periodStart = input.periodStart ? new Date(input.periodStart) : now;
		const periodEnd = input.periodEnd
			? new Date(input.periodEnd)
			: addBillingInterval(periodStart, input.interval);
		this.assertValidPeriod(periodStart, periodEnd);

		let result: { created: boolean; subscriptionId: string };

		try {
			result = await this.subscriptionCreditsRepository.withOwnerLock(
				owner,
				async (tx) => {
					const lockedReplay =
						await this.subscriptionsRepository.findByProviderSubscriptionId(
							providerSubscriptionId,
							tx,
						);

					if (lockedReplay) {
						return { created: false, subscriptionId: lockedReplay.id };
					}

					if (await this.subscriptionsRepository.findActiveByOwner(owner, tx)) {
						throw new ActiveSubscriptionExistsError();
					}

					const openCheckoutAttempts =
						await this.checkoutAttemptsRepository.findOpenForOwner(
							owner,
							"subscription",
							tx,
						);

					if (openCheckoutAttempts.length > 0) {
						throw new ConflictException({
							code: "BILLING_CHECKOUT_PENDING",
							message: "A billing checkout is already pending",
						});
					}

					// Without an explicit requestId, a grant from the user/org detail
					// pages still fulfills the owner's open request — auto-link it so
					// it does not stay pending forever (review finding).
					const request = input.requestId
						? await this.requestsRepository.findById(input.requestId, tx)
						: await this.requestsRepository.findOpenByOwner(owner, tx);
					this.assertRequestCanFundOwner(
						request,
						input.requestId,
						input.userId,
						owner,
					);

					const subscription = await this.subscriptionsRepository.insertManual(
						{
							cancelAtPeriodEnd: false,
							currentPeriodEnd: periodEnd,
							currentPeriodStart: periodStart,
							interval: input.interval,
							organizationId,
							plan: input.plan,
							priceLookupKey: priceLookupKey(
								input.plan,
								input.tierCredits,
								input.interval,
							),
							providerSubscriptionId,
							status: "active",
							tierCredits: input.tierCredits,
							userId: input.userId,
						},
						tx,
					);
					const payment = await this.paymentsRepository.insert(
						{
							amountMinor: input.payment.amountMinor,
							currency: input.payment.currency,
							idempotencyKey: input.idempotencyKey,
							kind: "initial",
							method: input.payment.method,
							note: input.payment.note ?? null,
							periodEnd,
							periodStart,
							recordedByUserId: adminId,
							reference: input.payment.reference ?? null,
							requestId: request?.id ?? null,
							subscriptionId: subscription.id,
						},
						tx,
					);
					this.assertPaymentReplayMatches(payment, subscription.id, "initial");

					await this.creditsService.grant(
						owner,
						input.tierCredits * 100,
						{
							bucket: "plan",
							idempotencyKey: `manual:${subscription.id}:initial`,
							meta: {
								grantedBy: adminId,
								paymentId: payment.id,
								reason: "manual_subscription_initial",
								subscriptionId: subscription.id,
							},
						},
						tx,
					);

					if (input.interval === "year") {
						await this.subscriptionRefillService.createYearlySlots(
							{
								credits: input.tierCredits * 100,
								funding: {
									chargeId: null,
									invoiceId: `manual:${payment.id}`,
									paymentIntentId: null,
								},
								remainingAfter: periodStart,
								subscription,
							},
							tx,
						);
					}

					await this.stateEventsRepository.tryInsert(
						{
							kind: "created",
							occurredAt: now,
							organizationId,
							stripeEventId: `manual:${subscription.id}:created`,
							stripeSubscriptionId: subscription.providerSubscriptionId,
							toLookupKey: subscription.priceLookupKey,
							toStatus: subscription.status,
							userId: subscription.userId,
						},
						tx,
					);

					if (request) {
						await this.requestsRepository.update(
							request.id,
							{
								adminNotes: this.mergeAdminNotes(
									request.adminNotes,
									input.adminNotes,
								),
								handledAt: now,
								handledByUserId: adminId,
								status: "approved",
								subscriptionId: subscription.id,
							},
							tx,
						);
					}

					return { created: true, subscriptionId: subscription.id };
				},
			);
		} catch (error) {
			if (!isUniqueViolation(error)) {
				throw error;
			}

			const existing =
				await this.subscriptionsRepository.findByProviderSubscriptionId(
					providerSubscriptionId,
				);

			if (!existing) {
				throw new ActiveSubscriptionExistsError();
			}

			return this.getManualReplayDetail(existing);
		}

		if (result.created) {
			this.analyticsService?.capture(input.userId, "subscription_started", {
				plan: input.plan,
				provider: "manual",
			});
		}

		return this.getSubscription(result.subscriptionId);
	}

	async renew(
		adminId: string,
		subscriptionId: string,
		input: AdminRenewManualSubscriptionInput,
	): Promise<AdminManualSubscriptionDetail> {
		const subscription = await this.requireSubscription(subscriptionId);
		this.assertManual(subscription);
		const replay = await this.paymentsRepository.findByIdempotencyKey(
			input.idempotencyKey,
		);

		if (replay) {
			this.assertPaymentReplayMatches(replay, subscriptionId, "renewal");
			return this.getSubscription(subscriptionId);
		}

		const owner = ownerFromIds(
			subscription.userId,
			subscription.organizationId,
		);

		await this.subscriptionCreditsRepository.withOwnerLock(
			owner,
			async (tx) => {
				const current = await this.subscriptionsRepository.findById(
					subscriptionId,
					tx,
				);

				if (!current) {
					throw new NotFoundException();
				}

				this.assertManual(current);
				const lockedReplay = await this.paymentsRepository.findByIdempotencyKey(
					input.idempotencyKey,
					tx,
				);

				if (lockedReplay) {
					this.assertPaymentReplayMatches(
						lockedReplay,
						subscriptionId,
						"renewal",
					);
					return;
				}

				// An explicit requestId is the admin's decision (the UI warns on a
				// plan mismatch). Without one, auto-resolve the owner's open request
				// ONLY when it asks for exactly the plan being renewed — a change
				// request must stay open for the End + grant flow.
				const discovered = input.requestId
					? null
					: await this.requestsRepository.findOpenByOwner(owner, tx);
				const request = input.requestId
					? await this.requestsRepository.findById(input.requestId, tx)
					: discovered &&
							discovered.plan === current.plan &&
							discovered.tierCredits === current.tierCredits &&
							discovered.interval === current.interval
						? discovered
						: null;
				this.assertRequestCanFundOwner(
					request,
					input.requestId,
					current.userId,
					owner,
				);

				const now = new Date();
				const renewAtBoundary =
					this.isEntitled(current.status) &&
					current.currentPeriodEnd.getTime() > now.getTime();

				if (!renewAtBoundary) {
					const other = await this.subscriptionsRepository.findActiveByOwner(
						owner,
						tx,
					);

					if (other && other.id !== subscriptionId) {
						throw new ActiveSubscriptionExistsError();
					}

					// Same admission rule as grant: re-activating an ended manual
					// subscription while a Stripe checkout is open would let the
					// webhook mirror collide with the fresh manual entitlement.
					const openCheckoutAttempts =
						await this.checkoutAttemptsRepository.findOpenForOwner(
							owner,
							"subscription",
							tx,
						);

					if (openCheckoutAttempts.length > 0) {
						throw new ConflictException({
							code: "BILLING_CHECKOUT_PENDING",
							message: "A billing checkout is already pending",
						});
					}
				}

				const newStart = renewAtBoundary ? current.currentPeriodEnd : now;
				const newEnd = input.periodEnd
					? new Date(input.periodEnd)
					: addBillingInterval(newStart, current.interval);
				this.assertValidPeriod(newStart, newEnd);

				const payment = await this.paymentsRepository.insert(
					{
						amountMinor: input.payment.amountMinor,
						currency: input.payment.currency,
						idempotencyKey: input.idempotencyKey,
						kind: "renewal",
						method: input.payment.method,
						note: input.payment.note ?? null,
						periodEnd: newEnd,
						periodStart: newStart,
						recordedByUserId: adminId,
						reference: input.payment.reference ?? null,
						requestId: request?.id ?? null,
						subscriptionId,
					},
					tx,
				);
				this.assertPaymentReplayMatches(payment, subscriptionId, "renewal");

				const updated = await this.subscriptionsRepository.updatePeriod(
					subscriptionId,
					{
						cancelAtPeriodEnd: false,
						currentPeriodEnd: newEnd,
						currentPeriodStart: renewAtBoundary
							? current.currentPeriodStart
							: newStart,
						status: "active",
					},
					tx,
				);

				if (!updated) {
					throw new Error(`Manual subscription ${subscriptionId} disappeared`);
				}

				if (request) {
					await this.requestsRepository.update(
						request.id,
						{
							handledAt: now,
							handledByUserId: adminId,
							status: "approved",
							subscriptionId,
						},
						tx,
					);
				}

				if (renewAtBoundary) {
					await this.subscriptionCreditsRepository.insertRefillSlots(
						[
							{
								credits: current.tierCredits * 100,
								dueAt: newStart,
								fundingChargeId: null,
								fundingInvoiceId: `manual:${payment.id}:cycle`,
								fundingPaymentIntentId: null,
								periodOrdinal: 2,
								status: "pending",
								subscriptionId,
							},
						],
						tx,
					);

					if (current.interval === "year") {
						await this.createRenewalYearlySlots(
							updated,
							newStart,
							newEnd,
							payment.id,
							tx,
						);
					}

					return;
				}

				// A manual renewal re-grants the tier allotment below; the earlier
				// period's unfired slots are superseded by this renewal.
				await this.subscriptionCreditsRepository.cancelPendingSlotsForSubscription(
					subscriptionId,
					{ reason: "replaced" },
					tx,
				);

				await this.creditsService.applyCappedRefill(
					owner,
					current.tierCredits * 100,
					{
						capMultiplier: 1,
						idempotencyKey: `manual:${subscriptionId}:renewal:${payment.id}`,
						meta: {
							grantedBy: adminId,
							paymentId: payment.id,
							reason: "manual_subscription_renewal",
							subscriptionId,
						},
					},
					tx,
				);

				if (current.interval === "year") {
					await this.createRenewalYearlySlots(
						updated,
						newStart,
						newEnd,
						payment.id,
						tx,
					);
				}

				await this.stateEventsRepository.tryInsert(
					{
						fromStatus: current.status,
						kind: "status_changed",
						occurredAt: now,
						organizationId: current.organizationId,
						stripeEventId: `manual:${subscriptionId}:renewed:${payment.id}`,
						stripeSubscriptionId: current.providerSubscriptionId,
						toStatus: "active",
						userId: current.userId,
					},
					tx,
				);
			},
		);

		return this.getSubscription(subscriptionId);
	}

	async end(
		adminId: string,
		subscriptionId: string,
		input: AdminEndManualSubscriptionInput,
	): Promise<AdminManualSubscriptionDetail> {
		const subscription = await this.requireSubscription(subscriptionId);
		this.assertManual(subscription);
		await this.terminate(
			subscriptionId,
			input.reason ?? "manual_subscription_ended",
			{ endedBy: adminId },
		);

		return this.getSubscription(subscriptionId);
	}

	async expireDue(
		now = new Date(),
		limit = 200,
	): Promise<ManualSubscriptionExpiryResult> {
		const result: ManualSubscriptionExpiryResult = {
			ended: 0,
			failed: 0,
			skipped: 0,
		};
		const settings = await this.productSettingsService.get();
		const cutoff = new Date(now.getTime() - this.graceMs(settings));
		const due = await this.subscriptionsRepository.listManualDueForExpiry(
			cutoff,
			limit,
		);

		for (const subscription of due) {
			try {
				const outcome = await this.terminate(subscription.id, "period_ended", {
					dueThrough: cutoff,
				});
				result[outcome] += 1;
			} catch (error) {
				result.failed += 1;
				this.logger.error(
					`Manual subscription ${subscription.id} expiry failed and remains retryable`,
					error instanceof Error ? error.stack : String(error),
				);
			}
		}

		return result;
	}

	async listRequests(
		query: AdminListManualRequestsQuery,
	): Promise<AdminListManualRequestsResponse> {
		const page = await this.requestsRepository.listForAdmin(query);

		return {
			items: page.items.map(mapAdminManualRequest),
			page: page.page,
			pageSize: page.pageSize,
			total: page.total,
		};
	}

	async getRequest(id: string): Promise<AdminManualRequest> {
		const row = await this.requestsRepository.findAdminById(id);

		if (!row) {
			throw new NotFoundException();
		}

		return mapAdminManualRequest(row);
	}

	async updateRequest(
		adminId: string,
		id: string,
		body: AdminUpdateManualRequestBody,
	): Promise<AdminManualRequest> {
		const request = await this.requestsRepository.findById(id);

		if (!request) {
			throw new NotFoundException();
		}

		if (
			body.status &&
			(request.status === "approved" || request.status === "canceled")
		) {
			throw new ConflictException(
				"Approved or canceled requests cannot be reopened",
			);
		}

		// Only a status TRANSITION claims the handler audit fields — a later
		// note-only edit must not overwrite who handled the request or when.
		const changes = {
			...(body.adminNotes !== undefined ? { adminNotes: body.adminNotes } : {}),
			...(body.status
				? {
						handledAt: new Date(),
						handledByUserId: adminId,
						status: body.status,
					}
				: {}),
		};
		const updated = body.status
			? await this.requestsRepository.updateIfNotTerminal(id, changes)
			: await this.requestsRepository.update(id, changes);

		if (!updated) {
			const latest = await this.requestsRepository.findById(id);

			if (!latest) {
				throw new NotFoundException();
			}

			throw new ConflictException(
				"Approved or canceled requests cannot be reopened",
			);
		}

		return this.getRequest(id);
	}

	async listSubscriptions(
		query: AdminListManualSubscriptionsQuery,
	): Promise<AdminListManualSubscriptionsResponse> {
		const now = new Date();
		const settings = await this.productSettingsService.get();
		const graceMs = this.graceMs(settings);
		const page = await this.subscriptionsRepository.listManualForAdmin(
			query,
			new Date(now.getTime() - graceMs),
		);

		return {
			items: page.items.map((row) =>
				mapAdminManualSubscription(row, now, graceMs),
			),
			page: page.page,
			pageSize: page.pageSize,
			total: page.total,
		};
	}

	async getSubscription(id: string): Promise<AdminManualSubscriptionDetail> {
		const row = await this.subscriptionsRepository.findManualAdminById(id);

		if (!row) {
			throw new NotFoundException();
		}

		const [payments, request, settings] = await Promise.all([
			this.paymentsRepository.listBySubscription(id),
			this.requestsRepository.findBySubscriptionId(id),
			this.productSettingsService.get(),
		]);

		return {
			...mapAdminManualSubscription(row, new Date(), this.graceMs(settings)),
			payments: payments.map(mapAdminManualPayment),
			request: request ? mapManualSubscriptionRequest(request) : null,
		};
	}

	private async getManualReplayDetail(
		subscription: SubscriptionRow,
	): Promise<AdminManualSubscriptionDetail> {
		this.assertManual(subscription);

		return this.getSubscription(subscription.id);
	}

	private graceMs(settings: Pick<ProductSettings, "manualGraceDays">): number {
		return settings.manualGraceDays * DAY_MS;
	}

	private async requireSubscription(id: string): Promise<SubscriptionRow> {
		const subscription = await this.subscriptionsRepository.findById(id);

		if (!subscription) {
			throw new NotFoundException();
		}

		return subscription;
	}

	private async terminate(
		subscriptionId: string,
		reason: string,
		options: { dueThrough?: Date; endedBy?: string } = {},
	): Promise<TerminationOutcome> {
		const candidate =
			await this.subscriptionsRepository.findById(subscriptionId);

		if (!candidate || this.isTerminal(candidate.status)) {
			return "skipped";
		}

		this.assertManual(candidate);
		const owner = ownerFromIds(candidate.userId, candidate.organizationId);

		return this.subscriptionCreditsRepository.withOwnerLock(
			owner,
			async (tx) => {
				const current = await this.subscriptionsRepository.findById(
					subscriptionId,
					tx,
				);

				if (!current || this.isTerminal(current.status)) {
					return "skipped";
				}

				this.assertManual(current);

				if (
					options.dueThrough &&
					current.currentPeriodEnd.getTime() > options.dueThrough.getTime()
				) {
					return "skipped";
				}

				const ended = await this.subscriptionsRepository.updatePeriod(
					subscriptionId,
					{
						cancelAtPeriodEnd: false,
						currentPeriodEnd: current.currentPeriodEnd,
						currentPeriodStart: current.currentPeriodStart,
						status: "canceled",
					},
					tx,
				);

				if (!ended) {
					throw new Error(`Manual subscription ${subscriptionId} disappeared`);
				}

				// The subscription ended: its unfired slots are void and, unlike a
				// clawback, never restorable.
				await this.subscriptionCreditsRepository.cancelPendingSlotsForSubscription(
					subscriptionId,
					{ reason: "ended" },
					tx,
				);
				const anotherEntitled =
					await this.subscriptionCreditsRepository.findCanonicalEntitledByOwner(
						owner,
						tx,
					);

				if (!anotherEntitled) {
					// Cycle-scoped, not period-end-scoped: an end -> renew -> end
					// sequence can restore the SAME period end, and a reused key
					// would make the second expiry a silent no-op (review finding).
					const idempotencySuffix = `${current.currentPeriodStart.getTime()}:${current.currentPeriodEnd.getTime()}`;
					await this.creditsService.expirePlanRemainder(
						owner,
						{
							idempotencyKey: `manual:${subscriptionId}:expire:${idempotencySuffix}`,
							meta: {
								...(options.endedBy ? { endedBy: options.endedBy } : {}),
								reason,
								subscriptionId,
							},
						},
						tx,
					);
				}

				await this.stateEventsRepository.tryInsert(
					{
						fromLookupKey: current.priceLookupKey,
						fromStatus: current.status,
						kind: "ended",
						occurredAt: new Date(),
						organizationId: current.organizationId,
						stripeEventId: `manual:${subscriptionId}:ended:${current.currentPeriodStart.getTime()}:${current.currentPeriodEnd.getTime()}`,
						stripeSubscriptionId: current.providerSubscriptionId,
						toStatus: "canceled",
						userId: current.userId,
					},
					tx,
				);

				return "ended";
			},
		);
	}

	private async createRenewalYearlySlots(
		subscription: SubscriptionRow,
		periodStart: Date,
		periodEnd: Date,
		paymentId: string,
		transaction: Parameters<SubscriptionRefillService["createYearlySlots"]>[1],
	): Promise<void> {
		await this.subscriptionRefillService.createYearlySlots(
			{
				credits: subscription.tierCredits * 100,
				funding: {
					chargeId: null,
					invoiceId: `manual:${paymentId}`,
					paymentIntentId: null,
				},
				remainingAfter: periodStart,
				subscription: {
					...subscription,
					currentPeriodEnd: periodEnd,
					currentPeriodStart: periodStart,
				},
			},
			transaction,
		);
	}

	private assertRequestCanFundOwner(
		request: ManualSubscriptionRequestRow | null,
		requestId: string | undefined,
		userId: string,
		owner: CreditOwner,
	): void {
		if (requestId && !request) {
			throw new NotFoundException("Offline payment request was not found");
		}

		if (!request) {
			return;
		}

		const sameOwner =
			owner.type === "user"
				? request.organizationId === null && request.userId === userId
				: request.organizationId === owner.organizationId;

		if (!sameOwner) {
			throw new BadRequestException(
				"Offline payment request belongs to another billing owner",
			);
		}

		if (request.subscriptionId && request.status === "approved") {
			throw new ConflictException(
				"Offline payment request is already linked to a subscription",
			);
		}

		// Approving must never resurrect a request the user canceled or an
		// admin rejected — only OPEN requests can fund a grant or renewal.
		if (
			!(OPEN_MANUAL_REQUEST_STATUSES as readonly string[]).includes(
				request.status,
			)
		) {
			throw new ConflictException("Offline payment request is no longer open");
		}
	}

	private assertPlanMatchesOwner(plan: string, owner: CreditOwner): void {
		const expectedPlan = owner.type === "org" ? "business" : "pro";

		if (plan !== expectedPlan) {
			throw new BadRequestException(
				`${expectedPlan} is required for this billing owner`,
			);
		}
	}

	private assertValidPeriod(periodStart: Date, periodEnd: Date): void {
		if (
			Number.isNaN(periodStart.getTime()) ||
			Number.isNaN(periodEnd.getTime()) ||
			periodEnd.getTime() <= periodStart.getTime()
		) {
			throw new BadRequestException("Period end must be after period start");
		}
	}

	private assertManual(subscription: SubscriptionRow): void {
		if (subscription.provider !== "manual") {
			throw new ManualSubscriptionUnsupportedError();
		}
	}

	private assertPaymentReplayMatches(
		payment: ManualSubscriptionPaymentRow,
		subscriptionId: string,
		kind: ManualSubscriptionPaymentRow["kind"],
	): void {
		if (payment.subscriptionId !== subscriptionId || payment.kind !== kind) {
			throw new ConflictException(
				"The idempotency key is already used by another manual payment",
			);
		}
	}

	private mergeAdminNotes(
		existing: string | null,
		incoming: string | undefined,
	): string | null {
		if (!incoming) {
			return existing;
		}

		return existing ? `${existing}\n${incoming}` : incoming;
	}

	private isEntitled(status: string): boolean {
		return (ENTITLED_SUBSCRIPTION_STATUSES as readonly string[]).includes(
			status,
		);
	}

	private isTerminal(status: string): boolean {
		return TERMINAL_SUBSCRIPTION_STATUSES.includes(status);
	}
}

function mapAdminManualRequest(row: AdminManualRequestRow): AdminManualRequest {
	return {
		...mapManualSubscriptionRequest(row.request),
		adminNotes: row.request.adminNotes,
		currentSubscription: row.currentSubscription
			? {
					cancelAtPeriodEnd: row.currentSubscription.cancelAtPeriodEnd,
					currentPeriodEnd:
						row.currentSubscription.currentPeriodEnd.toISOString(),
					id: row.currentSubscription.id,
					interval: row.currentSubscription.interval,
					plan: row.currentSubscription.plan,
					provider: row.currentSubscription.provider,
					status: row.currentSubscription.status,
					tierCredits: row.currentSubscription.tierCredits,
				}
			: null,
		handledBy: row.handledBy,
		organization: row.organization,
		user: row.user,
	};
}

function mapManualSubscriptionRequest(
	row: ManualSubscriptionRequestRow,
): ManualSubscriptionRequest {
	return {
		city: row.city,
		company: row.company,
		country: row.country,
		createdAt: row.createdAt.toISOString(),
		fullName: row.fullName,
		handledAt: row.handledAt?.toISOString() ?? null,
		id: row.id,
		interval: row.interval,
		notes: row.notes,
		organizationId: row.organizationId,
		phone: row.phone,
		plan: row.plan,
		preferredPaymentMethod: row.preferredPaymentMethod,
		status: row.status,
		subscriptionId: row.subscriptionId,
		tierCredits: row.tierCredits,
		updatedAt: row.updatedAt.toISOString(),
	};
}

function mapAdminManualSubscription(
	row: AdminManualSubscriptionRow,
	now: Date,
	graceMs: number,
): AdminManualSubscription {
	const { subscription } = row;
	const accessEndsAt = new Date(
		subscription.currentPeriodEnd.getTime() + graceMs,
	);
	const entitled =
		(ENTITLED_SUBSCRIPTION_STATUSES as readonly string[]).includes(
			subscription.status,
		) && accessEndsAt.getTime() > now.getTime();

	return {
		accessEndsAt: accessEndsAt.toISOString(),
		cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
		createdAt: subscription.createdAt.toISOString(),
		currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
		currentPeriodStart: subscription.currentPeriodStart.toISOString(),
		entitled,
		id: subscription.id,
		inGrace:
			entitled &&
			subscription.currentPeriodEnd.getTime() <= now.getTime() &&
			accessEndsAt.getTime() > now.getTime(),
		interval: subscription.interval,
		// The summary subquery's max() comes back as a raw string from pg, not a
		// Date — normalize through the Date constructor.
		lastPaymentAt:
			row.lastPaymentAt === null
				? null
				: new Date(row.lastPaymentAt).toISOString(),
		organization: row.organization,
		paymentsCount: row.paymentsCount,
		plan: subscription.plan,
		priceLookupKey: subscription.priceLookupKey,
		provider: subscription.provider,
		status: subscription.status,
		tierCredits: subscription.tierCredits,
		updatedAt: subscription.updatedAt.toISOString(),
		user: row.user,
	};
}

function mapAdminManualPayment(
	row: ManualSubscriptionPaymentAdminRow,
): AdminManualPayment {
	return {
		amountMinor: row.payment.amountMinor,
		createdAt: row.payment.createdAt.toISOString(),
		currency: row.payment.currency,
		id: row.payment.id,
		kind: row.payment.kind,
		method: row.payment.method,
		note: row.payment.note,
		periodEnd: row.payment.periodEnd.toISOString(),
		periodStart: row.payment.periodStart.toISOString(),
		recordedBy: row.recordedBy,
		reference: row.payment.reference,
	};
}

// Drizzle/Postgres can wrap `23505`, so inspect the causal chain.
function isUniqueViolation(error: unknown): boolean {
	let current = error;

	for (let depth = 0; depth < 5 && current; depth += 1) {
		if (
			typeof current === "object" &&
			"code" in current &&
			(current as { code?: unknown }).code === "23505"
		) {
			return true;
		}

		current =
			typeof current === "object" && "cause" in current
				? (current as { cause?: unknown }).cause
				: undefined;
	}

	return false;
}

function startOfUtcMonth(date: Date): Date {
	return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function nextUtcMonth(monthStart: Date): Date {
	return new Date(
		Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 1),
	);
}
