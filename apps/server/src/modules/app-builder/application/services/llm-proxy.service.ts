/**
 * The V2 LLM proxy application service.
 * `LlmProxyController` feeds each inbound request. The service verifies the
 * run token, rejects a revoked run, and checks the model, the rate limit,
 * and the spend caps. It forwards the body to the provider and streams
 * the answer back.
 * It writes one `llm_proxy_requests` row per request. A second controller
 * for the OpenAI-compatible inbound format can reuse it unchanged.
 */
import {
	Inject,
	Injectable,
	Logger,
	ServiceUnavailableException,
} from "@nestjs/common";
import {
	allowedLlmModels,
	type LlmProxyRequestStatus,
	type LlmProxyTokenClaims,
} from "@wandit/contracts";
import { Sentry } from "@wandit/observability/nestjs";
import { z } from "zod";

import {
	createAnthropicSseUsageParser,
	type LlmTokenUsage,
	usageFromAnthropicJson,
} from "../../domain/anthropic-sse-usage";
import { llmModelPrice, priceUsdMicros } from "../../domain/llm-model-prices";
import {
	LLM_PROXY_ENV,
	type LlmProxyEnv,
	type LlmUpstream,
	normalizeInboundModelId,
	upstreamFor,
} from "../../domain/llm-upstream";
import {
	LlmProxyRequestsRepository,
	type LlmProxyRequestWriter,
} from "../../infrastructure/persistence/llm-proxy-requests.repository";
import {
	LLM_PROXY_DAILY_USER_CAP_USD,
	LLM_RUN_RATE_LIMIT_PER_MINUTE,
	type LlmSpendCounterStore,
	LlmSpendCounters,
} from "../../infrastructure/redis/llm-spend-counters";
import {
	LlmProxyTokenError,
	verifyLlmProxyToken,
} from "./llm-proxy-token.service";

/**
 * Nest token for the upstream `fetch`. Production gets
 * `chatGatewayFetch`, whose undici dispatcher survives multi-minute model
 * silences that would kill the default timeouts.
 */
export const LLM_PROXY_FETCH = Symbol.for("app-builder.llm-proxy-fetch");

/** One inbound Anthropic-format request, already read off the socket. */
export type LlmProxyInboundRequest = {
	// `Authorization` header value; expected to be `Bearer <run token>`.
	authorization: string | undefined;
	// `anthropic-version` header; forwarded unchanged when present.
	anthropicVersion: string | undefined;
	// `anthropic-beta` header; forwarded unchanged when present.
	anthropicBeta: string | undefined;
	// `X-Wandit-Run` header; forwarded unchanged when present.
	wanditRun: string | undefined;
	// `x-claude-code-session-id` header; stored on the usage row only.
	claudeSessionId: string | undefined;
	// Raw request body bytes, forwarded unchanged unless the model field
	// must be rewritten for the chosen upstream.
	body: Buffer;
	// Which Anthropic endpoint the sandbox called.
	endpoint: "messages" | "count_tokens";
	// Raw query string without `?`, forwarded unchanged (`?beta=true`).
	queryString: string | undefined;
	// Aborts when the client socket closes before the response ends.
	abortSignal: AbortSignal;
};

/**
 * The channel the service writes the upstream answer to. The controller
 * binds it to a hijacked Fastify reply; specs collect chunks in memory.
 */
export interface LlmProxyReply {
	// Sends status and headers; called exactly once.
	writeHead(statusCode: number, headers: Record<string, string>): void;
	// Writes one body chunk; resolves when the socket accepts more.
	write(chunk: Uint8Array): Promise<void>;
	// Closes the response; called exactly once.
	end(): void;
}

// Anthropic rejects requests without this header. 2023-06-01 is the
// version Claude Code sends, and the only one the proxy needs as fallback.
const ANTHROPIC_VERSION_FALLBACK = "2023-06-01";

// Run-spend counters outlive the token by one hour. A tail call after a
// long turn still lands on the same key.
const RUN_SPEND_TTL_GRACE_SECONDS = 60 * 60;

// Body fields the proxy reads. Other fields pass through untouched.
const anthropicRequestBodySchema = z.looseObject({
	model: z.string().min(1).optional(),
});

/** Application service behind `LlmProxyController`; see file header. */
@Injectable()
export class LlmProxyService {
	private readonly logger = new Logger(LlmProxyService.name);

