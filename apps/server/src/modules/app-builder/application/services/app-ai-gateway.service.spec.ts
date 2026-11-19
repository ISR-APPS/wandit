import { describe, expect, it, vi } from "vitest";

import { InsufficientCreditsError } from "../../../credits/domain/errors/insufficient-credits.error";
import type { MeteringService } from "../../../metering/application/services/metering.service";
import { ModelPricingService } from "../../../metering/application/services/model-pricing.service";
import type { AiUsageEvent } from "../../../metering/domain/metering";
import type { TokenUsageQuote } from "../../../metering/domain/model-pricing";
import { mintAppAiKey } from "../../domain/app-ai-key";
import type { PublishProjectRow } from "../../infrastructure/persistence/app-publish.repository";
import type { RateLimitStore } from "../../presentation/http/guards/redis-rate-limit.guard";
import { AppAiAdmission, type AppAiTrace } from "./app-ai-admission";
import {
	type AppAiGatewayRequest,
	AppAiGatewayService,
} from "./app-ai-gateway.service";
import type { LlmProxyReply } from "./llm-proxy.service";

const PROJECT_ID = "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";
const APP_KEY = mintAppAiKey(PROJECT_ID);
const MODEL = "google/gemini-3-flash";

// An OpenAI stream with the usage frame split across two chunks.
const SSE_CHUNKS = [
	'data: {"choices":[{"delta":{"content":"Hi"}}],"usage":null}\n\n',
	'data: {"choices":[{"delta":{"content":" there"}}],"usage":null}\n\n',
	'data: {"choices":[],"usage":{"prompt_tokens":120,"completion_tokens":17,',
	'"prompt_tokens_details":{"cached_tokens":100}}}\n\ndata: [DONE]\n\n',
];

// The metering usage of the stream above: cached tokens are not input
// again, and the other prompt tokens bill at the cache write rate.
const SSE_METERED_USAGE = {
	inputTokens: 120,
	inputTokenDetails: {
		cacheReadTokens: 100,
		cacheWriteTokens: 20,
		noCacheTokens: 0,
	},
	outputTokens: 17,
};

const PROJECT: PublishProjectRow = {
	name: "Recipes",
	engine: "v2_app",
	framework: "vite-react",
	templateVersion: "v1",
	userId: "user_1",
	organizationId: null,
	deletedAt: null,
	suspendedReasonCode: null,
	suspendedAt: null,
};

const QUOTE: TokenUsageQuote = {
	costUsdMicros: 3_200,
	credits: 10,
	pricingSnapshot: {
		cacheReadUsdMicrosPerMTok: null,
		cacheWriteUsdMicrosPerMTok: null,
		imageUsdMicros: null,
		inputUsdMicrosPerMTok: 300_000,
		modelId: MODEL,
		modelType: "language",
		outputUsdMicrosPerMTok: 2_500_000,
		provider: "google",
		refreshedAt: "2026-11-01T00:00:00.000Z",
		source: "seed",
		transcriptionUsdMicrosPerSecond: null,
		usdMicrosPerCredit: 32_000,
	},
	usage: {
		cacheReadTokens: 0,
		cacheWriteTokens: 0,
		inputTokens: 10,
		outputTokens: 8192,
		uncachedInputTokens: 10,
	},
};

function holdEvent(overrides: Partial<AiUsageEvent> = {}): AiUsageEvent {
	return {
		attemptRef: "request_1",
		cacheReadTokens: null,
		cacheWriteTokens: null,
		chatId: null,
		createdAt: new Date("2026-11-03T10:00:00.000Z"),
		estimatedCostUsdMicros: null,
		executionLeaseExpiresAt: null,
		executionLeaseToken: null,
		finalCredits: null,
		id: "hold_1",
		idempotencyKey: "app-ai:request_1",
		inputTokens: null,
		messageId: null,
		model: MODEL,
		nextReconcileAttemptAt: null,
		operation: "app_ai_gateway",
		organizationId: null,
		outputTokens: null,
		parentEventId: null,
		payerUserId: null,
		pricingSnapshot: {},
		projectId: PROJECT_ID,
		provider: null,
		rawUsage: null,
		reconcileAttempts: 0,
		reconciledAt: null,
		reconciledCostUsdMicros: null,
		reservedCredits: QUOTE.credits,
		settledAt: null,
		status: "reserved",
		userId: "user_1",
		...overrides,
	};
}

// Keeps the alert messages, so a spec can check them without Sentry.
class RecordingAdmission extends AppAiAdmission {
	alerts: string[] = [];

	override alert(message: string, _trace: AppAiTrace): void {
		this.alerts.push(message);
	}
}

