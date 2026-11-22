/**
 * The V2 LLM proxy application service.
 * `LlmProxyController` feeds each inbound request. The service verifies the
 * run token, rejects a revoked run, and checks the model (allow-list and
 * the admin disabled list), the rate limit, and the spend caps. It
 * forwards the body to the provider and streams the answer back. A Paper body loses the blocks that Paper refuses.
 * A body for a model with text-only hosts (`zai/`) gets text in place of each
 * image and PDF block: a vision model describes the image, and unpdf extracts the PDF.
 * Every body loses the Claude Code identity: the persona line, the model
 * bullets, and the model sentences. The Wandit persona line takes their place.
 * The thinking level of the token sets the Messages effort: `light` lowers it,
 * `deep` raises it, and `balanced` keeps the effort of Claude Code.
 * A Claude 400 for a foreign thinking signature gets one retry without the
 * thinking of earlier turns.
 * It writes one `llm_proxy_requests` row per request. With the Langfuse
 * keys set, it also sends one Langfuse generation for each Messages call.
 * A second controller for the OpenAI-compatible inbound format can reuse
 * it unchanged.
 */
import { createHash } from "node:crypto";

import {
	Inject,
	Injectable,
	Logger,
	ServiceUnavailableException,
} from "@nestjs/common";
import {
	type BuilderThinking,
	type LlmProxyRequestStatus,
	type LlmProxyTokenClaims,
	type ProductSettings,
	uuidSchema,
} from "@wandit/contracts";
import { getErrorMessage } from "@wandit/observability/error";
import { Sentry } from "@wandit/observability/nestjs";
import { z } from "zod";

