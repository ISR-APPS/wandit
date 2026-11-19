/**
 * The generic checks of every app AI gateway call. They are the app key,
 * the project, the rate window, the upstream key, and the credit hold. Also
 * the answer helpers in the OpenAI error format. `AppAiGatewayService`,
 * `AppAiMediaService`, and `AppAiVideoService` call it. It reads secrets,
 * projects, Redis, and metering.
 */
import { GatewayError, GatewayModelNotFoundError } from "@ai-sdk/gateway";
import { Inject, Injectable, Logger } from "@nestjs/common";
import {
	APP_AI_KEY_SECRET_NAME,
	type AppAiErrorCode,
	type AppAiImageModel,
	type AppAiModel,
	type AppAiSpeechModel,
	type AppAiTranscriptionModel,
	type AppAiVideoModel,
} from "@wandit/contracts";
import { getErrorMessage } from "@wandit/observability/error";
import { Sentry } from "@wandit/observability/nestjs";
import { APICallError } from "ai";

import { InsufficientCreditsError } from "../../../credits/domain/errors/insufficient-credits.error";
import { MemberCreditLimitError } from "../../../credits/domain/errors/member-credit-limit.error";
import { MeteringService } from "../../../metering/application/services/metering.service";
import { withGatewayAttribution } from "../../../metering/domain/gateway-metering";
import { appAiKeysEqual, projectIdOfAppAiKey } from "../../domain/app-ai-key";
import {
	type AppAiBodyParse,
	upstreamErrorMessage,
} from "../../domain/app-ai-request";
import { LLM_PROXY_ENV, type LlmProxyEnv } from "../../domain/llm-upstream";
import { AppPublishRepository } from "../../infrastructure/persistence/app-publish.repository";
import {
	RATE_LIMIT_STORE,
	type RateLimitStore,
	rateLimitKey,
} from "../../presentation/http/guards/redis-rate-limit.guard";
import type { LlmProxyReply } from "./llm-proxy.service";
import { ProjectSecretsService } from "./project-secrets.service";

/**
 * 300 s: the longest call, drain included. It ends the drain after a client
 * abort. `AppAiGatewayController` also closes a socket that is open longer.
 */
export const UPSTREAM_TIMEOUT_MS = 300_000;

/** The `provider` value on each settled usage event of the app AI gateway. */
export const METERING_PROVIDER = "vercel-ai-gateway";

/**
 * The rate windows, 60 s each. `generation` counts the calls that bill and
 * `poll` the video status and content reads, for each project. `content`
 * counts the content reads of one video job.
 */
export const APP_AI_RATE_WINDOWS = {
	// ESTIMATE: 60 calls per 60 s bound the spend rate of one app and the
	// overdraft of its concurrent calls. The key is `builder:rate:app-ai:<projectId>`.
	generation: { bucket: "app-ai", limit: 60, label: "AI calls" },
	// A poll bills nothing, but each one reads the upstream with the Wandit key.
	poll: { bucket: "app-ai-poll", limit: 120, label: "video status calls" },
	// A content read bills nothing but moves the full file through the API.
	// The key is the hold event id: one job.
	content: {
		bucket: "app-ai-video-content",
		limit: 6,
		label: "downloads of one video",
	},
} as const;

/**
 * Open slots of the video status and content reads of one project. A read
 * of a job with inline bytes holds the full video in memory, so 4 slots bound
 * the memory. The window is the 300 s upstream deadline, the longest read.
 */
// LIMIT: a slot that a killed API never released frees only when its window ends.
// A read that outlives its window releases into the next window, so the cap is soft there.
// Upgrade: one key per read.
export const APP_AI_VIDEO_READ_SLOTS = {
	bucket: "app-ai-video-read",
	limit: 4,
	windowMs: UPSTREAM_TIMEOUT_MS,
} as const;

