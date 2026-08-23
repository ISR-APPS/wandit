import type { aiProviderCallEvidence } from "@wandit/db/schema/credits";

export type AiProviderCallEvidence = typeof aiProviderCallEvidence.$inferSelect;
export type ProviderCallTransport = AiProviderCallEvidence["transport"];
export type ProviderCallCostStatus = AiProviderCallEvidence["costStatus"];

/** Input of one durable provider-call receipt. */
export type ProviderCallEvidenceInput = {
	chargedUsdMicros?: number | null;
	costSource?: string | null;
	costStatus: ProviderCallCostStatus;
	customerBillable: boolean;
	idempotencyKey: string;
	providerRequestId?: string | null;
	rateUsdMicrosPerUnit?: number | null;
	rawReceipt?: unknown;
	transport: ProviderCallTransport;
	unitKind: string;
	units: number;
};

/** Cost settlement of an existing evidence row. */
export type ProviderCallEvidenceCost = {
	chargedUsdMicros: number;
	costSource?: string | null;
	costStatus: Exclude<ProviderCallCostStatus, "pending">;
	rateUsdMicrosPerUnit?: number | null;
	rawReceipt?: unknown;
	/** Monotonic: a lower count than the stored one is ignored. */
	units?: number;
};

export function serperEvidenceKey(attemptId: string): string {
	return `serper:${attemptId}`;
}

export function higgsfieldEvidenceKey(
	referenceId: string,
	providerJobId: string | null,
): string {
	return `higgsfield:${referenceId}:${providerJobId ?? "submit"}`;
}

export function mcpEvidenceKey(
	referenceId: string,
	providerJobId: string | null,
): string {
	return `mcp:${referenceId}:${providerJobId ?? "submit"}`;
}

// Cost knowledge only improves: a preflight may refine a pending row and a
// provider receipt may overwrite both; a confirmed charge is never degraded.
const COST_STATUS_RANK: Record<ProviderCallCostStatus, number> = {
	contract_rate: 2,
	estimated: 1,
	measured: 3,
	pending: 0,
};

export function canUpgradeProviderCallCostStatus(
	current: ProviderCallCostStatus,
	next: ProviderCallCostStatus,
): boolean {
	return COST_STATUS_RANK[next] >= COST_STATUS_RANK[current];
}

export function assertProviderCallEvidenceInput(
	input: ProviderCallEvidenceInput,
): void {
	if (!Number.isSafeInteger(input.units) || input.units <= 0) {
		throw new Error("Provider call evidence units must be a positive integer");
	}

	assertOptionalUsdMicros(input.chargedUsdMicros, "charged cost");
	assertOptionalUsdMicros(input.rateUsdMicrosPerUnit, "unit rate");

	if (input.costStatus !== "pending" && input.chargedUsdMicros == null) {
		throw new Error(
			`Provider call evidence with status ${input.costStatus} needs a charged cost`,
		);
	}

	if (input.idempotencyKey.trim().length === 0) {
		throw new Error("Provider call evidence needs an idempotency key");
	}
}

export function assertProviderCallEvidenceCost(
	cost: ProviderCallEvidenceCost,
): void {
	assertOptionalUsdMicros(cost.chargedUsdMicros, "charged cost");
	assertOptionalUsdMicros(cost.rateUsdMicrosPerUnit, "unit rate");

	if (
		cost.units !== undefined &&
		(!Number.isSafeInteger(cost.units) || cost.units <= 0)
	) {
		throw new Error("Provider call evidence units must be a positive integer");
	}
}

function assertOptionalUsdMicros(
	value: number | null | undefined,
	label: string,
): void {
	if (value != null && (!Number.isSafeInteger(value) || value < 0)) {
		throw new Error(
			`Provider call evidence ${label} must be a non-negative integer`,
		);
	}
}

/** Sum of the known (non-pending) charges, optionally customer-billable only. */
export function sumProviderCallEvidenceUsdMicros(
	evidence: readonly Pick<
		AiProviderCallEvidence,
		"chargedUsdMicros" | "customerBillable"
	>[],
	options: { customerBillableOnly?: boolean } = {},
): number {
	let total = 0;

	for (const row of evidence) {
		if (options.customerBillableOnly && !row.customerBillable) {
			continue;
		}

		total += row.chargedUsdMicros ?? 0;
	}

	return total;
}