import { extractAttachmentText } from "../../../ai-chat/agent/attachment-text";
import { ProductSettingsService } from "../../../settings";
import {
	type AnthropicAssistantMessage,
	createAnthropicSseUsageParser,
	gatewayCostFromAnthropicJson,
	type LlmGatewayCost,
	type LlmTokenUsage,
	messageFromAnthropicJson,
	usageFromAnthropicJson,
} from "../../domain/anthropic-sse-usage";
import { llmModelPrice, priceUsdMicros } from "../../domain/llm-model-prices";
import {
	LLM_PROXY_ENV,
	type LlmProxyEnv,
	type LlmUpstream,
	normalizeInboundModelId,
	PAPER_INSTRUMENTS_PROVIDER,
	upstreamFor,
} from "../../domain/llm-upstream";
import {
	LangfuseExporter,
	type LlmGenerationSink,
} from "../../infrastructure/langfuse/langfuse-exporter";
import {
	LlmProxyRequestsRepository,
	type LlmProxyRequestWriter,
} from "../../infrastructure/persistence/llm-proxy-requests.repository";
import {
	LLM_PROXY_DAILY_USER_CAP_USD,
	LLM_RUN_RATE_LIMIT_PER_MINUTE,
	type LlmRequestAdmission,
	type LlmSpendCounterStore,
	LlmSpendCounters,
} from "../../infrastructure/redis/llm-spend-counters";
import {
	BLOCK_TEXT_CACHE_TTL_SEC,
	type BlockTextCache,
	RedisBlockTextCache,
} from "../../infrastructure/redis/redis-block-text-cache";
import {
	IMAGE_DESCRIBER_MODEL,
	IMAGE_DESCRIBER_PROVIDER,
	type ImageDescription,
	LlmProxyImageDescriber,
} from "./llm-proxy-image-describer.service";
import {
	LLM_PROXY_TOKEN_TTL_SECONDS,
	LlmProxyTokenError,
	type VerifiedLlmProxyToken,
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
	// `x-claude-code-session-id` header; stored on the usage row. The
	// upstream also gets it as `x-session-id` when it is a UUID.
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

// The beta that Claude Code sends for a model id with the `[1m]` suffix.
const CLAUDE_1M_CONTEXT_BETA = "context-1m-2025-08-07";

// Run-spend counters outlive the token by one hour. A tail call after a
// long turn still lands on the same key.
const RUN_SPEND_TTL_GRACE_SECONDS = 60 * 60;

// Body fields the proxy reads. Other fields pass through untouched.
const anthropicRequestBodySchema = z.looseObject({
	model: z.string().min(1).optional(),
});

// One block nested in a `tool_result`. Only its `type` is read; other fields pass through.
const anthropicInnerBlockSchema = z.looseObject({ type: z.string() });

// The `messages` of a request, for the Paper rewrite, the text-only host
// rewrite, the thinking retry, and the identity rewrite. Only the `role`, the
// block `type` and `text`, and the blocks nested in a `tool_result` are read;
// other fields pass through.
const anthropicMessagesSchema = z.array(
	z.looseObject({
		role: z.string(),
		content: z.union([
			z.string(),
			z.array(
				z.looseObject({
					type: z.string(),
					text: z.string().optional(),
					content: z
						.union([z.string(), z.array(anthropicInnerBlockSchema)])
						.optional(),
				}),
			),
		]),
	}),
);

type AnthropicMessages = z.infer<typeof anthropicMessagesSchema>;

type AnthropicInnerBlock = z.infer<typeof anthropicInnerBlockSchema>;

// Model id prefixes whose gateway hosts refuse image input. Gateway probe of
// 2026-11-22 (Anthropic Messages endpoint): zai/glm-5.3 reads image and PDF
// blocks on baseten only. Fireworks answers 400 "Invalid image or video input".
// Deepinfra answers 400 "does not accept image input". The gateway falls over
// to them, so one image block fails the whole request. DeepSeek stays out: it
// read images and PDFs on baseten, fireworks, and deepinfra.
// LIMIT: a static list; a new text-only host fails until someone adds its prefix.
// Upgrade: read the gateway endpoints of each model and their input modalities.
const TEXT_ONLY_HOST_MODEL_PREFIXES = ["zai/"] as const;

// A base64 `image` block. The Read tool of Claude Code sends one for a png, jpg, gif, or webp file.
const base64ImageBlockSchema = z.object({
	type: z.literal("image"),
	source: z.object({
		type: z.literal("base64"),
		media_type: z.string(),
		data: z.string(),
	}),
});

// A base64 PDF `document` block. The Read tool of Claude Code sends one for a PDF file.
const base64PdfBlockSchema = z.object({
	type: z.literal("document"),
	source: z.object({
		type: z.literal("base64"),
		media_type: z.literal("application/pdf"),
		data: z.string(),
	}),
});

// The prompt cache breakpoint of a block. The text block in its place keeps
// it, so the cached prefix ends at the same place.
const cacheControlSchema = z.object({
	cache_control: z.looseObject({ type: z.string() }),
});

// The first line of an image description, so the model knows where the text comes from.
const IMAGE_DESCRIPTION_HEADER =
	"[Image description by a vision model: this model cannot see images.]";

// The first line of an extracted PDF text.
const PDF_TEXT_HEADER =
	"[PDF text, extracted: this model cannot read PDF files.]";

// Takes the place of an image that the describer could not read. The raw image never goes to a text-only host.
const IMAGE_UNREADABLE_TEXT =
	"[Image omitted: the image could not be described, and this model cannot see images.]";

// The last line of a description that stopped at the output cap, so the model knows that parts are missing.
const IMAGE_DESCRIPTION_CUT_LINE =
	"[The description stops here: it reached its length limit.]";

// 10 min, the TTL of an image the describer could not read. One agent loop sends the image on many
// requests; without this, each request pays a new call and waits up to 30 s. A later turn tries again.
const IMAGE_UNREADABLE_CACHE_TTL_SEC = 10 * 60;

// Takes the place of a document with no text to extract, or of a document that is not a base64 PDF.
const DOCUMENT_UNREADABLE_TEXT =
	"[Document omitted: its text could not be extracted, and this model cannot read documents.]";

// Marks the `llm_proxy_requests` row of a describer call. The other rows of the turn carry the builder model.
const IMAGE_DESCRIPTION_ROW_REASON = "image_description";

// The decoded bytes of one image or PDF block, with their hex sha256: the key of the block text cache.
type BlockSource =
	| { kind: "image"; mediaType: string; bytes: Buffer; sha256: string }
	| { kind: "pdf"; bytes: Buffer; sha256: string };

// Paper answers 400 to a PDF `document` block and to any `thinking` or
// `redacted_thinking` block in the history (Paper docs). Paper sends no
// thinking blocks itself, so they come from a Claude model before a switch.
const PAPER_REFUSED_BLOCK_TYPES = new Set([
	"document",
	"redacted_thinking",
	"thinking",
]);

// Takes the place of a refused block, so the model knows that content is gone.
const PAPER_OMITTED_BLOCK = {
	type: "text",
	text: "[Content omitted: this model cannot read PDF files or the thinking of another model.]",
} as const;

// The 400 text of a Claude upstream for a thinking block that another model
// signed (live probe 2026-11-19: Gemini history, then Opus). Claude Code
// matches the same words without the backticks.
const INVALID_THINKING_SIGNATURE =
	/invalid `?signature`? in `?thinking`? block/i;

// The blocks the thinking retry removes from the earlier turns.
const THINKING_BLOCK_TYPES = new Set(["redacted_thinking", "thinking"]);

// Takes the place of an assistant message that held only thinking blocks:
// Claude refuses an empty `content` array.
const OMITTED_THINKING_BLOCK = {
	type: "text",
	text: "[Thinking omitted: another model wrote it.]",
} as const;

// The `system` of a request, for the identity rewrite. It has its own parse:
// a failure in `anthropicRequestBodySchema` would drop the model routing.
const anthropicSystemSchema = z.union([
	z.string(),
	z.array(z.looseObject({ type: z.string(), text: z.string().optional() })),
]);

// The effort fields of a request, for the thinking rewrite. It has its own
// parse: a failure in `anthropicRequestBodySchema` would drop the model routing.
const anthropicEffortSchema = z.object({
	output_config: z.looseObject({ effort: z.string() }),
	thinking: z.looseObject({ type: z.string() }).optional(),
});

// The system prompt of Claude Code 2.1.281 opens with one of these lines.
// The SDK with an appended prompt sends the second line.
const HARNESS_IDENTITY_LINES = [
	"You are Claude Code, Anthropic's official CLI for Claude.",
	"You are Claude Code, Anthropic's official CLI for Claude, running within the Claude Agent SDK.",
	"You are a Claude agent, built on Anthropic's Claude Agent SDK.",
] as const;

// Takes the place of each `HARNESS_IDENTITY_LINES` line.
const WANDIT_IDENTITY_LINE =
	"You are the Wandit builder, an AI assistant that builds apps for Wandit users.";

// The bullets that name the Claude models, Claude Code, or its help and
// feedback channel: the "# Environment" bullets and the help bullet of
// "# Doing tasks" with its two sub-bullets ("  - "). The match takes the
// whole line and its newline.
const HARNESS_NAME_BULLET =
	/^ {1,2}- (?:The most recent Claude models are|Claude Code is available as a CLI|Fast mode for Claude Code|If the user asks for help or wants to give feedback|\/help: Get help with using Claude Code|To give feedback, users should report the issue at)[^\n]*\n?/gm;

// "You are powered by the model named Opus 4.8. The exact model ID is
// claude-opus-4-8[1m]." A gateway model has no name: "... the model x/y."
// An id can hold dots, so a dot ends the sentence only before a space, `<`, or the end.
const MODEL_SENTENCE =
	/You are powered by the model (?:named [^\n]+?\. The exact model ID is )?\S+?\.(?=\s|$|<)/g;

// Follows `MODEL_SENTENCE`. The match takes the space before it, so no blank stays.
const KNOWLEDGE_CUTOFF_SENTENCE =
	/ ?Assistant knowledge cutoff is [^\n]+?\.(?=\s|$|<)/g;

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
		// Null without both Langfuse keys: the proxy then traces nothing.
		@Inject(LangfuseExporter)
		private readonly langfuse: LlmGenerationSink | null,
		// `v2DisabledModels`, the ops switch per model. `get` caches the row 30 s.
		@Inject(ProductSettingsService)
		private readonly settings: {
			get(): Promise<Pick<ProductSettings, "v2DisabledModels">>;
		},
		// The text of each image and PDF block for a text-only host model, by the sha256 of its bytes.
		@Inject(RedisBlockTextCache)
		private readonly blockTexts: BlockTextCache,
		// The vision model call that describes one image for a text-only host model.
		@Inject(LlmProxyImageDescriber)
		private readonly imageDescriber: Pick<LlmProxyImageDescriber, "describe">,
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
		let verified: VerifiedLlmProxyToken;
		try {
			verified = this.verifyBearer(input.authorization);
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
		const { claims } = verified;

		// 1b. One Redis round trip reads the revoke flag, the rate window, and
		// both spend counters. It also marks the request in flight until its
		// row is written: the turn settle waits for that (Phase 1, report
		// 6.3), or a turn without a commit could settle before its last row.
		const admission = await this.counters.admitRequest(
			{
				chatId: claims.chatId ?? null,
				runId: claims.runId,
				userId: claims.userId,
			},
			utcDayKey(),
		);
		// A bound chat bills the request to the turn that runs now: a continued
		// Claude Code process keeps the token of an older turn of the chat.
		// The binding has no `exp`. For an expired token, the bound turn's own
		// token ends at most one TTL from now, so the spend counter outlives it.
		const billedClaims: LlmProxyTokenClaims =
			admission.binding === null
				? claims
				: {
						...admission.binding,
						chatId: claims.chatId,
						exp: verified.isExpired
							? Math.floor(Date.now() / 1000) + LLM_PROXY_TOKEN_TTL_SECONDS
							: claims.exp,
					};
		try {
			// Security: an expired token passes only for a chat with a live
			// binding. A kept Claude Code process holds the token of an earlier
			// turn, and the binding exists only while a turn of that chat runs.
			// The request then bills to that turn. Every other expired token is dead.
			if (
				verified.isExpired &&
				(claims.chatId === undefined || admission.binding === null)
			) {
				await this.sendError(
					reply,
					401,
					"V2_TOKEN_INVALID",
					"Invalid or expired run token",
				);
				return;
			}
			await this.checkAndForward(
				input,
				reply,
				billedClaims,
				admission,
				startedAt,
			);
		} finally {
			await this.finishInFlight(billedClaims);
		}
	}

	/**
	 * Steps 1c to 6 of `proxyAnthropic`: the revoke flag, the model
	 * allow-list, the rate limit, both spend caps, then the upstream call.
	 * Every path that writes a row writes it before it returns.
	 */
	private async checkAndForward(
		input: LlmProxyInboundRequest,
		reply: LlmProxyReply,
		claims: LlmProxyTokenClaims,
		admission: LlmRequestAdmission,
		startedAt: number,
	): Promise<void> {
		// 1c. A revoked run: the turn ended, so the token is dead even though
		// it has not expired. Same rule as a bad token — the claims of a
		// dead run are not trusted, so no row is written.
		if (admission.revoked) {
			this.logger.warn("llm-proxy.revoked-run", {
				runId: claims.runId,
				turnId: claims.turnId,
			});
			await this.sendError(reply, 401, "V2_TOKEN_INVALID", "Run token revoked");
			return;
		}

		// 2. Model check (pricing v8 D10): every priced model is open to every
		// user, and the API does not read `claims.plan`. An absent model means
		// the deploy default. A named model with no price row gets a 403 and a
		// `model_denied` row here. Claude Code resolves its aliases to dated
		// bare ids (`claude-haiku-4-5-20251001`); normalize them onto the
		// `anthropic/...` price ids before the check.
		const bodyJson = this.parseBody(input.body);
		const requestedModel =
			bodyJson?.model === undefined
				? undefined
				: normalizeInboundModelId(bodyJson.model);
		const defaultModel = this.requireEnv("V2_DEFAULT_MODEL");
		if (
			requestedModel !== undefined &&
			requestedModel !== defaultModel &&
			llmModelPrice(requestedModel) === undefined
		) {
			// The message text stays: `SESSION_BOUND_FAILURE_PATTERN` of the
			// builder-turn runtime matches it to reset a resumed session.
			await this.reject(reply, claims, input, startedAt, {
				status: 403,
				code: "V2_MODEL_DENIED",
				message: "This plan may not call that model",
				reason: requestedModel,
				rowStatus: "model_denied",
			});
			return;
		}
		const modelId = requestedModel ?? defaultModel;

		// 2b. Ops turned this model off during a provider incident. A retry
		// cannot help until they turn it on again, so the SDK must not retry.
		if ((await this.settings.get()).v2DisabledModels.includes(modelId)) {
			await this.reject(reply, claims, input, startedAt, {
				status: 403,
				code: "V2_MODEL_DISABLED",
				message: "This model is turned off for now",
				reason: `disabled:${modelId}`,
				rowStatus: "model_denied",
				headers: { "x-should-retry": "false" },
			});
			return;
		}

		// 3. Per-run request rate limit, a fixed one-minute window. The
		// admission counted this request, a denied one included.
		if (admission.rateHits > LLM_RUN_RATE_LIMIT_PER_MINUTE) {
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

		// GENERATION_BILLING_MODE=off is the local test mode. It skips both
		// spend caps, so a long build runs to its end. The env schema refuses
		// `off` when NODE_ENV=production.
		const spendCapsOff = this.env.GENERATION_BILLING_MODE === "off";

		// 4. Per-run spend cap from the token claims.
		// UNIT: claims carry USD; counters carry micros.
		const capMicros = Math.round(claims.capUsd * 1_000_000);
		if (!spendCapsOff && admission.runSpendMicros >= capMicros) {
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

		// 5. Per-user daily spend cap. LLM_DAILY_CAP_OFF removes only this cap,
		// for staging tests; the run cap above still stops a turn.
		if (
			!spendCapsOff &&
			this.env.LLM_DAILY_CAP_OFF !== true &&
			admission.userSpendMicros >= LLM_PROXY_DAILY_USER_CAP_USD * 1_000_000
		) {
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

	/**
	 * Ends the in-flight mark of an admitted request. A Redis failure only
	 * logs: the mark expires on its TTL and the settle wait is bounded.
	 */
	private async finishInFlight(claims: LlmProxyTokenClaims): Promise<void> {
		try {
			await this.counters.finishRequest(claims.runId);
		} catch (error) {
			this.logger.error(
				`In-flight finish failed for run ${claims.runId}`,
				error instanceof Error ? error.message : String(error),
			);
		}
	}

	private verifyBearer(
		authorization: string | undefined,
	): VerifiedLlmProxyToken {
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

	private requireEnv(
		name: Exclude<keyof LlmProxyEnv, "LLM_DAILY_CAP_OFF">,
	): string {
		const value = this.env[name];
		if (value === undefined) {
			throw new ServiceUnavailableException({
				code: "V2_ENV_MISSING",
				message: `${name} is not set`,
			});
		}
		return value;
	}

	/**
	 * The `messages` of a request to a text-only host model, with a text block in
	 * place of each image and document block, also inside a `tool_result`.
	 * The same bytes always give the same text, so the prompt cache still hits.
	 * Returns null when the field does not parse or has no such block.
	 */
	private async textOnlyHostMessages(
		messages: unknown,
		input: LlmProxyInboundRequest,
		claims: LlmProxyTokenClaims,
	): Promise<AnthropicMessages | null> {
		const parsed = anthropicMessagesSchema.safeParse(messages);
		if (!parsed.success) {
			return null;
		}
		const blocks = imageAndDocumentBlocksOf(parsed.data);
		if (blocks.length === 0) {
			return null;
		}
		// Keyed by the block object: the rewrite below walks the same parsed objects.
		const sourceOfBlock = new Map<AnthropicInnerBlock, BlockSource>();
		const sourceBySha = new Map<string, BlockSource>();
		for (const block of blocks) {
			const source = blockSourceOf(block);
			if (source !== null) {
				sourceOfBlock.set(block, source);
				sourceBySha.set(source.sha256, source);
			}
		}
		const texts = await this.blockTexts.getMany([...sourceBySha.keys()]);
		// The new blocks of one request load in parallel, so the request waits for the slowest one only.
		// LIMIT: no cap on parallel describer calls; a first request with 30 new images makes 30 calls.
		// Upgrade: a small pool of concurrent calls.
		await Promise.all(
			[...sourceBySha.values()]
				.filter((source) => !texts.has(source.sha256))
				.map(async (source) => {
					texts.set(
						source.sha256,
						await this.blockTextOf(source, input, claims),
					);
				}),
		);
		return withTextInPlaceOfBlocks(parsed.data, (block) => {
			const source = sourceOfBlock.get(block);
			const text = source === undefined ? undefined : texts.get(source.sha256);
			return (
				text ??
				(block.type === "image"
					? IMAGE_UNREADABLE_TEXT
					: DOCUMENT_UNREADABLE_TEXT)
			);
		});
	}

	/**
	 * The text of one block that is not in the cache. A PDF gets its extracted
	 * text, an image gets a description. A good text goes into the cache for 7 days.
	 * A describer failure or an empty answer gives the fixed text, cached for 10 minutes only.
	 */
	private async blockTextOf(
		source: BlockSource,
		input: LlmProxyInboundRequest,
		claims: LlmProxyTokenClaims,
	): Promise<string> {
		if (source.kind === "pdf") {
			const extracted = await extractAttachmentText(
				source.bytes,
				"application/pdf",
			);
			// The extraction gives the same answer for the same bytes, so a failure is cached too.
			const text =
				"error" in extracted || extracted.text.trim() === ""
					? DOCUMENT_UNREADABLE_TEXT
					: `${PDF_TEXT_HEADER}\n${extracted.text}`;
			if ("error" in extracted) {
				this.logger.warn("llm-proxy.pdf-text-failed", {
					runId: claims.runId,
					turnId: claims.turnId,
					bytes: source.bytes.length,
					message: extracted.error,
				});
			}
			await this.blockTexts.set(source.sha256, text, BLOCK_TEXT_CACHE_TTL_SEC);
			return text;
		}
		let description: ImageDescription;
		try {
			description = await this.imageDescriber.describe(
				{ mediaType: source.mediaType, bytes: source.bytes },
				{ userId: claims.userId, organizationId: claims.workspaceId },
			);
		} catch (error) {
			// LIMIT: a call that failed after the provider read the image writes no row,
			// so its cost stays unbilled. Upgrade: read the usage from the error.
			this.logger.warn("llm-proxy.image-description-failed", {
				runId: claims.runId,
				turnId: claims.turnId,
				model: IMAGE_DESCRIBER_MODEL,
				mediaType: source.mediaType,
				bytes: source.bytes.length,
				message: getErrorMessage(error),
			});
			await this.blockTexts.set(
				source.sha256,
				IMAGE_UNREADABLE_TEXT,
				IMAGE_UNREADABLE_CACHE_TTL_SEC,
			);
			return IMAGE_UNREADABLE_TEXT;
		}
		await this.recordImageDescription(input, claims, description);
		if (description.text === "") {
			this.logger.warn("llm-proxy.image-description-empty", {
				runId: claims.runId,
				turnId: claims.turnId,
				model: IMAGE_DESCRIBER_MODEL,
				mediaType: source.mediaType,
				finishReason: description.finishReason,
			});
			// The call is billed already. The cache stops the next requests of the loop from paying again.
			await this.blockTexts.set(
				source.sha256,
				IMAGE_UNREADABLE_TEXT,
				IMAGE_UNREADABLE_CACHE_TTL_SEC,
			);
			return IMAGE_UNREADABLE_TEXT;
		}
		if (description.finishReason === "length") {
			// A cut text shows that the output cap is too small for this kind of image.
			this.logger.warn("llm-proxy.image-description-cut", {
				runId: claims.runId,
				turnId: claims.turnId,
				model: IMAGE_DESCRIBER_MODEL,
				outputTokens: description.usage.outputTokens,
			});
		}
		// A cut text is still useful. It is cached like a full text, so the loop pays once.
		const text =
			description.finishReason === "length"
				? `${IMAGE_DESCRIPTION_HEADER}\n${description.text}\n${IMAGE_DESCRIPTION_CUT_LINE}`
				: `${IMAGE_DESCRIPTION_HEADER}\n${description.text}`;
		await this.blockTexts.set(source.sha256, text, BLOCK_TEXT_CACHE_TTL_SEC);
		return text;
	}

	/**
	 * Bills one describer call to the turn: one more `llm_proxy_requests` row,
	 * which the turn settle sums with the other rows, and the spend counters.
	 */
	private async recordImageDescription(
		input: LlmProxyInboundRequest,
		claims: LlmProxyTokenClaims,
		description: ImageDescription,
	): Promise<void> {
		try {
			await this.requests.insert({
				runId: claims.runId,
				turnId: claims.turnId,
				userId: claims.userId,
				projectId: claims.projectId,
				organizationId: claims.workspaceId,
				provider: IMAGE_DESCRIBER_PROVIDER,
				model: IMAGE_DESCRIBER_MODEL,
				inboundFormat: "anthropic",
				inputTokens: description.usage.inputTokens,
				outputTokens: description.usage.outputTokens,
				cacheReadTokens: description.usage.cacheReadTokens,
				cacheWriteTokens: description.usage.cacheWriteTokens,
				usdMicros: description.usdMicros,
				status: "ok",
				reason: IMAGE_DESCRIPTION_ROW_REASON,
				upstreamRequestId: description.generationId,
				claudeSessionId: input.claudeSessionId ?? null,
				latencyMs: description.latencyMs,
			});
		} catch (error) {
			// A lost row loses the charge, so alert. The request still goes on with the description.
			this.logger.error(
				`llm_proxy_requests describer insert failed for run ${claims.runId}`,
				getErrorMessage(error),
			);
			Sentry.captureException(error, {
				tags: { feature: "llm-proxy", runId: claims.runId },
			});
			return;
		}
		if (description.usdMicros !== null && description.usdMicros > 0) {
			await this.addSpend(claims, description.usdMicros);
		}
	}

	// Adds a priced call to the run and the user spend counters. The run key
	// outlives the token by the grace window, at least one minute.
	private async addSpend(
		claims: LlmProxyTokenClaims,
		usdMicros: number,
	): Promise<void> {
		const ttlSeconds = Math.max(
			claims.exp + RUN_SPEND_TTL_GRACE_SECONDS - Math.floor(Date.now() / 1000),
			60,
		);
		await this.counters.addRunSpend(claims.runId, usdMicros, ttlSeconds);
		await this.counters.addUserSpend(claims.userId, utcDayKey(), usdMicros);
	}

	private async forwardAndAccount(
		input: LlmProxyInboundRequest,
		reply: LlmProxyReply,
		claims: LlmProxyTokenClaims,
		upstream: LlmUpstream,
		modelId: string,
		bodyJson: z.infer<typeof anthropicRequestBodySchema> | undefined,
		startedAt: number,
		// The messages of the thinking retry; null on the first attempt.
		retryMessages: z.infer<typeof anthropicMessagesSchema> | null = null,
	): Promise<void> {
		const path =
			input.endpoint === "count_tokens"
				? "/v1/messages/count_tokens"
				: "/v1/messages";
		const base = upstream.baseUrl.replace(/\/+$/, "");
		const url = `${base}${path}${input.queryString ? `?${input.queryString}` : ""}`;

		// A Paper id never matches the inbound id (the proxy drops its prefix),
		// so a Paper body is always rewritten, also its refused blocks. A text-only
		// host model gets text in place of its image and PDF blocks. The
		// thinking retry starts from its own messages.
		const blockSafeMessages =
			retryMessages ??
			(bodyJson === undefined
				? null
				: upstream.provider === PAPER_INSTRUMENTS_PROVIDER
					? paperSafeMessages(bodyJson.messages)
					: hasTextOnlyHosts(modelId)
						? await this.textOnlyHostMessages(bodyJson.messages, input, claims)
						: null);
		// The Claude Code preset names the vendor, the harness, and the model.
		// Every tier reads it, and Wandit sells the builder under its own name.
		// The rewrite runs on top of the Paper, the text-only host, or the retry output.
		const system =
			bodyJson === undefined ? null : wanditSystem(bodyJson.system);
		const messages =
			bodyJson === undefined
				? null
				: (wanditUserMessages(blockSafeMessages ?? bodyJson.messages) ??
					blockSafeMessages);
		// The thinking control of the turn. A count_tokens call has no effort to change.
		const outputConfig =
			bodyJson === undefined || input.endpoint === "count_tokens"
				? null
				: thinkingOutputConfig(bodyJson, claims.thinking, upstream.provider);
		// A body that keeps its model id and needs no rewrite keeps its raw
		// bytes. The rewrite gives the same bytes for the same input, so the
		// prompt cache still hits.
		const forwardBody =
			bodyJson === undefined ||
			(bodyJson.model === upstream.upstreamModelId &&
				system === null &&
				messages === null &&
				outputConfig === null)
				? input.body
				: Buffer.from(
						JSON.stringify({
							...bodyJson,
							model: upstream.upstreamModelId,
							...(messages === null ? {} : { messages }),
							...(system === null ? {} : { system }),
							...(outputConfig === null ? {} : { output_config: outputConfig }),
						}),
						"utf8",
					);

		const headers: Record<string, string> = {
			"content-type": "application/json",
			"anthropic-version": input.anthropicVersion ?? ANTHROPIC_VERSION_FALLBACK,
			"x-wandit-run": input.wanditRun ?? claims.runId,
		};
		if (input.anthropicBeta !== undefined) {
			// The harness adds `[1m]` to every 1M model, so Claude Code sends the
			// Claude 1M beta also to Paper and to gateway models. Only Claude reads it,
			// and Paper answered 400 to other betas that it does not know.
			const betas =
				upstream.provider === "anthropic"
					? input.anthropicBeta
					: input.anthropicBeta
							.split(",")
							.map((beta) => beta.trim())
							.filter((beta) => beta !== CLAUDE_1M_CONTEXT_BETA)
							.join(",");
			if (betas !== "") {
				headers["anthropic-beta"] = betas;
			}
		}
		// Paper sends all requests of one session id to one replica. The AI
		// Gateway pins one session to one provider credential, which holds the
		// prompt cache. More input then bills at the cache-read rate. The
		// sandbox sets the header, so only a UUID goes out.
		const sessionId = uuidSchema.safeParse(input.claudeSessionId);
		if (sessionId.success) {
			headers["x-session-id"] = sessionId.data;
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
				forwardBody,
				error,
			);
			return;
		}

		const responseHeaders = passthroughHeaders(upstreamResponse.headers);
		// The AI Gateway names its call in `x-generation-id` (live probe
		// headers); Anthropic and Paper send `request-id`.
		const upstreamRequestId =
			upstreamResponse.headers.get("x-generation-id") ??
			upstreamResponse.headers.get("request-id") ??
			upstreamResponse.headers.get("x-request-id") ??
			undefined;
		const contentType = upstreamResponse.headers.get("content-type") ?? "";

		if (!upstreamResponse.ok) {
			// The upstream refused or failed: its status and body go back
			// unchanged, and the row records `upstream_<status>`. One exception
			// is below.
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
					forwardBody,
					error,
					upstreamRequestId,
				);
				return;
			}
			const errorText = body.toString("utf8");
			// Claude refuses a thinking block that another model signed, so a
			// chat that switched from Gemini fails on every call. Retry once
			// without the thinking of earlier turns. No byte has gone to the
			// client, and this 400 writes no row: the retry writes the only one.
			// LIMIT: each call of such a chat pays one extra 400 round trip.
			// Upgrade: remember the strip per Claude Code session id.
			if (
				retryMessages === null &&
				upstreamResponse.status === 400 &&
				upstream.provider === "anthropic" &&
				INVALID_THINKING_SIGNATURE.test(errorText)
			) {
				const messages = withoutEarlierThinking(bodyJson?.messages);
				if (messages !== null) {
					this.logger.warn(
						`Retrying without earlier thinking blocks for run ${claims.runId}`,
						errorText.slice(0, 300),
					);
					await this.forwardAndAccount(
						input,
						reply,
						claims,
						upstream,
						modelId,
						bodyJson,
						startedAt,
						messages,
					);
					return;
				}
			}
			// Paper answers an empty balance with 429 `insufficient_quota`.
			// Claude Code retries a 429 for minutes, so the turn hangs. It does
			// not retry a 402, so the turn fails at once. The row keeps 429.
			const isPaperQuotaEmpty =
				upstreamResponse.status === 429 &&
				upstream.provider === PAPER_INSTRUMENTS_PROVIDER &&
				errorText.includes("insufficient_quota");
			reply.writeHead(
				isPaperQuotaEmpty ? 402 : upstreamResponse.status,
				responseHeaders,
			);
			await reply.write(body);
			reply.end();
			// A log search by status finds an empty gateway balance (402) or a
			// rate or spend limit (429). 300 chars of the body name the cause.
			this.logger.error(
				`Upstream answered ${upstreamResponse.status} for run ${claims.runId}`,
				errorText.slice(0, 300),
			);
			const sentryContext = upstreamSentryContext(
				claims.runId,
				upstream,
				modelId,
				String(upstreamResponse.status),
			);
			if (upstreamResponse.status >= 500) {
				// A 5xx here is the provider's problem, not the client's.
				Sentry.captureMessage("LLM upstream answered 5xx", {
					level: "error",
					...sentryContext,
				});
			} else if (
				upstreamResponse.status === 401 ||
				upstreamResponse.status === 402 ||
				upstreamResponse.status === 403 ||
				isPaperQuotaEmpty
			) {
				// The provider rejected the key, or the account has no funds.
				// An operator must act. Another 429 stays out: Claude Code retries it.
				Sentry.captureMessage(
					"LLM upstream refused the account (key or funds)",
					{ level: "error", ...sentryContext },
				);
			} else if (
				upstreamResponse.status === 400 ||
				upstreamResponse.status === 404 ||
				upstreamResponse.status === 413 ||
				upstreamResponse.status === 422
			) {
				// The model refuses this request shape, for example after a Claude
				// Code upgrade. Claude Code does not retry these, so one event per turn.
				Sentry.captureMessage("LLM upstream refused the request", {
					level: "warning",
					...sentryContext,
				});
			}
			await this.finish(input, claims, upstream, modelId, {
				status: "upstream_error",
				reason: `upstream_${upstreamResponse.status}`,
				usage: zeroUsage(),
				upstreamRequestId,
				latencyMs: Date.now() - startedAt,
				forwardedBody: forwardBody,
				message: null,
				upstreamErrorBody: errorText,
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
				forwardedBody: forwardBody,
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
				forwardBody,
				error,
				upstreamRequestId,
			);
			return;
		}
		if (input.abortSignal.aborted) {
			const json = safeJsonParse(body);
			await this.endClientAborted(
				input,
				reply,
				claims,
				upstream,
				modelId,
				startedAt,
				usageFromAnthropicJson(json),
				forwardBody,
				// Without Langfuse, the proxy does no content work.
				this.langfuse === null ? null : messageFromAnthropicJson(json),
				upstreamRequestId,
				gatewayCostFromAnthropicJson(json),
			);
			return;
		}
		reply.writeHead(upstreamResponse.status, responseHeaders);
		await reply.write(body);
		reply.end();
		const json = safeJsonParse(body);
		await this.finish(input, claims, upstream, modelId, {
			status: "ok",
			reason: null,
			usage: usageFromAnthropicJson(json),
			upstreamRequestId,
			latencyMs: Date.now() - startedAt,
			forwardedBody: forwardBody,
			// Without Langfuse, the proxy does no content work.
			message: this.langfuse === null ? null : messageFromAnthropicJson(json),
			upstreamErrorBody: null,
			gatewayCost: gatewayCostFromAnthropicJson(json),
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
			// The bytes the upstream got, for the Langfuse input.
			forwardedBody: Buffer;
		},
	): Promise<void> {
		reply.writeHead(options.response.status, options.responseHeaders);
		const parser = createAnthropicSseUsageParser({
			collectContent: this.langfuse !== null,
		});
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
				Sentry.captureException(
					error,
					upstreamSentryContext(
						claims.runId,
						upstream,
						modelId,
						"stream_failed",
					),
				);
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
		} else {
			// The status stays `ok`: the settle bills only ok and client_aborted
			// rows, and the provider bills the tokens before the problem.
			const end = parser.streamEnd();
			reason =
				end.errorType !== null
					? `stream_error:${end.errorType}`
					: end.sawMessageStop
						? null
						: "stream_truncated";
			if (reason !== null) {
				this.logger.warn(
					`Upstream stream ended with ${reason} for run ${claims.runId}`,
					{ model: modelId, provider: upstream.provider },
				);
			}
		}
		await this.finish(input, claims, upstream, modelId, {
			status,
			reason,
			usage: parser.usage(),
			upstreamRequestId: options.upstreamRequestId,
			latencyMs: Date.now() - options.startedAt,
			forwardedBody: options.forwardedBody,
			message: parser.message(),
			upstreamErrorBody: null,
			gatewayCost: parser.gatewayCost(),
		});
	}

	/**
	 * Ends the reply and writes the `client_aborted` row. `usage` and
	 * `message` are what the upstream sent before the abort: a parsed
	 * buffered body, or zero and null when no answer arrived.
	 */
	private async endClientAborted(
		input: LlmProxyInboundRequest,
		reply: LlmProxyReply,
		claims: LlmProxyTokenClaims,
		upstream: LlmUpstream,
		modelId: string,
		startedAt: number,
		usage: LlmTokenUsage,
		forwardedBody: Buffer,
		message: AnthropicAssistantMessage | null,
		upstreamRequestId?: string,
		// Gateway cost of a buffered body that arrived before the abort.
		gatewayCost?: LlmGatewayCost | null,
	): Promise<void> {
		reply.end();
		await this.finish(input, claims, upstream, modelId, {
			status: "client_aborted",
			reason: "client_aborted",
			usage,
			upstreamRequestId,
			latencyMs: Date.now() - startedAt,
			forwardedBody,
			message,
			upstreamErrorBody: null,
			gatewayCost,
		});
	}

	// Shared end for a call whose answer the client never saw: the fetch
	// itself failed, a buffered body read failed, or the client aborted.
	// A client abort writes the client_aborted row and closes the reply.
	// Any other failure logs, reports to Sentry, writes the upstream_error
	// row, and answers 502.
	private async failBeforeReply(
		input: LlmProxyInboundRequest,
		reply: LlmProxyReply,
		claims: LlmProxyTokenClaims,
		upstream: LlmUpstream,
		modelId: string,
		startedAt: number,
		forwardedBody: Buffer,
		error: unknown,
		upstreamRequestId?: string,
	): Promise<void> {
		if (input.abortSignal.aborted) {
			// LIMIT: the upstream may have billed a call whose answer never
			// arrived; the proxy cannot know that usage. Upgrade: reconcile
			// against the provider usage report.
			await this.endClientAborted(
				input,
				reply,
				claims,
				upstream,
				modelId,
				startedAt,
				zeroUsage(),
				forwardedBody,
				null,
				upstreamRequestId,
			);
			return;
		}
		this.logger.error(
			`Upstream call failed for run ${claims.runId}`,
			error instanceof Error ? error.message : String(error),
		);
		Sentry.captureException(
			error,
			upstreamSentryContext(claims.runId, upstream, modelId, "fetch_failed"),
		);
		await this.finish(input, claims, upstream, modelId, {
			status: "upstream_error",
			reason: "fetch_failed",
			usage: zeroUsage(),
			upstreamRequestId,
			latencyMs: Date.now() - startedAt,
			forwardedBody,
			message: null,
			upstreamErrorBody: null,
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
			bodyFields?: Record<string, string | number>;
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
		bodyFields?: Record<string, string | number>,
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
			// The bytes the upstream got: the inbound body or its rewrite.
			forwardedBody: Buffer;
			// The answer the parser rebuilt; null when none arrived or it did not parse.
			message: AnthropicAssistantMessage | null;
			// The upstream body of a non-2xx answer; null on every other path.
			upstreamErrorBody: string | null;
			// Real cost from `provider_metadata.gateway`. Only a 2xx answer has
			// it; absent or null writes null. Billing never reads it.
			gatewayCost?: LlmGatewayCost | null | undefined;
		},
	): Promise<void> {
		// Anthropic's count_tokens endpoint is free: the row keeps the token
		// count but charges 0 and skips the counters. A forwarded model always
		// has a price row — the service rejects unpriced models before fetch.
		const usdMicros =
			input.endpoint === "count_tokens"
				? 0
				: (priceUsdMicros(modelId, result.usage) ?? 0);
		// Langfuse gets each Messages call before the row insert, so a failed
		// insert still traces. The proxy skips count_tokens: Langfuse would
		// count its input twice. send() never throws and never waits.
		if (this.langfuse !== null && input.endpoint === "messages") {
			const endedAt = Date.now();
			this.langfuse.send({
				claims,
				provider: upstream.provider,
				modelId,
				claudeSessionId: input.claudeSessionId ?? null,
				upstreamRequestId: result.upstreamRequestId ?? null,
				status: result.status,
				reason: result.reason,
				usage: result.usage,
				usdMicros,
				startedAt: endedAt - result.latencyMs,
				endedAt,
				forwardedBody: result.forwardedBody,
				message: result.message,
				upstreamErrorBody: result.upstreamErrorBody,
			});
		}
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
				gatewayUsdMicros: result.gatewayCost?.usdMicros ?? null,
				gatewayProvider: result.gatewayCost?.provider ?? null,
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
			await this.addSpend(claims, usdMicros);
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
			gatewayUsdMicros: result.gatewayCost?.usdMicros ?? null,
			gatewayProvider: result.gatewayCost?.provider ?? null,
			status: result.status,
			latencyMs: result.latencyMs,
		});
	}
}

/**
 * The `messages` of a Paper request, with each block that Paper refuses
 * changed to `PAPER_OMITTED_BLOCK`, also inside a `tool_result` (the Read
 * tool sends a PDF there). Without it, one PDF read or one switch from a
 * Claude model makes every later call of the chat fail with 400. Returns
 * null when the field does not parse; the messages then go out unchanged.
 */
function paperSafeMessages(
	messages: unknown,
): z.infer<typeof anthropicMessagesSchema> | null {
	const parsed = anthropicMessagesSchema.safeParse(messages);
	if (!parsed.success) {
		return null;
	}
	const isRefused = (block: { type: string }) =>
		PAPER_REFUSED_BLOCK_TYPES.has(block.type);
	return parsed.data.map((message) => {
		if (!Array.isArray(message.content)) {
			return message;
		}
		const content = message.content.map((block) => {
			if (isRefused(block)) {
				return PAPER_OMITTED_BLOCK;
			}
			if (Array.isArray(block.content) && block.content.some(isRefused)) {
				return {
					...block,
					content: block.content.map((inner) =>
						isRefused(inner) ? PAPER_OMITTED_BLOCK : inner,
					),
				};
			}
			return block;
		});
		return { ...message, content };
	});
}

// True for a model id that starts with a prefix of `TEXT_ONLY_HOST_MODEL_PREFIXES`.
function hasTextOnlyHosts(modelId: string): boolean {
	return TEXT_ONLY_HOST_MODEL_PREFIXES.some((prefix) =>
		modelId.startsWith(prefix),
	);
}

// The block types that a text-only host refuses.
function isImageOrDocument(block: { type: string }): boolean {
	return block.type === "image" || block.type === "document";
}

// Every image and document block of the messages, top level and inside a `tool_result`.
function imageAndDocumentBlocksOf(
	messages: AnthropicMessages,
): AnthropicInnerBlock[] {
	return messages.flatMap((message) =>
		Array.isArray(message.content)
			? message.content.flatMap((block) =>
					isImageOrDocument(block)
						? [block]
						: Array.isArray(block.content)
							? block.content.filter(isImageOrDocument)
							: [],
				)
			: [],
	);
}

// The decoded bytes of a base64 image or base64 PDF block. Null for any other
// source (a URL, a file id, a text document): that block gets a fixed text.
function blockSourceOf(block: AnthropicInnerBlock): BlockSource | null {
	const image = base64ImageBlockSchema.safeParse(block);
	if (image.success) {
		const bytes = Buffer.from(image.data.source.data, "base64");
		return {
			kind: "image",
			mediaType: image.data.source.media_type,
			bytes,
			sha256: createHash("sha256").update(bytes).digest("hex"),
		};
	}
	const pdf = base64PdfBlockSchema.safeParse(block);
	if (pdf.success) {
		const bytes = Buffer.from(pdf.data.source.data, "base64");
		return {
			kind: "pdf",
			bytes,
			sha256: createHash("sha256").update(bytes).digest("hex"),
		};
	}
	return null;
}

/**
 * The messages with a text block in place of each image and document block,
 * top level and inside a `tool_result`, the same walk as `paperSafeMessages`.
 * `textOf` gives the text of one block. The text block keeps its `cache_control`.
 */
function withTextInPlaceOfBlocks(
	messages: AnthropicMessages,
	textOf: (block: AnthropicInnerBlock) => string,
): AnthropicMessages {
	const textBlockFor = (block: AnthropicInnerBlock) => {
		const cacheControl = cacheControlSchema.safeParse(block);
		return {
			type: "text",
			text: textOf(block),
			...(cacheControl.success
				? { cache_control: cacheControl.data.cache_control }
				: {}),
		};
	};
	return messages.map((message) => {
		if (!Array.isArray(message.content)) {
			return message;
		}
		const content = message.content.map((block) => {
			if (isImageOrDocument(block)) {
				return textBlockFor(block);
			}
			if (
				Array.isArray(block.content) &&
				block.content.some(isImageOrDocument)
			) {
				return {
					...block,
					content: block.content.map((inner) =>
						isImageOrDocument(inner) ? textBlockFor(inner) : inner,
					),
				};
			}
			return block;
		});
		return { ...message, content };
	});
}

/**
 * The `messages` of a Claude request without the thinking blocks of earlier
 * turns. The current tool loop starts at the last user message without a
 * `tool_result` block. Claude Code adds text blocks, such as system reminders,
 * next to a `tool_result`, so that message continues the loop. The loop keeps
 * its thinking: Claude needs it, and Claude wrote it.
 * Returns null when the field does not parse or no block goes.
 */
function withoutEarlierThinking(
	messages: unknown,
): z.infer<typeof anthropicMessagesSchema> | null {
	const parsed = anthropicMessagesSchema.safeParse(messages);
	if (!parsed.success) {
		return null;
	}
	const loopStart = parsed.data.findLastIndex(
		(message) =>
			message.role === "user" &&
			!(
				Array.isArray(message.content) &&
				message.content.some((block) => block.type === "tool_result")
			),
	);
	let removedBlocks = 0;
	const stripped = parsed.data.map((message, index) => {
		if (
			index >= loopStart ||
			message.role !== "assistant" ||
			!Array.isArray(message.content)
		) {
			return message;
		}
		const content = message.content.filter(
			(block) => !THINKING_BLOCK_TYPES.has(block.type),
		);
		removedBlocks += message.content.length - content.length;
		return {
			...message,
			content: content.length > 0 ? content : [OMITTED_THINKING_BLOCK],
		};
	});
	return removedBlocks === 0 ? null : stripped;
}

// Sentry tags and grouping for one upstream failure. `failure` is the HTTP
// status or a failure kind such as `fetch_failed`. One issue per failure
// and model, so an outage of one model stands out.
function upstreamSentryContext(
	runId: string,
	upstream: LlmUpstream,
	modelId: string,
	failure: string,
) {
	return {
		tags: {
			feature: "llm-proxy",
			runId,
			model: modelId,
			provider: upstream.provider,
			upstreamStatus: failure,
		},
		fingerprint: ["llm-upstream", failure, modelId],
	};
}

/**
 * The `system` of a request without the Claude Code identity. Returns null
 * when the field is absent, does not parse, or has no identity text. The
 * field then goes out unchanged; the persona rule of the prompt still applies.
 */
function wanditSystem(
	system: unknown,
): z.infer<typeof anthropicSystemSchema> | null {
	const parsed = anthropicSystemSchema.safeParse(system);
	if (!parsed.success) {
		return null;
	}
	const original = parsed.data;
	if (!Array.isArray(original)) {
		const text = wanditSystemText(original);
		return text === original ? null : text;
	}
	const blocks = original.map((block) => {
		if (block.type !== "text" || block.text === undefined) {
			return block;
		}
		const text = wanditSystemText(block.text);
		return text === block.text ? block : { ...block, text };
	});
	return blocks.some((block, index) => block !== original[index])
		? blocks
		: null;
}

// One system text: the Wandit persona line in place of the harness line,
// without the model bullets and the model sentences.
function wanditSystemText(text: string): string {
	let rewritten = text;
	for (const line of HARNESS_IDENTITY_LINES) {
		rewritten = rewritten.replaceAll(line, WANDIT_IDENTITY_LINE);
	}
	return withoutModelSentences(rewritten.replace(HARNESS_NAME_BULLET, ""));
}

/**
 * The `messages` without the model sentences in the text of user messages.
 * Claude Code puts them in a `<system-reminder>`. Assistant messages and
 * tool or thinking blocks stay as they are. Returns null when the field does
 * not parse or nothing changes.
 */
function wanditUserMessages(
	messages: unknown,
): z.infer<typeof anthropicMessagesSchema> | null {
	const parsed = anthropicMessagesSchema.safeParse(messages);
	if (!parsed.success) {
		return null;
	}
	const original = parsed.data;
	const rewritten = original.map((message) => {
		if (message.role !== "user") {
			return message;
		}
		const blocks = message.content;
		if (!Array.isArray(blocks)) {
			const content = withoutModelSentences(blocks);
			return content === blocks ? message : { ...message, content };
		}
		const content = blocks.map((block) => {
			if (block.type !== "text" || block.text === undefined) {
				return block;
			}
			const text = withoutModelSentences(block.text);
			return text === block.text ? block : { ...block, text };
		});
		return content.some((block, index) => block !== blocks[index])
			? { ...message, content }
			: message;
	});
	return rewritten.some((message, index) => message !== original[index])
		? rewritten
		: null;
}

/**
 * The `output_config` for the thinking level of the turn, with the same fields.
 * `light` sends effort "medium". `deep` sends "xhigh", or "max" on an Anthropic model.
 * Returns null for `balanced` or no level, when the body sends no effort (the
 * harness knows the model takes none), when the effort already matches, or when thinking is off.
 */
function thinkingOutputConfig(
	body: z.infer<typeof anthropicRequestBodySchema>,
	/** Level from the run token; absent on a token minted before the field. */
	level: BuilderThinking | undefined,
	/** `upstream.provider`: `upstreamFor` resolves it for every request, also `anthropic` for a bare `claude-` id. */
	provider: string,
): z.infer<typeof anthropicEffortSchema>["output_config"] | null {
	// Live test, 2026-11: on Opus 5.5 only "max" changes the thinking, "xhigh" does not.
	// On Gemini, "xhigh" already raises the thinking a lot.
	const target =
		level === "light"
			? "medium"
			: level === "deep"
				? provider === "anthropic"
					? "max"
					: "xhigh"
				: null;
	if (target === null) {
		return null;
	}
	const parsed = anthropicEffortSchema.safeParse(body);
	if (!parsed.success) {
		return null;
	}
	const { output_config: original, thinking } = parsed.data;
	// Claude Code holds the effort down when thinking is off: some models then refuse a higher effort.
	if (original.effort === target || thinking?.type === "disabled") {
		return null;
	}
	return { ...original, effort: target };
}

// Removes "You are powered by the model ..." and the cutoff sentence.
function withoutModelSentences(text: string): string {
	return text
		.replace(MODEL_SENTENCE, "")
		.replace(KNOWLEDGE_CUTOFF_SENTENCE, "");
}

function zeroUsage(): LlmTokenUsage {
	return {
		inputTokens: 0,
		outputTokens: 0,
		cacheReadTokens: 0,
		cacheWriteTokens: 0,
		cacheWrite5mTokens: 0,
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
// Node fetch decodes a gzip or br body but keeps content-encoding. The
// client would then decode the plain bytes again and fail.
function passthroughHeaders(headers: Headers): Record<string, string> {
	const blocked = new Set([
		"connection",
		"content-encoding",
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
