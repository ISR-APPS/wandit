import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";

import { Inject, Injectable, Logger } from "@nestjs/common";

import { CreditsService } from "../../../credits/application/services/credits.service";
import {
	type CreditOwner,
	type MeteringSubject,
	ownerFromIds,
	subjectPayer,
} from "../../../credits/domain/credit-owner";
import { MemberCreditLimitError } from "../../../credits/domain/errors/member-credit-limit.error";
import { LifecycleEventsService } from "../../../lifecycle-events/application/services/lifecycle-events.service";
import { OrganizationLimitsRepository } from "../../../workspaces/infrastructure/persistence/organization-limits.repository";
import { isRefundedFailureStepUsage } from "../../domain/gateway-metering";
import {
	type AiUsageEvent,
	type AiUsageGenerationRef,
	bundledReservationCompletedAttemptRef,
	type CapturedGeneration,
	capturedGenerationRef,
	type DirectMeteringSettlementPairOutcome,
	type DirectMeteringSettlementRequest,
	GatewayUsagePendingError,
	type GenerationRefSource,
	isBundledReservationComplete,
	isBundledReservationPending,
	isBundledUnmeteredStepUsage,
	isGatewayUsagePending,
	isHelperBillableStepUsage,
	METERING_GATEWAY,
	type MeteredOperation,
	type MeteringGateway,
	type MeteringReconcileOutcome,
	type MeteringReconciliationSweepOutcome,
	type MeteringRecoveryOutcome,
	type MeteringReserveEstimate,
	type MeteringReserveOutcome,
	type MeteringReserveReplay,
	type MeteringSettlement,
	MeteringStateConflictError,
	type PreparedMeteringSettlement,
	type TokenMeteringSettlement,
} from "../../domain/metering";
import {
	type MeasuredCostEstimate,
	normalizeTokenUsage,
	usdMicrosToCentiCredits,
} from "../../domain/model-pricing";
import {
	assertOperationParentAllowed,
	type FixedOperationPricing,
	type MeasuredOperationPricing,
	maxFinalCreditsCeiling,
	type OperationPricing,
	operationPricing,
	type PerMinuteOperationPricing,
	TRANSCRIPTION_MAX_DURATION_SECONDS,
} from "../../domain/operation-registry";
import {
	type AiProviderCallEvidence,
	assertProviderCallEvidenceCost,
	assertProviderCallEvidenceInput,
	canUpgradeProviderCallCostStatus,
	type ProviderCallEvidenceCost,
	type ProviderCallEvidenceInput,
	sumProviderCallEvidenceUsdMicros,
} from "../../domain/provider-call-evidence";
import {
	MeteringRepository,
	type MeteringTransaction,
} from "../../infrastructure/persistence/metering.repository";
import {
	type MeasuredCostEstimateInput,
	ModelPricingService,
} from "./model-pricing.service";

const POSTGRES_INTEGER_MAX = 2_147_483_647;

// The retired BullMQ path made eight attempts after a 10-second delay with a
// 2-second exponential backoff (about 4.5 minutes total). Minute-batched
// Trigger reconciliation uses durable event timestamps for the equivalent
// finite budget, so restarts cannot reset it and pending provider rows cannot
// retain holds or starve a scan page forever.
// Age budget is anchored to settlement time, not first observation: a Trigger
// schedule outage longer than this window terminalizes still-pending events on
// the first resumed sweep. 30 min tolerates realistic schedule gaps; the cost
// of a late terminalization is provider-cost drift only (customer charges stand).
export const SETTLED_RECONCILIATION_PENDING_MAX_AGE_MS = 30 * 60_000;
export const RESERVED_RECONCILIATION_PENDING_MAX_AGE_MS = 45 * 60_000;

// reconcile_failed retry schedule: exponential backoff from 5 minutes capped
// at 6 hours; after RECONCILE_DEAD_LETTER_CAP attempts the row dead-letters
// (nextReconcileAttemptAt NULL) and needs an admin.
export const RECONCILE_DEAD_LETTER_CAP = 10;
export const RECONCILE_RETRY_BASE_DELAY_MS = 5 * 60_000;
export const RECONCILE_RETRY_MAX_DELAY_MS = 6 * 60 * 60_000;

/** Settlement snapshot flags that ask for an admin review of the charge. */
export type MeteringReviewFlag = "gateway_zero_cost" | "no_catalog_rate";

export type ExecutionLeaseHeartbeat = "error" | "lost" | "renewed";

type CreditAdjustmentOutcome = {
	/** Reserve-time exemption, carried forward so reconcile re-checks agree. */
	actorIsLimitExempt: boolean;
	/** The credits actually debited (the target, capped at the ceiling). */
	finalCredits: number;
	memberLimitBreach: {
		deltaCredits: number;
		limitCredits: number;
		spentCredits: number;
	} | null;
	/** Set when the target breached the sanity ceiling and was capped. */
	sanityCeiling: { attempted: number; ceiling: number } | null;
};

type PerMinuteDurationEvidence = {
	authoritativeDurationSeconds: number;
	billedDurationSeconds: number;
	durationCapped: boolean;
	generations: Array<{
		authoritativeDurationSeconds: number;
		durationSeconds: number | null;
		gatewayGenerationId: string;
		providerDurationSeconds: number | null;
		source: "local" | "provider";
	}>;
};

/**
 * Price terms recovered from an event's own snapshot. Reservation-time terms
 * are durable: an event reserved under the retired fixed/per_minute modes
 * keeps settling under them after the registry moved to measured billing.
 */
type RecoveredOperationPricing =
	| FixedOperationPricing
	| PerMinuteOperationPricing
	| (MeasuredOperationPricing & { estimatedUnitUsdMicros: number | null })
	| Extract<OperationPricing, { mode: "token" }>;

type GatewayCostAllocation = {
	perGenerationUsdMicros: number[];
	totalUsdMicros: number;
};

type DecimalDollars = {
	coefficient: bigint;
	scale: number;
};

@Injectable()
export class MeteringService {
	private readonly logger = new Logger(MeteringService.name);

	constructor(
		@Inject(MeteringRepository)
		private readonly repository: MeteringRepository,
		@Inject(CreditsService)
		private readonly credits: CreditsService,
		@Inject(ModelPricingService)
		private readonly modelPricing: ModelPricingService,
		@Inject(METERING_GATEWAY)
		private readonly gateway: MeteringGateway,
		@Inject(OrganizationLimitsRepository)
		private readonly organizationLimits: OrganizationLimitsRepository,
		@Inject(LifecycleEventsService)
		private readonly lifecycleEvents: LifecycleEventsService,
	) {}

	async findByIdempotencyKey(
		idempotencyKey: string,
		subject: MeteringSubject,
	): Promise<AiUsageEvent | null> {
		const event =
			await this.repository.findEventByIdempotencyKey(idempotencyKey);

		// Payer equality, not actor equality: in an org workspace any member may
		// legitimately observe/replay an operation another member started, as
		// long as the same pool pays for it.
		if (
			event &&
			this.eventPayerKey(event) !== this.payerKey(subjectPayer(subject))
		) {
			throw new Error(
				`AI usage event ${idempotencyKey} belongs to another payer`,
			);
		}

		return event;
	}

	/**
	 * Claims a reservation that was created by a preceding bundled operation.
	 *
	 * The attempt-ref transition is durable across settlement and uses the same
	 * operation lock as reserve. The row-level compare-and-set is a second guard
	 * against two server instances admitting provider work for the same hold.
	 */
	async claimBundledReservation(input: {
		chatId: string;
		claimAttemptRef: string;
		expectedAttemptRef: string;
		idempotencyKey: string;
		messageId: string;
		operation: MeteredOperation;
		subject: MeteringSubject;
	}): Promise<AiUsageEvent | null> {
		this.assertNonEmpty(input.idempotencyKey, "claim idempotency key");
		this.assertNonEmpty(input.expectedAttemptRef, "expected attempt ref");
		this.assertNonEmpty(input.claimAttemptRef, "claim attempt ref");
		this.assertNonEmpty(input.messageId, "claim message id");

		if (input.expectedAttemptRef === input.claimAttemptRef) {
			throw new Error(
				"A bundled reservation claim must change the attempt ref",
			);
		}

		const completedExpectedAttemptRef = bundledReservationCompletedAttemptRef(
			input.expectedAttemptRef,
		);
		const completedClaimAttemptRef = bundledReservationCompletedAttemptRef(
			input.claimAttemptRef,
		);

		return this.repository.transaction(async (transaction) => {
			await this.repository.acquireOperationLock(
				this.reserveOperationLock(input.idempotencyKey),
				transaction,
			);

			const found = await this.repository.findEventByIdempotencyKey(
				input.idempotencyKey,
				transaction,
			);

			if (!found) {
				return null;
			}

			await this.lockEvent(found.id, transaction);
			const event = await this.requireEvent(found.id, transaction);

			// Same-PAYER check (like parent/child holds): in an org chat a different
			// member than the project creator may send the first stream — the org
			// pool paid for the bundled hold either way.
			if (
				event.idempotencyKey !== input.idempotencyKey ||
				this.eventPayerKey(event) !==
					this.payerKey(subjectPayer(input.subject)) ||
				event.operation !== input.operation ||
				event.chatId !== input.chatId
			) {
				throw new Error(
					`Bundled AI usage reservation ${input.idempotencyKey} has a conflicting owner`,
				);
			}

			if (
				event.attemptRef === input.claimAttemptRef ||
				event.attemptRef === completedClaimAttemptRef
			) {
				// This request already claimed the bundle once. What that means
				// depends on how that attempt ended: a still-reserved hold belongs
				// to a stream that died before settling (an actively-running
				// duplicate is refused upstream by the caller's in-process turn
				// guard), so the retry adopts it; a refunded hold was voided by
				// stranded recovery without the turn completing, so the retry
				// falls through to a normal hold; a settled/reconciled hold means
				// the turn COMPLETED and an identical resubmit is the replay this
				// ref exists to reject.
				if (event.status === "reserved") {
					return event;
				}

				if (event.status === "refunded") {
					return null;
				}

				throw new MeteringStateConflictError(
					event.id,
					event.status,
					"replay bundled reservation claim for",
				);
			}

			if (event.status !== "reserved") {
				// The bundle is spent. Replays of the SAME attempt were already
				// rejected above via the attempt-ref match; any other claim after
				// settlement/refund is a NEW turn of this conversation and takes a
				// normal hold instead. The final user message is NOT a turn
				// discriminator here: answering ask_user questions resumes the
				// stream without adding a user message, so "same message,
				// different attempt" is the shape of every legitimate resume —
				// treating it as a replay capped chats at one exchange.
				return null;
			}

			if (event.messageId !== input.messageId) {
				// A different turn of this conversation reached the pristine
				// bundle first (or the bundle is stuck under a crashed claim).
				// That turn simply pays with a normal hold; conflicting here
				// bricked the whole chat until stranded recovery released the
				// bundle.
				return null;
			}

			const claimAttemptRef =
				event.attemptRef === input.expectedAttemptRef
					? input.claimAttemptRef
					: event.attemptRef === completedExpectedAttemptRef
						? completedClaimAttemptRef
						: null;

			if (!claimAttemptRef || !event.attemptRef) {
				// The hold is claimed by a DIFFERENT request's stream — either one
				// racing right now or one that crashed without settling. Do not
				// steal it (a live cross-instance stream may be using it) and do
				// not conflict (that bricked crashed chats): this request takes a
				// normal hold, and a dead claim is released by stranded recovery.
				return null;
			}

			const claimed = await this.repository.transitionEventAttemptRef(
				event.id,
				event.attemptRef,
				claimAttemptRef,
				["reserved"],
				transaction,
			);

			if (!claimed) {
				throw new MeteringStateConflictError(
					event.id,
					event.status,
					"claim bundled reservation for",
				);
			}

			return claimed;
		});
	}

	async completeBundledReservation(eventId: string): Promise<AiUsageEvent> {
		const completed = await this.repository.transaction(async (transaction) => {
			await this.lockEvent(eventId, transaction);
			const event = await this.requireEvent(eventId, transaction);

			if (isBundledReservationComplete(event.attemptRef)) {
				return event;
			}

			if (!isBundledReservationPending(event.attemptRef)) {
				throw new Error(
					`AI usage event ${eventId} is not a bundled reservation`,
				);
			}

			if (event.status === "refunded" || event.status === "reconciled") {
				return event;
			}

			if (!event.attemptRef) {
				throw new Error(`AI usage event ${eventId} has no attempt ref`);
			}

			const updated = await this.repository.transitionEventAttemptRef(
				eventId,
				event.attemptRef,
				bundledReservationCompletedAttemptRef(event.attemptRef),
				["reserved", "settled", "reconcile_failed"],
				transaction,
			);

			if (!updated) {
				throw new MeteringStateConflictError(
					eventId,
					event.status,
					"complete bundled reservation for",
				);
			}

			return updated;
		});

		return completed;
	}