	constructor(
		@Inject(LLM_PROXY_ENV) private readonly env: LlmProxyEnv,
		@Inject(LlmSpendCounters)
		private readonly counters: LlmSpendCounterStore,
		@Inject(LlmProxyRequestsRepository)
		private readonly requests: LlmProxyRequestWriter,
		@Inject(LLM_PROXY_FETCH) private readonly upstreamFetch: typeof fetch,
	) {}

	/**
	 * Answers one Anthropic-format request. Returns after the response ends
	 * and the usage row is written. Known rejections write a `{code,...}`
	 * body themselves; unexpected errors propagate to the exception filter.
	 */
	async proxyAnthropic(
		input: LlmProxyInboundRequest,
		reply: LlmProxyReply,
	): Promise<void> {
		const startedAt = Date.now();

		// 1. Token check: the run token is the only auth on this route. A bad
		// token writes no row — its claims are untrusted.
		let claims: LlmProxyTokenClaims;
		try {
			claims = this.verifyBearer(input.authorization);
		} catch (error) {
			if (error instanceof ServiceUnavailableException) {
				throw error;
			}
			await this.sendError(
				reply,
				401,
				"V2_TOKEN_INVALID",
				"Invalid or expired run token",
			);
			return;
		}

		// 1b. A revoked run: the turn ended, so the token is dead even though
		// it has not expired. Same rule as a bad token — the claims of a
		// dead run are not trusted, so no row is written.
		if (await this.counters.isRunRevoked(claims.runId)) {
			this.logger.warn("llm-proxy.revoked-run", {
				runId: claims.runId,
				turnId: claims.turnId,
			});
			await this.sendError(reply, 401, "V2_TOKEN_INVALID", "Run token revoked");
			return;
		}

		// 2. Model allow-list: an absent model means the plan default; a
		// named model outside the list is denied. Claude Code resolves its
		// aliases to dated bare ids (`claude-haiku-4-5-20251001`); normalize
		// them onto the `anthropic/...` list entries before the check.
		const bodyJson = this.parseBody(input.body);
		const requestedModel =
			bodyJson?.model === undefined
				? undefined
				: normalizeInboundModelId(bodyJson.model);
		const defaultModel = this.requireEnv("V2_DEFAULT_MODEL");
		const allowed = allowedLlmModels(claims.plan, defaultModel);
		if (requestedModel !== undefined && !allowed.includes(requestedModel)) {
			await this.reject(reply, claims, input, startedAt, {
				status: 403,
				code: "V2_MODEL_DENIED",
				message: "This plan may not call that model",
				reason: requestedModel,
				rowStatus: "model_denied",
				bodyFields: { allowed },
			});
			return;
		}
		const modelId = requestedModel ?? defaultModel;

		// 3. Per-run request rate limit, a fixed one-minute window.
		const hits = await this.counters.hitRunRateLimit(claims.runId);
		if (hits > LLM_RUN_RATE_LIMIT_PER_MINUTE) {
			await this.reject(reply, claims, input, startedAt, {
				status: 429,
				code: "V2_RATE_LIMITED",
				message: "Too many requests for this run",
				reason: "rate_limit",
				rowStatus: "rate_limited",
				headers: { "retry-after": "60" },
			});
			return;
		}

		// 4. Per-run spend cap from the token claims.
		// UNIT: claims carry USD; counters carry micros.
		const capMicros = Math.round(claims.capUsd * 1_000_000);
		const runSpend = await this.counters.readRunSpend(claims.runId);
		if (runSpend >= capMicros) {
			await this.reject(reply, claims, input, startedAt, {
				status: 402,
				code: "V2_RUN_CAP_REACHED",
				message: "This run reached its spend cap",
				reason: "run_cap",
				rowStatus: "cap_rejected",
				bodyFields: { capUsd: claims.capUsd },
			});
			return;
		}

		// 5. Per-user daily spend cap.
		const dayKey = utcDayKey();
		const daySpend = await this.counters.readUserSpend(claims.userId, dayKey);
		if (daySpend >= LLM_PROXY_DAILY_USER_CAP_USD * 1_000_000) {
			await this.reject(reply, claims, input, startedAt, {
				status: 402,
				code: "V2_DAILY_CAP_REACHED",
				message: "Daily LLM spend cap reached",
				reason: "daily_cap",
				rowStatus: "cap_rejected",
			});
			return;
		}

		const upstreamResult = upstreamFor(modelId, this.env, bodyJson?.model);
		if (!upstreamResult.ok) {
			throw new ServiceUnavailableException({
				code: "V2_ENV_MISSING",
				message: `${upstreamResult.missingEnv} is not set`,
			});
		}
		const upstream = upstreamResult.upstream;

		// An unpriced model would bill the provider without ever touching the
		// spend caps. Fail closed; WANDIT-151 keeps the price table complete.
		if (llmModelPrice(modelId) === undefined) {
			throw new ServiceUnavailableException({
				code: "V2_MODEL_UNPRICED",
				message: `No LLM price row for model ${modelId}`,
			});
		}

		await this.forwardAndAccount(
			input,
			reply,
			claims,
			upstream,
			modelId,
			bodyJson,
			startedAt,
		);
	}

