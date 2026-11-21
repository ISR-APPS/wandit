import { describe, expect, it } from "vitest";

import {
	createAnthropicSseUsageParser,
	gatewayCostFromAnthropicJson,
	messageFromAnthropicJson,
	usageFromAnthropicJson,
} from "./anthropic-sse-usage";

// One SSE frame around a JSON `data:` line.
function sseFrame(data: string): string {
	return `data: ${data}\n\n`;
}

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
			cacheWrite5mTokens: 0,
		});
	});

	it("reads the gateway counts and the cache TTL split from message_delta and provider_metadata", () => {
		// Vercel AI Gateway: zero input in message_start, real counts later.
		// The split shape is from a live gateway probe (2026-11-19).
		const parser = createAnthropicSseUsageParser();
		parser.feed(
			`event: message_start\ndata: {"type":"message_start","message":{"usage":{"input_tokens":0,"output_tokens":0}}}\n\n` +
				`event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"input_tokens":10,"output_tokens":5},"provider_metadata":{"anthropic":{"usage":{"input_tokens":10,"cache_creation_input_tokens":3,"cache_read_input_tokens":7,"cache_creation":{"ephemeral_5m_input_tokens":2,"ephemeral_1h_input_tokens":1}}}}}\n\n`,
		);

		expect(parser.usage()).toEqual({
			cacheReadTokens: 7,
			cacheWriteTokens: 3,
			cacheWrite5mTokens: 2,
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
			cacheWrite5mTokens: 0,
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
			cacheWrite5mTokens: 0,
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

	it("rebuilds thinking, text and tool_use blocks from a stream cut into 7-char chunks", () => {
		const stream = [
			'{"type":"message_start","message":{"id":"msg_2","model":"deepseek/deepseek-v4.1-flash","usage":{"input_tokens":5}}}',
			'{"type":"content_block_start","index":0,"content_block":{"type":"thinking","thinking":""}}',
			'{"type":"content_block_delta","index":0,"delta":{"type":"thinking_delta","thinking":"Plan"}}',
			'{"type":"content_block_delta","index":0,"delta":{"type":"thinking_delta","thinking":" it"}}',
			'{"type":"content_block_delta","index":0,"delta":{"type":"signature_delta","signature":"c2ln"}}',
			'{"type":"content_block_start","index":1,"content_block":{"type":"text","text":""}}',
			'{"type":"content_block_delta","index":1,"delta":{"type":"text_delta","text":"Reading"}}',
			'{"type":"content_block_start","index":2,"content_block":{"type":"tool_use","id":"tu_1","name":"Read","input":{}}}',
			'{"type":"content_block_delta","index":2,"delta":{"type":"input_json_delta","partial_json":"{\\"file_path\\":"}}',
			'{"type":"content_block_delta","index":2,"delta":{"type":"input_json_delta","partial_json":"\\"a.ts\\"}"}}',
			'{"type":"message_delta","delta":{"stop_reason":"tool_use"},"usage":{"output_tokens":9}}',
			'{"type":"message_stop"}',
		]
			.map(sseFrame)
			.join("");
		const parser = createAnthropicSseUsageParser({ collectContent: true });
		for (let start = 0; start < stream.length; start += 7) {
			parser.feed(stream.slice(start, start + 7));
		}

		expect(parser.message()).toMatchObject({
			content: [
				{ type: "thinking", thinking: "Plan it" },
				{ type: "text", text: "Reading" },
				{
					type: "tool_use",
					id: "tu_1",
					name: "Read",
					input: { file_path: "a.ts" },
				},
			],
			stopReason: "tool_use",
			firstTokenAt: expect.any(Number),
		});
		// Content collection leaves the billed counts as they are.
		expect(parser.usage().outputTokens).toBe(9);
	});

	it("keeps a cut tool input as raw text and records an in-stream error", () => {
		const parser = createAnthropicSseUsageParser({ collectContent: true });
		parser.feed(
			[
				'{"type":"content_block_start","index":0,"content_block":{"type":"tool_use","id":"tu_1","name":"Read","input":{}}}',
				'{"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":"{\\"file_path\\":\\"a"}}',
				'{"type":"error","error":{"type":"overloaded_error","message":"Overloaded"}}',
			]
				.map(sseFrame)
				.join(""),
		);

		expect(parser.message()).toMatchObject({
			content: [{ type: "tool_use", input: '{"file_path":"a' }],
			streamError: "overloaded_error: Overloaded",
		});
	});

	it("does not throw on a tool input nested 10,000 deep and keeps the usage", () => {
		// z.json() recurses, so this depth throws a RangeError out of safeParse.
		const deepJson = `${"[".repeat(10_000)}${"]".repeat(10_000)}`;
		const parser = createAnthropicSseUsageParser({ collectContent: true });
		parser.feed(
			[
				// A gateway can send the whole input in the block start.
				`{"type":"content_block_start","index":0,"content_block":{"type":"tool_use","id":"tu_1","name":"Write","input":${deepJson}}}`,
				'{"type":"content_block_start","index":1,"content_block":{"type":"tool_use","id":"tu_2","name":"Write","input":{}}}',
				`{"type":"content_block_delta","index":1,"delta":{"type":"input_json_delta","partial_json":"${deepJson}"}}`,
				'{"type":"message_delta","delta":{"stop_reason":"tool_use"},"usage":{"output_tokens":9}}',
			]
				.map(sseFrame)
				.join(""),
		);

		expect(parser.message()?.content).toEqual([
			{ type: "tool_use", id: "tu_2", name: "Write", input: deepJson },
		]);
		expect(parser.usage().outputTokens).toBe(9);
		expect(
			messageFromAnthropicJson({
				content: [
					{
						type: "tool_use",
						id: "tu_3",
						name: "Write",
						input: JSON.parse(deepJson),
					},
				],
			}),
		).toBeNull();
	});
});

describe("messageFromAnthropicJson", () => {
	it("reads the blocks of a JSON answer and drops a block type it does not know", () => {
		const message = messageFromAnthropicJson({
			id: "msg_3",
			content: [
				{ type: "text", text: "Found it" },
				{ type: "web_search_tool_result", tool_use_id: "srv_1", content: [] },
				{ type: "tool_use", id: "tu_2", name: "Edit", input: { path: "a.ts" } },
			],
			stop_reason: "tool_use",
		});

		expect(message?.content).toEqual([
			{ type: "text", text: "Found it" },
			{ type: "tool_use", id: "tu_2", name: "Edit", input: { path: "a.ts" } },
		]);
		expect(message?.stopReason).toBe("tool_use");
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
			cacheWrite5mTokens: 0,
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
			cacheWrite5mTokens: 0,
		});
	});
});

