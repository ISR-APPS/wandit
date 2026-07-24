import { Inject, Injectable, Logger } from "@nestjs/common";
import { CHECKOUT_PURPOSE, type CreditBucket } from "@wandit/contracts";
import type Stripe from "stripe";

import { CreditsService } from "../../../credits/application/services/credits.service";
import {
	WEBHOOK_ORDER_REFUND_HANDLER,
	type WebhookOrderRefundHandler,
} from "../../domain/ports/webhook-order-refund-handler.port";
import {
	BillingCreditLedgerRepository,
	type BillingCreditLedgerRow,
} from "../../infrastructure/persistence/billing-credit-ledger.repository";
import { StripeProvider } from "../../infrastructure/stripe/stripe.provider";

const BUCKET_ORDER: CreditBucket[] = ["plan", "topup"];

type ClawbackFraction = {
	denominator: number;
	numerator: number;
};

type ClawbackMode = "cumulative" | "incremental";

type BucketAllocation = {
	alreadyRevoked: number;
	bucket: CreditBucket;
	delta: number;
	originalGranted: number;
	remainder: bigint;
	target: number;
};

type FullChargeRefundState = {
	providerRefundId: string;
	refundStatus: "pending" | "succeeded";
};

@Injectable()
export class PaymentRefundsService {
	private readonly logger = new Logger(PaymentRefundsService.name);

	constructor(
		@Inject(BillingCreditLedgerRepository)
		private readonly billingCreditLedgerRepository: BillingCreditLedgerRepository,
		@Inject(CreditsService)
		private readonly creditsService: CreditsService,
		@Inject(WEBHOOK_ORDER_REFUND_HANDLER)
		private readonly orderRefundHandler: WebhookOrderRefundHandler,
		@Inject(StripeProvider)
		private readonly stripeProvider: StripeProvider,
	) {}

	async handleChargeRefunded(charge: Stripe.Charge): Promise<boolean> {
		const refundAmounts = this.validatedRefundAmounts(charge);

		if (!refundAmounts) {
			return false;
		}

		const { amountCaptured, amountRefunded } = refundAmounts;
		const paymentIntentId = this.expandableId(charge.payment_intent);
		const orderHandled = paymentIntentId
			? amountRefunded >= amountCaptured
				? await this.handleFullOrderChargeRefunded({
						amountCaptured,
						amountRefunded,
						charge,
						paymentIntentId,
					})
				: await this.orderRefundHandler.handleChargeRefundedByPaymentIntent({
						amountCaptured,
						amountRefunded,
						chargeId: charge.id,
						paymentIntentId,
					})
			: false;

		if (orderHandled) {
			return true;
		}

		const handled = await this.revokePurchasedCredits({
			chargeId: charge.id,
			fraction: {
				denominator: amountCaptured,
				numerator: amountRefunded,
			},
			idempotencyKey: this.refundIdempotencyKey(charge),
			mode: "cumulative",
			paymentIntentId,
			reason: "charge_refunded",
		});

		if (!handled) {
			await this.deferRecognizedCheckoutUntilItsPaymentMappingExists(charge);
		}

		return handled;
	}

