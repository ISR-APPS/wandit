/**
 * Sends one Langfuse generation for each proxied Messages call.
 * `LlmProxyService.finish` calls `send`. `AppBuilderModule` builds the
 * exporter with `langfuseExporterFromEnv`, or gets null without the keys.
 * It POSTs gzipped OTLP JSON to `<base>/api/public/otel/v1/traces`.
 */
import { randomBytes } from "node:crypto";
import { setImmediate } from "node:timers/promises";
import { promisify } from "node:util";
import { gzip } from "node:zlib";

import { Logger, type OnApplicationShutdown } from "@nestjs/common";
import type {
	LlmProxyRequestStatus,
	LlmProxyTokenClaims,
} from "@wandit/contracts";
import { env } from "@wandit/env/server";

import type {
	AnthropicAssistantMessage,
	LlmTokenUsage,
} from "../../domain/anthropic-sse-usage";

// The EU region of Langfuse Cloud, the expected host.
const LANGFUSE_EU_BASE_URL = "https://cloud.langfuse.com";

// Langfuse Cloud refuses a request over 5 MB. Its docs do not say if gzip
// bytes count, so the cap measures the raw JSON bytes.
const MAX_OTLP_BODY_BYTES = 4_500_000;

// Bounds the memory that a slow Langfuse holds.
// LIMIT: 8 exports in flight; `send` drops the next generation with one warn. Upgrade: a queue with a byte budget and one retry.
const MAX_EXPORTS_IN_FLIGHT = 8;

// Bounds the memory of one export and the wait at shutdown.
const EXPORT_TIMEOUT_MS = 10_000;

// A provider error body is short JSON. 2,000 chars keep it whole and cut
// an HTML error page.
const MAX_ERROR_BODY_CHARS = 2_000;

// Langfuse 400 messages give field names and counts, never span content
// (`processOtelIngestion.ts`), so this slice of the answer is safe to log.
const MAX_LOGGED_ANSWER_CHARS = 300;

const gzipAsync = promisify(gzip);

/** One proxied Messages call, as `LlmProxyService.finish` gives it. */
export type LlmGeneration = {
	/** Billed claims: the same turn, run, user and project ids as the `llm_proxy_requests` row. */
	claims: LlmProxyTokenClaims;
	/** Model prefix, for example `deepseek`; the same value as the row `provider`. */
	provider: string;
	/** Normalized allow-list id, the key of the price table. */
	modelId: string;
	/** Raw `x-claude-code-session-id` header; null when absent. */
	claudeSessionId: string | null;
	/** `request-id` or `x-request-id` header of the upstream answer; null when absent. */
	upstreamRequestId: string | null;
	/** `ok`, `upstream_error` or `client_aborted`. Rejected calls send nothing. */
	status: LlmProxyRequestStatus;
	/** Row reason, for example `upstream_529`; null on `ok`. */
	reason: string | null;
	/** Token counts, the same values as the row. */
	usage: LlmTokenUsage;
	/** Billed cost in USD micros, the same value as the row. */
	usdMicros: number;
	/** Epoch ms when the proxy got the request. */
	startedAt: number;
	/** Epoch ms when the proxy finished the answer. */
	endedAt: number;
	/** Bytes the upstream got: the inbound body or its rewrite (model id, Paper blocks). */
	forwardedBody: Buffer;
	/** The rebuilt answer; null when no answer arrived or it did not parse. */
	message: AnthropicAssistantMessage | null;
	/** Upstream body of a non-2xx answer; null on every other path. */
	upstreamErrorBody: string | null;
};

/** `langfuse.environment` and `langfuse.release` of every span. */
export type LangfuseResource = {
	/** `SENTRY_ENVIRONMENT`, else `NODE_ENV`. */
	environment: string;
	/** `SENTRY_RELEASE`; undefined on a local API. */
	release: string | undefined;
};

/** What `LlmProxyService` uses; the spec passes a collector. */
export type LlmGenerationSink = Pick<LangfuseExporter, "send">;

// One span attribute in the OTLP JSON encoding: a string or a string array.
type OtlpAttribute = {
	key: string;
	value:
		| { stringValue: string }
		| { arrayValue: { values: { stringValue: string }[] } };
};

function stringAttribute(key: string, value: string): OtlpAttribute {
	return { key, value: { stringValue: value } };
}

/**
 * Posts each generation on its own. A streamed or JSON answer goes out
 * before the post starts. It carries no Nest decorator: the module binds
 * it with a factory, so it can be null.
 */
export class LangfuseExporter implements OnApplicationShutdown {
	private readonly logger = new Logger(LangfuseExporter.name);
	private readonly pending = new Set<Promise<void>>();

	constructor(
		/** `<LANGFUSE_BASE_URL>/api/public/otel/v1/traces`. */
		private readonly tracesUrl: string,
		/** `Basic base64(publicKey:secretKey)`. Secret: never log it. */
		private readonly authorization: string,
		private readonly resource: LangfuseResource,
	) {}

