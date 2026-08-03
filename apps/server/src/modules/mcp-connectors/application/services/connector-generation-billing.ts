import type { MeteringSubject } from "../../../credits/domain/credit-owner";
import {
	createFixedOperationBilling,
	type FixedOperationBilling,
	type FixedOperationBillingDependencies,
	type FixedOperationReservation,
	fixedOperationSettlementFromReservation,
	isTerminalFixedOperationReplay,
} from "../../../metering/application/services/fixed-operation-billing";
import type { MeteringService } from "../../../metering/application/services/metering.service";
import { fixedGenerationStepUsage } from "../../../metering/domain/gateway-metering";
import {
	type CapturedGeneration,
	MeteringStateConflictError,
} from "../../../metering/domain/metering";
import {
	type ConnectorGenerationPlan,
	connectorGatewayCaptures,
} from "../../domain/connector-generation-metering";

type ConnectorChildOperation = "image" | "video";

type ConnectorGenerationBillingDependencies = Omit<
	FixedOperationBillingDependencies,
	"meteringService"
> & {
	meteringService: FixedOperationBillingDependencies["meteringService"] &
		Pick<
			MeteringService,
			"settleDirectPairWithFixedEvidence" | "upgradeFixedGenerationUnits"
		>;
};

export type ConnectorGenerationReservations = {
	child?: FixedOperationReservation & {
		operation: ConnectorChildOperation;
	};
	connector: FixedOperationReservation & { operation: "connector" };
};

export type ConnectorGenerationBilling = {
	capture: (
		reservations: ConnectorGenerationReservations,
		capture: CapturedGeneration,
	) => Promise<void>;
	refund: (
		subject: MeteringSubject,
		referenceId: string,
		childOperation?: ConnectorChildOperation,
	) => Promise<void>;
	reserve: (
		subject: MeteringSubject,
		referenceId: string,
		input: ConnectorGenerationPlan & { parentEventId?: string },
	) => Promise<ConnectorGenerationReservations>;
	settle: (
		reservations: ConnectorGenerationReservations,
		input?: { childUnits?: number },
	) => Promise<void>;
	settleExisting: (
		subject: MeteringSubject,
		referenceId: string,
		input: ConnectorGenerationPlan & { completedChildUnits?: number },
	) => Promise<boolean>;
};

/** Derive the queued job's billing snapshot from its durable reservations. */
export function connectorBillingAdmissionMode(
	reservations: ConnectorGenerationReservations,
): "enforce" | "off" {
	const connectorEnabled = reservations.connector.eventId !== null;
	const childEnabled = reservations.child?.eventId !== null;

	if (reservations.child && childEnabled !== connectorEnabled) {
		throw new Error(
			"Connector parent and child billing must be enabled together",
		);
	}

	return connectorEnabled ? "enforce" : "off";
}

/** Capture every gateway id in an MCP receipt/status response immediately. */
export async function captureConnectorGenerationResult(
	billing: Pick<ConnectorGenerationBilling, "capture">,
	reservations: ConnectorGenerationReservations,
	result: unknown,
): Promise<boolean> {
	const captures = connectorGatewayCaptures(result);

	for (const capture of captures) {
		await billing.capture(reservations, {
			...capture,
			stepUsage: fixedGenerationStepUsage(
				fixedCaptureProviderUsage(capture.stepUsage),
				0,
			),
		});
	}

	return captures.length > 0;
}

/**
 * Complete the durable billing side effects for provider work that already
 * succeeded. Generation references must be durable before settlement, and
 * both writes are idempotent, so transient persistence failures can be
 * retried without ever invoking the provider again.
 */
export async function finalizeConnectorGenerationBilling(
	billing: Pick<ConnectorGenerationBilling, "capture" | "settle">,
	reservations: ConnectorGenerationReservations,
	captures: readonly CapturedGeneration[],
	options: number | { attempts?: number; childUnits?: number } = 3,
): Promise<void> {
	const attempts =
		typeof options === "number" ? options : (options.attempts ?? 3);
	for (const capture of captures) {
		// Fixed-operation capture owns its own bounded generation-ref retry. Do
		// not multiply that retry loop here; settlement still needs this adapter's
		// retry because parent/child publication is connector-specific.
		// Submit/status callbacks persist fixedUnits=0 before completion is known.
		// Normalize final captures to that insertion shape, then use the explicit
		// monotonic upgrade below so a replay never conflicts with the early ref.
		await billing.capture(reservations, {
			...capture,
			stepUsage: fixedGenerationStepUsage(
				fixedCaptureProviderUsage(capture.stepUsage),
				0,
			),
		});
	}

	await retryBillingWrite(
		() =>
			billing.settle(
				reservations,
				typeof options === "number"
					? undefined
					: { childUnits: options.childUnits },
			),
		attempts,
	);
}