// Seconds in `retry-after` when all read slots are taken. A read ends in
// seconds, and the skills poll again after 10 s.
const VIDEO_READ_RETRY_SECONDS = "10";

/** Name of one rate window in `APP_AI_RATE_WINDOWS`. */
export type AppAiRateWindow = keyof typeof APP_AI_RATE_WINDOWS;

const RATE_WINDOW_MS = 60_000;

/** A refusal of the gateway, sent as the OpenAI error body. */
export type AppAiFailure = {
	status: number;
	code: AppAiErrorCode;
	/** Short English text for the app developer, never shown in the Wandit UI. */
	message: string;
	/** Extra answer headers, for example `retry-after` on a 429. */
	headers?: Record<string, string>;
};

/** Thrown by a check before the hold; the caller sends it with `sendFailure`. */
export class AppAiRefusal extends Error {
	constructor(readonly failure: AppAiFailure) {
		super(failure.message);
	}
}

/** Any model id that an app may call, of every kind. */
export type AppAiAnyModel =
	| AppAiModel
	| AppAiImageModel
	| AppAiSpeechModel
	| AppAiTranscriptionModel
	| AppAiVideoModel;

/** The fields of the log lines of one call. Never a body or a key. */
export type AppAiTrace = {
	requestId: string;
	/** Null until the key parses. */
	projectId: string | null;
	/** Null until the body parses. */
	model: AppAiAnyModel | null;
};

/** The project of a valid key, and the people the hold bills. */
export type AppAiProject = {
	projectId: string;
	/** The project owner; the actor of the usage event. */
	userId: string;
	/** The workspace that pays; null for a personal project. */
	organizationId: string | null;
};

/** The credit hold of one call. */
export type AppAiHold = {
	/** Id of the `ai_usage_events` row of the reserve. */
	eventId: string;
	/** Reserved centi-credits. */
	credits: number;
};

/** What the hold reserves; the caller computes it from its own quote. */
export type AppAiHoldInput = {
	/** Centi-credits to reserve; at least 1. */
	credits: number;
	/** Provider cost of the quote in USD micros; null leaves the column empty. */
	estimatedCostUsdMicros: number | null;
	/** The model id of the call; the reserve writes it on the usage event. */
	model: AppAiAnyModel;
};

// 401 for a bad key and for a dead project, so a key leaks nothing.
const INVALID_KEY: AppAiFailure = {
	status: 401,
	code: "invalid_api_key",
	message: "The API key is not valid.",
};

/** 503 when Wandit cannot serve the call: an operator must act. */
export const GATEWAY_UNAVAILABLE: AppAiFailure = {
	status: 503,
	code: "gateway_unavailable",
	message: "The AI gateway is not available. Try again later.",
};

/** 502 when the model provider fails. */
export const UPSTREAM_ERROR: AppAiFailure = {
	status: 502,
	code: "upstream_error",
	message: "The model provider failed. Try again later.",
};

/** Shared admission and answer helpers of the app AI gateway; see the file header. */
@Injectable()
export class AppAiAdmission {
	private readonly logger = new Logger(AppAiAdmission.name);

	constructor(
		@Inject(ProjectSecretsService)
		private readonly secrets: Pick<ProjectSecretsService, "readSystemValue">,
		@Inject(AppPublishRepository)
		private readonly projects: Pick<AppPublishRepository, "findProject">,
		@Inject(RATE_LIMIT_STORE)
		private readonly rateLimit: Pick<RateLimitStore, "hit" | "release">,
		@Inject(MeteringService)
		private readonly metering: Pick<MeteringService, "reserve">,
		@Inject(LLM_PROXY_ENV)
		private readonly env: Pick<
			LlmProxyEnv,
			"AI_GATEWAY_API_KEY" | "GENERATION_BILLING_MODE"
		>,
	) {}

