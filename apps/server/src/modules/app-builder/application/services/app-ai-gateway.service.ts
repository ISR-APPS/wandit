/**
 * The app AI gateway: an OpenAI-compatible chat route for V2 apps.
 * `AppAiGatewayController` feeds each call from an app's Edge Function.
 * The service checks the key, the project, the body, the rate limit, and
 * the credits. It forwards the body to the Vercel AI Gateway, relays the
 * answer, and bills the project payer through `MeteringService`.
 */
import { randomUUID } from "node:crypto";

import { Inject, Injectable, Logger } from "@nestjs/common";
import {
	APP_AI_KEY_SECRET_NAME,
	type AppAiErrorCode,
	type AppAiModel,
	type AppAiUpstreamUsage,
} from "@wandit/contracts";
import { getErrorMessage } from "@wandit/observability/error";
import { Sentry } from "@wandit/observability/nestjs";

import { InsufficientCreditsError } from "../../../credits/domain/errors/insufficient-credits.error";
import { MemberCreditLimitError } from "../../../credits/domain/errors/member-credit-limit.error";
import { MeteringService } from "../../../metering/application/services/metering.service";
import { ModelPricingService } from "../../../metering/application/services/model-pricing.service";
import {
	ModelPriceUnavailableError,
	type PricingSnapshot,
} from "../../../metering/domain/model-pricing";
import { appAiKeysEqual, projectIdOfAppAiKey } from "../../domain/app-ai-key";
import {
	type AppAiUpstreamBody,
	appAiMeteredUsage,
	appAiUsageFromJson,
	createAppAiSseUsageParser,
	parseAppAiRequest,
	upstreamErrorMessage,
} from "../../domain/app-ai-request";
import { LLM_PROXY_ENV, type LlmProxyEnv } from "../../domain/llm-upstream";
import { AppPublishRepository } from "../../infrastructure/persistence/app-publish.repository";
import {
	RATE_LIMIT_STORE,
	type RateLimitStore,
	rateLimitKey,
} from "../../presentation/http/guards/redis-rate-limit.guard";
import { LLM_PROXY_FETCH, type LlmProxyReply } from "./llm-proxy.service";
import { ProjectSecretsService } from "./project-secrets.service";

/** The Vercel AI Gateway chat route, OpenAI format. */
const UPSTREAM_URL = "https://ai-gateway.vercel.sh/v1/chat/completions";

/**
 * 300 s: the longest call, drain included. It ends the drain after a client
 * abort. `AppAiGatewayController` also closes a socket that is open longer.
 */
export const UPSTREAM_TIMEOUT_MS = 300_000;

// ESTIMATE: 60 calls per 60 s for each project. The window bounds the spend
// rate of one app and the overdraft of its concurrent calls.
const RATE_LIMIT_PER_WINDOW = 60;
const RATE_WINDOW_MS = 60_000;

// Bucket name in `rateLimitKey`; the key is `builder:rate:app-ai:<projectId>`.
const RATE_LIMIT_BUCKET = "app-ai";

// The provider name on the usage event.
const METERING_PROVIDER = "vercel-ai-gateway";

/** One inbound gateway call, already read off the socket. */
export type AppAiGatewayRequest = {
	/** The `Authorization` header; expected `Bearer wnd_ai_...`. */
	authorization: string | undefined;
	/** The exact body bytes; empty when the client sent none. */
	body: Buffer;
	/** Aborts when the client socket closes before the answer ends. */
	abortSignal: AbortSignal;
};

/** A refusal of the gateway, sent as the OpenAI error body. */
type AppAiFailure = {
	status: number;
	code: AppAiErrorCode;
	/** Short English text for the app developer, never shown in the Wandit UI. */
	message: string;
	/** Extra answer headers, for example `retry-after` on a 429. */
	headers?: Record<string, string>;
};

// Thrown by a check of `admit`; `chatCompletions` sends it before any reserve.
class AppAiRefusal extends Error {
	constructor(readonly failure: AppAiFailure) {
		super(failure.message);
	}
}

/** A call that passed every check: what the forward and the bill read. */
type AdmittedCall = {
	projectId: string;
	model: AppAiModel;
	upstreamBody: AppAiUpstreamBody;
	/** `AI_GATEWAY_API_KEY`; it goes only to the upstream header. */
	upstreamKey: string;
	/** The credit hold of the call; null when billing is off. */
	hold: {
		/** Id of the `ai_usage_events` row of the reserve. */
		eventId: string;
		/** Reserved centi-credits; the charge when the answer has no usage. */
		credits: number;
		/** Price terms of the reserve quote. The direct settle stores them when the answer has no usage. */
		pricingSnapshot: PricingSnapshot;
	} | null;
};

