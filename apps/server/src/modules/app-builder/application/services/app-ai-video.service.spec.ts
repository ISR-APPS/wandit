import { describe, expect, it, vi } from "vitest";

import type { MeteringService } from "../../../metering/application/services/metering.service";
import { ModelPricingService } from "../../../metering/application/services/model-pricing.service";
import {
	type AiUsageEvent,
	MeteringStateConflictError,
} from "../../../metering/domain/metering";
import { mintAppAiKey } from "../../domain/app-ai-key";
import type { PublishProjectRow } from "../../infrastructure/persistence/app-publish.repository";
import { AppAiAdmission } from "./app-ai-admission";
import { AppAiVideoService } from "./app-ai-video.service";
import type { LlmProxyReply } from "./llm-proxy.service";

const PROJECT_A = "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";
const PROJECT_B = "1a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";
const KEYS: Record<string, string> = {
	[PROJECT_A]: mintAppAiKey(PROJECT_A),
	[PROJECT_B]: mintAppAiKey(PROJECT_B),
};
const HOLD_ID = "22222222-3333-4444-8555-666666666666";
const VIDEO_BYTES = Buffer.from("fake-mp4-bytes", "utf8");
// The host of the video URL entries; the fake fetch answers the bytes for it.
const VIDEO_HOST = "cdn.video.test";

const PROJECT: PublishProjectRow = {
	name: "Clips",
	engine: "v2_app",
	framework: "vite-react",
	templateVersion: "v1",
	userId: "user_1",
	organizationId: null,
	deletedAt: null,
	suspendedReasonCode: null,
	suspendedAt: null,
};

// A fixed catalog: the default model HeyGen costs 10,000 micros a second at
// 480p. 5 s = 50,000 micros = 157 cc at 32,000 micros a credit (156.25 up).
const PRICE_CATALOG = {
	generatedAt: "2026-11-19T00:00:00.000Z",
	data: [
		{
			id: "heygen/heygen-video-1",
			owned_by: "heygen",
			type: "video",
			pricing: {
				video_duration_pricing: [
					{
						resolution: "480p",
						mode: "text_to_video",
						cost_per_second: "0.01",
					},
					{
						resolution: "480p",
						mode: "reference_to_video",
						cost_per_second: "0.035",
					},
				],
			},
		},
		{
			id: "bytedance/seedance-2.5-flash",
			owned_by: "bytedance",
			type: "video",
			pricing: {
				video_token_pricing: {
					tiers: [
						{
							resolution: "480p",
							no_video_input: { cost_per_million_tokens: "7" },
						},
					],
				},
			},
		},
	],
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
		id: HOLD_ID,
		idempotencyKey: "app-ai:request_1",
		inputTokens: null,
		messageId: null,
		model: null,
		nextReconcileAttemptAt: null,
		operation: "app_ai_gateway",
		organizationId: null,
		outputTokens: null,
		parentEventId: null,
		payerUserId: null,
		pricingSnapshot: {},
		projectId: PROJECT_A,
		provider: null,
		rawUsage: null,
		reconcileAttempts: 0,
		reconciledAt: null,
		reconciledCostUsdMicros: null,
		reservedCredits: 157,
		settledAt: null,
		status: "reserved",
		userId: "user_1",
		...overrides,
	};
}

class FakeReply implements LlmProxyReply {
	statusCode: number | undefined;
	headers: Record<string, string> = {};
	chunks: Buffer[] = [];
	ended = false;
	destroyed = false;

	writeHead(statusCode: number, headers: Record<string, string>): void {
		this.statusCode = statusCode;
		this.headers = headers;
	}

	write(chunk: Uint8Array): Promise<void> {
		this.chunks.push(Buffer.from(chunk));
		return Promise.resolve();
	}

	end(): void {
		this.ended = true;
	}

	destroy(): void {
		this.destroyed = true;
	}

	get body(): Buffer {
		return Buffer.concat(this.chunks);
	}

	get json(): { id?: string; status?: string; error?: { message: string } } {
		return JSON.parse(this.body.toString("utf8"));
	}
}

