/**
 * The video routes of the app AI gateway: create a job, read its status,
 * read its bytes, and the webhook of the Vercel AI Gateway.
 * `AppAiGatewayController` calls it. `AppAiAdmission` checks the key, the
 * project, the rate window, and holds the credits. The AI SDK async video
 * functions start and read the job. No table holds the job: the signed job id does.
 */
import { randomUUID } from "node:crypto";

import { createGateway } from "@ai-sdk/gateway";
import { Inject, Injectable, Logger } from "@nestjs/common";
import {
	APP_AI_VIDEO_CAPABILITIES,
	APP_AI_VIDEO_MODELS,
	type AppAiVideoBillingClaims,
	type AppAiVideoCreateResponse,
	type AppAiVideoJobClaims,
	type AppAiVideoStatusResponse,
	appAiVideoCallbackQuerySchema,
	appAiVideoCallbackSchema,
	appAiVideoJobClaimsSchema,
	appAiVideoJobQuerySchema,
	appAiVideoRequestSchema,
	appBuilderRoutes,
} from "@wandit/contracts";
import {
	experimental_getVideoStatus,
	experimental_startVideo,
	type GetVideoStatusResult,
} from "ai";

import { MeteringService } from "../../../metering/application/services/metering.service";
import { ModelPricingService } from "../../../metering/application/services/model-pricing.service";
import { MeteringStateConflictError } from "../../../metering/domain/metering";
import { parseAppAiJsonBody } from "../../domain/app-ai-request";
import {
	AppAiVideoTokenError,
	appAiVideoSettlement,
	appAiVideoUpstreamFields,
	mintAppAiVideoToken,
	verifyAppAiVideoBillingToken,
	verifyAppAiVideoJobToken,
} from "../../domain/app-ai-video-job";
import { LLM_PROXY_ENV, type LlmProxyEnv } from "../../domain/llm-upstream";
import {
	AppAiAdmission,
	type AppAiFailure,
	AppAiRefusal,
	type AppAiTrace,
	appAiAttribution,
	GATEWAY_UNAVAILABLE,
	METERING_PROVIDER,
	requireParsedBody,
	UPSTREAM_ERROR,
	UPSTREAM_TIMEOUT_MS,
	upstreamErrorFailure,
} from "./app-ai-admission";
import type { AppAiGatewayRequest } from "./app-ai-gateway.service";
import { type AppAiPublicUrlEnv, appAiPublicUrl } from "./app-ai-keys";
import { LLM_PROXY_FETCH, type LlmProxyReply } from "./llm-proxy.service";
import { signingKeys } from "./llm-proxy-token.service";

/**
 * One gateway call with the query string of the route. The controller uses
 * it for all routes. Not the parsed `POST /videos` body of the contracts.
 */
export type AppAiQueryRequest = AppAiGatewayRequest & {
	/** The query object that Fastify parsed; zod reads it after the key check. */
	query: unknown;
};

/** The reply of the content route. `FastifyProxyReply` of the controller gives it. */
type ByteReply = LlmProxyReply & {
	/** Closes the socket without a clean end, so the app sees a cut body as a failed read. */
	destroy(): void;
};

/** The env values of the video routes; the module provides the full env. */
type AppAiVideoEnv = Pick<LlmProxyEnv, "LLM_PROXY_SIGNING_KEY"> &
	AppAiPublicUrlEnv;

/** What the settle of a finished job gives. */
type SettleResult = "settled" | "expired" | "failed";

// The webhook event that bills the job. Failed and cancelled events change nothing.
const COMPLETED_EVENT = "video.generation.completed";

// The upstream error text in the log line. 500 characters bound the line.
const MAX_ERROR_CHARS = 500;

// The text of a failed job. The upstream text goes only to the log.
const FAILED_JOB_MESSAGE = "The video provider did not make the video.";

// A media type that is safe to put in the content-type header.
const VIDEO_MEDIA_TYPE_PATTERN = /^video\/[\w.+-]+$/;