	async handleRefundUpdated(refund: Stripe.Refund): Promise<boolean> {
		const refundPaymentIntentId = this.expandableId(refund.payment_intent);

		if (refund.status !== "succeeded") {
			return this.orderRefundHandler.updateRefundStatus({
				paymentIntentId: refundPaymentIntentId,
				providerRefundId: refund.id,
				refundStatus: refund.status,
			});
		}

		/*
		 * A succeeded Refund is not necessarily a full-charge refund. Resolve a
		 * fresh cumulative Charge before allowing the order handler to terminalize
		 * anything; otherwise a one-cent manual refund could look "succeeded" and
		 * be mistaken for a full order reversal.
		 */
		const charge = await this.resolveRefundCharge(refund);
		const amounts = this.validatedRefundAmounts(charge);

		if (!amounts) {
			return false;
		}

		const chargePaymentIntentId = this.expandableId(charge.payment_intent);

		if (
			refundPaymentIntentId &&
			chargePaymentIntentId &&
			refundPaymentIntentId !== chargePaymentIntentId
		) {
			throw new Error(
				`Stripe refund ${refund.id} and charge ${charge.id} reference different payment intents`,
			);
		}

		const paymentIntentId = refundPaymentIntentId ?? chargePaymentIntentId;

		if (!paymentIntentId) {
			return false;
		}

		if (amounts.amountRefunded >= amounts.amountCaptured) {
			return this.handleFullOrderChargeRefunded({
				...amounts,
				additionalRefunds: [refund],
				charge,
				paymentIntentId,
			});
		}

		const handled =
			await this.orderRefundHandler.handleChargeRefundedByPaymentIntent({
				...amounts,
				chargeId: charge.id,
				paymentIntentId,
			});

		if (!handled) {
			return false;
		}

		const persisted = await this.orderRefundHandler.updateRefundStatus({
			paymentIntentId,
			providerRefundId: refund.id,
			refundStatus:
				amounts.amountRefunded < amounts.amountCaptured
					? "partial"
					: "succeeded",
		});

		if (!persisted) {
			throw new Error(
				`Stripe refund ${refund.id} matched an order but its lifecycle state could not be persisted`,
			);
		}

		return true;
	}

	private async handleFullOrderChargeRefunded(input: {
		additionalRefunds?: Stripe.Refund[];
		amountCaptured: number;
		amountRefunded: number;
		charge: Stripe.Charge;
		paymentIntentId: string;
	}): Promise<boolean> {
		const refundState = await this.resolveFullChargeRefundState(
			input.charge,
			input.amountCaptured,
			input.additionalRefunds,
		);

		if (!refundState) {
			return false;
		}

		const persisted = await this.orderRefundHandler.updateRefundStatus({
			paymentIntentId: input.paymentIntentId,
			providerRefundId: refundState.providerRefundId,
			refundStatus: refundState.refundStatus,
		});

		if (!persisted) {
			return false;
		}

		if (refundState.refundStatus === "pending") {
			return true;
		}

		const terminalized =
			await this.orderRefundHandler.handleChargeRefundedByPaymentIntent({
				amountCaptured: input.amountCaptured,
				amountRefunded: input.amountRefunded,
				chargeId: input.charge.id,
				paymentIntentId: input.paymentIntentId,
			});

		if (!terminalized) {
			throw new Error(
				`Stripe charge ${input.charge.id} recorded a succeeded order refund but could not terminalize its payment order`,
			);
		}

		return true;
	}

	private async resolveFullChargeRefundState(
		charge: Stripe.Charge,
		amountCaptured: number,
		additionalRefunds: Stripe.Refund[] = [],
	): Promise<FullChargeRefundState | null> {
		const eventState = this.fullChargeRefundState(
			[...additionalRefunds, ...(charge.refunds?.data ?? [])],
			amountCaptured,
		);

		if (eventState) {
			return eventState;
		}

		const refreshedCharge = await this.stripeProvider.retrieveCharge(charge.id);

		if (refreshedCharge.id !== charge.id) {
			throw new Error(
				`Stripe charge refresh for ${charge.id} returned ${refreshedCharge.id}`,
			);
		}

		return this.fullChargeRefundState(
			[...additionalRefunds, ...(refreshedCharge.refunds?.data ?? [])],
			amountCaptured,
		);
	}

