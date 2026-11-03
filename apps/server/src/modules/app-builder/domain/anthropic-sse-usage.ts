/**
 * Reads token usage out of Anthropic Messages API traffic. When the caller
 * asks, it also rebuilds the assistant answer for Langfuse.
 * `LlmProxyService` feeds the streamed copy of an upstream response into
 * the SSE parser, or passes a JSON response body to `usageFromAnthropicJson`
 * and `messageFromAnthropicJson`. The counts feed `llm_proxy_requests` rows
 * and the price math.
 */
import { z } from "zod";

/** Token counts from one Anthropic response, all in whole tokens. */
export type LlmTokenUsage = {
	inputTokens: number;
	outputTokens: number;
	// Cache-read input tokens; billed at the lower cache-read rate.
	cacheReadTokens: number;
	// Cache-creation input tokens; billed at the 1-hour cache-write rate.
	cacheWriteTokens: number;
};

// `usage` as Anthropic reports it: `message_start` carries input and cache
// counts, `message_delta` carries cumulative output.
const anthropicUsageFieldsSchema = z.object({
	input_tokens: z.int().nonnegative().optional(),
	output_tokens: z.int().nonnegative().optional(),
	cache_creation_input_tokens: z.int().nonnegative().optional(),
	cache_read_input_tokens: z.int().nonnegative().optional(),
});

// The JSON inside one SSE `data:` line; other event types are ignored.
// A gateway (Vercel AI Gateway) reports zero input in `message_start`, the
// real input count in `message_delta.usage`, and the cache counts under
// `provider_metadata.anthropic.usage`.
const anthropicSseEventSchema = z.object({
	type: z.string(),
	message: z.object({ usage: anthropicUsageFieldsSchema }).optional(),
	usage: anthropicUsageFieldsSchema.optional(),
	provider_metadata: z
		.object({
			anthropic: z.object({ usage: anthropicUsageFieldsSchema }).optional(),
		})
		.optional(),
});

// A JSON (non-streamed) Messages response, or a `count_tokens` answer that
// reports token counts at the top level.
const anthropicJsonBodySchema = z.object({
	usage: anthropicUsageFieldsSchema.optional(),
	input_tokens: z.int().nonnegative().optional(),
	cache_creation_input_tokens: z.int().nonnegative().optional(),
	cache_read_input_tokens: z.int().nonnegative().optional(),
});

function usageFromFields(
	fields: z.infer<typeof anthropicUsageFieldsSchema> | undefined,
): LlmTokenUsage {
	return {
		inputTokens: fields?.input_tokens ?? 0,
		outputTokens: fields?.output_tokens ?? 0,
		cacheReadTokens: fields?.cache_read_input_tokens ?? 0,
		cacheWriteTokens: fields?.cache_creation_input_tokens ?? 0,
	};
}

// Any JSON value: the input of a tool call.
const jsonValueSchema = z.json();

// One block of an answer. A gateway can start a block without its empty
// text or input, so those fields default. A `redacted_thinking` block
// loses its encrypted `data`: a reader cannot use it.
const anthropicOutputBlockSchema = z.discriminatedUnion("type", [
	z.object({ type: z.literal("text"), text: z.string().default("") }),
	z.object({ type: z.literal("thinking"), thinking: z.string().default("") }),
	z.object({ type: z.literal("redacted_thinking") }),
	z.object({
		type: z.literal(["tool_use", "server_tool_use"]),
		id: z.string(),
		name: z.string(),
		input: jsonValueSchema.default({}),
	}),
]);

/** One block of an assistant answer, as Langfuse shows it. The parser drops unknown block types. */
export type AnthropicOutputBlock = z.infer<typeof anthropicOutputBlockSchema>;

/** The assistant answer rebuilt from one Messages response. Langfuse shows it as the output. */
export type AnthropicAssistantMessage = {
	/** `msg_...` id from the upstream; null when it never arrived. */
	id: string | null;
	/** Model the upstream says answered. A gateway fallback can make it differ from the row model. */
	model: string | null;
	/** The blocks in arrival order. */
	content: AnthropicOutputBlock[];
	/** `end_turn`, `tool_use`, `max_tokens`...; null when the answer stopped early. */
	stopReason: string | null;
	/** In-stream `error` event as "<type>: <message>". The row still says `ok`. */
	streamError: string | null;
	/** Epoch ms of the first content delta; null for a JSON answer. */
	firstTokenAt: number | null;
};

