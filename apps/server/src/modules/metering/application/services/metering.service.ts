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
import { OrganizationLimitsRepository } from "../../../workspaces/infrastructure/persistence/organization-limits.repository";
import {
	type AiUsageEvent,
	type AiUsageGenerationRef,
	bundledReservationCompletedAttemptRef,
	type CapturedGeneration,
	type DirectMeteringSettlementPairOutcome,
	type DirectMeteringSettlementRequest,
	GatewayUsagePendingError,
	gatewayGenerationId,
	isBundledReservationComplete,
	isBundledReservationPending,
	isBundledUnmeteredStepUsage,
	isGatewayUsagePending,
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
	normalizeTokenUsage,
	usdMicrosToCredits,
} from "../../domain/model-pricing";
import {
	assertOperationParentAllowed,
	type OperationPricing,
	operationPricing,
} from "../../domain/operation-registry";
import {
	MeteringRepository,
	type MeteringTransaction,
} from "../../infrastructure/persistence/metering.repository";
import { ModelPricingService } from "./model-pricing.service";

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
				throw new MeteringStateConflictError(
					event.id,
					event.status,
					"replay bundled reservation claim for",
				);
			}

			const sameMessage = event.messageId === input.messageId;

			if (event.status !== "reserved") {
				// A claim marker plus the same message is a durable replay signal even
				// after settlement/refund. A genuinely new message gets a new hold.
				if (
					sameMessage &&
					event.attemptRef !== input.expectedAttemptRef &&
					event.attemptRef !== completedExpectedAttemptRef
				) {
					throw new MeteringStateConflictError(
						event.id,
						event.status,
						"replay bundled reservation claim for",
					);
				}

				return null;
			}

			if (!sameMessage) {
				throw new MeteringStateConflictError(
					event.id,
					event.status,
					"claim bundled reservation for",
				);
			}

			const claimAttemptRef =
				event.attemptRef === input.expectedAttemptRef
					? input.claimAttemptRef
					: event.attemptRef === completedExpectedAttemptRef
						? completedClaimAttemptRef
						: null;

			if (!claimAttemptRef || !event.attemptRef) {
				throw new MeteringStateConflictError(
					event.id,
					event.status,
					"claim bundled reservation for",
				);
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
		const minimumReserve = pricing.reserveFloorCredits;

		if (estimate.credits < minimumReserve) {
			throw new Error(
				`${operation} requires a reserve of at least ${minimumReserve} credits`,
			);
		}

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
			} else {
				assertOperationParentAllowed(operation);
			}

			// CreditsService deliberately takes its consume-idempotency lock before
			// the owner lock. The event insert follows the debit in this same DB
			// transaction, so both commit or both roll back before provider work.
			await this.credits.consume(
				payer,
				estimate.credits,
				{
					actorUserId: subject.actorUserId,
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
					pricingSnapshot: this.reservationPricingSnapshot(operation, pricing),
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
		if (!subject.organizationId) {
			return;
		}

		const resolved = await this.organizationLimits.resolveMemberLimit(
			subject.organizationId,
			subject.actorUserId,
			subject.actorIsLimitExempt === true,
			transaction,
		);

		if (resolved.limitCredits === null) {
			return;
		}

		const spent = await this.organizationLimits.sumMemberSpendThisMonth(
			subject.organizationId,
			subject.actorUserId,
			new Date(),
			transaction,
		);

		if (spent + requiredCredits > resolved.limitCredits) {
			throw new MemberCreditLimitError(
				resolved.limitCredits,
				spent,
				requiredCredits,
			);
		}
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

		const settled = await this.repository.transaction((transaction) =>
			this.lockAndSettlePreparedEvent(
				eventId,
				settlement,
				prepared,
				transaction,
			),
		);

		return settled;
	}

	/**
	 * Settles a fixed-price event from the strongest durable completion count.
	 *
	 * Stored output can lag provider completion after a crash. Holding the event
	 * lock while reading generation refs ensures recovery charges the maximum of
	 * the stored prefix and provider-completion evidence, using the price terms
	 * captured when the reservation was admitted.
	 */
	async settleFixedFromEvidence(
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

			if (pricing.mode !== "fixed") {
				throw new Error(
					`AI usage event ${event.id} is not a fixed-price operation`,
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
			const finalCredits = units * pricing.creditsPerUnit;

			this.assertNonNegativeCredits(finalCredits, "fixed settlement credits");

			const settlement = {
				finalCredits,
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
			const prepared = await this.prepareSettlement(settlement);

			if (event.status === "reconcile_failed") {
				await this.applyCreditAdjustment(
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
						finalCredits: prepared.finalCredits,
						pricingSnapshot: prepared.pricingSnapshot,
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
					this.eventPayerKey(initialChild) !== this.eventPayerKey(initialParent))
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

	async captureGeneration(
		eventId: string,
		capture: CapturedGeneration,
	): Promise<AiUsageGenerationRef | null> {
		const generationId = gatewayGenerationId(capture.providerMetadata);

		if (!generationId) {
			return null;
		}

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

		if (refs.length === 0) {
			throw new Error(`AI usage event ${eventId} has no generation refs`);
		}

		const results = await Promise.allSettled(
			refs.map((ref) =>
				this.gateway.getGenerationInfo({ id: ref.gatewayGenerationId }),
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
		const reconciledCostUsdMicros = costAllocation.totalUsdMicros;
		const customerBillableCostUsdMicros = allocateGatewayCostMicros(
			refs.flatMap((ref, index) => {
				if (isBundledUnmeteredStepUsage(ref.stepUsage)) {
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
		).totalUsdMicros;
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

			const currentCredits = event.finalCredits ?? event.reservedCredits;
			const reconciliationUsdMicrosPerCredit =
				this.reconciliationUsdMicrosPerCredit(event);
			// Gateway cost is authoritative for provider spend, but product-fixed
			// operations retain their registry price. Per-minute recovery derives
			// price from captured duration evidence; a prior durable settlement wins.
			const finalCredits = this.reconciledFinalCredits(
				event,
				currentRefs,
				customerBillableCostUsdMicros,
				reconciliationUsdMicrosPerCredit,
			);
			this.assertNonNegativeCredits(finalCredits, "reconciled final credits");
			await this.applyCreditAdjustment(
				event,
				currentCredits,
				finalCredits,
				"reconcile",
				transaction,
			);

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
			);
			const rawUsage = this.reconciledRawUsage(
				event.rawUsage,
				currentRefs,
				generationInfos,
			);
			const updated = await this.repository.updateEvent(
				eventId,
				["reserved", "settled", "reconcile_failed"],
				{
					cacheReadTokens: usage.cacheReadTokens,
					cacheWriteTokens: usage.cacheWriteTokens,
					finalCredits,
					inputTokens: usage.inputTokens,
					model:
						models.size === 1
							? (generationInfos[0]?.model ?? null)
							: "multiple",
					outputTokens: usage.outputTokens,
					pricingSnapshot,
					provider:
						providers.size === 1
							? (generationInfos[0]?.providerName ?? null)
							: "multiple",
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
		};

		for (const event of events) {
			const refs = await this.repository.listGenerationRefs(event.id);

			if (refs.length === 0) {
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
						await this.terminalizeRecoveryFailure(event.id, error);
						outcome.failed += 1;
					} else {
						outcome.pending += 1;
					}
				} else {
					await this.terminalizeRecoveryFailure(event.id, error);
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
						await this.terminalizeRecoveryFailure(event.id, error);
						outcome.failed += 1;
					} else {
						outcome.pending += 1;
					}
				} else {
					await this.terminalizeRecoveryFailure(event.id, error);
					outcome.failed += 1;
				}
			}
		}

		return outcome;
	}

	private async upgradeFixedGenerationUnitsLocked(
		event: AiUsageEvent,
		completedUnits: number,
		transaction: MeteringTransaction,
	): Promise<AiUsageGenerationRef | null> {
		const pricing = this.recoveryOperationPricing(event);

		if (pricing.mode !== "fixed") {
			throw new Error(
				`AI usage event ${event.id} is not a fixed-price operation`,
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
		if (
			event.status === "reconciled" &&
			isRegistryRecoveryPricing(event.pricingSnapshot)
		) {
			const targetCredits = completedUnits * pricing.creditsPerUnit;

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
								creditsPerUnit: pricing.creditsPerUnit,
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

		await this.applyCreditAdjustment(
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
				finalCredits: prepared.finalCredits,
				inputTokens: prepared.usage?.inputTokens ?? null,
				model: prepared.model,
				outputTokens: prepared.usage?.outputTokens ?? null,
				pricingSnapshot: prepared.pricingSnapshot,
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
		targetCredits: number,
		phase: "reconcile" | "settle",
		transaction: MeteringTransaction,
	): Promise<void> {
		const delta = targetCredits - currentCredits;

		if (delta > 0) {
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
	}

	private async refundReserved(
		eventId: string,
		reason: string,
		onlyWithoutGenerationRefs: boolean,
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
					finalCredits: 0,
					pricingSnapshot: { reason, source: "refund" },
					rawUsage: { reason },
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

			const updated = await this.repository.updateEvent(
				eventId,
				["reserved", "settled", "reconcile_failed"],
				{
					reconciledAt: event.reconciledAt ?? new Date(),
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
	): Record<string, unknown> {
		const common = {
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
		const value = snapshot?.usdMicrosPerCredit;

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

	private recoveryOperationPricing(event: AiUsageEvent): OperationPricing {
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

		if (
			snapshot?.source !== "operation_registry_reservation" &&
			settledFixedSnapshot === null
		) {
			return current;
		}

		if (settledFixedSnapshot) {
			if (current.mode !== "fixed") {
				throw new Error(
					`AI usage event ${event.id} has fixed settlement pricing for a non-fixed operation`,
				);
			}

			if (
				settledFixedSnapshot.operation !== event.operation ||
				settledFixedSnapshot.unit !== current.unit
			) {
				throw new Error(
					`AI usage event ${event.id} has a conflicting settlement pricing snapshot`,
				);
			}

			return {
				...current,
				creditsPerUnit: snapshotInteger(
					settledFixedSnapshot.creditsPerUnit,
					"creditsPerUnit",
					{ allowZero: current.unit === "adjustment", eventId: event.id },
				),
			};
		}

		if (
			!snapshot ||
			snapshot.operation !== event.operation ||
			snapshot.mode !== current.mode
		) {
			throw new Error(
				`AI usage event ${event.id} has a conflicting reservation pricing snapshot`,
			);
		}

		const reserveFloorCredits = snapshotInteger(
			snapshot.reserveFloorCredits,
			"reserveFloorCredits",
			{ allowZero: true, eventId: event.id },
		);

		if (current.mode === "fixed") {
			return {
				...current,
				creditsPerUnit: snapshotInteger(
					snapshot.creditsPerUnit,
					"creditsPerUnit",
					{ allowZero: current.unit === "adjustment", eventId: event.id },
				),
				reserveFloorCredits,
				unit:
					snapshot.unit === current.unit
						? current.unit
						: invalidSnapshotValue(event.id, "unit"),
			};
		}

		if (current.mode === "per_minute") {
			if (snapshot.unit !== "minute") {
				invalidSnapshotValue(event.id, "unit");
			}

			return {
				...current,
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
				reserveFloorCredits,
			};
		}

		return { ...current, reserveFloorCredits };
	}

	private reconciledFinalCredits(
		event: AiUsageEvent,
		refs: readonly AiUsageGenerationRef[],
		customerBillableCostUsdMicros: number,
		usdMicrosPerCredit: number,
	): number {
		const pricing = this.recoveryOperationPricing(event);

		if (pricing.mode === "token") {
			return usdMicrosToCredits(
				customerBillableCostUsdMicros,
				usdMicrosPerCredit,
			);
		}

		if (pricing.mode === "fixed") {
			if (event.finalCredits !== null) {
				return event.finalCredits;
			}

			const fixedUnits = this.fixedUnitEvidence(refs);

			return fixedUnits === null
				? event.reservedCredits
				: fixedUnits * pricing.creditsPerUnit;
		}

		// A successful settle is already a durable, caller-observed billing fact.
		// Reconciliation enriches it with provider evidence but does not re-price it.
		if (event.settledAt !== null && event.finalCredits !== null) {
			return event.finalCredits;
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

		return Math.max(
			pricing.minimumCredits,
			Math.ceil(evidence.billedDurationSeconds / 60) * pricing.creditsPerMinute,
		);
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
						? "bundled_unmetered"
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
			throw new Error(
				`AI usage reserve idempotency replay conflict for key ${estimate.idempotencyKey}`,
			);
		}
	}

	private assertSettlementReplay(
		event: AiUsageEvent,
		settlement: PreparedMeteringSettlement,
	): void {
		if (
			event.finalCredits !== settlement.finalCredits ||
			event.model !== settlement.model ||
			event.provider !== settlement.provider ||
			event.inputTokens !== (settlement.usage?.inputTokens ?? null) ||
			event.outputTokens !== (settlement.usage?.outputTokens ?? null) ||
			event.cacheReadTokens !== (settlement.usage?.cacheReadTokens ?? null) ||
			event.cacheWriteTokens !== (settlement.usage?.cacheWriteTokens ?? null) ||
			!isDeepStrictEqual(
				jsonComparable(event.pricingSnapshot),
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
			evidence.finalCredits !== prepared.finalCredits ||
			evidence.model !== prepared.model ||
			evidence.provider !== prepared.provider ||
			usage?.inputTokens !== (prepared.usage?.inputTokens ?? null) ||
			usage?.outputTokens !== (prepared.usage?.outputTokens ?? null) ||
			usage?.cacheReadTokens !== (prepared.usage?.cacheReadTokens ?? null) ||
			usage?.cacheWriteTokens !== (prepared.usage?.cacheWriteTokens ?? null) ||
			usage?.uncachedInputTokens !==
				(prepared.usage?.uncachedInputTokens ?? null) ||
			!isDeepStrictEqual(
				jsonComparable(evidence.pricingSnapshot),
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

function fixedUnitsFromStepUsage(stepUsage: unknown): number | null {
	if (!isRecord(stepUsage) || !isRecord(stepUsage.metering)) {
		return null;
	}

	const fixedUnits = stepUsage.metering.fixedUnits;

	return Number.isSafeInteger(fixedUnits) && (fixedUnits as number) >= 0
		? (fixedUnits as number)
		: null;
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