	/**
	 * Steps 1 and 2: the app key and its project. Sets `trace.projectId`.
	 * Throws `AppAiRefusal` with 401 or 403.
	 */
	async checkKeyAndProject(
		authorization: string | undefined,
		trace: AppAiTrace,
	): Promise<AppAiProject> {
		// Security: a bad key format answers 401 before any database read.
		const presentedKey = authorization?.startsWith("Bearer ")
			? authorization.slice("Bearer ".length).trim()
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

		// A deleted or V1 project answers like a wrong key: no leak.
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
		return {
			projectId,
			userId: project.userId,
			organizationId: project.organizationId,
		};
	}

	/**
	 * Step 4: one hit on a rate window. `subject` is the project id, or the
	 * hold event id for the `content` window. Throws `AppAiRefusal` with 429
	 * over the limit and 503 on a Redis error.
	 */
	async checkRate(
		subject: string,
		window: AppAiRateWindow,
		trace: AppAiTrace,
	): Promise<void> {
		const { bucket, label, limit } = APP_AI_RATE_WINDOWS[window];
		const hit = await this.rateLimit
			.hit(rateLimitKey(bucket, subject), RATE_WINDOW_MS)
			.catch((error: unknown) => {
				// Money path: without the window the overdraft has no bound, so
				// a Redis error fails closed.
				this.alert("App AI rate window read failed", trace, error);
				throw new AppAiRefusal(GATEWAY_UNAVAILABLE);
			});
		if (hit.count > limit) {
			throw new AppAiRefusal({
				status: 429,
				code: "rate_limited",
				message: `This app sent more than ${limit} ${label} in one minute.`,
				headers: {
					// The window TTL in ms, as whole seconds, at least 1.
					"retry-after": String(Math.max(1, Math.ceil(hit.ttlMs / 1000))),
				},
			});
		}
	}

	/**
	 * Takes one open slot of `APP_AI_VIDEO_READ_SLOTS` for the project. The
	 * caller calls the returned release in a `finally`. Throws `AppAiRefusal`
	 * with 429 when all slots are taken and 503 on a Redis error.
	 */
	async takeVideoReadSlot(
		projectId: string,
		trace: AppAiTrace,
	): Promise<() => Promise<void>> {
		const key = rateLimitKey(APP_AI_VIDEO_READ_SLOTS.bucket, projectId);
		const hit = await this.rateLimit
			.hit(key, APP_AI_VIDEO_READ_SLOTS.windowMs)
			.catch((error: unknown) => {
				// Security: without the cap, parallel reads have no memory bound, so
				// a Redis error fails closed.
				this.alert("App AI video read slot failed", trace, error);
				throw new AppAiRefusal(GATEWAY_UNAVAILABLE);
			});
		const release = async () => {
			await this.rateLimit.release(key).catch((error: unknown) => {
				// The window frees the slot later, so a failed release only logs.
				this.logger.warn({
					event: "app-ai.video-read-release-failed",
					...trace,
					errorText: getErrorMessage(error),
				});
			});
		};
		if (hit.count > APP_AI_VIDEO_READ_SLOTS.limit) {
			await release();
			throw new AppAiRefusal({
				status: 429,
				code: "rate_limited",
				message: `This app has more than ${APP_AI_VIDEO_READ_SLOTS.limit} video reads in progress.`,
				headers: { "retry-after": VIDEO_READ_RETRY_SECONDS },
			});
		}
		return release;
	}

	/** Step 6: the upstream key, before the hold. Throws 503 when it is not set. */
	upstreamKey(trace: AppAiTrace): string {
		const key = this.env.AI_GATEWAY_API_KEY;
		if (key === undefined) {
			this.alert("AI_GATEWAY_API_KEY is not set", trace);
			throw new AppAiRefusal(GATEWAY_UNAVAILABLE);
		}
		return key;
	}

