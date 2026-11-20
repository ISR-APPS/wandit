/**
 * Implements the wallet routes of billing: the top-up checkout, the wallet view,
 * the payment history, the top-up status, and the Stripe portal.
 * BillingController calls it. It calls billing repositories, CreditsService, and the payment-provider port.
 */
import { randomUUID } from "node:crypto";
import { ConflictException, Inject, Injectable, Logger } from "@nestjs/common";
import type { AuthUser } from "@wandit/auth";
import {
	BILLING_CATALOG,
	type BillingCheckoutResponse,
	type BillingPaymentsResponse,
	type BillingPlansResponse,
	type BillingPortalResponse,
	type BillingSubscriptionViewResponse,
	type BillingTopupStatusResponse,
	type BillingWalletResponse,
	billingPlanIds,
	type CreateBillingTopupBody,
	type CreditBalanceResponse,
	centiCreditsToCredits,
	creditsToCentiCredits,
	isManualSubscription,
	PERSISTED_TOPUP_PACKS,
	persistedTopupPackIdSchema,
	priceLookupKey,
	priceUsdFor,
	purchasableTiersFor,
	TOPUP_CREDITS_PER_USD,
	TOPUP_MAX_AMOUNT_USD,
	TOPUP_MIN_AMOUNT_USD,
	TOPUP_PACKS,
	TOPUP_PRESET_AMOUNTS_USD,
	topupCreditsForUsd,
	topupPackIds,
	topupReceiptProviderSchema,
} from "@wandit/contracts";

import { CreditsService } from "../../../credits/application/services/credits.service";
import {
	type CreditOwner,
	orgOwner,
	userOwner,
} from "../../../credits/domain/credit-owner";
import { ProductSettingsService } from "../../../settings/application/services/product-settings.service";
import { OrganizationsDisabledError } from "../../../settings/domain/errors/organizations-disabled.error";
import { WorkspacePermissionDeniedError } from "../../../workspaces/domain/errors/workspace.errors";
import type { WorkspaceContext } from "../../../workspaces/domain/workspace-context";
import { AmbiguousPaymentProviderWriteError } from "../../domain/errors/ambiguous-payment-provider-write.error";
import { ManualSubscriptionUnsupportedError } from "../../domain/errors/manual-billing.errors";
import { NoActiveSubscriptionError } from "../../domain/errors/no-active-subscription.error";
import {
	PAYMENT_PROVIDER,
	type PaymentProvider,
} from "../../domain/ports/payment-provider.port";
import { mapSubscriptionRow } from "../../infrastructure/mappers/subscription.mapper";
import { BillingCheckoutAttemptsRepository } from "../../infrastructure/persistence/billing-checkout-attempts.repository";
import { BillingCustomersRepository } from "../../infrastructure/persistence/billing-customers.repository";
import {
	type BillingTopupReceiptRow,
	BillingTopupReceiptsRepository,
} from "../../infrastructure/persistence/billing-topup-receipts.repository";
import { OrganizationBillingCustomersRepository } from "../../infrastructure/persistence/organization-billing-customers.repository";
import { PaidOwnerRepository } from "../../infrastructure/persistence/paid-owner.repository";
import { SubscriptionsRepository } from "../../infrastructure/persistence/subscriptions.repository";
import { BillingCustomerService } from "./billing-customer.service";

/**
 * 5 min. An attempt with no session and younger than this has its Stripe call in flight.
 * The Stripe SDK makes 3 tries of 80 s each (240 s) before it gives up.
 */
const TOPUP_IN_FLIGHT_MS = 5 * 60 * 1000;

/** 30 days in ms. The window of `spentLast30DaysCredits` in the wallet view. The web derives the runway from it. */
const SPENT_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Coordinates billing operations after controllers validate each request.
 */
@Injectable()
export class BillingService {
	private readonly logger = new Logger(BillingService.name);

