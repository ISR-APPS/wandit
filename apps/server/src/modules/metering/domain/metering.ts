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

const HELPER_BILLABLE_CUSTOMER_BILLING = "helper_billable";

export type HelperStepTask =
	| "project_title"
	| "prompt_refine"
	| "tool_call_repair"
	| "video_director";

/**
 * Helper LLM calls (project title, prompt refiners, tool-call repair) bill
 * inside their parent operation: their gateway cost joins the parent's
 * customer-billable cost at reconciliation. Replaces the retired
 * `bundled_unmetered` tag for every new row.
 */
export function helperStepUsage(
	task: HelperStepTask,
	providerUsage: unknown,
): Record<string, unknown> {
	return {
		metering: {
			customerBilling: HELPER_BILLABLE_CUSTOMER_BILLING,
			task,
		},
		providerUsage,
	};
}

export function isHelperBillableStepUsage(stepUsage: unknown): boolean {
	return (
		isRecord(stepUsage) &&
		isRecord(stepUsage.metering) &&
		stepUsage.metering.customerBilling === HELPER_BILLABLE_CUSTOMER_BILLING
	);
}

/**
 * Legacy reader only: rows tagged before helpers became billable keep the
 * zero-charge promise they were captured under. No new writer emits the tag.
 * TODO(2026-08): remove once reconciliation has not seen the tag for 30 days.
 */
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
	/** Integer centi-credits (1 credit = 100 cc). */
	credits: number;
	estimatedCostUsdMicros?: number | null;
	eventId?: string;
	idempotencyKey: string;
	/**
	 * Measured operations only: the per-unit local cost estimate and unit
	 * count recorded in the reservation snapshot as durable price terms.
	 */
	measuredTerms?: {
		estimatedUnitUsdMicros: number | null;
		units: number;
	} | null;
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
	/** Integer centi-credits (1 credit = 100 cc). */
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
	/** Integer centi-credits (1 credit = 100 cc). */
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

/** Which provider produced (and can reconcile) a generation ref. */
export type GenerationRefSource = "openrouter" | "vercel";

export interface MeteringGateway {
	getGenerationInfo(params: {
		id: string;
		source: GenerationRefSource;
	}): Promise<GatewayGenerationInfo>;
}

export type PreparedMeteringSettlement = {
	costUsdMicros: number | null;
	/** Integer centi-credits (1 credit = 100 cc). */
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

export type CapturedGenerationRef = {
	generationId: string;
	source: GenerationRefSource;
};

/**
 * Provider-aware generation-ref extraction. The Vercel gateway writes
 * providerMetadata.gateway.generationId; the OpenRouter model wrapper writes
 * providerMetadata.openrouter.generationId. Everything downstream (refs,
 * reconciliation routing) keys off the returned source.
 */
export function capturedGenerationRef(
	providerMetadata: unknown,
): CapturedGenerationRef | null {
	const vercelGenerationId = gatewayGenerationId(providerMetadata);

	if (vercelGenerationId) {
		return { generationId: vercelGenerationId, source: "vercel" };
	}

	if (!isRecord(providerMetadata)) {
		return null;
	}

	const openrouterMetadata = providerMetadata.openrouter;

	if (!isRecord(openrouterMetadata)) {
		return null;
	}

	const generationId = openrouterMetadata.generationId;

	return typeof generationId === "string" && generationId.length > 0
		? { generationId, source: "openrouter" }
		: null;
}

// Transient HTTP statuses: not-yet-metered (404), timeout/too-early/rate
// limit (408/425/429), and every 5xx. Contract-level 4xx (400/401/403/422)
// stays terminal.
const RETRYABLE_GATEWAY_STATUS_CODES = new Set([404, 408, 425, 429]);
// Node/undici network failure codes that never prove the generation is
// unbillable — the lookup simply did not reach the provider.
const RETRYABLE_NETWORK_ERROR_CODES = new Set([
	"ECONNRESET",
	"ECONNREFUSED",
	"ETIMEDOUT",
	"EAI_AGAIN",
	"EPIPE",
]);

export function isGatewayUsagePending(error: unknown): boolean {
	if (error instanceof GatewayUsagePendingError) {
		return true;
	}

	if (!isRecord(error)) {
		return false;
	}

	const statusCode = readStatusCode(error.statusCode ?? error.status);
	const message = typeof error.message === "string" ? error.message : "";

	// `retryable` lets a lookup gateway mark failures that must NOT
	// terminalize the event (e.g. the reconciler is deployed without the
	// OpenRouter key while openrouter-sourced refs are still outstanding)
	// without pretending to be a provider 404.
	return (
		error.retryable === true ||
		(statusCode !== null &&
			(RETRYABLE_GATEWAY_STATUS_CODES.has(statusCode) || statusCode >= 500)) ||
		isRetryableNetworkError(error) ||
		/usage event not found|no usage event found/iu.test(message)
	);
}

function readStatusCode(value: unknown): number | null {
	return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function isRetryableNetworkError(error: Record<string, unknown>): boolean {
	const code = error.code ?? (isRecord(error.cause) ? error.cause.code : null);

	if (
		typeof code === "string" &&
		(RETRYABLE_NETWORK_ERROR_CODES.has(code) || code.startsWith("UND_ERR_"))
	) {
		return true;
	}

	// fetch() wraps undici failures as `TypeError: fetch failed`; timeouts
	// surface as AbortError/TimeoutError. None of these prove billable state.
	const name = typeof error.name === "string" ? error.name : "";
	const message = typeof error.message === "string" ? error.message : "";

	return (
		name === "AbortError" ||
		name === "TimeoutError" ||
		/fetch failed/iu.test(message)
	);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