	private verifyBearer(authorization: string | undefined): LlmProxyTokenClaims {
		const token = authorization?.startsWith("Bearer ")
			? authorization.slice("Bearer ".length).trim()
			: undefined;
		if (token === undefined || token.length === 0) {
			throw new LlmProxyTokenError("Missing run token");
		}
		return verifyLlmProxyToken(token, this.env);
	}

	// Reads `model` off the body for the allow-list and the rewrite check.
	// A body that is not JSON keeps its bytes and forwards. The upstream
	// answers its own 400, and the row records the plan default.
	private parseBody(
		body: Buffer,
	): z.infer<typeof anthropicRequestBodySchema> | undefined {
		try {
			const parsed = anthropicRequestBodySchema.safeParse(
				JSON.parse(body.toString("utf8")),
			);
			return parsed.success ? parsed.data : undefined;
		} catch {
			// Not JSON: forward the bytes; the upstream answers its own 400.
			return undefined;
		}
	}

	private requireEnv(name: keyof LlmProxyEnv): string {
		const value = this.env[name];
		if (value === undefined) {
			throw new ServiceUnavailableException({
				code: "V2_ENV_MISSING",
				message: `${name} is not set`,
			});
		}
		return value;
	}

	private async forwardAndAccount(
		input: LlmProxyInboundRequest,
		reply: LlmProxyReply,
		claims: LlmProxyTokenClaims,
		upstream: LlmUpstream,
		modelId: string,
		bodyJson: z.infer<typeof anthropicRequestBodySchema> | undefined,
		startedAt: number,
	): Promise<void> {
		const path =
			input.endpoint === "count_tokens"
				? "/v1/messages/count_tokens"
				: "/v1/messages";
		const base = upstream.baseUrl.replace(/\/+$/, "");
		const url = `${base}${path}${input.queryString ? `?${input.queryString}` : ""}`;

		// Rewrite `model` only when the upstream id differs from what the
		// sandbox sent. An identical id means the raw bytes go out unchanged.
		const forwardBody =
			bodyJson === undefined || bodyJson.model === upstream.upstreamModelId
				? input.body
				: Buffer.from(
						JSON.stringify({ ...bodyJson, model: upstream.upstreamModelId }),
						"utf8",
					);

		const headers: Record<string, string> = {
			"content-type": "application/json",
			"anthropic-version": input.anthropicVersion ?? ANTHROPIC_VERSION_FALLBACK,
			"x-wandit-run": input.wanditRun ?? claims.runId,
		};
		if (input.anthropicBeta !== undefined) {
			headers["anthropic-beta"] = input.anthropicBeta;
		}
		// The real provider key lives only here; the inbound bearer run token
		// is never forwarded.
		if (upstream.authStyle === "x-api-key") {
			headers["x-api-key"] = upstream.apiKey;
		} else {
			headers.authorization = `Bearer ${upstream.apiKey}`;
		}

		let upstreamResponse: Response;
		try {
			upstreamResponse = await this.upstreamFetch(url, {
				method: "POST",
				headers,
				body: forwardBody,
				signal: input.abortSignal,
			});
		} catch (error) {
			await this.failBeforeReply(
				input,
				reply,
				claims,
				upstream,
				modelId,
				startedAt,
				error,
			);
			return;
		}

		const responseHeaders = passthroughHeaders(upstreamResponse.headers);
		const upstreamRequestId =
			upstreamResponse.headers.get("request-id") ??
			upstreamResponse.headers.get("x-request-id") ??
			undefined;
		const contentType = upstreamResponse.headers.get("content-type") ?? "";

		if (!upstreamResponse.ok) {
			// The upstream refused or failed: its status and body go back
			// unchanged, and the row records `upstream_<status>`.
			let body: Buffer;
			try {
				body = Buffer.from(await upstreamResponse.arrayBuffer());
			} catch (error) {
				await this.failBeforeReply(
					input,
					reply,
					claims,
					upstream,
					modelId,
					startedAt,
					error,
					upstreamRequestId,
				);
				return;
			}
			reply.writeHead(upstreamResponse.status, responseHeaders);
			await reply.write(body);
			reply.end();
			if (upstreamResponse.status >= 500) {
				// A 5xx here is the provider's problem, not the client's.
				Sentry.captureMessage("LLM upstream answered 5xx", {
					level: "error",
					tags: {
						feature: "llm-proxy",
						runId: claims.runId,
						upstreamStatus: String(upstreamResponse.status),
					},
				});
			} else if (
				upstreamResponse.status === 401 ||
				upstreamResponse.status === 403
			) {
				// The provider rejected the key; an operator must rotate it.
				Sentry.captureMessage("LLM upstream rejected the provider key", {
					level: "error",
					tags: {
						feature: "llm-proxy",
						runId: claims.runId,
						upstreamStatus: String(upstreamResponse.status),
					},
				});
			}
			await this.finish(input, claims, upstream, modelId, {
				status: "upstream_error",
				reason: `upstream_${upstreamResponse.status}`,
				usage: zeroUsage(),
				upstreamRequestId,
				latencyMs: Date.now() - startedAt,
			});
			return;
		}

		const stream = upstreamResponse.body;
		if (contentType.includes("text/event-stream") && stream !== null) {
			await this.relayStream(input, reply, claims, upstream, modelId, {
				response: upstreamResponse,
				stream,
				responseHeaders,
				upstreamRequestId,
				startedAt,
			});
			return;
		}

		let body: Buffer;
		try {
			body = Buffer.from(await upstreamResponse.arrayBuffer());
		} catch (error) {
			await this.failBeforeReply(
				input,
				reply,
				claims,
				upstream,
				modelId,
				startedAt,
				error,
				upstreamRequestId,
			);
			return;
		}
		if (input.abortSignal.aborted) {
			await this.endClientAborted(
				input,
				reply,
				claims,
				upstream,
				modelId,
				startedAt,
				upstreamRequestId,
			);
			return;
		}
		reply.writeHead(upstreamResponse.status, responseHeaders);
		await reply.write(body);
		reply.end();
		await this.finish(input, claims, upstream, modelId, {
			status: "ok",
			reason: null,
			usage: usageFromAnthropicJson(safeJsonParse(body)),
			upstreamRequestId,
			latencyMs: Date.now() - startedAt,
		});
	}