	private fullChargeRefundState(
		refunds: Stripe.Refund[],
		amountCaptured: number,
	): FullChargeRefundState | null {
		const uniqueRefunds = new Map<string, Stripe.Refund>();

		for (const refund of refunds) {
			if (
				typeof refund.id === "string" &&
				Number.isSafeInteger(refund.amount) &&
				refund.amount > 0
			) {
				uniqueRefunds.set(refund.id, refund);
			}
		}

		const sortedRefunds = [...uniqueRefunds.values()].sort((left, right) => {
			const leftCreated = Number.isSafeInteger(left.created)
				? left.created
				: Number.MAX_SAFE_INTEGER;
			const rightCreated = Number.isSafeInteger(right.created)
				? right.created
				: Number.MAX_SAFE_INTEGER;

			return leftCreated === rightCreated
				? left.id.localeCompare(right.id)
				: leftCreated - rightCreated;
		});
		const succeededRefunds = sortedRefunds.filter(
			(refund) => refund.status === "succeeded",
		);
		let succeededAmount = 0;

		for (const refund of succeededRefunds) {
			succeededAmount += refund.amount;

			if (succeededAmount >= amountCaptured) {
				return {
					providerRefundId: refund.id,
					refundStatus: "succeeded",
				};
			}
		}

		const activeRefunds = sortedRefunds.filter((refund) =>
			["pending", "requires_action", "succeeded"].includes(refund.status ?? ""),
		);
		let activeAmount = 0;
		let coveringUnresolvedRefund: Stripe.Refund | null = null;

		for (const refund of activeRefunds) {
			activeAmount += refund.amount;

			if (refund.status === "pending" || refund.status === "requires_action") {
				coveringUnresolvedRefund = refund;
			}

			if (activeAmount >= amountCaptured) {
				break;
			}
		}

		if (activeAmount < amountCaptured || !coveringUnresolvedRefund) {
			return null;
		}

		return {
			providerRefundId: coveringUnresolvedRefund.id,
			// charge.refunded is a cumulative signal. Both unresolved Stripe
			// states use the executor's durable pending state until a lifecycle
			// refund event reports the definitive result.
			refundStatus: "pending",
		};
	}

	async handleChargeDisputeCreated(dispute: Stripe.Dispute): Promise<boolean> {
		const charge = await this.resolveDisputeCharge(dispute.charge);
		const chargeId = charge?.id ?? this.expandableId(dispute.charge);

		if (!chargeId) {
			return false;
		}

		const paymentIntentId =
			this.expandableId(dispute.payment_intent) ??
			this.expandableId(charge?.payment_intent);
		const orderHandled = paymentIntentId
			? await this.orderRefundHandler.markRefundedByPaymentIntent({
					chargeId,
					cause: "dispute",
					paymentIntentId,
				})
			: false;

		if (orderHandled) {
			return true;
		}

		const handled = await this.revokePurchasedCredits({
			chargeId,
			disputeId: dispute.id,
			fraction: this.disputeFraction(dispute, charge, chargeId),
			idempotencyKey: `dispute:${dispute.id}`,
			mode: "incremental",
			paymentIntentId,
			reason: "charge_dispute_created",
		});

		if (!handled && charge) {
			await this.deferRecognizedCheckoutUntilItsPaymentMappingExists(charge);
		}

		return handled;
	}

	/**
	 * Closes the webhook-ordering window where a refund/dispute is received before
	 * its top-up or invoice grant. Grant handlers call this immediately after the
	 * idempotent grant, using a fresh Stripe Charge as the financial source of truth.
	 */
	async reconcileChargeAfterGrant(chargeId: string): Promise<void> {
		const charge = await this.stripeProvider.retrieveCharge(chargeId);

		if (charge.amount_refunded > 0) {
			await this.handleChargeRefunded(charge);
		}

		if (!charge.disputed) {
			return;
		}

		const disputes = await this.stripeProvider.listDisputesForCharge(charge.id);

		if (disputes.length === 0) {
			throw new Error(
				`Stripe charge ${charge.id} is disputed but returned no dispute records`,
			);
		}

		for (const dispute of disputes) {
			if (["won", "withdrawn"].includes(dispute.status as string)) {
				continue;
			}

			await this.handleChargeDisputeCreated(dispute);
		}
	}