// 404 for every bad job id: a wrong project gets no detail either.
const UNKNOWN_JOB: AppAiFailure = {
	status: 404,
	code: "invalid_request",
	message: "The video job id is not valid.",
};

/** Application service of the video routes; see the file header. */
@Injectable()
export class AppAiVideoService {
	private readonly logger = new Logger(AppAiVideoService.name);

	constructor(
		@Inject(AppAiAdmission) private readonly admission: AppAiAdmission,
		@Inject(ModelPricingService)
		private readonly pricing: Pick<ModelPricingService, "quoteVideoEstimate">,
		@Inject(MeteringService)
		private readonly metering: Pick<MeteringService, "refund" | "settle">,
		@Inject(LLM_PROXY_FETCH) private readonly upstreamFetch: typeof fetch,
		@Inject(LLM_PROXY_ENV) private readonly env: AppAiVideoEnv,
	) {}

	/**
	 * Answers one `POST /api/v2/ai/v1/videos`. It holds the exact price, starts
	 * the upstream job, and answers the signed job id. The hold stays reserved
	 * until a status read, a content read, or the webhook sees the finished job.
	 */
	async createVideo(
		input: AppAiGatewayRequest,
		reply: LlmProxyReply,
	): Promise<void> {
		await this.respond("create", input, reply, async (trace) => {
			const project = await this.admission.checkKeyAndProject(
				input.authorization,
				trace,
			);
			const request = requireParsedBody(
				parseAppAiJsonBody(
					appAiVideoRequestSchema,
					input.body,
					APP_AI_VIDEO_MODELS,
				),
			);
			trace.model = request.model;
			await this.admission.checkRate(project.projectId, "generation", trace);
			const keys = this.tokenKeys(trace);
			// Money: the length and the resolution fix the price before the call. The audio term applies
			// only to a catalog row with an audio key; no listed model has one.
			const quote = await this.pricing.quoteVideoEstimate(request.model, {
				audio: request.audio,
				resolution: request.resolution,
				seconds: request.seconds,
			});
			const upstreamFields = appAiVideoUpstreamFields(
				request.model,
				request.resolution,
			);
			// Money: the job claims need a positive rate. A catalog rate of 0 would
			// start a job whose token no route can verify, so it is never billed.
			// The schema refuses a resolution without upstream fields; this check
			// keeps an unknown tier from running at the provider default price.
			if (
				quote === null ||
				quote.unitUsdMicros <= 0 ||
				upstreamFields === null
			) {
				throw this.admission.unpriced(trace);
			}
			const upstreamKey = this.admission.upstreamKey(trace);
			const hold = await this.admission.hold(
				project,
				{
					credits: quote.credits,
					estimatedCostUsdMicros: quote.costUsdMicros,
					model: request.model,
				},
				trace,
			);

			const billing = {
				projectId: project.projectId,
				eventId: hold?.eventId ?? null,
				model: request.model,
				seconds: request.seconds,
				resolution: request.resolution,
				audio: request.audio,
				costUsdMicros: quote.costUsdMicros,
				usdMicrosPerSecond: quote.unitUsdMicros,
				usdMicrosPerCredit: quote.pricingSnapshot.usdMicrosPerCredit,
			};
			// Every path below that gives no job id refunds the hold. A started job
			// keeps the hold reserved: a poll or the webhook settles it.
			// LIMIT: a lost webhook and no poll for 40 minutes make the video free,
			// because the sweep refunds the hold. Upgrade: a Trigger.dev task that follows the job.
			let jobId: string | null = null;
			try {
				const gateway = createGateway({
					apiKey: upstreamKey,
					fetch: this.upstreamFetch,
				});
				const webhookUrl = this.webhookUrl(
					mintAppAiVideoToken(
						{ kind: "app_ai_video_billing", ...billing },
						keys,
					),
				);
				const started = await experimental_startVideo({
					model: gateway.videoModel(request.model),
					prompt: request.prompt,
					n: 1,
					aspectRatio: request.aspect_ratio,
					resolution: upstreamFields.resolution,
					duration: request.seconds,
					// Explicit on a model with optional audio: the provider default is on.
					// HeyGen and MiniMax take no flag and send a warning for one.
					...(APP_AI_VIDEO_CAPABILITIES[request.model].audio === "optional"
						? { generateAudio: request.audio }
						: {}),
					providerOptions: appAiAttribution(
						project,
						upstreamFields.providerOptions,
					),
					// Money path: a retry could start and bill a second job.
					maxRetries: 0,
					// Not the client signal: a client abort must not lose a started job.
					abortSignal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
					...(webhookUrl === null ? {} : { webhookUrl }),
				}).catch((error: unknown) => {
					const failure = upstreamErrorFailure(error);
					if (failure.status >= 500) {
						this.admission.alert("App AI video start failed", trace, error);
					}
					throw new AppAiRefusal(failure);
				});
				// The gateway can ignore a setting, for example the size. A warning
				// shows it in Sentry. The price does not change.
				if (started.warnings.length > 0) {
					this.admission.alert(
						"App AI video upstream sent warnings",
						trace,
						JSON.stringify(started.warnings),
					);
				}
				// Security: the operation goes into a signed token, so its form and size are checked.
				const operation = appAiVideoJobClaimsSchema.shape.operation.safeParse(
					started.operation,
				);
				if (!operation.success) {
					this.admission.alert("App AI video operation is not usable", trace);
					throw new AppAiRefusal(UPSTREAM_ERROR);
				}
				jobId = mintAppAiVideoToken(
					{ kind: "app_ai_video_job", ...billing, operation: operation.data },
					keys,
				);
			} finally {
				if (jobId === null) {
					await this.refund(
						hold?.eventId ?? null,
						"app_ai_upstream_failed",
						trace,
					);
				}
			}
			const answer = {
				id: jobId,
				status: "queued",
				model: request.model,
				seconds: request.seconds,
			} satisfies AppAiVideoCreateResponse;
			await this.sendJson(reply, input.abortSignal, trace, answer);
			return 200;
		});
	}