	/**
	 * Local provider-cost estimate for a measured operation (reserve sizing and
	 * provisional settlement). Never blocks work: a missing catalog rate or a
	 * pricing lookup failure yields null and the caller falls back to the
	 * registry floor.
	 */
	async estimateMeasuredCost(
		input: MeasuredCostEstimateInput,
	): Promise<MeasuredCostEstimate | null> {
		try {
			return await this.modelPricing.quoteMeasuredEstimate(input);
		} catch (error) {
			this.logger.warn(
				`Measured cost estimate failed for ${input.modelId}: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
			return null;
		}
	}

	get usdMicrosPerCredit(): number {
		return this.modelPricing.usdMicrosPerCredit;
	}

	async reserve(
		operation: MeteredOperation,
		subject: MeteringSubject,
		estimate: MeteringReserveEstimate,
	): Promise<AiUsageEvent> {
		const outcome = await this.reserveWithReplay(operation, subject, estimate);

		if (outcome.replay === "settled" || outcome.replay === "reconciled") {
			throw new MeteringStateConflictError(
				outcome.event.id,
				outcome.event.status,
				"reuse reservation for provider execution on",
			);
		}

		return outcome.event;
	}

	async reserveWithReplay(
		operation: MeteredOperation,
		subject: MeteringSubject,
		estimate: MeteringReserveEstimate,
	): Promise<MeteringReserveOutcome> {
		this.assertPositiveCredits(estimate.credits, "reserve credits");
		this.assertNonEmpty(estimate.idempotencyKey, "reserve idempotency key");
		this.assertOptionalCost(estimate.estimatedCostUsdMicros);
		const pricing = operationPricing(operation);

		const eventId = estimate.eventId ?? randomUUID();
		const payer = subjectPayer(subject);
		const organizationId = subject.organizationId ?? null;

		return this.repository.transaction(async (transaction) => {
			await this.repository.acquireOperationLock(
				this.reserveOperationLock(estimate.idempotencyKey),
				transaction,
			);

			const existing = await this.repository.findEventByIdempotencyKey(
				estimate.idempotencyKey,
				transaction,
			);

			if (existing) {
				this.assertReserveReplay(existing, operation, subject, estimate);
				return {
					event: existing,
					replay: this.reserveReplay(existing),
					replayed: true,
				};
			}

			let minimumReserve = pricing.reserveFloorCredits;

			if (estimate.parentEventId) {
				const parent = await this.requireEvent(
					estimate.parentEventId,
					transaction,
				);

				// Same-PAYER, not same-actor: a second member continuing a chat in
				// the same org workspace is legal; a cross-pool child is never.
				if (this.eventPayerKey(parent) !== this.payerKey(payer)) {
					throw new Error(
						`AI usage parent ${parent.id} belongs to another owner`,
					);
				}

				assertOperationParentAllowed(operation, parent.operation);

				// A connector child renders on the user's own provider subscription
				// (zero provider cost to us), so the media floor does not apply.
				if (parent.operation === "connector") {
					minimumReserve = Math.min(
						minimumReserve,
						operationPricing("connector").reserveFloorCredits,
					);
				}
			} else {
				assertOperationParentAllowed(operation);
			}

			if (estimate.credits < minimumReserve) {
				throw new Error(
					`${operation} requires a reserve of at least ${minimumReserve} centi-credits`,
				);
			}

			// CreditsService deliberately takes its consume-idempotency lock before
			// the owner lock. The event insert follows the debit in this same DB
			// transaction, so both commit or both roll back before provider work.
			await this.credits.consume(
				payer,
				estimate.credits,
				{
					actorUserId: subject.actorUserId,
					// Ruling 5: any positive balance admits the full reserve (the
					// remainder overdrafts); zero-or-negative refuses new work.
					admission: "requirePositiveBalance",
					idempotencyKey: this.reserveLedgerKey(eventId),
					meta: {
						action: operation,
						reason: "ai_usage_reserve",
						usageEventId: eventId,
					},
					planHold: "active",
				},
				transaction,
			);

			// Member-limit gate AFTER the debit, inside the same transaction: the
			// owner lock consume() just took serializes concurrent member reserves,
			// and a limit breach rolls the debit back atomically. Checking before
			// consume would need the owner lock first and deadlock a same-key
			// replay race against the consume-op lock ordering.
			await this.enforceMemberLimit(subject, estimate.credits, transaction);

			const inserted = await this.repository.insertEvent(
				{
					attemptRef: estimate.attemptRef ?? null,
					chatId: estimate.chatId ?? null,
					estimatedCostUsdMicros: estimate.estimatedCostUsdMicros ?? null,
					id: eventId,
					idempotencyKey: estimate.idempotencyKey,
					messageId: estimate.messageId ?? null,
					model: estimate.model ?? null,
					operation,
					organizationId,
					parentEventId: estimate.parentEventId ?? null,
					provider: estimate.provider ?? null,
					pricingSnapshot: this.reservationPricingSnapshot(
						operation,
						pricing,
						estimate,
						subject,
					),
					reservedCredits: estimate.credits,
					status: "reserved",
					userId: subject.actorUserId,
				},
				transaction,
			);

			if (inserted.id !== eventId) {
				throw new Error(
					`AI usage reserve replay raced for key ${estimate.idempotencyKey}`,
				);
			}

			return { event: inserted, replay: "none", replayed: false };
		});
	}

	/**
	 * Calendar-month member limit inside an org workspace. Runs under the org
	 * balance lock (already held by the reserve debit in this transaction);
	 * the spend sum excludes the current event, which is inserted after.
	 */
	private async enforceMemberLimit(
		subject: MeteringSubject,
		requiredCredits: number,
		transaction: MeteringTransaction,
	): Promise<void> {
		const breach = await this.resolveMemberLimitBreach(
			subject,
			requiredCredits,
			transaction,
		);

		if (breach) {
			throw new MemberCreditLimitError(
				breach.limit,
				breach.spent,
				requiredCredits,
			);
		}
	}

	/**
	 * Shared limit arithmetic for the hard reserve gate and the soft
	 * settlement re-check. `sumMemberSpendThisMonth` already counts the
	 * current event at COALESCE(final, reserved), so `spent + delta` is the
	 * exact post-adjustment month total.
	 */
	private async resolveMemberLimitBreach(
		subject: MeteringSubject,
		requiredCredits: number,
		transaction: MeteringTransaction,
	): Promise<{ limit: number; spent: number } | null> {
		if (!subject.organizationId) {
			return null;
		}

		const resolved = await this.organizationLimits.resolveMemberLimit(
			subject.organizationId,
			subject.actorUserId,
			subject.actorIsLimitExempt === true,
			transaction,
		);

		if (resolved.limitCredits === null) {
			return null;
		}

		const spent = await this.organizationLimits.sumMemberSpendThisMonth(
			subject.organizationId,
			subject.actorUserId,
			new Date(),
			transaction,
		);

		return spent + requiredCredits > resolved.limitCredits
			? { limit: resolved.limitCredits, spent }
			: null;
	}

	/** The pool that pays for an event: its org when set, else its actor. */
	private eventPayer(event: AiUsageEvent): CreditOwner {
		return ownerFromIds(event.userId, event.organizationId);
	}

	private eventPayerKey(event: AiUsageEvent): string {
		return event.organizationId ? `org:${event.organizationId}` : event.userId;
	}

	private payerKey(owner: CreditOwner): string {
		return owner.type === "org" ? `org:${owner.organizationId}` : owner.userId;
	}

	async settle(
		eventId: string,
		settlement: MeteringSettlement,
	): Promise<AiUsageEvent> {
		let settlementUsdMicrosPerCredit: number | undefined;

		// Token quotes include volatile catalog provenance (source/refreshedAt).
		// A completed request replay validates the stable caller input against the
		// durable event and must not fetch a newer quote first.
		if (settlement.pricing === "token") {
			const existing = await this.requireEvent(eventId);

			if (existing.status === "settled") {
				this.assertTokenSettlementReplay(existing, settlement);
				return existing;
			}

			if (existing.status === "reconciled") {
				this.assertReconciledTokenSettlementReplay(existing, settlement);
				return existing;
			}

			// Model prices are looked up at completion, but the USD-to-credit product
			// conversion is a reservation-time customer term and must survive a
			// config change or deploy while a generation is in flight.
			settlementUsdMicrosPerCredit =
				this.reconciliationUsdMicrosPerCredit(existing);
		}

		const prepared = await this.prepareSettlement(
			settlement,
			settlementUsdMicrosPerCredit,
		);

		return this.repository.transaction((transaction) =>
			this.lockAndSettlePreparedEvent(
				eventId,
				settlement,
				prepared,
				transaction,
			),
		);
	}

	/**
	 * Settles a measured (or legacy fixed) event from the strongest durable
	 * completion count.
	 *
	 * Stored output can lag provider completion after a crash. Holding the event
	 * lock while reading generation refs ensures recovery charges the maximum of
	 * the stored prefix and provider-completion evidence, using the price terms
	 * captured when the reservation was admitted.
	 */
	async settleMeasuredFromEvidence(
		eventId: string,
		storedUnits: number,
	): Promise<AiUsageEvent> {
		this.assertCompletedFixedUnits(storedUnits);

		const settled = await this.repository.transaction(async (transaction) => {
			await this.lockEvent(eventId, transaction);
			const event = await this.requireEvent(eventId, transaction);

			if (
				event.status === "settled" ||
				event.status === "reconciled" ||
				(event.status === "reconcile_failed" && event.finalCredits !== null)
			) {
				return event;
			}

			const pricing = this.recoveryOperationPricing(event);

			if (pricing.mode === "per_minute") {
				throw new Error(
					`AI usage event ${event.id} is not a unit-settled operation`,
				);
			}

			const refs = await this.repository.listGenerationRefs(
				event.id,
				transaction,
			);
			const evidenceUnits = this.fixedUnitEvidence(refs);

			if (refs.length > 0 && evidenceUnits === null) {
				throw new Error(
					`AI usage event ${event.id} has incomplete fixed-unit evidence`,
				);
			}

			const units = Math.max(storedUnits, evidenceUnits ?? 0);
			const settlement = this.evidenceSettlement(event, pricing, units);

			this.assertNonNegativeCredits(
				settlement.finalCredits,
				"evidence settlement credits",
			);
			const prepared = await this.prepareSettlement(settlement);

			if (event.status === "reconcile_failed") {
				const adjustment = await this.applyCreditAdjustment(
					event,
					event.reservedCredits,
					prepared.finalCredits,
					"settle",
					transaction,
				);

				const updated = await this.repository.updateEvent(
					event.id,
					["reconcile_failed"],
					{
						finalCredits: adjustment.finalCredits,
						pricingSnapshot: this.withAdjustmentMarkers(
							prepared.pricingSnapshot,
							adjustment,
						),
						settledAt: event.settledAt ?? new Date(),
					},
					transaction,
				);

				if (!updated) {
					throw new Error(
						`AI usage event ${event.id} lost its reconcile-failed fixed settlement`,
					);
				}

				return updated;
			}

			return this.settleLockedEvent(event, settlement, prepared, transaction);
		});

		return settled;
	}

	/**
	 * Atomically settles one mandatory direct-priced parent and one optional
	 * direct-priced child. Locks are always acquired parent first, then child,
	 * before any credit adjustment, so connector fee/media fee publication has
	 * no crash window and concurrent replays use one deterministic order.
	 */
	async settleDirectPair(
		parent: DirectMeteringSettlementRequest,
		child?: DirectMeteringSettlementRequest,
	): Promise<DirectMeteringSettlementPairOutcome> {
		if (parent.settlement.pricing !== "direct") {
			throw new Error("Atomic parent settlement must use direct pricing");
		}
		if (
			child?.settlement.pricing !== undefined &&
			child.settlement.pricing !== "direct"
		) {
			throw new Error("Atomic child settlement must use direct pricing");
		}
		if (child?.eventId === parent.eventId) {
			throw new Error(
				"Atomic settlement parent and child must be distinct events",
			);
		}

		const parentPrepared = await this.prepareSettlement(parent.settlement);
		const childPrepared = child
			? await this.prepareSettlement(child.settlement)
			: null;
		const outcome = await this.repository.transaction(async (transaction) => {
			await this.lockEvent(parent.eventId, transaction);
			if (child) {
				await this.lockEvent(child.eventId, transaction);
			}

			const parentEvent = await this.requireEvent(parent.eventId, transaction);
			const childEvent = child
				? await this.requireEvent(child.eventId, transaction)
				: null;

			if (
				childEvent &&
				(childEvent.parentEventId !== parentEvent.id ||
					this.eventPayerKey(childEvent) !== this.eventPayerKey(parentEvent))
			) {
				throw new Error(
					`AI usage event ${childEvent.id} is not a child of ${parentEvent.id}`,
				);
			}

			const settledParent = await this.settleLockedEvent(
				parentEvent,
				parent.settlement,
				parentPrepared,
				transaction,
			);
			const settledChild =
				child && childEvent && childPrepared
					? await this.settleLockedEvent(
							childEvent,
							child.settlement,
							childPrepared,
							transaction,
						)
					: null;

			return { child: settledChild, parent: settledParent };
		});

		return outcome;
	}

	/**
	 * Connector completion variant: the fixed-unit evidence upgrade and the
	 * parent/child direct settlement commit in one transaction. This removes the
	 * crash window where a completed child had fixedUnits=0 while its ref-less
	 * connector parent was still eligible for stranded-hold refund.
	 */
	async settleDirectPairWithFixedEvidence(
		parent: DirectMeteringSettlementRequest,
		child: DirectMeteringSettlementRequest | undefined,
		evidence: { completedUnits: number; eventId: string },
	): Promise<DirectMeteringSettlementPairOutcome> {
		if (parent.settlement.pricing !== "direct") {
			throw new Error("Atomic parent settlement must use direct pricing");
		}
		if (
			child?.settlement.pricing !== undefined &&
			child.settlement.pricing !== "direct"
		) {
			throw new Error("Atomic child settlement must use direct pricing");
		}
		if (child?.eventId === parent.eventId) {
			throw new Error(
				"Atomic settlement parent and child must be distinct events",
			);
		}
		if (
			evidence.eventId !== parent.eventId &&
			evidence.eventId !== child?.eventId
		) {
			throw new Error(
				"Fixed completion evidence must belong to the settled parent or child",
			);
		}
		this.assertCompletedFixedUnits(evidence.completedUnits);

		const parentPrepared = await this.prepareSettlement(parent.settlement);
		const childPrepared = child
			? await this.prepareSettlement(child.settlement)
			: null;
		const outcome = await this.repository.transaction(async (transaction) => {
			await this.lockEvent(parent.eventId, transaction);
			if (child) {
				await this.lockEvent(child.eventId, transaction);
			}

			const initialParent = await this.requireEvent(
				parent.eventId,
				transaction,
			);
			const initialChild = child
				? await this.requireEvent(child.eventId, transaction)
				: null;

			if (
				initialChild &&
				(initialChild.parentEventId !== initialParent.id ||
					this.eventPayerKey(initialChild) !==
						this.eventPayerKey(initialParent))
			) {
				throw new Error(
					`AI usage event ${initialChild.id} is not a child of ${initialParent.id}`,
				);
			}

			const evidenceEvent =
				evidence.eventId === initialParent.id ? initialParent : initialChild;

			if (!evidenceEvent) {
				throw new Error(
					`AI usage event ${evidence.eventId} disappeared before evidence upgrade`,
				);
			}

			await this.upgradeFixedGenerationUnitsLocked(
				evidenceEvent,
				evidence.completedUnits,
				transaction,
			);

			// The late-evidence path may repair a reconciled event's finalCredits;
			// reload both rows before replay validation.
			const parentEvent = await this.requireEvent(parent.eventId, transaction);
			const childEvent = child
				? await this.requireEvent(child.eventId, transaction)
				: null;
			const settledParent = await this.settleLockedEvent(
				parentEvent,
				parent.settlement,
				parentPrepared,
				transaction,
			);
			const settledChild =
				child && childEvent && childPrepared
					? await this.settleLockedEvent(
							childEvent,
							child.settlement,
							childPrepared,
							transaction,
						)
					: null;

			return { child: settledChild, parent: settledParent };
		});

		return outcome;
	}

	async refund(eventId: string, reason = "ai_usage_refund") {
		// A durable generation reference proves provider work occurred. Never turn
		// such an event into a refunded terminal state; leave it reserved so the
		// recovery/reconciliation path can price authoritative usage.
		return this.refundReserved(eventId, reason, true);
	}

	/**
	 * Full refund of a reserved hold for an operation whose provider cost is
	 * known locally and can never be reconciled from a gateway (lead scrape).
	 * The user owes nothing; the consumed provider spend is still recorded on
	 * the event so admin cost sums stay true.
	 */
	async refundWithProviderCost(
		eventId: string,
		providerCostUsdMicros: number,
		reason: string,
	): Promise<AiUsageEvent> {
		this.assertOptionalCost(providerCostUsdMicros);

		return this.refundReserved(eventId, reason, false, providerCostUsdMicros);
	}

	async captureGeneration(
		eventId: string,
		capture: CapturedGeneration,
	): Promise<AiUsageGenerationRef | null> {
		const capturedRef = capturedGenerationRef(capture.providerMetadata);

		if (!capturedRef) {
			return null;
		}

		const { generationId } = capturedRef;

		const captured = await this.repository.transaction(async (transaction) => {
			await this.lockEvent(eventId, transaction);
			const event = await this.requireEvent(eventId, transaction);

			if (event.status === "refunded" || event.status === "reconciled") {
				throw new MeteringStateConflictError(
					eventId,
					event.status,
					"capture a generation for",
				);
			}

			const ref = await this.repository.insertGenerationRef(
				{
					gatewayGenerationId: generationId,
					providerSource: capturedRef.source,
					stepUsage: capture.stepUsage ?? null,
					usageEventId: eventId,
				},
				transaction,
			);

			if (
				capture.stepUsage != null &&
				!isDeepStrictEqual(
					jsonComparable(ref.stepUsage),
					jsonComparable(capture.stepUsage),
				)
			) {
				throw new Error(
					`Gateway generation ${generationId} has conflicting step usage`,
				);
			}

			return { event, ref };
		});

		return captured.ref;
	}

	/**
	 * Raises the aggregate fixed-unit evidence attached to an event without ever
	 * lowering an already-durable count. Connector providers commonly expose a
	 * generation id in a submit receipt before the final output count is known;
	 * this turns that early fixedUnits=0 marker into completion evidence without
	 * conflicting with the immutable generation-id ownership contract.
	 */
	async upgradeFixedGenerationUnits(
		eventId: string,
		completedUnits: number,
	): Promise<AiUsageGenerationRef | null> {
		this.assertCompletedFixedUnits(completedUnits);

		return this.repository.transaction(async (transaction) => {
			await this.lockEvent(eventId, transaction);
			const event = await this.requireEvent(eventId, transaction);

			return this.upgradeFixedGenerationUnitsLocked(
				event,
				completedUnits,
				transaction,
			);
		});
	}

	/**
	 * Durable receipt of a non-gateway provider call (Serper pages, a
	 * Higgsfield/MCP submit). Legal on reserved, settled, reconcile_failed AND
	 * refunded events — a failed lead scrape still paid Serper (ruling 6). Only
	 * a reconciled event is closed to new evidence. Idempotent on the key.
	 */
	async captureProviderCallEvidence(
		eventId: string,
		evidence: ProviderCallEvidenceInput,
	): Promise<AiProviderCallEvidence> {
		assertProviderCallEvidenceInput(evidence);

		return this.repository.transaction(async (transaction) => {
			await this.lockEvent(eventId, transaction);
			const event = await this.requireEvent(eventId, transaction);

			if (event.status === "reconciled") {
				throw new MeteringStateConflictError(
					eventId,
					event.status,
					"capture provider call evidence for",
				);
			}

			return this.repository.insertProviderCallEvidence(
				{ ...evidence, usageEventId: eventId },
				transaction,
			);
		});
	}

	/** Durable provider receipts of one event (read-only). */
	async listProviderCallEvidence(
		eventId: string,
	): Promise<readonly AiProviderCallEvidence[]> {
		return this.repository.listProviderCallEvidence(eventId);
	}

	/**
	 * Settle (or improve) the cost of an evidence row. Status only upgrades
	 * (pending → estimated → contract_rate → measured; equal status re-applies)
	 * and units never decrease; a downgrade returns the stored row unchanged.
	 */
	async settleProviderCallEvidenceCost(
		evidenceId: string,
		cost: ProviderCallEvidenceCost,
	): Promise<AiProviderCallEvidence> {
		assertProviderCallEvidenceCost(cost);

		return this.repository.transaction(async (transaction) => {
			const current = await this.repository.findProviderCallEvidenceById(
				evidenceId,
				transaction,
			);

			if (!current) {
				throw new Error(`Provider call evidence ${evidenceId} not found`);
			}

			await this.lockEvent(current.usageEventId, transaction);
			const event = await this.requireEvent(current.usageEventId, transaction);

			if (event.status === "reconciled") {
				throw new MeteringStateConflictError(
					event.id,
					event.status,
					"settle provider call evidence for",
				);
			}

			if (
				!canUpgradeProviderCallCostStatus(current.costStatus, cost.costStatus)
			) {
				return current;
			}

			return this.repository.updateProviderCallEvidenceCost(
				evidenceId,
				{
					...cost,
					units: Math.max(current.units, cost.units ?? current.units),
				},
				transaction,
			);
		});
	}

	async reconcile(eventId: string): Promise<MeteringReconcileOutcome> {
		const initial = await this.requireEvent(eventId);

		if (initial.status === "reconciled") {
			return {
				adjustedCredits: 0,
				event: initial,
				reconciledCostUsdMicros: initial.reconciledCostUsdMicros ?? 0,
			};
		}

		if (initial.status === "refunded") {
			throw new MeteringStateConflictError(
				eventId,
				initial.status,
				"reconcile",
			);
		}

		if (isBundledReservationPending(initial.attemptRef)) {
			const pendingRefs = await this.repository.listGenerationRefs(eventId);

			throw new GatewayUsagePendingError(
				eventId,
				pendingRefs.map((ref) => ref.gatewayGenerationId),
			);
		}

		const refs = await this.repository.listGenerationRefs(eventId);
		const evidence = await this.repository.listProviderCallEvidence(eventId);
		const pendingEvidence = evidence.filter(
			(row) => row.costStatus === "pending",
		);

		// Provider-accepted work whose charge is not known yet: the sweep retries
		// exactly like a gateway generation that is not metered yet.
		if (pendingEvidence.length > 0) {
			throw new GatewayUsagePendingError(
				eventId,
				pendingEvidence.map((row) => `evidence:${row.id}`),
			);
		}

		if (refs.length === 0) {
			if (initial.status === "reserved") {
				// Evidence may still land; the stranded sweep refunds ref-less
				// reserved holds anyway (provider-call evidence survives the refund).
				throw new GatewayUsagePendingError(eventId, []);
			}

			if (initial.status === "settled" && evidence.length === 0) {
				// The settlement is a durable, caller-observed billing fact with no
				// provider evidence to reprice it — finalize instead of failing.
				return this.finalizeSettledWithoutRefs(eventId);
			}

			if (evidence.length === 0) {
				throw new Error(`AI usage event ${eventId} has no generation refs`);
			}
			// Evidence-only events (lead scrape, connector submit) price below
			// from their evidence rows with an empty gateway allocation.
		}

		const results = await Promise.allSettled(
			refs.map((ref) =>
				this.gateway.getGenerationInfo({
					id: ref.gatewayGenerationId,
					source: generationRefSource(ref),
				}),
			),
		);
		const pendingIds = results.flatMap((result, index) =>
			result.status === "rejected" && isGatewayUsagePending(result.reason)
				? [refs[index]?.gatewayGenerationId].filter(
						(value): value is string => value !== undefined,
					)
				: [],
		);

		if (pendingIds.length > 0) {
			throw new GatewayUsagePendingError(eventId, pendingIds, {
				cause: results.find((result) => result.status === "rejected"),
			});
		}

		const rejected = results.find((result) => result.status === "rejected");

		if (rejected?.status === "rejected") {
			await this.terminalizeReconciliationFailure(eventId);
			throw rejected.reason;
		}

		const generationInfos = results.map((result) => {
			if (result.status !== "fulfilled") {
				throw new Error("Unreachable rejected gateway result");
			}

			return result.value;
		});
		const rawCostsUsd = generationInfos.map((info) => info.totalCost);
		const costAllocation = allocateGatewayCostMicros(rawCostsUsd);
		const costs = costAllocation.perGenerationUsdMicros;
		// Evidence rows are integer micros already; they join after the bigint-
		// safe gateway allocation. Gateway refs and evidence never overlap (a
		// gateway id lives in refs, an external receipt in evidence), so each
		// provider charge counts exactly once.
		const evidenceCostUsdMicros = sumProviderCallEvidenceUsdMicros(evidence);
		const reconciledCostUsdMicros =
			costAllocation.totalUsdMicros + evidenceCostUsdMicros;
		const customerBillableCostUsdMicros =
			allocateGatewayCostMicros(
				refs.flatMap((ref, index) => {
					// Legacy bundled helper refs (pre-deploy rows) and refunded provider
					// failures are provider spend, never customer charge. Helper rows
					// tagged helper_billable fall through and bill inside the parent.
					if (
						isBundledUnmeteredStepUsage(ref.stepUsage) ||
						isRefundedFailureStepUsage(ref.stepUsage)
					) {
						return [];
					}

					const rawCostUsd = rawCostsUsd[index];

					if (rawCostUsd === undefined) {
						throw new Error(
							`Missing reconciled cost for ${ref.gatewayGenerationId}`,
						);
					}

					return [rawCostUsd];
				}),
			).totalUsdMicros +
			sumProviderCallEvidenceUsdMicros(evidence, {
				customerBillableOnly: true,
			});
		this.assertOptionalCost(reconciledCostUsdMicros);
		return this.repository.transaction(async (transaction) => {
			await this.lockEvent(eventId, transaction);
			const event = await this.requireEvent(eventId, transaction);

			if (event.status === "reconciled") {
				return {
					adjustedCredits: 0,
					event,
					reconciledCostUsdMicros: event.reconciledCostUsdMicros ?? 0,
				};
			}

			if (event.status === "refunded") {
				throw new MeteringStateConflictError(
					eventId,
					event.status,
					"reconcile",
				);
			}

			const currentRefs = await this.repository.listGenerationRefs(
				eventId,
				transaction,
			);
			const expectedIds = refs.map((ref) => ref.gatewayGenerationId).sort();
			const currentIds = currentRefs
				.map((ref) => ref.gatewayGenerationId)
				.sort();

			if (!isDeepStrictEqual(expectedIds, currentIds)) {
				throw new GatewayUsagePendingError(eventId, currentIds);
			}

			// Evidence captured or re-priced since the unlocked read must not be
			// priced from a stale sum; the sweep simply retries.
			const currentEvidence = await this.repository.listProviderCallEvidence(
				eventId,
				transaction,
			);

			if (!providerCallEvidenceMatches(evidence, currentEvidence)) {
				throw new GatewayUsagePendingError(
					eventId,
					currentEvidence.map((row) => `evidence:${row.id}`),
				);
			}

			const currentCredits = event.finalCredits ?? event.reservedCredits;
			const reconciliationUsdMicrosPerCredit =
				this.reconciliationUsdMicrosPerCredit(event);
			// Gateway cost is authoritative for provider spend and, for token and
			// measured operations, for the customer charge. Legacy fixed/per-minute
			// reservations retain their reservation-time price.
			const reconciled = this.reconciledFinalCredits(
				event,
				currentRefs,
				customerBillableCostUsdMicros,
				reconciliationUsdMicrosPerCredit,
			);
			this.assertNonNegativeCredits(
				reconciled.finalCredits,
				"reconciled final credits",
			);
			const adjustment = await this.applyCreditAdjustment(
				event,
				currentCredits,
				reconciled.finalCredits,
				"reconcile",
				transaction,
			);
			const finalCredits = adjustment.finalCredits;

			const reconciledAt = new Date();

			const costByGenerationId = new Map(
				refs.map((ref, index) => [ref.gatewayGenerationId, costs[index]]),
			);

			for (const ref of currentRefs) {
				const cost = costByGenerationId.get(ref.gatewayGenerationId);

				if (cost === undefined) {
					throw new Error(
						`Missing reconciled cost for ${ref.gatewayGenerationId}`,
					);
				}

				await this.repository.markGenerationRefReconciled(
					ref.id,
					cost,
					reconciledAt,
					transaction,
				);
			}

			const usage = this.aggregateGatewayUsage(generationInfos);
			const models = new Set(generationInfos.map((info) => info.model));
			const providers = new Set(
				generationInfos.map((info) => info.providerName),
			);
			const pricingSnapshot = this.reconciledPricingSnapshot(
				event,
				currentRefs,
				refs,
				generationInfos,
				costs,
				customerBillableCostUsdMicros,
				finalCredits,
				reconciliationUsdMicrosPerCredit,
				currentEvidence,
			);
			const rawUsage = this.reconciledRawUsage(
				event.rawUsage,
				currentRefs,
				generationInfos,
			);
			// Evidence-only events carry no gateway generation: their settlement-
			// time model/provider/token columns stand.
			const gatewayColumns =
				generationInfos.length === 0
					? {}
					: {
							cacheReadTokens: usage.cacheReadTokens,
							cacheWriteTokens: usage.cacheWriteTokens,
							inputTokens: usage.inputTokens,
							model:
								models.size === 1
									? (generationInfos[0]?.model ?? null)
									: "multiple",
							outputTokens: usage.outputTokens,
							provider:
								providers.size === 1
									? (generationInfos[0]?.providerName ?? null)
									: "multiple",
						};
			const updated = await this.repository.updateEvent(
				eventId,
				["reserved", "settled", "reconcile_failed"],
				{
					...gatewayColumns,
					executionLeaseExpiresAt: null,
					executionLeaseToken: null,
					finalCredits,
					pricingSnapshot: this.withAdjustmentMarkers(
						withReviewFlags(pricingSnapshot, reconciled.reviewFlags),
						adjustment,
					),
					rawUsage,
					reconciledAt,
					reconciledCostUsdMicros,
					settledAt: event.settledAt ?? reconciledAt,
					status: "reconciled",
				},
				transaction,
			);

			if (!updated) {
				throw new Error(
					`AI usage event ${eventId} lost its reconcile transition`,
				);
			}

			return {
				adjustedCredits: finalCredits - currentCredits,
				event: updated,
				reconciledCostUsdMicros,
			};
		});
	}

	async recoverStaleReservations(
		createdBefore: Date,
		limit = 100,
		now = new Date(),
		options: { reconcileRefs?: boolean } = {},
	): Promise<MeteringRecoveryOutcome> {
		if (!Number.isInteger(limit) || limit <= 0) {
			throw new Error("Metering recovery limit must be a positive integer");
		}

		const events = await this.repository.listStaleReserved(
			createdBefore,
			limit,
		);
		const outcome: MeteringRecoveryOutcome = {
			failed: 0,
			pending: 0,
			reconciled: 0,
			refunded: 0,
			scanned: events.length,
			skipped: 0,
		};

		for (const event of events) {
			const refs = await this.repository.listGenerationRefs(event.id);

			if (refs.length === 0) {
				try {
					const recovered = await this.refundReserved(
						event.id,
						"ai_usage_stranded_recovery",
						true,
					);

					if (recovered.status === "refunded") {
						outcome.refunded += 1;
					} else if (recovered.status === "reserved") {
						// A generation ref landed between the sweep read and the locked
						// refund check. Leave the hold intact and retry reconciliation.
						outcome.pending += 1;
					}
				} catch (error) {
					if (error instanceof MeteringStateConflictError) {
						// The event settled between the sweep read and the locked refund
						// check: nothing is stranded any more, the settled path owns it.
						outcome.pending += 1;
					} else {
						// Never terminalize a ref-less hold over a failed refund write:
						// that would turn the whole reserve into a charge. The row stays
						// reserved and sweep-selectable; only this event fails, not the
						// remaining batch.
						this.logger.error(
							`Stranded metering refund failed for ${event.id}`,
							error instanceof Error ? error.stack : String(error),
						);
						outcome.failed += 1;
					}
				}

				continue;
			}

			if (options.reconcileRefs === false) {
				// The caller runs without gateway reconciliation config (see the
				// stranded recovery task): refunds are database-only, but pricing a
				// ref-bearing row needs a gateway key. Leave it reserved for the
				// next configured sweep instead of terminalizing deployment drift.
				outcome.skipped += 1;
				continue;
			}

			try {
				if (isBundledReservationPending(event.attemptRef)) {
					await this.completeBundledReservation(event.id);
				}

				await this.reconcile(event.id);
				outcome.reconciled += 1;
			} catch (error) {
				if (error instanceof GatewayUsagePendingError) {
					if (
						event.createdAt.getTime() +
							RESERVED_RECONCILIATION_PENDING_MAX_AGE_MS <=
						now.getTime()
					) {
						await this.terminalizeSweepFailure(event, error);
						outcome.failed += 1;
					} else {
						outcome.pending += 1;
					}
				} else {
					await this.terminalizeSweepFailure(event, error);
					outcome.failed += 1;
				}
			}
		}

		return outcome;
	}

	async recoverUnreconciledSettled(
		createdBefore: Date,
		limit = 100,
		now = new Date(),
	): Promise<MeteringReconciliationSweepOutcome> {
		if (!Number.isInteger(limit) || limit <= 0) {
			throw new Error("Metering recovery limit must be a positive integer");
		}

		const events = await this.repository.listUnreconciledSettled(
			createdBefore,
			limit,
		);
		const outcome: MeteringReconciliationSweepOutcome = {
			failed: 0,
			pending: 0,
			reconciled: 0,
			scanned: events.length,
		};

		for (const event of events) {
			try {
				if (isBundledReservationPending(event.attemptRef)) {
					await this.completeBundledReservation(event.id);
				}

				await this.reconcile(event.id);
				outcome.reconciled += 1;
			} catch (error) {
				if (error instanceof GatewayUsagePendingError) {
					const pendingSince = event.settledAt ?? event.createdAt;

					if (
						pendingSince.getTime() +
							SETTLED_RECONCILIATION_PENDING_MAX_AGE_MS <=
						now.getTime()
					) {
						await this.terminalizeSweepFailure(event, error);
						outcome.failed += 1;
					} else {
						outcome.pending += 1;
					}
				} else {
					await this.terminalizeSweepFailure(event, error);
					outcome.failed += 1;
				}
			}
		}

		return outcome;
	}

	/**
	 * Retry sweep over due reconcile_failed rows. Every failure re-enters
	 * terminalizeReconciliationFailure, which advances the backoff schedule;
	 * dead-lettered rows (NULL next attempt) are never selected.
	 */
	async retryFailedReconciliations(
		now: Date,
		limit = 100,
	): Promise<MeteringReconciliationSweepOutcome> {
		if (!Number.isInteger(limit) || limit <= 0) {
			throw new Error("Metering recovery limit must be a positive integer");
		}

		const events = await this.repository.listRetryableReconcileFailed(
			now,
			limit,
		);
		const outcome: MeteringReconciliationSweepOutcome = {
			failed: 0,
			pending: 0,
			reconciled: 0,
			scanned: events.length,
		};

		for (const event of events) {
			try {
				if (isBundledReservationPending(event.attemptRef)) {
					await this.completeBundledReservation(event.id);
				}

				await this.reconcile(event.id);
				outcome.reconciled += 1;
			} catch (error) {
				await this.terminalizeSweepFailure(event, error);

				if (error instanceof GatewayUsagePendingError) {
					outcome.pending += 1;
				} else {
					outcome.failed += 1;
				}
			}
		}

		return outcome;
	}

	/**
	 * Settled events with zero generation refs are invisible to the normal
	 * reconciliation sweep. Once old enough for late ref capture to have won,
	 * reconcile() finalizes them from their settlement evidence.
	 */
	async recoverSettledWithoutRefs(
		createdBefore: Date,
		limit = 100,
	): Promise<MeteringReconciliationSweepOutcome> {
		if (!Number.isInteger(limit) || limit <= 0) {
			throw new Error("Metering recovery limit must be a positive integer");
		}

		const events = await this.repository.listSettledWithoutRefs(
			createdBefore,
			limit,
		);
		const outcome: MeteringReconciliationSweepOutcome = {
			failed: 0,
			pending: 0,
			reconciled: 0,
			scanned: events.length,
		};

		for (const event of events) {
			try {
				await this.reconcile(event.id);
				outcome.reconciled += 1;
			} catch (error) {
				if (error instanceof GatewayUsagePendingError) {
					outcome.pending += 1;
				} else {
					await this.terminalizeSweepFailure(event, error);
					outcome.failed += 1;
				}
			}
		}

		return outcome;
	}

	/**
	 * Cross-replica execution lease surface for stream owners (ai-chat). The
	 * lease marks a reserved hold as provably live so duplicate admissions
	 * 409 and the stranded sweep skips it. Heartbeat/release never throw —
	 * losing a lease mid-stream degrades to today's age-based arithmetic.
	 */
	async acquireExecutionLease(
		eventId: string,
		token: string,
		ttlMs: number,
	): Promise<AiUsageEvent | null> {
		return this.repository.acquireExecutionLease(eventId, token, ttlMs);
	}

	/**
	 * Three-state so a stream owner can tell a confirmed CAS miss (`lost`: the
	 * row is no longer reserved under this token — abort) from a transport
	 * failure (`error`: the lease may well still be ours — keep retrying until
	 * the known expiry passes).
	 */
	async heartbeatExecutionLease(
		eventId: string,
		token: string,
		ttlMs: number,
	): Promise<ExecutionLeaseHeartbeat> {
		try {
			const renewed = await this.repository.heartbeatExecutionLease(
				eventId,
				token,
				ttlMs,
			);

			return renewed ? "renewed" : "lost";
		} catch (error) {
			this.logger.warn(
				`Execution lease heartbeat failed for ${eventId}: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
			return "error";
		}
	}

	async releaseExecutionLease(eventId: string, token: string): Promise<void> {
		try {
			await this.repository.releaseExecutionLease(eventId, token);
		} catch (error) {
			// The lease self-expires; a failed release only delays adoption.
			this.logger.warn(
				`Execution lease release failed for ${eventId}: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
		}
	}

	/** Finalize a settled event that has no provider evidence to reprice it. */
	private async finalizeSettledWithoutRefs(
		eventId: string,
	): Promise<MeteringReconcileOutcome> {
		return this.repository.transaction(async (transaction) => {
			await this.lockEvent(eventId, transaction);
			const event = await this.requireEvent(eventId, transaction);

			if (event.status === "reconciled") {
				return {
					adjustedCredits: 0,
					event,
					reconciledCostUsdMicros: event.reconciledCostUsdMicros ?? 0,
				};
			}

			const refs = await this.repository.listGenerationRefs(
				eventId,
				transaction,
			);

			const evidence = await this.repository.listProviderCallEvidence(
				eventId,
				transaction,
			);

			if (
				refs.length > 0 ||
				evidence.length > 0 ||
				event.status !== "settled"
			) {
				// Late ref/evidence capture (or a state change) won the race under
				// the lock — the normal reconciliation path owns this event again.
				throw new GatewayUsagePendingError(
					eventId,
					refs.map((ref) => ref.gatewayGenerationId),
				);
			}

			const snapshot = isRecord(event.pricingSnapshot)
				? event.pricingSnapshot
				: null;

			// A measured charge taken from the registry floor (no catalog rate)
			// with no provider evidence is a flat number, not the provider cost
			// decision 3 requires. Never finalize it silently: the sweep parks it
			// in reconcile_failed where admin views show it for repair.
			if (
				(event.finalCredits ?? 0) > 0 &&
				snapshotReviewFlags(snapshot).includes("no_catalog_rate")
			) {
				throw new Error(
					`AI usage event ${eventId} was settled from the registry floor without a catalog rate and needs admin review`,
				);
			}

			const snapshotCost = snapshot?.costUsdMicros;
			const reconciledCostUsdMicros =
				Number.isSafeInteger(snapshotCost) && (snapshotCost as number) >= 0
					? (snapshotCost as number)
					: 0;
			const settlementEvidence = this.buildSettlementReplayEvidence(event);
			const updated = await this.repository.updateEvent(
				eventId,
				["settled"],
				{
					executionLeaseExpiresAt: null,
					executionLeaseToken: null,
					pricingSnapshot: {
						...(snapshot ?? {}),
						reconciliation: { source: "no_generation_refs" },
						...(settlementEvidence ? { settlementEvidence } : {}),
					},
					reconciledAt: new Date(),
					reconciledCostUsdMicros,
					status: "reconciled",
				},
				transaction,
			);

			if (!updated) {
				throw new Error(
					`AI usage event ${eventId} lost its reconcile transition`,
				);
			}

			// The customer charge (the settlement) stands; reconciliation rights
			// close exactly like a normal zero-adjustment reconcile.
			await this.credits.closePlanHold(
				this.eventPayer(event),
				this.reserveLedgerKey(event.id),
				transaction,
			);
			await this.credits.closePlanHold(
				this.eventPayer(event),
				`settle:${event.id}`,
				transaction,
			);

			return {
				adjustedCredits: 0,
				event: updated,
				reconciledCostUsdMicros,
			};
		});
	}

	private async upgradeFixedGenerationUnitsLocked(
		event: AiUsageEvent,
		completedUnits: number,
		transaction: MeteringTransaction,
	): Promise<AiUsageGenerationRef | null> {
		const pricing = this.recoveryOperationPricing(event);

		if (pricing.mode !== "fixed" && pricing.mode !== "measured") {
			throw new Error(
				`AI usage event ${event.id} is not a unit-settled operation`,
			);
		}

		if (event.status === "refunded") {
			throw new MeteringStateConflictError(
				event.id,
				event.status,
				"upgrade fixed-unit evidence for",
			);
		}

		const refs = await this.repository.listGenerationRefs(
			event.id,
			transaction,
		);

		if (refs.length === 0) {
			return null;
		}

		let currentUnits = 0;
		for (const ref of refs) {
			const fixedUnits = fixedUnitsFromStepUsage(ref.stepUsage);

			if (fixedUnits === null) {
				throw new Error(
					`Gateway generation ${ref.gatewayGenerationId} lacks fixed-unit evidence`,
				);
			}

			currentUnits += fixedUnits;
		}

		if (currentUnits >= completedUnits) {
			return refs[0] ?? null;
		}

		const first = refs[0];
		if (!first || !isRecord(first.stepUsage)) {
			throw new Error(
				`AI usage event ${event.id} lost its generation evidence`,
			);
		}

		const metering = first.stepUsage.metering;
		if (!isRecord(metering)) {
			throw new Error(
				`Gateway generation ${first.gatewayGenerationId} lacks metering evidence`,
			);
		}

		const upgraded = await this.repository.updateGenerationRefStepUsage(
			first.id,
			{
				...first.stepUsage,
				metering: {
					...metering,
					fixedUnits:
						(fixedUnitsFromStepUsage(first.stepUsage) ?? 0) +
						(completedUnits - currentUnits),
				},
			},
			transaction,
		);

		// A very late completion checkpoint may race the stranded-reservation
		// reconciler. Repair only registry-recovered fixed pricing; an explicit
		// direct settlement remains authoritative and is never repriced here.
		const lateCompletionCredits = this.lateCompletionCredits(
			event,
			pricing,
			completedUnits,
		);

		if (
			event.status === "reconciled" &&
			isRegistryRecoveryPricing(event.pricingSnapshot) &&
			lateCompletionCredits !== null
		) {
			const targetCredits = lateCompletionCredits;

			if (
				!Number.isSafeInteger(targetCredits) ||
				targetCredits > POSTGRES_INTEGER_MAX
			) {
				throw new Error(
					`AI usage event ${event.id} completion credits exceed the database integer range`,
				);
			}
			const currentCredits = event.finalCredits ?? 0;

			if (targetCredits > currentCredits) {
				await this.credits.consume(
					this.eventPayer(event),
					targetCredits - currentCredits,
					{
						actorUserId: event.userId,
						allowOverdraft: true,
						idempotencyKey: `completion:${event.id}:${targetCredits}`,
						meta: {
							action: event.operation,
							reason: "ai_usage_fixed_completion",
							usageEventId: event.id,
						},
					},
					transaction,
				);

				const updated = await this.repository.updateEvent(
					event.id,
					["reconciled"],
					{
						finalCredits: targetCredits,
						pricingSnapshot: {
							...(isRecord(event.pricingSnapshot) ? event.pricingSnapshot : {}),
							lateFixedCompletion: {
								...(pricing.mode === "fixed"
									? { creditsPerUnit: pricing.creditsPerUnit }
									: {
											estimatedUnitUsdMicros: pricing.estimatedUnitUsdMicros,
										}),
								units: completedUnits,
							},
							units: completedUnits,
						},
					},
					transaction,
				);

				if (!updated) {
					throw new Error(
						`AI usage event ${event.id} lost its completion evidence transition`,
					);
				}

				await this.enqueueCreditThresholds(event, transaction);
			}
		}

		return upgraded;
	}

	private async lockAndSettlePreparedEvent(
		eventId: string,
		settlement: MeteringSettlement,
		prepared: PreparedMeteringSettlement,
		transaction: MeteringTransaction,
	): Promise<AiUsageEvent> {
		await this.lockEvent(eventId, transaction);
		const event = await this.requireEvent(eventId, transaction);

		return this.settleLockedEvent(event, settlement, prepared, transaction);
	}

	private async settleLockedEvent(
		event: AiUsageEvent,
		settlement: MeteringSettlement,
		prepared: PreparedMeteringSettlement,
		transaction: MeteringTransaction,
	): Promise<AiUsageEvent> {
		if (event.status === "settled") {
			if (settlement.pricing === "token") {
				this.assertTokenSettlementReplay(event, settlement);
			} else {
				this.assertSettlementReplay(event, prepared);
			}
			return event;
		}

		if (event.status === "reconciled") {
			this.assertReconciledSettlementReplay(event, settlement, prepared);
			return event;
		}

		if (event.status !== "reserved") {
			throw new MeteringStateConflictError(event.id, event.status, "settle");
		}

		const adjustment = await this.applyCreditAdjustment(
			event,
			event.reservedCredits,
			prepared.finalCredits,
			"settle",
			transaction,
		);

		const settledAt = new Date();
		const updated = await this.repository.updateEvent(
			event.id,
			["reserved"],
			{
				cacheReadTokens: prepared.usage?.cacheReadTokens ?? null,
				cacheWriteTokens: prepared.usage?.cacheWriteTokens ?? null,
				executionLeaseExpiresAt: null,
				executionLeaseToken: null,
				finalCredits: adjustment.finalCredits,
				inputTokens: prepared.usage?.inputTokens ?? null,
				model: prepared.model,
				outputTokens: prepared.usage?.outputTokens ?? null,
				pricingSnapshot: this.withAdjustmentMarkers(
					prepared.pricingSnapshot,
					adjustment,
				),
				provider: prepared.provider,
				rawUsage: prepared.rawUsage,
				settledAt,
				status: "settled",
			},
			transaction,
		);

		if (!updated) {
			throw new Error(`AI usage event ${event.id} lost its settle transition`);
		}

		return updated;
	}

	/**
	 * Sweep-side terminalization. reconcile() already terminalizes a
	 * non-pending gateway rejection inline; a second write here would advance
	 * the retry backoff twice for one failure, so skip when the row's attempt
	 * count moved since this sweep selected it.
	 */
	private async terminalizeSweepFailure(
		event: AiUsageEvent,
		cause: unknown,
	): Promise<void> {
		const current = await this.repository.findEventById(event.id);

		if (
			current?.status === "reconcile_failed" &&
			current.reconcileAttempts > event.reconcileAttempts
		) {
			return;
		}

		await this.terminalizeRecoveryFailure(event.id, cause);
	}

	private async terminalizeRecoveryFailure(
		eventId: string,
		cause: unknown,
	): Promise<void> {
		try {
			await this.terminalizeReconciliationFailure(eventId);
		} catch (error) {
			// Keep the event sweep-selectable when the terminal write itself fails.
			// A later sweep can retry after the database or ledger recovers.
			this.logger.error(
				`Failed to terminalize AI usage reconciliation for ${eventId} after ${
					cause instanceof Error ? cause.message : String(cause)
				}`,
				error instanceof Error ? error.stack : String(error),
			);
		}
	}

	private async prepareSettlement(
		settlement: MeteringSettlement,
		usdMicrosPerCredit?: number,
	): Promise<PreparedMeteringSettlement> {
		if (settlement.pricing === "token") {
			const quote = await this.modelPricing.quoteTokenUsage(
				settlement.modelId,
				settlement.usage,
				usdMicrosPerCredit,
			);

			return {
				costUsdMicros: quote.costUsdMicros,
				finalCredits: quote.credits,
				model: settlement.modelId,
				pricingSnapshot: {
					...quote.pricingSnapshot,
					costUsdMicros: quote.costUsdMicros,
					settlementUsage: quote.usage,
				},
				provider: settlement.provider ?? quote.pricingSnapshot.provider,
				rawUsage: settlement.rawUsage ?? settlement.usage,
				usage: quote.usage,
			};
		}

		this.assertNonNegativeCredits(settlement.finalCredits, "final credits");
		this.assertOptionalCost(settlement.costUsdMicros);
		const usage = settlement.usage
			? normalizeTokenUsage({
					inputTokenDetails: {
						cacheReadTokens: settlement.usage.cacheReadTokens,
						cacheWriteTokens: settlement.usage.cacheWriteTokens,
						noCacheTokens: settlement.usage.uncachedInputTokens,
					},
					inputTokens: settlement.usage.inputTokens,
					outputTokens: settlement.usage.outputTokens,
				})
			: null;

		return {
			costUsdMicros: settlement.costUsdMicros ?? null,
			finalCredits: settlement.finalCredits,
			model: settlement.model ?? null,
			pricingSnapshot: {
				...settlement.pricingSnapshot,
				costUsdMicros: settlement.costUsdMicros ?? null,
				...(usage ? { settlementUsage: usage } : {}),
			},
			provider: settlement.provider ?? null,
			rawUsage: settlement.rawUsage ?? settlement.usage ?? null,
			usage,
		};
	}

	private async applyCreditAdjustment(
		event: AiUsageEvent,
		currentCredits: number,
		requestedCredits: number,
		phase: "reconcile" | "settle",
		transaction: MeteringTransaction,
	): Promise<CreditAdjustmentOutcome> {
		let targetCredits = requestedCredits;
		let sanityCeiling: CreditAdjustmentOutcome["sanityCeiling"] = null;
		let memberLimitBreach: CreditAdjustmentOutcome["memberLimitBreach"] = null;
		const actorIsLimitExempt = snapshotActorIsLimitExempt(
			event.pricingSnapshot,
		);

		if (requestedCredits > currentCredits) {
			// Sanity ceiling: a target this far above the reserve is the shape of
			// a pricing-unit bug, not an honest run. The provider work is done and
			// the deliverable must never be discarded over it, so the debit is
			// CAPPED at the ceiling and the event carries a `sanityCeiling` marker
			// for admin review (logged as an error). This applies to every
			// operation: a refused settlement would fail the caller after the
			// provider cost was spent, whatever the pricing mode.
			const ceiling = maxFinalCreditsCeiling(
				event.operation,
				event.reservedCredits,
			);

			if (requestedCredits > ceiling) {
				this.logger.error(
					`AI usage event ${event.id} ${phase} of ${requestedCredits} centi-credits exceeds its sanity ceiling of ${ceiling}; debit capped for admin review`,
				);
				sanityCeiling = { attempted: requestedCredits, ceiling };
				targetCredits = Math.max(ceiling, currentCredits);
			}
		}

		const delta = targetCredits - currentCredits;

		if (delta > 0) {
			// Soft member-limit re-check: the provider cost is already spent, so a
			// breach settles anyway (ruling 5 accepts overage). The hard stop stays
			// at the next reserve, where the month sum already counts this event.
			// The exemption decision is the reserve-time one (durable term).
			const breach = await this.resolveMemberLimitBreach(
				{
					actorIsLimitExempt,
					actorUserId: event.userId,
					organizationId: event.organizationId,
				},
				delta,
				transaction,
			);

			if (breach) {
				memberLimitBreach = {
					deltaCredits: delta,
					limitCredits: breach.limit,
					spentCredits: breach.spent,
				};
				this.logger.warn(
					`AI usage event ${event.id} ${phase} exceeds the member limit of ${breach.limit} centi-credits (spent ${breach.spent}, delta ${delta})`,
				);
			}

			await this.credits.consume(
				this.eventPayer(event),
				delta,
				{
					actorUserId: event.userId,
					allowOverdraft: true,
					idempotencyKey: `${phase}:${event.id}`,
					meta: {
						action: event.operation,
						reason: `ai_usage_${phase}`,
						usageEventId: event.id,
					},
					...(phase === "settle" ? { planHold: "inactive" as const } : {}),
				},
				transaction,
			);
		} else if (delta < 0) {
			let remaining = Math.abs(delta);

			if (phase === "reconcile" && currentCredits > event.reservedCredits) {
				const settleAmount = Math.min(
					remaining,
					currentCredits - event.reservedCredits,
				);
				await this.credits.refundConsumeAmount(
					this.eventPayer(event),
					`settle:${event.id}`,
					{
						amount: settleAmount,
						idempotencyKey: `reconcile-refund:${event.id}:settle`,
						meta: {
							reason: "ai_usage_reconcile_refund",
							usageEventId: event.id,
						},
					},
					transaction,
				);
				remaining -= settleAmount;
			}

			if (remaining > 0) {
				await this.credits.refundConsumeAmount(
					this.eventPayer(event),
					this.reserveLedgerKey(event.id),
					{
						amount: remaining,
						idempotencyKey:
							phase === "settle"
								? `settle-refund:${event.id}`
								: `reconcile-refund:${event.id}:reserve`,
						meta: {
							reason: `ai_usage_${phase}_refund`,
							usageEventId: event.id,
						},
					},
					transaction,
				);
			}
		}

		if (phase === "settle") {
			await this.credits.markPlanHoldInactive(
				this.eventPayer(event),
				this.reserveLedgerKey(event.id),
				transaction,
			);
		} else {
			await this.credits.closePlanHold(
				this.eventPayer(event),
				this.reserveLedgerKey(event.id),
				transaction,
			);
			await this.credits.closePlanHold(
				this.eventPayer(event),
				`settle:${event.id}`,
				transaction,
			);
		}

		if (phase === "settle" || delta > 0) {
			await this.enqueueCreditThresholds(event, transaction);
		}

		return {
			actorIsLimitExempt,
			finalCredits: targetCredits,
			memberLimitBreach,
			sanityCeiling,
		};
	}

	private async enqueueCreditThresholds(
		event: AiUsageEvent,
		transaction: MeteringTransaction,
	): Promise<void> {
		if (event.organizationId !== null) {
			return;
		}

		const netConsumedCentiCredits = await this.credits.netConsumedCentiCredits(
			event.userId,
			transaction,
		);

		await this.lifecycleEvents.enqueueCreditThresholds(
			event.userId,
			netConsumedCentiCredits,
			transaction,
		);
	}

	/**
	 * Merge the server-side markers (soft member-limit breach, capped sanity
	 * ceiling, reserve-time limit exemption) into an outgoing snapshot patch.
	 * Replay validation strips them again (see stripSettlementMarkers).
	 */
	private withAdjustmentMarkers(
		pricingSnapshot: unknown,
		outcome: CreditAdjustmentOutcome,
	): unknown {
		if (
			!outcome.memberLimitBreach &&
			!outcome.sanityCeiling &&
			!outcome.actorIsLimitExempt
		) {
			return pricingSnapshot;
		}

		return {
			...(isRecord(pricingSnapshot) ? pricingSnapshot : {}),
			...(outcome.actorIsLimitExempt ? { actorIsLimitExempt: true } : {}),
			...(outcome.memberLimitBreach
				? { memberLimitBreach: outcome.memberLimitBreach }
				: {}),
			...(outcome.sanityCeiling
				? { sanityCeiling: outcome.sanityCeiling }
				: {}),
		};
	}

	private async refundReserved(
		eventId: string,
		reason: string,
		onlyWithoutGenerationRefs: boolean,
		providerCostUsdMicros?: number,
	): Promise<AiUsageEvent> {
		return this.repository.transaction(async (transaction) => {
			await this.lockEvent(eventId, transaction);
			const event = await this.requireEvent(eventId, transaction);

			if (event.status === "refunded") {
				return event;
			}

			if (event.status !== "reserved") {
				throw new MeteringStateConflictError(eventId, event.status, "refund");
			}

			if (onlyWithoutGenerationRefs) {
				const refs = await this.repository.listGenerationRefs(
					eventId,
					transaction,
				);

				if (refs.length > 0) {
					return event;
				}
			}

			await this.credits.refundConsumeAmount(
				this.eventPayer(event),
				this.reserveLedgerKey(event.id),
				{
					amount: event.reservedCredits,
					idempotencyKey: `settle-refund:${event.id}`,
					meta: { reason, usageEventId: event.id },
				},
				transaction,
			);
			await this.credits.closePlanHold(
				this.eventPayer(event),
				this.reserveLedgerKey(event.id),
				transaction,
			);

			const now = new Date();
			const updated = await this.repository.updateEvent(
				eventId,
				["reserved"],
				{
					executionLeaseExpiresAt: null,
					executionLeaseToken: null,
					finalCredits: 0,
					pricingSnapshot:
						providerCostUsdMicros === undefined
							? { reason, source: "refund" }
							: {
									costUsdMicros: providerCostUsdMicros,
									reason,
									source: "refund_with_provider_cost",
								},
					rawUsage: { reason },
					...(providerCostUsdMicros === undefined
						? {}
						: {
								reconciledAt: now,
								reconciledCostUsdMicros: providerCostUsdMicros,
							}),
					settledAt: now,
					status: "refunded",
				},
				transaction,
			);

			if (!updated) {
				throw new Error(`AI usage event ${eventId} lost its refund transition`);
			}

			return updated;
		});
	}

	/**
	 * Backoff bookkeeping for a failed reconciliation. Each call advances the
	 * attempt count and schedules the next sweep retry; the cap dead-letters
	 * the row (NULL next attempt) for admin review. A dead-lettered row that
	 * never settled is charged its best local evidence, never the whole
	 * reserve: the remainder of the hold is refunded through the same ledger
	 * path reconciliation uses.
	 */
	async terminalizeReconciliationFailure(
		eventId: string,
	): Promise<AiUsageEvent> {
		return this.repository.transaction(async (transaction) => {
			await this.lockEvent(eventId, transaction);
			const event = await this.requireEvent(eventId, transaction);

			if (event.status === "reconciled" || event.status === "refunded") {
				return event;
			}

			await this.credits.markPlanHoldInactive(
				this.eventPayer(event),
				this.reserveLedgerKey(event.id),
				transaction,
			);
			await this.credits.markPlanHoldInactive(
				this.eventPayer(event),
				`settle:${event.id}`,
				transaction,
			);

			// Backoff bookkeeping: each terminalization advances the attempt count
			// and schedules the next sweep retry; the cap dead-letters the row.
			const now = new Date();
			const attempts = event.reconcileAttempts + 1;
			const deadLettered = attempts >= RECONCILE_DEAD_LETTER_CAP;
			const nextReconcileAttemptAt = deadLettered
				? null
				: new Date(
						now.getTime() +
							Math.min(
								RECONCILE_RETRY_BASE_DELAY_MS * 2 ** event.reconcileAttempts,
								RECONCILE_RETRY_MAX_DELAY_MS,
							),
					);

			if (deadLettered) {
				this.logger.error(
					`AI usage event ${eventId} reconciliation is dead-lettered after ${attempts} attempts`,
				);
			}

			// A never-settled row keeps final_credits null so the balance add-back
			// treats it as in flight. Once dead-lettered nobody retries it, so the
			// row must stop hiding the hold — but the reserve is a worst-case
			// estimate, not a bill. Charge only what local evidence proves (unit or
			// duration step usage on the generation refs, settled provider-call
			// receipts) and refund the rest of the hold; with no priceable evidence
			// the whole hold is refunded — the run produced nothing we can price.
			// The row keeps status reconcile_failed with the dead-letter marker
			// (NULL next attempt) for admin review either way.
			let finalCredits = event.finalCredits;

			if (deadLettered && event.finalCredits === null) {
				const refs = await this.repository.listGenerationRefs(
					eventId,
					transaction,
				);
				const evidence = await this.repository.listProviderCallEvidence(
					eventId,
					transaction,
				);
				const charge = Math.min(
					this.deadLetterEvidenceCredits(event, refs, evidence),
					event.reservedCredits,
				);
				const adjustment = await this.applyCreditAdjustment(
					event,
					event.reservedCredits,
					charge,
					"reconcile",
					transaction,
				);
				finalCredits = adjustment.finalCredits;
			}

			const updated = await this.repository.updateEvent(
				eventId,
				["reserved", "settled", "reconcile_failed"],
				{
					finalCredits,
					nextReconcileAttemptAt,
					reconcileAttempts: attempts,
					reconciledAt: event.reconciledAt ?? now,
					status: "reconcile_failed",
				},
				transaction,
			);

			if (!updated) {
				throw new Error(
					`AI usage event ${eventId} lost its reconcile-failed transition`,
				);
			}

			return updated;
		});
	}

	/**
	 * Best locally provable charge for a never-settled dead-letter, in integer
	 * centi-credits. Reuses the reconcile path's evidence readers: fixed and
	 * measured operations price their step-usage unit counts, per-minute
	 * operations their duration evidence, and settled customer-billable
	 * provider-call receipts price next to either. Token holds carry no
	 * locally priceable step usage (only the gateway knows their cost), so
	 * their refs contribute nothing. Returns 0 when nothing local can price
	 * the run.
	 */
	private deadLetterEvidenceCredits(
		event: AiUsageEvent,
		refs: readonly AiUsageGenerationRef[],
		evidence: readonly AiProviderCallEvidence[],
	): number {
		try {
			const evidenceUsdMicros = sumProviderCallEvidenceUsdMicros(evidence, {
				customerBillableOnly: true,
			});
			// usdMicrosToCentiCredits floors at 1 cc; a zero receipt sum means "no
			// priced receipts", not a minimum charge.
			const evidenceCredits =
				evidenceUsdMicros > 0
					? usdMicrosToCentiCredits(
							evidenceUsdMicros,
							this.reconciliationUsdMicrosPerCredit(event),
						)
					: 0;
			const pricing = this.recoveryOperationPricing(event);
			let refCredits = 0;

			if (pricing.mode === "fixed" || pricing.mode === "measured") {
				const units = this.fixedUnitEvidence(refs);

				if (units !== null) {
					refCredits = this.evidenceSettlement(
						event,
						pricing,
						units,
					).finalCredits;
				}
			} else if (pricing.mode === "per_minute") {
				const durations = this.perMinuteDurationEvidence(
					refs,
					pricing.maxDurationSeconds,
				);

				if (durations) {
					refCredits = Math.max(
						pricing.minimumCredits,
						Math.ceil(durations.billedDurationSeconds / 60) *
							pricing.creditsPerMinute,
					);
				}
			}

			return evidenceCredits + refCredits;
		} catch (error) {
			// A malformed snapshot must not block the terminal write: the
			// dead-letter path is the last resort, so an unpriceable event simply
			// refunds in full and stays flagged for admin review.
			this.logger.error(
				`AI usage event ${event.id} dead-letter evidence pricing failed; refunding the hold`,
				error instanceof Error ? error.stack : String(error),
			);

			return 0;
		}
	}

	private aggregateGatewayUsage(
		infos: readonly Awaited<ReturnType<MeteringGateway["getGenerationInfo"]>>[],
	) {
		return infos.reduce(
			(usage, info) => ({
				cacheReadTokens: usage.cacheReadTokens + info.cachedTokens,
				cacheWriteTokens: usage.cacheWriteTokens + info.cacheCreationTokens,
				inputTokens: usage.inputTokens + info.promptTokens,
				outputTokens: usage.outputTokens + info.completionTokens,
			}),
			{
				cacheReadTokens: 0,
				cacheWriteTokens: 0,
				inputTokens: 0,
				outputTokens: 0,
			},
		);
	}

	private reservationPricingSnapshot(
		operation: MeteredOperation,
		pricing: OperationPricing,
		estimate: MeteringReserveEstimate,
		subject: MeteringSubject,
	): Record<string, unknown> {
		const common = {
			// The reserve-time exemption decision is a durable term: the soft
			// member-limit re-check at settle/reconcile must use the same input.
			...(subject.actorIsLimitExempt === true
				? { actorIsLimitExempt: true }
				: {}),
			mode: pricing.mode,
			operation,
			reserveFloorCredits: pricing.reserveFloorCredits,
			source: "operation_registry_reservation",
			usdMicrosPerCredit: this.modelPricing.usdMicrosPerCredit,
		};

		if (pricing.mode === "fixed") {
			return {
				...common,
				creditsPerUnit: pricing.creditsPerUnit,
				unit: pricing.unit,
			};
		}

		if (pricing.mode === "measured") {
			return {
				...common,
				estimatedUnitUsdMicros:
					estimate.measuredTerms?.estimatedUnitUsdMicros ?? null,
				...(pricing.maxDurationSeconds === undefined
					? {}
					: { maxDurationSeconds: pricing.maxDurationSeconds }),
				unit: pricing.unit,
				units: estimate.measuredTerms?.units ?? null,
			};
		}

		if (pricing.mode === "per_minute") {
			return {
				...common,
				creditsPerMinute: pricing.creditsPerMinute,
				maxDurationSeconds: pricing.maxDurationSeconds,
				minimumCredits: pricing.minimumCredits,
				unit: "minute",
			};
		}

		return common;
	}

	private reconciliationUsdMicrosPerCredit(event: AiUsageEvent): number {
		const snapshot = isRecord(event.pricingSnapshot)
			? event.pricingSnapshot
			: null;
		// A recovered (reconciled-from-reserved) row nests the reservation
		// snapshot; its anchor is still the reservation-time term.
		const nestedReservation = isRecord(snapshot?.reservationPricingSnapshot)
			? snapshot.reservationPricingSnapshot
			: null;
		const value =
			snapshot?.usdMicrosPerCredit ?? nestedReservation?.usdMicrosPerCredit;

		if (value === undefined) {
			return this.modelPricing.usdMicrosPerCredit;
		}

		if (!Number.isSafeInteger(value) || (value as number) <= 0) {
			throw new Error(
				`AI usage event ${event.id} has an invalid USD-per-credit snapshot`,
			);
		}

		return value as number;
	}

	private recoveryOperationPricing(
		event: AiUsageEvent,
	): RecoveredOperationPricing {
		const current = operationPricing(event.operation);
		const eventSnapshot = isRecord(event.pricingSnapshot)
			? event.pricingSnapshot
			: null;
		const nestedReservationSnapshot = isRecord(
			eventSnapshot?.reservationPricingSnapshot,
		)
			? eventSnapshot.reservationPricingSnapshot
			: null;
		const snapshot =
			eventSnapshot?.source === "operation_registry_reservation"
				? eventSnapshot
				: nestedReservationSnapshot;
		const settledFixedSnapshot =
			eventSnapshot?.source === "operation_registry" &&
			eventSnapshot.mode === "fixed"
				? eventSnapshot
				: null;
		const settledMeasuredSnapshot =
			eventSnapshot?.source === "measured_local" &&
			eventSnapshot.mode === "measured"
				? eventSnapshot
				: null;

		if (settledMeasuredSnapshot) {
			if (settledMeasuredSnapshot.operation !== event.operation) {
				throw new Error(
					`AI usage event ${event.id} has a conflicting settlement pricing snapshot`,
				);
			}

			return {
				...this.measuredRecoveryBase(current),
				estimatedUnitUsdMicros: optionalSnapshotInteger(
					settledMeasuredSnapshot.estimatedUnitUsdMicros,
				),
			};
		}

		// A transcription settled under the retired per-minute price carries
		// only that settlement snapshot (the reservation snapshot is replaced at
		// settle time); its durable debit stands through reconciliation.
		if (
			eventSnapshot?.mode === "per_minute" &&
			eventSnapshot.source !== "operation_registry_reservation"
		) {
			const creditsPerMinute = snapshotInteger(
				eventSnapshot.creditsPerMinute,
				"creditsPerMinute",
				{ allowZero: false, eventId: event.id },
			);

			return {
				allowedChildOperations: current.allowedChildOperations,
				allowedParentOperations: current.allowedParentOperations,
				creditsPerMinute,
				maxDurationSeconds: Number.isSafeInteger(
					eventSnapshot.maxDurationSeconds,
				)
					? (eventSnapshot.maxDurationSeconds as number)
					: "maxDurationSeconds" in current
						? (current.maxDurationSeconds ?? TRANSCRIPTION_MAX_DURATION_SECONDS)
						: TRANSCRIPTION_MAX_DURATION_SECONDS,
				minimumCredits: Number.isSafeInteger(eventSnapshot.minimumCredits)
					? (eventSnapshot.minimumCredits as number)
					: creditsPerMinute,
				mode: "per_minute",
				reserveFloorCredits: current.reserveFloorCredits,
				rootAllowed: current.rootAllowed,
			};
		}

		if (settledFixedSnapshot) {
			if (settledFixedSnapshot.operation !== event.operation) {
				throw new Error(
					`AI usage event ${event.id} has a conflicting settlement pricing snapshot`,
				);
			}

			// Legacy fixed settlement (or a fixed-priced product such as
			// lead_scrape): keep the settled unit price. A settled snapshot keeps
			// its own unit — a flat legacy lead_scrape ('operation') must still
			// reconcile after the registry moved to per-lead pricing.
			return this.legacyFixedPricing(
				event,
				current,
				settledFixedSnapshot.creditsPerUnit,
				current.reserveFloorCredits,
				settledFixedSnapshot.unit,
				{ allowUnitMismatch: true },
			);
		}

		if (snapshot?.source !== "operation_registry_reservation") {
			return this.currentRecoveryPricing(current);
		}

		if (snapshot.operation !== event.operation) {
			throw new Error(
				`AI usage event ${event.id} has a conflicting reservation pricing snapshot`,
			);
		}

		const reserveFloorCredits = snapshotInteger(
			snapshot.reserveFloorCredits,
			"reserveFloorCredits",
			{ allowZero: true, eventId: event.id },
		);

		// Reservation-time terms are durable. A hold admitted under the retired
		// fixed/per_minute modes settles and reconciles under those terms even
		// though the registry now prices the operation as measured.
		if (snapshot.mode === "fixed") {
			return this.legacyFixedPricing(
				event,
				current,
				snapshot.creditsPerUnit,
				reserveFloorCredits,
				snapshot.unit,
				// A flat hold ('operation') admitted before per-lead pricing.
				{ allowUnitMismatch: snapshot.unit === "operation" },
			);
		}

		if (snapshot.mode === "per_minute") {
			if (snapshot.unit !== "minute") {
				invalidSnapshotValue(event.id, "unit");
			}

			return {
				allowedChildOperations: current.allowedChildOperations,
				allowedParentOperations: current.allowedParentOperations,
				creditsPerMinute: snapshotInteger(
					snapshot.creditsPerMinute,
					"creditsPerMinute",
					{ allowZero: false, eventId: event.id },
				),
				maxDurationSeconds: snapshotInteger(
					snapshot.maxDurationSeconds,
					"maxDurationSeconds",
					{ allowZero: false, eventId: event.id },
				),
				minimumCredits: snapshotInteger(
					snapshot.minimumCredits,
					"minimumCredits",
					{ allowZero: false, eventId: event.id },
				),
				mode: "per_minute",
				reserveFloorCredits,
				rootAllowed: current.rootAllowed,
			};
		}

		if (snapshot.mode === "measured") {
			return {
				...this.measuredRecoveryBase(current),
				estimatedUnitUsdMicros: optionalSnapshotInteger(
					snapshot.estimatedUnitUsdMicros,
				),
				reserveFloorCredits,
			};
		}

		if (snapshot.mode !== current.mode) {
			throw new Error(
				`AI usage event ${event.id} has a conflicting reservation pricing snapshot`,
			);
		}

		return { ...this.currentRecoveryPricing(current), reserveFloorCredits };
	}

	private currentRecoveryPricing(
		current: OperationPricing,
	): RecoveredOperationPricing {
		return current.mode === "measured"
			? { ...current, estimatedUnitUsdMicros: null }
			: current;
	}

	private measuredRecoveryBase(
		current: OperationPricing,
	): MeasuredOperationPricing {
		if (current.mode === "measured") {
			return current;
		}

		return {
			allowedChildOperations: current.allowedChildOperations,
			allowedParentOperations: current.allowedParentOperations,
			mode: "measured",
			reserveFloorCredits: current.reserveFloorCredits,
			rootAllowed: current.rootAllowed,
			unit:
				"unit" in current && current.unit === "image" ? "image" : "operation",
		};
	}

	private legacyFixedPricing(
		event: AiUsageEvent,
		current: OperationPricing,
		creditsPerUnitValue: unknown,
		reserveFloorCredits: number,
		unitValue: unknown,
		options: { allowUnitMismatch?: boolean } = {},
	): FixedOperationPricing {
		const unit = isFixedUnit(unitValue)
			? unitValue
			: current.mode === "fixed"
				? current.unit
				: invalidSnapshotValue(event.id, "unit");

		if (
			current.mode === "fixed" &&
			unit !== current.unit &&
			options.allowUnitMismatch !== true
		) {
			invalidSnapshotValue(event.id, "unit");
		}

		return {
			allowedChildOperations: current.allowedChildOperations,
			allowedParentOperations: current.allowedParentOperations,
			creditsPerUnit: snapshotInteger(creditsPerUnitValue, "creditsPerUnit", {
				allowZero: unit === "adjustment",
				eventId: event.id,
			}),
			mode: "fixed",
			reserveFloorCredits,
			rootAllowed: current.rootAllowed,
			unit,
		};
	}

	/** Provisional credits for a unit-settled recovery. */
	private evidenceSettlement(
		event: AiUsageEvent,
		pricing: Exclude<RecoveredOperationPricing, { mode: "per_minute" }>,
		units: number,
	) {
		if (pricing.mode === "token") {
			// Stored output proves the call completed but its usage is gone; the
			// reserve floor stands until the gateway reprices it from exact cost.
			return {
				finalCredits: units === 0 ? 0 : event.reservedCredits,
				pricing: "direct" as const,
				pricingSnapshot: {
					mode: "token",
					operation: event.operation,
					outcome: units === 0 ? "failed_no_deliverable" : "delivered",
					source: "token_floor_recovery",
					units,
					usdMicrosPerCredit: this.reconciliationUsdMicrosPerCredit(event),
				},
			};
		}

		if (pricing.mode === "fixed") {
			return {
				finalCredits: units * pricing.creditsPerUnit,
				pricing: "direct" as const,
				pricingSnapshot: {
					creditsPerUnit: pricing.creditsPerUnit,
					mode: "fixed",
					operation: event.operation,
					source: "operation_registry",
					unit: pricing.unit,
					units,
				},
			};
		}

		const usdMicrosPerCredit = this.reconciliationUsdMicrosPerCredit(event);
		const costUsdMicros =
			pricing.estimatedUnitUsdMicros === null
				? null
				: pricing.estimatedUnitUsdMicros * units;
		const finalCredits =
			units === 0
				? 0
				: costUsdMicros === null
					? pricing.reserveFloorCredits * units
					: usdMicrosToCentiCredits(costUsdMicros, usdMicrosPerCredit);

		return {
			costUsdMicros,
			finalCredits,
			pricing: "direct" as const,
			pricingSnapshot: {
				estimatedUnitUsdMicros: pricing.estimatedUnitUsdMicros,
				mode: "measured",
				operation: event.operation,
				outcome: units === 0 ? "failed_no_deliverable" : "delivered",
				// A floor charge is not a provider cost: flag it for admin review.
				...(finalCredits > 0 && costUsdMicros === null
					? { reviewFlags: ["no_catalog_rate"] }
					: {}),
				source: "measured_local",
				unit: pricing.unit,
				units,
				usdMicrosPerCredit,
			},
		};
	}

	/**
	 * Credits a late completion checkpoint should reprice a registry-recovered
	 * event to; null when the measured terms carry no local estimate (the
	 * gateway reconciliation already holds the authoritative cost).
	 */
	private lateCompletionCredits(
		event: AiUsageEvent,
		pricing: Extract<RecoveredOperationPricing, { mode: "fixed" | "measured" }>,
		completedUnits: number,
	): number | null {
		if (pricing.mode === "fixed") {
			return completedUnits * pricing.creditsPerUnit;
		}

		if (completedUnits === 0) {
			return null;
		}

		// Reservation-time terms are authoritative for an in-flight event: the
		// anchor comes from the snapshot, never the live config.
		const usdMicrosPerCredit = this.reconciliationUsdMicrosPerCredit(event);
		// The gateway already reported the exact customer-billable cost (decision
		// 2/3): price the late completion from it, not from the local estimate.
		const gatewayCost = this.reconciledCustomerBillableCostUsdMicros(event);

		if (gatewayCost !== null && gatewayCost > 0) {
			return usdMicrosToCentiCredits(gatewayCost, usdMicrosPerCredit);
		}

		if (pricing.estimatedUnitUsdMicros === null) {
			return null;
		}

		return usdMicrosToCentiCredits(
			pricing.estimatedUnitUsdMicros * completedUnits,
			usdMicrosPerCredit,
		);
	}

	/** customerBillableCostUsdMicros a gateway reconciliation recorded, if any. */
	private reconciledCustomerBillableCostUsdMicros(
		event: AiUsageEvent,
	): number | null {
		const snapshot = isRecord(event.pricingSnapshot)
			? event.pricingSnapshot
			: null;
		const gatewayReconciliation = isRecord(snapshot?.gatewayReconciliation)
			? snapshot.gatewayReconciliation
			: null;
		const cost = gatewayReconciliation?.customerBillableCostUsdMicros;

		return Number.isSafeInteger(cost) && (cost as number) >= 0
			? (cost as number)
			: null;
	}

	private reconciledFinalCredits(
		event: AiUsageEvent,
		refs: readonly AiUsageGenerationRef[],
		customerBillableCostUsdMicros: number,
		usdMicrosPerCredit: number,
	): { finalCredits: number; reviewFlags: readonly MeteringReviewFlag[] } {
		const pricing = this.recoveryOperationPricing(event);

		if (pricing.mode === "token") {
			// A call that produced no deliverable (refunded_failure refs only)
			// owes nothing; otherwise the exact customer-billable cost applies.
			if (
				customerBillableCostUsdMicros === 0 &&
				refs.length > 0 &&
				refs.every((ref) => isRefundedFailureStepUsage(ref.stepUsage))
			) {
				return { finalCredits: 0, reviewFlags: [] };
			}

			return {
				finalCredits: usdMicrosToCentiCredits(
					customerBillableCostUsdMicros,
					usdMicrosPerCredit,
				),
				reviewFlags: [],
			};
		}

		if (pricing.mode === "measured") {
			// A user-visible failure settled at 0 is never re-charged; its cost
			// still lands in reconciledCostUsdMicros. Otherwise the exact
			// customer-billable provider cost replaces the local estimate, and an
			// event whose every ref was a refunded failure owes nothing.
			if (
				this.settlementOutcome(event) === "failed_no_deliverable" ||
				(event.finalCredits === null && this.fixedUnitEvidence(refs) === 0)
			) {
				return { finalCredits: event.finalCredits ?? 0, reviewFlags: [] };
			}

			if (customerBillableCostUsdMicros === 0) {
				// A gateway total_cost of 0 for DELIVERED work is a catalog gap (or
				// an unpriced model), not a free render: the settle-time estimate
				// stands and the event is flagged for admin review. An explicit
				// zero settlement (user's own provider subscription) stays 0.
				if ((event.finalCredits ?? 0) > 0) {
					return {
						finalCredits: event.finalCredits ?? 0,
						reviewFlags: ["gateway_zero_cost"],
					};
				}

				return { finalCredits: 0, reviewFlags: [] };
			}

			return {
				finalCredits: usdMicrosToCentiCredits(
					customerBillableCostUsdMicros,
					usdMicrosPerCredit,
				),
				reviewFlags: [],
			};
		}

		if (pricing.mode === "fixed") {
			if (event.finalCredits !== null) {
				return { finalCredits: event.finalCredits, reviewFlags: [] };
			}

			const fixedUnits = this.fixedUnitEvidence(refs);

			return {
				finalCredits:
					fixedUnits === null
						? event.reservedCredits
						: fixedUnits * pricing.creditsPerUnit,
				reviewFlags: [],
			};
		}

		// A successful settle is already a durable, caller-observed billing fact.
		// Reconciliation enriches it with provider evidence but does not re-price it.
		if (event.settledAt !== null && event.finalCredits !== null) {
			return { finalCredits: event.finalCredits, reviewFlags: [] };
		}

		const evidence = this.perMinuteDurationEvidence(
			refs,
			pricing.maxDurationSeconds,
		);

		if (!evidence) {
			throw new Error(
				`AI usage event ${event.id} lacks valid positive transcription duration evidence`,
			);
		}

		return {
			finalCredits: Math.max(
				pricing.minimumCredits,
				Math.ceil(evidence.billedDurationSeconds / 60) *
					pricing.creditsPerMinute,
			),
			reviewFlags: [],
		};
	}

	private reconciledPricingSnapshot(
		event: AiUsageEvent,
		currentRefs: readonly AiUsageGenerationRef[],
		requestedRefs: readonly AiUsageGenerationRef[],
		generationInfos: readonly Awaited<
			ReturnType<MeteringGateway["getGenerationInfo"]>
		>[],
		costs: readonly number[],
		customerBillableCostUsdMicros: number,
		finalCredits: number,
		usdMicrosPerCredit: number,
		evidence: readonly AiProviderCallEvidence[] = [],
	): Record<string, unknown> {
		const currentRefByGenerationId = new Map(
			currentRefs.map((ref) => [ref.gatewayGenerationId, ref]),
		);
		const gatewayReconciliation = {
			generations: requestedRefs.map((ref, index) => {
				const info = generationInfos[index];

				if (!info) {
					throw new Error(
						`Missing gateway reconciliation result for ${ref.gatewayGenerationId}`,
					);
				}

				return {
					customerBilling: isBundledUnmeteredStepUsage(ref.stepUsage)
						? "bundled_unmetered_legacy"
						: isHelperBillableStepUsage(ref.stepUsage)
							? "helper_billable"
							: isRefundedFailureStepUsage(ref.stepUsage)
								? "refunded_failure"
								: "metered",
					costUsdMicros: costs[index],
					id: info.id,
					model: info.model,
					provider: info.providerName,
					totalCostUsd: info.totalCost,
					stepUsage:
						currentRefByGenerationId.get(ref.gatewayGenerationId)?.stepUsage ??
						null,
				};
			}),
			customerBillableCostUsdMicros,
			// Non-gateway receipts priced next to the gateway total, so the audit
			// trail is self-contained.
			providerCallEvidence: evidence.map((row) => ({
				chargedUsdMicros: row.chargedUsdMicros,
				costSource: row.costSource,
				costStatus: row.costStatus,
				customerBillable: row.customerBillable,
				id: row.id,
				providerRequestId: row.providerRequestId,
				transport: row.transport,
				unitKind: row.unitKind,
				units: row.units,
			})),
			source: "gateway_reconciliation",
			usdMicrosPerCredit,
		};
		const settlementEvidence = this.buildSettlementReplayEvidence(event);

		if (event.pricingSnapshot !== null && event.settledAt !== null) {
			return {
				...(isRecord(event.pricingSnapshot) ? event.pricingSnapshot : {}),
				gatewayReconciliation,
				// Keep the byte-for-byte settlement basis available even if a future
				// snapshot happens to use the same extension key.
				settlementPricingSnapshot: event.pricingSnapshot,
				...(settlementEvidence ? { settlementEvidence } : {}),
			};
		}

		return {
			...this.recoveredPricingSnapshot(event, currentRefs, finalCredits),
			gatewayReconciliation,
			...(event.pricingSnapshot === null
				? {}
				: { reservationPricingSnapshot: event.pricingSnapshot }),
			...(settlementEvidence ? { settlementEvidence } : {}),
		};
	}

	private buildSettlementReplayEvidence(
		event: AiUsageEvent,
	): Record<string, unknown> | null {
		if (event.settledAt === null || event.finalCredits === null) {
			return null;
		}

		return {
			finalCredits: event.finalCredits,
			model: event.model,
			pricingSnapshot: event.pricingSnapshot,
			provider: event.provider,
			rawUsage: event.rawUsage,
			usage: {
				cacheReadTokens: event.cacheReadTokens,
				cacheWriteTokens: event.cacheWriteTokens,
				inputTokens: event.inputTokens,
				outputTokens: event.outputTokens,
				uncachedInputTokens: this.settlementUncachedInputTokens(event),
			},
		};
	}

	private recoveredPricingSnapshot(
		event: AiUsageEvent,
		refs: readonly AiUsageGenerationRef[],
		finalCredits: number,
	): Record<string, unknown> {
		const pricing = this.recoveryOperationPricing(event);
		const common = {
			mode: pricing.mode,
			operation: event.operation,
			reserveFloorCredits: pricing.reserveFloorCredits,
			source: "operation_registry_recovery",
		};

		if (pricing.mode === "fixed") {
			const exactUnits =
				pricing.creditsPerUnit > 0 &&
				finalCredits % pricing.creditsPerUnit === 0
					? finalCredits / pricing.creditsPerUnit
					: null;

			return {
				...common,
				creditsPerUnit: pricing.creditsPerUnit,
				unit: pricing.unit,
				...(exactUnits === null ? { finalCredits } : { units: exactUnits }),
			};
		}

		if (pricing.mode === "measured") {
			const units = this.fixedUnitEvidence(refs);

			return {
				...common,
				estimatedUnitUsdMicros: pricing.estimatedUnitUsdMicros,
				finalCredits,
				unit: pricing.unit,
				...(units === null ? {} : { units }),
			};
		}

		if (pricing.mode === "per_minute") {
			const duration = this.perMinuteDurationEvidence(
				refs,
				pricing.maxDurationSeconds,
			);

			if (!duration) {
				throw new Error(
					`AI usage event ${event.id} lacks valid positive transcription duration evidence`,
				);
			}

			return {
				...common,
				authoritativeDurationSeconds: duration.authoritativeDurationSeconds,
				creditsPerMinute: pricing.creditsPerMinute,
				durationCapped: duration.durationCapped,
				durationEvidence: duration.generations,
				durationSeconds: duration.billedDurationSeconds,
				finalCredits,
				maxDurationSeconds: pricing.maxDurationSeconds,
				minimumCredits: pricing.minimumCredits,
				unit: "minute",
				units: Math.ceil(duration.billedDurationSeconds / 60),
				...(duration.generations.length === 1
					? {
							providerDurationSeconds:
								duration.generations[0]?.providerDurationSeconds ?? null,
						}
					: {}),
			};
		}

		return common;
	}

	private fixedUnitEvidence(
		refs: readonly AiUsageGenerationRef[],
	): number | null {
		if (refs.length === 0) {
			return null;
		}

		let total = 0;

		for (const ref of refs) {
			if (!isRecord(ref.stepUsage) || !isRecord(ref.stepUsage.metering)) {
				return null;
			}

			const fixedUnits = ref.stepUsage.metering.fixedUnits;

			if (!Number.isSafeInteger(fixedUnits) || (fixedUnits as number) < 0) {
				return null;
			}

			total += fixedUnits as number;
		}

		return total;
	}

	private perMinuteDurationEvidence(
		refs: readonly AiUsageGenerationRef[],
		maxDurationSeconds: number,
	): PerMinuteDurationEvidence | null {
		const generations: PerMinuteDurationEvidence["generations"] = [];

		for (const ref of refs) {
			if (!isRecord(ref.stepUsage)) {
				return null;
			}

			const durationSeconds = finitePositiveNumber(
				ref.stepUsage.durationSeconds,
			);
			const providerDurationSeconds = finitePositiveNumber(
				ref.stepUsage.providerDurationSeconds,
			);
			const authoritativeDurationSeconds =
				providerDurationSeconds ?? durationSeconds;

			if (authoritativeDurationSeconds === null) {
				return null;
			}

			generations.push({
				authoritativeDurationSeconds,
				durationSeconds,
				gatewayGenerationId: ref.gatewayGenerationId,
				providerDurationSeconds,
				source: providerDurationSeconds === null ? "local" : "provider",
			});
		}

		if (generations.length === 0) {
			return null;
		}

		const authoritativeDurationSeconds = generations.reduce(
			(total, generation) => total + generation.authoritativeDurationSeconds,
			0,
		);

		return {
			authoritativeDurationSeconds,
			billedDurationSeconds: Math.min(
				authoritativeDurationSeconds,
				maxDurationSeconds,
			),
			durationCapped: authoritativeDurationSeconds > maxDurationSeconds,
			generations,
		};
	}

	private reconciledRawUsage(
		rawUsage: unknown,
		refs: readonly AiUsageGenerationRef[],
		generationInfos: readonly Awaited<
			ReturnType<MeteringGateway["getGenerationInfo"]>
		>[],
	): Record<string, unknown> {
		return {
			...(isRecord(rawUsage) ? rawUsage : {}),
			gatewayReconciliation: { generations: generationInfos },
			generationRefs: refs.map((ref) => ({
				gatewayGenerationId: ref.gatewayGenerationId,
				stepUsage: ref.stepUsage,
			})),
			...(rawUsage === null ? {} : { settlementRawUsage: rawUsage }),
		};
	}

	private reserveReplay(event: AiUsageEvent): MeteringReserveReplay {
		if (event.status === "refunded" || event.status === "reconcile_failed") {
			throw new MeteringStateConflictError(
				event.id,
				event.status,
				"replay reservation for",
			);
		}

		return event.status;
	}

	private assertReserveReplay(
		event: AiUsageEvent,
		operation: MeteredOperation,
		subject: MeteringSubject,
		estimate: MeteringReserveEstimate,
	): void {
		// Same-PAYER, not same-actor (like findByIdempotencyKey and the bundled
		// claim): in an org workspace a different member may legally replay a
		// reservation another member created — same key, same pool, new actor.
		if (
			this.eventPayerKey(event) !== this.payerKey(subjectPayer(subject)) ||
			event.operation !== operation ||
			event.reservedCredits !== estimate.credits ||
			event.estimatedCostUsdMicros !==
				(estimate.estimatedCostUsdMicros ?? null) ||
			event.parentEventId !== (estimate.parentEventId ?? null) ||
			event.chatId !== (estimate.chatId ?? null) ||
			event.messageId !== (estimate.messageId ?? null) ||
			event.attemptRef !== (estimate.attemptRef ?? null) ||
			event.model !== (estimate.model ?? null) ||
			event.provider !== (estimate.provider ?? null)
		) {
			// Typed so callers can surface a graceful 409 replay instead of a 500:
			// a double-fired request whose stored event has since mutated (e.g.
			// attempt ref rewritten at settlement) lands here, and that is a
			// duplicate to reject politely, not an internal error.
			throw new MeteringStateConflictError(
				event.id,
				event.status,
				`replay a mismatched reserve (key ${estimate.idempotencyKey}) for`,
			);
		}
	}

	private assertSettlementReplay(
		event: AiUsageEvent,
		settlement: PreparedMeteringSettlement,
	): void {
		if (
			settlementReplayFinalCredits(
				event.pricingSnapshot,
				event.finalCredits,
			) !== settlement.finalCredits ||
			event.model !== settlement.model ||
			event.provider !== settlement.provider ||
			event.inputTokens !== (settlement.usage?.inputTokens ?? null) ||
			event.outputTokens !== (settlement.usage?.outputTokens ?? null) ||
			event.cacheReadTokens !== (settlement.usage?.cacheReadTokens ?? null) ||
			event.cacheWriteTokens !== (settlement.usage?.cacheWriteTokens ?? null) ||
			!isDeepStrictEqual(
				jsonComparable(stripSettlementMarkers(event.pricingSnapshot)),
				jsonComparable(settlement.pricingSnapshot),
			) ||
			!isDeepStrictEqual(
				jsonComparable(event.rawUsage),
				jsonComparable(settlement.rawUsage),
			)
		) {
			throw new Error(`AI usage settle replay conflict for event ${event.id}`);
		}
	}

	private assertTokenSettlementReplay(
		event: AiUsageEvent,
		settlement: TokenMeteringSettlement,
	): void {
		const usage = normalizeTokenUsage(settlement.usage);
		const rawUsage = settlement.rawUsage ?? settlement.usage;

		if (
			event.model !== settlement.modelId ||
			(settlement.provider !== undefined &&
				event.provider !== settlement.provider) ||
			event.inputTokens !== usage.inputTokens ||
			event.outputTokens !== usage.outputTokens ||
			event.cacheReadTokens !== usage.cacheReadTokens ||
			event.cacheWriteTokens !== usage.cacheWriteTokens ||
			this.settlementUncachedInputTokens(event) !== usage.uncachedInputTokens ||
			!isDeepStrictEqual(
				jsonComparable(event.rawUsage),
				jsonComparable(rawUsage),
			)
		) {
			throw new Error(`AI usage settle replay conflict for event ${event.id}`);
		}
	}

	private assertReconciledSettlementReplay(
		event: AiUsageEvent,
		settlement: MeteringSettlement,
		prepared: PreparedMeteringSettlement,
	): void {
		if (settlement.pricing === "token") {
			this.assertReconciledTokenSettlementReplay(event, settlement);
			return;
		}

		const evidence = this.settlementReplayEvidence(event);

		if (!evidence) {
			this.assertRecoveredFixedCompletion(event, prepared);
			return;
		}

		const usage = isRecord(evidence.usage) ? evidence.usage : null;

		if (
			settlementReplayFinalCredits(
				evidence.pricingSnapshot,
				evidence.finalCredits,
			) !== prepared.finalCredits ||
			evidence.model !== prepared.model ||
			evidence.provider !== prepared.provider ||
			usage?.inputTokens !== (prepared.usage?.inputTokens ?? null) ||
			usage?.outputTokens !== (prepared.usage?.outputTokens ?? null) ||
			usage?.cacheReadTokens !== (prepared.usage?.cacheReadTokens ?? null) ||
			usage?.cacheWriteTokens !== (prepared.usage?.cacheWriteTokens ?? null) ||
			usage?.uncachedInputTokens !==
				(prepared.usage?.uncachedInputTokens ?? null) ||
			!isDeepStrictEqual(
				jsonComparable(stripSettlementMarkers(evidence.pricingSnapshot)),
				jsonComparable(prepared.pricingSnapshot),
			) ||
			!isDeepStrictEqual(
				jsonComparable(evidence.rawUsage),
				jsonComparable(prepared.rawUsage),
			)
		) {
			throw new Error(`AI usage settle replay conflict for event ${event.id}`);
		}
	}

	private assertRecoveredFixedCompletion(
		event: AiUsageEvent,
		prepared: PreparedMeteringSettlement,
	): void {
		const pricing = this.recoveryOperationPricing(event);
		const recoveredSnapshot = isRecord(event.pricingSnapshot)
			? event.pricingSnapshot
			: null;

		if (pricing.mode === "measured") {
			// The gateway already repriced this event from exact cost; a late
			// provisional settlement for the same operation is a benign replay.
			const preparedSnapshot: Record<string, unknown> | null = isRecord(
				prepared.pricingSnapshot,
			)
				? prepared.pricingSnapshot
				: null;

			if (
				recoveredSnapshot?.source !== "operation_registry_recovery" ||
				recoveredSnapshot.mode !== "measured" ||
				preparedSnapshot?.source !== "measured_local" ||
				preparedSnapshot.operation !== event.operation
			) {
				throw new Error(
					`AI usage settle replay conflict for event ${event.id}`,
				);
			}

			return;
		}

		const units =
			pricing.mode === "fixed" &&
			event.finalCredits !== null &&
			pricing.creditsPerUnit > 0 &&
			event.finalCredits % pricing.creditsPerUnit === 0
				? event.finalCredits / pricing.creditsPerUnit
				: null;
		const expectedPricingSnapshot =
			pricing.mode === "fixed" && units !== null
				? {
						costUsdMicros: null,
						creditsPerUnit: pricing.creditsPerUnit,
						mode: "fixed",
						operation: event.operation,
						source: "operation_registry",
						unit: pricing.unit,
						units,
					}
				: null;

		if (
			pricing.mode !== "fixed" ||
			units === null ||
			expectedPricingSnapshot === null ||
			event.finalCredits !== units * pricing.creditsPerUnit ||
			prepared.finalCredits !== event.finalCredits ||
			prepared.costUsdMicros !== null ||
			prepared.model !== null ||
			prepared.provider !== null ||
			prepared.usage !== null ||
			prepared.rawUsage !== null ||
			recoveredSnapshot?.source !== "operation_registry_recovery" ||
			recoveredSnapshot.mode !== "fixed" ||
			recoveredSnapshot.operation !== event.operation ||
			recoveredSnapshot.creditsPerUnit !== pricing.creditsPerUnit ||
			recoveredSnapshot.reserveFloorCredits !== pricing.reserveFloorCredits ||
			recoveredSnapshot.unit !== pricing.unit ||
			recoveredSnapshot.units !== units ||
			!isDeepStrictEqual(
				jsonComparable(prepared.pricingSnapshot),
				jsonComparable(expectedPricingSnapshot),
			)
		) {
			throw new Error(`AI usage settle replay conflict for event ${event.id}`);
		}
	}

	private assertReconciledTokenSettlementReplay(
		event: AiUsageEvent,
		settlement: TokenMeteringSettlement,
	): void {
		const evidence = this.requireSettlementReplayEvidence(event);
		const usage = normalizeTokenUsage(settlement.usage);
		const evidenceUsage = isRecord(evidence.usage) ? evidence.usage : null;
		const rawUsage = settlement.rawUsage ?? settlement.usage;

		if (
			evidence.model !== settlement.modelId ||
			(settlement.provider !== undefined &&
				evidence.provider !== settlement.provider) ||
			evidenceUsage?.inputTokens !== usage.inputTokens ||
			evidenceUsage?.outputTokens !== usage.outputTokens ||
			evidenceUsage?.cacheReadTokens !== usage.cacheReadTokens ||
			evidenceUsage?.cacheWriteTokens !== usage.cacheWriteTokens ||
			evidenceUsage?.uncachedInputTokens !== usage.uncachedInputTokens ||
			!isDeepStrictEqual(
				jsonComparable(evidence.rawUsage),
				jsonComparable(rawUsage),
			)
		) {
			throw new Error(`AI usage settle replay conflict for event ${event.id}`);
		}
	}

	private requireSettlementReplayEvidence(
		event: AiUsageEvent,
	): Record<string, unknown> {
		const evidence = this.settlementReplayEvidence(event);

		if (!isRecord(evidence)) {
			throw new Error(
				`AI usage settle replay conflict for event ${event.id}: no durable settlement evidence`,
			);
		}

		return evidence;
	}

	private settlementReplayEvidence(
		event: AiUsageEvent,
	): Record<string, unknown> | null {
		const evidence = isRecord(event.pricingSnapshot)
			? event.pricingSnapshot.settlementEvidence
			: null;

		return isRecord(evidence) ? evidence : null;
	}

	/** The `outcome` a measured_local settlement recorded, if any. */
	private settlementOutcome(event: AiUsageEvent): string | null {
		const snapshot = isRecord(event.pricingSnapshot)
			? event.pricingSnapshot
			: null;
		const settlementSnapshot = isRecord(snapshot?.settlementPricingSnapshot)
			? snapshot.settlementPricingSnapshot
			: snapshot;
		const outcome = settlementSnapshot?.outcome;

		return typeof outcome === "string" ? outcome : null;
	}

	private settlementUncachedInputTokens(event: AiUsageEvent): number | null {
		const settlementUsage = isRecord(event.pricingSnapshot)
			? event.pricingSnapshot.settlementUsage
			: null;
		const uncachedInputTokens = isRecord(settlementUsage)
			? settlementUsage.uncachedInputTokens
			: null;

		return typeof uncachedInputTokens === "number" &&
			Number.isSafeInteger(uncachedInputTokens) &&
			uncachedInputTokens >= 0
			? uncachedInputTokens
			: null;
	}

	private async requireEvent(
		eventId: string,
		transaction?: MeteringTransaction,
	): Promise<AiUsageEvent> {
		const event = await this.repository.findEventById(eventId, transaction);

		if (!event) {
			throw new Error(`AI usage event ${eventId} was not found`);
		}

		return event;
	}

	private lockEvent(eventId: string, transaction: MeteringTransaction) {
		return this.repository.acquireOperationLock(
			`metering-event:${eventId}`,
			transaction,
		);
	}

	private reserveOperationLock(idempotencyKey: string) {
		return `metering-reserve:${idempotencyKey}`;
	}

	private reserveLedgerKey(eventId: string) {
		return `reserve:${eventId}`;
	}

	private assertOptionalCost(cost: number | null | undefined): void {
		if (
			cost != null &&
			(!Number.isSafeInteger(cost) || cost < 0 || cost > POSTGRES_INTEGER_MAX)
		) {
			throw new Error("USD micros must be a non-negative safe integer");
		}
	}

	private assertCompletedFixedUnits(completedUnits: number): void {
		if (!Number.isSafeInteger(completedUnits) || completedUnits < 0) {
			throw new Error("Completed fixed units must be a non-negative integer");
		}
	}

	private assertPositiveCredits(credits: number, label: string): void {
		if (
			!Number.isSafeInteger(credits) ||
			credits <= 0 ||
			credits > POSTGRES_INTEGER_MAX
		) {
			throw new Error(`${label} must be a positive integer`);
		}
	}

	private assertNonNegativeCredits(credits: number, label: string): void {
		if (
			!Number.isSafeInteger(credits) ||
			credits < 0 ||
			credits > POSTGRES_INTEGER_MAX
		) {
			throw new Error(`${label} must be a non-negative integer`);
		}
	}

	private assertNonEmpty(value: string, label: string): void {
		if (value.trim().length === 0) {
			throw new Error(`${label} must not be empty`);
		}
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Rows from before the provider column default to the Vercel gateway. */
function generationRefSource(ref: AiUsageGenerationRef): GenerationRefSource {
	return ref.providerSource === "openrouter" ? "openrouter" : "vercel";
}

function fixedUnitsFromStepUsage(stepUsage: unknown): number | null {
	if (!isRecord(stepUsage) || !isRecord(stepUsage.metering)) {
		return null;
	}

	const fixedUnits = stepUsage.metering.fixedUnits;

	return Number.isSafeInteger(fixedUnits) && (fixedUnits as number) >= 0
		? (fixedUnits as number)
		: null;
}

/**
 * Settlement-time advisory markers (the soft member-limit breach, the capped
 * sanity ceiling, the reserve-time limit exemption) are written by the server
 * ON TOP of the caller's snapshot, so replay validation must ignore them —
 * the caller legitimately resubmits the marker-less basis.
 */
function stripSettlementMarkers(pricingSnapshot: unknown): unknown {
	if (!isRecord(pricingSnapshot)) {
		return pricingSnapshot;
	}

	const {
		actorIsLimitExempt: _actorIsLimitExempt,
		memberLimitBreach: _memberLimitBreach,
		sanityCeiling: _sanityCeiling,
		...rest
	} = pricingSnapshot;

	return rest;
}

/**
 * The finalCredits a settlement replay must match: the caller's requested
 * charge, which is the `sanityCeiling.attempted` basis when the debit was
 * capped, else the stored charge.
 */
function settlementReplayFinalCredits(
	pricingSnapshot: unknown,
	storedFinalCredits: unknown,
): unknown {
	const sanityCeiling = isRecord(pricingSnapshot)
		? pricingSnapshot.sanityCeiling
		: null;
	const attempted = isRecord(sanityCeiling) ? sanityCeiling.attempted : null;

	return Number.isSafeInteger(attempted) ? attempted : storedFinalCredits;
}

/** Reserve-time limit exemption, from the reservation or a carried marker. */
function snapshotActorIsLimitExempt(pricingSnapshot: unknown): boolean {
	if (!isRecord(pricingSnapshot)) {
		return false;
	}

	if (pricingSnapshot.actorIsLimitExempt === true) {
		return true;
	}

	const reservation = pricingSnapshot.reservationPricingSnapshot;

	return isRecord(reservation) && reservation.actorIsLimitExempt === true;
}

function snapshotReviewFlags(
	pricingSnapshot: unknown,
): readonly MeteringReviewFlag[] {
	if (!isRecord(pricingSnapshot)) {
		return [];
	}

	const flags = pricingSnapshot.reviewFlags;

	if (!Array.isArray(flags)) {
		return [];
	}

	return flags.filter(
		(flag): flag is MeteringReviewFlag =>
			flag === "gateway_zero_cost" || flag === "no_catalog_rate",
	);
}

/** Union the admin-review flags into a snapshot (no key when there are none). */
function withReviewFlags(
	pricingSnapshot: Record<string, unknown>,
	flags: readonly MeteringReviewFlag[],
): Record<string, unknown> {
	if (flags.length === 0) {
		return pricingSnapshot;
	}

	return {
		...pricingSnapshot,
		reviewFlags: [
			...new Set([...snapshotReviewFlags(pricingSnapshot), ...flags]),
		],
	};
}

function isRegistryRecoveryPricing(pricingSnapshot: unknown): boolean {
	return (
		isRecord(pricingSnapshot) &&
		pricingSnapshot.source === "operation_registry_recovery"
	);
}

function finitePositiveNumber(value: unknown): number | null {
	return typeof value === "number" && Number.isFinite(value) && value > 0
		? value
		: null;
}

/** Same rows with the same priced state (id, status, charge, units). */
function providerCallEvidenceMatches(
	expected: readonly AiProviderCallEvidence[],
	current: readonly AiProviderCallEvidence[],
): boolean {
	const fingerprint = (rows: readonly AiProviderCallEvidence[]) =>
		rows
			.map(
				(row) =>
					`${row.id}:${row.costStatus}:${row.chargedUsdMicros ?? "null"}:${row.units}:${row.customerBillable}`,
			)
			.sort();

	return isDeepStrictEqual(fingerprint(expected), fingerprint(current));
}

/**
 * Convert gateway dollar totals into integer USD micros without binary-float
 * addition or per-generation round-down. The event total is the ceiling of the
 * exact decimal aggregate exposed by JSON numbers. Largest-remainder allocation
 * then makes the persisted generation rows add back to that exact event total.
 */
function allocateGatewayCostMicros(
	dollars: readonly number[],
): GatewayCostAllocation {
	if (dollars.length === 0) {
		return { perGenerationUsdMicros: [], totalUsdMicros: 0 };
	}

	const decimalCosts = dollars.map((value, index) =>
		decimalDollars(value, `Gateway generation cost at index ${index}`),
	);
	const commonScale = Math.max(...decimalCosts.map((cost) => cost.scale));
	const denominator = 10n ** BigInt(commonScale);
	const scaledMicroNumerators = decimalCosts.map(
		(cost) =>
			cost.coefficient * 10n ** BigInt(commonScale - cost.scale) * 1_000_000n,
	);
	const totalNumerator = scaledMicroNumerators.reduce(
		(total, value) => total + value,
		0n,
	);
	const totalMicros = divideBigIntRoundingUp(totalNumerator, denominator);
	const floorMicros = scaledMicroNumerators.map(
		(numerator) => numerator / denominator,
	);
	const remainders = scaledMicroNumerators.map(
		(numerator) => numerator % denominator,
	);
	const floorTotal = floorMicros.reduce((total, value) => total + value, 0n);
	const microsToAllocate = totalMicros - floorTotal;

	if (microsToAllocate < 0n || microsToAllocate > BigInt(dollars.length)) {
		throw new Error("Gateway cost allocation exceeded its rounding bound");
	}

	const allocationOrder = remainders
		.map((remainder, index) => ({ index, remainder }))
		.filter(({ remainder }) => remainder > 0n)
		.sort((left, right) => {
			if (left.remainder === right.remainder) {
				return left.index - right.index;
			}

			return left.remainder > right.remainder ? -1 : 1;
		});

	if (microsToAllocate > BigInt(allocationOrder.length)) {
		throw new Error("Gateway cost allocation has insufficient fractional rows");
	}

	for (let index = 0; index < Number(microsToAllocate); index += 1) {
		const target = allocationOrder[index];

		if (!target) {
			throw new Error("Gateway cost allocation lost a fractional row");
		}

		floorMicros[target.index] = (floorMicros[target.index] ?? 0n) + 1n;
	}

	const totalUsdMicros = postgresUsdMicros(
		totalMicros,
		"Aggregate gateway cost",
	);
	const perGenerationUsdMicros = floorMicros.map((micros, index) =>
		postgresUsdMicros(micros, `Gateway generation cost at index ${index}`),
	);
	const allocatedTotal = perGenerationUsdMicros.reduce(
		(total, micros) => total + micros,
		0,
	);

	if (allocatedTotal !== totalUsdMicros) {
		throw new Error("Gateway generation costs do not match the aggregate cost");
	}

	return { perGenerationUsdMicros, totalUsdMicros };
}

function decimalDollars(value: number, label: string): DecimalDollars {
	if (!Number.isFinite(value) || value < 0) {
		throw new Error(`${label} must be a non-negative finite number`);
	}

	const match = /^(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/iu.exec(value.toString());

	if (!match) {
		throw new Error(`${label} has an invalid decimal representation`);
	}

	const whole = match[1] ?? "0";
	const fraction = match[2] ?? "";
	const exponent = Number(match[3] ?? 0);
	let coefficient = BigInt(`${whole}${fraction}`);
	let scale = fraction.length - exponent;

	if (scale < 0) {
		coefficient *= 10n ** BigInt(-scale);
		scale = 0;
	}

	while (scale > 0 && coefficient % 10n === 0n) {
		coefficient /= 10n;
		scale -= 1;
	}

	return { coefficient, scale };
}

function divideBigIntRoundingUp(
	numerator: bigint,
	denominator: bigint,
): bigint {
	return numerator === 0n ? 0n : (numerator + denominator - 1n) / denominator;
}

function postgresUsdMicros(value: bigint, label: string): number {
	if (value < 0n || value > BigInt(POSTGRES_INTEGER_MAX)) {
		throw new Error(`${label} exceeds the USD-micros database integer range`);
	}

	return Number(value);
}

function snapshotInteger(
	value: unknown,
	field: string,
	options: { allowZero: boolean; eventId: string },
): number {
	if (
		!Number.isSafeInteger(value) ||
		(value as number) < (options.allowZero ? 0 : 1) ||
		(value as number) > POSTGRES_INTEGER_MAX
	) {
		return invalidSnapshotValue(options.eventId, field);
	}

	return value as number;
}

function optionalSnapshotInteger(value: unknown): number | null {
	return Number.isSafeInteger(value) && (value as number) >= 0
		? (value as number)
		: null;
}

function isFixedUnit(value: unknown): value is FixedOperationPricing["unit"] {
	return (
		value === "adjustment" ||
		value === "image" ||
		value === "lead" ||
		value === "operation"
	);
}

function invalidSnapshotValue(eventId: string, field: string): never {
	throw new Error(
		`AI usage event ${eventId} has an invalid reservation pricing ${field}`,
	);
}

function jsonComparable(value: unknown): unknown {
	if (Array.isArray(value)) {
		return value.map((entry) =>
			entry === undefined ? null : jsonComparable(entry),
		);
	}

	if (isRecord(value)) {
		return Object.fromEntries(
			Object.entries(value)
				.filter(([, entry]) => entry !== undefined)
				.map(([key, entry]) => [key, jsonComparable(entry)]),
		);
	}

	return value;
}
