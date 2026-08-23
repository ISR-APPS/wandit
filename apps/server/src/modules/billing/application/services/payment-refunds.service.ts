import { Inject, Injectable, Logger } from "@nestjs/common";
import {
	CHECKOUT_PURPOSE,
	type CreditBucket,
	PURCHASED_CREDIT_BUCKETS,
} from "@wandit/contracts";
import type Stripe from "stripe";

import { CreditsService } from "../../../credits/application/services/credits.service";
import {
	type CreditOwner,
	creditOwnerKey,
	ownerFromIds,
	sameCreditOwner,
} from "../../../credits/domain/credit-owner";
import {
	WEBHOOK_ORDER_REFUND_HANDLER,
	type WebhookOrderRefundHandler,
} from "../../domain/ports/webhook-order-refund-handler.port";
import { isNonAdverseDisputeStatus } from "../../domain/stripe-dispute-status";
import {
	BillingCreditLedgerRepository,
	type BillingCreditLedgerRow,
	type BillingCreditLedgerTransaction,
} from "../../infrastructure/persistence/billing-credit-ledger.repository";
import { StripeProvider } from "../../infrastructure/stripe/stripe.provider";

type ClawbackFraction = {
	denominator: number;
	numerator: number;
};

type ClawbackMode = "cumulative" | "incremental";

type PurchasedCreditBucket = (typeof PURCHASED_CREDIT_BUCKETS)[number];

type BucketAllocation = {
	alreadyRevoked: number;
	bucket: PurchasedCreditBucket;
	delta: number;
	originalGranted: number;
	remainder: bigint;
	target: number;
};

type RestorationAllocation = {
	bucket: PurchasedCreditBucket;
	delta: number;
};

