import { randomUUID } from "node:crypto";

import type { CapturedGeneration } from "../../metering/domain/metering";
import { gatewayGenerationId } from "../../metering/domain/metering";

export type ConnectorGenerationPlan = {
	childOperation?: "image" | "video";
	childUnits?: number;
};

const CONNECTOR_ONLY_GENERATION_TOOLS = new Set([
	"dubbing",
	"generate_3d",
	"generate_audio",
	"voice_change",
]);

export const IMAGE_GENERATION_TOOLS: ReadonlySet<string> = new Set([
	"generate_image",
	"outpaint_image",
	"remove_background",
	"upscale_image",
]);

export const VIDEO_GENERATION_TOOLS: ReadonlySet<string> = new Set([
	"animation_actions",
	"generate_video",
	"motion_control",
	"reframe",
	"upscale_video",
]);

const IMAGE_COUNT_KEYS = [
	"count",
	"image_count",
	"num_images",
	"num_outputs",
	"number_of_images",
] as const;

/**
 * Connectors whose catalog contains paid provider work. An unregistered tool
 * on one of these fails CLOSED: it runs as a connector-billed event (1 cc
 * hold that settles at zero, tracked and idempotent) instead of escaping
 * metering entirely. Non-monetized connectors keep the open default.
 */
export const MONETIZED_CONNECTORS: ReadonlySet<string> = new Set([
	"higgsfield",
]);

/** Known no-cost tools on monetized connectors: reads, status, auth, search. */
export const FREE_CONNECTOR_TOOLS: ReadonlySet<string> = new Set([
	"get_cost",
	"job_display",
	"job_status",
	"list_voices",
	"media_confirm",
	"media_import_url",
	"media_upload",
	"media_upload_widget",
	"models_explore",
	"select_workspace",
	"show_generations",
	// Marketing Studio browsing and video analysis run inline on the user's
	// own Higgsfield subscription: no Wandit-metered media is produced.
	"show_marketing_studio",
	"tiktok_accounts",
	"tiktok_connect",
	"tiktok_music_trending",
	"tiktok_music_tune",
	"tiktok_prepare_publish",
	"tiktok_publish_status",
	"tiktok_reconnect",
	"video_analysis_create",
	"video_analysis_jobs",
	"video_analysis_status",
	"whoami",
]);

const FREE_TOOL_PREFIXES = ["get_", "list_", "search_", "describe_", "read_"];

export function isFreeConnectorTool(toolName: string): boolean {
	const normalized = normalizeConnectorToolName(toolName);

	return (
		FREE_CONNECTOR_TOOLS.has(normalized) ||
		FREE_TOOL_PREFIXES.some((prefix) => normalized.startsWith(prefix)) ||
		/(^|_)(status|health|auth|login|logout)$/u.test(normalized)
	);
}

/**
 * Product-owned classification for MCP operations that create or transform
 * media. Ordinary connector reads/writes are intentionally not billable;
 * on a monetized connector an unknown tool is connector-billed (fail closed).
 */
export function connectorGenerationPlan(
	toolName: string,
	input: unknown,
	connectorSlug?: string,
): ConnectorGenerationPlan | null {
	const normalized = normalizeConnectorToolName(toolName);

	if (CONNECTOR_ONLY_GENERATION_TOOLS.has(normalized)) {
		return {};
	}

	if (IMAGE_GENERATION_TOOLS.has(normalized)) {
		return {
			childOperation: "image",
			childUnits: requestedImageCount(input),
		};
	}

	if (VIDEO_GENERATION_TOOLS.has(normalized)) {
		return { childOperation: "video", childUnits: 1 };
	}

	if (isFreeConnectorTool(normalized)) {
		return null;
	}

	// Recovery callers replay rows that were planned at queue time and pass
	// no slug; the fail-closed default applies to live tool execution only.
	if (connectorSlug !== undefined && MONETIZED_CONNECTORS.has(connectorSlug)) {
		return {};
	}

	return null;
}

/** Evidence transport for a connector's provider receipts. */
export function connectorEvidenceTransport(
	connectorSlug: string,
): "higgsfield" | "mcp" {
	return connectorSlug === "higgsfield" ? "higgsfield" : "mcp";
}

// Same strictness as the task's unlim_choice check: an echoed preset/request
// id in a question receipt must not read as an accepted job.
const PROVIDER_JOB_ID_KEY_PATTERN =
	/^(?:job_set|jobset|job|generation|task)_?ids?$/i;

/**
 * Provider job id from a submit receipt (Higgsfield job_set_id, job_id, …),
 * walking nested objects and JSON-stringified content blocks. Null when the
 * receipt exposes nothing job-like — the provider accepted no work.
 */