/**
 * What the forward tells the bill. `status` is the HTTP status the client
 * got, for the log line.
 */
type ForwardOutcome =
	| {
			/** The upstream refused or failed: the hold is refunded. */
			kind: "failed";
			status: number;
	  }
	| {
			/** A 2xx answer went out; null usage means the upstream sent none. */
			kind: "answered";
			status: number;
			usage: AppAiUpstreamUsage | null;
	  };

/** The fields of the one `app-ai.request` log line. Never a body or a key. */
type RequestTrace = {
	requestId: string;
	/** Null until the key parses. */
	projectId: string | null;
	/** Null until the body parses. */
	model: AppAiModel | null;
};

const INVALID_KEY: AppAiFailure = {
	status: 401,
	code: "invalid_api_key",
	message: "The API key is not valid.",
};

const GATEWAY_UNAVAILABLE: AppAiFailure = {
	status: 503,
	code: "gateway_unavailable",
	message: "The AI gateway is not available. Try again later.",
};

const UPSTREAM_ERROR: AppAiFailure = {
	status: 502,
	code: "upstream_error",
	message: "The model provider failed. Try again later.",
};

/** Application service behind `AppAiGatewayController`; see the file header. */
@Injectable()
export class AppAiGatewayService {
	private readonly logger = new Logger(AppAiGatewayService.name);

	constructor(
		@Inject(ProjectSecretsService)
		private readonly secrets: Pick<ProjectSecretsService, "readSystemValue">,
		@Inject(AppPublishRepository)
		private readonly projects: Pick<AppPublishRepository, "findProject">,
		@Inject(RATE_LIMIT_STORE)
		private readonly rateLimit: Pick<RateLimitStore, "hit">,
		@Inject(ModelPricingService)
		private readonly pricing: Pick<ModelPricingService, "quoteTokenUsage">,
		@Inject(MeteringService)
		private readonly metering: Pick<
			MeteringService,
			"refund" | "reserve" | "settle"
		>,
		@Inject(LLM_PROXY_ENV)
		private readonly env: Pick<
			LlmProxyEnv,
			"AI_GATEWAY_API_KEY" | "GENERATION_BILLING_MODE"
		>,
		@Inject(LLM_PROXY_FETCH) private readonly upstreamFetch: typeof fetch,
	) {}

	/**
	 * Answers one `POST /api/v2/ai/v1/chat/completions`. Returns after the
	 * answer ends and the hold is settled or refunded. Unexpected errors
	 * before the reserve go to the Nest exception filter.
	 */
	async chatCompletions(
		input: AppAiGatewayRequest,
		reply: LlmProxyReply,
	): Promise<void> {
		const startedAt = Date.now();
		const trace: RequestTrace = {
			requestId: randomUUID(),
			projectId: null,
			model: null,
		};
		let call: AdmittedCall;
		try {
			call = await this.admit(input, trace);
		} catch (error) {
			if (!(error instanceof AppAiRefusal)) {
				// The Nest filter sends the 500; the log keeps one line for each request.
				this.logRequest(trace, 500, null, null, startedAt);
				throw error;
			}
			await this.sendFailure(reply, input.abortSignal, trace, error.failure);
			this.logRequest(trace, error.failure.status, null, null, startedAt);
			return;
		}

		// A throw in the forward leaves "failed", so the hold is refunded.
		let outcome: ForwardOutcome = { kind: "failed", status: 500 };
		try {
			outcome = await this.forward(call, input.abortSignal, reply, trace);
		} finally {
			// Every path after the reserve ends here: one refund or one settle.
			const credits = await this.closeHold(call, outcome, trace);
			this.logRequest(
				trace,
				outcome.status,
				outcome.kind === "answered" ? outcome.usage : null,
				credits,
				startedAt,
			);
		}
	}

