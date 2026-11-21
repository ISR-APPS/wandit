/**
 * Offline billing for the admin app: request queue, "Record top-up", "Reverse top-up", and the receipt list.
 * AdminManualBillingController calls it. Manual plans from before pricing v8 stay readable as history.
 * It writes credits through CreditsService, and rows through the receipt, request, and Starter pass repositories.
 */
import {
	BadRequestException,
	ConflictException,
	Inject,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import {
	type AdminListManualRequestsQuery,
	type AdminListManualRequestsResponse,
	type AdminListManualSubscriptionsQuery,
	type AdminListManualSubscriptionsResponse,
	type AdminListTopupReceiptsQuery,
	type AdminListTopupReceiptsResponse,
	type AdminManualBillingStats,
	type AdminManualPayment,
	type AdminManualRequest,
	type AdminManualSubscription,
	type AdminManualSubscriptionDetail,
	type AdminRecordTopupInput,
	type AdminReverseTopupInput,
	type AdminTopupReceipt,
	type AdminUpdateManualRequestBody,
	centiCreditsToCredits,
	creditsToCentiCredits,
	ENTITLED_SUBSCRIPTION_STATUSES,
	OPEN_MANUAL_REQUEST_STATUSES,
	topupCreditsForUsd,
	topupReceiptProviderSchema,
} from "@wandit/contracts";

import { CreditsService } from "../../../credits/application/services/credits.service";
import {
	type CreditOwner,
	orgOwner,
	ownerFromIds,
	userOwner,
} from "../../../credits/domain/credit-owner";
import { LifecycleEventsService } from "../../../lifecycle-events/application/services/lifecycle-events.service";
import { lifecycleEventIdempotencyKey } from "../../../lifecycle-events/domain/lifecycle-event";
import { ProductSettingsService } from "../../../settings/application/services/product-settings.service";
import {
	type AdminTopupReceiptRow,
	type BillingTopupReceiptRow,
	BillingTopupReceiptsRepository,
} from "../../infrastructure/persistence/billing-topup-receipts.repository";
import {
	type ManualSubscriptionPaymentAdminRow,
	ManualSubscriptionPaymentsRepository,
} from "../../infrastructure/persistence/manual-subscription-payments.repository";
import {
	type AdminManualRequestRow,
	type ManualSubscriptionRequestRow,
	ManualSubscriptionRequestsRepository,
} from "../../infrastructure/persistence/manual-subscription-requests.repository";
import { StarterPassesRepository } from "../../infrastructure/persistence/starter-passes.repository";
import { SubscriptionCreditsRepository } from "../../infrastructure/persistence/subscription-credits.repository";
import {
	type AdminManualSubscriptionRow,
	SubscriptionsRepository,
} from "../../infrastructure/persistence/subscriptions.repository";
import { mapManualRequest } from "./manual-subscription-requests.service";

const DAY_MS = 86_400_000;
// The offline stats count manual plans that end within this many days.
const EXPIRING_WINDOW_DAYS = 7;

/** The money of one offline top-up and the credits it buys. */
type OfflineTopupAmounts = {
	/** USD value of the money in cents. Null when the currency is not USD or DZD, or the value is below 1 cent. */
	amountUsdCents: number | null;
	/** UNIT: centi-credits, the ledger unit. Always above zero. */
	centiCredits: number;
};

/** Admin offline billing: Record and Reverse top-up under the owner lock, plus read-only history of old manual plans. */
@Injectable()
export class ManualSubscriptionsService {
	constructor(
		@Inject(SubscriptionsRepository)
		private readonly subscriptionsRepository: Pick<
			SubscriptionsRepository,
			| "countManualActive"
			| "countManualExpiringBetween"
			| "findManualAdminById"
			| "findManualBillingOwner"
			| "listManualForAdmin"
		>,
		// Owner lock: the same advisory key as the credit ledger.
		@Inject(SubscriptionCreditsRepository)
		private readonly subscriptionCreditsRepository: Pick<
			SubscriptionCreditsRepository,
			"withOwnerLock"
		>,
		@Inject(CreditsService)
		private readonly creditsService: Pick<CreditsService, "revoke" | "topup">,
		@Inject(ManualSubscriptionPaymentsRepository)
		private readonly paymentsRepository: Pick<
			ManualSubscriptionPaymentsRepository,
			"listBySubscription" | "sumByCurrencyBetween"
		>,
		@Inject(ManualSubscriptionRequestsRepository)
		private readonly requestsRepository: Pick<
			ManualSubscriptionRequestsRepository,
			| "countOpen"
			| "findAdminById"
			| "findById"
			| "findBySubscriptionId"
			| "findOpenByOwner"
			| "listForAdmin"
			| "update"
			| "updateIfNotTerminal"
		>,
		@Inject(BillingTopupReceiptsRepository)
		private readonly receiptsRepository: Pick<
			BillingTopupReceiptsRepository,
			| "findAdminById"
			| "findById"
			| "findByProviderReference"
			| "insertIfAbsent"
			| "listForAdmin"
			| "markReversed"
		>,
		@Inject(ProductSettingsService)
		private readonly productSettingsService: Pick<
			ProductSettingsService,
			"get"
		>,
		@Inject(LifecycleEventsService)
		private readonly lifecycleEvents: Pick<LifecycleEventsService, "enqueue">,
		@Inject(StarterPassesRepository)
		private readonly starterPasses: Pick<
			StarterPassesRepository,
			"grantIfAbsent" | "revokeOrMoveForReceipt"
		>,
	) {}

	/**
	 * Header aggregates for the admin Offline billing page. Offline money never
	 * joins the USD MRR analytics. The collected totals come from the recorded
	 * payments and receipts, per currency, on UTC calendar months.
	 */
	async getStats(now = new Date()): Promise<AdminManualBillingStats> {
		const monthStart = startOfUtcMonth(now);
		const previousMonthStart = startOfUtcMonth(
			new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)),
		);
		const [
			activeSubscriptions,
			expiringWithin7Days,
			openRequests,
			collectedThisMonth,
			collectedPreviousMonth,
		] = await Promise.all([
			this.subscriptionsRepository.countManualActive(now),
			this.subscriptionsRepository.countManualExpiringBetween(
				now,
				new Date(now.getTime() + EXPIRING_WINDOW_DAYS * DAY_MS),
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
			// Pricing v8 removes the grace days. The field stays because the admin app parses it.
			inGrace: 0,
			openRequests,
		};
	}

	/**
	 * "Record top-up": money an admin collected offline becomes wallet credits, with or without a request.
	 * It also gives the pool its Starter pass. A replay of the same idempotency key returns the first receipt.
	 * A replay with other values is a 409.
	 */
	async recordTopup(
		adminId: string,
		input: AdminRecordTopupInput,
	): Promise<AdminTopupReceipt> {
		const organizationId = input.organizationId ?? null;
		const owner = organizationId
			? orgOwner(organizationId)
			: userOwner(input.userId);
		const billingOwner =
			await this.subscriptionsRepository.findManualBillingOwner(
				input.userId,
				organizationId,
			);

		if (!billingOwner) {
			throw new NotFoundException("Billing user or organization was not found");
		}

		// The owner's personal wallet pays in a personal workspace, so its org wallet is never spent.
		if (billingOwner.organization?.personalOwnerUserId) {
			throw new BadRequestException(
				"A personal workspace has no wallet of its own. Record the top-up for its owner",
			);
		}

		const settings = await this.productSettingsService.get();
		const providerReference = `offline:${input.idempotencyKey}`;

		// LIMIT: two records with two keys and no request both grant. Upgrade: refuse a second receipt with the same method and reference for one owner.
		const receiptId = await this.subscriptionCreditsRepository.withOwnerLock(
			owner,
			async (tx) => {
				const replay = await this.receiptsRepository.findByProviderReference(
					providerReference,
					tx,
				);

				// The admin dialog sends the same key on a retry. Check the replay before the request, which is approved now.
				if (replay) {
					assertOfflineReplayMatches(replay, input, organizationId);
					return replay.id;
				}

				// After the replay check: an admin can change the DZD rate between a call and its retry.
				const amounts = offlineTopupAmounts(input, settings.dzdPerUsdRate);

				// Without a requestId, the open request of the owner is the one this money funds.
				const request = input.requestId
					? await this.requestsRepository.findById(input.requestId, tx)
					: await this.requestsRepository.findOpenByOwner(owner, tx);
				this.assertRequestCanFundOwner(
					request,
					input.requestId,
					input.userId,
					owner,
				);

				const now = new Date();
				const receipt = await this.receiptsRepository.insertIfAbsent(
					{
						amountCents: input.amountMinor,
						amountUsdCents: amounts.amountUsdCents,
						credits: amounts.centiCredits,
						currency: input.currency,
						method: input.method,
						note: input.note ?? null,
						organizationId,
						paidAt: now,
						provider: "offline",
						providerReference,
						recordedByUserId: adminId,
						reference: input.reference ?? null,
						requestId: request?.id ?? null,
						userId: input.userId,
					},
					tx,
				);

				// Another owner holds this key: its call took a different lock and inserted first.
				if (!receipt) {
					throw new ConflictException(
						"The idempotency key is already used by another top-up",
					);
				}

				await this.creditsService.topup(
					owner,
					amounts.centiCredits,
					{
						idempotencyKey: `offline-topup:${input.idempotencyKey}`,
						meta: {
							amountUsdCents: amounts.amountUsdCents,
							grantedBy: adminId,
							method: input.method,
							reason: "offline_topup",
							receiptId: receipt.id,
						},
					},
					tx,
				);
				// Cash collected by an admin is real money, so it unlocks the pool like a card top-up.
				// The customer cash request keeps its 10 USD minimum, so cash never buys the 1 USD pass.
				await this.starterPasses.grantIfAbsent(
					owner,
					{ receiptId: receipt.id, source: "offline" },
					tx,
				);
				await this.lifecycleEvents.enqueue(
					{
						event: "payment_completed",
						idempotencyKey: lifecycleEventIdempotencyKey(
							"payment_completed",
							input.userId,
						),
						payload: { interval: "topup" },
						userId: input.userId,
					},
					tx,
				);

				if (request) {
					await this.requestsRepository.update(
						request.id,
						{
							handledAt: now,
							handledByUserId: adminId,
							status: "approved",
						},
						tx,
					);
				}

				return receipt.id;
			},
		);

		return this.getTopupReceipt(receiptId);
	}

	/**
	 * "Reverse top-up": takes back the credits of a SlickPay or offline receipt after a refund outside the API.
	 * A Starter pass from this receipt moves to another live receipt of the pool, or is revoked.
	 * A second call is a no-op that returns the same receipt. The balance can go below zero.
	 */
	async reverseTopup(
		adminId: string,
		input: AdminReverseTopupInput,
	): Promise<AdminTopupReceipt> {
		const receipt = await this.receiptsRepository.findById(input.receiptId);

		if (!receipt) {
			throw new NotFoundException("Top-up receipt was not found");
		}

		// A Stripe refund revokes through the webhook. Only money with no refund event is reversed here.
		if (receipt.provider !== "slickpay" && receipt.provider !== "offline") {
			throw new BadRequestException(
				"Only SlickPay and offline top-ups can be reversed",
			);
		}

		const owner = ownerFromIds(receipt.userId, receipt.organizationId);

		await this.subscriptionCreditsRepository.withOwnerLock(
			owner,
			async (tx) => {
				const locked = await this.receiptsRepository.findById(receipt.id, tx);

				if (!locked) {
					throw new NotFoundException("Top-up receipt was not found");
				}

				if (locked.reversedAt !== null) {
					return;
				}

				// billing_topup_receipts_non_stripe_credits_ck makes credits NOT NULL on a SlickPay or offline row.
				if (locked.credits === null) {
					throw new Error(`Top-up receipt ${locked.id} has no credits`);
				}

				await this.creditsService.revoke(
					owner,
					locked.credits,
					{
						bucket: "topup",
						idempotencyKey: `topup-reverse:${locked.id}`,
						meta: {
							reason: "topup_reversed",
							receiptId: locked.id,
							reversedBy: adminId,
						},
					},
					tx,
				);

				const reversed = await this.receiptsRepository.markReversed(
					locked.id,
					adminId,
					new Date(),
					tx,
				);

				// The owner lock serializes reversals, so a null here is a data bug. Roll back the revoke.
				if (!reversed) {
					throw new Error(
						`Top-up receipt ${locked.id} was reversed in parallel`,
					);
				}

				// Money that came back must not keep the pool unlocked.
				await this.starterPasses.revokeOrMoveForReceipt(
					locked,
					`receipt_reversed:${locked.id}`,
					tx,
				);
			},
		);

		return this.getTopupReceipt(receipt.id);
	}

	/** One page of wallet receipts for the admin app. The offline billing page asks for SlickPay and offline. */
	async listTopupReceipts(
		query: AdminListTopupReceiptsQuery,
	): Promise<AdminListTopupReceiptsResponse> {
		const page = await this.receiptsRepository.listForAdmin(query);

		return {
			items: page.items.map(mapAdminTopupReceipt),
			page: page.page,
			pageSize: page.pageSize,
			total: page.total,
		};
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

	/** Manual plans from before pricing v8, read-only history for the admin app. */
	async listSubscriptions(
		query: AdminListManualSubscriptionsQuery,
	): Promise<AdminListManualSubscriptionsResponse> {
		const now = new Date();
		const page = await this.subscriptionsRepository.listManualForAdmin(
			query,
			now,
		);

		return {
			items: page.items.map((row) => mapAdminManualSubscription(row, now)),
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

		const [payments, request] = await Promise.all([
			this.paymentsRepository.listBySubscription(id),
			this.requestsRepository.findBySubscriptionId(id),
		]);

		return {
			...mapAdminManualSubscription(row, new Date()),
			payments: payments.map(mapAdminManualPayment),
			request: request ? mapManualRequest(request) : null,
		};
	}

	private async getTopupReceipt(id: string): Promise<AdminTopupReceipt> {
		const row = await this.receiptsRepository.findAdminById(id);

		if (!row) {
			throw new NotFoundException("Top-up receipt was not found");
		}

		return mapAdminTopupReceipt(row);
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

		// Approving must never resurrect a request the user canceled or an
		// admin rejected. Only an OPEN request can fund a top-up.
		if (
			!OPEN_MANUAL_REQUEST_STATUSES.some((status) => status === request.status)
		) {
			throw new ConflictException("Offline payment request is no longer open");
		}
	}
}

/**
 * The credits and the USD value of an offline top-up. Exported for the spec.
 * Default credits: topupCreditsForUsd of the whole USD of the money, bonus included. The admin gives the credits for another currency or another price.
 */
export function offlineTopupAmounts(
	input: Pick<AdminRecordTopupInput, "amountMinor" | "credits" | "currency">,
	dzdPerUsdRate: number,
): OfflineTopupAmounts {
	// amountMinor is USD cents for "usd" and DZD centimes for "dzd". dzdPerUsdRate is centi-DZD per 1 USD.
	const usdCents =
		input.currency === "usd"
			? input.amountMinor
			: input.currency === "dzd"
				? Math.round((input.amountMinor * 100) / dzdPerUsdRate)
				: null;
	const amountUsdCents = usdCents !== null && usdCents > 0 ? usdCents : null;

	if (input.credits !== undefined) {
		// The schema allows 0.01 to 1,000,000 display credits, so the result is above zero.
		return {
			amountUsdCents,
			centiCredits: creditsToCentiCredits(input.credits),
		};
	}

	if (amountUsdCents === null) {
		throw new BadRequestException(
			`Give the credits: the API converts only USD and DZD, not ${input.currency.toUpperCase()}`,
		);
	}

	// A top-up buys credits for whole USD only. The admin gives the credits to count the cents.
	// LIMIT: with no credits from the admin, the tier comes from the floored USD value.
	// A DZD rate change can move an amount below a tier edge. Upgrade: store the quoted credits on the request row.
	const wholeUsd = Math.floor(amountUsdCents / 100);

	if (wholeUsd < 1) {
		throw new BadRequestException(
			"The amount is below 1 USD. Give the credits explicitly",
		);
	}

	return {
		amountUsdCents,
		centiCredits: creditsToCentiCredits(topupCreditsForUsd(wholeUsd)),
	};
}

// A replay must name the same owner and the same money, else the key is reused by mistake.
// Default credits come from the DZD rate of the first call, so only credits the admin gave are compared.
function assertOfflineReplayMatches(
	receipt: BillingTopupReceiptRow,
	input: AdminRecordTopupInput,
	organizationId: string | null,
): void {
	const matches =
		receipt.provider === "offline" &&
		receipt.userId === input.userId &&
		receipt.organizationId === organizationId &&
		(input.credits === undefined ||
			receipt.credits === creditsToCentiCredits(input.credits)) &&
		receipt.amountCents === input.amountMinor &&
		receipt.currency === input.currency;

	if (!matches) {
		throw new ConflictException(
			"The idempotency key is already used by another top-up",
		);
	}
}

function mapAdminTopupReceipt(row: AdminTopupReceiptRow): AdminTopupReceipt {
	const { receipt } = row;

	return {
		amountMinor: receipt.amountCents,
		amountUsdCents: receipt.amountUsdCents,
		createdAt: receipt.createdAt.toISOString(),
		// The receipt stores centi-credits. The admin app shows decimal credits.
		credits:
			receipt.credits === null ? null : centiCreditsToCredits(receipt.credits),
		currency: receipt.currency,
		id: receipt.id,
		method: receipt.method,
		note: receipt.note,
		organization: row.organization,
		paidAt: receipt.paidAt.toISOString(),
		// The column is text with a CHECK on the three providers. The parse keeps the contract type honest.
		provider: topupReceiptProviderSchema.parse(receipt.provider),
		providerReference: receipt.providerReference,
		recordedBy: row.recordedBy,
		reference: receipt.reference,
		requestId: receipt.requestId,
		reversedAt: receipt.reversedAt?.toISOString() ?? null,
		reversedBy: row.reversedBy,
		user: row.user,
	};
}

function mapAdminManualRequest(row: AdminManualRequestRow): AdminManualRequest {
	return {
		...mapManualRequest(row.request),
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

// Pricing v8 removes the grace days, so access ends at the period end.
function mapAdminManualSubscription(
	row: AdminManualSubscriptionRow,
	now: Date,
): AdminManualSubscription {
	const { subscription } = row;
	const accessEndsAt = subscription.currentPeriodEnd;
	const entitled =
		ENTITLED_SUBSCRIPTION_STATUSES.some(
			(status) => status === subscription.status,
		) && accessEndsAt.getTime() > now.getTime();

	return {
		accessEndsAt: accessEndsAt.toISOString(),
		cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
		createdAt: subscription.createdAt.toISOString(),
		currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
		currentPeriodStart: subscription.currentPeriodStart.toISOString(),
		entitled,
		id: subscription.id,
		inGrace: false,
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

function startOfUtcMonth(date: Date): Date {
	return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function nextUtcMonth(monthStart: Date): Date {
	return new Date(
		Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 1),
	);
}