type RevocationKeyBuilder = (globalTargetCentiCredits: number) => string;

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
			idempotencyKey: this.refundIdempotencyKeyBuilder(charge),
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

		if (paymentIntentId) {
			if (amounts.amountRefunded >= amounts.amountCaptured) {
				const orderHandled = await this.handleFullOrderChargeRefunded({
					...amounts,
					additionalRefunds: [refund],
					charge,
					paymentIntentId,
				});

				if (orderHandled) {
					return true;
				}
			} else {
				const orderHandled =
					await this.orderRefundHandler.handleChargeRefundedByPaymentIntent({
						...amounts,
						chargeId: charge.id,
						paymentIntentId,
					});

				if (orderHandled) {
					const persisted = await this.orderRefundHandler.updateRefundStatus({
						paymentIntentId,
						providerRefundId: refund.id,
						refundStatus: "partial",
					});

					if (!persisted) {
						throw new Error(
							`Stripe refund ${refund.id} matched an order but its lifecycle state could not be persisted`,
						);
					}

					return true;
				}
			}
		}

		const handled = await this.revokePurchasedCredits({
			chargeId: charge.id,
			fraction: {
				denominator: amounts.amountCaptured,
				numerator: amounts.amountRefunded,
			},
			idempotencyKey: this.refundIdempotencyKeyBuilder(charge),
			mode: "cumulative",
			paymentIntentId,
			reason: "refund_updated",
		});

		if (!handled) {
			await this.deferRecognizedCheckoutUntilItsPaymentMappingExists(charge);
		}

		return handled;
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

	async handleChargeDisputeCreated(
		eventDispute: Stripe.Dispute,
	): Promise<boolean> {
		if (isNonAdverseDisputeStatus(eventDispute.status)) {
			return false;
		}

		// A redelivered `created` event after the dispute was won must not
		// re-claw the restored credits: the event payload is a snapshot, the
		// retrieve is the truth.
		const fresh = await this.stripeProvider.retrieveDispute(eventDispute.id);

		if (fresh.id !== eventDispute.id) {
			throw new Error(
				`Stripe dispute refresh for ${eventDispute.id} returned ${fresh.id}`,
			);
		}

		const dispute: Stripe.Dispute = { ...eventDispute, ...fresh };

		if (isNonAdverseDisputeStatus(dispute.status)) {
			this.logger.warn(
				`Skipping stale dispute.created for ${dispute.id}: dispute is now ${dispute.status}`,
			);

			return false;
		}

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
			idempotencyKey: () => `dispute:${dispute.id}`,
			mode: "incremental",
			paymentIntentId,
			reason: "charge_dispute_created",
		});

		if (!handled && charge) {
			await this.deferRecognizedCheckoutUntilItsPaymentMappingExists(charge);
		}

		return handled;
	}

	async handleChargeDisputeClosed(dispute: Stripe.Dispute): Promise<boolean> {
		if (!isNonAdverseDisputeStatus(dispute.status)) {
			return false;
		}

		const chargeId = this.expandableId(dispute.charge);

		if (!chargeId) {
			return false;
		}

		return this.billingCreditLedgerRepository.withChargeLock(
			chargeId,
			async (tx) => {
				const charge = await this.stripeProvider.retrieveCharge(chargeId);

				if (charge.id !== chargeId) {
					throw new Error(
						`Stripe charge refresh for dispute ${dispute.id} returned ${charge.id}`,
					);
				}

				const paymentIntentId =
					this.expandableId(dispute.payment_intent) ??
					this.expandableId(charge.payment_intent);
				const disputes =
					await this.stripeProvider.listDisputesForCharge(chargeId);
				const adverseFraction = this.cumulativeAdverseFraction(
					charge,
					disputes.filter((candidate) => candidate.id !== dispute.id),
				);
				const restoredCredits = await this.restoreExcessPurchasedCredits(
					{
						chargeId,
						disputeId: dispute.id,
						fraction: adverseFraction,
						paymentIntentId,
					},
					tx,
				);
				let restoredSlots = 0;

				// The clawback canceled future refill slots only for a FULL adverse
				// amount; when the remaining refunds/disputes no longer cover the
				// charge, those prepaid months come back.
				if (adverseFraction.numerator < adverseFraction.denominator) {
					const slots =
						await this.billingCreditLedgerRepository.restorePendingRefillSlotsForCharge(
							chargeId,
							new Date(),
							tx,
						);
					restoredSlots = slots.restored.length;

					if (slots.skipped.length > 0) {
						this.logger.warn(
							`Dispute ${dispute.id} left ${slots.skipped.length} clawback-canceled slot(s) canceled for charge ${chargeId}: their subscription is no longer canonical (${slots.skipped.join(", ")})`,
						);
					}
				}

				return restoredCredits || restoredSlots > 0;
			},
		);
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
			if (isNonAdverseDisputeStatus(dispute.status)) {
				continue;
			}

			await this.handleChargeDisputeCreated(dispute);
		}
	}

	private revokePurchasedCredits(input: {
		chargeId: string;
		disputeId?: string;
		fraction: ClawbackFraction;
		/** Built from the cumulative revoke target computed inside the charge lock. */
		idempotencyKey: RevocationKeyBuilder;
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
				const [grantRows, revocationRows, restorationRows, slotOwners] =
					await Promise.all([
						this.billingCreditLedgerRepository.findPositiveRowsForPayment(
							paymentReference,
							tx,
						),
						this.billingCreditLedgerRepository.findRevocationRowsForPayment(
							paymentReference,
							tx,
						),
						this.billingCreditLedgerRepository.findRestorationRowsForPayment(
							paymentReference,
							tx,
						),
						this.billingCreditLedgerRepository.findPendingRefillSlotOwnersForCharge(
							input.chargeId,
							tx,
						),
					]);
				this.assertPurchasedCreditRows([
					...grantRows,
					...revocationRows,
					...restorationRows,
				]);

				if (slotOwners.length > 1) {
					throw new Error(
						`Stripe charge ${input.chargeId} funds refill slots for multiple owners`,
					);
				}

				const grantOwner =
					grantRows.length > 0
						? this.singleOwner(grantRows, input.chargeId)
						: null;
				const slotOwner = slotOwners[0] ?? null;

				if (
					grantOwner &&
					slotOwner &&
					!sameCreditOwner(grantOwner, slotOwner)
				) {
					throw new Error(
						`Stripe charge ${input.chargeId} grant and refill slots have different owners`,
					);
				}

				const owner = grantOwner ?? slotOwner;

				if (owner) {
					// Lock order is charge -> owner -> refill rows on every clawback.
					await this.billingCreditLedgerRepository.acquireOwnerLock(owner, tx);
				}

				// Pending yearly refill slots are FUTURE months the customer already
				// paid for. Only a FULL refund of the funding charge may cancel them:
				// a $10 goodwill refund on a yearly Business tier must not destroy
				// 11 months of prepaid credits (money-review finding; pre-existing,
				// amplified by Business pricing). Partial-refund slot policy is
				// documented as manual-review in the billing runbook.
				const refundCoversFullCharge =
					input.fraction.numerator >= input.fraction.denominator;
				const canceledSlots = refundCoversFullCharge
					? await this.billingCreditLedgerRepository.cancelPendingRefillSlotsForCharge(
							input.chargeId,
							tx,
						)
					: 0;

				if (!grantOwner) {
					// The charge is recognized (it funds refill slots) even when a
					// partial refund deliberately preserves them — ack the webhook
					// either way so it does not dead-letter.
					return refundCoversFullCharge
						? canceledSlots > 0
						: slotOwners.length > 0;
				}

				this.assertRevocationOwner(revocationRows, grantOwner, input.chargeId);
				this.assertRevocationOwner(restorationRows, grantOwner, input.chargeId);
				// Plan credits that already expired cannot be revoked again; they
				// count as already taken back (cumulative refunds only — a dispute's
				// incremental tranche is its own money).
				const expiredPlanCredits =
					input.mode === "cumulative"
						? await this.billingCreditLedgerRepository.findExpiredPlanCreditsForPayment(
								paymentReference,
								tx,
							)
						: 0;

				if (expiredPlanCredits > 0) {
					this.logger.log(
						`Clawback for charge ${input.chargeId} offsets ${expiredPlanCredits} already-expired plan centi-credits`,
					);
				}

				const { allocations, globalTarget } = this.allocateByOriginalBucket(
					grantRows,
					revocationRows,
					restorationRows,
					input.fraction,
					input.mode,
					expiredPlanCredits,
				);
				const multipleOriginalBuckets = allocations.length > 1;
				const idempotencyKey = input.idempotencyKey(globalTarget);

				for (const allocation of allocations) {
					if (allocation.delta === 0) {
						continue;
					}

					await this.creditsService.revoke(
						grantOwner,
						allocation.delta,
						{
							bucket: allocation.bucket,
							// A normal Stripe payment funds one bucket and uses the exact
							// key. The suffix handles anomalous mixed-bucket legacy data
							// without colliding in the global ledger index.
							idempotencyKey: multipleOriginalBuckets
								? `${idempotencyKey}:${allocation.bucket}`
								: idempotencyKey,
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
		restorationRows: BillingCreditLedgerRow[],
		fraction: ClawbackFraction,
		mode: ClawbackMode,
		expiredPlanCredits = 0,
	): { allocations: BucketAllocation[]; globalTarget: number } {
		const originalByBucket = this.sumByBucket(grantRows, false);
		const revokedByBucket = this.sumByBucket(revocationRows, true);
		const restoredByBucket = this.sumByBucket(restorationRows, false);

		if (expiredPlanCredits > 0) {
			// Expired plan credits count as already revoked for the plan bucket,
			// capped at what that bucket actually granted.
			revokedByBucket.set(
				"plan",
				(revokedByBucket.get("plan") ?? 0) +
					Math.min(expiredPlanCredits, originalByBucket.get("plan") ?? 0),
			);
		}

		const originalGranted = [...originalByBucket.values()].reduce(
			(sum, amount) => sum + amount,
			0,
		);
		const alreadyRevoked = PURCHASED_CREDIT_BUCKETS.reduce(
			(sum, bucket) =>
				sum +
				Math.max(
					0,
					(revokedByBucket.get(bucket) ?? 0) -
						(restoredByBucket.get(bucket) ?? 0),
				),
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
		const allocations = PURCHASED_CREDIT_BUCKETS.flatMap((bucket) => {
			const bucketGranted = originalByBucket.get(bucket) ?? 0;

			if (bucketGranted === 0) {
				return [];
			}

			const product = BigInt(bucketGranted) * BigInt(fraction.numerator);

			return [
				{
					alreadyRevoked: Math.max(
						0,
						(revokedByBucket.get(bucket) ?? 0) -
							(restoredByBucket.get(bucket) ?? 0),
					),
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
					PURCHASED_CREDIT_BUCKETS.indexOf(left.bucket) -
					PURCHASED_CREDIT_BUCKETS.indexOf(right.bucket)
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

		return { allocations, globalTarget };
	}

	private async restoreExcessPurchasedCredits(
		input: {
			chargeId: string;
			disputeId: string;
			fraction: ClawbackFraction;
			paymentIntentId: string | null;
		},
		tx: BillingCreditLedgerTransaction,
	): Promise<boolean> {
		const paymentReference = {
			chargeId: input.chargeId,
			paymentIntentId: input.paymentIntentId,
		};
		const [grantRows, revocationRows, restorationRows] = await Promise.all([
			this.billingCreditLedgerRepository.findPositiveRowsForPayment(
				paymentReference,
				tx,
			),
			this.billingCreditLedgerRepository.findRevocationRowsForPayment(
				paymentReference,
				tx,
			),
			this.billingCreditLedgerRepository.findRestorationRowsForPayment(
				paymentReference,
				tx,
			),
		]);
		this.assertPurchasedCreditRows([
			...grantRows,
			...revocationRows,
			...restorationRows,
		]);

		if (grantRows.length === 0) {
			return false;
		}

		const owner = this.singleOwner(grantRows, input.chargeId);
		this.assertRevocationOwner(revocationRows, owner, input.chargeId);
		this.assertRevocationOwner(restorationRows, owner, input.chargeId);
		const allocations = this.restorationAllocations(
			grantRows,
			revocationRows,
			restorationRows,
			input.fraction,
		);
		const multipleBuckets =
			allocations.filter(({ delta }) => delta > 0).length > 1;

		for (const allocation of allocations) {
			if (allocation.delta === 0) {
				continue;
			}

			await this.creditsService.grant(
				owner,
				allocation.delta,
				{
					bucket: allocation.bucket,
					idempotencyKey: multipleBuckets
						? `dispute-restore:${input.disputeId}:${allocation.bucket}`
						: `dispute-restore:${input.disputeId}`,
					meta: {
						billingAdjustment: "clawback_restore",
						chargeId: input.chargeId,
						disputeId: input.disputeId,
						...(input.paymentIntentId
							? { paymentIntentId: input.paymentIntentId }
							: {}),
						reason: "charge_dispute_closed_restore",
					},
				},
				tx,
			);
		}

		return true;
	}

	private restorationAllocations(
		grantRows: BillingCreditLedgerRow[],
		revocationRows: BillingCreditLedgerRow[],
		restorationRows: BillingCreditLedgerRow[],
		fraction: ClawbackFraction,
	): RestorationAllocation[] {
		const originalByBucket = this.sumByBucket(grantRows, false);
		const revokedByBucket = this.sumByBucket(revocationRows, true);
		const restoredByBucket = this.sumByBucket(restorationRows, false);
		const originalGranted = [...originalByBucket.values()].reduce(
			(sum, amount) => sum + amount,
			0,
		);
		const globalTarget = Math.min(
			originalGranted,
			this.floorRatio(originalGranted, fraction),
		);
		const targets = PURCHASED_CREDIT_BUCKETS.flatMap((bucket) => {
			const original = originalByBucket.get(bucket) ?? 0;

			if (original === 0) {
				return [];
			}

			const product = BigInt(original) * BigInt(fraction.numerator);

			return [
				{
					bucket,
					remainder: product % BigInt(fraction.denominator),
					target: Number(product / BigInt(fraction.denominator)),
				},
			];
		});
		let targetRemainder =
			globalTarget -
			targets.reduce((sum, allocation) => sum + allocation.target, 0);

		for (const allocation of [...targets].sort((left, right) => {
			if (left.remainder === right.remainder) {
				return (
					PURCHASED_CREDIT_BUCKETS.indexOf(left.bucket) -
					PURCHASED_CREDIT_BUCKETS.indexOf(right.bucket)
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

		return targets.map(({ bucket, target }) => ({
			bucket,
			delta: Math.max(
				0,
				(revokedByBucket.get(bucket) ?? 0) -
					(restoredByBucket.get(bucket) ?? 0) -
					target,
			),
		}));
	}

	private assertPurchasedCreditRows(rows: BillingCreditLedgerRow[]): void {
		for (const row of rows) {
			if (
				!(PURCHASED_CREDIT_BUCKETS as readonly string[]).includes(row.bucket)
			) {
				throw new Error(
					`Payment-linked ${row.bucket} credit row ${row.id} cannot be clawed back as purchased credits`,
				);
			}
		}
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

	private cumulativeAdverseFraction(
		charge: Stripe.Charge,
		disputes: Stripe.Dispute[],
	): ClawbackFraction {
		const amounts = this.validatedRefundAmounts(charge);

		if (!amounts) {
			return { denominator: 1, numerator: 1 };
		}

		const chargeCurrency = charge.currency?.toLowerCase();
		let adverseAmount = amounts.amountRefunded;

		for (const dispute of disputes) {
			if (isNonAdverseDisputeStatus(dispute.status)) {
				continue;
			}

			const disputeCurrency = dispute.currency?.toLowerCase();

			if (
				!Number.isSafeInteger(dispute.amount) ||
				dispute.amount < 0 ||
				!chargeCurrency ||
				!disputeCurrency ||
				chargeCurrency !== disputeCurrency
			) {
				this.logger.error(
					`Stripe dispute ${dispute.id} cannot be included safely in the cumulative clawback target for charge ${charge.id}; retaining a full clawback`,
				);

				return { denominator: 1, numerator: 1 };
			}

			adverseAmount += dispute.amount;
		}

		return {
			denominator: amounts.amountCaptured,
			numerator: Math.min(amounts.amountCaptured, adverseAmount),
		};
	}

	private refundIdempotencyKeyBuilder(
		charge: Stripe.Charge,
	): RevocationKeyBuilder {
		/*
		 * charge.refunded carries a cumulative Charge, not the triggering Refund
		 * object. The key embeds the cumulative REVOKE TARGET in centi-credits:
		 * a replay of the same event recomputes the same target (no-op under the
		 * ledger's idempotency), while a later refill funded by the same charge
		 * raises the target and mints a fresh key, so the missing tranche still
		 * applies. Old `refund:{chargeId}:{amountRefunded}` rows keep counting
		 * as revoked because the allocator reads rows, not keys.
		 */
		return (targetCentiCredits) =>
			`refund:${charge.id}:cum:${targetCentiCredits}`;
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

	private singleOwner(
		rows: BillingCreditLedgerRow[],
		chargeId: string,
	): CreditOwner {
		const byKey = new Map<string, CreditOwner>();

		for (const row of rows) {
			const owner = ownerFromIds(row.userId, row.organizationId);
			byKey.set(creditOwnerKey(owner), owner);
		}

		if (byKey.size !== 1) {
			throw new Error(
				`Purchased credit grants for Stripe charge ${chargeId} span multiple owners`,
			);
		}

		const [owner] = byKey.values();

		if (!owner) {
			throw new Error(
				`Purchased credit grants for Stripe charge ${chargeId} have no owner`,
			);
		}

		return owner;
	}

	private assertRevocationOwner(
		rows: BillingCreditLedgerRow[],
		owner: CreditOwner,
		chargeId: string,
	) {
		const mismatch = rows.some(
			(row) =>
				!sameCreditOwner(ownerFromIds(row.userId, row.organizationId), owner),
		);

		if (mismatch) {
			throw new Error(
				`Credit revocations for Stripe charge ${chargeId} span multiple owners`,
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