	/**
	 * Answers one `GET /api/v2/ai/v1/videos/status?id=<job id>`. A finished
	 * job is settled before the answer says `completed`.
	 */
	async videoStatus(
		input: AppAiQueryRequest,
		reply: LlmProxyReply,
	): Promise<void> {
		await this.respond("status", input, reply, async (trace) => {
			const { claims, jobId, releaseSlot } = await this.admitPoll(
				input,
				"status",
				trace,
			);
			try {
				const source = await this.finishedVideo(
					claims,
					await this.readStatus(claims, trace),
					trace,
				);
				const answer = await this.statusAnswer(jobId, claims, source, trace);
				await this.sendJson(reply, input.abortSignal, trace, answer);
				return 200;
			} finally {
				await releaseSlot();
			}
		});
	}

	/**
	 * Answers one `GET /api/v2/ai/v1/videos/content?id=<job id>` with the
	 * video bytes. The job is settled before the first byte. 409 when the job
	 * is not ready or failed, 410 when its hold expired.
	 */
	async videoContent(
		input: AppAiQueryRequest,
		reply: ByteReply,
	): Promise<void> {
		await this.respond("content", input, reply, async (trace) => {
			const { claims, releaseSlot } = await this.admitPoll(
				input,
				"content",
				trace,
			);
			try {
				const source = await this.finishedVideo(
					claims,
					await this.readStatus(claims, trace),
					trace,
				);
				if (source === "pending" || source === "failed") {
					throw new AppAiRefusal({
						status: 409,
						code: "invalid_request",
						message:
							source === "failed"
								? FAILED_JOB_MESSAGE
								: "The video is not ready. Poll GET /videos/status until it is completed.",
					});
				}
				await this.requireSettled(claims, trace);

				const headers = {
					"content-type": source.mediaType,
					"x-request-id": trace.requestId,
				};
				if (source.kind === "bytes") {
					await this.admission.writeWhole(
						reply,
						input.abortSignal,
						200,
						headers,
						source.bytes,
					);
					return 200;
				}
				await this.pipeUrl(
					source.url,
					headers,
					input.abortSignal,
					reply,
					trace,
				);
				return 200;
			} finally {
				await releaseSlot();
			}
		});
	}