	// Steps 1 to 7: key, project, body, rate window, price, upstream key, and
	// hold. Each refusal throws `AppAiRefusal`; the hold is the last step.
	// It fills `trace` while the checks pass.
	private async admit(
		input: AppAiGatewayRequest,
		trace: RequestTrace,
	): Promise<AdmittedCall> {
		// 1. Security: a bad key format answers 401 before any database read.
		const presentedKey = input.authorization?.startsWith("Bearer ")
			? input.authorization.slice("Bearer ".length).trim()
			: null;
		const projectId =
			presentedKey === null ? null : projectIdOfAppAiKey(presentedKey);
		if (presentedKey === null || projectId === null) {
			throw new AppAiRefusal(INVALID_KEY);
		}
		trace.projectId = projectId;
		// Security: the full key is compared, so the random part of project A
		// never opens project B.
		const storedKey = await this.secrets.readSystemValue(
			projectId,
			APP_AI_KEY_SECRET_NAME,
		);
		if (storedKey === null || !appAiKeysEqual(presentedKey, storedKey)) {
			throw new AppAiRefusal(INVALID_KEY);
		}

		// 2. A deleted or V1 project answers like a wrong key: no leak.
		const project = await this.projects.findProject(projectId);
		if (
			project === null ||
			project.engine !== "v2_app" ||
			project.deletedAt !== null
		) {
			throw new AppAiRefusal(INVALID_KEY);
		}
		if (project.suspendedAt !== null) {
			throw new AppAiRefusal({
				status: 403,
				code: "project_suspended",
				message: "Wandit suspended this app.",
			});
		}

		// 3. The body: allow-listed fields, the model, and the output cap.
		const request = parseAppAiRequest(input.body);
		if (!request.ok) {
			throw new AppAiRefusal({
				status: 400,
				code: request.code,
				message: request.message,
			});
		}
		trace.model = request.model;

		// 4. Rate window of the project.
		const hit = await this.rateLimit
			.hit(rateLimitKey(RATE_LIMIT_BUCKET, projectId), RATE_WINDOW_MS)
			.catch((error: unknown) => {
				// Money path: without the window the overdraft has no bound, so
				// a Redis error fails closed.
				this.alert("App AI rate window read failed", trace, error);
				throw new AppAiRefusal(GATEWAY_UNAVAILABLE);
			});
		if (hit.count > RATE_LIMIT_PER_WINDOW) {
			throw new AppAiRefusal({
				status: 429,
				code: "rate_limited",
				message: `This app sent more than ${RATE_LIMIT_PER_WINDOW} AI calls in one minute.`,
				headers: {
					// The window TTL in ms, as whole seconds, at least 1.
					"retry-after": String(Math.max(1, Math.ceil(hit.ttlMs / 1000))),
				},
			});
		}

		// 5. Price and reserve estimate. Fails closed on an unpriced model.
		const quote = await this.pricing
			.quoteTokenUsage(request.model, {
				inputTokens: request.estimatedInputTokens,
				outputTokens: request.maxOutputTokens,
			})
			.catch((error: unknown) => {
				if (!(error instanceof ModelPriceUnavailableError)) {
					throw error;
				}
				// An allowed model has no price row: an operator must add it.
				this.alert("App AI model has no price", trace, error);
				throw new AppAiRefusal(GATEWAY_UNAVAILABLE);
			});

		// 6. The upstream key, before the reserve.
		const upstreamKey = this.env.AI_GATEWAY_API_KEY;
		if (upstreamKey === undefined) {
			this.alert("AI_GATEWAY_API_KEY is not set", trace);
			throw new AppAiRefusal(GATEWAY_UNAVAILABLE);
		}

		const call = {
			projectId,
			model: request.model,
			upstreamBody: request.upstreamBody,
			upstreamKey,
		};
		// 7. The credit hold. `off` is the local test mode; production refuses it.
		if (this.env.GENERATION_BILLING_MODE === "off") {
			this.logger.warn({ event: "app-ai.billing-off", ...trace });
			return { ...call, hold: null };
		}
		// LIMIT: each call takes the payer lock twice (reserve, settle).
		// Concurrent calls can overdraw; the reserve stacking floor and the
		// rate window bound it. Upgrade: one hold per app and minute.
		const event = await this.metering
			.reserve(
				"app_ai_gateway",
				{
					actorUserId: project.userId,
					organizationId: project.organizationId,
				},
				{
					attemptRef: trace.requestId,
					credits: quote.credits,
					idempotencyKey: `app-ai:${trace.requestId}`,
					model: request.model,
					projectId,
				},
			)
			.catch((error: unknown) => {
				// The org member limit is also "no credits" for the app.
				if (
					error instanceof InsufficientCreditsError ||
					error instanceof MemberCreditLimitError
				) {
					throw new AppAiRefusal({
						status: 402,
						code: "insufficient_credits",
						message: "The project has no credits left for AI calls.",
					});
				}
				throw error;
			});
		return {
			...call,
			hold: {
				eventId: event.id,
				credits: event.reservedCredits,
				pricingSnapshot: quote.pricingSnapshot,
			},
		};
	}

