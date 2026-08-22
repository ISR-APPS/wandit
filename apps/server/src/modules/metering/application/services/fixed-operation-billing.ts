import type { MeteringSubject } from "../../../credits/domain/credit-owner";
import type {
	AiUsageEvent,
	CapturedGeneration,
	DirectMeteringSettlement,
	MeteringReserveReplay,
	MeteringSettlement,
} from "../../domain/metering";
import { MeteringStateConflictError } from "../../domain/metering";
import {
	DEFAULT_USD_MICROS_PER_CREDIT,
	type MeteredTokenUsage,
	usdMicrosToCentiCredits,
} from "../../domain/model-pricing";
import {
	type AiUsageOperation,
	operationPricing,
} from "../../domain/operation-registry";
import type { MeteringService } from "./metering.service";

const FIXED_CAPTURE_ATTEMPTS = 3;

export type MeasuredMeteredOperation = Extract<
	AiUsageOperation,
	"connector" | "image" | "marketing" | "video"
>;

export type BillingAdmissionMode = "enforce" | "off";

export type MeasuredSettlementOutcome =
	| "delivered"
	| "failed_no_deliverable"
	| "partial";

/**
 * Reservation-time price terms, durable in the event's pricing snapshot. New
 * holds are `measured`; holds created before measured billing keep their
 * `fixed` registry price so in-flight work settles under the terms the user
 * was admitted with.
 */
export type MeasuredReservationTerms =
	| {
			estimatedUnitUsdMicros: number | null;
			mode: "measured";
			unit: string;
			usdMicrosPerCredit: number;
	  }
	| { creditsPerUnit: number; mode: "fixed"; unit: string }
	| { mode: "token"; usdMicrosPerCredit: number };

export type MeasuredOperationReservation = {
	credits: number;
	eventId: string | null;
	operation: MeasuredMeteredOperation;
	referenceId: string;
	replay: "none" | MeteringReserveReplay | "reconcile_failed";
	terms: MeasuredReservationTerms;
	units: number;
};

export type MeasuredSettlementInput = {
	completedUnits?: number;
	/** Overrides `completedUnits × estimatedUnitUsdMicros` (duration-aware). */
	localCostUsdMicros?: number | null;
	/** Token-priced operations: the provider usage of the completed call. */
	tokenUsage?: {
		modelId: string;
		provider?: string | null;
		rawUsage?: unknown;
		usage: MeteredTokenUsage;
	} | null;
};

/**
 * Provisional settlement from the local cost estimate. Gateway reconciliation
 * reprices it from the exact provider cost; a zero-unit failure charges 0 and
 * is never re-charged (the refunded_failure ref marker keeps it that way)
 * while its provider cost still lands in the admin spend sums.
 */
