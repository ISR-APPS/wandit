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
 * Product-owned classification for MCP operations that create or transform
 * media. Ordinary connector reads/writes are intentionally not billable.
 */
export function connectorGenerationPlan(
	toolName: string,
	input: unknown,
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

	return null;
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