// One gateway provider attempt, shortened from the 2026-11-20 probes.
function attempt(
	provider: string,
	credentialType: "byok" | "system",
	success: boolean,
) {
	return { provider, credentialType, success, statusCode: 200 };
}

// `provider_metadata.gateway` as the Vercel AI Gateway sends it, shortened.
function gatewayMetadata(options: {
	cost: string;
	marketCost: string;
	finalProvider: string;
	attempts: ReturnType<typeof attempt>[];
}) {
	return {
		routing: {
			resolvedProvider: options.finalProvider,
			finalProvider: options.finalProvider,
			modelAttempts: [
				{
					canonicalSlug: "deepseek/deepseek-v4.1-flash-1017",
					success: true,
					providerAttempts: options.attempts,
				},
			],
		},
		cost: options.cost,
		marketCost: options.marketCost,
		surchargeCost: "0",
		gatewayCost: options.cost,
	};
}

// The final `message_delta` of a gateway stream (probe `cost_stream`).
function gatewayDeltaFrame(
	gateway: ReturnType<typeof gatewayMetadata> | undefined,
): string {
	return `event: message_delta\n${sseFrame(
		JSON.stringify({
			type: "message_delta",
			delta: { stop_reason: "max_tokens" },
			usage: { input_tokens: 33, output_tokens: 20 },
			provider_metadata: {
				baseten: { acceptedPredictionTokens: 9 },
				...(gateway === undefined ? {} : { gateway }),
			},
		}),
	)}`;
}

describe("gateway cost", () => {
	// 33 input x $0.30/M + 20 output x $1.20/M = $0.0000339, rounded up to 34 micros.
	const byok = gatewayMetadata({
		cost: "0",
		marketCost: "0.0000339",
		finalProvider: "baseten",
		attempts: [attempt("baseten", "byok", true)],
	});

	it.each([
		[
			"a BYOK host bills marketCost, rounded up",
			byok,
			{ usdMicros: 34, provider: "baseten" },
		],
		[
			"a system credential bills cost, not marketCost",
			gatewayMetadata({
				cost: "0.000704",
				marketCost: "0.0009",
				finalProvider: "anthropic",
				attempts: [attempt("anthropic", "system", true)],
			}),
			{ usdMicros: 704, provider: "anthropic" },
		],
		[
			"a fallback reads the successful BYOK attempt, not the failed first one",
			gatewayMetadata({
				cost: "0",
				marketCost: "0.000033",
				finalProvider: "baseten",
				attempts: [
					attempt("vertex", "system", false),
					attempt("baseten", "byok", true),
				],
			}),
			{ usdMicros: 33, provider: "baseten" },
		],
		["no gateway metadata gives null", undefined, null],
		[
			"a cost that is not a number gives null",
			{ ...byok, marketCost: "abc" },
			null,
		],
		["a negative cost gives null", { ...byok, marketCost: "-1" }, null],
	])("%s, and the billed counts do not change", (_name, gateway, expected) => {
		const parser = createAnthropicSseUsageParser();
		parser.feed(
			`event: message_start\n${sseFrame('{"type":"message_start","message":{"usage":{"input_tokens":0,"output_tokens":0}}}')}${gatewayDeltaFrame(gateway)}`,
		);

		expect(parser.gatewayCost()).toEqual(expected);
		expect(parser.usage()).toEqual({
			inputTokens: 33,
			outputTokens: 20,
			cacheReadTokens: 0,
			cacheWriteTokens: 0,
			cacheWrite5mTokens: 0,
		});
	});

	it("reads the top-level provider_metadata of a JSON answer", () => {
		// Probe `cost_json`: a non-streamed answer carries the gateway block at the top level.
		expect(
			gatewayCostFromAnthropicJson({
				type: "message",
				usage: { input_tokens: 33, output_tokens: 20 },
				provider_metadata: { gateway: byok },
			}),
		).toEqual({ usdMicros: 34, provider: "baseten" });
	});
});