	/**
	 * Answers one `POST /api/v2/ai/v1/videos/callback?token=<billing token>`
	 * from the Vercel AI Gateway. Only its token is checked: 401 when it is
	 * bad. A completed event settles the hold; other events change nothing.
	 * 503 when the settle fails, so that the gateway sends the event again.
	 */
	async videoCallback(
		input: AppAiQueryRequest,
		reply: LlmProxyReply,
	): Promise<void> {
		await this.respond("callback", input, reply, async (trace) => {
			const claims = this.billingClaims(input.query, trace);
			// The schema has no `model` field, so the model list stays empty.
			const event = requireParsedBody(
				parseAppAiJsonBody(appAiVideoCallbackSchema, input.body, []),
			);
			// Failed and cancelled jobs: the status route and the stale sweep refund them.
			if (event.type === COMPLETED_EVENT) {
				// An app that never polls still pays for a finished video.
				const settled = await this.settle(claims, trace);
				if (settled === "expired") {
					this.admission.alert(
						"App AI video finished after its hold expired",
						trace,
					);
				}
				// A non-2xx answer makes the gateway send the event again. The settle is idempotent.
				if (settled === "failed") {
					throw new AppAiRefusal(GATEWAY_UNAVAILABLE);
				}
			}
			await this.sendJson(reply, input.abortSignal, trace, { received: true });
			return 200;
		});
	}

	// The shared frame of each route: a refusal goes out as the OpenAI error
	// body, and each request writes one log line.
	private async respond(
		route: "create" | "status" | "content" | "callback",
		input: AppAiGatewayRequest,
		reply: LlmProxyReply,
		handle: (trace: AppAiTrace) => Promise<number>,
	): Promise<void> {
		const startedAt = Date.now();
		const trace: AppAiTrace = {
			requestId: randomUUID(),
			projectId: null,
			model: null,
		};
		let status: number;
		try {
			status = await handle(trace);
		} catch (error) {
			// Security: the Nest filter logs the URL, and the URL holds a video token.
			// Thus an unknown error answers here. A 503 makes the app or the webhook try again.
			const failure =
				error instanceof AppAiRefusal ? error.failure : GATEWAY_UNAVAILABLE;
			if (!(error instanceof AppAiRefusal)) {
				this.admission.alert("App AI video route failed", trace, error);
			}
			await this.admission.sendFailure(
				reply,
				input.abortSignal,
				trace,
				failure,
			);
			status = failure.status;
		}
		this.logRequest(route, trace, status, startedAt);
	}

	// The checks of a status or content read: key, project, poll rate, the
	// job id, and one read slot as the last step. The caller releases the
	// slot in a `finally`. Throws `AppAiRefusal`.
	private async admitPoll(
		input: AppAiQueryRequest,
		route: "status" | "content",
		trace: AppAiTrace,
	): Promise<{
		claims: AppAiVideoJobClaims;
		jobId: string;
		releaseSlot: () => Promise<void>;
	}> {
		const project = await this.admission.checkKeyAndProject(
			input.authorization,
			trace,
		);
		// A poll bills nothing, so it has its own window. It still fails closed.
		await this.admission.checkRate(project.projectId, "poll", trace);
		const query = appAiVideoJobQuerySchema.safeParse(input.query);
		if (!query.success) {
			throw new AppAiRefusal({
				status: 400,
				code: "invalid_request",
				message: "Send the video job id in the query: ?id=<id>.",
			});
		}
		const keys = this.tokenKeys(trace);
		let claims: AppAiVideoJobClaims;
		try {
			claims = verifyAppAiVideoJobToken(query.data.id, keys);
		} catch (error) {
			if (error instanceof AppAiVideoTokenError) {
				throw new AppAiRefusal(UNKNOWN_JOB);
			}
			throw error;
		}
		// Security: a job id of project A never works with the key of project B.
		if (claims.projectId !== project.projectId) {
			throw new AppAiRefusal(UNKNOWN_JOB);
		}
		trace.model = claims.model;
		if (route === "content") {
			// One paid job must not give free downloads without end. With billing
			// off there is no event id, so the project id is the key.
			await this.admission.checkRate(
				claims.eventId ?? claims.projectId,
				"content",
				trace,
			);
		}
		const releaseSlot = await this.admission.takeVideoReadSlot(
			project.projectId,
			trace,
		);
		return { claims, jobId: query.data.id, releaseSlot };
	}