	// The upstream call and the relay of its answer.
	private async forward(
		call: AdmittedCall,
		abortSignal: AbortSignal,
		reply: LlmProxyReply,
		trace: RequestTrace,
	): Promise<ForwardOutcome> {
		let response: Response;
		try {
			response = await this.upstreamFetch(UPSTREAM_URL, {
				method: "POST",
				// Security: never the inbound headers; the app key stays here.
				headers: {
					authorization: `Bearer ${call.upstreamKey}`,
					"content-type": "application/json",
				},
				body: JSON.stringify(call.upstreamBody),
				// Not the client signal: a client abort must not stop the
				// upstream before the usage arrives.
				signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
			});
		} catch (error) {
			this.alert("App AI upstream call failed", trace, error);
			await this.sendFailure(reply, abortSignal, trace, UPSTREAM_ERROR);
			return { kind: "failed", status: UPSTREAM_ERROR.status };
		}

		if (!response.ok) {
			let text = "";
			try {
				text = await response.text();
			} catch (error) {
				// A lost error body only loses the upstream message.
				this.logger.warn({
					event: "app-ai.error-body-lost",
					...trace,
					errorText: getErrorMessage(error),
				});
			}
			const failure = upstreamFailure(response.status, text);
			if (failure.status >= 500) {
				this.alert(`App AI upstream answered ${response.status}`, trace);
			}
			await this.sendFailure(reply, abortSignal, trace, failure);
			return { kind: "failed", status: failure.status };
		}

		const contentType =
			response.headers.get("content-type") ?? "application/json";
		if (contentType.includes("text/event-stream") && response.body !== null) {
			return this.relayStream(
				response.body,
				response.status,
				abortSignal,
				reply,
				trace,
			);
		}

		let body: Buffer;
		try {
			body = Buffer.from(await response.arrayBuffer());
		} catch (error) {
			this.alert("App AI upstream body read failed", trace, error);
			await this.sendFailure(reply, abortSignal, trace, UPSTREAM_ERROR);
			return { kind: "failed", status: UPSTREAM_ERROR.status };
		}
		await this.writeWhole(
			reply,
			abortSignal,
			response.status,
			{ "content-type": contentType, "x-request-id": trace.requestId },
			body,
		);
		return {
			kind: "answered",
			status: response.status,
			usage: appAiUsageFromJson(body.toString("utf8")),
		};
	}

	// Relays each chunk at once and reads the usage from the SSE frames.
	private async relayStream(
		stream: ReadableStream<Uint8Array>,
		status: number,
		abortSignal: AbortSignal,
		reply: LlmProxyReply,
		trace: RequestTrace,
	): Promise<ForwardOutcome> {
		if (!abortSignal.aborted) {
			reply.writeHead(status, {
				"cache-control": "no-cache",
				"content-type": "text/event-stream",
				"x-request-id": trace.requestId,
			});
		}
		const parser = createAppAiSseUsageParser();
		const decoder = new TextDecoder();
		const reader = stream.getReader();
		try {
			for (;;) {
				const { done, value } = await reader.read();
				if (done) {
					break;
				}
				parser.feed(decoder.decode(value, { stream: true }));
				// After a client abort the loop keeps reading to the end: the
				// usage comes in the last frame, so a client cannot skip the bill.
				// A write to a closed socket would wait for `drain` forever.
				if (!abortSignal.aborted) {
					// LIMIT: a client that stops reading blocks this write until the
					// controller deadline closes the socket. The upstream timeout can
					// then end the drain, and the call costs its full hold.
					// Upgrade: read the upstream on its own loop and queue the client writes.
					await reply.write(value);
				}
			}
		} catch (error) {
			// The upstream socket died or the timeout ended the drain. The
			// status line is out, so only the log and the bill see it.
			this.alert("App AI upstream stream failed", trace, error);
		} finally {
			reader.releaseLock();
			reply.end();
		}
		return { kind: "answered", status, usage: parser.usage() };
	}