	private async relayStream(
		input: LlmProxyInboundRequest,
		reply: LlmProxyReply,
		claims: LlmProxyTokenClaims,
		upstream: LlmUpstream,
		modelId: string,
		options: {
			response: Response;
			// The upstream body, already checked non-null by the caller.
			stream: ReadableStream<Uint8Array>;
			responseHeaders: Record<string, string>;
			upstreamRequestId: string | undefined;
			startedAt: number;
		},
	): Promise<void> {
		reply.writeHead(options.response.status, options.responseHeaders);
		const parser = createAnthropicSseUsageParser();
		const decoder = new TextDecoder();
		const reader = options.stream.getReader();
		let clientAborted = false;
		const cancelOnAbort = () => {
			clientAborted = true;
			// Unblocks a pending read() so the pump leaves promptly. A cancelled
			// fetch body can reject the next read() with AbortError; the pump
			// treats that as the abort it is.
			void reader.cancel().catch(() => {
				// The stream is already broken; there is nothing left to cancel.
			});
		};
		input.abortSignal.addEventListener("abort", cancelOnAbort, { once: true });
		let streamFailed = false;
		try {
			for (;;) {
				const { done, value } = await reader.read();
				if (done || value === undefined) {
					break;
				}
				parser.feed(decoder.decode(value, { stream: true }));
				await reply.write(value);
			}
		} catch (error) {
			// A client abort ends the pump quietly; its row says client_aborted.
			// A dead upstream socket leaves a half-sent answer. The status
			// line is already out, so the row and Sentry carry the error.
			if (!clientAborted) {
				streamFailed = true;
				this.logger.error(
					`Upstream stream failed for run ${claims.runId}`,
					error instanceof Error ? error.message : String(error),
				);
				Sentry.captureException(error, {
					tags: { feature: "llm-proxy", runId: claims.runId },
				});
			}
		} finally {
			input.abortSignal.removeEventListener("abort", cancelOnAbort);
			reader.releaseLock();
			reply.end();
		}
		let status: LlmProxyRequestStatus = "ok";
		let reason: string | null = null;
		if (clientAborted) {
			status = "client_aborted";
			reason = "client_aborted";
		} else if (streamFailed) {
			status = "upstream_error";
			reason = "stream_failed";
		}
		await this.finish(input, claims, upstream, modelId, {
			status,
			reason,
			usage: parser.usage(),
			upstreamRequestId: options.upstreamRequestId,
			latencyMs: Date.now() - options.startedAt,
		});
	}