export function measuredOperationSettlement(
	reservation: Pick<
		MeasuredOperationReservation,
		"credits" | "operation" | "units"
	> &
		Partial<Pick<MeasuredOperationReservation, "terms">>,
	input: MeasuredSettlementInput = {},
): MeteringSettlement {
	const units = input.completedUnits ?? reservation.units;

	if (!Number.isSafeInteger(units) || units < 0) {
		throw new Error("Measured settlement units must be non-negative");
	}

	// A reservation queued (Trigger payload) before measured billing carries
	// no terms: its credits/units ratio is the immutable fixed unit price.
	const terms = reservation.terms ?? legacyTermsFromCredits(reservation);

	if (terms.mode === "fixed") {
		return legacyFixedSettlement(reservation, terms, units);
	}

	if (terms.mode === "token") {
		return tokenOperationSettlement(reservation, terms, units, input);
	}

	const { estimatedUnitUsdMicros, usdMicrosPerCredit } = terms;
	const outcome: MeasuredSettlementOutcome =
		units === 0
			? "failed_no_deliverable"
			: units < reservation.units
				? "partial"
				: "delivered";
	const costUsdMicros =
		input.localCostUsdMicros ??
		(estimatedUnitUsdMicros === null ? null : estimatedUnitUsdMicros * units);

	if (
		costUsdMicros !== null &&
		(!Number.isSafeInteger(costUsdMicros) || costUsdMicros < 0)
	) {
		throw new Error("Measured settlement cost must be a non-negative integer");
	}

	// A known zero cost (a render on the user's own provider subscription)
	// charges nothing; the 1 cc minimum applies only to a real positive cost.
	const finalCredits =
		units === 0 || costUsdMicros === 0
			? 0
			: costUsdMicros === null
				? reservationUnitCredits(reservation) * units
				: usdMicrosToCentiCredits(costUsdMicros, usdMicrosPerCredit);

	return {
		costUsdMicros,
		finalCredits,
		pricing: "direct",
		pricingSnapshot: {
			estimatedUnitUsdMicros,
			mode: "measured",
			operation: reservation.operation,
			outcome,
			// No catalog rate: the floor charge is a provisional flat number, not
			// a provider cost. Flag it so a ref-less event is never finalized
			// silently (MeteringService.finalizeSettledWithoutRefs) and admin
			// views can review it.
			...(finalCredits > 0 && costUsdMicros === null
				? { reviewFlags: ["no_catalog_rate"] }
				: {}),
			source: "measured_local",
			unit: terms.unit,
			units,
			usdMicrosPerCredit,
		},
	};
}

function legacyTermsFromCredits(
	reservation: Pick<
		MeasuredOperationReservation,
		"credits" | "operation" | "units"
	>,
): MeasuredReservationTerms {
	if (
		!Number.isSafeInteger(reservation.units) ||
		reservation.units <= 0 ||
		!Number.isSafeInteger(reservation.credits) ||
		reservation.credits <= 0 ||
		reservation.credits % reservation.units !== 0
	) {
		throw new Error("Fixed-price reservation has an invalid unit price");
	}

	return {
		creditsPerUnit: reservation.credits / reservation.units,
		mode: "fixed",
		unit: reservation.operation === "image" ? "image" : "operation",
	};
}

function legacyFixedSettlement(
	reservation: Pick<MeasuredOperationReservation, "operation">,
	terms: Extract<MeasuredReservationTerms, { mode: "fixed" }>,
	units: number,
): DirectMeteringSettlement {
	return {
		finalCredits: terms.creditsPerUnit * units,
		pricing: "direct",
		pricingSnapshot: {
			creditsPerUnit: terms.creditsPerUnit,
			mode: "fixed",
			operation: reservation.operation,
			source: "operation_registry",
			unit: terms.unit,
			units,
		},
	};
}

/**
 * Token-priced operation (marketing). With provider usage the call settles
 * like a chat turn; a recovery without usage settles the reserve floor and a
 * zero-unit failure settles 0 — gateway reconciliation reprices both from the
 * exact cost, and the refunded_failure ref marker keeps a failure at 0.
 */
function tokenOperationSettlement(
	reservation: Pick<MeasuredOperationReservation, "credits" | "operation">,
	terms: Extract<MeasuredReservationTerms, { mode: "token" }>,
	units: number,
	input: MeasuredSettlementInput,
): MeteringSettlement {
	if (input.tokenUsage && units > 0) {
		return {
			modelId: input.tokenUsage.modelId,
			pricing: "token",
			provider: input.tokenUsage.provider,
			rawUsage: input.tokenUsage.rawUsage,
			usage: input.tokenUsage.usage,
		};
	}

	return {
		finalCredits: units === 0 ? 0 : reservation.credits,
		pricing: "direct",
		pricingSnapshot: {
			mode: "token",
			operation: reservation.operation,
			outcome: units === 0 ? "failed_no_deliverable" : "delivered",
			source: "token_floor_recovery",
			units,
			usdMicrosPerCredit: terms.usdMicrosPerCredit,
		},
	};
}