	// Returns the charged centi-credits, or null when nothing is known
	// (billing off, or a settle error). Never throws.
	private async closeHold(
		call: AdmittedCall,
		outcome: ForwardOutcome,
		trace: RequestTrace,
	): Promise<number | null> {
		const hold = call.hold;
		if (hold === null) {
			return null;
		}
		try {
			if (outcome.kind === "failed") {
				await this.metering.refund(hold.eventId, "app_ai_upstream_failed");
				return 0;
			}
			const usage = outcome.usage;
			if (usage === null) {
				// Should not happen with `include_usage`. The upstream did work,
				// so the call costs its hold: the upper bound of the estimate.
				this.alert("App AI answer had no usage", trace);
				const event = await this.metering.settle(hold.eventId, {
					finalCredits: hold.credits,
					model: call.model,
					pricing: "direct",
					pricingSnapshot: hold.pricingSnapshot,
					provider: METERING_PROVIDER,
				});
				return event.finalCredits;
			}
			// A call with no tokens costs nothing, not the 1 cc minimum charge.
			if (usage.prompt_tokens + usage.completion_tokens === 0) {
				await this.metering.refund(hold.eventId, "app_ai_no_tokens");
				return 0;
			}
			const event = await this.metering.settle(hold.eventId, {
				modelId: call.model,
				pricing: "token",
				provider: METERING_PROVIDER,
				rawUsage: usage,
				usage: appAiMeteredUsage(usage),
			});
			return event.finalCredits;
		} catch (error) {
			// LIMIT: a lost settle (a DB error, or an API restart during the call)
			// becomes a sweep refund after 40 min, so the call is free.
			// Upgrade: store the upstream generation id with
			// MeteringService.captureGeneration, so the sweep reconciles the hold.
			this.alert("App AI hold settle or refund failed", trace, error);
			return null;
		}
	}

	private async sendFailure(
		reply: LlmProxyReply,
		abortSignal: AbortSignal,
		trace: RequestTrace,
		failure: AppAiFailure,
	): Promise<void> {
		const body = {
			error: {
				message: failure.message,
				type: failure.status >= 500 ? "server_error" : "invalid_request_error",
				code: failure.code,
			},
		};
		await this.writeWhole(
			reply,
			abortSignal,
			failure.status,
			{
				"content-type": "application/json",
				"x-request-id": trace.requestId,
				...failure.headers,
			},
			Buffer.from(JSON.stringify(body), "utf8"),
		);
	}

	// Writes one whole answer. After a client abort it only ends the reply:
	// a write to a closed socket would wait for `drain` forever.
	private async writeWhole(
		reply: LlmProxyReply,
		abortSignal: AbortSignal,
		status: number,
		headers: Record<string, string>,
		body: Buffer,
	): Promise<void> {
		if (!abortSignal.aborted) {
			reply.writeHead(status, headers);
			await reply.write(body);
		}
		reply.end();
	}

	// An operator must act: a log line with context, and Sentry.
	private alert(message: string, trace: RequestTrace, error?: unknown): void {
		const errorText = error === undefined ? null : getErrorMessage(error);
		this.logger.error({ event: "app-ai.alert", message, ...trace, errorText });
		Sentry.captureMessage(message, {
			extra: { errorText },
			level: "error",
			tags: {
				feature: "app-ai-gateway",
				projectId: trace.projectId ?? "none",
				requestId: trace.requestId,
			},
		});
	}

	private logRequest(
		trace: RequestTrace,
		status: number,
		usage: AppAiUpstreamUsage | null,
		credits: number | null,
		startedAt: number,
	): void {
		this.logger.log({
			event: "app-ai.request",
			...trace,
			status,
			inputTokens: usage?.prompt_tokens ?? null,
			outputTokens: usage?.completion_tokens ?? null,
			credits,
			latencyMs: Date.now() - startedAt,
		});
	}
}

// Maps an upstream refusal to the answer of the app. The app never sees an
// error about the Wandit upstream account.
function upstreamFailure(status: number, bodyText: string): AppAiFailure {
	if (status === 400 || status === 404 || status === 413 || status === 422) {
		return {
			status,
			code: "invalid_request",
			message:
				upstreamErrorMessage(bodyText) ??
				"The model provider refused the request.",
		};
	}
	if (status === 429) {
		return {
			status: 429,
			code: "rate_limited",
			message: "The model provider is busy. Try again later.",
		};
	}
	// 401, 402, 403: the provider refused the Wandit key or account.
	if (status === 401 || status === 402 || status === 403) {
		return GATEWAY_UNAVAILABLE;
	}
	return UPSTREAM_ERROR;
}
