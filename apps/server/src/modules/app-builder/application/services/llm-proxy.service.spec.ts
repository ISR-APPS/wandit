import { createHmac } from "node:crypto";
import { createServer, type Server, type ServerResponse } from "node:http";
import { gzipSync } from "node:zlib";

import { ServiceUnavailableException } from "@nestjs/common";
import { describe, expect, it } from "vitest";

import type { LlmProxyEnv } from "../../domain/llm-upstream";
import type { LlmGeneration } from "../../infrastructure/langfuse/langfuse-exporter";
import type { NewLlmProxyRequest } from "../../infrastructure/persistence/llm-proxy-requests.repository";
import { FakeLlmSpendCounters } from "../../infrastructure/redis/fake-llm-spend-counters";
import { LLM_PROXY_DAILY_USER_CAP_USD } from "../../infrastructure/redis/llm-spend-counters";
import type { BlockTextCache } from "../../infrastructure/redis/redis-block-text-cache";
import {
	type LlmProxyInboundRequest,
	type LlmProxyReply,
	LlmProxyService,
} from "./llm-proxy.service";
import type {
	DescribedImage,
	ImageDescription,
	LlmProxyImageDescriber,
} from "./llm-proxy-image-describer.service";
import {
	type LlmProxyTokenClaimsInput,
	mintLlmProxyToken,
} from "./llm-proxy-token.service";

// A canned Anthropic stream: message_start carries input + cache counts,
// message_delta carries cumulative output.
const SSE_STREAM = [
	'event: message_start\ndata: {"type":"message_start","message":{"id":"msg_1","usage":{"input_tokens":120,"cache_creation_input_tokens":40,"cache_read_input_tokens":30}}}\n\n',
	'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hi"}}\n\n',
	'event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":17}}\n\n',
	'event: message_stop\ndata: {"type":"message_stop"}\n\n',
].join("");

type CapturedRequest = {
	url: string | undefined;
	headers: Record<string, string | string[] | undefined>;
	body: Buffer;
};

type UpstreamHandle = {
	baseUrl: string;
	requests: CapturedRequest[];
	close: () => Promise<void>;
};

// One fake Anthropic upstream on an ephemeral port; the handler owns `res`.
async function startUpstream(
	handler: (req: CapturedRequest, res: ServerResponse) => void,
): Promise<UpstreamHandle> {
	const requests: CapturedRequest[] = [];
	const server: Server = createServer((req, res) => {
		const chunks: Buffer[] = [];
		req.on("data", (chunk: Buffer) => chunks.push(chunk));
		req.on("end", () => {
			const captured: CapturedRequest = {
				url: req.url,
				headers: req.headers,
				body: Buffer.concat(chunks),
			};
			requests.push(captured);
			// The client can abort mid-stream; a dead socket is expected here.
			res.on("error", () => undefined);
			handler(captured, res);
		});
	});
	await new Promise<void>((resolve) => {
		server.listen(0, "127.0.0.1", resolve);
	});
	const address = server.address();
	if (typeof address !== "object" || address === null) {
		throw new Error("Fake upstream has no address");
	}
	return {
		baseUrl: `http://127.0.0.1:${address.port}`,
		requests,
		close: () =>
			new Promise<void>((resolve, reject) => {
				// Drop keep-alive sockets left open by cancelled upstream reads.
				server.closeAllConnections();
				server.close((error) => (error ? reject(error) : resolve()));
			}),
	};
}

function jsonOk(body: string) {
	return (_req: CapturedRequest, res: ServerResponse) => {
		res.writeHead(200, { "content-type": "application/json" });
		res.end(body);
	};
}

// A fetch stub that answers each call with the next scripted response and
// records the headers and body of each call.
function scriptedFetch(responses: (() => Response)[]): {
	upstreamFetch: typeof fetch;
	sent: { headers: Headers; body: string }[];
} {
	const sent: { headers: Headers; body: string }[] = [];
	const upstreamFetch: typeof fetch = (_url, init) => {
		sent.push({
			headers: new Headers(init?.headers),
			body: String(init?.body ?? ""),
		});
		const next = responses[sent.length - 1];
		if (next === undefined) {
			throw new Error(`No scripted response for call ${sent.length}`);
		}
		return Promise.resolve(next());
	};
	return { upstreamFetch, sent };
}

function sseResponse(stream: string): Response {
	return new Response(stream, {
		status: 200,
		headers: { "content-type": "text/event-stream" },
	});
}

class FakeReply implements LlmProxyReply {
	statusCode: number | undefined;
	headers: Record<string, string> = {};
	chunks: Buffer[] = [];
	ended = false;
	onWrite: ((count: number) => void) | undefined;

	writeHead(statusCode: number, headers: Record<string, string>): void {
		this.statusCode = statusCode;
		Object.assign(this.headers, headers);
	}

	write(chunk: Uint8Array): Promise<void> {
		this.chunks.push(Buffer.from(chunk));
		this.onWrite?.(this.chunks.length);
		return Promise.resolve();
	}

	end(): void {
		this.ended = true;
	}

	get bodyText(): string {
		return Buffer.concat(this.chunks).toString("utf8");
	}
}

const claimsInput = {
	runId: "run_test",
	turnId: "11111111-2222-4333-8444-555555555555",
	userId: "user_1",
	projectId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
	workspaceId: null,
	plan: "pro" as const,
	capUsd: 1,
};

function makeEnv(baseUrl: string): LlmProxyEnv {
	return {
		ANTHROPIC_API_KEY: "sk-provider-real-key",
		LLM_PROXY_SIGNING_KEY: "signing-a,signing-b",
		V2_DEFAULT_MODEL: "anthropic/claude-sonnet-5",
		V2_LLM_UPSTREAM_BASE_URL: baseUrl,
	};
}

// A describer that records each image and answers with `answer`.
function fakeDescriber(answer: () => Promise<ImageDescription>): {
	described: DescribedImage[];
	describer: Pick<LlmProxyImageDescriber, "describe">;
} {
	const described: DescribedImage[] = [];
	return {
		described,
		describer: {
			describe: async (image) => {
				described.push(image);
				return answer();
			},
		},
	};
}

// The answer of a describer call that went well: 1 000 input and 200 output tokens for 1 100 micros.
const BLUE_BUTTON_DESCRIPTION: ImageDescription = {
	text: 'A blue button with the text "Buy".',
	usage: {
		inputTokens: 1000,
		outputTokens: 200,
		cacheReadTokens: 0,
		cacheWriteTokens: 0,
		cacheWrite5mTokens: 0,
	},
	usdMicros: 1100,
	finishReason: "stop",
	generationId: "gen_describe_1",
	latencyMs: 900,
};

// `now` is the clock of the fake counters, in epoch ms. A TTL spec moves it.
// `v2DisabledModels` is the admin list of models that ops turned off.
// `imageDescriber` describes the images for a text-only host model.
function makeService(
	env: LlmProxyEnv,
	upstreamFetch: typeof fetch = fetch,
	now: () => number = Date.now,
	v2DisabledModels: string[] = [],
	imageDescriber: Pick<LlmProxyImageDescriber, "describe"> = fakeDescriber(
		async () => BLUE_BUTTON_DESCRIPTION,
	).describer,
) {
	const counters = new FakeLlmSpendCounters(now);
	const inserted: NewLlmProxyRequest[] = [];
	const requests = {
		insert: async (row: NewLlmProxyRequest) => {
			inserted.push(row);
			return { id: "row-1" };
		},
	};
	// Each Langfuse generation the service sends; content collection is on.
	const generations: LlmGeneration[] = [];
	// The block text cache, by sha256 of the block bytes, and the TTL of each entry in seconds.
	const blockTexts = new Map<string, string>();
	const blockTextTtls = new Map<string, number>();
	const blockTextCache: BlockTextCache = {
		getMany: async (sha256s) =>
			new Map(
				sha256s.flatMap((sha256) => {
					const text = blockTexts.get(sha256);
					return text === undefined ? [] : [[sha256, text] as const];
				}),
			),
		set: async (sha256, text, ttlSec) => {
			blockTexts.set(sha256, text);
			blockTextTtls.set(sha256, ttlSec);
		},
	};
	const service = new LlmProxyService(
		env,
		counters,
		requests,
		upstreamFetch,
		{
			send: (generation) => {
				generations.push(generation);
			},
		},
		{ get: async () => ({ v2DisabledModels }) },
		blockTextCache,
		imageDescriber,
	);
	return {
		blockTexts,
		blockTextTtls,
		counters,
		generations,
		inserted,
		service,
	};
}

function token(
	env: LlmProxyEnv,
	overrides: Partial<LlmProxyTokenClaimsInput> = {},
) {
	return `Bearer ${mintLlmProxyToken({ ...claimsInput, ...overrides }, env)}`;
}