/** Direct-only variant for atomic parent/child settlement. */
export function measuredDirectSettlement(
	reservation: Pick<
		MeasuredOperationReservation,
		"credits" | "operation" | "units"
	> &
		Partial<Pick<MeasuredOperationReservation, "terms">>,
	input: MeasuredSettlementInput = {},
): DirectMeteringSettlement {
	const settlement = measuredOperationSettlement(reservation, input);

	if (settlement.pricing !== "direct") {
		throw new Error(
			`${reservation.operation} settlement must be direct-priced here`,
		);
	}

	return settlement;
}

/** Floor-derived credits per unit when no local price estimate exists. */
function reservationUnitCredits(
	reservation: Pick<MeasuredOperationReservation, "credits" | "units">,
): number {
	if (!Number.isSafeInteger(reservation.units) || reservation.units <= 0) {
		throw new Error("Measured reservation units must be a positive integer");
	}

	return Math.ceil(reservation.credits / reservation.units);
}

/**
 * Rebuild the reservation-time terms from a durable event. Used after every
 * reserve replay and by recovery paths that reconstruct reservations from
 * stored events.
 */
export function reservationTermsFromEvent(
	event: Pick<AiUsageEvent, "id" | "pricingSnapshot"> &
		Partial<Pick<AiUsageEvent, "operation">>,
	expectedOperation?: AiUsageOperation,
): MeasuredReservationTerms {
	const operation = event.operation ?? expectedOperation;

	if (!operation) {
		throw new Error(`AI usage event ${event.id} has no operation`);
	}

	const snapshot = reservationPricingSnapshot(event.pricingSnapshot);
	const current = operationPricing(operation);
	const currentUnit = "unit" in current ? current.unit : "operation";

	if (!snapshot) {
		return current.mode === "token"
			? { mode: "token", usdMicrosPerCredit: DEFAULT_USD_MICROS_PER_CREDIT }
			: {
					estimatedUnitUsdMicros: null,
					mode: "measured",
					unit: currentUnit,
					usdMicrosPerCredit: DEFAULT_USD_MICROS_PER_CREDIT,
				};
	}

	if (snapshot.operation !== operation) {
		throw new Error(
			`AI usage event ${event.id} has a conflicting pricing snapshot`,
		);
	}

	if (snapshot.mode === "token") {
		return {
			mode: "token",
			usdMicrosPerCredit: positiveSnapshotInteger(
				snapshot.usdMicrosPerCredit,
				DEFAULT_USD_MICROS_PER_CREDIT,
			),
		};
	}

	if (snapshot.mode === "fixed") {
		const creditsPerUnit = snapshot.creditsPerUnit;

		if (
			!Number.isSafeInteger(creditsPerUnit) ||
			(creditsPerUnit as number) <= 0
		) {
			throw new Error(
				`AI usage event ${event.id} has a conflicting fixed-price snapshot`,
			);
		}

		return {
			creditsPerUnit: creditsPerUnit as number,
			mode: "fixed",
			unit: typeof snapshot.unit === "string" ? snapshot.unit : currentUnit,
		};
	}

	if (snapshot.mode !== "measured") {
		throw new Error(
			`AI usage event ${event.id} has an unsupported ${String(snapshot.mode)} pricing snapshot`,
		);
	}

	const estimatedUnitUsdMicros = snapshot.estimatedUnitUsdMicros;

	return {
		estimatedUnitUsdMicros:
			Number.isSafeInteger(estimatedUnitUsdMicros) &&
			(estimatedUnitUsdMicros as number) >= 0
				? (estimatedUnitUsdMicros as number)
				: null,
		mode: "measured",
		unit: typeof snapshot.unit === "string" ? snapshot.unit : currentUnit,
		usdMicrosPerCredit: positiveSnapshotInteger(
			snapshot.usdMicrosPerCredit,
			DEFAULT_USD_MICROS_PER_CREDIT,
		),
	};
}

function positiveSnapshotInteger(value: unknown, fallback: number): number {
	return Number.isSafeInteger(value) && (value as number) > 0
		? (value as number)
		: fallback;
}