class FakeReply implements LlmProxyReply {
	statusCode: number | undefined;
	chunks: Buffer[] = [];
	ended = false;
	// Runs after each write; a spec closes the client here.
	onWrite: (() => void) | undefined;

	writeHead(statusCode: number): void {
		this.statusCode = statusCode;
	}

	write(chunk: Uint8Array): Promise<void> {
		this.chunks.push(Buffer.from(chunk));
		this.onWrite?.();
		return Promise.resolve();
	}

	end(): void {
		this.ended = true;
	}

	get bodyText(): string {
		return Buffer.concat(this.chunks).toString("utf8");
	}
}

function sseResponse(chunks: readonly string[]): Response {
	const encoder = new TextEncoder();
	const stream = new ReadableStream<Uint8Array>({
		start(controller) {
			for (const chunk of chunks) {
				controller.enqueue(encoder.encode(chunk));
			}
			controller.close();
		},
	});
	return new Response(stream, {
		status: 200,
		headers: { "content-type": "text/event-stream" },
	});
}

function gatewayRequest(
	options: { authorization?: string; abortSignal?: AbortSignal } = {},
): AppAiGatewayRequest {
	return {
		authorization: options.authorization ?? `Bearer ${APP_KEY}`,
		body: Buffer.from(
			JSON.stringify({
				model: MODEL,
				messages: [{ role: "user", content: "Hi" }],
				stream: true,
			}),
			"utf8",
		),
		abortSignal: options.abortSignal ?? new AbortController().signal,
	};
}

function setup(
	upstream: () => Response = () => sseResponse(SSE_CHUNKS),
	rateLimit: Pick<RateLimitStore, "hit"> = {
		hit: async () => ({ count: 1, ttlMs: 60_000 }),
	},
	project: PublishProjectRow = PROJECT,
	pricing: Pick<ModelPricingService, "quoteTokenUsage"> = {
		quoteTokenUsage: async () => QUOTE,
	},
) {
	const secrets = { readSystemValue: vi.fn(async () => APP_KEY) };
	const metering = {
		refund: vi.fn<MeteringService["refund"]>(async () =>
			holdEvent({ status: "refunded" }),
		),
		reserve: vi.fn<MeteringService["reserve"]>(async () => holdEvent()),
		settle: vi.fn<MeteringService["settle"]>(async () =>
			holdEvent({ finalCredits: 3, status: "settled" }),
		),
	};
	const upstreamFetch = vi.fn<typeof fetch>(async () => upstream());
	const admission = new RecordingAdmission(
		secrets,
		{ findProject: async () => project },
		// The chat route takes no open slot, so the release is a no-op.
		{ ...rateLimit, release: async () => {} },
		metering,
		{ AI_GATEWAY_API_KEY: "upstream-key" },
	);
	const service = new AppAiGatewayService(
		admission,
		pricing,
		metering,
		upstreamFetch,
	);
	return { admission, metering, secrets, service, upstreamFetch };
}