// The SSE events that carry the answer. Other events (`ping`,
// `content_block_stop`, `message_stop`) and other delta types
// (`signature_delta`, `citations_delta`) do not match, so the assembler skips them.
const anthropicContentEventSchema = z.discriminatedUnion("type", [
	z.object({
		type: z.literal("message_start"),
		message: z.object({
			id: z.string().optional(),
			model: z.string().optional(),
		}),
	}),
	z.object({
		type: z.literal("content_block_start"),
		index: z.int().nonnegative(),
		content_block: anthropicOutputBlockSchema,
	}),
	z.object({
		type: z.literal("content_block_delta"),
		index: z.int().nonnegative(),
		delta: z.discriminatedUnion("type", [
			z.object({ type: z.literal("text_delta"), text: z.string() }),
			z.object({ type: z.literal("thinking_delta"), thinking: z.string() }),
			z.object({
				type: z.literal("input_json_delta"),
				partial_json: z.string(),
			}),
		]),
	}),
	z.object({
		type: z.literal("message_delta"),
		delta: z.object({ stop_reason: z.string().nullable().optional() }),
	}),
	z.object({
		type: z.literal("error"),
		error: z.object({ type: z.string(), message: z.string() }),
	}),
]);

// A JSON (non-streamed) Messages answer. An unknown block type, for
// example `web_search_tool_result`, drops only that block.
const anthropicJsonMessageSchema = z.object({
	id: z.string().optional(),
	model: z.string().optional(),
	content: z.array(anthropicOutputBlockSchema.nullable().catch(null)),
	stop_reason: z.string().nullable().optional(),
});

// The parsed value, or undefined when it does not match. No schema here
// gives undefined as a valid value, so undefined always means "no match".
function parseOrUndefined<T extends z.ZodType>(
	schema: T,
	value: unknown,
): z.output<T> | undefined {
	try {
		const parsed = schema.safeParse(value);
		return parsed.success ? parsed.data : undefined;
	} catch {
		// z.json() walks a tool input by recursion. The model can write an input
		// nested a few thousand levels deep. The walk then throws a RangeError
		// out of safeParse. The answer only feeds Langfuse, so this value counts
		// as no match, and the relay and the billed row continue.
		return undefined;
	}
}

// The joined `partial_json` pieces of one tool call.
function parseToolInput(json: string): z.infer<typeof jsonValueSchema> {
	let value: unknown;
	try {
		value = JSON.parse(json);
	} catch {
		// A cut stream (an abort) leaves invalid JSON. The raw text still
		// shows the reader what the model wrote.
		return json;
	}
	const input = parseOrUndefined(jsonValueSchema, value);
	return input === undefined ? json : input;
}

// Rebuilds the answer one SSE event at a time. It catches each JSON parse
// and each zod walk. It skips a bad event and keeps a bad tool input as raw text.
function createMessageAssembler(): {
	apply: (event: unknown) => void;
	message: () => AnthropicAssistantMessage;
} {
	let id: string | null = null;
	let model: string | null = null;
	let stopReason: string | null = null;
	let streamError: string | null = null;
	let firstTokenAt: number | null = null;
	// Keyed by the event `index`. A Map, not an array: a large untrusted
	// index cannot make a huge sparse array.
	const blocks = new Map<
		number,
		{ block: AnthropicOutputBlock; toolInputJson: string }
	>();

	return {
		apply(event: unknown): void {
			const data = parseOrUndefined(anthropicContentEventSchema, event);
			if (data === undefined) {
				return;
			}
			if (data.type === "message_start") {
				id = data.message.id ?? null;
				model = data.message.model ?? null;
			} else if (data.type === "content_block_start") {
				blocks.set(data.index, {
					block: data.content_block,
					toolInputJson: "",
				});
			} else if (data.type === "content_block_delta") {
				const entry = blocks.get(data.index);
				const { delta } = data;
				if (entry?.block.type === "text" && delta.type === "text_delta") {
					entry.block.text += delta.text;
				} else if (
					entry?.block.type === "thinking" &&
					delta.type === "thinking_delta"
				) {
					entry.block.thinking += delta.thinking;
				} else if (
					(entry?.block.type === "tool_use" ||
						entry?.block.type === "server_tool_use") &&
					delta.type === "input_json_delta"
				) {
					entry.toolInputJson += delta.partial_json;
				} else {
					// An unknown index, or a delta for a block of another type.
					return;
				}
				firstTokenAt ??= Date.now();
			} else if (data.type === "message_delta") {
				stopReason = data.delta.stop_reason ?? stopReason;
			} else {
				streamError = `${data.error.type}: ${data.error.message}`;
			}
		},
		message(): AnthropicAssistantMessage {
			const content = [...blocks.values()].map(({ block, toolInputJson }) =>
				(block.type === "tool_use" || block.type === "server_tool_use") &&
				toolInputJson !== ""
					? { ...block, input: parseToolInput(toolInputJson) }
					: block,
			);
			return { id, model, content, stopReason, streamError, firstTokenAt };
		},
	};
}

/**
 * Incremental parser for an Anthropic `text/event-stream` response. Feed
 * decoded text chunks; `usage()` returns the counts seen so far, so a
 * client abort still leaves a partial row. With `collectContent`, it also
 * rebuilds the answer for Langfuse.
 */