	/** Starts one export. Never throws and never waits; a failure logs one warn. */
	send(generation: LlmGeneration): void {
		const { runId, turnId } = generation.claims;
		if (this.pending.size >= MAX_EXPORTS_IN_FLIGHT) {
			this.logger.warn(
				`Langfuse export dropped for turn ${turnId}, run ${runId}: ${MAX_EXPORTS_IN_FLIGHT} exports in flight`,
			);
			return;
		}
		// The catch keeps a failed export from being an unhandled rejection,
		// which stops the API process.
		const task = this.post(generation).catch((error: unknown) => {
			this.logger.warn(
				`Langfuse export failed for turn ${turnId}, run ${runId}, call status ${generation.status}: ${describeExportError(error)}`,
			);
		});
		this.pending.add(task);
		void task.finally(() => this.pending.delete(task));
	}

	/** Waits for the exports in flight. Each has a 10 s timeout. */
	async onApplicationShutdown(): Promise<void> {
		await Promise.allSettled(this.pending);
	}

	private async post(generation: LlmGeneration): Promise<void> {
		// setImmediate lets `finish` start its row insert first. On
		// `fetch_failed`, the body build can delay the 502 by a few ms.
		await setImmediate();
		// LIMIT: `post` builds the JSON body on the main thread and gzips it on the libuv pool, a few ms per MB of prompt. Upgrade: a worker thread.
		const body = await gzipAsync(langfuseOtlpBody(generation, this.resource));
		const response = await fetch(this.tracesUrl, {
			method: "POST",
			headers: {
				authorization: this.authorization,
				"content-type": "application/json",
				"content-encoding": "gzip",
				// Without it, Langfuse can show the data minutes late.
				"x-langfuse-ingestion-version": "4",
			},
			body,
			signal: AbortSignal.timeout(EXPORT_TIMEOUT_MS),
		});
		// undici keeps the socket until the code reads or cancels the body.
		const answer = await response.text();
		if (!response.ok) {
			throw new Error(
				`Langfuse answered ${response.status}: ${answer.slice(0, MAX_LOGGED_ANSWER_CHARS)}`,
			);
		}
	}
}

// undici reports a network failure only as "fetch failed". The cause gives
// the real error (ENOTFOUND, ECONNREFUSED, a timeout), a host name at most.
function describeExportError(error: unknown): string {
	if (!(error instanceof Error)) {
		return String(error);
	}
	return error.cause instanceof Error
		? `${error.message} (${error.cause.message})`
		: error.message;
}

/**
 * The exporter of the API process. Null unless both keys are set. One key
 * alone logs one warn at boot, without the values.
 */
export function langfuseExporterFromEnv(): LangfuseExporter | null {
	const publicKey = env.LANGFUSE_PUBLIC_KEY;
	const secretKey = env.LANGFUSE_SECRET_KEY;
	if (publicKey === undefined || secretKey === undefined) {
		if (publicKey !== undefined || secretKey !== undefined) {
			new Logger(LangfuseExporter.name).warn(
				"Langfuse stays off: set both LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY",
			);
		}
		return null;
	}
	// The fallback stays here, not in a zod default: SKIP_ENV_VALIDATION
	// applies no zod default.
	const baseUrl = (env.LANGFUSE_BASE_URL ?? LANGFUSE_EU_BASE_URL).replace(
		/\/+$/,
		"",
	);
	return new LangfuseExporter(
		`${baseUrl}/api/public/otel/v1/traces`,
		`Basic ${Buffer.from(`${publicKey}:${secretKey}`, "utf8").toString("base64")}`,
		{
			environment: env.SENTRY_ENVIRONMENT ?? env.NODE_ENV,
			release: env.SENTRY_RELEASE,
		},
	);
}

/**
 * OTLP/HTTP JSON body of one generation: one root span in the trace of its
 * turn. Over the size cap, a note replaces the input. Exported for the spec.
 */
export function langfuseOtlpBody(
	generation: LlmGeneration,
	resource: LangfuseResource,
): string {
	// The escaped JSON is never shorter than the raw body. A raw body over
	// the cap skips the full build, which blocks the event loop.
	if (generation.forwardedBody.length <= MAX_OTLP_BODY_BYTES) {
		const body = otlpJson(
			generation,
			resource,
			generation.forwardedBody.toString("utf8"),
		);
		// The cap measures the escaped JSON: escaping can double a body of quotes.
		if (Buffer.byteLength(body, "utf8") <= MAX_OTLP_BODY_BYTES) {
			return body;
		}
	}
	// LIMIT: a call whose OTLP body is over 4.5 MB goes without its input. Upgrade: upload the body as a Langfuse media file.
	return otlpJson(
		generation,
		resource,
		`[input omitted: ${generation.forwardedBody.length} bytes, over the Langfuse request cap]`,
	);
}