	constructor(
		@Inject(BillingCustomersRepository)
		private readonly billingCustomersRepository: BillingCustomersRepository,
		@Inject(SubscriptionsRepository)
		private readonly subscriptionsRepository: SubscriptionsRepository,
		@Inject(CreditsService)
		private readonly creditsService: CreditsService,
		@Inject(PAYMENT_PROVIDER)
		private readonly paymentProvider: PaymentProvider,
		@Inject(BillingCustomerService)
		private readonly billingCustomerService: BillingCustomerService,
		@Inject(BillingCheckoutAttemptsRepository)
		private readonly checkoutAttemptsRepository: BillingCheckoutAttemptsRepository,
		@Inject(OrganizationBillingCustomersRepository)
		private readonly organizationBillingCustomersRepository: OrganizationBillingCustomersRepository,
		@Inject(ProductSettingsService)
		private readonly productSettingsService: ProductSettingsService,
		@Inject(PaidOwnerRepository)
		private readonly paidOwnerRepository: PaidOwnerRepository,
		@Inject(BillingTopupReceiptsRepository)
		private readonly topupReceiptsRepository: BillingTopupReceiptsRepository,
	) {}

	/**
	 * Resolves the request's billing scope from the workspace header context.
	 * Personal scope (no workspace / omitted) is byte-identical to pre-teams.
	 * Org scope additionally enforces the organizationsEnabled kill switch —
	 * only for admissions; webhooks always honor paid org money regardless.
	 * Another user's personal workspace answers 403: billing is owner-only.
	 */
	private async resolveBillingScope(
		user: Pick<AuthUser, "id">,
		workspace: WorkspaceContext | undefined,
		options: { admission: boolean },
	): Promise<{ organizationId: string | null; owner: CreditOwner }> {
		// The owner's personal pool pays there; only the owner manages it, from personal scope.
		if (workspace?.kind === "shared-personal") {
			throw new WorkspacePermissionDeniedError();
		}

		if (workspace?.kind !== "org") {
			return { organizationId: null, owner: userOwner(user.id) };
		}

		if (options.admission) {
			const settings = await this.productSettingsService.get();

			if (!settings.organizationsEnabled) {
				throw new OrganizationsDisabledError();
			}
		}

		return {
			organizationId: workspace.organizationId,
			owner: orgOwner(workspace.organizationId),
		};
	}

	plans(): BillingPlansResponse {
		return {
			plans: billingPlanIds.map((plan) => ({
				basePer100Usd: BILLING_CATALOG.plans[plan].basePer100Usd,
				features: BILLING_CATALOG.plans[plan].features,
				id: plan,
				tiers: purchasableTiersFor(plan).map((tierCredits) => ({
					annualLookupKey: priceLookupKey(plan, tierCredits, "year"),
					annualUsd: priceUsdFor(plan, tierCredits, "year"),
					monthlyLookupKey: priceLookupKey(plan, tierCredits, "month"),
					monthlyUsd: priceUsdFor(plan, tierCredits, "month"),
					tierCredits,
				})),
			})),
			topupPacks: topupPackIds.map((packId) => ({
				credits: TOPUP_PACKS[packId].credits,
				id: packId,
				lookupKey: packId,
				usd: TOPUP_PACKS[packId].usd,
			})),
		};
	}

	async getSubscriptionView(
		userId: string,
		workspace?: WorkspaceContext,
	): Promise<BillingSubscriptionViewResponse> {
		const scope = await this.resolveBillingScope({ id: userId }, workspace, {
			admission: false,
		});
		const [subscription, balance] = await Promise.all([
			this.subscriptionsRepository.findActiveByOwner(scope.owner),
			this.creditsService.getSettledBalance(scope.owner),
		]);

		return {
			balance: this.balanceResponse(balance),
			subscription: subscription ? mapSubscriptionRow(subscription) : null,
		};
	}