	// Shared end for a call that got no usable upstream answer: the fetch
	// itself or a buffered body read. A client abort writes the
	// client_aborted row and closes the reply. Any other failure logs,
	// reports to Sentry, writes the upstream_error row, and answers 502.
	/** Ends the reply and writes the `client_aborted` row with zero usage. */
	private async endClientAborted(
		input: LlmProxyInboundRequest,
		reply: LlmProxyReply,
		claims: LlmProxyTokenClaims,
		upstream: LlmUpstream,
		modelId: string,
		startedAt: number,
		upstreamRequestId?: string,
	): Promise<void> {
		reply.end();
		await this.finish(input, claims, upstream, modelId, {
			status: "client_aborted",
			reason: "client_aborted",
			usage: zeroUsage(),
			upstreamRequestId,
			latencyMs: Date.now() - startedAt,
		});
	}

	private async failBeforeReply(
		input: LlmProxyInboundRequest,
		reply: LlmProxyReply,
		claims: LlmProxyTokenClaims,
		upstream: LlmUpstream,
		modelId: string,
		startedAt: number,
		error: unknown,
		upstreamRequestId?: string,
	): Promise<void> {
		if (input.abortSignal.aborted) {
			await this.endClientAborted(
				input,
				reply,
				claims,
				upstream,
				modelId,
				startedAt,
				upstreamRequestId,
			);
			return;
		}
		this.logger.error(
			`Upstream call failed for run ${claims.runId}`,
			error instanceof Error ? error.message : String(error),
		);
		Sentry.captureException(error, {
			tags: { feature: "llm-proxy", runId: claims.runId },
		});
		await this.finish(input, claims, upstream, modelId, {
			status: "upstream_error",
			reason: "fetch_failed",
			usage: zeroUsage(),
			upstreamRequestId,
			latencyMs: Date.now() - startedAt,
		});
		await this.sendError(
			reply,
			502,
			"V2_UPSTREAM_UNAVAILABLE",
			"Upstream call failed",
		);
	}

	// Writes the rejection body, then the audit row. The row insert is
	// best-effort: the client still gets the rejection if Postgres is down.
	private async reject(
		reply: LlmProxyReply,
		claims: LlmProxyTokenClaims,
		input: LlmProxyInboundRequest,
		startedAt: number,
		options: {
			status: number;
			code: string;
			message: string;
			reason: string;
			rowStatus: LlmProxyRequestStatus;
			headers?: Record<string, string>;
			bodyFields?: Record<string, string | number | readonly string[]>;
		},
	): Promise<void> {
		await this.sendError(
			reply,
			options.status,
			options.code,
			options.message,
			options.headers,
			options.bodyFields,
		);
		try {
			await this.requests.insert({
				runId: claims.runId,
				turnId: claims.turnId,
				userId: claims.userId,
				projectId: claims.projectId,
				organizationId: claims.workspaceId,
				provider: null,
				model: null,
				inboundFormat: "anthropic",
				inputTokens: null,
				outputTokens: null,
				cacheReadTokens: null,
				cacheWriteTokens: null,
				usdMicros: null,
				status: options.rowStatus,
				reason: options.reason,
				upstreamRequestId: null,
				claudeSessionId: input.claudeSessionId ?? null,
				latencyMs: Date.now() - startedAt,
			});
		} catch (error) {
			this.logger.error(
				`llm_proxy_requests rejection insert failed for run ${claims.runId}`,
				error instanceof Error ? error.message : String(error),
			);
			Sentry.captureException(error, {
				tags: { feature: "llm-proxy", runId: claims.runId },
			});
		}
	}

