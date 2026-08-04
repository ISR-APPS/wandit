export type AnalyticsCapture = {
	capture(
		distinctId: string,
		event: string,
		properties?: Record<string, unknown>,
	): void;
};

export type GenerationKind =
	| "animation"
	| "connector"
	| "image"
	| "marketing_asset"
	| "page";

export function captureGenerationCompleted(
	analytics: AnalyticsCapture,
	distinctId: string,
	kind: GenerationKind,
	projectId: string | null,
	generationId: string,
): void {
	analytics.capture(distinctId, "generation_completed", {
		generationId,
		kind,
		projectId,
	});
}

export function captureGenerationFailed(
	analytics: AnalyticsCapture,
	distinctId: string,
	kind: GenerationKind,
	projectId: string | null,
	generationId: string,
	reason: string,
): void {
	analytics.capture(distinctId, "generation_failed", {
		generationId,
		kind,
		projectId,
		reason,
	});
}

export function machineFailureReason(error: unknown): string {
	const name = error instanceof Error ? error.name : "unknown_error";
	const normalizedName = name
		.replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
		.replace(/([a-z0-9])([A-Z])/g, "$1_$2")
		.replace(/[^a-zA-Z0-9]+/g, "_")
		.replace(/^_+|_+$/g, "")
		.toLowerCase()
		.slice(0, 64);
	const status = readErrorStatus(error);

	return status
		? `${normalizedName || "unknown_error"}_${status}`
		: normalizedName || "unknown_error";
}

function readErrorStatus(error: unknown): string | null {
	if (typeof error !== "object" || error === null) {
		return null;
	}

	const candidate = error as { status?: unknown; statusCode?: unknown };
	const status = candidate.status ?? candidate.statusCode;

	if (typeof status === "number" && Number.isInteger(status)) {
		return String(status).slice(0, 3);
	}

	if (typeof status === "string" && /^\d{3}$/.test(status)) {
		return status;
	}

	return null;
}