export type MeasuredOperationBillingDependencies = {
	isBillingDisabled: () => boolean;
	meteringService: Pick<
		MeteringService,
		| "captureGeneration"
		| "findByIdempotencyKey"
		| "refund"
		| "reserveWithReplay"
		| "settle"
		| "settleMeasuredFromEvidence"
	> &
		// Optional so billing-off runtimes and test doubles need no price catalog.
		Partial<
			Pick<MeteringService, "estimateMeasuredCost" | "usdMicrosPerCredit">
		>;
};

export type MeasuredReserveInput = {
	billingMode?: BillingAdmissionMode;
	/** Local provider-cost estimate for all `units` (null: floor only). */
	estimateUsdMicros?: number | null;
	/**
	 * Replaces the registry floor (total, not per unit). Connector children
	 * render on the user's own provider subscription and hold 1 cc.
	 */
	floorCredits?: number;
	parentEventId?: string;
	units?: number;
};

export type MeasuredOperationBilling = {
	capture: (
		reservation: MeasuredOperationReservation,
		capture: CapturedGeneration,
	) => Promise<void>;
	refund: (
		subject: MeteringSubject,
		referenceId: string,
		reason: string,
	) => Promise<void>;
	reserve: (
		subject: MeteringSubject,
		referenceId: string,
		input: MeasuredReserveInput,
	) => Promise<MeasuredOperationReservation>;
	settle: (
		reservation: MeasuredOperationReservation,
		input?: number | MeasuredSettlementInput,
	) => Promise<void>;
	settleExisting: (
		subject: MeteringSubject,
		referenceId: string,
		units?: number,
	) => Promise<boolean>;
};

/** Reserve size for `units` units: the larger of the floor and the estimate. */
export function measuredReserveCredits(
	operation: MeasuredMeteredOperation,
	units: number,
	estimateUsdMicros: number | null | undefined,
	usdMicrosPerCredit = DEFAULT_USD_MICROS_PER_CREDIT,
	floorCredits?: number,
): number {
	const pricing = operationPricing(operation);

	if (!Number.isSafeInteger(units) || units <= 0) {
		throw new Error("Measured reservation units must be a positive integer");
	}

	if (
		floorCredits !== undefined &&
		(!Number.isSafeInteger(floorCredits) || floorCredits <= 0)
	) {
		throw new Error("Measured reservation floor must be a positive integer");
	}

	const floor = floorCredits ?? pricing.reserveFloorCredits * units;

	if (estimateUsdMicros == null || pricing.mode === "token") {
		return floor;
	}

	if (!Number.isSafeInteger(estimateUsdMicros) || estimateUsdMicros < 0) {
		throw new Error("Measured cost estimate must be a non-negative integer");
	}

	return Math.max(
		floor,
		usdMicrosToCentiCredits(estimateUsdMicros, usdMicrosPerCredit),
	);
}

/**
 * Nest-free adapter for measured background operations. API tools and
 * Trigger runtimes share it so their reserve replay fingerprint, settlement,
 * capture, and refund behavior cannot drift.
 */