export function hasTerminalConnectorGenerationReplay(
	reservations: ConnectorGenerationReservations,
): boolean {
	return (
		isTerminalFixedOperationReplay(reservations.connector) ||
		(reservations.child !== undefined &&
			isTerminalFixedOperationReplay(reservations.child))
	);
}

/**
 * One connector generation always carries the connector fee. Media-producing
 * operations additionally carry an image/video child event whose registry
 * price wins for that child operation.
 */
export function createConnectorGenerationBilling(
	dependencies: ConnectorGenerationBillingDependencies,
): ConnectorGenerationBilling {
	const connectorBilling = createFixedOperationBilling(
		"connector",
		dependencies,
	);
	const imageBilling = createFixedOperationBilling("image", dependencies);
	const videoBilling = createFixedOperationBilling("video", dependencies);

	return {
		async capture(reservations, capture) {
			const target = reservations.child ?? reservations.connector;
			await billingFor(target.operation).capture(target, capture);
		},
		async refund(subject, referenceId, childOperation) {
			const failures: unknown[] = [];

			if (childOperation) {
				try {
					await billingFor(childOperation).refund(
						subject,
						referenceId,
						"connector_generation_failed",
					);
				} catch (error) {
					failures.push(error);
				}
			}

			try {
				await connectorBilling.refund(
					subject,
					referenceId,
					"connector_generation_failed",
				);
			} catch (error) {
				failures.push(error);
			}

			if (failures.length > 0) {
				throw failures[0];
			}
		},
		async reserve(subject, referenceId, input) {
			const connector = (await connectorBilling.reserve(subject, referenceId, {
				parentEventId: input.parentEventId,
			})) as ConnectorGenerationReservations["connector"];
			assertExecutableReservation(connector);

			if (!input.childOperation) {
				return { connector };
			}

			let child: NonNullable<ConnectorGenerationReservations["child"]>;
			try {
				child = (await billingFor(input.childOperation).reserve(
					subject,
					referenceId,
					{
						parentEventId: connector.eventId ?? undefined,
						units: input.childUnits,
					},
				)) as NonNullable<ConnectorGenerationReservations["child"]>;
			} catch (error) {
				// Preserve the original error (especially the typed 402). A failed
				// compensating refund remains recoverable by the metering sweep.
				await Promise.allSettled([
					connectorBilling.refund(
						subject,
						referenceId,
						"connector_child_reserve_failed",
					),
				]);
				throw error;
			}

			if (isTerminalFixedOperationReplay(child)) {
				// The child proves prior provider work completed. Finish an open
				// connector fee, but never authorize another provider invocation.
				await connectorBilling.settle(connector);
				assertExecutableReservation(child);
			}

			return { child, connector };
		},
		async settleExisting(subject, referenceId, input) {
			const connectorEvent =
				await dependencies.meteringService.findByIdempotencyKey(
					`connector:${referenceId}`,
					subject,
				);
			const childEvent = input.childOperation
				? await dependencies.meteringService.findByIdempotencyKey(
						`${input.childOperation}:${referenceId}`,
						subject,
					)
				: null;

			if (!connectorEvent && !childEvent) {
				return false;
			}
			if (!connectorEvent) {
				throw new Error(
					`Connector child billing ${referenceId} has no parent event`,
				);
			}
			if (connectorEvent.operation !== "connector") {
				throw new Error(
					`AI usage event ${connectorEvent.id} is ${connectorEvent.operation}, expected connector`,
				);
			}
			if (input.childOperation && !childEvent) {
				throw new Error(
					`Connector billing ${referenceId} has no ${input.childOperation} child event`,
				);
			}
			if (
				childEvent &&
				(childEvent.operation !== input.childOperation ||
					childEvent.parentEventId !== connectorEvent.id)
			) {
				throw new Error(
					`AI usage event ${childEvent.id} is not the expected child of ${connectorEvent.id}`,
				);
			}
			if (
				connectorEvent.status === "refunded" ||
				childEvent?.status === "refunded"
			) {
				throw new MeteringStateConflictError(
					childEvent?.status === "refunded" ? childEvent.id : connectorEvent.id,
					"refunded",
					"recover connector completion for",
				);
			}

			const childUnits = childEvent
				? (input.completedChildUnits ?? input.childUnits ?? 1)
				: undefined;
			const reservations: ConnectorGenerationReservations = {
				...(childEvent && input.childOperation
					? {
							child: {
								credits: childEvent.reservedCredits,
								eventId: childEvent.id,
								operation: input.childOperation,
								referenceId,
								replay: replayFromEventStatus(childEvent.status),
								units: input.childUnits ?? 1,
							},
						}
					: {}),
				connector: {
					credits: connectorEvent.reservedCredits,
					eventId: connectorEvent.id,
					operation: "connector",
					referenceId,
					replay: replayFromEventStatus(connectorEvent.status),
					units: 1,
				},
			};

			if (
				connectorEvent.status === "reconcile_failed" ||
				childEvent?.status === "reconcile_failed"
			) {
				const evidenceEventId = childEvent?.id ?? connectorEvent.id;
				await dependencies.meteringService.upgradeFixedGenerationUnits(
					evidenceEventId,
					childEvent ? (childUnits ?? 1) : 1,
				);

				if (connectorEvent.status !== "reconcile_failed") {
					await dependencies.meteringService.settle(
						connectorEvent.id,
						fixedOperationSettlementFromReservation(reservations.connector, 1),
					);
				}
				if (childEvent && childEvent.status !== "reconcile_failed") {
					await dependencies.meteringService.settle(
						childEvent.id,
						fixedOperationSettlementFromReservation(
							reservations.child as NonNullable<
								ConnectorGenerationReservations["child"]
							>,
							childUnits,
						),
					);
				}
				return true;
			}

			await this.settle(reservations, { childUnits });
			return true;
		},
		async settle(reservations, input) {
			if (!reservations.child) {
				if (reservations.connector.eventId === null) {
					return;
				}

				await dependencies.meteringService.settleDirectPairWithFixedEvidence(
					{
						eventId: reservations.connector.eventId,
						settlement: fixedOperationSettlementFromReservation(
							reservations.connector,
							1,
						),
					},
					undefined,
					{
						completedUnits: 1,
						eventId: reservations.connector.eventId,
					},
				);
				return;
			}

			const parentEventId = reservations.connector.eventId;
			const childEventId = reservations.child.eventId;

			if (parentEventId === null && childEventId === null) {
				return;
			}

			if (parentEventId === null || childEventId === null) {
				throw new Error(
					"Connector parent and child billing must be enabled together",
				);
			}

			// One transaction closes both fixed fees. External MCP providers often
			// expose no Gateway generation id, so neither event may rely on stale-ref
			// recovery to repair a crash between two independent settlements.
			const childUnits = input?.childUnits ?? reservations.child.units;
			await dependencies.meteringService.settleDirectPairWithFixedEvidence(
				{
					eventId: parentEventId,
					settlement: fixedOperationSettlementFromReservation(
						reservations.connector,
						reservations.connector.units,
					),
				},
				{
					eventId: childEventId,
					settlement: fixedOperationSettlementFromReservation(
						reservations.child,
						childUnits,
					),
				},
				{ completedUnits: childUnits, eventId: childEventId },
			);
		},
	};

	function billingFor(
		operation: ConnectorChildOperation | "connector",
	): FixedOperationBilling {
		if (operation === "image") {
			return imageBilling;
		}
		if (operation === "video") {
			return videoBilling;
		}
		return connectorBilling;
	}
}