function otlpJson(
	generation: LlmGeneration,
	resource: LangfuseResource,
	input: string,
): string {
	const { claims, message } = generation;
	const streamError = message?.streamError ?? null;
	const firstTokenAt = message?.firstTokenAt ?? null;
	const attributes: OtlpAttribute[] = [
		stringAttribute("langfuse.observation.type", "generation"),
		stringAttribute("langfuse.observation.model.name", generation.modelId),
		stringAttribute("langfuse.observation.input", input),
		stringAttribute(
			"langfuse.observation.usage_details",
			// Anthropic `input` leaves out the cache tokens, so each token counts once.
			JSON.stringify({
				input: generation.usage.inputTokens,
				output: generation.usage.outputTokens,
				cache_read_input_tokens: generation.usage.cacheReadTokens,
				cache_creation_input_tokens: generation.usage.cacheWriteTokens,
			}),
		),
		stringAttribute(
			"langfuse.observation.cost_details",
			// UNIT: the row holds USD micros; Langfuse wants USD. Only the total:
			// the price math rounds the sum once, so per-type values would not add up.
			JSON.stringify({ total: generation.usdMicros / 1_000_000 }),
		),
		stringAttribute(
			"langfuse.observation.level",
			observationLevel(generation.status, streamError),
		),
		stringAttribute("user.id", claims.userId),
		// An older run token has no chat id, so its calls group by project.
		stringAttribute("session.id", claims.chatId ?? claims.projectId),
		stringAttribute("langfuse.trace.name", "builder-turn"),
		{
			key: "langfuse.trace.tags",
			value: {
				arrayValue: {
					values: [
						{ stringValue: generation.provider },
						{ stringValue: generation.modelId },
					],
				},
			},
		},
		stringAttribute("langfuse.trace.metadata.turn_id", claims.turnId),
		stringAttribute("langfuse.trace.metadata.project_id", claims.projectId),
		stringAttribute("langfuse.trace.metadata.plan", claims.plan),
		stringAttribute("langfuse.environment", resource.environment),
	];
	const statusMessage =
		generation.reason ??
		(streamError === null ? null : `stream_error: ${streamError}`);
	// The loop below leaves out each pair with a null or undefined value.
	const optional: [string, string | null | undefined][] = [
		["langfuse.observation.output", observationOutput(generation)],
		["langfuse.observation.status_message", statusMessage],
		[
			"langfuse.observation.completion_start_time",
			firstTokenAt === null ? null : new Date(firstTokenAt).toISOString(),
		],
		["langfuse.observation.metadata.run_id", claims.runId],
		["langfuse.observation.metadata.status", generation.status],
		["langfuse.observation.metadata.provider", generation.provider],
		["langfuse.observation.metadata.response_model", message?.model],
		["langfuse.observation.metadata.message_id", message?.id],
		["langfuse.observation.metadata.stop_reason", message?.stopReason],
		[
			"langfuse.observation.metadata.upstream_request_id",
			generation.upstreamRequestId,
		],
		[
			"langfuse.observation.metadata.claude_session_id",
			generation.claudeSessionId,
		],
		["langfuse.release", resource.release],
	];
	for (const [key, value] of optional) {
		if (value !== null && value !== undefined) {
			attributes.push(stringAttribute(key, value));
		}
	}

	return JSON.stringify({
		resourceSpans: [
			{
				resource: {
					attributes: [stringAttribute("service.name", "wandit-api")],
				},
				scopeSpans: [
					{
						scope: { name: "wandit-llm-proxy" },
						// No `parentSpanId`: each call is a root span of its turn trace.
						spans: [
							{
								// One trace per turn on every replica: the turn uuid is 32 hex chars without dashes.
								traceId: claims.turnId.toLowerCase().replaceAll("-", ""),
								// An OTLP span id is 8 random bytes, as 16 hex chars.
								spanId: randomBytes(8).toString("hex"),
								name: "messages",
								// UNIT: epoch ms to the OTLP epoch nanoseconds, as a string.
								startTimeUnixNano: (
									BigInt(generation.startedAt) * 1_000_000n
								).toString(),
								endTimeUnixNano: (
									BigInt(generation.endedAt) * 1_000_000n
								).toString(),
								attributes,
							},
						],
					},
				],
			},
		],
	});
}

// The upstream error body, else the rebuilt answer; null when neither exists.
function observationOutput(generation: LlmGeneration): string | null {
	if (generation.upstreamErrorBody !== null) {
		return generation.upstreamErrorBody.slice(0, MAX_ERROR_BODY_CHARS);
	}
	if (generation.message === null) {
		return null;
	}
	return JSON.stringify({
		role: "assistant",
		content: generation.message.content,
		stop_reason: generation.message.stopReason,
	});
}

// An upstream error or an in-stream error is ERROR; a client abort is a WARNING.
function observationLevel(
	status: LlmProxyRequestStatus,
	streamError: string | null,
): "ERROR" | "DEFAULT" | "WARNING" {
	if (status === "upstream_error" || streamError !== null) {
		return "ERROR";
	}
	return status === "ok" ? "DEFAULT" : "WARNING";
}
