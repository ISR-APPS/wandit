/**
 * Reads token usage out of Anthropic Messages API traffic.
 * `LlmProxyService` feeds the streamed copy of an upstream response into
 * the SSE parser, or passes a JSON response body to `usageFromAnthropicJson`.
 * The counts feed `llm_proxy_requests` rows and the price math.
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

/**
 * Incremental parser for an Anthropic `text/event-stream` response. Feed
 * decoded text chunks; `usage()` returns the counts seen so far, so a
 * client abort still leaves a partial row.
 */
export function createAnthropicSseUsageParser(): {
	feed: (chunk: string) => void;
	usage: () => LlmTokenUsage;
} {
	let buffer = "";
	let usage: LlmTokenUsage = {
		inputTokens: 0,
		outputTokens: 0,
		cacheReadTokens: 0,
		cacheWriteTokens: 0,
	};

	function applyEvent(dataText: string): void {
		let parsed: z.infer<typeof anthropicSseEventSchema>;
		try {
			const result = anthropicSseEventSchema.safeParse(JSON.parse(dataText));
			if (!result.success) {
				return;
			}
			parsed = result.data;
		} catch {
			// A malformed frame skips to the next event; the client copy of the
			// stream is unaffected and later events still parse.
			return;
		}

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