	// One upstream status read. Throws `AppAiRefusal` with the mapped failure.
	private async readStatus(
		claims: AppAiVideoJobClaims,
		trace: AppAiTrace,
	): Promise<GetVideoStatusResult> {
		const upstreamKey = this.admission.upstreamKey(trace);
		const gateway = createGateway({
			apiKey: upstreamKey,
			fetch: this.upstreamFetch,
		});
		try {
			return await experimental_getVideoStatus(
				gateway.videoModel(claims.model),
				{
					operation: claims.operation,
					// A read bills nothing, but the app polls again anyway.
					maxRetries: 0,
					abortSignal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
				},
			);
		} catch (error) {
			const failure = upstreamErrorFailure(error);
			if (failure.status >= 500) {
				this.admission.alert("App AI video status read failed", trace, error);
			}
			throw new AppAiRefusal(failure);
		}
	}

	// The bytes source of a finished job, or the state of a job with no
	// usable video. A failed job, or a finished job with no usable entry, refunds its hold.
	private async finishedVideo(
		claims: AppAiVideoJobClaims,
		status: GetVideoStatusResult,
		trace: AppAiTrace,
	): Promise<VideoSource | "pending" | "failed"> {
		if (status.status === "pending") {
			return "pending";
		}
		if (status.status === "error") {
			// Security: the text can name the Wandit upstream account, so only the log sees it.
			this.logger.warn({
				event: "app-ai.video-failed",
				...trace,
				upstreamError: status.error.slice(0, MAX_ERROR_CHARS),
			});
			// The upstream did no billable work, so the app pays nothing.
			await this.refund(claims.eventId, "app_ai_video_failed", trace);
			return "failed";
		}
		// Check the entry before any settle, so a bad entry bills nothing.
		const video = status.videos[0];
		const source = video === undefined ? null : videoSource(video);
		if (source === null) {
			// LIMIT: a job that the webhook settled stays paid when its entry is not
			// usable, because the refund fails on a settled event. Upgrade: refund a
			// settled event, or check the entry in the webhook.
			this.admission.alert("App AI video entry is not usable", trace);
			await this.refund(claims.eventId, "app_ai_video_failed", trace);
			return "failed";
		}
		return source;
	}

	private async statusAnswer(
		jobId: string,
		claims: AppAiVideoJobClaims,
		source: VideoSource | "pending" | "failed",
		trace: AppAiTrace,
	): Promise<AppAiVideoStatusResponse> {
		if (source === "pending") {
			return { id: jobId, status: "in_progress" };
		}
		if (source === "failed") {
			return {
				id: jobId,
				status: "failed",
				error: { message: FAILED_JOB_MESSAGE },
			};
		}
		// Money: the settle comes before the answer that says `completed`.
		const settled = await this.settle(claims, trace);
		if (settled === "expired") {
			return { id: jobId, status: "expired" };
		}
		if (settled === "failed") {
			throw new AppAiRefusal(GATEWAY_UNAVAILABLE);
		}
		return { id: jobId, status: "completed" };
	}

