import { createHmac } from "node:crypto";
import { createServer, type Server, type ServerResponse } from "node:http";

import { ServiceUnavailableException } from "@nestjs/common";
import { describe, expect, it } from "vitest";

import type { LlmProxyEnv } from "../../domain/llm-upstream";
import type { NewLlmProxyRequest } from "../../infrastructure/persistence/llm-proxy-requests.repository";
import { FakeLlmSpendCounters } from "../../infrastructure/redis/fake-llm-spend-counters";
import {
	type LlmProxyInboundRequest,
	type LlmProxyReply,
	LlmProxyService,
} from "./llm-proxy.service";
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

function makeService(env: LlmProxyEnv, upstreamFetch: typeof fetch = fetch) {
	const counters = new FakeLlmSpendCounters();
	const inserted: NewLlmProxyRequest[] = [];
	const requests = {
		insert: async (row: NewLlmProxyRequest) => {
			inserted.push(row);
			return { id: "row-1" };
		},
	};
	const service = new LlmProxyService(env, counters, requests, upstreamFetch);
	return { counters, inserted, service };
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
			const { service, inserted, counters } = makeService(env);
			const { input } = inbound(env, { endpoint: "count_tokens" });
			await service.proxyAnthropic(input, new FakeReply());
			expect(upstream.requests[0]?.url).toBe("/v1/messages/count_tokens");
			expect(inserted[0]?.inputTokens).toBe(42);
			// The endpoint is free: no charge on the row, no spend counters.
			expect(inserted[0]?.usdMicros).toBe(0);
			expect(await counters.readRunSpend("run_test")).toBe(0);
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

	it("rejects a denied model with 403 and a model_denied row", async () => {
		const upstream = await startUpstream(jsonOk("{}"));
		try {
			const env = makeEnv(upstream.baseUrl);
			const { service, inserted } = makeService(env);
			const reply = new FakeReply();
			const { input } = inbound(env, {
				// starter may not call opus.
				authorization: token(env, { plan: "starter" }),
				body: Buffer.from(
					JSON.stringify({ model: "anthropic/claude-opus-5", messages: [] }),
					"utf8",
				),
			});

			await service.proxyAnthropic(input, reply);

			expect(reply.statusCode).toBe(403);
			const body: { code: string; allowed: string[] } = JSON.parse(
				reply.bodyText,
			);
			expect(body.code).toBe("V2_MODEL_DENIED");
			expect(body.allowed).toContain("anthropic/claude-sonnet-5");
			// The upstream was never called.
			expect(upstream.requests).toHaveLength(0);
			expect(inserted[0]?.status).toBe("model_denied");
			expect(inserted[0]?.reason).toBe("anthropic/claude-opus-5");
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
			const { service, inserted, counters } = makeService(env);
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
		} finally {
			await upstream.close();
		}
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
			await counters.addUserSpend("user_1", dayKey, 50_000_000);

			const reply = new FakeReply();
			await service.proxyAnthropic(inbound(env).input, reply);

			expect(reply.statusCode).toBe(402);
			expect(inserted[0]?.status).toBe("cap_rejected");
			expect(inserted[0]?.reason).toBe("daily_cap");
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
				await counters.hitRunRateLimit("run_test");
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
			const firstFrame = SSE_STREAM.split("\n\n")[0];
			if (firstFrame === undefined) {
				throw new Error("canned stream is empty");
			}
			res.write(`${firstFrame}\n\n`);
			// The rest never arrives: the client aborts on the first chunk and
			// the socket just stays open until teardown.
		});
		try {
			const env = makeEnv(upstream.baseUrl);
			const { service, inserted } = makeService(env);
			const reply = new FakeReply();
			const { abort, input } = inbound(env);
			reply.onWrite = () => abort.abort();

			await service.proxyAnthropic(input, reply);

			expect(inserted[0]?.status).toBe("client_aborted");
			expect(inserted[0]?.reason).toBe("client_aborted");
			// Counts seen before the abort are kept.
			expect(inserted[0]?.inputTokens).toBe(120);
			expect(inserted[0]?.outputTokens).toBe(0);
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
		let abort: AbortController | undefined;
		const upstream = await startUpstream((_req, res) => {
			res.writeHead(200, { "content-type": "application/json" });
			res.flushHeaders();
			// The body never completes; the client aborts mid-read instead.
			res.write('{"usage":{"input_tokens":5');
			setTimeout(() => abort?.abort(), 20);
		});
		try {
			const env = makeEnv(upstream.baseUrl);
			const { service, inserted } = makeService(env);
			const reply = new FakeReply();
			const ctx = inbound(env);
			abort = ctx.abort;

			await service.proxyAnthropic(ctx.input, reply);

			expect(reply.ended).toBe(true);
			expect(inserted).toHaveLength(1);
			expect(inserted[0]?.status).toBe("client_aborted");
			expect(inserted[0]?.reason).toBe("client_aborted");
			expect(inserted[0]?.inputTokens).toBe(0);
		} finally {
			await upstream.close();
		}
	});
});