export function createMeasuredOperationBilling(
	operation: MeasuredMeteredOperation,
	dependencies: MeasuredOperationBillingDependencies,
): MeasuredOperationBilling {
	const pricing = operationPricing(operation);

	if (pricing.mode !== "measured" && pricing.mode !== "token") {
		throw new Error(`${operation} is not a measured operation`);
	}

	const idempotencyKey = (referenceId: string) => `${operation}:${referenceId}`;
	const usdMicrosPerCredit =
		dependencies.meteringService.usdMicrosPerCredit ??
		DEFAULT_USD_MICROS_PER_CREDIT;

	return {
		async capture(reservation, capture) {
			if (reservation.eventId === null) {
				return;
			}

			let lastError: unknown;

			for (let attempt = 0; attempt < FIXED_CAPTURE_ATTEMPTS; attempt += 1) {
				try {
					const captured = await dependencies.meteringService.captureGeneration(
						reservation.eventId,
						capture,
					);

					if (!captured) {
						throw new Error(
							`${operation} generation did not expose a gateway generation id`,
						);
					}

					return;
				} catch (error) {
					lastError = error;
				}
			}

			throw lastError instanceof Error
				? lastError
				: new Error(`${operation} generation capture failed`);
		},
		async refund(subject, referenceId, reason) {
			// Refund an existing reservation even if an operator disabled billing
			// after it was created. The lookup is read-only when no event exists.
			const event = await dependencies.meteringService.findByIdempotencyKey(
				idempotencyKey(referenceId),
				subject,
			);

			if (!event) {
				return;
			}

			// Poll/read paths may replay failure cleanup after a partial direct
			// settlement. Terminal financial states are already authoritative and
			// must not turn an otherwise readable failed attempt into a 500.
			if (
				event.status === "settled" ||
				event.status === "reconciled" ||
				event.status === "reconcile_failed" ||
				event.status === "refunded"
			) {
				return;
			}

			await dependencies.meteringService.refund(event.id, reason);
		},
		async reserve(subject, referenceId, input) {
			const units = input.units ?? 1;
			const key = idempotencyKey(referenceId);
			let existing = await dependencies.meteringService.findByIdempotencyKey(
				key,
				subject,
			);
			// A replay reuses the durable hold's own terms: a price refresh
			// between two attempts must never change the fingerprint.
			const terms = existing
				? replayReservationTerms(existing, operation, units)
				: freshReservationTerms(
						operation,
						units,
						input.estimateUsdMicros,
						usdMicrosPerCredit,
						input.floorCredits,
					);
			const estimate = {
				attemptRef: referenceId,
				credits: terms.credits,
				estimatedCostUsdMicros: terms.estimatedCostUsdMicros,
				idempotencyKey: key,
				measuredTerms: {
					estimatedUnitUsdMicros: terms.estimatedUnitUsdMicros,
					units,
				},
				parentEventId: input.parentEventId,
			};

			const billingDisabled =
				input.billingMode === "off" ||
				(input.billingMode === undefined && dependencies.isBillingDisabled());

			if (billingDisabled) {
				// A kill-switch change after API admission must not discard an
				// already-debited hold. The read above ensures billing-off never creates
				// a new event, while existing holds still get strict replay validation.
				if (!existing) {
					return {
						credits: terms.credits,
						eventId: null,
						operation,
						referenceId,
						replay: "none",
						terms:
							pricing.mode === "token"
								? {
										mode: "token",
										usdMicrosPerCredit,
									}
								: {
										estimatedUnitUsdMicros: terms.estimatedUnitUsdMicros,
										mode: "measured",
										unit: pricing.unit,
										usdMicrosPerCredit,
									},
						units,
					};
				}
			}

			if (existing?.status === "reconcile_failed") {
				return reconcileFailedReservation(existing, estimate, units);
			}

			let outcome: Awaited<ReturnType<MeteringService["reserveWithReplay"]>>;

			try {
				outcome = await dependencies.meteringService.reserveWithReplay(
					operation,
					subject,
					estimate,
				);
			} catch (error) {
				if (
					!(
						error instanceof MeteringStateConflictError &&
						error.status === "reconcile_failed"
					)
				) {
					throw error;
				}

				existing ??= await dependencies.meteringService.findByIdempotencyKey(
					estimate.idempotencyKey,
					subject,
				);
				if (!existing) {
					throw error;
				}

				return reconcileFailedReservation(existing, estimate, units);
			}

			return {
				credits: outcome.event.reservedCredits,
				eventId: outcome.event.id,
				operation,
				referenceId,
				replay: outcome.replay,
				terms: reservationTermsFromEvent(outcome.event, operation),
				units,
			};
		},
		async settle(reservation, input = {}) {
			if (reservation.eventId === null) {
				return;
			}

			if (reservation.operation !== operation) {
				throw new Error(
					`Cannot settle ${reservation.operation} with ${operation} billing`,
				);
			}

			await dependencies.meteringService.settle(
				reservation.eventId,
				measuredOperationSettlement(
					reservation,
					typeof input === "number" ? { completedUnits: input } : input,
				),
			);
		},
		async settleExisting(subject, referenceId, units = 1) {
			const event = await dependencies.meteringService.findByIdempotencyKey(
				idempotencyKey(referenceId),
				subject,
			);

			if (!event) {
				return false;
			}

			if (event.operation !== operation) {
				throw new Error(
					`AI usage event ${event.id} is ${event.operation}, expected ${operation}`,
				);
			}

			// Storage recovery is downstream of financial recovery. Once the event
			// is terminal, its provider-completed unit count is authoritative; make
			// the available stored prefix visible without attempting to reprice it.
			if (
				event.status === "settled" ||
				event.status === "reconciled" ||
				(event.status === "reconcile_failed" && event.finalCredits !== null)
			) {
				return true;
			}

			await dependencies.meteringService.settleMeasuredFromEvidence(
				event.id,
				units,
			);
			return true;
		},
	};

	function reconcileFailedReservation(
		event: AiUsageEvent,
		estimate: {
			attemptRef: string;
			credits: number;
			estimatedCostUsdMicros: number | null;
			idempotencyKey: string;
			parentEventId?: string;
		},
		units: number,
	): MeasuredOperationReservation {
		if (
			event.status !== "reconcile_failed" ||
			event.operation !== operation ||
			event.idempotencyKey !== estimate.idempotencyKey ||
			event.attemptRef !== estimate.attemptRef ||
			event.reservedCredits !== estimate.credits ||
			event.parentEventId !== (estimate.parentEventId ?? null) ||
			event.estimatedCostUsdMicros !== estimate.estimatedCostUsdMicros ||
			event.chatId !== null ||
			event.messageId !== null ||
			event.model !== null ||
			event.provider !== null
		) {
			throw new Error(
				`AI usage reserve idempotency replay conflict for key ${estimate.idempotencyKey}`,
			);
		}

		return {
			credits: event.reservedCredits,
			eventId: event.id,
			operation,
			referenceId: estimate.attemptRef,
			replay: "reconcile_failed",
			terms: reservationTermsFromEvent(event, operation),
			units,
		};
	}
}