export function createAnthropicSseUsageParser(
	options: { collectContent: boolean } = { collectContent: false },
): {
	feed: (chunk: string) => void;
	usage: () => LlmTokenUsage;
	/** The answer so far; null when `collectContent` is false. A tool input that does not parse stays raw text. */
	message: () => AnthropicAssistantMessage | null;
} {
	let buffer = "";
	let usage: LlmTokenUsage = {
		inputTokens: 0,
		outputTokens: 0,
		cacheReadTokens: 0,
		cacheWriteTokens: 0,
	};
	// Null without `collectContent`: the relay then does no content work.
	const content = options.collectContent ? createMessageAssembler() : null;

	function applyEvent(dataText: string): void {
		let json: unknown;
		try {
			json = JSON.parse(dataText);
		} catch {
			// A malformed frame skips to the next event; the client copy of the
			// stream is unaffected and later events still parse.
			return;
		}
		const result = anthropicSseEventSchema.safeParse(json);
		if (result.success) {
			applyUsage(result.data);
		}
		// After usage, and `apply` catches its parse errors: the content step
		// cannot change the billed counts or stop the relay.
		content?.apply(json);
	}

	function applyUsage(parsed: z.infer<typeof anthropicSseEventSchema>): void {
		if (parsed.type === "message_start" && parsed.message !== undefined) {
			const start = usageFromFields(parsed.message.usage);
			usage = {
				...usage,
				inputTokens: start.inputTokens,
				cacheReadTokens: start.cacheReadTokens,
				cacheWriteTokens: start.cacheWriteTokens,
			};
		}
		if (parsed.type === "message_delta" && parsed.usage !== undefined) {
			// `output_tokens` is cumulative; the last delta wins. A delta that
			// carries input or cache counts (a gateway) also wins over the
			// zeros of its `message_start`.
			const cache = parsed.provider_metadata?.anthropic?.usage;
			usage = {
				inputTokens: parsed.usage.input_tokens ?? usage.inputTokens,
				outputTokens: parsed.usage.output_tokens ?? 0,
				cacheReadTokens:
					cache?.cache_read_input_tokens ??
					parsed.usage.cache_read_input_tokens ??
					usage.cacheReadTokens,
				cacheWriteTokens:
					cache?.cache_creation_input_tokens ??
					parsed.usage.cache_creation_input_tokens ??
					usage.cacheWriteTokens,
			};
		}
	}

	return {
		feed(chunk: string): void {
			buffer += chunk;
			const frames = buffer.split("\n\n");
			// The last piece is incomplete until the next chunk or the end.
			buffer = frames.pop() ?? "";
			for (const frame of frames) {
				const data = frame
					.split("\n")
					.filter((line) => line.startsWith("data:"))
					.map((line) => line.slice("data:".length).trimStart())
					.join("\n");
				if (data.length > 0) {
					applyEvent(data);
				}
			}
		},
		usage(): LlmTokenUsage {
			return usage;
		},
		message(): AnthropicAssistantMessage | null {
			return content?.message() ?? null;
		},
	};
}

/**
 * The answer of a JSON (non-streamed) Messages body, for Langfuse. Returns
 * null for any other body, for example a `count_tokens` answer, and for a
 * tool input too deep for the zod walk.
 */
export function messageFromAnthropicJson(
	body: unknown,
): AnthropicAssistantMessage | null {
	const data = parseOrUndefined(anthropicJsonMessageSchema, body);
	if (data === undefined) {
		return null;
	}
	return {
		id: data.id ?? null,
		model: data.model ?? null,
		content: data.content.filter((block) => block !== null),
		stopReason: data.stop_reason ?? null,
		streamError: null,
		firstTokenAt: null,
	};
}

/**
 * Reads usage from a JSON Messages API response body. Also reads the
 * top-level `input_tokens` of a `count_tokens` answer. Unknown bodies
 * return zero counts — a missing field is never a proxy error.
 */
export function usageFromAnthropicJson(body: unknown): LlmTokenUsage {
	const parsed = anthropicJsonBodySchema.safeParse(body);
	if (!parsed.success) {
		return {
			inputTokens: 0,
			outputTokens: 0,
			cacheReadTokens: 0,
			cacheWriteTokens: 0,
		};
	}
	const usage = usageFromFields(parsed.data.usage);
	return {
		...usage,
		// `count_tokens` reports input counts at the top level, not in `usage`.
		inputTokens: usage.inputTokens + (parsed.data.input_tokens ?? 0),
		cacheReadTokens:
			usage.cacheReadTokens + (parsed.data.cache_read_input_tokens ?? 0),
		cacheWriteTokens:
			usage.cacheWriteTokens + (parsed.data.cache_creation_input_tokens ?? 0),
	};
}
