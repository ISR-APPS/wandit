import { APP_AI_MAX_OUTPUT_TOKENS } from "@wandit/contracts";
import { describe, expect, it } from "vitest";

import { normalizeTokenUsage } from "../../metering/domain/model-pricing";
import {
	appAiGatewayCostUsdMicros,
	appAiMeteredUsage,
	appAiUsageFromJson,
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

	// Money: a 1-hour cache write costs 2 x the input rate, above the 1.25 x write rate of the token fallback.
	const CACHE_CONTROL = { type: "ephemeral" };
	it.each([
		[
			"a message",
			{
				messages: [
					{ role: "user", content: "Hi", cache_control: CACHE_CONTROL },
				],
			},
		],
		[
			"a text part",
			{
				messages: [
					{
						role: "user",
						content: [
							{ type: "text", text: "Hi", cache_control: CACHE_CONTROL },
						],
					},
				],
			},
		],
		[
			"a tool",
			{
				messages: MESSAGES,
				tools: [
					{
						type: "function",
						function: { name: "f" },
						cache_control: CACHE_CONTROL,
					},
				],
			},
		],
	])("refuses cache_control on %s", (_label, body) => {
		const result = parseAppAiRequest(bodyOf(body));

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
			choiceGatewayCost: null,
		});
	});

	// Money: the settle bills the cost of the last frame. A recorded gateway
	// frame has the cost on `usage` and on `choices[0].delta`.
	it("keeps the gateway cost of the last stream frame", () => {
		const parser = createAppAiSseUsageParser();

		parser.feed(
			'data: {"id":"gen_1","choices":[{"index":0,"delta":{"provider_metadata":{"gateway":{"cost":"0.000588","marketCost":"0.000588","generationId":"gen_1"}}},"finish_reason":"stop"}],"usage":{"prompt_tokens":16,"completion_tokens":36,"total_tokens":52,"cost":0.000588,"is_byok":false,"prompt_tokens_details":{"cached_tokens":0},"cost_details":{"upstream_inference_cost":null},"completion_tokens_details":{"reasoning_tokens":0},"market_cost":0.000588}}\n\ndata: [DONE]\n\n',
		);

		expect(parser.usage()).toMatchObject({
			cost: 0.000588,
			market_cost: 0.000588,
			choiceGatewayCost: { cost: 0.000588, marketCost: 0.000588 },
		});
	});
});

describe("appAiGatewayCostUsdMicros", () => {
	// Money: the highest reported cost wins and rounds up to whole micros. A
	// malformed cost never fails the parse; the settle then bills by tokens.
	it.each([
		["usage.cost", { cost: 0.00205875 }, {}, 2_059],
		["a BYOK answer with cost 0", { cost: 0, market_cost: 0.000588 }, {}, 588],
		[
			"the upstream inference cost",
			{ cost: 0.0001, cost_details: { upstream_inference_cost: 0.0003 } },
			{},
			300,
		],
		[
			"the choice-level marketCost string",
			{ cost: 0.0001 },
			{
				message: {
					provider_metadata: {
						gateway: { cost: "0.0001", marketCost: "0.0012" },
					},
				},
			},
			1_200,
		],
		["a fraction of a micro", { cost: 0.0000702 }, {}, 71],
		["float noise of 0.000123 USD", { cost: 0.000123 }, {}, 123],
		["no cost field", {}, {}, null],
		["a cost above the int4 limit of the metering", { cost: 3000 }, {}, null],
		[
			"malformed cost fields",
			{ cost: "abc", market_cost: -1, cost_details: "x" },
			{ message: { provider_metadata: { gateway: { cost: "1e9" } } } },
			null,
		],
	])("reads %s", (_label, costFields, choice, expected) => {
		const usage = appAiUsageFromJson(
			JSON.stringify({
				choices: [choice],
				usage: { prompt_tokens: 19, completion_tokens: 124, ...costFields },
			}),
		);

		expect(usage).not.toBeNull();
		expect(usage && appAiGatewayCostUsdMicros(usage)).toBe(expected);
	});
});

describe("appAiMeteredUsage", () => {
	// Money: an OpenAI model can write the cache without a request field, so
	// each prompt token that is not a cache read bills as a cache write.
	it("bills the cached tokens once, and the rest at the cache write rate", () => {
		const usage = normalizeTokenUsage(
			appAiMeteredUsage({
				prompt_tokens: 120,
				completion_tokens: 17,
				prompt_tokens_details: { cached_tokens: 100 },
			}),
		);

		expect(usage).toMatchObject({
			cacheReadTokens: 100,
			cacheWriteTokens: 20,
			uncachedInputTokens: 0,
			outputTokens: 17,
		});
	});

	// Bug fix: OpenAI and Google leave the reasoning tokens out of
	// `completion_tokens`, and the gateway bills them as output (recorded
	// gpt-5 answer: 124 + 64 tokens).
	it("bills the reasoning tokens as output", () => {
		const usage = appAiMeteredUsage({
			prompt_tokens: 19,
			completion_tokens: 124,
			completion_tokens_details: { reasoning_tokens: 64 },
		});

		expect(usage.outputTokens).toBe(188);
	});
});