type ReservationTerms = {
	credits: number;
	estimatedCostUsdMicros: number | null;
	estimatedUnitUsdMicros: number | null;
};

function freshReservationTerms(
	operation: MeasuredMeteredOperation,
	units: number,
	estimateUsdMicros: number | null | undefined,
	usdMicrosPerCredit: number,
	floorCredits?: number,
): ReservationTerms {
	const estimatedCostUsdMicros = estimateUsdMicros ?? null;

	return {
		credits: measuredReserveCredits(
			operation,
			units,
			estimatedCostUsdMicros,
			usdMicrosPerCredit,
			floorCredits,
		),
		estimatedCostUsdMicros,
		estimatedUnitUsdMicros:
			estimatedCostUsdMicros === null
				? null
				: Math.ceil(estimatedCostUsdMicros / units),
	};
}

function replayReservationTerms(
	event: AiUsageEvent,
	operation: MeasuredMeteredOperation,
	units: number,
): ReservationTerms {
	const snapshot = reservationPricingSnapshot(event.pricingSnapshot);

	if (!snapshot) {
		return {
			credits: event.reservedCredits,
			estimatedCostUsdMicros: event.estimatedCostUsdMicros ?? null,
			estimatedUnitUsdMicros: null,
		};
	}

	if (snapshot.operation !== operation) {
		throw new Error(
			`AI usage event ${event.id} has a conflicting pricing snapshot`,
		);
	}

	if (snapshot.mode === "fixed") {
		const creditsPerUnit = snapshot.creditsPerUnit;

		if (
			!Number.isSafeInteger(creditsPerUnit) ||
			(creditsPerUnit as number) <= 0 ||
			(creditsPerUnit as number) * units !== event.reservedCredits
		) {
			throw new Error(
				`AI usage event ${event.id} fixed-price replay is invalid`,
			);
		}

		return {
			credits: event.reservedCredits,
			estimatedCostUsdMicros: event.estimatedCostUsdMicros ?? null,
			estimatedUnitUsdMicros: null,
		};
	}

	if (snapshot.mode === "token") {
		return {
			credits: event.reservedCredits,
			estimatedCostUsdMicros: event.estimatedCostUsdMicros ?? null,
			estimatedUnitUsdMicros: null,
		};
	}

	// Only RESERVATION-time units are a replay contract. A settlement snapshot
	// records the units the provider completed (a partial batch settles fewer
	// than requested, a failure settles 0) — informational here, never a
	// mismatch: the replay must return the terminal event so recovery can
	// publish the stored deliverables.
	if (
		snapshot.mode !== "measured" ||
		(isReservationSnapshot(snapshot) &&
			Number.isSafeInteger(snapshot.units) &&
			snapshot.units !== units)
	) {
		throw new Error(`AI usage event ${event.id} measured replay is invalid`);
	}

	const estimatedUnitUsdMicros = snapshot.estimatedUnitUsdMicros;

	return {
		credits: event.reservedCredits,
		estimatedCostUsdMicros: event.estimatedCostUsdMicros ?? null,
		estimatedUnitUsdMicros: Number.isSafeInteger(estimatedUnitUsdMicros)
			? (estimatedUnitUsdMicros as number)
			: null,
	};
}