describe("AppAiGatewayService", () => {
	it.each([
		["a malformed key", "Bearer wnd_ai_nope", 0],
		[
			"another key of the same project",
			`Bearer ${mintAppAiKey(PROJECT_ID)}`,
			1,
		],
	])("answers 401 to %s and reserves nothing", async (_label, authorization, secretReads) => {
		const { metering, secrets, service, upstreamFetch } = setup();
		const reply = new FakeReply();

		await service.chatCompletions(gatewayRequest({ authorization }), reply);

		expect(reply.statusCode).toBe(401);
		expect(JSON.parse(reply.bodyText)).toMatchObject({
			error: { code: "invalid_api_key" },
		});
		expect(secrets.readSystemValue).toHaveBeenCalledTimes(secretReads);
		expect(metering.reserve).not.toHaveBeenCalled();
		expect(upstreamFetch).not.toHaveBeenCalled();
	});

	// Security and money: the key of a dead project, or a burst over the
	// window, never reaches the hold or the upstream.
	it.each([
		[
			"a deleted project",
			{ deletedAt: new Date("2026-11-01") },
			1,
			401,
			"invalid_api_key",
		],
		["a V1 project", { engine: "v1_page" as const }, 1, 401, "invalid_api_key"],
		[
			"a suspended project",
			{ suspendedAt: new Date("2026-11-01") },
			1,
			403,
			"project_suspended",
		],
		["call 61 of the window", {}, 61, 429, "rate_limited"],
	])("answers %s with %i and reserves nothing", async (_label, projectFields, count, status, code) => {
		const { metering, service, upstreamFetch } = setup(
			undefined,
			{ hit: async () => ({ count, ttlMs: 30_000 }) },
			{ ...PROJECT, ...projectFields },
		);
		const reply = new FakeReply();

		await service.chatCompletions(gatewayRequest(), reply);

		expect(reply.statusCode).toBe(status);
		expect(JSON.parse(reply.bodyText)).toMatchObject({ error: { code } });
		expect(metering.reserve).not.toHaveBeenCalled();
		expect(upstreamFetch).not.toHaveBeenCalled();
	});

	it("answers 402 without an upstream call when the payer has no credits", async () => {
		const { metering, service, upstreamFetch } = setup();
		metering.reserve.mockRejectedValue(new InsufficientCreditsError(10, 0, 0));
		const reply = new FakeReply();

		await service.chatCompletions(gatewayRequest(), reply);

		expect(reply.statusCode).toBe(402);
		expect(JSON.parse(reply.bodyText)).toMatchObject({
			error: { code: "insufficient_credits" },
		});
		expect(upstreamFetch).not.toHaveBeenCalled();
	});

	// Money: without the rate window the overdraft of concurrent calls has no bound.
	it("answers 503 and reserves nothing when the rate window read fails", async () => {
		const { metering, service, upstreamFetch } = setup(undefined, {
			hit: async () => {
				throw new Error("redis down");
			},
		});
		const reply = new FakeReply();

		await service.chatCompletions(gatewayRequest(), reply);

		expect(reply.statusCode).toBe(503);
		expect(JSON.parse(reply.bodyText)).toMatchObject({
			error: { code: "gateway_unavailable" },
		});
		expect(metering.reserve).not.toHaveBeenCalled();
		expect(upstreamFetch).not.toHaveBeenCalled();
	});

	it("refunds the hold and answers 502 when the upstream answers 500", async () => {
		const { metering, service } = setup(
			() => new Response("boom", { status: 500 }),
		);
		const reply = new FakeReply();

		await service.chatCompletions(gatewayRequest(), reply);

		expect(reply.statusCode).toBe(502);
		expect(metering.refund).toHaveBeenCalledOnce();
		expect(metering.refund.mock.calls[0]?.[0]).toBe("hold_1");
		expect(metering.settle).not.toHaveBeenCalled();
	});

	// Money: without a gateway cost the settle bills by tokens, and an
	// operator sees each such answer.
	it("relays the stream and settles once by tokens, with an alert, when the usage has no cost", async () => {
		const { admission, metering, service, upstreamFetch } = setup();
		const reply = new FakeReply();

		await service.chatCompletions(gatewayRequest(), reply);

		expect(reply.statusCode).toBe(200);
		expect(reply.bodyText).toBe(SSE_CHUNKS.join(""));
		// Security: the upstream gets the Wandit key, never the app key.
		const init = upstreamFetch.mock.calls[0]?.[1];
		expect(init?.headers).toMatchObject({
			authorization: "Bearer upstream-key",
		});
		expect(JSON.stringify(init)).not.toContain(APP_KEY);
		expect(metering.settle).toHaveBeenCalledOnce();
		expect(metering.settle.mock.calls[0]).toEqual([
			"hold_1",
			expect.objectContaining({
				modelId: MODEL,
				pricing: "token",
				// One answer is one call, so its prompt picks the tier.
				promptTokens: 120,
				usage: SSE_METERED_USAGE,
			}),
		]);
		expect(metering.refund).not.toHaveBeenCalled();
		expect(admission.alerts).toEqual(["App AI answer had no gateway cost"]);
	});

	// Money: the gateway cost has the reasoning, tier, and provider rate, so
	// it is the bill. 0.00205875 USD = 2,059 micros = 7 cc at 32,000 micros per credit.
	it("settles a JSON answer with a gateway cost at the credits of that cost", async () => {
		const { admission, metering, service } = setup(
			() =>
				new Response(
					JSON.stringify({
						choices: [{ message: { content: "Hi" } }],
						usage: {
							prompt_tokens: 19,
							completion_tokens: 124,
							completion_tokens_details: { reasoning_tokens: 64 },
							cost: 0.00205875,
							market_cost: 0.00205875,
						},
					}),
					{ status: 200, headers: { "content-type": "application/json" } },
				),
		);

		await service.chatCompletions(gatewayRequest(), new FakeReply());

		expect(metering.settle).toHaveBeenCalledOnce();
		expect(metering.settle.mock.calls[0]).toEqual([
			"hold_1",
			expect.objectContaining({
				costUsdMicros: 2_059,
				finalCredits: 7,
				pricing: "direct",
				// The real counts: no cache write for a prompt without a cache.
				usage: { cacheReadTokens: 0, inputTokens: 19, outputTokens: 188 },
			}),
		]);
		expect(metering.refund).not.toHaveBeenCalled();
		expect(admission.alerts).toEqual([]);
	});

	// Money: a prompt above the tier threshold costs 2 x input and 1.5 x
	// output on every token. A 1,200,000-byte body estimates 300,000 tokens,
	// above the 272,001 tier: 300,000 x 5 (cache write tier) + 8,192 x 15
	// = 1,622,880 micros = 5,072 cc. The base rates would hold 2,131 cc.
	it("holds a body above a tier threshold at the tier and cache write rates", async () => {
		const model = "openai/gpt-6.1-sol";
		const pricing = new ModelPricingService(
			{ findByModelId: async () => null, upsertMany: async () => 0 },
			{
				seedResponse: {
					generatedAt: "2026-11-17T00:00:00.000Z",
					data: [
						{
							id: model,
							owned_by: "openai",
							type: "language",
							pricing: {
								input: "0.000002",
								input_tiers: [{ cost: "0.000004", min: 272_001 }],
								output: "0.00001",
								output_tiers: [{ cost: "0.000015", min: 272_001 }],
								input_cache_write: "0.0000025",
								input_cache_write_tiers: [{ cost: "0.000005", min: 272_001 }],
							},
						},
					],
				},
				usdMicrosPerCredit: 32_000,
			},
		);
		const { metering, service } = setup(undefined, undefined, PROJECT, pricing);
		// 72 bytes of JSON around the content.
		const body = Buffer.from(
			JSON.stringify({
				model,
				messages: [{ role: "user", content: "a".repeat(1_199_928) }],
			}),
			"utf8",
		);

		await service.chatCompletions(
			{ ...gatewayRequest(), body },
			new FakeReply(),
		);

		expect(body.length).toBe(1_200_000);
		expect(metering.reserve.mock.calls[0]?.[2]).toMatchObject({
			credits: 5_072,
		});
	});

	// Money: an answer without usage still did upstream work, so it is never free.
	it("charges the full hold when a 2xx answer has no usage", async () => {
		const { metering, service } = setup(
			() =>
				new Response(JSON.stringify({ choices: [] }), {
					status: 200,
					headers: { "content-type": "application/json" },
				}),
		);
		const reply = new FakeReply();

		await service.chatCompletions(gatewayRequest(), reply);

		expect(reply.statusCode).toBe(200);
		expect(metering.settle).toHaveBeenCalledOnce();
		expect(metering.settle.mock.calls[0]).toEqual([
			"hold_1",
			expect.objectContaining({
				pricing: "direct",
				finalCredits: QUOTE.credits,
			}),
		]);
		expect(metering.refund).not.toHaveBeenCalled();
	});

	// Money: output that reached the client is never free, also when the
	// upstream stream fails before the usage frame.
	it("charges the full hold when the upstream stream fails after a frame went out", async () => {
		const frame = 'data: {"choices":[{"delta":{"content":"Hi"}}]}\n\n';
		const { metering, service } = setup(
			() =>
				new Response(
					new ReadableStream<Uint8Array>({
						start(controller) {
							controller.enqueue(new TextEncoder().encode(frame));
						},
						// `pull` runs only after the first read takes the frame, so the
						// frame reaches the client before the error.
						pull(controller) {
							controller.error(new Error("reset"));
						},
					}),
					{ status: 200, headers: { "content-type": "text/event-stream" } },
				),
		);
		const reply = new FakeReply();

		await service.chatCompletions(gatewayRequest(), reply);

		expect(reply.bodyText).toBe(frame);
		expect(metering.settle).toHaveBeenCalledOnce();
		expect(metering.settle.mock.calls[0]).toEqual([
			"hold_1",
			expect.objectContaining({
				pricing: "direct",
				finalCredits: QUOTE.credits,
			}),
		]);
		expect(metering.refund).not.toHaveBeenCalled();
	});

	it("drains the stream after a client abort and still settles the usage", async () => {
		const { metering, service } = setup();
		const client = new AbortController();
		const reply = new FakeReply();
		reply.onWrite = () => client.abort();

		await service.chatCompletions(
			gatewayRequest({ abortSignal: client.signal }),
			reply,
		);

		// One chunk reached the client before it left; the rest was drained.
		expect(reply.chunks).toHaveLength(1);
		expect(reply.ended).toBe(true);
		expect(metering.settle).toHaveBeenCalledOnce();
		expect(metering.settle.mock.calls[0]?.[1]).toMatchObject({
			usage: SSE_METERED_USAGE,
		});
	});
});
