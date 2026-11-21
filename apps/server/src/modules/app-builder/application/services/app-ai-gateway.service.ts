/**
 * The app AI gateway: an OpenAI-compatible chat route for V2 apps.
 * `AppAiGatewayController` feeds each call from an app's Edge Function.
 * `AppAiAdmission` checks the key, the project, the rate limit, and holds
 * the credits; this service parses the body and quotes the tokens. It
 * forwards the body to the Vercel AI Gateway, relays the answer, and
 * bills the project payer through `MeteringService`.
 */
import { randomUUID } from "node:crypto";

import { Inject, Injectable, Logger } from "@nestjs/common";
import type { AppAiModel } from "@wandit/contracts";
import { getErrorMessage } from "@wandit/observability/error";

import { MeteringService } from "../../../metering/application/services/metering.service";
import { ModelPricingService } from "../../../metering/application/services/model-pricing.service";
import {
	ModelPriceUnavailableError,
	type PricingSnapshot,
	usdMicrosToCentiCredits,
} from "../../../metering/domain/model-pricing";
import {
	type AppAiAnswerUsage,
	type AppAiUpstreamBody,
	appAiGatewayCostUsdMicros,
	appAiMeteredUsage,
	appAiUsageFromJson,
	createAppAiSseUsageParser,
	parseAppAiRequest,
} from "../../domain/app-ai-request";
import {
	AppAiAdmission,
	type AppAiHold,
	AppAiRefusal,
	type AppAiTrace,
	GATEWAY_UNAVAILABLE,
	METERING_PROVIDER,
	UPSTREAM_ERROR,
	UPSTREAM_TIMEOUT_MS,
	upstreamFailure,
} from "./app-ai-admission";
import { LLM_PROXY_FETCH, type LlmProxyReply } from "./llm-proxy.service";

/** The Vercel AI Gateway chat route, OpenAI format. */
const UPSTREAM_URL = "https://ai-gateway.vercel.sh/v1/chat/completions";

/** One inbound gateway call, already read off the socket. */
export type AppAiGatewayRequest = {
	/** The `Authorization` header; expected `Bearer wnd_ai_...`. */
	authorization: string | undefined;
	/** The exact body bytes; empty when the client sent none. */
	body: Buffer;
	/** Aborts when the client socket closes before the answer ends. */
	abortSignal: AbortSignal;
};

/** A call that passed every check: what the forward and the bill read. */
type AdmittedCall = {
	projectId: string;
	model: AppAiModel;
	upstreamBody: AppAiUpstreamBody;
	/** `AI_GATEWAY_API_KEY`; it goes only to the upstream header. */
	upstreamKey: string;
	/**
	 * The credit hold of the call; null when billing is off. Its credits are
	 * the charge when the answer has no usage.
	 */
	hold: AppAiHold | null;
	/**
	 * Price terms of the quote that sized the hold. A "direct" settle writes
	 * them, and its credits use their `usdMicrosPerCredit`.
	 */
	pricingSnapshot: PricingSnapshot;
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
			usage: AppAiAnswerUsage | null;
	  };

/** Application service behind `AppAiGatewayController`; see the file header. */
@Injectable()
export class AppAiGatewayService {
	private readonly logger = new Logger(AppAiGatewayService.name);