// The wire answers of the gateway routes `/video-model/start` and
// `/video-model/status`, as `gateway-video-model.ts` of @ai-sdk/gateway reads them.
type GatewayAnswer =
	| { operation: { gatewayJobId: string } }
	| { status: "pending" }
	| { status: "error"; error: string }
	| {
			status: "completed";
			videos: Array<
				| { type: "base64"; data: string; mediaType: string }
				| { type: "url"; url: string; mediaType: string }
			>;
	  }
	| { error: { message: string; type: string } };

function jsonResponse(status: number, body: GatewayAnswer): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" },
	});
}

const COMPLETED: GatewayAnswer = {
	status: "completed",
	videos: [
		{
			type: "base64",
			data: VIDEO_BYTES.toString("base64"),
			mediaType: "video/mp4",
		},
	],
};

function setup(options: {
	start?: () => Response;
	status?: () => Response | Promise<Response>;
	download?: () => Response;
	settle?: MeteringService["settle"];
	reserve?: MeteringService["reserve"];
	catalog?: typeof PRICE_CATALOG;
}) {
	const metering = {
		refund: vi.fn<MeteringService["refund"]>(async () =>
			holdEvent({ status: "refunded" }),
		),
		reserve: vi.fn<MeteringService["reserve"]>(
			options.reserve ??
				(async (_operation, _subject, input) =>
					holdEvent({ reservedCredits: input.credits })),
		),
		settle: vi.fn<MeteringService["settle"]>(
			options.settle ??
				(async (_eventId, settlement) =>
					holdEvent({
						finalCredits:
							settlement.pricing === "direct" ? settlement.finalCredits : null,
						status: "settled",
					})),
		),
	};
	const upstreamFetch = vi.fn<typeof fetch>(async (url) => {
		if (String(url).endsWith("/video-model/start")) {
			return (
				options.start ??
				(() => jsonResponse(200, { operation: { gatewayJobId: "job_1" } }))
			)();
		}
		if (String(url).endsWith("/video-model/status")) {
			return (options.status ?? (() => jsonResponse(200, COMPLETED)))();
		}
		if (new URL(String(url)).host === VIDEO_HOST) {
			return (
				options.download ??
				(() =>
					new Response(VIDEO_BYTES, {
						status: 200,
						headers: { "content-type": "video/mp4" },
					}))
			)();
		}
		throw new Error(`Unexpected upstream URL ${String(url)}`);
	});
	// A counting store: a hit adds one to its key, and a release takes one off.
	const rateCounts = new Map<string, number>();
	const rateLimit = {
		hit: vi.fn(async (key: string) => {
			const count = (rateCounts.get(key) ?? 0) + 1;
			rateCounts.set(key, count);
			return { count, ttlMs: 60_000 };
		}),
		release: vi.fn(async (key: string) => {
			rateCounts.set(key, Math.max(0, (rateCounts.get(key) ?? 0) - 1));
		}),
	};
	const admission = new AppAiAdmission(
		{ readSystemValue: async (projectId) => KEYS[projectId] ?? null },
		{ findProject: async () => PROJECT },
		rateLimit,
		metering,
		{ AI_GATEWAY_API_KEY: "upstream-key" },
	);
	const pricing = new ModelPricingService(
		{ findByModelId: async () => null, upsertMany: async () => 0 },
		{
			seedResponse: options.catalog ?? PRICE_CATALOG,
			usdMicrosPerCredit: 32_000,
		},
	);
	const service = new AppAiVideoService(
		admission,
		pricing,
		metering,
		upstreamFetch,
		{
			BETTER_AUTH_URL: "https://api.wandit.test",
			LLM_PROXY_SIGNING_KEY: "signing-key",
		},
	);
	return { metering, rateCounts, rateLimit, service, upstreamFetch };
}

function call(
	projectId: string,
	options: {
		body?: { prompt: string; seconds: number; model?: string };
		query?: Record<string, string>;
	} = {},
) {
	return {
		authorization: `Bearer ${KEYS[projectId]}`,
		body: Buffer.from(JSON.stringify(options.body ?? {}), "utf8"),
		query: options.query ?? {},
		abortSignal: new AbortController().signal,
	};
}

