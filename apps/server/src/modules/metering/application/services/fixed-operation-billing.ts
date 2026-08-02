import type {
	AiUsageEvent,
	CapturedGeneration,
	DirectMeteringSettlement,
	MeteringReserveReplay,
} from "../../domain/metering";
import { MeteringStateConflictError } from "../../domain/metering";
import {
	type AiUsageOperation,
	fixedOperationCredits,
	operationPricing,
} from "../../domain/operation-registry";
import type { MeteringService } from "./metering.service";

const FIXED_CAPTURE_ATTEMPTS = 3;

export type FixedMeteredOperation = Extract<
	AiUsageOperation,
	"connector" | "image" | "lead_scrape" | "marketing" | "video"
>;

export type BillingAdmissionMode = "enforce" | "off";

export type FixedOperationReservation = {
	credits: number;
	eventId: string | null;
	operation: FixedMeteredOperation;
	referenceId: string;
	replay: "none" | MeteringReserveReplay | "reconcile_failed";
	units: number;
};

export function fixedOperationSettlement(
	operation: FixedMeteredOperation,
	units = 1,
	creditsPerUnitOverride?: number,
): DirectMeteringSettlement {
	const pricing = operationPricing(operation);

	if (pricing.mode !== "fixed") {
		throw new Error(`${operation} is not a fixed-price operation`);
	}
	if (!Number.isSafeInteger(units) || units < 0) {
		throw new Error("Fixed-price settlement units must be non-negative");
	}
	const creditsPerUnit = creditsPerUnitOverride ?? pricing.creditsPerUnit;
	if (!Number.isSafeInteger(creditsPerUnit) || creditsPerUnit <= 0) {
		throw new Error("Fixed-price credits per unit must be a positive integer");
	}

	return {
		finalCredits: creditsPerUnit * units,
		pricing: "direct",
		pricingSnapshot: {
			creditsPerUnit,
			mode: pricing.mode,
			operation,
			source: "operation_registry",
			unit: pricing.unit,
			units,
		},
	};
}

/** Recover the immutable unit price carried by a queue-time reservation. */
export function fixedOperationReservationCreditsPerUnit(
	reservation: Pick<FixedOperationReservation, "credits" | "units">,
): number {
	if (
		!Number.isSafeInteger(reservation.units) ||
		reservation.units <= 0 ||
		!Number.isSafeInteger(reservation.credits) ||
		reservation.credits <= 0 ||
		reservation.credits % reservation.units !== 0
	) {
		throw new Error("Fixed-price reservation has an invalid unit price");
	}

	return reservation.credits / reservation.units;
}

/** Build a partial/full settlement with the immutable queue-time unit price. */
export function fixedOperationSettlementFromReservation(
	reservation: FixedOperationReservation,
	units = reservation.units,
): DirectMeteringSettlement {
	return fixedOperationSettlement(
		reservation.operation,
		units,
		fixedOperationReservationCreditsPerUnit(reservation),
	);
}

export type FixedOperationBillingDependencies = {
	isBillingDisabled: () => boolean;
	meteringService: Pick<
		MeteringService,
		| "captureGeneration"
		| "findByIdempotencyKey"
		| "refund"
		| "reserveWithReplay"
		| "settle"
		| "settleFixedFromEvidence"
	>;
};

export type FixedOperationBilling = {
	capture: (
		reservation: FixedOperationReservation,
		capture: CapturedGeneration,
	) => Promise<void>;
	refund: (
		userId: string,
		referenceId: string,
		reason: string,
	) => Promise<void>;
	reserve: (
		userId: string,
		referenceId: string,
		input: {
			billingMode?: BillingAdmissionMode;
			parentEventId?: string;
			units?: number;
		},
	) => Promise<FixedOperationReservation>;
	settle: (
		reservation: FixedOperationReservation,
		units?: number,
	) => Promise<void>;
	settleExisting: (
		userId: string,
		referenceId: string,
		units?: number,
	) => Promise<boolean>;
};