	private revokePurchasedCredits(input: {
		chargeId: string;
		disputeId?: string;
		fraction: ClawbackFraction;
		idempotencyKey: string;
		mode: ClawbackMode;
		paymentIntentId: string | null;
		reason: string;
	}): Promise<boolean> {
		return this.billingCreditLedgerRepository.withChargeLock(
			input.chargeId,
			async (tx) => {
				const paymentReference = {
					chargeId: input.chargeId,
					paymentIntentId: input.paymentIntentId,
				};
				const [grantRows, revocationRows] = await Promise.all([
					this.billingCreditLedgerRepository.findPositiveRowsForPayment(
						paymentReference,
						tx,
					),
					this.billingCreditLedgerRepository.findRevocationRowsForPayment(
						paymentReference,
						tx,
					),
				]);

				if (grantRows.length === 0) {
					return false;
				}

				const userId = this.singleOwner(grantRows, input.chargeId);
				this.assertRevocationOwner(revocationRows, userId, input.chargeId);
				const allocations = this.allocateByOriginalBucket(
					grantRows,
					revocationRows,
					input.fraction,
					input.mode,
				);
				const multipleOriginalBuckets = allocations.length > 1;

				for (const allocation of allocations) {
					if (allocation.delta === 0) {
						continue;
					}

					await this.creditsService.revoke(
						userId,
						allocation.delta,
						{
							bucket: allocation.bucket,
							// A normal Stripe payment funds one bucket and uses the exact
							// Phase I4 key. The suffix handles anomalous mixed-bucket
							// legacy data without colliding in the global ledger index.
							idempotencyKey: multipleOriginalBuckets
								? `${input.idempotencyKey}:${allocation.bucket}`
								: input.idempotencyKey,
							meta: {
								chargeId: input.chargeId,
								...(input.disputeId ? { disputeId: input.disputeId } : {}),
								...(input.paymentIntentId
									? { paymentIntentId: input.paymentIntentId }
									: {}),
								reason: input.reason,
							},
						},
						tx,
					);
				}

				// A matched no-op is handled: a prior refund/dispute already reached
				// this cumulative target, so the webhook should be terminally acked.
				return true;
			},
		);
	}

	private allocateByOriginalBucket(
		grantRows: BillingCreditLedgerRow[],
		revocationRows: BillingCreditLedgerRow[],
		fraction: ClawbackFraction,
		mode: ClawbackMode,
	): BucketAllocation[] {
		const originalByBucket = this.sumByBucket(grantRows, false);
		const revokedByBucket = this.sumByBucket(revocationRows, true);
		const originalGranted = [...originalByBucket.values()].reduce(
			(sum, amount) => sum + amount,
			0,
		);
		const alreadyRevoked = [...revokedByBucket.values()].reduce(
			(sum, amount) => sum + amount,
			0,
		);
		const globalTarget = Math.min(
			originalGranted,
			this.floorRatio(originalGranted, fraction),
		);
		const remainingGrant = Math.max(0, originalGranted - alreadyRevoked);
		const globalDelta =
			mode === "cumulative"
				? Math.max(0, globalTarget - alreadyRevoked)
				: Math.min(globalTarget, remainingGrant);
		const allocations = BUCKET_ORDER.flatMap((bucket) => {
			const bucketGranted = originalByBucket.get(bucket) ?? 0;

			if (bucketGranted === 0) {
				return [];
			}

			const product = BigInt(bucketGranted) * BigInt(fraction.numerator);

			return [
				{
					alreadyRevoked: revokedByBucket.get(bucket) ?? 0,
					bucket,
					delta: 0,
					originalGranted: bucketGranted,
					remainder: product % BigInt(fraction.denominator),
					target: Number(product / BigInt(fraction.denominator)),
				},
			];
		});
		let targetRemainder =
			globalTarget -
			allocations.reduce((sum, allocation) => sum + allocation.target, 0);

		for (const allocation of [...allocations].sort((left, right) => {
			if (left.remainder === right.remainder) {
				return (
					BUCKET_ORDER.indexOf(left.bucket) - BUCKET_ORDER.indexOf(right.bucket)
				);
			}

			return left.remainder > right.remainder ? -1 : 1;
		})) {
			if (targetRemainder === 0) {
				break;
			}

			allocation.target += 1;
			targetRemainder -= 1;
		}

		let remainingGlobalDelta = globalDelta;

		for (const allocation of allocations) {
			const available = Math.max(
				0,
				allocation.originalGranted - allocation.alreadyRevoked,
			);
			const desired =
				mode === "cumulative"
					? Math.max(0, allocation.target - allocation.alreadyRevoked)
					: allocation.target;
			allocation.delta = Math.min(desired, available, remainingGlobalDelta);
			remainingGlobalDelta -= allocation.delta;
		}

		for (const allocation of allocations) {
			if (remainingGlobalDelta === 0) {
				break;
			}

			const available = Math.max(
				0,
				allocation.originalGranted -
					allocation.alreadyRevoked -
					allocation.delta,
			);
			const overflow = Math.min(available, remainingGlobalDelta);
			allocation.delta += overflow;
			remainingGlobalDelta -= overflow;
		}

		return allocations;
	}