// Creates one job of project A and returns the reply.
async function createJob(service: AppAiVideoService) {
	const reply = new FakeReply();
	await service.createVideo(
		call(PROJECT_A, { body: { prompt: "A paper boat", seconds: 5 } }),
		reply,
	);
	return reply;
}

function webhookToken(
	upstreamFetch: ReturnType<typeof setup>["upstreamFetch"],
) {
	const startBody = JSON.parse(String(upstreamFetch.mock.calls[0]?.[1]?.body));
	return new URL(startBody.callbackUrl).searchParams.get("token") ?? "";
}

describe("AppAiVideoService", () => {
	// Money: a job that never started must not keep the credits.
	it("refunds the hold and answers 502 when the start fails", async () => {
		const { metering, service } = setup({
			start: () =>
				jsonResponse(500, {
					error: { message: "boom", type: "internal_server_error" },
				}),
		});

		const reply = await createJob(service);

		expect(reply.statusCode).toBe(502);
		expect(metering.reserve).toHaveBeenCalledOnce();
		expect(metering.refund).toHaveBeenCalledWith(
			HOLD_ID,
			"app_ai_upstream_failed",
		);
		expect(metering.settle).not.toHaveBeenCalled();
	});

	// Money: a rate of 0 gives a job token that no route can verify, so the job is never billed.
	it("answers 503 for a catalog rate of 0 and holds and starts nothing", async () => {
		const { metering, service, upstreamFetch } = setup({
			catalog: {
				...PRICE_CATALOG,
				data: [
					{
						id: "heygen/heygen-video-1",
						owned_by: "heygen",
						type: "video",
						pricing: {
							video_duration_pricing: [
								{
									resolution: "480p",
									mode: "text_to_video",
									cost_per_second: "0",
								},
							],
						},
					},
				],
			},
		});

		const reply = await createJob(service);

		expect(reply.statusCode).toBe(503);
		expect(metering.reserve).not.toHaveBeenCalled();
		expect(upstreamFetch).not.toHaveBeenCalled();
	});

	// Security: the Nest filter logs the URL with the token, so an unknown error must answer here.
	it("answers the 503 body and does not reject on an unexpected error", async () => {
		const { service, upstreamFetch } = setup({
			reserve: async () => {
				throw new Error("db down");
			},
		});

		const reply = await createJob(service);

		expect(reply.statusCode).toBe(503);
		expect(reply.json).toMatchObject({
			error: { code: "gateway_unavailable" },
		});
		expect(upstreamFetch).not.toHaveBeenCalled();
	});

	// Money: a pending job is neither billed nor refunded, and gives no bytes.
	it("answers in_progress and 409 for a pending job and settles and refunds nothing", async () => {
		const { metering, service } = setup({
			status: () => jsonResponse(200, { status: "pending" }),
		});
		const created = await createJob(service);
		const query = { id: created.json.id ?? "" };
		const status = new FakeReply();
		const content = new FakeReply();

		await service.videoStatus(call(PROJECT_A, { query }), status);
		await service.videoContent(call(PROJECT_A, { query }), content);

		expect(status.json.status).toBe("in_progress");
		expect(content.statusCode).toBe(409);
		expect(metering.settle).not.toHaveBeenCalled();
		expect(metering.refund).not.toHaveBeenCalled();
	});

	// Money: the answer says completed only after the hold is charged.
	it("settles once with the hold credits and then answers completed", async () => {
		const { metering, service } = setup({});
		const created = await createJob(service);
		const reply = new FakeReply();

		await service.videoStatus(
			call(PROJECT_A, { query: { id: created.json.id ?? "" } }),
			reply,
		);

		expect(reply.json.status).toBe("completed");
		expect(metering.settle).toHaveBeenCalledOnce();
		expect(metering.settle.mock.calls[0]?.[0]).toBe(HOLD_ID);
		expect(metering.settle.mock.calls[0]?.[1]).toMatchObject({
			costUsdMicros: 50_000,
			finalCredits: 157,
			pricing: "direct",
		});
		expect(metering.reserve.mock.calls[0]?.[2]).toMatchObject({ credits: 157 });
		expect(metering.refund).not.toHaveBeenCalled();
	});

	// Money and security: a failed job costs nothing, and the upstream text stays on the server.
	it("refunds a failed job, settles nothing, and hides the upstream error", async () => {
		const { metering, service } = setup({
			status: () =>
				jsonResponse(200, {
					status: "error",
					error: "Wandit team quota exceeded",
				}),
		});
		const created = await createJob(service);
		const reply = new FakeReply();

		await service.videoStatus(
			call(PROJECT_A, { query: { id: created.json.id ?? "" } }),
			reply,
		);

		expect(reply.json.status).toBe("failed");
		expect(reply.json.error?.message).not.toContain("Wandit");
		expect(metering.refund).toHaveBeenCalledOnce();
		expect(metering.refund).toHaveBeenCalledWith(
			HOLD_ID,
			"app_ai_video_failed",
		);
		expect(metering.settle).not.toHaveBeenCalled();
	});

	// Money and security: an https entry is billed and then piped; an http entry
	// is never fetched and is refunded.
	it.each([
		["https", 200, 1, 0],
		["http", 409, 0, 1],
	])("content of a %s URL entry answers %i, settles %i times, refunds %i times", async (scheme, statusCode, settles, refunds) => {
		const videoUrl = `${scheme}://${VIDEO_HOST}/video.mp4`;
		const { metering, service, upstreamFetch } = setup({
			status: () =>
				jsonResponse(200, {
					status: "completed",
					videos: [{ type: "url", url: videoUrl, mediaType: "video/mp4" }],
				}),
		});
		const created = await createJob(service);
		const reply = new FakeReply();

		await service.videoContent(
			call(PROJECT_A, { query: { id: created.json.id ?? "" } }),
			reply,
		);

		const downloads = upstreamFetch.mock.calls.filter(
			([url]) => String(url) === videoUrl,
		);
		expect(reply.statusCode).toBe(statusCode);
		expect(metering.settle).toHaveBeenCalledTimes(settles);
		expect(metering.refund).toHaveBeenCalledTimes(refunds);
		expect(downloads).toHaveLength(settles);
		expect(reply.body.equals(VIDEO_BYTES)).toBe(scheme === "https");
	});

	// Money: the sweep refunded the hold, so the video must stay unpaid and unsent.
	it("answers expired and 410 with no bytes when the settle finds a refunded hold", async () => {
		const { service } = setup({
			settle: async () => {
				throw new MeteringStateConflictError(HOLD_ID, "refunded", "settle");
			},
		});
		const created = await createJob(service);
		const query = { id: created.json.id ?? "" };
		const status = new FakeReply();
		const content = new FakeReply();

		await service.videoStatus(call(PROJECT_A, { query }), status);
		await service.videoContent(call(PROJECT_A, { query }), content);

		expect(status.json.status).toBe("expired");
		expect(content.statusCode).toBe(410);
		expect(content.body.includes(VIDEO_BYTES)).toBe(false);
	});

	// Money: an empty video is zero delivered units, so the app pays nothing.
	it("refunds a completed job whose video entry is empty", async () => {
		const { metering, service } = setup({
			status: () =>
				jsonResponse(200, {
					status: "completed",
					videos: [{ type: "base64", data: "", mediaType: "video/mp4" }],
				}),
		});
		const created = await createJob(service);
		const reply = new FakeReply();

		await service.videoStatus(
			call(PROJECT_A, { query: { id: created.json.id ?? "" } }),
			reply,
		);

		expect(reply.json.status).toBe("failed");
		expect(metering.refund).toHaveBeenCalledWith(
			HOLD_ID,
			"app_ai_video_failed",
		);
		expect(metering.settle).not.toHaveBeenCalled();
	});

	// Money: a cut download must not end cleanly, or the app stores a cut paid video as whole.
	it("closes the socket without a clean end when the download stops", async () => {
		const { service } = setup({
			status: () =>
				jsonResponse(200, {
					status: "completed",
					videos: [
						{
							type: "url",
							url: `https://${VIDEO_HOST}/video.mp4`,
							mediaType: "video/mp4",
						},
					],
				}),
			download: () =>
				new Response(
					new ReadableStream<Uint8Array>({
						start(controller) {
							controller.enqueue(VIDEO_BYTES.subarray(0, 4));
							controller.error(new Error("connection reset"));
						},
					}),
					{ status: 200 },
				),
		});
		const created = await createJob(service);
		const reply = new FakeReply();

		await service.videoContent(
			call(PROJECT_A, { query: { id: created.json.id ?? "" } }),
			reply,
		);

		expect(reply.statusCode).toBe(200);
		expect(reply.destroyed).toBe(true);
		expect(reply.ended).toBe(false);
	});

	// Money: a settle error must never answer completed or send bytes. The gateway then sends the event again.
	it("answers 503 on the status read, the content read, and the webhook when the settle fails", async () => {
		const { service, upstreamFetch } = setup({
			settle: async () => {
				throw new Error("db down");
			},
		});
		const created = await createJob(service);
		const status = new FakeReply();
		const content = new FakeReply();
		const callback = new FakeReply();

		await service.videoStatus(
			call(PROJECT_A, { query: { id: created.json.id ?? "" } }),
			status,
		);
		await service.videoContent(
			call(PROJECT_A, { query: { id: created.json.id ?? "" } }),
			content,
		);
		await service.videoCallback(
			{
				authorization: undefined,
				body: Buffer.from(
					JSON.stringify({
						type: "video.generation.completed",
						data: { jobId: "job_1", status: "completed" },
					}),
					"utf8",
				),
				query: { token: webhookToken(upstreamFetch) },
				abortSignal: new AbortController().signal,
			},
			callback,
		);

		expect(status.statusCode).toBe(503);
		expect(status.json.status).toBeUndefined();
		expect(content.statusCode).toBe(503);
		expect(content.body.includes(VIDEO_BYTES)).toBe(false);
		expect(callback.statusCode).toBe(503);
	});

	// Security: a job id is not a bearer secret on its own.
	it("refuses a job id of project A with the key of project B", async () => {
		const { metering, service, upstreamFetch } = setup({});
		const created = await createJob(service);
		const reply = new FakeReply();

		await service.videoContent(
			call(PROJECT_B, { query: { id: created.json.id ?? "" } }),
			reply,
		);

		expect(reply.statusCode).toBe(404);
		expect(upstreamFetch).toHaveBeenCalledOnce();
		expect(metering.settle).not.toHaveBeenCalled();
	});

	// Money: an app that never polls still pays; a failed job is refunded elsewhere.
	it.each([
		["video.generation.completed", 1],
		["video.generation.failed", 0],
	])("on the webhook event %s settles %i times", async (type, settles) => {
		const { metering, service, upstreamFetch } = setup({});
		const created = await createJob(service);
		const reply = new FakeReply();

		await service.videoCallback(
			{
				authorization: undefined,
				body: Buffer.from(
					JSON.stringify({ type, data: { jobId: "job_1", status: "x" } }),
					"utf8",
				),
				query: { token: webhookToken(upstreamFetch) },
				abortSignal: new AbortController().signal,
			},
			reply,
		);

		expect(reply.statusCode).toBe(200);
		expect(metering.settle).toHaveBeenCalledTimes(settles);
		expect(metering.refund).not.toHaveBeenCalled();

		// Money: the poll after the webhook must replay the same settle, or the paid video answers 503.
		await service.videoStatus(
			call(PROJECT_A, { query: { id: created.json.id ?? "" } }),
			new FakeReply(),
		);
		expect(metering.settle.mock.calls.at(-1)).toEqual(
			metering.settle.mock.calls[0],
		);
	});

	// Security: the public callback must not settle on a token it did not mint for it.
	it("answers 401 and settles nothing when the webhook gets a job token", async () => {
		const { metering, service } = setup({});
		const created = await createJob(service);
		const reply = new FakeReply();

		await service.videoCallback(
			{
				authorization: undefined,
				body: Buffer.from(
					JSON.stringify({
						type: "video.generation.completed",
						data: { jobId: "job_1", status: "completed" },
					}),
					"utf8",
				),
				query: { token: created.json.id ?? "" },
				abortSignal: new AbortController().signal,
			},
			reply,
		);

		expect(reply.statusCode).toBe(401);
		expect(metering.settle).not.toHaveBeenCalled();
	});

	// Security: the upstream media type goes into a header, so a line break must not pass.
	it("answers video/mp4 for an upstream media type with a line break", async () => {
		const { service } = setup({
			status: () =>
				jsonResponse(200, {
					status: "completed",
					videos: [
						{
							type: "base64",
							data: VIDEO_BYTES.toString("base64"),
							mediaType: "video/mp4\r\nx: 1",
						},
					],
				}),
		});
		const created = await createJob(service);
		const reply = new FakeReply();

		await service.videoContent(
			call(PROJECT_A, { query: { id: created.json.id ?? "" } }),
			reply,
		);

		expect(reply.statusCode).toBe(200);
		expect(reply.headers["content-type"]).toBe("video/mp4");
	});

	// Security: each read in progress can hold a full video in memory, so the
	// project has a cap on them, and each admitted read frees its slot.
	it("answers 429 above the open read slots and frees each slot after its read", async () => {
		let finishStatus: () => void = () => {};
		const statusGate = new Promise<void>((resolve) => {
			finishStatus = resolve;
		});
		const { rateCounts, rateLimit, service } = setup({
			status: async () => {
				await statusGate;
				return jsonResponse(200, { status: "pending" });
			},
		});
		const created = await createJob(service);
		const query = { id: created.json.id ?? "" };
		const replies = Array.from({ length: 5 }, () => new FakeReply());

		const reads = replies.map((reply) =>
			service.videoStatus(call(PROJECT_A, { query }), reply),
		);
		await vi.waitFor(() =>
			expect(replies.filter((reply) => reply.statusCode === 429)).toHaveLength(
				1,
			),
		);
		finishStatus();
		await Promise.all(reads);

		expect(replies.filter((reply) => reply.statusCode === 200)).toHaveLength(4);
		expect(rateLimit.release).toHaveBeenCalledTimes(5);
		expect(rateCounts.get(`builder:rate:app-ai-video-read:${PROJECT_A}`)).toBe(
			0,
		);
	});

	// Security: one paid job must not give free downloads through the API without end.
	it("answers 429 on the seventh content read of one job in one minute", async () => {
		const { service } = setup({});
		const created = await createJob(service);
		const query = { id: created.json.id ?? "" };
		const statuses: Array<number | undefined> = [];

		for (let read = 0; read < 7; read += 1) {
			const reply = new FakeReply();
			await service.videoContent(call(PROJECT_A, { query }), reply);
			statuses.push(reply.statusCode);
		}

		expect(statuses).toEqual([200, 200, 200, 200, 200, 200, 429]);
	});

	// HeyGen takes no audio flag and warns on one. Seedance gets the explicit
	// flag and the bytedance pin, merged with the gateway tags of the payer.
	it.each([
		["heygen/heygen-video-1", 5, undefined, undefined],
		["bytedance/seedance-2.5-flash", 4, false, ["bytedance"]],
	])("starts %s with generateAudio %s and gateway only %s", async (model, seconds, generateAudio, only) => {
		const { service, upstreamFetch } = setup({});
		const reply = new FakeReply();

		await service.createVideo(
			call(PROJECT_A, { body: { prompt: "A paper boat", seconds, model } }),
			reply,
		);

		expect(reply.statusCode).toBe(200);
		const startBody = JSON.parse(
			String(upstreamFetch.mock.calls[0]?.[1]?.body),
		);
		expect(startBody.generateAudio).toBe(generateAudio);
		expect(startBody.providerOptions.gateway).toMatchObject({
			tags: ["op:app_ai_gateway", "ws:personal"],
			user: "user_1",
		});
		expect(startBody.providerOptions.gateway.only).toEqual(only);
	});
});