function assertExecutableReservation(
	reservation: FixedOperationReservation,
): void {
	if (
		(reservation.replay === "settled" || reservation.replay === "reconciled") &&
		reservation.eventId !== null
	) {
		throw new MeteringStateConflictError(
			reservation.eventId,
			reservation.replay,
			"execute provider for",
		);
	}
}

function fixedCaptureProviderUsage(stepUsage: unknown): unknown {
	if (
		typeof stepUsage === "object" &&
		stepUsage !== null &&
		!Array.isArray(stepUsage) &&
		"metering" in stepUsage &&
		"providerUsage" in stepUsage
	) {
		return stepUsage.providerUsage;
	}

	return stepUsage;
}

function replayFromEventStatus(
	status:
		| "reconcile_failed"
		| "reconciled"
		| "refunded"
		| "reserved"
		| "settled",
): "reconciled" | "reserved" | "settled" {
	if (status === "refunded") {
		throw new Error("A refunded event cannot be reconstructed for settlement");
	}

	return status === "reconciled" || status === "settled" ? status : "reserved";
}

async function retryBillingWrite(
	write: () => Promise<void>,
	attempts: number,
): Promise<void> {
	let lastError: unknown;

	for (let attempt = 0; attempt < attempts; attempt += 1) {
		try {
			await write();
			return;
		} catch (error) {
			lastError = error;
		}
	}

	throw lastError;
}