	private sumByBucket(
		rows: BillingCreditLedgerRow[],
		absolute: boolean,
	): Map<CreditBucket, number> {
		const sums = new Map<CreditBucket, number>();

		for (const row of rows) {
			const amount = absolute ? Math.abs(row.delta) : row.delta;
			sums.set(row.bucket, (sums.get(row.bucket) ?? 0) + amount);
		}

		return sums;
	}

	private floorRatio(amount: number, fraction: ClawbackFraction) {
		return Number(
			(BigInt(amount) * BigInt(fraction.numerator)) /
				BigInt(fraction.denominator),
		);
	}

	private validatedRefundAmounts(
		charge: Stripe.Charge,
	): { amountCaptured: number; amountRefunded: number } | null {
		const amountCaptured = charge.amount_captured;
		const amountRefunded = charge.amount_refunded;

		if (amountCaptured === 0) {
			return null;
		}

		if (
			!Number.isSafeInteger(amountCaptured) ||
			amountCaptured <= 0 ||
			!Number.isSafeInteger(amountRefunded) ||
			amountRefunded < 0 ||
			amountRefunded > amountCaptured
		) {
			throw new Error(
				`Stripe charge ${charge.id} has invalid captured/refunded amounts`,
			);
		}

		return { amountCaptured, amountRefunded };
	}

	private disputeFraction(
		dispute: Stripe.Dispute,
		charge: Stripe.Charge | null,
		chargeId: string,
	): ClawbackFraction {
		const amountCaptured = charge?.amount_captured;
		const disputeAmount = dispute.amount;
		const chargeCurrency = charge?.currency?.toLowerCase();
		const disputeCurrency = dispute.currency?.toLowerCase();
		const invalidAmounts =
			!Number.isSafeInteger(amountCaptured) ||
			(amountCaptured ?? 0) <= 0 ||
			!Number.isSafeInteger(disputeAmount) ||
			disputeAmount < 0;
		const currencyMismatch =
			!chargeCurrency || !disputeCurrency || chargeCurrency !== disputeCurrency;

		if (invalidAmounts || currencyMismatch) {
			this.logger.error(
				`Stripe dispute ${dispute.id} cannot be prorated safely; falling back to a full credit clawback for charge ${chargeId}`,
				JSON.stringify({
					amountCaptured: amountCaptured ?? null,
					chargeCurrency: chargeCurrency ?? null,
					chargeId,
					disputeAmount,
					disputeCurrency: disputeCurrency ?? null,
					disputeId: dispute.id,
				}),
			);

			return { denominator: 1, numerator: 1 };
		}

		return {
			denominator: amountCaptured ?? 1,
			numerator: disputeAmount,
		};
	}

