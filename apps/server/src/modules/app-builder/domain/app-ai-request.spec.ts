import { APP_AI_MAX_OUTPUT_TOKENS } from "@wandit/contracts";
import { describe, expect, it } from "vitest";

import { normalizeTokenUsage } from "../../metering/domain/model-pricing";
import {
	appAiMeteredUsage,
	createAppAiSseUsageParser,
	parseAppAiRequest,
} from "./app-ai-request";

function bodyOf(value: object): Buffer {
	return Buffer.from(JSON.stringify(value), "utf8");
}

const MESSAGES = [{ role: "user", content: "Hi" }];

describe("parseAppAiRequest", () => {
	it("drops the fields that change the billed model or price, and forces the stream usage", () => {
		const result = parseAppAiRequest(
			bodyOf({
				model: "openai/gpt-5.4-mini",
				messages: MESSAGES,
				stream: true,
				stream_options: { include_usage: false },
				models: ["openai/gpt-5.4"],
				providerOptions: { gateway: { order: ["openai"] } },
				service_tier: "priority",
				n: 4,
			}),
		);

		expect(result.ok && result.upstreamBody).toEqual({
			model: "openai/gpt-5.4-mini",
			messages: MESSAGES,
			stream: true,
			stream_options: { include_usage: true },
			max_tokens: APP_AI_MAX_OUTPUT_TOKENS,
		});
	});

	it.each([
		[
			"a value above the cap",
			{ max_tokens: APP_AI_MAX_OUTPUT_TOKENS + 1 },
			APP_AI_MAX_OUTPUT_TOKENS,
		],
		["max_completion_tokens", { max_completion_tokens: 50 }, 50],
		["no value", {}, APP_AI_MAX_OUTPUT_TOKENS],
	])("caps the output tokens for %s", (_label, fields, expected) => {
		const result = parseAppAiRequest(bodyOf({ messages: MESSAGES, ...fields }));

		expect(result.ok && result.upstreamBody.max_tokens).toBe(expected);
		expect(result.ok && "max_completion_tokens" in result.upstreamBody).toBe(
			false,
		);
	});

	it("refuses a model outside the allow list with model_not_allowed", () => {
		const result = parseAppAiRequest(
			bodyOf({ model: "openai/o3-pro", messages: MESSAGES }),
		);

		expect(!result.ok && result.code).toBe("model_not_allowed");
	});

	// Money: a remote image URL is a few bytes, but the provider bills up to
	// 4,916 tokens for it (gpt-5.4 family at detail low: 4,096 patches x 1.2).
	it("estimates each image part above its provider bill, not by its bytes", () => {
		const image = {
			type: "image_url",
			image_url: { url: "https://example.com/a.png" },
		};
		const result = parseAppAiRequest(
			bodyOf({
				messages: [
					{
						role: "user",
						content: [{ type: "text", text: "Hi" }, image, image],
					},
				],
			}),
		);

		expect(result.ok && result.estimatedInputTokens).toBeGreaterThan(2 * 4_916);
	});

	// Money: these parts bill a cost that the reserve cannot estimate.
	it.each([
		["a file part", { type: "file", file: { file_id: "file_1" } }],
		["an audio part", { type: "input_audio", input_audio: { data: "AAAA" } }],
		[
			"an image at detail original",
			{
				type: "image_url",
				image_url: { url: "https://example.com/a.png", detail: "original" },
			},
		],
	])("refuses %s with invalid_request", (_label, part) => {
		const result = parseAppAiRequest(
			bodyOf({ messages: [{ role: "user", content: [part] }] }),
		);

		expect(!result.ok && result.code).toBe("invalid_request");
	});
});

describe("createAppAiSseUsageParser", () => {
	it("reads the usage of a frame split across chunks, and the last usage wins", () => {
		const parser = createAppAiSseUsageParser();
		const stream = [
			'data: {"choices":[{"delta":{"content":"Hi"}}],"usage":null}\n\n',
			'data: {"choices":[],"usage":{"prompt_tokens":1,"completion_tokens":1}}\r\n\r\n',
			'data: {"choices":[],"usage":{"prompt_tokens":120,"completion_tokens":17,',
			'"prompt_tokens_details":{"cached_tokens":100}}}\n',
			"\ndata: [DONE]\n\n",
		];

		for (const chunk of stream) {
			parser.feed(chunk);
		}

		expect(parser.usage()).toEqual({
			prompt_tokens: 120,
			completion_tokens: 17,
			prompt_tokens_details: { cached_tokens: 100 },
		});
	});
});

describe("appAiMeteredUsage", () => {
	it("bills the cached tokens once, at the cache rate only", () => {
		const usage = normalizeTokenUsage(
			appAiMeteredUsage({
				prompt_tokens: 120,
				completion_tokens: 17,
				prompt_tokens_details: { cached_tokens: 100 },
			}),
		);

		expect(usage).toMatchObject({
			cacheReadTokens: 100,
			uncachedInputTokens: 20,
			outputTokens: 17,
		});
	});
});