	// The settle before the content. 410 for an expired hold, 503 for a
	// settle error, so the app polls again.
	private async requireSettled(
		claims: AppAiVideoJobClaims,
		trace: AppAiTrace,
	): Promise<void> {
		const settled = await this.settle(claims, trace);
		if (settled === "expired") {
			throw new AppAiRefusal({
				status: 410,
				code: "invalid_request",
				message: "The video job expired before it finished. Start a new job.",
			});
		}
		if (settled === "failed") {
			throw new AppAiRefusal(GATEWAY_UNAVAILABLE);
		}
	}

	// Settles the hold with the signed values. The same values on each route
	// make a second settle an idempotent replay. Never throws.
	private async settle(
		claims: AppAiVideoJobClaims | AppAiVideoBillingClaims,
		trace: AppAiTrace,
	): Promise<SettleResult> {
		// Billing off: no hold, so nothing to settle.
		if (claims.eventId === null) {
			return "settled";
		}
		try {
			await this.metering.settle(claims.eventId, {
				...appAiVideoSettlement(claims),
				provider: METERING_PROVIDER,
			});
			return "settled";
		} catch (error) {
			// The 40 minute stale sweep refunded the hold, so no video is given.
			// Other conflict states go to the alert below.
			if (
				error instanceof MeteringStateConflictError &&
				error.status === "refunded"
			) {
				return "expired";
			}
			this.admission.alert("App AI video settle failed", trace, error);
			return "failed";
		}
	}

	// Refunds a hold; a null event id (billing off) does nothing. Never throws.
	private async refund(
		eventId: string | null,
		reason: string,
		trace: AppAiTrace,
	): Promise<void> {
		if (eventId === null) {
			return;
		}
		try {
			await this.metering.refund(eventId, reason);
		} catch (error) {
			// LIMIT: a lost refund leaves the hold reserved until the 40 minute sweep
			// refunds it. Upgrade: retry the refund in a Trigger.dev task.
			this.admission.alert("App AI video refund failed", trace, error);
		}
	}

	// Streams a video URL from the upstream JSON to the app. The app never
	// sees the URL.
	private async pipeUrl(
		url: URL,
		headers: Record<string, string>,
		abortSignal: AbortSignal,
		reply: ByteReply,
		trace: AppAiTrace,
	): Promise<void> {
		const response = await this.upstreamFetch(url, {
			// Security: `videoSource` allows only https, so no redirect may leave it.
			redirect: "error",
			// The bill is settled already, so a client abort can stop the download.
			signal: AbortSignal.any([
				abortSignal,
				AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
			]),
		}).catch((error: unknown) => {
			// A client abort is not an operator problem, so only a real failure alerts.
			if (!abortSignal.aborted) {
				this.admission.alert("App AI video download failed", trace, error);
			}
			throw new AppAiRefusal(UPSTREAM_ERROR);
		});
		if (!response.ok || response.body === null) {
			this.admission.alert(
				"App AI video download failed",
				trace,
				`HTTP ${response.status}`,
			);
			throw new AppAiRefusal(UPSTREAM_ERROR);
		}
		if (abortSignal.aborted) {
			await response.body.cancel();
			reply.end();
			return;
		}
		reply.writeHead(200, headers);
		const reader = response.body.getReader();
		try {
			for (;;) {
				const { done, value } = await reader.read();
				if (done) {
					break;
				}
				// A write to a closed socket would wait for `drain` forever, and a
				// clean end would make the cut video look whole.
				if (abortSignal.aborted) {
					reply.destroy();
					return;
				}
				await reply.write(value);
			}
		} catch (error) {
			// The status line is out, so only the log sees the error. A clean end
			// makes a cut video look whole. Thus the socket closes without the end
			// chunk, and the app sees a failed read and can read again.
			// A client abort is not an operator problem, so only a real failure alerts.
			if (!abortSignal.aborted) {
				this.admission.alert("App AI video download stopped", trace, error);
			}
			reply.destroy();
			return;
		} finally {
			reader.releaseLock();
		}
		reply.end();
	}