	/** Wallet of the active workspace. Each member can read it, as the pooled balance is shared context. */
	async getWallet(
		userId: string,
		workspace?: WorkspaceContext,
	): Promise<BillingWalletResponse> {
		const scope = await this.resolveBillingScope({ id: userId }, workspace, {
			admission: false,
		});
		const spentSince = new Date(Date.now() - SPENT_WINDOW_MS);
		const [balance, isPaidOwner, customer, settings, spentCentiCredits] =
			await Promise.all([
				this.creditsService.getSettledBalance(scope.owner),
				this.paidOwnerRepository.isPaidOwner(scope.owner),
				this.findBillingCustomer(userId, scope.organizationId),
				this.productSettingsService.get(),
				this.creditsService.netConsumedCentiCreditsSince(
					scope.owner,
					spentSince,
				),
			]);

		return {
			balance: this.balanceResponse(balance),
			hasStripeCustomer: customer?.provider === "stripe",
			isPaidOwner,
			// A refund of older usage can make the window sum negative. The wallet shows 0 then.
			spentLast30DaysCredits: centiCreditsToCredits(
				Math.max(0, spentCentiCredits),
			),
			topup: {
				creditsPerUsd: TOPUP_CREDITS_PER_USD,
				enabled: settings.topupsEnabled,
				maxAmountUsd: TOPUP_MAX_AMOUNT_USD,
				minAmountUsd: TOPUP_MIN_AMOUNT_USD,
				presetAmountsUsd: [...TOPUP_PRESET_AMOUNTS_USD],
			},
		};
	}

	/**
	 * Starts a Stripe Checkout of a wallet top-up and returns its URL.
	 * The server computes the credits. The webhook grants the credits of the attempt row.
	 */
	async topup(
		user: AuthUser,
		body: CreateBillingTopupBody,
		workspace?: WorkspaceContext,
	): Promise<BillingCheckoutResponse> {
		const scope = await this.resolveBillingScope(user, workspace, {
			admission: true,
		});
		// A cached pricing v7 web bundle sends a pack id. Its USD price enters the amount flow.
		const amountUsd =
			"amountUsd" in body ? body.amountUsd : TOPUP_PACKS[body.packId].usd;
		const customer = scope.organizationId
			? await this.billingCustomerService.ensureOrgCustomer(
					scope.organizationId,
					user,
				)
			: await this.billingCustomerService.ensureCustomer(user);
		// Stripe calls stay outside the owner lock: that lock also serializes every debit of the owner.
		await this.expireOpenTopupSessions(scope.owner);

		const attempt = await this.checkoutAttemptsRepository.withOwnerLock(
			scope.owner,
			async (tx) => {
				const open = await this.checkoutAttemptsRepository.findOpenForOwner(
					scope.owner,
					"topup",
					tx,
				);
				const inFlightAfter = Date.now() - TOPUP_IN_FLIGHT_MS;
				// An attempt with a session is still open here: Stripe did not expire it, or a concurrent
				// request attached it after the expire step. A young attempt with no session is in flight.
				// An old attempt with no session does not block: no customer has its URL.
				const blocking = open.some(
					(openAttempt) =>
						openAttempt.providerSessionId !== null ||
						openAttempt.createdAt.getTime() > inFlightAfter,
				);

				if (blocking) {
					throw this.checkoutPendingError();
				}

				return this.checkoutAttemptsRepository.create(
					{
						// Whole USD to USD cents.
						amountUsdCents: amountUsd * 100,
						credits: creditsToCentiCredits(topupCreditsForUsd(amountUsd)),
						id: randomUUID(),
						organizationId: scope.organizationId,
						userId: user.id,
					},
					tx,
				);
			},
		);

		if (attempt.amountUsdCents === null || attempt.credits === null) {
			throw new Error(
				`Top-up checkout attempt ${attempt.id} was stored with no amount`,
			);
		}

		// USD cents to whole USD, then the base rate. The stored credits above the base are the bonus.
		const baseCredits = (attempt.amountUsdCents / 100) * TOPUP_CREDITS_PER_USD;
		let checkout: Awaited<ReturnType<PaymentProvider["createTopupCheckout"]>>;

		try {
			// Every value comes from the attempt row: a replay of the same key sends the same bytes.
			checkout = await this.paymentProvider.createTopupCheckout({
				amountUsdCents: attempt.amountUsdCents,
				attemptId: attempt.id,
				baseCredits,
				bonusCredits: centiCreditsToCredits(attempt.credits) - baseCredits,
				customerId: customer.providerCustomerId,
				organizationId: attempt.organizationId,
				userId: attempt.userId,
			});
		} catch (error) {
			await this.handleCheckoutCreationFailure(attempt.id, user.id, error);
			throw error;
		}

		const attached = await this.checkoutAttemptsRepository.withUserLock(
			user.id,
			(tx) =>
				this.checkoutAttemptsRepository.attachSession(
					attempt.id,
					checkout.id,
					tx,
				),
		);

		if (!attached) {
			await this.compensateUnattachedCheckout(attempt.id, checkout.id, user.id);
			throw new Error(
				`Top-up checkout attempt ${attempt.id} could not attach its session`,
			);
		}

		return { url: checkout.url };
	}

