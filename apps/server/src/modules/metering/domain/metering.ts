import type { GatewayGenerationInfo } from "@ai-sdk/gateway";
import type {
	aiUsageEvents,
	aiUsageGenerationRefs,
} from "@wandit/db/schema/credits";

import type {
	MeteredTokenUsage,
	NormalizedTokenUsage,
	PricingSnapshot,
} from "./model-pricing";

export const METERING_GATEWAY = Symbol("METERING_GATEWAY");

const BUNDLED_RESERVATION_PENDING_PREFIX = "bundled-pending:";
const BUNDLED_RESERVATION_COMPLETE_PREFIX = "bundled-complete:";
const BUNDLED_UNMETERED_CUSTOMER_BILLING = "bundled_unmetered";

export function bundledReservationPendingAttemptRef(value: string): string {
	return `${BUNDLED_RESERVATION_PENDING_PREFIX}${value}`;
}

export function bundledReservationCompletedAttemptRef(
	pendingAttemptRef: string,
): string {
	if (!isBundledReservationPending(pendingAttemptRef)) {
		throw new Error("Bundled reservation attempt ref is not pending");
	}

	return `${BUNDLED_RESERVATION_COMPLETE_PREFIX}${pendingAttemptRef.slice(
		BUNDLED_RESERVATION_PENDING_PREFIX.length,
	)}`;
}

export function isBundledReservationPending(
	attemptRef: string | null,
): boolean {
	return attemptRef?.startsWith(BUNDLED_RESERVATION_PENDING_PREFIX) ?? false;
}

export function isBundledReservationComplete(
	attemptRef: string | null,
): boolean {
	return attemptRef?.startsWith(BUNDLED_RESERVATION_COMPLETE_PREFIX) ?? false;
}

export function bundledUnmeteredStepUsage(
	operation: "project_title" | "prompt_refine",
	providerUsage: unknown,
): Record<string, unknown> {
	return {
		metering: {
			customerBilling: BUNDLED_UNMETERED_CUSTOMER_BILLING,
			operation,
		},
		providerUsage,
	};
}

export function isBundledUnmeteredStepUsage(stepUsage: unknown): boolean {
	if (!isRecord(stepUsage) || !isRecord(stepUsage.metering)) {
		return false;
	}

	return (
		stepUsage.metering.customerBilling === BUNDLED_UNMETERED_CUSTOMER_BILLING &&
		(stepUsage.metering.operation === "project_title" ||
			stepUsage.metering.operation === "prompt_refine")
	);
}

export type AiUsageEvent = typeof aiUsageEvents.$inferSelect;
export type AiUsageGenerationRef = typeof aiUsageGenerationRefs.$inferSelect;
export type MeteredOperation = AiUsageEvent["operation"];

export type MeteringReserveEstimate = {
	attemptRef?: string | null;
	chatId?: string | null;
	credits: number;
	estimatedCostUsdMicros?: number | null;
	eventId?: string;
	idempotencyKey: string;
	messageId?: string | null;
	model?: string | null;
	parentEventId?: string | null;
	provider?: string | null;
};

export type MeteringReserveReplay = Extract<
	AiUsageEvent["status"],
	"reconciled" | "reserved" | "settled"
>;

export type MeteringReserveOutcome =
	| {
			event: AiUsageEvent;
			replay: "none";
			replayed: false;
	  }
	| {
			event: AiUsageEvent;
			replay: MeteringReserveReplay;
			replayed: true;
	  };

type CommonSettlement = {
	provider?: string | null;
	rawUsage?: unknown;
};

export type TokenMeteringSettlement = CommonSettlement & {
	modelId: string;
	pricing: "token";
	usage: MeteredTokenUsage;
};

export type DirectMeteringSettlement = CommonSettlement & {
	costUsdMicros?: number | null;
	finalCredits: number;
	model?: string | null;
	pricing: "direct";
	pricingSnapshot: Record<string, unknown>;
	usage?: Partial<NormalizedTokenUsage>;
};

export type DirectMeteringSettlementRequest = {
	eventId: string;
	settlement: DirectMeteringSettlement;
};

export type DirectMeteringSettlementPairOutcome = {
	child: AiUsageEvent | null;
	parent: AiUsageEvent;
};

export type MeteringSettlement =
	| DirectMeteringSettlement
	| TokenMeteringSettlement;

export type CapturedGeneration = {
	providerMetadata: unknown;
	stepUsage?: unknown;
};

export type MeteringReconcileOutcome = {
	adjustedCredits: number;
	event: AiUsageEvent;
	reconciledCostUsdMicros: number;
};

export type MeteringRecoveryOutcome = {
	failed: number;
	pending: number;
	reconciled: number;
	refunded: number;
	scanned: number;
};

export type MeteringReconciliationSweepOutcome = {
	failed: number;
	pending: number;
	reconciled: number;
	scanned: number;
};

export interface MeteringGateway {
	getGenerationInfo(params: { id: string }): Promise<GatewayGenerationInfo>;
}

export type PreparedMeteringSettlement = {
	costUsdMicros: number | null;
	finalCredits: number;
	model: string | null;
	pricingSnapshot: PricingSnapshot | Record<string, unknown>;
	provider: string | null;
	rawUsage: unknown;
	usage: NormalizedTokenUsage | null;
};

export class MeteringStateConflictError extends Error {
	constructor(
		readonly eventId: string,
		readonly status: AiUsageEvent["status"],
		readonly action: string,
	) {
		super(`Cannot ${action} AI usage event ${eventId} while it is ${status}`);
		this.name = "MeteringStateConflictError";
	}
}

export class GatewayUsagePendingError extends Error {
	readonly retryable = true;

	constructor(
		readonly eventId: string,
		readonly generationIds: readonly string[],
		options?: { cause?: unknown },
	) {
		super(
			`AI Gateway usage is not available yet for ${generationIds.join(", ")}`,
			options,
		);
		this.name = "GatewayUsagePendingError";
	}
}

export function gatewayGenerationId(providerMetadata: unknown): string | null {
	if (!isRecord(providerMetadata)) {
		return null;
	}

	const gatewayMetadata = providerMetadata.gateway;

	if (!isRecord(gatewayMetadata)) {
		return null;
	}

	const generationId = gatewayMetadata.generationId;

	return typeof generationId === "string" && generationId.length > 0
		? generationId
		: null;
}

export function isGatewayUsagePending(error: unknown): boolean {
	if (error instanceof GatewayUsagePendingError) {
		return true;
	}

	if (!isRecord(error)) {
		return false;
	}

	const statusCode = error.statusCode;
	const message = typeof error.message === "string" ? error.message : "";

	return (
		statusCode === 404 ||
		/usage event not found|no usage event found/iu.test(message)
	);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