	private refundIdempotencyKey(charge: Stripe.Charge) {
		/*
		 * charge.refunded carries a cumulative Charge, not the triggering Refund
		 * object. The cumulative refunded amount is the stable, monotonic fallback
		 * in refund:{chargeId}:{refundId-or-amountRefunded}.
		 */
		return `refund:${charge.id}:${charge.amount_refunded}`;
	}

	private async deferRecognizedCheckoutUntilItsPaymentMappingExists(
		charge: Stripe.Charge,
	): Promise<void> {
		const purpose = await this.checkoutPurposeForCharge(charge);

		if (
			purpose === CHECKOUT_PURPOSE.order ||
			purpose === CHECKOUT_PURPOSE.topup
		) {
			/*
			 * Throwing keeps the durable webhook row in `failed`, which is claimable
			 * on Stripe's same-event retry. The later grant also performs an immediate
			 * Charge recheck, so correctness does not depend on retry timing.
			 *
			 * Subscription invoice charges are intentionally excluded: a same-credit
			 * plan switch or downgrade can legitimately have no positive grant.
			 */
			throw new Error(
				`Stripe ${purpose} charge ${charge.id} has no payment order or credit grant yet`,
			);
		}
	}

	private async checkoutPurposeForCharge(
		charge: Stripe.Charge,
	): Promise<string | null> {
		const chargePurpose = charge.metadata?.purpose;

		if (chargePurpose) {
			return chargePurpose;
		}

		const paymentIntentId = this.expandableId(charge.payment_intent);

		if (!paymentIntentId) {
			return null;
		}

		const paymentIntent =
			await this.stripeProvider.retrievePaymentIntent(paymentIntentId);

		return paymentIntent.metadata?.purpose ?? null;
	}

	private resolveDisputeCharge(
		charge: string | Stripe.Charge | null,
	): Promise<Stripe.Charge | null> {
		if (!charge) {
			return Promise.resolve(null);
		}

		return typeof charge === "string"
			? this.stripeProvider.retrieveCharge(charge)
			: Promise.resolve(charge);
	}

	private async resolveRefundCharge(
		refund: Stripe.Refund,
	): Promise<Stripe.Charge> {
		let chargeId = this.expandableId(refund.charge);

		if (!chargeId) {
			const paymentIntentId = this.expandableId(refund.payment_intent);

			if (paymentIntentId) {
				const paymentIntent =
					await this.stripeProvider.retrievePaymentIntent(paymentIntentId);
				chargeId = this.expandableId(paymentIntent.latest_charge);
			}
		}

		if (!chargeId) {
			throw new Error(
				`Succeeded Stripe refund ${refund.id} has no resolvable charge`,
			);
		}

		return this.stripeProvider.retrieveCharge(chargeId);
	}

	private singleOwner(rows: BillingCreditLedgerRow[], chargeId: string) {
		const userIds = new Set(rows.map((row) => row.userId));

		if (userIds.size !== 1) {
			throw new Error(
				`Purchased credit grants for Stripe charge ${chargeId} span multiple users`,
			);
		}

		const [userId] = userIds;

		if (!userId) {
			throw new Error(
				`Purchased credit grants for Stripe charge ${chargeId} have no owner`,
			);
		}

		return userId;
	}

	private assertRevocationOwner(
		rows: BillingCreditLedgerRow[],
		userId: string,
		chargeId: string,
	) {
		if (rows.some((row) => row.userId !== userId)) {
			throw new Error(
				`Credit revocations for Stripe charge ${chargeId} span multiple users`,
			);
		}
	}

	private expandableId(
		value: string | { id: string } | null | undefined,
	): string | null {
		if (!value) {
			return null;
		}

		return typeof value === "string" ? value : value.id;
	}
}