	constructor(
		@Inject(AppAiAdmission) private readonly admission: AppAiAdmission,
		@Inject(ModelPricingService)
		private readonly pricing: Pick<ModelPricingService, "quoteTokenUsage">,
		@Inject(MeteringService)
		private readonly metering: Pick<MeteringService, "refund" | "settle">,
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
		const trace: AppAiTrace = {
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
			await this.admission.sendFailure(
				reply,
				input.abortSignal,
				trace,
				error.failure,
			);
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
		trace: AppAiTrace,
	): Promise<AdmittedCall> {
		// 1 and 2. The app key and its project.
		const project = await this.admission.checkKeyAndProject(
			input.authorization,
			trace,
		);

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
		await this.admission.checkRate(project.projectId, "generation", trace);

		// 5. Price and reserve estimate. Fails closed on an unpriced model.
		// Each input token counts at the cache write rate, as in the token
		// fallback. The prompt estimate of this one call picks the tier rate.
		const quote = await this.pricing
			.quoteTokenUsage(
				request.model,
				{
					inputTokens: request.estimatedInputTokens,
					inputTokenDetails: {
						cacheWriteTokens: request.estimatedInputTokens,
						noCacheTokens: 0,
					},
					outputTokens: request.maxOutputTokens,
				},
				undefined,
				request.estimatedInputTokens,
			)
			.catch((error: unknown) => {
				if (!(error instanceof ModelPriceUnavailableError)) {
					throw error;
				}
				// An allowed model has no price row: an operator must add it.
				this.admission.alert("App AI model has no price", trace, error);
				throw new AppAiRefusal(GATEWAY_UNAVAILABLE);
			});

		// 6. The upstream key, before the reserve.
		const upstreamKey = this.admission.upstreamKey(trace);

		// 7. The credit hold.
		const hold = await this.admission.hold(
			project,
			{
				credits: quote.credits,
				estimatedCostUsdMicros: null,
				model: request.model,
			},
			trace,
		);
		return {
			projectId: project.projectId,
			model: request.model,
			upstreamBody: request.upstreamBody,
			upstreamKey,
			hold,
			pricingSnapshot: quote.pricingSnapshot,
		};
	}

	// The upstream call and the relay of its answer.
	private async forward(
		call: AdmittedCall,
		abortSignal: AbortSignal,
		reply: LlmProxyReply,
		trace: AppAiTrace,
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
			this.admission.alert("App AI upstream call failed", trace, error);
			await this.admission.sendFailure(
				reply,
				abortSignal,
				trace,
				UPSTREAM_ERROR,
			);
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
				this.admission.alert(
					`App AI upstream answered ${response.status}`,
					trace,
				);
			}
			await this.admission.sendFailure(reply, abortSignal, trace, failure);
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
			this.admission.alert("App AI upstream body read failed", trace, error);
			await this.admission.sendFailure(
				reply,
				abortSignal,
				trace,
				UPSTREAM_ERROR,
			);
			return { kind: "failed", status: UPSTREAM_ERROR.status };
		}
		await this.admission.writeWhole(
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
		trace: AppAiTrace,
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
			this.admission.alert("App AI upstream stream failed", trace, error);
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
		trace: AppAiTrace,
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
				this.admission.alert("App AI answer had no usage", trace);
				const event = await this.metering.settle(hold.eventId, {
					finalCredits: hold.credits,
					model: call.model,
					pricing: "direct",
					pricingSnapshot: call.pricingSnapshot,
					provider: METERING_PROVIDER,
				});
				return event.finalCredits;
			}
			const costUsdMicros = appAiGatewayCostUsdMicros(usage);
			const meteredUsage = appAiMeteredUsage(usage);
			// The reasoning tokens bill as output; `completion_tokens` leaves them out.
			const outputTokens =
				usage.completion_tokens +
				(usage.completion_tokens_details?.reasoning_tokens ?? 0);
			// A call with no tokens and no cost costs nothing, not the 1 cc minimum charge.
			if (costUsdMicros === null && usage.prompt_tokens + outputTokens === 0) {
				await this.metering.refund(hold.eventId, "app_ai_no_tokens");
				return 0;
			}
			if (costUsdMicros !== null) {
				// The gateway cost has the tier, the reasoning, the cache write, and
				// the provider rate, so it is the exact bill. The credit anchor of
				// the hold keeps the price of a config change during the call.
				const event = await this.metering.settle(hold.eventId, {
					costUsdMicros,
					finalCredits: usdMicrosToCentiCredits(
						costUsdMicros,
						call.pricingSnapshot.usdMicrosPerCredit,
					),
					model: call.model,
					pricing: "direct",
					pricingSnapshot: call.pricingSnapshot,
					provider: METERING_PROVIDER,
					rawUsage: usage,
					// The real counts, not the cache write map of the token fallback.
					usage: {
						cacheReadTokens: usage.prompt_tokens_details?.cached_tokens ?? 0,
						inputTokens: usage.prompt_tokens,
						outputTokens,
					},
				});
				return event.finalCredits;
			}
			// Should not happen: the gateway sends the cost in each answer.
			this.admission.alert("App AI answer had no gateway cost", trace);
			// The catalog rate can be below the provider cost: see the LIMIT mark at APP_AI_MODELS.
			const event = await this.metering.settle(hold.eventId, {
				modelId: call.model,
				pricing: "token",
				// One answer is one upstream call, so its prompt picks the tier.
				promptTokens: usage.prompt_tokens,
				provider: METERING_PROVIDER,
				rawUsage: usage,
				usage: meteredUsage,
			});
			return event.finalCredits;
		} catch (error) {
			// LIMIT: a lost settle (a DB error, or an API restart during the call)
			// becomes a sweep refund after 40 min, so the call is free.
			// Upgrade: store the upstream generation id with
			// MeteringService.captureGeneration, so the sweep reconciles the hold.
			this.admission.alert("App AI hold settle or refund failed", trace, error);
			return null;
		}
	}

	private logRequest(
		trace: AppAiTrace,
		status: number,
		usage: AppAiAnswerUsage | null,
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