function inbound(
	env: LlmProxyEnv,
	overrides: Partial<LlmProxyInboundRequest> = {},
): { input: LlmProxyInboundRequest; abort: AbortController } {
	const abort = new AbortController();
	const input: LlmProxyInboundRequest = {
		authorization: token(env),
		anthropicVersion: "2023-06-01",
		anthropicBeta: "prompt-caching-2024-07-31",
		wanditRun: "run_test",
		claudeSessionId: "sess_9",
		body: Buffer.from(
			JSON.stringify({
				model: "anthropic/claude-sonnet-5",
				max_tokens: 64,
				messages: [{ role: "user", content: "hi" }],
			}),
			"utf8",
		),
		endpoint: "messages",
		queryString: undefined,
		abortSignal: abort.signal,
		...overrides,
	};
	return { abort, input };
}

describe("LlmProxyService", () => {
	it("rewrites auth headers and forwards identical body bytes", async () => {
		const upstream = await startUpstream((_req, res) => {
			res.writeHead(200, {
				"content-type": "application/json",
				"request-id": "req_42",
			});
			res.end(
				JSON.stringify({
					id: "msg_1",
					usage: { input_tokens: 3, output_tokens: 2 },
				}),
			);
		});
		try {
			const env = makeEnv(upstream.baseUrl);
			const { service, inserted } = makeService(env);
			const reply = new FakeReply();
			const { input } = inbound(env);

			await service.proxyAnthropic(input, reply);

			expect(reply.statusCode).toBe(200);
			expect(reply.ended).toBe(true);
			const sent = upstream.requests[0];
			expect(sent?.url).toBe("/v1/messages");
			expect(sent?.headers["x-api-key"]).toBe("sk-provider-real-key");
			// The bearer run token never leaves the API.
			expect(sent?.headers.authorization).toBeUndefined();
			expect(sent?.headers["anthropic-version"]).toBe("2023-06-01");
			expect(sent?.headers["anthropic-beta"]).toBe("prompt-caching-2024-07-31");
			expect(sent?.headers["x-wandit-run"]).toBe("run_test");
			expect(sent?.body.equals(input.body)).toBe(true);
			expect(inserted).toHaveLength(1);
			expect(inserted[0]?.status).toBe("ok");
			expect(inserted[0]?.upstreamRequestId).toBe("req_42");
		} finally {
			await upstream.close();
		}
	});

	it.each([
		{
			case: "a light Messages call",
			thinking: "light" as const,
			model: "anthropic/claude-sonnet-5",
			bodyThinking: "adaptive",
			bodyEffort: "high",
			endpoint: "messages" as const,
			sentEffort: "medium",
		},
		{
			case: "a balanced Messages call",
			thinking: "balanced" as const,
			model: "anthropic/claude-sonnet-5",
			bodyThinking: "adaptive",
			bodyEffort: "high",
			endpoint: "messages" as const,
			sentEffort: null,
		},
		{
			case: "a deep Messages call on Gemini",
			thinking: "deep" as const,
			model: "google/gemini-4-argon",
			bodyThinking: "adaptive",
			bodyEffort: "high",
			endpoint: "messages" as const,
			sentEffort: "xhigh",
		},
		{
			case: "a deep Messages call on Claude",
			thinking: "deep" as const,
			model: "anthropic/claude-sonnet-5",
			bodyThinking: "adaptive",
			bodyEffort: "high",
			endpoint: "messages" as const,
			sentEffort: "max",
		},
		{
			case: "a deep call with thinking disabled",
			thinking: "deep" as const,
			model: "anthropic/claude-sonnet-5",
			bodyThinking: "disabled",
			bodyEffort: "high",
			endpoint: "messages" as const,
			sentEffort: null,
		},
		{
			case: "a deep call whose body sends no effort",
			thinking: "deep" as const,
			model: "anthropic/claude-sonnet-5",
			bodyThinking: "adaptive",
			bodyEffort: null,
			endpoint: "messages" as const,
			sentEffort: null,
		},
		{
			case: "a deep count_tokens call",
			thinking: "deep" as const,
			model: "anthropic/claude-sonnet-5",
			bodyThinking: "adaptive",
			bodyEffort: "high",
			endpoint: "count_tokens" as const,
			sentEffort: null,
		},
	])("sends effort $sentEffort for $case", async ({
		thinking,
		model,
		bodyThinking,
		bodyEffort,
		endpoint,
		sentEffort,
	}) => {
		const upstream = await startUpstream(
			jsonOk(JSON.stringify({ usage: { input_tokens: 1, output_tokens: 1 } })),
		);
		try {
			const env = makeEnv(upstream.baseUrl);
			const { service } = makeService(env);
			const { input } = inbound(env, {
				authorization: token(env, { thinking }),
				endpoint,
				body: Buffer.from(
					JSON.stringify({
						model,
						max_tokens: 64,
						messages: [{ role: "user", content: "hi" }],
						thinking: { type: bodyThinking },
						// The harness sends no effort for a model that takes none.
						...(bodyEffort === null
							? {}
							: {
									output_config: {
										effort: bodyEffort,
										format: { type: "json" },
									},
								}),
					}),
					"utf8",
				),
			});

			await service.proxyAnthropic(input, new FakeReply());

			const sent = upstream.requests[0]?.body ?? Buffer.alloc(0);
			if (sentEffort === null) {
				// No rewrite: the raw bytes go out, so the prompt cache still hits.
				expect(sent.equals(input.body)).toBe(true);
			} else {
				expect(JSON.parse(sent.toString("utf8"))).toEqual({
					model,
					max_tokens: 64,
					messages: [{ role: "user", content: "hi" }],
					thinking: { type: bodyThinking },
					output_config: { effort: sentEffort, format: { type: "json" } },
				});
			}
		} finally {
			await upstream.close();
		}
	});

	it("sends the plan default model when the request names none", async () => {
		const upstream = await startUpstream(
			jsonOk(JSON.stringify({ usage: { input_tokens: 1, output_tokens: 1 } })),
		);
		try {
			const env = makeEnv(upstream.baseUrl);
			const { service, inserted } = makeService(env);
			const reply = new FakeReply();
			const { input } = inbound(env, {
				body: Buffer.from(
					JSON.stringify({ max_tokens: 8, messages: [] }),
					"utf8",
				),
			});

			await service.proxyAnthropic(input, reply);

			const sentBody: { model?: string; max_tokens?: number } = JSON.parse(
				upstream.requests[0]?.body.toString("utf8") ?? "{}",
			);
			expect(sentBody.model).toBe("anthropic/claude-sonnet-5");
			// Other fields survive the rewrite.
			expect(sentBody.max_tokens).toBe(8);
			expect(inserted[0]?.model).toBe("anthropic/claude-sonnet-5");
		} finally {
			await upstream.close();
		}
	});

	it("forwards the query string unchanged", async () => {
		const upstream = await startUpstream(jsonOk("{}"));
		try {
			const env = makeEnv(upstream.baseUrl);
			const { service } = makeService(env);
			const { input } = inbound(env, { queryString: "beta=true" });
			await service.proxyAnthropic(input, new FakeReply());
			expect(upstream.requests[0]?.url).toBe("/v1/messages?beta=true");
		} finally {
			await upstream.close();
		}
	});

	it("routes count_tokens to the upstream count_tokens path", async () => {
		const upstream = await startUpstream(
			jsonOk(JSON.stringify({ input_tokens: 42 })),
		);
		try {
			const env = makeEnv(upstream.baseUrl);
			const { service, inserted, counters, generations } = makeService(env);
			const { input } = inbound(env, { endpoint: "count_tokens" });
			await service.proxyAnthropic(input, new FakeReply());
			expect(upstream.requests[0]?.url).toBe("/v1/messages/count_tokens");
			expect(inserted[0]?.inputTokens).toBe(42);
			// The endpoint is free: no charge on the row, no spend counters.
			expect(inserted[0]?.usdMicros).toBe(0);
			expect(await counters.readRunSpend("run_test")).toBe(0);
			// Langfuse would count the input of the next Messages call twice.
			expect(generations).toHaveLength(0);
		} finally {
			await upstream.close();
		}
	});

	it("drops content-encoding when fetch already decoded a gzip answer", async () => {
		const json = JSON.stringify({ input_tokens: 7 });
		const upstream = await startUpstream((_req, res) => {
			res.writeHead(200, {
				"content-encoding": "gzip",
				"content-type": "application/json",
			});
			res.end(gzipSync(json));
		});
		try {
			const env = makeEnv(upstream.baseUrl);
			const { service } = makeService(env);
			const reply = new FakeReply();
			const { input } = inbound(env, { endpoint: "count_tokens" });

			await service.proxyAnthropic(input, reply);

			// The client gets plain bytes, so a gzip label would break its decode.
			expect(reply.bodyText).toBe(json);
			expect(reply.headers["content-encoding"]).toBeUndefined();
		} finally {
			await upstream.close();
		}
	});

	it("answers 503 V2_MODEL_UNPRICED for a model with no price row", async () => {
		const upstream = await startUpstream(jsonOk("{}"));
		try {
			const env = {
				...makeEnv(upstream.baseUrl),
				V2_DEFAULT_MODEL: "x/unpriced",
			};
			const { service, inserted } = makeService(env);
			const { input } = inbound(env, {
				body: Buffer.from(
					JSON.stringify({ model: "x/unpriced", messages: [] }),
					"utf8",
				),
			});

			let failure: unknown;
			try {
				await service.proxyAnthropic(input, new FakeReply());
			} catch (error) {
				failure = error;
			}

			expect(failure).toBeInstanceOf(ServiceUnavailableException);
			// SAFETY: the instanceof check above proves the exception type.
			const thrown = failure as ServiceUnavailableException;
			expect(thrown.getStatus()).toBe(503);
			expect(thrown.getResponse()).toMatchObject({
				code: "V2_MODEL_UNPRICED",
				message: expect.stringContaining("x/unpriced"),
			});
			// Fail closed: no upstream call, no usage row.
			expect(upstream.requests).toHaveLength(0);
			expect(inserted).toHaveLength(0);
		} finally {
			await upstream.close();
		}
	});

	it.each([
		{
			// Pricing v8 D10: a priced model is open to every user. The old
			// plan list denied opus to a starter token with no turn pick.
			plan: "starter",
			requestedModel: "anthropic/claude-opus-5",
			status: 200,
			code: undefined,
			rowStatus: "ok",
			reason: null,
			upstreamCalls: 1,
		},
		{
			// A new minter can drop the claim; the proxy never reads it.
			plan: undefined,
			requestedModel: "anthropic/claude-opus-5",
			status: 200,
			code: undefined,
			rowStatus: "ok",
			reason: null,
			upstreamCalls: 1,
		},
		{
			// A named model with no price row is denied before the provider.
			plan: "starter",
			requestedModel: "x/unpriced",
			status: 403,
			code: "V2_MODEL_DENIED",
			rowStatus: "model_denied",
			reason: "x/unpriced",
			upstreamCalls: 0,
		},
	] as const)("answers $status for $requestedModel with plan claim $plan", async ({
		plan,
		requestedModel,
		status,
		code,
		rowStatus,
		reason,
		upstreamCalls,
	}) => {
		const upstream = await startUpstream(jsonOk("{}"));
		try {
			const env = makeEnv(upstream.baseUrl);
			const { service, inserted } = makeService(env);
			const reply = new FakeReply();
			const { input } = inbound(env, {
				authorization: token(env, { plan }),
				body: Buffer.from(
					JSON.stringify({ model: requestedModel, messages: [] }),
					"utf8",
				),
			});

			await service.proxyAnthropic(input, reply);

			expect(reply.statusCode).toBe(status);
			const body: { code?: string } = JSON.parse(reply.bodyText);
			expect(body.code).toBe(code);
			expect(upstream.requests).toHaveLength(upstreamCalls);
			expect(inserted[0]?.status).toBe(rowStatus);
			expect(inserted[0]?.reason).toBe(reason);
		} finally {
			await upstream.close();
		}
	});

	it("answers 403 V2_MODEL_DISABLED without a retry for a turn model that ops turned off", async () => {
		const upstream = await startUpstream(jsonOk("{}"));
		try {
			const env = makeEnv(upstream.baseUrl);
			const { service, inserted } = makeService(env, fetch, Date.now, [
				"anthropic/claude-opus-5",
			]);
			const reply = new FakeReply();
			// The token allows opus, so only the disabled list refuses it.
			const { input } = inbound(env, {
				authorization: token(env, { model: "anthropic/claude-opus-5" }),
				body: Buffer.from(
					JSON.stringify({ model: "anthropic/claude-opus-5", messages: [] }),
					"utf8",
				),
			});

			await service.proxyAnthropic(input, reply);

			expect(reply.statusCode).toBe(403);
			expect(reply.headers["x-should-retry"]).toBe("false");
			const body: { code?: string } = JSON.parse(reply.bodyText);
			expect(body.code).toBe("V2_MODEL_DISABLED");
			expect(upstream.requests).toHaveLength(0);
			expect(inserted[0]?.status).toBe("model_denied");
		} finally {
			await upstream.close();
		}
	});

	it("normalizes a dated bare model id and forwards it verbatim to api.anthropic.com", async () => {
		// Claude Code resolves its aliases to ids like claude-haiku-4-5-20251001.
		// No socket here: the fetch stub captures the request the service would
		// send to api.anthropic.com.
		const sentBodies: string[] = [];
		const upstreamFetch: typeof fetch = (_input, init) => {
			sentBodies.push(String(init?.body ?? ""));
			return Promise.resolve(
				new Response(
					JSON.stringify({ usage: { input_tokens: 1, output_tokens: 1 } }),
					{ status: 200, headers: { "content-type": "application/json" } },
				),
			);
		};
		const env = makeEnv("https://api.anthropic.com");
		const { inserted, service } = makeService(env, upstreamFetch);
		const reply = new FakeReply();
		const { input } = inbound(env, {
			authorization: token(env, { plan: "starter" }),
			body: Buffer.from(
				JSON.stringify({
					model: "claude-haiku-4-5-20251001",
					messages: [],
				}),
				"utf8",
			),
		});

		await service.proxyAnthropic(input, reply);

		expect(reply.statusCode).toBe(200);
		// Anthropic accepts the dated id; it goes out exactly as sent.
		const sentBody: { model?: string } = JSON.parse(sentBodies[0] ?? "{}");
		expect(sentBody.model).toBe("claude-haiku-4-5-20251001");
		// The row stores the normalized allow-list id so billing sees one name.
		expect(inserted[0]?.model).toBe("anthropic/claude-haiku-4-5");
	});

	it("sends the normalized model id when the upstream is a gateway", async () => {
		const upstream = await startUpstream(
			jsonOk(JSON.stringify({ usage: { input_tokens: 1, output_tokens: 1 } })),
		);
		try {
			const env = makeEnv(upstream.baseUrl);
			const { service, inserted } = makeService(env);
			const { input } = inbound(env, {
				body: Buffer.from(
					JSON.stringify({
						model: "claude-haiku-4-5-20251001",
						messages: [],
					}),
					"utf8",
				),
			});

			await service.proxyAnthropic(input, new FakeReply());

			const sentBody: { model?: string } = JSON.parse(
				upstream.requests[0]?.body.toString("utf8") ?? "{}",
			);
			expect(sentBody.model).toBe("anthropic/claude-haiku-4-5");
			expect(inserted[0]?.model).toBe("anthropic/claude-haiku-4-5");
		} finally {
			await upstream.close();
		}
	});

	it("sends a Paper model to Paper with its own key, and turns the blocks Paper refuses into text", async () => {
		// No socket: the stub captures what would go to api.paperinstruments.com.
		const sent: { url: string; headers: Headers; body: string }[] = [];
		const upstreamFetch: typeof fetch = (url, init) => {
			sent.push({
				url: String(url),
				headers: new Headers(init?.headers),
				body: String(init?.body ?? ""),
			});
			return Promise.resolve(
				new Response(
					JSON.stringify({ usage: { input_tokens: 1, output_tokens: 1 } }),
					{ status: 200, headers: { "content-type": "application/json" } },
				),
			);
		};
		const env: LlmProxyEnv = {
			...makeEnv("https://ai-gateway.vercel.sh"),
			AI_GATEWAY_API_KEY: "gateway-key",
			PAPERINSTRUMENTS_API_KEY: "paper-key",
			V2_DEFAULT_MODEL: "paperinstruments/ultramarine-1-flash",
		};
		const { generations, inserted, service } = makeService(env, upstreamFetch);
		const pdf = {
			type: "document",
			source: {
				type: "base64",
				media_type: "application/pdf",
				data: "JVBERi0=",
			},
		};
		const toolUse = { type: "tool_use", id: "tu_1", name: "Read", input: {} };
		const { input } = inbound(env, {
			claudeSessionId: "b54cbec0-8e68-43dd-9fda-0f9c38be69ae",
			body: Buffer.from(
				JSON.stringify({
					model: "paperinstruments/ultramarine-1-flash",
					messages: [
						{ role: "user", content: [{ type: "text", text: "Read it" }, pdf] },
						{
							role: "assistant",
							// A signed block from a Claude model before a model switch.
							content: [
								{ type: "thinking", thinking: "t", signature: "sig" },
								toolUse,
							],
						},
						{
							role: "user",
							content: [
								{
									type: "tool_result",
									tool_use_id: "tu_1",
									content: [{ type: "text", text: "PDF file" }, pdf],
								},
							],
						},
					],
				}),
				"utf8",
			),
		});

		await service.proxyAnthropic(input, new FakeReply());

		expect(sent[0]?.url).toBe("https://api.paperinstruments.com/v1/messages");
		expect(sent[0]?.headers.get("authorization")).toBe("Bearer paper-key");
		expect(sent[0]?.headers.get("x-session-id")).toBe(
			"b54cbec0-8e68-43dd-9fda-0f9c38be69ae",
		);
		const omitted = {
			type: "text",
			text: expect.stringContaining("Content omitted"),
		};
		expect(JSON.parse(sent[0]?.body ?? "{}")).toMatchObject({
			model: "ultramarine-1-flash",
			messages: [
				{ role: "user", content: [{ type: "text", text: "Read it" }, omitted] },
				{ role: "assistant", content: [omitted, toolUse] },
				{
					role: "user",
					content: [
						{
							type: "tool_result",
							tool_use_id: "tu_1",
							content: [{ type: "text", text: "PDF file" }, omitted],
						},
					],
				},
			],
		});
		expect(inserted[0]).toMatchObject({
			model: "paperinstruments/ultramarine-1-flash",
			provider: "paperinstruments",
		});
		// Langfuse gets the rewrite the model read, not the inbound body.
		expect(generations[0]?.forwardedBody.toString("utf8")).toBe(sent[0]?.body);
	});

	describe("a model with text-only hosts", () => {
		const gatewayEnv: LlmProxyEnv = {
			...makeEnv("https://ai-gateway.vercel.sh"),
			AI_GATEWAY_API_KEY: "gateway-key",
		};
		const jsonUsage = () =>
			new Response(
				JSON.stringify({ usage: { input_tokens: 1, output_tokens: 1 } }),
				{ status: 200, headers: { "content-type": "application/json" } },
			);
		const pngImage = {
			type: "image",
			source: {
				type: "base64",
				media_type: "image/png",
				data: Buffer.from("png-bytes-of-the-band").toString("base64"),
			},
		};
		// The Read tool of Claude Code puts the cache breakpoint on its last block.
		const webpImage = {
			type: "image",
			source: {
				type: "base64",
				media_type: "image/webp",
				data: Buffer.from("webp-bytes-of-the-diff").toString("base64"),
			},
			cache_control: { type: "ephemeral" },
		};
		const toolUse = { type: "tool_use", id: "tu_1", name: "Read", input: {} };
		const bodyWithImages = (model: string) =>
			Buffer.from(
				JSON.stringify({
					model,
					messages: [
						{
							role: "user",
							content: [{ type: "text", text: "Clone this" }, pngImage],
						},
						{ role: "assistant", content: [toolUse] },
						{
							role: "user",
							content: [
								{
									type: "tool_result",
									tool_use_id: "tu_1",
									content: [{ type: "text", text: "Image file" }, webpImage],
								},
							],
						},
					],
				}),
				"utf8",
			);
		const described = {
			type: "text",
			text: expect.stringContaining('A blue button with the text "Buy".'),
		};

		it("turns a top-level image and a tool_result image into description text, bills the describer, and keeps the other blocks", async () => {
			const { upstreamFetch, sent } = scriptedFetch([jsonUsage]);
			const describer = fakeDescriber(async () => BLUE_BUTTON_DESCRIPTION);
			const { counters, inserted, service } = makeService(
				gatewayEnv,
				upstreamFetch,
				Date.now,
				[],
				describer.describer,
			);
			const { input } = inbound(gatewayEnv, {
				body: bodyWithImages("zai/glm-5.3"),
			});

			await service.proxyAnthropic(input, new FakeReply());

			expect(JSON.parse(sent[0]?.body ?? "{}")).toEqual({
				model: "zai/glm-5.3",
				messages: [
					{
						role: "user",
						content: [{ type: "text", text: "Clone this" }, described],
					},
					{ role: "assistant", content: [toolUse] },
					{
						role: "user",
						content: [
							{
								type: "tool_result",
								tool_use_id: "tu_1",
								content: [
									{ type: "text", text: "Image file" },
									{ ...described, cache_control: { type: "ephemeral" } },
								],
							},
						],
					},
				],
			});
			expect(describer.described.map((image) => image.mediaType)).toEqual([
				"image/png",
				"image/webp",
			]);
			// Two describer rows bill the turn, then the row of the builder request.
			expect(
				inserted.filter((row) => row.reason === "image_description"),
			).toEqual([
				expect.objectContaining({
					model: "google/gemini-3-flash",
					status: "ok",
					usdMicros: 1100,
					turnId: claimsInput.turnId,
				}),
				expect.objectContaining({ usdMicros: 1100 }),
			]);
			expect(inserted.at(-1)?.model).toBe("zai/glm-5.3");
			expect(await counters.readRunSpend("run_test")).toBeGreaterThanOrEqual(
				2200,
			);
		});

		it("reads a description from the cache without a second describer call, and sends the same bytes again", async () => {
			const { upstreamFetch, sent } = scriptedFetch([jsonUsage, jsonUsage]);
			const describer = fakeDescriber(async () => BLUE_BUTTON_DESCRIPTION);
			const { service } = makeService(
				gatewayEnv,
				upstreamFetch,
				Date.now,
				[],
				describer.describer,
			);

			for (let call = 0; call < 2; call += 1) {
				const { input } = inbound(gatewayEnv, {
					body: bodyWithImages("zai/glm-5.3"),
				});
				await service.proxyAnthropic(input, new FakeReply());
			}

			expect(describer.described).toHaveLength(2);
			// The prompt cache of the second call hits only on the same bytes.
			expect(sent[1]?.body).toBe(sent[0]?.body);
		});

		it("puts the fixed text in place of the image when the describer fails, and caches it for 10 minutes only", async () => {
			const { upstreamFetch, sent } = scriptedFetch([jsonUsage, jsonUsage]);
			const describer = fakeDescriber(async () => {
				throw new Error("gateway timeout");
			});
			const { blockTextTtls, inserted, service } = makeService(
				gatewayEnv,
				upstreamFetch,
				Date.now,
				[],
				describer.describer,
			);

			for (let call = 0; call < 2; call += 1) {
				const { input } = inbound(gatewayEnv, {
					body: bodyWithImages("zai/glm-5.3-fast"),
				});
				await service.proxyAnthropic(input, new FakeReply());
			}

			const sentBody = sent[0]?.body ?? "";
			expect(sentBody).not.toContain('"type":"image"');
			expect(
				sentBody.match(/Image omitted: the image could not be described/g),
			).toHaveLength(2);
			// The second request of the loop does not wait for the describer again.
			expect(describer.described).toHaveLength(2);
			expect(sent[1]?.body).toBe(sentBody);
			expect([...blockTextTtls.values()]).toEqual([600, 600]);
			expect(inserted.map((row) => row.model)).toEqual([
				"zai/glm-5.3-fast",
				"zai/glm-5.3-fast",
			]);
		});

		it.each([
			{
				name: "an empty answer caches the fixed text for 10 minutes",
				answer: { ...BLUE_BUTTON_DESCRIPTION, text: "" },
				sentText: "Image omitted: the image could not be described",
				ttlSec: 600,
			},
			{
				name: "an answer cut at the output cap caches the text with a cut line for 7 days",
				answer: { ...BLUE_BUTTON_DESCRIPTION, finishReason: "length" as const },
				sentText: "The description stops here",
				ttlSec: 604_800,
			},
		])("$name, so one image is billed once", async ({
			answer,
			sentText,
			ttlSec,
		}) => {
			const { upstreamFetch, sent } = scriptedFetch([jsonUsage, jsonUsage]);
			const describer = fakeDescriber(async () => answer);
			const { blockTextTtls, inserted, service } = makeService(
				gatewayEnv,
				upstreamFetch,
				Date.now,
				[],
				describer.describer,
			);

			for (let call = 0; call < 2; call += 1) {
				const { input } = inbound(gatewayEnv, {
					body: bodyWithImages("zai/glm-5.3"),
				});
				await service.proxyAnthropic(input, new FakeReply());
			}

			expect(sent[0]?.body).toContain(sentText);
			expect(sent[1]?.body).toBe(sent[0]?.body);
			expect(describer.described).toHaveLength(2);
			expect([...blockTextTtls.values()]).toEqual([ttlSec, ttlSec]);
			expect(
				inserted.filter((row) => row.reason === "image_description"),
			).toHaveLength(2);
		});

		it("forwards the request of a model outside the set untouched", async () => {
			const { upstreamFetch, sent } = scriptedFetch([jsonUsage]);
			const describer = fakeDescriber(async () => BLUE_BUTTON_DESCRIPTION);
			const { service } = makeService(
				gatewayEnv,
				upstreamFetch,
				Date.now,
				[],
				describer.describer,
			);
			const body = bodyWithImages("deepseek/deepseek-v4.1-flash-1017");
			const { input } = inbound(gatewayEnv, { body });

			await service.proxyAnthropic(input, new FakeReply());

			expect(sent[0]?.body).toBe(body.toString("utf8"));
			expect(describer.described).toHaveLength(0);
		});
	});

	it("sends the Claude Code session id to the gateway as x-session-id", async () => {
		const { upstreamFetch, sent } = scriptedFetch([
			() => sseResponse(SSE_STREAM),
		]);
		const env: LlmProxyEnv = {
			...makeEnv("https://ai-gateway.vercel.sh"),
			AI_GATEWAY_API_KEY: "gateway-key",
		};
		const { service } = makeService(env, upstreamFetch);
		const { input } = inbound(env, {
			claudeSessionId: "b54cbec0-8e68-43dd-9fda-0f9c38be69ae",
		});

		await service.proxyAnthropic(input, new FakeReply());

		// The gateway pins the session to the credential that holds its cache.
		expect(sent[0]?.headers.get("x-session-id")).toBe(
			"b54cbec0-8e68-43dd-9fda-0f9c38be69ae",
		);
	});

	const toolResult = {
		type: "tool_result",
		tool_use_id: "tu_1",
		content: "ok",
	};
	it.each([
		{ name: "only a tool_result", toolLoopContent: [toolResult] },
		// Claude Code adds system reminders as text blocks next to the tool_result.
		{
			name: "a tool_result and a text block",
			toolLoopContent: [
				toolResult,
				{ type: "text", text: "<system-reminder>x</system-reminder>" },
			],
		},
	])("retries a Claude 400 for a foreign thinking signature once, without the thinking of earlier turns ($name)", async ({
		toolLoopContent,
	}) => {
		// The gateway answer of a live probe: Gemini history, then Opus.
		const signatureError = JSON.stringify({
			error: {
				message:
					"messages.1.content.0: Invalid `signature` in `thinking` block",
				type: "AI_APICallError",
			},
		});
		const { upstreamFetch, sent } = scriptedFetch([
			() =>
				new Response(signatureError, {
					status: 400,
					headers: { "content-type": "application/json" },
				}),
			() => sseResponse(SSE_STREAM),
		]);
		const env: LlmProxyEnv = {
			...makeEnv("https://ai-gateway.vercel.sh"),
			AI_GATEWAY_API_KEY: "gateway-key",
			V2_DEFAULT_MODEL: "anthropic/claude-opus-5.5",
		};
		const { inserted, service } = makeService(env, upstreamFetch);
		const toolUse = { type: "tool_use", id: "tu_1", name: "Read", input: {} };
		const opusTurn = {
			role: "assistant",
			content: [
				{ type: "thinking", thinking: "o", signature: "opus-sig" },
				toolUse,
			],
		};
		const { input } = inbound(env, {
			body: Buffer.from(
				JSON.stringify({
					model: "anthropic/claude-opus-5.5",
					messages: [
						{ role: "user", content: "Build it" },
						// An earlier turn on Gemini, before the slider moved to Opus.
						{
							role: "assistant",
							content: [
								{ type: "thinking", thinking: "g", signature: "gemini-sig" },
								{ type: "text", text: "Done" },
							],
						},
						{ role: "user", content: [{ type: "text", text: "Add a page" }] },
						opusTurn,
						{ role: "user", content: toolLoopContent },
					],
				}),
				"utf8",
			),
		});
		const reply = new FakeReply();

		await service.proxyAnthropic(input, reply);

		expect(sent).toHaveLength(2);
		const retried: { messages: { content: unknown }[] } = JSON.parse(
			sent[1]?.body ?? "{}",
		);
		expect(retried.messages[1]?.content).toEqual([
			{ type: "text", text: "Done" },
		]);
		// The current tool loop keeps the thinking that Opus signed.
		expect(retried.messages[3]).toEqual(opusTurn);
		// The client sees only the answer of the retry.
		expect(reply.statusCode).toBe(200);
		expect(reply.bodyText).not.toContain("signature");
		expect(inserted).toHaveLength(1);
		expect(inserted[0]?.status).toBe("ok");
		expect(inserted[0]?.inputTokens).toBe(120);
	});

	// Claude Code sends the Claude 1M beta for every `[1m]` model id. Paper
	// answered 400 to other betas that it does not know.
	const claudeCodeBetas =
		"claude-code-20250219, context-1m-2025-08-07,effort-2025-11-24";
	it.each([
		{
			model: "paperinstruments/ultramarine-1-flash",
			inboundBeta: claudeCodeBetas,
			sentBeta: "claude-code-20250219,effort-2025-11-24",
		},
		{
			model: "zai/glm-5.3",
			inboundBeta: claudeCodeBetas,
			sentBeta: "claude-code-20250219,effort-2025-11-24",
		},
		{
			model: "anthropic/claude-sonnet-5",
			inboundBeta: claudeCodeBetas,
			sentBeta: claudeCodeBetas,
		},
		{
			model: "zai/glm-5.3-flash",
			inboundBeta: "context-1m-2025-08-07",
			sentBeta: null,
		},
	])("drops the 1M beta only for a model that is not Claude ($model)", async ({
		model,
		inboundBeta,
		sentBeta,
	}) => {
		const sent: Headers[] = [];
		const upstreamFetch: typeof fetch = (_url, init) => {
			sent.push(new Headers(init?.headers));
			return Promise.resolve(
				new Response(
					JSON.stringify({ usage: { input_tokens: 1, output_tokens: 1 } }),
					{ status: 200, headers: { "content-type": "application/json" } },
				),
			);
		};
		const env: LlmProxyEnv = {
			...makeEnv("https://ai-gateway.vercel.sh"),
			AI_GATEWAY_API_KEY: "gateway-key",
			PAPERINSTRUMENTS_API_KEY: "paper-key",
			// A plan may call only the deploy default model and Haiku.
			V2_DEFAULT_MODEL: model,
		};
		const { service } = makeService(env, upstreamFetch);
		const { input } = inbound(env, {
			anthropicBeta: inboundBeta,
			body: Buffer.from(JSON.stringify({ model, messages: [] }), "utf8"),
		});

		await service.proxyAnthropic(input, new FakeReply());

		expect(sent[0]?.get("anthropic-beta")).toBe(sentBeta);
	});

	const wanditIdentityLine =
		"You are the Wandit builder, an AI assistant that builds apps for Wandit users.";

	it("swaps the Claude Code identity for the Wandit persona in system and user text", async () => {
		const sentBodies: string[] = [];
		const upstreamFetch: typeof fetch = (_input, init) => {
			sentBodies.push(String(init?.body ?? ""));
			return Promise.resolve(
				new Response(
					JSON.stringify({ usage: { input_tokens: 1, output_tokens: 1 } }),
					{ status: 200, headers: { "content-type": "application/json" } },
				),
			);
		};
		const env = makeEnv("https://api.anthropic.com");
		const { service } = makeService(env, upstreamFetch);
		const cacheControl = { type: "ephemeral", ttl: "1h" };
		const billingHeader = {
			type: "text",
			text: "x-anthropic-billing-header: cc_version=2.1.281; cc_entrypoint=sdk-ts;",
		};
		const userText = { type: "text", text: "Build a todo app." };
		const { input } = inbound(env, {
			body: Buffer.from(
				JSON.stringify({
					model: "claude-sonnet-5",
					system: [
						billingHeader,
						{
							type: "text",
							text: "You are Claude Code, Anthropic's official CLI for Claude, running within the Claude Agent SDK.",
							cache_control: cacheControl,
						},
						{
							type: "text",
							text: "# Doing tasks\n - Read code before you change it.\n - If the user asks for help or wants to give feedback inform them of the following:\n  - /help: Get help with using Claude Code\n  - To give feedback, users should report the issue at https://github.com/anthropics/claude-code/issues\n\n# Environment\n - Primary working directory: /vercel/sandbox\n - The most recent Claude models are the Claude 5 family. Model IDs are claude-opus-5.\n - Claude Code is available as a CLI in the terminal, a desktop app, and a web app.\n - Fast mode for Claude Code uses the same model with faster output.\n",
							cache_control: cacheControl,
						},
					],
					messages: [
						{
							role: "user",
							content: [
								{
									type: "text",
									text: "<system-reminder>\nYou are powered by the model named Opus 4.8. The exact model ID is claude-opus-4-8[1m]. Assistant knowledge cutoff is January 2026.\n</system-reminder>",
								},
								userText,
							],
						},
					],
				}),
				"utf8",
			),
		});

		await service.proxyAnthropic(input, new FakeReply());

		expect(JSON.parse(sentBodies[0] ?? "{}")).toEqual({
			model: "claude-sonnet-5",
			system: [
				billingHeader,
				{ type: "text", text: wanditIdentityLine, cache_control: cacheControl },
				{
					type: "text",
					text: "# Doing tasks\n - Read code before you change it.\n\n# Environment\n - Primary working directory: /vercel/sandbox\n",
					cache_control: cacheControl,
				},
			],
			messages: [
				{
					role: "user",
					content: [
						{ type: "text", text: "<system-reminder>\n\n</system-reminder>" },
						userText,
					],
				},
			],
		});
	});

	// A gateway model has no marketing name, so its sentence names only the id.
	const gatewayModelSentence =
		"You are powered by the model deepseek/deepseek-v4.1-flash-1017.";
	it.each([
		{
			where: "a string system",
			body: {
				system: `You are Claude Code, Anthropic's official CLI for Claude.\n${gatewayModelSentence} Assistant knowledge cutoff is May 2025.\nBuild apps.`,
				messages: [],
			},
			sent: { system: `${wanditIdentityLine}\n\nBuild apps.`, messages: [] },
		},
		{
			where: "a string user content, not the assistant",
			body: {
				messages: [
					{ role: "user", content: `${gatewayModelSentence}\nHi` },
					{ role: "assistant", content: gatewayModelSentence },
				],
			},
			sent: {
				messages: [
					{ role: "user", content: "\nHi" },
					{ role: "assistant", content: gatewayModelSentence },
				],
			},
		},
	])("removes the gateway model sentence from $where", async ({
		body,
		sent,
	}) => {
		const sentBodies: string[] = [];
		const upstreamFetch: typeof fetch = (_input, init) => {
			sentBodies.push(String(init?.body ?? ""));
			return Promise.resolve(
				new Response(
					JSON.stringify({ usage: { input_tokens: 1, output_tokens: 1 } }),
					{ status: 200, headers: { "content-type": "application/json" } },
				),
			);
		};
		const model = "deepseek/deepseek-v4.1-flash-1017";
		const env: LlmProxyEnv = {
			...makeEnv("https://ai-gateway.vercel.sh"),
			AI_GATEWAY_API_KEY: "gateway-key",
			V2_DEFAULT_MODEL: model,
		};
		const { service } = makeService(env, upstreamFetch);
		const { input } = inbound(env, {
			body: Buffer.from(JSON.stringify({ model, ...body }), "utf8"),
		});

		await service.proxyAnthropic(input, new FakeReply());

		expect(JSON.parse(sentBodies[0] ?? "{}")).toEqual({ model, ...sent });
	});

	it("streams SSE chunks as they arrive and writes the usage row", async () => {
		const upstream = await startUpstream((_req, res) => {
			res.writeHead(200, { "content-type": "text/event-stream" });
			for (const frame of SSE_STREAM.split("\n\n")) {
				if (frame.length > 0) {
					res.write(`${frame}\n\n`);
				}
			}
			res.end();
		});
		try {
			const env = makeEnv(upstream.baseUrl);
			const { service, inserted, counters, generations } = makeService(env);
			const reply = new FakeReply();
			const { input } = inbound(env);

			await service.proxyAnthropic(input, reply);

			expect(reply.statusCode).toBe(200);
			expect(reply.headers["content-type"]).toBe("text/event-stream");
			// The client saw the stream bytes, not a repackaged body.
			expect(reply.bodyText).toContain("message_start");
			expect(reply.bodyText).toContain("message_stop");
			const row = inserted[0];
			expect(row?.status).toBe("ok");
			expect(row?.inputTokens).toBe(120);
			expect(row?.outputTokens).toBe(17);
			expect(row?.cacheReadTokens).toBe(30);
			expect(row?.cacheWriteTokens).toBe(40);
			// Sonnet price: 120*$2 + 17*$10 + 30*$0.2 + 40*$4 per MTok.
			expect(row?.usdMicros).toBe(576);
			expect(await counters.readRunSpend("run_test")).toBe(576);
			expect(row?.provider).toBe("anthropic");
			expect(row?.claudeSessionId).toBe("sess_9");
			// The row exists, so the request no longer counts as in flight.
			expect(await counters.readInFlight("run_test")).toBe(0);
			// One generation with the rebuilt answer and the sent bytes.
			expect(generations).toHaveLength(1);
			expect(generations[0]?.message?.stopReason).toBe("end_turn");
			expect(generations[0]?.forwardedBody).toEqual(upstream.requests[0]?.body);
		} finally {
			await upstream.close();
		}
	});

	const [messageStartFrame] = SSE_STREAM.split("\n\n");
	it.each([
		{
			stream: `${messageStartFrame}\n\nevent: error\ndata: {"type":"error","error":{"type":"overloaded_error","message":"Overloaded"}}\n\n`,
			reason: "stream_error:overloaded_error",
		},
		{
			// The stream ends cleanly before `message_stop`.
			stream: SSE_STREAM.split("event: message_stop")[0] ?? "",
			reason: "stream_truncated",
		},
	])("keeps an ok, billed row with reason $reason", async ({
		stream,
		reason,
	}) => {
		const { upstreamFetch } = scriptedFetch([() => sseResponse(stream)]);
		const env = makeEnv("https://api.anthropic.com");
		const { inserted, service } = makeService(env, upstreamFetch);

		await service.proxyAnthropic(inbound(env).input, new FakeReply());

		// The settle bills only ok rows; the tokens before the problem count.
		expect(inserted[0]?.status).toBe("ok");
		expect(inserted[0]?.reason).toBe(reason);
		expect(inserted[0]?.inputTokens).toBe(120);
	});

	it("answers 401 on a bad, expired, or wrongly-signed token", async () => {
		const upstream = await startUpstream(jsonOk("{}"));
		try {
			const env = makeEnv(upstream.baseUrl);
			const { service, inserted } = makeService(env);

			const bad = new FakeReply();
			await service.proxyAnthropic(
				{ ...inbound(env).input, authorization: "Bearer garbage.sig" },
				bad,
			);
			expect(bad.statusCode).toBe(401);

			const expired = new FakeReply();
			const pastSeconds = Math.floor(Date.now() / 1000) - 4000;
			await service.proxyAnthropic(
				{
					...inbound(env).input,
					authorization: `Bearer ${mintLlmProxyToken(claimsInput, env, pastSeconds)}`,
				},
				expired,
			);
			expect(expired.statusCode).toBe(401);

			const wrongKey = new FakeReply();
			await service.proxyAnthropic(
				{
					...inbound(env).input,
					authorization: `Bearer ${mintLlmProxyToken(claimsInput, { LLM_PROXY_SIGNING_KEY: "other-key" })}`,
				},
				wrongKey,
			);
			expect(wrongKey.statusCode).toBe(401);

			expect(upstream.requests).toHaveLength(0);
			expect(inserted).toHaveLength(0);
		} finally {
			await upstream.close();
		}
	});

	it("answers 401 for a token whose run was revoked and writes no row", async () => {
		const upstream = await startUpstream(jsonOk("{}"));
		try {
			const env = makeEnv(upstream.baseUrl);
			const { service, counters, inserted } = makeService(env);
			// The turn ended; the still-valid token must now read as dead.
			await counters.revokeRun("run_test", 3600);

			const reply = new FakeReply();
			await service.proxyAnthropic(inbound(env).input, reply);

			expect(reply.statusCode).toBe(401);
			const body: { code: string } = JSON.parse(reply.bodyText);
			expect(body.code).toBe("V2_TOKEN_INVALID");
			expect(upstream.requests).toHaveLength(0);
			expect(inserted).toHaveLength(0);
			// A refused request must not hold the settle wait of the turn.
			expect(await counters.readInFlight("run_test")).toBe(0);
		} finally {
			await upstream.close();
		}
	});

	it("bills a token of an older turn to the turn its chat runs now", async () => {
		const upstream = await startUpstream(jsonOk("{}"));
		try {
			const env = makeEnv(upstream.baseUrl);
			const { service, counters, generations, inserted } = makeService(env);
			const chatId = "6f7c8287-138f-40ef-b7a9-4dfdfd3c3d25";
			const nowTurnId = "11111111-1111-4111-8111-111111111111";
			// The paused turn ended and its run is dead; the answer turn runs.
			await counters.revokeRun("run_test", 3600);
			await counters.bindChat(
				chatId,
				{ ...claimsInput, runId: "run_now", turnId: nowTurnId },
				3600,
			);

			const reply = new FakeReply();
			await service.proxyAnthropic(
				inbound(env, { authorization: token(env, { chatId }) }).input,
				reply,
			);

			expect(reply.statusCode).toBe(200);
			expect(inserted[0]?.runId).toBe("run_now");
			expect(inserted[0]?.turnId).toBe(nowTurnId);
			expect(await counters.readInFlight("run_now")).toBe(0);
			// The call joins the Langfuse trace of the turn that runs now.
			expect(generations[0]?.claims.turnId).toBe(nowTurnId);
		} finally {
			await upstream.close();
		}
	});

	it("accepts an expired token of a chat with a live binding and bills the bound turn", async () => {
		const upstream = await startUpstream(
			jsonOk(
				JSON.stringify({ usage: { input_tokens: 100, output_tokens: 10 } }),
			),
		);
		try {
			const env = makeEnv(upstream.baseUrl);
			let counterNowMs = Date.now();
			const { service, counters, inserted } = makeService(
				env,
				fetch,
				() => counterNowMs,
			);
			const chatId = "6f7c8287-138f-40ef-b7a9-4dfdfd3c3d25";
			const nowTurnId = "11111111-1111-4111-8111-111111111111";
			await counters.bindChat(
				chatId,
				{ ...claimsInput, runId: "run_now", turnId: nowTurnId },
				3600,
			);
			// A kept process still sends the token of a turn 3 h ago. It expired
			// 115 min ago, so its own `exp` gives the spend counter a 60 s TTL.
			const pastSeconds = Math.floor(Date.now() / 1000) - 3 * 60 * 60;
			const expiredToken = mintLlmProxyToken(
				{ ...claimsInput, chatId },
				env,
				pastSeconds,
			);

			const reply = new FakeReply();
			await service.proxyAnthropic(
				inbound(env, { authorization: `Bearer ${expiredToken}` }).input,
				reply,
			);

			expect(reply.statusCode).toBe(200);
			expect(upstream.requests).toHaveLength(1);
			expect(inserted[0]?.runId).toBe("run_now");
			expect(inserted[0]?.turnId).toBe(nowTurnId);
			// The run cap of the bound turn still counts the spend 2 min later.
			// Sonnet price: 100*$2 + 10*$10 per MTok = 300 micros.
			counterNowMs += 2 * 60_000;
			expect(await counters.readRunSpend("run_now")).toBe(300);
		} finally {
			await upstream.close();
		}
	});

	it.each([
		{ name: "no live binding", bind: false, signingKey: undefined },
		{ name: "a bad signature", bind: true, signingKey: "other-key" },
	])("answers 401 to an expired chat token with $name", async ({
		bind,
		signingKey,
	}) => {
		const upstream = await startUpstream(jsonOk("{}"));
		try {
			const env = makeEnv(upstream.baseUrl);
			const { service, counters, inserted } = makeService(env);
			const chatId = "6f7c8287-138f-40ef-b7a9-4dfdfd3c3d25";
			if (bind) {
				await counters.bindChat(
					chatId,
					{ ...claimsInput, runId: "run_now" },
					3600,
				);
			}
			const pastSeconds = Math.floor(Date.now() / 1000) - 70 * 60;
			const expiredToken = mintLlmProxyToken(
				{ ...claimsInput, chatId },
				signingKey === undefined ? env : { LLM_PROXY_SIGNING_KEY: signingKey },
				pastSeconds,
			);

			const reply = new FakeReply();
			await service.proxyAnthropic(
				inbound(env, { authorization: `Bearer ${expiredToken}` }).input,
				reply,
			);

			expect(reply.statusCode).toBe(401);
			expect(upstream.requests).toHaveLength(0);
			expect(inserted).toHaveLength(0);
			// A refused request must not hold the settle wait of any turn.
			expect(await counters.readInFlight("run_test")).toBe(0);
			expect(await counters.readInFlight("run_now")).toBe(0);
		} finally {
			await upstream.close();
		}
	});

	it("answers 401 when the bound turn's run was revoked", async () => {
		const upstream = await startUpstream(jsonOk("{}"));
		try {
			const env = makeEnv(upstream.baseUrl);
			const { service, counters, inserted } = makeService(env);
			const chatId = "6f7c8287-138f-40ef-b7a9-4dfdfd3c3d25";
			await counters.bindChat(
				chatId,
				{ ...claimsInput, runId: "run_now" },
				3600,
			);
			// A cancel revokes the run of the turn that runs now.
			await counters.revokeRun("run_now", 3600);

			const reply = new FakeReply();
			await service.proxyAnthropic(
				inbound(env, { authorization: token(env, { chatId }) }).input,
				reply,
			);

			expect(reply.statusCode).toBe(401);
			expect(upstream.requests).toHaveLength(0);
			expect(inserted).toHaveLength(0);
		} finally {
			await upstream.close();
		}
	});

	it("keeps the request in flight until its row insert ends", async () => {
		const upstream = await startUpstream(jsonOk("{}"));
		try {
			const env = makeEnv(upstream.baseUrl);
			const counters = new FakeLlmSpendCounters();
			const inFlightAtInsert: number[] = [];
			const service = new LlmProxyService(
				env,
				counters,
				{
					insert: async () => {
						inFlightAtInsert.push(await counters.readInFlight("run_test"));
						return { id: "row-1" };
					},
				},
				fetch,
				null,
				{ get: async () => ({ v2DisabledModels: [] }) },
				{ getMany: async () => new Map(), set: async () => undefined },
				fakeDescriber(async () => BLUE_BUTTON_DESCRIPTION).describer,
			);

			await service.proxyAnthropic(inbound(env).input, new FakeReply());

			// The settle waits for 0, so the count must drop only after the row.
			expect(inFlightAtInsert).toEqual([1]);
			expect(await counters.readInFlight("run_test")).toBe(0);
		} finally {
			await upstream.close();
		}
	});

	it("accepts a token signed with the second configured key", async () => {
		const upstream = await startUpstream(
			jsonOk(JSON.stringify({ usage: { input_tokens: 1, output_tokens: 1 } })),
		);
		try {
			const env = makeEnv(upstream.baseUrl);
			const { service } = makeService(env);
			const payload = {
				...claimsInput,
				exp: Math.floor(Date.now() / 1000) + 600,
			};
			const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString(
				"base64url",
			);
			const signature = createHmac("sha256", "signing-b")
				.update(encoded)
				.digest("base64url");

			const reply = new FakeReply();
			await service.proxyAnthropic(
				{
					...inbound(env).input,
					authorization: `Bearer ${encoded}.${signature}`,
				},
				reply,
			);
			expect(reply.statusCode).toBe(200);
		} finally {
			await upstream.close();
		}
	});

	it("answers 402 when the run spend cap is reached", async () => {
		const upstream = await startUpstream(jsonOk("{}"));
		try {
			const env = makeEnv(upstream.baseUrl);
			const { service, counters, inserted } = makeService(env);
			// capUsd 1 → 1_000_000 micros already spent.
			await counters.addRunSpend("run_test", 1_000_000, 3600);

			const reply = new FakeReply();
			await service.proxyAnthropic(inbound(env).input, reply);

			expect(reply.statusCode).toBe(402);
			const body: { code: string } = JSON.parse(reply.bodyText);
			expect(body.code).toBe("V2_RUN_CAP_REACHED");
			expect(upstream.requests).toHaveLength(0);
			expect(inserted[0]?.status).toBe("cap_rejected");
			expect(inserted[0]?.reason).toBe("run_cap");
		} finally {
			await upstream.close();
		}
	});

	it("answers 402 when the user daily cap is reached", async () => {
		const upstream = await startUpstream(jsonOk("{}"));
		try {
			const env = makeEnv(upstream.baseUrl);
			const { service, counters, inserted } = makeService(env);
			const dayKey = new Date().toISOString().slice(0, 10).replaceAll("-", "");
			await counters.addUserSpend(
				"user_1",
				dayKey,
				// USD to micros: the day counter stores micros.
				LLM_PROXY_DAILY_USER_CAP_USD * 1_000_000,
			);

			const reply = new FakeReply();
			await service.proxyAnthropic(inbound(env).input, reply);

			expect(reply.statusCode).toBe(402);
			expect(inserted[0]?.status).toBe("cap_rejected");
			expect(inserted[0]?.reason).toBe("daily_cap");
		} finally {
			await upstream.close();
		}
	});

	it("forwards past the daily cap when LLM_DAILY_CAP_OFF is on", async () => {
		const upstream = await startUpstream(jsonOk("{}"));
		try {
			const env: LlmProxyEnv = {
				...makeEnv(upstream.baseUrl),
				LLM_DAILY_CAP_OFF: true,
			};
			const { service, counters } = makeService(env);
			const dayKey = new Date().toISOString().slice(0, 10).replaceAll("-", "");
			await counters.addUserSpend(
				"user_1",
				dayKey,
				// USD to micros: the day counter stores micros.
				LLM_PROXY_DAILY_USER_CAP_USD * 1_000_000,
			);

			const reply = new FakeReply();
			await service.proxyAnthropic(inbound(env).input, reply);

			expect(reply.statusCode).toBe(200);
			expect(upstream.requests).toHaveLength(1);
		} finally {
			await upstream.close();
		}
	});

	it("forwards past both spend caps when billing is off", async () => {
		const upstream = await startUpstream(jsonOk("{}"));
		try {
			const env: LlmProxyEnv = {
				...makeEnv(upstream.baseUrl),
				GENERATION_BILLING_MODE: "off",
			};
			const { service, counters } = makeService(env);
			const dayKey = new Date().toISOString().slice(0, 10).replaceAll("-", "");
			await counters.addRunSpend("run_test", 1_000_000, 3600);
			await counters.addUserSpend(
				"user_1",
				dayKey,
				// USD to micros: the day counter stores micros.
				LLM_PROXY_DAILY_USER_CAP_USD * 1_000_000,
			);

			const reply = new FakeReply();
			await service.proxyAnthropic(inbound(env).input, reply);

			expect(reply.statusCode).toBe(200);
			expect(upstream.requests).toHaveLength(1);
		} finally {
			await upstream.close();
		}
	});

	it("answers 429 with retry-after when the run rate limit is exceeded", async () => {
		const upstream = await startUpstream(jsonOk("{}"));
		try {
			const env = makeEnv(upstream.baseUrl);
			const { service, counters, inserted } = makeService(env);
			for (let i = 0; i < 120; i += 1) {
				await counters.admitRequest(
					{ chatId: null, runId: "run_test", userId: "user_1" },
					"20260101",
				);
			}

			const reply = new FakeReply();
			await service.proxyAnthropic(inbound(env).input, reply);

			expect(reply.statusCode).toBe(429);
			expect(reply.headers["retry-after"]).toBe("60");
			expect(upstream.requests).toHaveLength(0);
			expect(inserted[0]?.status).toBe("rate_limited");
		} finally {
			await upstream.close();
		}
	});

	it("writes a client_aborted row when the client disconnects mid-stream", async () => {
		const upstream = await startUpstream((_req, res) => {
			res.writeHead(200, { "content-type": "text/event-stream" });
			const frames = SSE_STREAM.split("\n\n");
			const messageStart = frames[0];
			const messageDelta = frames[2];
			if (messageStart === undefined || messageDelta === undefined) {
				throw new Error("canned stream is empty");
			}
			// message_start carries input and cache counts, message_delta the
			// output count. The rest never arrives: the client aborts and the
			// socket just stays open until teardown.
			res.write(`${messageStart}\n\n${messageDelta}\n\n`);
		});
		try {
			const env = makeEnv(upstream.baseUrl);
			const { service, inserted } = makeService(env);
			const reply = new FakeReply();
			const { abort, input } = inbound(env);
			reply.onWrite = () => {
				// The parser feeds each chunk before the write, so a delta in the
				// relayed bytes is already counted.
				if (reply.bodyText.includes("message_delta")) {
					abort.abort();
				}
			};

			await service.proxyAnthropic(input, reply);

			expect(inserted[0]?.status).toBe("client_aborted");
			expect(inserted[0]?.reason).toBe("client_aborted");
			// Counts seen before the abort are kept and priced.
			expect(inserted[0]?.inputTokens).toBe(120);
			expect(inserted[0]?.outputTokens).toBe(17);
			expect(inserted[0]?.usdMicros).toBeGreaterThan(0);
		} finally {
			await upstream.close();
		}
	});

	it("writes upstream_error and forwards a 5xx unchanged", async () => {
		const upstream = await startUpstream((_req, res) => {
			res.writeHead(500, { "content-type": "application/json" });
			res.end(JSON.stringify({ type: "error", error: { type: "api_error" } }));
		});
		try {
			const env = makeEnv(upstream.baseUrl);
			const { service, inserted } = makeService(env);
			const reply = new FakeReply();

			await service.proxyAnthropic(inbound(env).input, reply);

			expect(reply.statusCode).toBe(500);
			expect(reply.bodyText).toContain("api_error");
			expect(inserted[0]?.status).toBe("upstream_error");
			expect(inserted[0]?.reason).toBe("upstream_500");
		} finally {
			await upstream.close();
		}
	});

	it("writes upstream_error and forwards a 401 when the provider rejects the key", async () => {
		const upstream = await startUpstream((_req, res) => {
			res.writeHead(401, { "content-type": "application/json" });
			res.end(
				JSON.stringify({
					type: "error",
					error: { type: "authentication_error" },
				}),
			);
		});
		try {
			const env = makeEnv(upstream.baseUrl);
			const { service, inserted } = makeService(env);
			const reply = new FakeReply();

			await service.proxyAnthropic(inbound(env).input, reply);

			expect(reply.statusCode).toBe(401);
			expect(reply.bodyText).toContain("authentication_error");
			expect(inserted[0]?.status).toBe("upstream_error");
			expect(inserted[0]?.reason).toBe("upstream_401");
		} finally {
			await upstream.close();
		}
	});

	// Claude Code retries a 429 for minutes, but not a 402.
	it.each([
		{ errorType: "insufficient_quota", clientStatus: 402 },
		{ errorType: "rate_limit_error", clientStatus: 429 },
	])("answers $clientStatus for a Paper 429 $errorType", async ({
		errorType,
		clientStatus,
	}) => {
		const upstreamFetch: typeof fetch = () =>
			Promise.resolve(
				new Response(
					JSON.stringify({ type: "error", error: { type: errorType } }),
					{ status: 429, headers: { "content-type": "application/json" } },
				),
			);
		const env: LlmProxyEnv = {
			...makeEnv("https://ai-gateway.vercel.sh"),
			PAPERINSTRUMENTS_API_KEY: "paper-key",
			V2_DEFAULT_MODEL: "paperinstruments/ultramarine-1-flash",
		};
		const { service, inserted } = makeService(env, upstreamFetch);
		const reply = new FakeReply();
		const { input } = inbound(env, {
			body: Buffer.from(
				JSON.stringify({
					model: "paperinstruments/ultramarine-1-flash",
					messages: [{ role: "user", content: "hi" }],
				}),
				"utf8",
			),
		});

		await service.proxyAnthropic(input, reply);

		expect(reply.statusCode).toBe(clientStatus);
		expect(inserted[0]?.reason).toBe("upstream_429");
	});

	it("writes upstream_error when the upstream socket dies mid-stream", async () => {
		const upstream = await startUpstream((_req, res) => {
			res.writeHead(200, { "content-type": "text/event-stream" });
			const firstFrame = SSE_STREAM.split("\n\n")[0];
			if (firstFrame === undefined) {
				throw new Error("canned stream is empty");
			}
			// Destroy once the frame is flushed: the client's next read fails.
			res.write(`${firstFrame}\n\n`, () => res.destroy());
		});
		try {
			const env = makeEnv(upstream.baseUrl);
			const { service, inserted } = makeService(env);
			const reply = new FakeReply();

			await service.proxyAnthropic(inbound(env).input, reply);

			expect(reply.ended).toBe(true);
			expect(reply.bodyText).toContain("message_start");
			expect(inserted[0]?.status).toBe("upstream_error");
			expect(inserted[0]?.reason).toBe("stream_failed");
			// Tokens seen before the failure stay on the row.
			expect(inserted[0]?.inputTokens).toBe(120);
			expect(inserted[0]?.outputTokens).toBe(0);
		} finally {
			await upstream.close();
		}
	});

	it("writes client_aborted when the client aborts during a buffered read", async () => {
		const env = makeEnv("https://api.anthropic.com");
		const ctx = inbound(env);
		// The fetch stub ignores the abort signal, so the JSON body lands
		// whole; the dead signal then trips the abort check after the read.
		const upstreamFetch: typeof fetch = (_input, _init) => {
			const response = new Response(
				JSON.stringify({
					usage: { input_tokens: 5, output_tokens: 7 },
				}),
				{
					status: 200,
					headers: { "content-type": "application/json" },
				},
			);
			ctx.abort.abort();
			return Promise.resolve(response);
		};
		const { service, inserted } = makeService(env, upstreamFetch);
		const reply = new FakeReply();

		await service.proxyAnthropic(ctx.input, reply);

		expect(reply.ended).toBe(true);
		expect(inserted).toHaveLength(1);
		expect(inserted[0]?.status).toBe("client_aborted");
		expect(inserted[0]?.reason).toBe("client_aborted");
		// The buffered body already carried the usage; the row keeps it.
		expect(inserted[0]?.inputTokens).toBe(5);
		expect(inserted[0]?.outputTokens).toBe(7);
		expect(inserted[0]?.usdMicros).toBeGreaterThan(0);
	});
});
