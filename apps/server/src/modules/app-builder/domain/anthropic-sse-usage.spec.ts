import { describe, expect, it } from "vitest";

import {
	createAnthropicSseUsageParser,
	usageFromAnthropicJson,
} from "./anthropic-sse-usage";

// A canned Anthropic stream in the documented format: message_start carries
// input and cache counts, message_delta carries cumulative output.
const CANNED_STREAM = [
	'event: message_start\ndata: {"type":"message_start","message":{"id":"msg_1","usage":{"input_tokens":120,"cache_creation_input_tokens":40,"cache_read_input_tokens":30}}}\n\n',
	'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hi"}}\n\n',
	'event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":17}}\n\n',
	'event: message_stop\ndata: {"type":"message_stop"}\n\n',
].join("");

describe("createAnthropicSseUsageParser", () => {
	it("reads input, cache, and output tokens from a full stream", () => {
		const parser = createAnthropicSseUsageParser();
		parser.feed(CANNED_STREAM);

		expect(parser.usage()).toEqual({
			inputTokens: 120,
			outputTokens: 17,
			cacheReadTokens: 30,
			cacheWriteTokens: 40,
		});
	});

	it("reads the gateway counts from message_delta and provider_metadata", () => {
		// Vercel AI Gateway: zero input in message_start, real counts later.
		const parser = createAnthropicSseUsageParser();
		parser.feed(
			`event: message_start\ndata: {"type":"message_start","message":{"usage":{"input_tokens":0,"output_tokens":0}}}\n\n` +
				`event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"input_tokens":10,"output_tokens":5},"provider_metadata":{"anthropic":{"usage":{"input_tokens":10,"cache_creation_input_tokens":3,"cache_read_input_tokens":7}}}}\n\n`,
		);

		expect(parser.usage()).toEqual({
			cacheReadTokens: 7,
			cacheWriteTokens: 3,
			inputTokens: 10,
			outputTokens: 5,
		});
	});

	it("parses events split across chunk boundaries", () => {
		const parser = createAnthropicSseUsageParser();
		const mid = Math.floor(CANNED_STREAM.length / 2);
		parser.feed(CANNED_STREAM.slice(0, mid));
		parser.feed(CANNED_STREAM.slice(mid));

		expect(parser.usage()).toEqual({
			inputTokens: 120,
			outputTokens: 17,
			cacheReadTokens: 30,
			cacheWriteTokens: 40,
		});
	});

	it("keeps partial counts when the stream stops early", () => {
		const parser = createAnthropicSseUsageParser();
		// Only message_start arrived: a client abort mid-stream.
		parser.feed(CANNED_STREAM.split("event: content_block_delta")[0] ?? "");

		expect(parser.usage()).toEqual({
			inputTokens: 120,
			outputTokens: 0,
			cacheReadTokens: 30,
			cacheWriteTokens: 40,
		});
	});

	it("ignores malformed frames without losing later events", () => {
		const parser = createAnthropicSseUsageParser();
		parser.feed("event: ping\ndata: not-json\n\n");
		parser.feed(
			'event: message_delta\ndata: {"type":"message_delta","usage":{"output_tokens":9}}\n\n',
		);

		expect(parser.usage().outputTokens).toBe(9);
	});
});

describe("usageFromAnthropicJson", () => {
	it("reads the usage object of a Messages response", () => {
		const usage = usageFromAnthropicJson({
			id: "msg_1",
			usage: {
				input_tokens: 10,
				output_tokens: 5,
				cache_creation_input_tokens: 2,
				cache_read_input_tokens: 3,
			},
		});

		expect(usage).toEqual({
			inputTokens: 10,
			outputTokens: 5,
			cacheReadTokens: 3,
			cacheWriteTokens: 2,
		});
	});

	it("reads top-level counts of a count_tokens answer", () => {
		const usage = usageFromAnthropicJson({
			input_tokens: 42,
			cache_creation_input_tokens: 4,
			cache_read_input_tokens: 6,
		});

		expect(usage.inputTokens).toBe(42);
		expect(usage.cacheWriteTokens).toBe(4);
		expect(usage.cacheReadTokens).toBe(6);
	});

	it("returns zeros for an unknown body", () => {
		expect(usageFromAnthropicJson(undefined)).toEqual({
			inputTokens: 0,
			outputTokens: 0,
			cacheReadTokens: 0,
			cacheWriteTokens: 0,
		});
	});
});