/**
 * Nest-free adapter for registry-priced background operations. API tools and
 * Trigger runtimes share it so their reserve replay fingerprint, settlement,
 * capture, and refund behavior cannot drift.
 */
export function createFixedOperationBilling(
	operation: FixedMeteredOperation,
	dependencies: FixedOperationBillingDependencies,
): FixedOperationBilling {
	const pricing = operationPricing(operation);

	if (pricing.mode !== "fixed") {
		throw new Error(`${operation} is not a fixed-price operation`);
	}

	const idempotencyKey = (referenceId: string) => `${operation}:${referenceId}`;

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
		async refund(userId, referenceId, reason) {
			// Refund an existing reservation even if an operator disabled billing
			// after it was created. The lookup is read-only when no event exists.
			const event = await dependencies.meteringService.findByIdempotencyKey(
				idempotencyKey(referenceId),
				userId,
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
		async reserve(userId, referenceId, input) {
			const units = input.units ?? 1;
			const currentCredits = fixedOperationCredits(operation, units);
			const key = idempotencyKey(referenceId);
			let existing = await dependencies.meteringService.findByIdempotencyKey(
				key,
				userId,
			);
			const credits = existing
				? fixedReservationCredits(existing, operation, units, currentCredits)
				: currentCredits;
			const estimate = {
				attemptRef: referenceId,
				credits,
				idempotencyKey: key,
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
						credits,
						eventId: null,
						operation,
						referenceId,
						replay: "none",
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
					userId,
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
					userId,
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
				units,
			};
		},
		async settle(reservation, units = reservation.units) {
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
				fixedOperationSettlementFromReservation(reservation, units),
			);
		},
		async settleExisting(userId, referenceId, units = 1) {
			const event = await dependencies.meteringService.findByIdempotencyKey(
				idempotencyKey(referenceId),
				userId,
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

			await dependencies.meteringService.settleFixedFromEvidence(
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
			idempotencyKey: string;
			parentEventId?: string;
		},
		units: number,
	): FixedOperationReservation {
		if (
			event.status !== "reconcile_failed" ||
			event.operation !== operation ||
			event.idempotencyKey !== estimate.idempotencyKey ||
			event.attemptRef !== estimate.attemptRef ||
			event.reservedCredits !== estimate.credits ||
			event.parentEventId !== (estimate.parentEventId ?? null) ||
			event.estimatedCostUsdMicros !== null ||
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
			units,
		};
	}
}

function fixedReservationCredits(
	event: AiUsageEvent,
	operation: FixedMeteredOperation,
	units: number,
	fallbackCredits: number,
): number {
	const snapshot = fixedReservationPricingSnapshot(event.pricingSnapshot);

	if (!snapshot) {
		return fallbackCredits;
	}

	if (
		snapshot.operation !== operation ||
		snapshot.mode !== "fixed" ||
		!Number.isSafeInteger(snapshot.creditsPerUnit) ||
		(snapshot.creditsPerUnit as number) <= 0
	) {
		throw new Error(
			`AI usage event ${event.id} has a conflicting fixed-price snapshot`,
		);
	}

	const credits = (snapshot.creditsPerUnit as number) * units;
	if (!Number.isSafeInteger(credits) || credits <= 0) {
		throw new Error(`AI usage event ${event.id} fixed-price replay is invalid`);
	}

	return credits;
}

function fixedReservationPricingSnapshot(
	pricingSnapshot: unknown,
): Record<string, unknown> | null {
	if (!isRecord(pricingSnapshot)) {
		return null;
	}

	if (
		pricingSnapshot.source === "operation_registry_reservation" ||
		pricingSnapshot.source === "operation_registry"
	) {
		return pricingSnapshot;
	}

	return isRecord(pricingSnapshot.reservationPricingSnapshot)
		? pricingSnapshot.reservationPricingSnapshot
		: null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isTerminalFixedOperationReplay(
	reservation: FixedOperationReservation,
): reservation is FixedOperationReservation & {
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
	reservation: FixedOperationReservation,
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