	/**
	 * "credited" with the granted credits when the Stripe receipt of the session exists and the caller paid it.
	 * Reads no workspace: the payer is the caller, and a wrong session id gives "pending".
	 */
	async getTopupStatus(
		userId: string,
		sessionId: string,
	): Promise<BillingTopupStatusResponse> {
		const receipt =
			await this.topupReceiptsRepository.findStripeReceiptForPayer(
				sessionId,
				userId,
			);
		if (receipt === null) {
			return { status: "pending" };
		}

		return { status: "credited", credits: receiptDisplayCredits(receipt) };
	}

	/** The last 50 receipts of the pool, any provider. The controller allows the billing manager only. */
	async listPayments(
		user: Pick<AuthUser, "id">,
		workspace?: WorkspaceContext,
	): Promise<BillingPaymentsResponse> {
		const scope = await this.resolveBillingScope(user, workspace, {
			admission: false,
		});
		const rows = await this.topupReceiptsRepository.listRecentForOwner(
			scope.owner,
		);

		return {
			items: rows.map(({ receipt, revokedCentiCredits }) => ({
				amountMinor: receipt.amountCents,
				amountUsdCents: receipt.amountUsdCents,
				credits: receiptDisplayCredits(receipt),
				currency: receipt.currency,
				id: receipt.id,
				method: receipt.method,
				paidAt: receipt.paidAt.toISOString(),
				// The column is text with a CHECK of the same list.
				provider: topupReceiptProviderSchema.parse(receipt.provider),
				reversedAt: receipt.reversedAt?.toISOString() ?? null,
				revokedCredits:
					revokedCentiCredits === null
						? null
						: centiCreditsToCredits(revokedCentiCredits),
			})),
		};
	}

	async portal(
		user: AuthUser,
		workspace?: WorkspaceContext,
	): Promise<BillingPortalResponse> {
		const scope = await this.resolveBillingScope(user, workspace, {
			admission: false,
		});
		const subscription = await this.subscriptionsRepository.findActiveByOwner(
			scope.owner,
		);

		if (isManualSubscription(subscription)) {
			throw new ManualSubscriptionUnsupportedError();
		}

		const customer = await this.findBillingCustomer(
			user.id,
			scope.organizationId,
		);

		if (!customer) {
			throw new NoActiveSubscriptionError();
		}

		const url = await this.paymentProvider.createPortalSession(
			customer.providerCustomerId,
		);

		return { url };
	}

	/**
	 * Expires the open Stripe session of each open top-up attempt of the owner, before a new one.
	 * An attempt with no session stays as it is: the check under the owner lock reads its age.
	 * Never sets a session-less attempt to expired: a paid session attaches later by metadata.attemptId.
	 */
	private async expireOpenTopupSessions(owner: CreditOwner): Promise<void> {
		const attempts = await this.checkoutAttemptsRepository.findOpenForOwner(
			owner,
			"topup",
		);

		for (const attempt of attempts) {
			if (attempt.providerSessionId === null) {
				continue;
			}

			const terminalStatus = await this.paymentProvider.expireCheckoutSession(
				attempt.providerSessionId,
			);

			if (terminalStatus === "complete") {
				// The customer paid. The webhook owns the completed transition and grants the credits.
				throw this.checkoutPendingError();
			}

			if (terminalStatus !== "expired") {
				// The attempt stays open, so the check under the owner lock answers 409.
				this.logger.warn(
					`Checkout attempt ${attempt.id} remained ${String(terminalStatus)} after provider expiration and stays open`,
				);
				continue;
			}

			await this.checkoutAttemptsRepository.withOwnerLock(owner, (tx) =>
				this.checkoutAttemptsRepository.markExpired(attempt.id, tx),
			);
		}
	}