	/**
	 * Step 7: the credit hold, keyed `app-ai:<requestId>`. Returns null when
	 * billing is off. Throws `AppAiRefusal` 402 when the payer cannot pay.
	 * After it returns, the caller must end with one settle or one refund.
	 */
	async hold(
		project: AppAiProject,
		input: AppAiHoldInput,
		trace: AppAiTrace,
	): Promise<AppAiHold | null> {
		// `off` is the local test mode; production refuses it.
		if (this.env.GENERATION_BILLING_MODE === "off") {
			this.logger.warn({ event: "app-ai.billing-off", ...trace });
			return null;
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
					credits: input.credits,
					estimatedCostUsdMicros: input.estimatedCostUsdMicros,
					idempotencyKey: `app-ai:${trace.requestId}`,
					model: input.model,
					projectId: project.projectId,
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
		return { eventId: event.id, credits: event.reservedCredits };
	}

	/**
	 * An allowed model has no usable price: an operator must add it. The
	 * caller throws the refusal, so the call fails closed before the hold.
	 */
	unpriced(trace: AppAiTrace): AppAiRefusal {
		this.alert("App AI model has no price", trace);
		return new AppAiRefusal(GATEWAY_UNAVAILABLE);
	}

	/** Writes the OpenAI error body of `failure`. */
	async sendFailure(
		reply: LlmProxyReply,
		abortSignal: AbortSignal,
		trace: AppAiTrace,
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

	/**
	 * Writes one whole answer. After a client abort it only ends the reply:
	 * a write to a closed socket would wait for `drain` forever.
	 */
	async writeWhole(
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

	/** An operator must act: a log line with context, and Sentry. */
	alert(message: string, trace: AppAiTrace, error?: unknown): void {
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
}

/**
 * Step 3 of a media call: the parsed fields. Throws `AppAiRefusal` 400
 * with the zod issues.
 */
export function requireParsedBody<Body extends Record<string, unknown>>(
	parse: AppAiBodyParse<Body>,
): Body {
	if (!parse.ok) {
		throw new AppAiRefusal({
			status: 400,
			code: parse.code,
			message: parse.message,
		});
	}
	return parse.data;
}

/**
 * Maps an upstream refusal to the answer of the app. The app never sees an
 * error about the Wandit upstream account. `bodyText` is the upstream body.
 */
export function upstreamFailure(
	status: number,
	bodyText: string,
): AppAiFailure {
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

/**
 * Maps an error from an AI SDK gateway call to the answer of the app.
 * It uses the status rules of `upstreamFailure`. A model that the gateway
 * does not find gives 503. A timeout, a network error, or an empty result gives 502.
 */
export function upstreamErrorFailure(error: unknown): AppAiFailure {
	// The model id comes from the Wandit allow list, so an operator must act.
	// The 503 makes the caller send the alert.
	if (GatewayModelNotFoundError.isInstance(error)) {
		return GATEWAY_UNAVAILABLE;
	}
	if (GatewayError.isInstance(error)) {
		// The gateway error keeps the upstream HTTP error, with its body, as the cause.
		const bodyText = APICallError.isInstance(error.cause)
			? (error.cause.responseBody ?? "")
			: "";
		return upstreamFailure(error.statusCode, bodyText);
	}
	if (APICallError.isInstance(error) && error.statusCode !== undefined) {
		return upstreamFailure(error.statusCode, error.responseBody ?? "");
	}
	return UPSTREAM_ERROR;
}

/**
 * The `providerOptions` of one AI SDK media or video call. The gateway tags
 * name the payer in the Vercel spend report. `providerOptions` keeps its
 * keys; its `gateway` key merges with the tags (the video provider pin).
 */
export function appAiAttribution<
	ProviderOptions extends Record<string, unknown> = Record<never, never>,
>(project: AppAiProject, providerOptions?: ProviderOptions) {
	return withGatewayAttribution(providerOptions ?? {}, {
		operation: "app_ai_gateway",
		organizationId: project.organizationId,
		userId: project.userId,
	});
}
