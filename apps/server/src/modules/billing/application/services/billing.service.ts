import { randomUUID } from "node:crypto";
import { ConflictException, Inject, Injectable, Logger } from "@nestjs/common";
import type { AuthUser } from "@wandit/auth";
import {
	BILLING_CATALOG,
	type BillingCancelRequest,
	type BillingCheckoutResponse,
	type BillingPlansResponse,
	type BillingPortalResponse,
	type BillingSubscriptionChangeOutcomeResponse,
	type BillingSubscriptionChangePreviewResponse,
	type BillingSubscriptionViewResponse,
	billingPlanIdSchema,
	billingPlanIds,
	type ChangeBillingSubscriptionBody,
	CREDIT_TIERS,
	type CreateBillingCheckoutBody,
	type CreateBillingTopupBody,
	centiCreditsToCredits,
	creditsToCentiCredits,
	ENTITLED_SUBSCRIPTION_STATUSES,
	isManualSubscription,
	type PreviewBillingSubscriptionChangeBody,
	parsePriceLookupKey,
	priceLookupKey,
	priceUsdFor,
	TOPUP_PACKS,
	topupPackIdSchema,
	topupPackIds,
} from "@wandit/contracts";

import { CreditsService } from "../../../credits/application/services/credits.service";
import {
	type CreditOwner,
	orgOwner,
	userOwner,
} from "../../../credits/domain/credit-owner";
import { ProductSettingsService } from "../../../settings/application/services/product-settings.service";
import { OrganizationsDisabledError } from "../../../settings/domain/errors/organizations-disabled.error";
import { SubscriptionsDisabledError } from "../../../settings/domain/errors/subscriptions-disabled.error";
import { WorkspaceNotSupportedError } from "../../../workspaces/domain/errors/workspace.errors";
import type { WorkspaceContext } from "../../../workspaces/domain/workspace-context";
import { ActiveSubscriptionExistsError } from "../../domain/errors/active-subscription-exists.error";
import { AmbiguousPaymentProviderWriteError } from "../../domain/errors/ambiguous-payment-provider-write.error";
import { BillingNotConfiguredError } from "../../domain/errors/billing-not-configured.error";
import { ManualSubscriptionUnsupportedError } from "../../domain/errors/manual-billing.errors";
import { NoActiveSubscriptionError } from "../../domain/errors/no-active-subscription.error";
import { PaymentPastDueError } from "../../domain/errors/payment-past-due.error";
import {
	BillingChangeIntentExpiredError,
	BillingChangeIntentInvalidError,
	SubscriptionChangePendingError,
	YearlyToMonthlyUnsupportedError,
} from "../../domain/errors/subscription-change.errors";
import {
	PAYMENT_PROVIDER,
	type PaymentProvider,
	type SubscriptionChangeProviderResult,
} from "../../domain/ports/payment-provider.port";
import { mapSubscriptionRow } from "../../infrastructure/mappers/subscription.mapper";
import {
	type BillingChangeIntentRow,
	BillingChangeIntentsRepository,
} from "../../infrastructure/persistence/billing-change-intents.repository";
import {
	type BillingCheckoutAttemptRow,
	BillingCheckoutAttemptsRepository,
} from "../../infrastructure/persistence/billing-checkout-attempts.repository";
import { BillingCustomersRepository } from "../../infrastructure/persistence/billing-customers.repository";
import { CancellationReasonsRepository } from "../../infrastructure/persistence/cancellation-reasons.repository";
import { OrganizationBillingCustomersRepository } from "../../infrastructure/persistence/organization-billing-customers.repository";
import { SubscriptionsRepository } from "../../infrastructure/persistence/subscriptions.repository";
import { BillingCustomerService } from "./billing-customer.service";
import { StripeSubscriptionSyncService } from "./stripe-subscription-sync.service";

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
		@Inject(StripeSubscriptionSyncService)
		private readonly subscriptionSyncService: StripeSubscriptionSyncService,
		@Inject(BillingCheckoutAttemptsRepository)
		private readonly checkoutAttemptsRepository: BillingCheckoutAttemptsRepository,
		@Inject(BillingChangeIntentsRepository)
		private readonly changeIntentsRepository: BillingChangeIntentsRepository,
		@Inject(OrganizationBillingCustomersRepository)
		private readonly organizationBillingCustomersRepository: OrganizationBillingCustomersRepository,
		@Inject(ProductSettingsService)
		private readonly productSettingsService: ProductSettingsService,
		@Inject(CancellationReasonsRepository)
		private readonly cancellationReasonsRepository: CancellationReasonsRepository,
	) {}

	/**
	 * Resolves the request's billing scope from the workspace header context.
	 * Personal scope (no workspace / omitted) is byte-identical to pre-teams.
	 * Org scope additionally enforces the organizationsEnabled kill switch —
	 * only for admissions; webhooks always honor paid org money regardless.
	 */
	private async resolveBillingScope(
		user: Pick<AuthUser, "id">,
		workspace: WorkspaceContext | undefined,
		options: { admission: boolean },
	): Promise<{ organizationId: string | null; owner: CreditOwner }> {
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

	/** Org workspaces buy Business; personal buys Pro. Never the other pairing. */
	private assertPlanMatchesScope(
		plan: "pro" | "business",
		organizationId: string | null,
	): void {
		const required = organizationId ? "business" : "pro";

		if (plan !== required) {
			throw new WorkspaceNotSupportedError(
				organizationId
					? "Team workspaces use the Business plan"
					: "The Business plan requires a team workspace",
			);
		}
	}

	plans(): BillingPlansResponse {
		return {
			plans: billingPlanIds.map((plan) => ({
				basePer100Usd: BILLING_CATALOG.plans[plan].basePer100Usd,
				features: BILLING_CATALOG.plans[plan].features,
				id: plan,
				tiers: CREDIT_TIERS.map((tierCredits) => ({
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
			// CreditsService balances are internal centi-credits; the API carries
			// decimal credits.
			balance: {
				balance: centiCreditsToCredits(balance.balance),
				plan: centiCreditsToCredits(balance.plan),
				promo: centiCreditsToCredits(balance.promo),
				settledBalance: centiCreditsToCredits(balance.settledBalance),
				settledPlan: centiCreditsToCredits(balance.settledPlan),
				settledPromo: centiCreditsToCredits(balance.settledPromo),
				settledTopup: centiCreditsToCredits(balance.settledTopup),
				topup: centiCreditsToCredits(balance.topup),
			},
			subscription: subscription ? mapSubscriptionRow(subscription) : null,
		};
	}

	async hasActiveSubscription(userId: string): Promise<boolean> {
		const subscription = await this.subscriptionsRepository.findActiveByOwner(
			userOwner(userId),
		);

		return subscription !== null && this.isEntitled(subscription.status);
	}

	async checkout(
		user: AuthUser,
		body: CreateBillingCheckoutBody,
		workspace?: WorkspaceContext,
	): Promise<BillingCheckoutResponse> {
		const scope = await this.resolveBillingScope(user, workspace, {
			admission: true,
		});
		this.assertPlanMatchesScope(body.plan, scope.organizationId);
		const visibleSubscription =
			await this.subscriptionsRepository.findActiveByOwner(scope.owner);

		if (visibleSubscription) {
			this.throwCheckoutBlocked(visibleSubscription.status);
		}

		const customer = scope.organizationId
			? await this.billingCustomerService.ensureOrgCustomer(
					scope.organizationId,
					user,
				)
			: await this.billingCustomerService.ensureCustomer(user);
		await this.expireStaleCheckoutAttempts(scope.owner, "subscription");
		const attemptId = randomUUID();
		const lookupKey = priceLookupKey(
			body.plan,
			body.tierCredits,
			body.interval,
		);

		await this.checkoutAttemptsRepository.withOwnerLock(
			scope.owner,
			async (tx) => {
				const lockedSubscription =
					await this.subscriptionsRepository.findActiveByOwner(scope.owner, tx);

				if (lockedSubscription) {
					this.throwCheckoutBlocked(lockedSubscription.status);
				}

				const open = await this.checkoutAttemptsRepository.findOpenForOwner(
					scope.owner,
					"subscription",
					tx,
				);

				if (open.length > 0) {
					throw this.checkoutPendingError();
				}

				const providerSubscriptions =
					await this.paymentProvider.listSubscriptionsForCustomer(
						customer.providerCustomerId,
					);
				const entitledSubscription = providerSubscriptions.find(
					(subscription) => this.isEntitled(subscription.status),
				);
				const blockingSubscription =
					entitledSubscription ??
					providerSubscriptions.find((subscription) =>
						this.isNonTerminal(subscription.status),
					);

				if (blockingSubscription) {
					this.throwCheckoutBlocked(blockingSubscription.status);
				}

				await this.checkoutAttemptsRepository.create(
					{
						id: attemptId,
						organizationId: scope.organizationId,
						priceLookupKey: lookupKey,
						purpose: "subscription",
						userId: user.id,
					},
					tx,
				);
			},
		);

		let checkout: Awaited<
			ReturnType<PaymentProvider["createSubscriptionCheckout"]>
		>;

		try {
			checkout = await this.paymentProvider.createSubscriptionCheckout({
				attemptId,
				customerId: customer.providerCustomerId,
				email: user.email,
				interval: body.interval,
				organizationId: scope.organizationId,
				plan: body.plan,
				tierCredits: body.tierCredits,
				userId: user.id,
			});
		} catch (error) {
			await this.handleCheckoutCreationFailure(attemptId, user.id, error);
			throw error;
		}

		const attached = await this.checkoutAttemptsRepository.withUserLock(
			user.id,
			(tx) =>
				this.checkoutAttemptsRepository.attachSession(
					attemptId,
					checkout.id,
					tx,
				),
		);

		if (!attached) {
			await this.compensateUnattachedCheckout(attemptId, checkout.id, user.id);
			throw new Error(
				`Checkout attempt ${attemptId} could not attach its session`,
			);
		}

		try {
			if (scope.organizationId) {
				await this.organizationBillingCustomersRepository.setOpenCheckoutSessionId(
					scope.organizationId,
					checkout.id,
				);
			} else {
				await this.billingCustomersRepository.setOpenCheckoutSessionId(
					user.id,
					checkout.id,
				);
			}
		} catch (error) {
			this.logger.warn(
				`Checkout attempt ${attemptId} attached but legacy customer session pointer could not be updated: ${this.errorMessage(error)}`,
			);
		}

		return { url: checkout.url };
	}

	async topup(
		user: AuthUser,
		body: CreateBillingTopupBody,
		workspace?: WorkspaceContext,
	): Promise<BillingCheckoutResponse> {
		const scope = await this.resolveBillingScope(user, workspace, {
			admission: true,
		});
		const customer = scope.organizationId
			? await this.billingCustomerService.ensureOrgCustomer(
					scope.organizationId,
					user,
				)
			: await this.billingCustomerService.ensureCustomer(user);
		await this.expireStaleCheckoutAttempts(scope.owner, "topup");
		const attemptId = randomUUID();

		await this.checkoutAttemptsRepository.withOwnerLock(
			scope.owner,
			async (tx) => {
				const open = await this.checkoutAttemptsRepository.findOpenForOwner(
					scope.owner,
					"topup",
					tx,
				);

				if (open.length > 0) {
					throw this.checkoutPendingError();
				}

				await this.checkoutAttemptsRepository.create(
					{
						id: attemptId,
						organizationId: scope.organizationId,
						packId: body.packId,
						purpose: "topup",
						userId: user.id,
					},
					tx,
				);
			},
		);

		const pack = TOPUP_PACKS[body.packId];
		let checkout: Awaited<ReturnType<PaymentProvider["createTopupCheckout"]>>;

		try {
			checkout = await this.paymentProvider.createTopupCheckout({
				attemptId,
				credits: pack.credits,
				customerId: customer.providerCustomerId,
				organizationId: scope.organizationId,
				packId: body.packId,
				userId: user.id,
			});
		} catch (error) {
			await this.handleCheckoutCreationFailure(attemptId, user.id, error);
			throw error;
		}

		const attached = await this.checkoutAttemptsRepository.withUserLock(
			user.id,
			(tx) =>
				this.checkoutAttemptsRepository.attachSession(
					attemptId,
					checkout.id,
					tx,
				),
		);

		if (!attached) {
			await this.compensateUnattachedCheckout(attemptId, checkout.id, user.id);
			throw new Error(
				`Top-up checkout attempt ${attemptId} could not attach its session`,
			);
		}

		return { url: checkout.url };
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

		// Structural isolation: personal scope can only ever reach the personal
		// customer, org scope only the org's — the two tables partition Stripe
		// customer ids (design §5.1/§5.4).
		const customer = scope.organizationId
			? await this.organizationBillingCustomersRepository.findByOrganizationId(
					scope.organizationId,
				)
			: await this.billingCustomersRepository.findByUserId(user.id);

		if (!customer) {
			throw new NoActiveSubscriptionError();
		}

		const url = await this.paymentProvider.createPortalSession(
			customer.providerCustomerId,
		);

		return { url };
	}

	async previewChange(
		user: AuthUser,
		body: PreviewBillingSubscriptionChangeBody,
		workspace?: WorkspaceContext,
	): Promise<BillingSubscriptionChangePreviewResponse> {
		const scope = await this.resolveBillingScope(user, workspace, {
			admission: true,
		});
		const subscription = await this.requireActiveSubscription(scope.owner);

		if (isManualSubscription(subscription)) {
			throw new ManualSubscriptionUnsupportedError();
		}

		this.assertSupportedIntervalChange(subscription.interval, body.interval);

		if (
			await this.paymentProvider.hasPendingSubscriptionUpdate(
				subscription.providerSubscriptionId,
			)
		) {
			throw new SubscriptionChangePendingError();
		}

		const plan = body.plan ?? billingPlanIdSchema.parse(subscription.plan);
		this.assertPlanMatchesScope(plan, scope.organizationId);
		const targetLookupKey = priceLookupKey(
			plan,
			body.tierCredits,
			body.interval,
		);

		const cancelsPendingDowngrade =
			targetLookupKey === subscription.priceLookupKey &&
			subscription.pendingTierCredits !== null;

		if (
			targetLookupKey === subscription.priceLookupKey &&
			!cancelsPendingDowngrade
		) {
			throw new BillingChangeIntentInvalidError();
		}

		const prorationDate = new Date(Math.floor(Date.now() / 1000) * 1000);
		const isDowngrade =
			subscription.interval === body.interval &&
			body.tierCredits < subscription.tierCredits;
		const anchorReset = this.anchorResetsForChange({
			cancelsPendingDowngrade,
			isDowngrade,
		});
		const preview = cancelsPendingDowngrade
			? { amountDueMinor: 0, currency: "usd" }
			: await this.paymentProvider.previewSubscriptionChange({
					billingCycleAnchorNow: anchorReset,
					newPriceLookupKey: targetLookupKey,
					prorationDate,
					providerSubscriptionId: subscription.providerSubscriptionId,
				});
		const balance = await this.creditsService.getBalance(scope.owner);
		const expiresAt = new Date(prorationDate.getTime() + 15 * 60 * 1000);
		const intent = await this.changeIntentsRepository.create({
			anchorReset,
			currency: preview.currency.toLowerCase(),
			currentPriceLookupKey: subscription.priceLookupKey,
			expiresAt,
			organizationId: scope.organizationId,
			previewTotalMinor: isDowngrade ? 0 : Math.max(0, preview.amountDueMinor),
			prorationDate,
			status: "open",
			subscriptionId: subscription.id,
			targetPriceLookupKey: targetLookupKey,
			userId: user.id,
		});

		return {
			amountDueMinor: intent.previewTotalMinor,
			creditsDelta: this.previewCreditsDelta(
				body,
				balance.plan,
				intent.anchorReset,
			),
			currency: intent.currency,
			expiresAt: intent.expiresAt.toISOString(),
			intentId: intent.id,
		};
	}

	async change(
		user: AuthUser,
		body: ChangeBillingSubscriptionBody,
		workspace?: WorkspaceContext,
	): Promise<BillingSubscriptionChangeOutcomeResponse> {
		const scope = await this.resolveBillingScope(user, workspace, {
			admission: true,
		});
		const currentSubscription =
			await this.subscriptionsRepository.findActiveByOwner(scope.owner);

		if (isManualSubscription(currentSubscription)) {
			throw new ManualSubscriptionUnsupportedError();
		}

		const customer = scope.organizationId
			? await this.organizationBillingCustomersRepository.findByOrganizationId(
					scope.organizationId,
				)
			: await this.billingCustomersRepository.findByUserId(user.id);

		if (!customer) {
			throw new NoActiveSubscriptionError();
		}

		const initialIntent = await this.changeIntentsRepository.findById(
			body.intentId,
		);

		// The intent must belong to BOTH this actor and this workspace scope: an
		// org intent consumed from personal scope (or vice versa) is invalid.
		if (
			!initialIntent ||
			initialIntent.userId !== user.id ||
			(initialIntent.organizationId ?? null) !== scope.organizationId
		) {
			throw new BillingChangeIntentInvalidError();
		}

		if (
			initialIntent.status === "open" &&
			initialIntent.expiresAt > new Date()
		) {
			const initialSubscription =
				await this.subscriptionsRepository.findActiveByOwner(scope.owner);

			if (
				initialSubscription?.id === initialIntent.subscriptionId &&
				initialSubscription.priceLookupKey ===
					initialIntent.currentPriceLookupKey &&
				(await this.paymentProvider.hasPendingSubscriptionUpdate(
					initialSubscription.providerSubscriptionId,
				))
			) {
				throw new SubscriptionChangePendingError();
			}
		}

		const operation = await this.changeIntentsRepository.withOwnerLock(
			scope.owner,
			async (tx) => {
				const now = new Date();
				const intent = await this.changeIntentsRepository.findById(
					body.intentId,
					tx,
				);

				if (
					!intent ||
					intent.userId !== user.id ||
					(intent.organizationId ?? null) !== scope.organizationId
				) {
					return { error: "invalid" as const };
				}

				if (
					intent.status === "expired" ||
					(intent.status === "open" && intent.expiresAt <= now)
				) {
					await this.changeIntentsRepository.expireIfOpen(intent.id, now, tx);

					return { error: "expired" as const };
				}

				const target = parsePriceLookupKey(intent.targetPriceLookupKey);
				const original = parsePriceLookupKey(intent.currentPriceLookupKey);

				if (!target || !original) {
					return { error: "invalid" as const };
				}

				this.assertSupportedIntervalChange(original.interval, target.interval);
				const isDowngrade =
					target.interval === original.interval &&
					target.tierCredits < original.tierCredits;
				const cancelsDowngrade =
					intent.targetPriceLookupKey === intent.currentPriceLookupKey;

				if (intent.status === "consumed") {
					return this.persistedChangeResult(intent)
						? {
								cancelsDowngrade,
								intent,
								isDowngrade,
								kind: "replay" as const,
							}
						: { error: "invalid" as const };
				}

				if (intent.status !== "open" && intent.status !== "processing") {
					return { error: "invalid" as const };
				}

				const subscription =
					await this.subscriptionsRepository.findActiveByOwner(scope.owner, tx);

				if (
					!subscription ||
					subscription.id !== intent.subscriptionId ||
					(intent.status === "open" &&
						subscription.priceLookupKey !== intent.currentPriceLookupKey) ||
					(intent.status === "open" &&
						cancelsDowngrade &&
						subscription.pendingTierCredits === null)
				) {
					return { error: "invalid" as const };
				}

				if (intent.status === "open") {
					const competing =
						await this.changeIntentsRepository.findOtherProcessingForSubscription(
							intent.subscriptionId,
							intent.id,
							tx,
						);

					if (competing) {
						throw new SubscriptionChangePendingError();
					}

					const started =
						await this.changeIntentsRepository.beginProviderAttempt(
							intent.id,
							user.id,
							now,
							tx,
						);

					if (!started) {
						return { error: "invalid" as const };
					}

					return {
						cancelsDowngrade,
						intent: started,
						isDowngrade,
						kind: "execute" as const,
						subscription,
						target,
					};
				}

				return {
					cancelsDowngrade,
					intent,
					isDowngrade,
					kind: "execute" as const,
					subscription,
					target,
				};
			},
		);

		if ("error" in operation) {
			if (operation.error === "expired") {
				throw new BillingChangeIntentExpiredError();
			}

			throw new BillingChangeIntentInvalidError();
		}

		let completedIntent: BillingChangeIntentRow;

		if (operation.kind === "replay") {
			completedIntent = operation.intent;
		} else {
			const idempotencyKey = scope.organizationId
				? `sub-change:org:${scope.organizationId}:${operation.intent.id}`
				: `sub-change:${user.id}:${operation.intent.id}`;
			let scheduleId: string | null = null;
			let providerResult: SubscriptionChangeProviderResult | null = null;
			const releasesPendingDowngrade =
				!operation.cancelsDowngrade &&
				!operation.isDowngrade &&
				operation.subscription.pendingTierCredits !== null;

			if (releasesPendingDowngrade) {
				try {
					await this.paymentProvider.cancelScheduledSubscriptionDowngrade(
						operation.subscription.providerSubscriptionId,
						`${idempotencyKey}:release-schedule`,
					);
				} catch (error) {
					if (error instanceof AmbiguousPaymentProviderWriteError) {
						throw error;
					}

					this.logDefiniteChangeFailure(operation.intent.id, error);
					providerResult = { outcome: "failed" };
				}

				if (!providerResult) {
					// Persist the completed release as its own saga step. If the
					// following price update times out or is rejected, a retry cannot
					// resurrect a local downgrade whose remote schedule is already gone.
					providerResult = await this.clearPendingDowngradeForProcessingChange(
						scope.owner,
						operation.intent.id,
						operation.subscription.providerSubscriptionId,
					);
				}
			}

			if (!providerResult) {
				try {
					if (operation.cancelsDowngrade) {
						await this.paymentProvider.cancelScheduledSubscriptionDowngrade(
							operation.subscription.providerSubscriptionId,
							`${idempotencyKey}:cancel-schedule`,
						);
						providerResult = { outcome: "applied" };
					} else if (operation.isDowngrade) {
						scheduleId =
							await this.paymentProvider.scheduleSubscriptionDowngrade({
								idempotencyKey,
								newPriceLookupKey: operation.intent.targetPriceLookupKey,
								providerSubscriptionId:
									operation.subscription.providerSubscriptionId,
							});
						providerResult = { outcome: "applied" };
					} else {
						providerResult = await this.paymentProvider.changeSubscription({
							// The preview persisted this decision on the intent; recomputing
							// it from live state could let preview and execution disagree.
							billingCycleAnchorNow: operation.intent.anchorReset,
							idempotencyKey,
							newPriceLookupKey: operation.intent.targetPriceLookupKey,
							prorationDate: operation.intent.prorationDate,
							providerSubscriptionId:
								operation.subscription.providerSubscriptionId,
						});
					}
				} catch (error) {
					if (error instanceof AmbiguousPaymentProviderWriteError) {
						throw error;
					}

					this.logDefiniteChangeFailure(operation.intent.id, error);
					providerResult = { outcome: "failed" };
				}
			}

			if (!providerResult) {
				throw new Error(
					`Subscription change ${operation.intent.id} produced no provider outcome`,
				);
			}

			completedIntent = await this.changeIntentsRepository.withOwnerLock(
				scope.owner,
				async (tx) => {
					const currentIntent = await this.changeIntentsRepository.findById(
						operation.intent.id,
						tx,
					);

					if (
						currentIntent?.status === "consumed" &&
						this.persistedChangeResult(currentIntent)
					) {
						return currentIntent;
					}

					if (currentIntent?.status !== "processing") {
						throw new Error(
							`Billing change intent ${operation.intent.id} lost its provider-attempt claim`,
						);
					}

					if (providerResult.outcome !== "failed" && operation.isDowngrade) {
						const pending =
							await this.subscriptionsRepository.setPendingTierCredits(
								operation.subscription.providerSubscriptionId,
								operation.target.tierCredits,
								tx,
							);
						const marked = scheduleId
							? await this.subscriptionsRepository.markPendingTierApplied(
									operation.subscription.providerSubscriptionId,
									scheduleId,
									tx,
								)
							: null;

						if (!pending || !marked) {
							throw new Error(
								`Scheduled downgrade ${operation.intent.id} could not be persisted`,
							);
						}
					} else if (providerResult.outcome !== "failed") {
						const cleared =
							await this.subscriptionsRepository.setPendingTierCredits(
								operation.subscription.providerSubscriptionId,
								null,
								tx,
							);

						if (!cleared) {
							throw new Error(
								`Subscription ${operation.subscription.providerSubscriptionId} disappeared while completing change ${operation.intent.id}`,
							);
						}
					}

					const completed =
						await this.changeIntentsRepository.completeProviderAttempt(
							{
								...(providerResult.hostedInvoiceUrl
									? {
											hostedInvoiceUrl: providerResult.hostedInvoiceUrl,
										}
									: {}),
								id: operation.intent.id,
								now: new Date(),
								outcome: providerResult.outcome,
								...(providerResult.pendingExpiresAt
									? {
											pendingExpiresAt: providerResult.pendingExpiresAt,
										}
									: {}),
								userId: user.id,
							},
							tx,
						);

					if (!completed) {
						throw new Error(
							`Billing change intent ${operation.intent.id} could not persist its provider result`,
						);
					}

					return completed;
				},
			);
		}

		const result = this.persistedChangeResult(completedIntent);

		if (!result) {
			throw new Error(
				`Billing change intent ${completedIntent.id} has no persisted provider result`,
			);
		}

		if (
			!operation.isDowngrade &&
			!operation.cancelsDowngrade &&
			result.outcome === "applied"
		) {
			await this.subscriptionSyncService.syncFromStripe(
				customer.providerCustomerId,
			);
		}

		const view = await this.getSubscriptionView(user.id, workspace);

		if (!view.subscription) {
			throw new NoActiveSubscriptionError();
		}

		return {
			balance: view.balance,
			...(result.hostedInvoiceUrl
				? { hostedInvoiceUrl: result.hostedInvoiceUrl }
				: {}),
			outcome: result.outcome,
			...(result.pendingExpiresAt
				? { pendingExpiresAt: result.pendingExpiresAt.toISOString() }
				: {}),
			subscription: view.subscription,
		};
	}

	async sync(
		user: AuthUser,
		workspace?: WorkspaceContext,
	): Promise<BillingSubscriptionViewResponse> {
		const scope = await this.resolveBillingScope(user, workspace, {
			admission: false,
		});
		const customer = scope.organizationId
			? await this.organizationBillingCustomersRepository.findByOrganizationId(
					scope.organizationId,
				)
			: await this.billingCustomersRepository.findByUserId(user.id);

		if (!customer) {
			return this.getSubscriptionView(user.id, workspace);
		}

		try {
			await this.subscriptionSyncService.syncFromStripe(
				customer.providerCustomerId,
			);
		} catch (error) {
			if (!(error instanceof BillingNotConfiguredError)) {
				throw error;
			}
		}

		return this.getSubscriptionView(user.id, workspace);
	}

	async cancel(
		user: AuthUser,
		body: BillingCancelRequest,
		workspace?: WorkspaceContext,
	): Promise<BillingSubscriptionViewResponse> {
		const scope = await this.resolveBillingScope(user, workspace, {
			admission: false,
		});
		const subscription = await this.requireActiveSubscription(scope.owner);
		const cancellationReason =
			await this.cancellationReasonsRepository.createPending({
				details: body.details ?? null,
				organizationId: subscription.organizationId,
				reason: body.reason,
				stripeSubscriptionId: subscription.providerSubscriptionId,
				submittedByUserId: user.id,
				subscriptionId: subscription.id,
				subscriptionUserId: subscription.userId,
			});

		if (!isManualSubscription(subscription)) {
			try {
				await this.paymentProvider.setCancelAtPeriodEnd(
					subscription.providerSubscriptionId,
					true,
				);
			} catch (error) {
				await this.markCancellationProviderFailure(cancellationReason.id);
				throw error;
			}
		}

		const scheduled =
			await this.cancellationReasonsRepository.markPendingOutcome(
				cancellationReason.id,
				"scheduled",
			);

		if (!scheduled) {
			throw new Error(
				`Cancellation reason ${cancellationReason.id} could not be marked scheduled`,
			);
		}

		await this.subscriptionsRepository.updateCancelAtPeriodEnd(
			subscription.providerSubscriptionId,
			true,
		);

		return this.getSubscriptionView(user.id, workspace);
	}

	async resume(
		user: AuthUser,
		workspace?: WorkspaceContext,
	): Promise<BillingSubscriptionViewResponse> {
		const scope = await this.resolveBillingScope(user, workspace, {
			admission: false,
		});
		const subscription = await this.requireActiveSubscription(scope.owner);

		if (!isManualSubscription(subscription)) {
			// The controller no longer applies SubscriptionsEnabledGuard (a
			// manual resume must work in an offline-only rollout), so the
			// Stripe path enforces the kill switch here.
			const settings = await this.productSettingsService.get();

			if (!settings.paidSubscriptionsEnabled) {
				throw new SubscriptionsDisabledError();
			}

			await this.paymentProvider.setCancelAtPeriodEnd(
				subscription.providerSubscriptionId,
				false,
			);
		}
		await this.subscriptionsRepository.updateCancelAtPeriodEnd(
			subscription.providerSubscriptionId,
			false,
		);
		await this.cancellationReasonsRepository.markNewestScheduledResumed(
			subscription.providerSubscriptionId,
		);

		return this.getSubscriptionView(user.id, workspace);
	}

	private async markCancellationProviderFailure(
		cancellationReasonId: string,
	): Promise<void> {
		try {
			const marked =
				await this.cancellationReasonsRepository.markPendingOutcome(
					cancellationReasonId,
					"provider_failed",
				);

			if (!marked) {
				this.logger.warn(
					`Cancellation reason ${cancellationReasonId} was not pending after the provider failed`,
				);
			}
		} catch (persistenceError) {
			this.logger.warn(
				`Could not mark cancellation reason ${cancellationReasonId} provider_failed after provider error: ${persistenceError instanceof Error ? persistenceError.message : String(persistenceError)}`,
				persistenceError instanceof Error ? persistenceError.stack : undefined,
			);
		}
	}

	private async requireActiveSubscription(owner: CreditOwner) {
		const subscription =
			await this.subscriptionsRepository.findActiveByOwner(owner);

		if (!subscription) {
			throw new NoActiveSubscriptionError();
		}

		return subscription;
	}

	private isEntitled(status: string) {
		return (ENTITLED_SUBSCRIPTION_STATUSES as readonly string[]).includes(
			status,
		);
	}

	private isNonTerminal(status: string) {
		return status !== "canceled" && status !== "incomplete_expired";
	}

	private throwCheckoutBlocked(status: string): never {
		if (status === "past_due") {
			throw new PaymentPastDueError();
		}

		throw new ActiveSubscriptionExistsError();
	}

	private async expireStaleCheckoutAttempts(
		owner: CreditOwner,
		purpose: "subscription" | "topup",
	): Promise<void> {
		const attempts = await this.checkoutAttemptsRepository.findOpenForOwner(
			owner,
			purpose,
		);
		const staleBefore = Date.now() - 30 * 60 * 1000;

		for (const attempt of attempts) {
			if (attempt.createdAt.getTime() > staleBefore) {
				continue;
			}

			try {
				const providerSessionId =
					attempt.providerSessionId ??
					(await this.recoverUnattachedCheckoutAttempt(attempt));

				if (!providerSessionId) {
					continue;
				}

				const session =
					await this.paymentProvider.retrieveCheckoutSession(providerSessionId);

				if (session.status === "complete") {
					// Fulfillment owns the completed transition. Leaving this row open
					// makes a missing webhook visible and retryable instead of discarding it.
					continue;
				}

				if (session.status === "open") {
					const terminalStatus =
						await this.paymentProvider.expireCheckoutSession(providerSessionId);

					if (terminalStatus === "complete") {
						// Completion won the retrieve/expire race. The fulfillment webhook
						// must still be able to attach and complete this attempt.
						continue;
					}

					if (terminalStatus !== "expired") {
						this.logger.warn(
							`Checkout attempt ${attempt.id} remained ${String(terminalStatus)} after provider expiration and stays open`,
						);
						continue;
					}
				} else if (session.status !== "expired") {
					this.logger.warn(
						`Checkout attempt ${attempt.id} returned unknown provider status ${String(session.status)} and remains open`,
					);
					continue;
				}

				await this.checkoutAttemptsRepository.withOwnerLock(owner, (tx) =>
					this.checkoutAttemptsRepository.markExpired(attempt.id, tx),
				);
			} catch (error) {
				this.logger.warn(
					`Could not reconcile stale checkout attempt ${attempt.id}; it remains open: ${this.errorMessage(error)}`,
				);
			}
		}
	}

	private async recoverUnattachedCheckoutAttempt(
		attempt: BillingCheckoutAttemptRow,
	): Promise<string | null> {
		// Recovery must replay the ORIGINAL owner's provider call byte-for-byte:
		// the org customer + org idempotency key for org attempts, personal for
		// personal. Resolving via the actor's personal customer here minted a
		// session on the WRONG Stripe customer and, for org-first owners with no
		// personal customer row, permanently locked the org out of checkout
		// (confirmed money-review finding).
		const attemptOwner = attempt.organizationId
			? orgOwner(attempt.organizationId)
			: userOwner(attempt.userId);
		const customer = attempt.organizationId
			? await this.organizationBillingCustomersRepository.findByOrganizationId(
					attempt.organizationId,
				)
			: await this.billingCustomersRepository.findByUserId(attempt.userId);

		if (!customer) {
			throw new Error(
				`Checkout attempt ${attempt.id} has no billing customer for idempotent session recovery`,
			);
		}

		let recovered: Awaited<
			ReturnType<PaymentProvider["createSubscriptionCheckout"]>
		>;

		if (attempt.purpose === "subscription") {
			const parsed = attempt.priceLookupKey
				? parsePriceLookupKey(attempt.priceLookupKey)
				: null;

			if (!parsed || attempt.packId !== null) {
				throw new Error(
					`Subscription checkout attempt ${attempt.id} violates its persisted purpose invariants`,
				);
			}

			recovered = await this.paymentProvider.createSubscriptionCheckout({
				attemptId: attempt.id,
				customerId: customer.providerCustomerId,
				email: "",
				interval: parsed.interval,
				organizationId: attempt.organizationId,
				plan: parsed.plan,
				tierCredits: parsed.tierCredits,
				userId: attempt.userId,
			});
		} else {
			const packId = topupPackIdSchema.safeParse(attempt.packId);

			if (!packId.success || attempt.priceLookupKey !== null) {
				throw new Error(
					`Top-up checkout attempt ${attempt.id} violates its persisted purpose invariants`,
				);
			}

			const pack = TOPUP_PACKS[packId.data];
			recovered = await this.paymentProvider.createTopupCheckout({
				attemptId: attempt.id,
				credits: pack.credits,
				customerId: customer.providerCustomerId,
				organizationId: attempt.organizationId,
				packId: packId.data,
				userId: attempt.userId,
			});
		}

		const attached = await this.checkoutAttemptsRepository.withOwnerLock(
			attemptOwner,
			(tx) =>
				this.checkoutAttemptsRepository.attachSession(
					attempt.id,
					recovered.id,
					tx,
				),
		);

		if (attached?.providerSessionId) {
			return attached.providerSessionId;
		}

		const concurrentlyAttached = await this.checkoutAttemptsRepository.findById(
			attempt.id,
		);

		if (concurrentlyAttached?.providerSessionId) {
			return concurrentlyAttached.providerSessionId;
		}

		throw new Error(
			`Recovered checkout session ${recovered.id} could not attach to attempt ${attempt.id}`,
		);
	}

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
				`Checkout attempt ${attemptId} remains created after an ambiguous provider failure and will be recovered with the same idempotency key: ${this.errorMessage(error)}`,
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

	private assertSupportedIntervalChange(
		currentInterval: string,
		targetInterval: string,
	): void {
		if (currentInterval === "year" && targetInterval === "month") {
			throw new YearlyToMonthlyUnsupportedError();
		}
	}

	/**
	 * Ruling 7: every non-downgrade, non-cancel change (same-interval tier
	 * upgrade, plan upgrade, month->year) resets the Stripe billing anchor —
	 * the customer pays the full new price now, Stripe credits the unused
	 * remainder of the old price, and fulfillment grants the full allotment.
	 * Downgrades are scheduled at period end and a pending-downgrade cancel
	 * changes nothing about the cycle.
	 */
	private anchorResetsForChange(change: {
		cancelsPendingDowngrade: boolean;
		isDowngrade: boolean;
	}): boolean {
		return !change.cancelsPendingDowngrade && !change.isDowngrade;
	}

	/**
	 * Preview delta in DECIMAL display credits. tierCredits are whole credits
	 * (Stripe tier identity) while planBalanceCentiCredits is the internal
	 * centi-credit pool — the math runs in centi-credits and divides once.
	 */
	private previewCreditsDelta(
		target: PreviewBillingSubscriptionChangeBody,
		planBalanceCentiCredits: number,
		anchorReset: boolean,
	): number {
		if (!anchorReset) {
			return 0;
		}

		// Every anchor-reset change is a capped refill. This is the exact ledger
		// delta: expire balance above one target allotment, then grant it.
		const targetCentiCredits = creditsToCentiCredits(target.tierCredits);
		const positivePlanBalance = Math.max(0, planBalanceCentiCredits);
		const expired = Math.max(0, positivePlanBalance - targetCentiCredits);

		return centiCreditsToCredits(targetCentiCredits - expired);
	}

	private persistedChangeResult(
		intent: BillingChangeIntentRow,
	): SubscriptionChangeProviderResult | null {
		if (
			intent.providerOutcome !== "applied" &&
			intent.providerOutcome !== "failed" &&
			intent.providerOutcome !== "payment_required"
		) {
			return null;
		}

		return {
			...(intent.providerHostedInvoiceUrl
				? { hostedInvoiceUrl: intent.providerHostedInvoiceUrl }
				: {}),
			outcome: intent.providerOutcome,
			...(intent.providerPendingExpiresAt
				? { pendingExpiresAt: intent.providerPendingExpiresAt }
				: {}),
		};
	}

	private async clearPendingDowngradeForProcessingChange(
		owner: CreditOwner,
		intentId: string,
		providerSubscriptionId: string,
	): Promise<SubscriptionChangeProviderResult | null> {
		// Same owner lock as the change execution: this saga step must never
		// interleave with another owner's concurrent change on the same pool.
		return this.changeIntentsRepository.withOwnerLock(owner, async (tx) => {
			const intent = await this.changeIntentsRepository.findById(intentId, tx);

			if (intent?.status !== "processing" && intent?.status !== "consumed") {
				throw new Error(
					`Billing change intent ${intentId} lost its provider-attempt claim after releasing its downgrade schedule`,
				);
			}

			const cleared = await this.subscriptionsRepository.setPendingTierCredits(
				providerSubscriptionId,
				null,
				tx,
			);

			if (!cleared) {
				throw new Error(
					`Subscription ${providerSubscriptionId} disappeared after releasing its downgrade schedule`,
				);
			}

			if (intent.status !== "consumed") {
				return null;
			}

			const result = this.persistedChangeResult(intent);

			if (!result) {
				throw new Error(
					`Consumed billing change intent ${intentId} has no persisted provider result`,
				);
			}

			return result;
		});
	}

	private logDefiniteChangeFailure(intentId: string, error: unknown): void {
		this.logger.error(
			`Subscription change ${intentId} ended in a definite provider failure: ${this.errorMessage(error)}`,
			error instanceof Error ? error.stack : undefined,
		);
	}

	private errorMessage(error: unknown): string {
		return error instanceof Error ? error.message : String(error);
	}
}