	// Structural isolation: personal scope only reaches the personal customer, org scope
	// only the org customer. The two tables partition Stripe customer ids (design §5.1/§5.4).
	private findBillingCustomer(userId: string, organizationId: string | null) {
		return organizationId
			? this.organizationBillingCustomersRepository.findByOrganizationId(
					organizationId,
				)
			: this.billingCustomersRepository.findByUserId(userId);
	}

	// CreditsService balances are internal centi-credits. The API carries decimal credits.
	private balanceResponse(
		balance: Awaited<ReturnType<CreditsService["getSettledBalance"]>>,
	): CreditBalanceResponse {
		return {
			balance: centiCreditsToCredits(balance.balance),
			plan: centiCreditsToCredits(balance.plan),
			promo: centiCreditsToCredits(balance.promo),
			settledBalance: centiCreditsToCredits(balance.settledBalance),
			settledPlan: centiCreditsToCredits(balance.settledPlan),
			settledPromo: centiCreditsToCredits(balance.settledPromo),
			settledTopup: centiCreditsToCredits(balance.settledTopup),
			topup: centiCreditsToCredits(balance.topup),
		};
	}

	/** 409 BILLING_CHECKOUT_PENDING: a paid session waits for its webhook, or a request is in flight. */
	private checkoutPendingError(): ConflictException {
		return new ConflictException({
			code: "BILLING_CHECKOUT_PENDING",
			message: "A billing checkout is already pending",
		});
	}

	private async handleCheckoutCreationFailure(
		attemptId: string,
		userId: string,
		error: unknown,
	): Promise<void> {
		if (error instanceof AmbiguousPaymentProviderWriteError) {
			this.logger.warn(
				`Checkout attempt ${attemptId} remains created after an ambiguous provider failure. A paid session attaches by metadata.attemptId, and the attempt stops blocking after 5 minutes: ${this.errorMessage(error)}`,
			);
			return;
		}

		const expired = await this.checkoutAttemptsRepository.withUserLock(
			userId,
			(tx) => this.checkoutAttemptsRepository.markExpired(attemptId, tx),
		);

		if (!expired) {
			throw new Error(
				`Checkout attempt ${attemptId} could not be expired after a definite provider failure`,
				{ cause: error },
			);
		}
	}

	private async compensateUnattachedCheckout(
		attemptId: string,
		providerSessionId: string,
		userId: string,
	): Promise<void> {
		try {
			const terminalStatus =
				await this.paymentProvider.expireCheckoutSession(providerSessionId);

			if (terminalStatus === "expired") {
				await this.checkoutAttemptsRepository.withUserLock(userId, (tx) =>
					this.checkoutAttemptsRepository.markExpired(attemptId, tx),
				);
				return;
			}

			this.logger.warn(
				`Checkout session ${providerSessionId} became ${String(terminalStatus)} before compensation; attempt ${attemptId} remains fulfillable`,
			);
		} catch (error) {
			this.logger.error(
				`Checkout session ${providerSessionId} could not be compensated after attempt ${attemptId} failed to attach`,
				error instanceof Error ? error.stack : String(error),
			);
		}
	}

	private errorMessage(error: unknown): string {
		return error instanceof Error ? error.message : String(error);
	}
}

/**
 * Decimal credits of a receipt for the API. The receipt column stores centi-credits.
 * A receipt from before pricing v8 has only its pack id. Null when that pack id is unknown or absent.
 */
function receiptDisplayCredits(
	receipt: Pick<BillingTopupReceiptRow, "credits" | "packId">,
): number | null {
	if (receipt.credits !== null) {
		return centiCreditsToCredits(receipt.credits);
	}
	const parsed = persistedTopupPackIdSchema.safeParse(receipt.packId);
	return parsed.success ? PERSISTED_TOPUP_PACKS[parsed.data].credits : null;
}