/**
 * The snapshot that carries the hold's price terms, preferring the
 * reservation-time basis: the top-level reservation snapshot, then a nested
 * `reservationPricingSnapshot` (reconciled-from-reserved rows), and only then
 * a settlement snapshot (settled rows replace the reservation snapshot; a
 * reconciled-from-settled row nests it as `settlementPricingSnapshot`).
 */
function reservationPricingSnapshot(
	pricingSnapshot: unknown,
): Record<string, unknown> | null {
	if (!isRecord(pricingSnapshot)) {
		return null;
	}

	if (isReservationSnapshot(pricingSnapshot)) {
		return pricingSnapshot;
	}

	const nestedReservation = pricingSnapshot.reservationPricingSnapshot;

	if (isRecord(nestedReservation)) {
		return nestedReservation;
	}

	if (
		pricingSnapshot.source === "operation_registry" ||
		pricingSnapshot.source === "measured_local" ||
		pricingSnapshot.source === "token_floor_recovery"
	) {
		return pricingSnapshot;
	}

	const nestedSettlement = pricingSnapshot.settlementPricingSnapshot;

	return isRecord(nestedSettlement) ? nestedSettlement : null;
}

function isReservationSnapshot(snapshot: Record<string, unknown>): boolean {
	return snapshot.source === "operation_registry_reservation";
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isTerminalFixedOperationReplay(
	reservation: Pick<MeasuredOperationReservation, "replay">,
): reservation is MeasuredOperationReservation & {
	replay: "reconcile_failed" | "reconciled" | "settled";
} {
	return (
		reservation.replay === "settled" ||
		reservation.replay === "reconciled" ||
		reservation.replay === "reconcile_failed"
	);
}

/**
 * Queued API tools call this after handling an already-running/succeeded row
 * and immediately before handing a new row to the provider task. A terminal
 * ledger event must never authorize a second provider invocation, even when
 * the durable attempt row was independently reset or recreated.
 */
export function assertFixedOperationProviderExecutionAllowed(
	reservation: Pick<
		MeasuredOperationReservation,
		"eventId" | "referenceId" | "replay"
	>,
): void {
	if (!isTerminalFixedOperationReplay(reservation)) {
		return;
	}

	throw new MeteringStateConflictError(
		reservation.eventId ?? reservation.referenceId,
		reservation.replay,
		"execute provider for",
	);
}