export function connectorProviderJobId(value: unknown): string | null {
	const seen = new WeakSet<object>();

	const visit = (candidate: unknown): string | null => {
		if (typeof candidate === "string") {
			const parsed = tryParseJson(candidate);
			return parsed === null ? null : visit(parsed);
		}

		if (
			candidate === null ||
			typeof candidate !== "object" ||
			seen.has(candidate)
		) {
			return null;
		}
		seen.add(candidate);

		if (Array.isArray(candidate)) {
			for (const item of candidate) {
				const found = visit(item);
				if (found) {
					return found;
				}
			}
			return null;
		}

		for (const [key, nested] of Object.entries(candidate)) {
			if (
				typeof nested === "string" &&
				nested.length > 0 &&
				PROVIDER_JOB_ID_KEY_PATTERN.test(key)
			) {
				return nested;
			}
		}

		for (const nested of Object.values(candidate)) {
			const found = visit(nested);
			if (found) {
				return found;
			}
		}

		return null;
	};

	return visit(value);
}

/** Receipt preview bounded for jsonb storage (strings truncated). */
export function sanitizeProviderReceipt(value: unknown, maxChars = 4_000) {
	try {
		const serialized = JSON.stringify(value) ?? "null";

		return serialized.length <= maxChars
			? JSON.parse(serialized)
			: { truncated: true, preview: serialized.slice(0, maxChars) };
	} catch {
		return { preview: String(value).slice(0, maxChars), truncated: true };
	}
}

/** A replay-stable reference whenever AI SDK supplies its stable tool-call id. */
export function connectorGenerationReference(input: {
	connectorSlug: string;
	parentEventId?: string;
	toolCallId?: string;
	toolName: string;
	userId: string;
}): string {
	const toolCallId = input.toolCallId?.trim() || randomUUID();

	return [
		"mcp",
		input.userId,
		input.parentEventId ?? "root",
		input.connectorSlug,
		normalizeConnectorToolName(input.toolName),
		toolCallId,
	].join(":");
}

/**
 * MCP payloads frequently JSON-stringify provider results inside content
 * blocks. Walk both objects and JSON text so no Gateway generation id is
 * lost when a connector happens to proxy an AI Gateway-backed operation.
 */
export function connectorGatewayCaptures(value: unknown): CapturedGeneration[] {
	const captures = new Map<string, CapturedGeneration>();
	const seen = new WeakSet<object>();

	const visit = (candidate: unknown): void => {
		if (typeof candidate === "string") {
			const parsed = tryParseJson(candidate);
			if (parsed !== null) {
				visit(parsed);
			}
			return;
		}

		if (
			candidate === null ||
			typeof candidate !== "object" ||
			seen.has(candidate)
		) {
			return;
		}
		seen.add(candidate);

		const generationId = gatewayGenerationId(candidate);
		if (generationId && !captures.has(generationId)) {
			captures.set(generationId, { providerMetadata: candidate });
		}

		if (Array.isArray(candidate)) {
			for (const item of candidate) {
				visit(item);
			}
			return;
		}

		for (const nested of Object.values(candidate)) {
			visit(nested);
		}
	};

	visit(value);
	return [...captures.values()];
}

export function normalizeConnectorToolName(toolName: string): string {
	return toolName
		.replace(/([a-z0-9])([A-Z])/g, "$1_$2")
		.replace(/[^A-Za-z0-9]+/g, "_")
		.replace(/^_+|_+$/g, "")
		.toLowerCase();
}

function requestedImageCount(input: unknown): number {
	const record = asRecord(input);
	if (!record) {
		return 1;
	}

	// Higgsfield nests the real arguments one level down as `params` (object
	// or JSON string) — a top-level-only read under-bills every multi-image
	// request as 1 unit.
	const params = asRecord(record.params) ?? parseJsonObject(record.params);
	for (const candidate of [params, record]) {
		if (!candidate) {
			continue;
		}

		for (const key of IMAGE_COUNT_KEYS) {
			const count = candidate[key];
			if (
				typeof count === "number" &&
				Number.isSafeInteger(count) &&
				count > 0
			) {
				return count;
			}
		}
	}

	return 1;
}

function asRecord(value: unknown): Record<string, unknown> | null {
	return value !== null && typeof value === "object" && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: null;
}

function parseJsonObject(value: unknown): Record<string, unknown> | null {
	return typeof value === "string" ? asRecord(tryParseJson(value)) : null;
}

function tryParseJson(value: string): unknown | null {
	const trimmed = value.trim();
	if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
		return null;
	}

	try {
		return JSON.parse(trimmed);
	} catch {
		return null;
	}
}