	private async sendError(
		reply: LlmProxyReply,
		status: number,
		code: string,
		message: string,
		headers?: Record<string, string>,
		bodyFields?: Record<string, string | number | readonly string[]>,
	): Promise<void> {
		reply.writeHead(status, {
			"content-type": "application/json",
			...headers,
		});
		await reply.write(
			Buffer.from(JSON.stringify({ code, message, ...bodyFields }), "utf8"),
		);
		reply.end();
	}

	// Row insert runs before the counters so a failed insert never inflates
	// spend. The table is the billing source of truth (WANDIT-174 reconciles).
	private async finish(
		input: LlmProxyInboundRequest,
		claims: LlmProxyTokenClaims,
		upstream: LlmUpstream,
		modelId: string,
		result: {
			status: LlmProxyRequestStatus;
			reason: string | null;
			usage: LlmTokenUsage;
			upstreamRequestId?: string | undefined;
			latencyMs: number;
		},
	): Promise<void> {
		// Anthropic's count_tokens endpoint is free: the row keeps the token
		// count but charges 0 and skips the counters. A forwarded model always
		// has a price row — the service rejects unpriced models before fetch.
		const usdMicros =
			input.endpoint === "count_tokens"
				? 0
				: (priceUsdMicros(modelId, result.usage) ?? 0);
		try {
			await this.requests.insert({
				runId: claims.runId,
				turnId: claims.turnId,
				userId: claims.userId,
				projectId: claims.projectId,
				organizationId: claims.workspaceId,
				provider: upstream.provider,
				model: modelId,
				inboundFormat: "anthropic",
				inputTokens: result.usage.inputTokens,
				outputTokens: result.usage.outputTokens,
				cacheReadTokens: result.usage.cacheReadTokens,
				cacheWriteTokens: result.usage.cacheWriteTokens,
				usdMicros,
				status: result.status,
				reason: result.reason,
				upstreamRequestId: result.upstreamRequestId ?? null,
				claudeSessionId: input.claudeSessionId ?? null,
				latencyMs: result.latencyMs,
			});
		} catch (error) {
			// The response already left; a lost row loses the charge, so alert.
			this.logger.error(
				`llm_proxy_requests insert failed for run ${claims.runId}`,
				error instanceof Error ? error.message : String(error),
			);
			Sentry.captureException(error, {
				tags: { feature: "llm-proxy", runId: claims.runId },
			});
			return;
		}
		if (usdMicros > 0) {
			const ttlSeconds = Math.max(
				claims.exp +
					RUN_SPEND_TTL_GRACE_SECONDS -
					Math.floor(Date.now() / 1000),
				60,
			);
			await this.counters.addRunSpend(claims.runId, usdMicros, ttlSeconds);
			await this.counters.addUserSpend(claims.userId, utcDayKey(), usdMicros);
		}
		this.logger.log({
			event: "llm_proxy_request",
			runId: claims.runId,
			turnId: claims.turnId,
			projectId: claims.projectId,
			provider: upstream.provider,
			model: modelId,
			upstreamModelId: upstream.upstreamModelId,
			inputTokens: result.usage.inputTokens,
			outputTokens: result.usage.outputTokens,
			cacheReadTokens: result.usage.cacheReadTokens,
			cacheWriteTokens: result.usage.cacheWriteTokens,
			usdMicros,
			status: result.status,
			latencyMs: result.latencyMs,
		});
	}
}

function zeroUsage(): LlmTokenUsage {
	return {
		inputTokens: 0,
		outputTokens: 0,
		cacheReadTokens: 0,
		cacheWriteTokens: 0,
	};
}

function safeJsonParse(body: Buffer): unknown {
	try {
		return JSON.parse(body.toString("utf8"));
	} catch {
		// A non-JSON upstream body simply has no usage to read.
		return undefined;
	}
}

// Today's UTC day key, `yyyymmdd`; one user-spend counter per day.
function utcDayKey(): string {
	return new Date().toISOString().slice(0, 10).replaceAll("-", "");
}

// Response headers the client gets back. Hop-by-hop headers would corrupt
// the proxied response: content-length no longer matches a re-sent body.
function passthroughHeaders(headers: Headers): Record<string, string> {
	const blocked = new Set([
		"connection",
		"content-length",
		"keep-alive",
		"transfer-encoding",
	]);
	const out: Record<string, string> = {};
	headers.forEach((value, name) => {
		if (!blocked.has(name.toLowerCase())) {
			out[name] = value;
		}
	});
	return out;
}