	// The keys that sign the video tokens. Throws `AppAiRefusal` 503 when none is set.
	private tokenKeys(trace: AppAiTrace): [string, ...string[]] {
		try {
			return signingKeys(this.env);
		} catch (error) {
			this.admission.alert("LLM_PROXY_SIGNING_KEY is not set", trace, error);
			throw new AppAiRefusal(GATEWAY_UNAVAILABLE);
		}
	}

	// The claims of the webhook token. Throws `AppAiRefusal` 401 for a bad token.
	private billingClaims(
		rawQuery: unknown,
		trace: AppAiTrace,
	): AppAiVideoBillingClaims {
		const badToken = new AppAiRefusal({
			status: 401,
			code: "invalid_api_key",
			message: "The callback token is not valid.",
		});
		const query = appAiVideoCallbackQuerySchema.safeParse(rawQuery);
		if (!query.success) {
			throw badToken;
		}
		const keys = this.tokenKeys(trace);
		try {
			const claims = verifyAppAiVideoBillingToken(query.data.token, keys);
			trace.projectId = claims.projectId;
			trace.model = claims.model;
			return claims;
		} catch (error) {
			if (error instanceof AppAiVideoTokenError) {
				throw badToken;
			}
			throw error;
		}
	}

	// The webhook URL of the job, or null when the API has no https host.
	private webhookUrl(billingToken: string): string | null {
		const url = appAiPublicUrl(appBuilderRoutes.appAiVideoCallback, this.env);
		// The gateway cannot call a local http host. Then only a poll settles.
		if (url.protocol !== "https:") {
			return null;
		}
		url.searchParams.set("token", billingToken);
		return url.toString();
	}

	private async sendJson(
		reply: LlmProxyReply,
		abortSignal: AbortSignal,
		trace: AppAiTrace,
		body:
			| AppAiVideoCreateResponse
			| AppAiVideoStatusResponse
			| { received: true },
	): Promise<void> {
		await this.admission.writeWhole(
			reply,
			abortSignal,
			200,
			{ "content-type": "application/json", "x-request-id": trace.requestId },
			Buffer.from(JSON.stringify(body), "utf8"),
		);
	}

	private logRequest(
		route: "create" | "status" | "content" | "callback",
		trace: AppAiTrace,
		status: number,
		startedAt: number,
	): void {
		this.logger.log({
			event: "app-ai.video-request",
			route,
			...trace,
			status,
			latencyMs: Date.now() - startedAt,
		});
	}
}

/** Where the bytes of one finished video come from. */
type VideoSource =
	| { kind: "bytes"; bytes: Buffer; mediaType: string }
	| { kind: "url"; url: URL; mediaType: string };

/**
 * The bytes or the https URL of one video entry; null when the entry is not
 * usable. The URL comes from the upstream JSON, so only https passes.
 */
function videoSource(
	video: Extract<
		GetVideoStatusResult,
		{ status: "completed" }
	>["videos"][number],
): VideoSource | null {
	// Security: the media type goes into a header, so only a plain video type passes.
	const mediaType = VIDEO_MEDIA_TYPE_PATTERN.test(video.mediaType)
		? video.mediaType
		: "video/mp4";
	if (video.type === "base64" || video.type === "binary") {
		// LIMIT: each status or content read of a job with inline bytes holds the
		// full video in memory. Upgrade: store the video one time, or keep the
		// completed state in a job table.
		const bytes =
			video.type === "base64"
				? Buffer.from(video.data, "base64")
				: Buffer.from(video.data);
		// Money: an empty video is zero delivered units, so the caller refunds it.
		return bytes.length === 0 ? null : { kind: "bytes", bytes, mediaType };
	}
	if (!URL.canParse(video.url)) {
		return null;
	}
	const url = new URL(video.url);
	return url.protocol === "https:" ? { kind: "url", url, mediaType } : null;
}
