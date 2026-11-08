/**
 * Removes internal AI details from browser messages and stream chunks.
 * Chat history and both stream relays call these functions before they send responses.
 * Shared contracts validate each field that the filter reads. Stored billing records stay unchanged.
 */
import {
	aiErrorDataSchema,
	DAILY_CAP_TURN_ERROR_CODE,
	generateImageHostToolOutputSchema,
	generatePageOutputSchema,
	type PublicAiMessageMetadata,
	type PublicAiResponsePart,
	publicAiMessageMetadataSchema,
	publicAiResponsePartSchema,
	turnDoneDataSchema,
	turnErrorDataSchema,
} from "@wandit/contracts";
import { env } from "@wandit/env/server";
import type { UIMessageChunk } from "ai";

/** Local development retains diagnostics; deployed responses omit internal model and routing fields. */
export function publicAiMetadata(
	metadata: unknown,
): PublicAiMessageMetadata | null {
	if (metadata === null || metadata === undefined) return null;
	const result = publicAiMessageMetadataSchema.safeParse(metadata);
	// Invalid legacy metadata has no usable request context and must not bypass the response filter.
	if (!result.success) return null;
	const parsed = result.data;
	// Model diagnostics belong only to local development, including historical responses.
	if (env.NODE_ENV === "development") return parsed;
	const {
		model,
		provider,
		gatewayGenerationId,
		rawFinishReason,
		...publicMetadata
	} = parsed;
	// Older dashboard rows store the composer fields directly in metadata.
	if (publicMetadata.options) {
		const { builderModel, builderReasoning, ...options } =
			publicMetadata.options;
		publicMetadata.options = options;
	}
	if (publicMetadata.composer?.options) {
		const { builderModel, builderReasoning, ...options } =
			publicMetadata.composer.options;
		publicMetadata.composer = { ...publicMetadata.composer, options };
	}
	return publicMetadata;
}

/** Filters saved parts and live chunks. Each live response keeps its own map of tool call names. */
export function publicAiPart(
	part: unknown,
	toolNames?: Map<string, string>,
): PublicAiResponsePart {
	const parsed = publicAiResponsePartSchema.parse(part);
	// Tool output chunks omit the name, so their preceding input chunk identifies system-owned output.
	if (parsed.toolCallId && parsed.toolName) {
		toolNames?.set(parsed.toolCallId, parsed.toolName);
	}
	const toolName =
		parsed.toolName ??
		(parsed.toolCallId ? toolNames?.get(parsed.toolCallId) : undefined);
	// Models and provider diagnostics must not reach production or staging clients.
	if (env.NODE_ENV === "development") return parsed;
	const {
		providerMetadata,
		callProviderMetadata,
		resultProviderMetadata,
		...publicPart
	} = parsed;
	if (publicPart.messageMetadata) {
		publicPart.messageMetadata =
			publicAiMetadata(publicPart.messageMetadata) ?? undefined;
	}
	if (publicPart.type === "data-turn-done") {
		const done = turnDoneDataSchema.parse(publicPart.data);
		publicPart.data = {
			...done,
			...(done.receipt
				? { receipt: { ...done.receipt, modelId: "wandit" } }
				: {}),
		};
	}
	if (publicPart.type === "data-ai-error") {
		const error = aiErrorDataSchema.parse(publicPart.data);
		// Connector account errors name the user's external integration, not our internal AI route.
		publicPart.data =
			error.kind.startsWith("connector_") || error.source === "higgsfield"
				? error
				: {
						...error,
						source: error.source === "ours" ? "ours" : "unknown",
						providerLabel: null,
						providerMessage: null,
						requestId: null,
					};
	}
	// Stored and live errors use stable public text, even when the stored message names a provider.
	if (publicPart.type === "data-turn-error") {
		const error = turnErrorDataSchema.parse(publicPart.data);
		let message = "The builder request failed. Please try again.";
		if (error.code === DAILY_CAP_TURN_ERROR_CODE) {
			message = "The daily usage limit was reached. Try again after 00:00 UTC.";
		} else if (error.code === "TURN_NOT_FOUND") {
			message = "The turn no longer exists";
		}
		publicPart.data = { ...error, message };
	}
	// Error details can name upstream models; the typed error part keeps retry and billing status.
	if (publicPart.errorText !== undefined)
		publicPart.errorText = "The request failed. Please try again.";
	if (
		publicPart.output !== undefined &&
		(publicPart.type === "tool-generate_page" || toolName === "generate_page")
	) {
		const { builderModel, ...output } = generatePageOutputSchema.parse(
			publicPart.output,
		);
		publicPart.output = output;
	}
	// Failed image tools can carry raw provider text; successful image files remain unchanged.
	if (
		publicPart.output !== undefined &&
		(publicPart.type === "tool-generate_image" || toolName === "generate_image")
	) {
		const output = generateImageHostToolOutputSchema.safeParse(
			publicPart.output,
		);
		if (output.success && output.data.status !== "generated") {
			publicPart.output = {
				...output.data,
				message: "Image generation failed. Please try again.",
			};
		}
	}
	return publicPart;
}

/** The filter runs after SDK persistence, so billing and admin records retain the original metadata. */
export function publicAiStream(
	stream: ReadableStream<UIMessageChunk>,
): ReadableStream<UIMessageChunk> {
	const tools = new Map<string, string>();
	return stream.pipeThrough(
		new TransformStream<UIMessageChunk, UIMessageChunk>({
			transform(chunk, controller) {
				const filtered = publicAiPart(chunk, tools);
				// SAFETY: the filter preserves chunk types and required SDK fields; it only changes optional diagnostics and tool output.
				controller.enqueue(filtered as UIMessageChunk);
			},
		}),
	);
}
