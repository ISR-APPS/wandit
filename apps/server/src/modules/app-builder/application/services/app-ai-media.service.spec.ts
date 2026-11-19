import type {
	appAiImageGenerationRequestSchema,
	appAiSpeechRequestSchema,
} from "@wandit/contracts";
import { describe, expect, it, vi } from "vitest";
import type { z } from "zod";

import type { MeteringService } from "../../../metering/application/services/metering.service";
import { ModelPricingService } from "../../../metering/application/services/model-pricing.service";
import type { AiUsageEvent } from "../../../metering/domain/metering";
import { mintAppAiKey } from "../../domain/app-ai-key";
import type { PublishProjectRow } from "../../infrastructure/persistence/app-publish.repository";
import { AppAiAdmission } from "./app-ai-admission";
import type { AppAiGatewayRequest } from "./app-ai-gateway.service";
import {
	type AppAiAudioUpload,
	AppAiMediaService,
} from "./app-ai-media.service";
import type { LlmProxyReply } from "./llm-proxy.service";

const PROJECT_ID = "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";
const APP_KEY = mintAppAiKey(PROJECT_ID);

const PROJECT: PublishProjectRow = {
	name: "Recipes",
	engine: "v2_app",
	framework: "vite-react",
	templateVersion: "v1",
	userId: "user_1",
	organizationId: null,
	deletedAt: null,
	suspendedReasonCode: null,
	suspendedAt: null,
};

// A fixed catalog, so a seed refresh never changes the expected charges.
// Seedream has a flat price; muse and flash-v2.5 have no row. The Google
// rows copy the catalog: token rates plus a price for each image size.
// Scribe costs 3,200 micros a second: 10 cc a second at 32,000 micros a credit.
const PRICE_CATALOG = {
	generatedAt: "2026-11-17T00:00:00.000Z",
	data: [
		{
			id: "bytedance/seedream-5.5",
			owned_by: "bytedance",
			type: "image",
			pricing: { image: "0.035" },
		},
		{
			id: "google/gemini-nano-banana-2.1",
			owned_by: "google",
			type: "language",
			pricing: {
				input: "0.0000015",
				output: "0.0000075",
				input_cache_read: "0.00000015",
				image_dimension_quality_pricing: [
					{ cost: "0.0336", size: "1K" },
					{ cost: "0.0504", size: "2K" },
					{ cost: "0.1134", size: "4K" },
					{ cost: "0.0336", size: "default" },
				],
			},
		},
		{
			id: "google/gemini-3.1-flash-image",
			owned_by: "google",
			type: "language",
			pricing: {
				input: "0.0000005",
				output: "0.000003",
				image_dimension_quality_pricing: [
					{ cost: "0.045", size: "2K" },
					{ cost: "0.067", size: "1K" },
					{ cost: "0.067", size: "default" },
				],
			},
		},
		{
			id: "google/gemini-2.5-flash-image",
			owned_by: "google",
			type: "language",
			pricing: {
				input: "0.0000003",
				output: "0.0000025",
				image_dimension_quality_pricing: [{ cost: "0.039", size: "default" }],
			},
		},
		{
			id: "elevenlabs/eleven-v4",
			owned_by: "elevenlabs",
			type: "speech",
			pricing: { speech_input_character_cost: "0.00008" },
		},
		{
			id: "elevenlabs/scribe-v2",
			owned_by: "elevenlabs",
			type: "transcription",
			pricing: { transcription_duration_cost_per_second: "0.0032" },
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
		id: "hold_1",
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
		projectId: PROJECT_ID,
		provider: null,
		rawUsage: null,
		reconcileAttempts: 0,
		reconciledAt: null,
		reconciledCostUsdMicros: null,
		reservedCredits: 100,
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

	writeHead(statusCode: number, headers: Record<string, string>): void {
		this.statusCode = statusCode;
		this.headers = headers;
	}

	write(chunk: Uint8Array): Promise<void> {
		this.chunks.push(Buffer.from(chunk));
		return Promise.resolve();
	}

	end(): void {}

	get body(): Buffer {
		return Buffer.concat(this.chunks);
	}
}

// One content part of a gateway language answer (V4 form of @ai-sdk/gateway).
type GoogleAnswerPart =
	| { type: "file"; mediaType: string; data: { type: "data"; data: string } }
	| { type: "text"; text: string };

// The answer of the gateway language endpoint for a Google image model.
type GoogleAnswer = {
	content: GoogleAnswerPart[];
	finishReason: { unified: string; raw: string };
	/** Token counts; a provider can leave out each count. */
	usage: {
		inputTokens: { total?: number; noCache?: number; cacheRead?: number };
		outputTokens: { total?: number; text?: number; reasoning?: number };
	};
	warnings: [];
	/** USD as a decimal string, as the gateway sends it. */
	providerMetadata?: { gateway: { cost: string } };
};

// The bodies that the fake upstream sends in these cases.
type UpstreamBody =
	| { images: string[] }
	| { audio: string }
	| { text: string; durationInSeconds?: number }
	| GoogleAnswer
	| { error: { message: string; type: string } };

// One PNG file part of a Google answer.
const GOOGLE_IMAGE_PART: GoogleAnswerPart = {
	type: "file",
	mediaType: "image/png",
	data: { type: "data", data: "aW1hZ2Ux" },
};

// A Google answer. The default usage is 12 input tokens and 1,890 output tokens (200 of them thinking).
function googleAnswer(
	content: GoogleAnswerPart[],
	gatewayCost?: string,
	usage: GoogleAnswer["usage"] = {
		inputTokens: { total: 12, noCache: 12, cacheRead: 0 },
		outputTokens: { total: 1890, text: 1690, reasoning: 200 },
	},
): GoogleAnswer {
	return {
		content,
		finishReason: { unified: "stop", raw: "STOP" },
		usage,
		warnings: [],
		...(gatewayCost === undefined
			? {}
			: { providerMetadata: { gateway: { cost: gatewayCost } } }),
	};
}

// The JSON body of one app call, before the zod defaults apply.
type MediaRequestBody =
	| z.input<typeof appAiImageGenerationRequestSchema>
	| z.input<typeof appAiSpeechRequestSchema>;

function jsonResponse(status: number, body: UpstreamBody): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" },
	});
}

function mediaRequest(body: MediaRequestBody): AppAiGatewayRequest {
	return {
		authorization: `Bearer ${APP_KEY}`,
		body: Buffer.from(JSON.stringify(body), "utf8"),
		abortSignal: new AbortController().signal,
	};
}

// A PCM WAV file of `seconds` length: 8-bit mono at 1,000 Hz, 1,000 bytes a second.
function wav(seconds: number): Buffer {
	const dataSize = seconds * 1000;
	const audio = Buffer.alloc(44 + dataSize);
	audio.write("RIFF", 0, "ascii");
	audio.writeUInt32LE(audio.length - 8, 4);
	audio.write("WAVE", 8, "ascii");
	audio.write("fmt ", 12, "ascii");
	audio.writeUInt32LE(16, 16);
	audio.writeUInt16LE(1, 20);
	audio.writeUInt16LE(1, 22);
	audio.writeUInt32LE(1000, 24);
	audio.writeUInt32LE(1000, 28);
	audio.writeUInt16LE(1, 32);
	audio.writeUInt16LE(8, 34);
	audio.write("data", 36, "ascii");
	audio.writeUInt32LE(dataSize, 40);
	return audio;
}

// One transcription call: the app request and the multipart file reader.
function transcriptionCall(audio: Buffer, authorization = `Bearer ${APP_KEY}`) {
	const readUpload = vi.fn(
		async (): Promise<AppAiAudioUpload> => ({
			audio,
			mediaType: "audio/wav",
			model: "elevenlabs/scribe-v2",
		}),
	);
	const request: AppAiGatewayRequest = {
		authorization,
		body: Buffer.alloc(0),
		abortSignal: new AbortController().signal,
	};
	return { readUpload, request };
}

// The real price service on the fixed catalog; fakes for the rest.
function setup(upstream: () => Response) {
	const metering = {
		refund: vi.fn<MeteringService["refund"]>(async () =>
			holdEvent({ status: "refunded" }),
		),
		reserve: vi.fn<MeteringService["reserve"]>(
			async (_operation, _subject, input) =>
				holdEvent({ reservedCredits: input.credits }),
		),
		settle: vi.fn<MeteringService["settle"]>(async (_eventId, settlement) =>
			holdEvent({
				finalCredits:
					settlement.pricing === "direct" ? settlement.finalCredits : null,
				status: "settled",
			}),
		),
	};
	const upstreamFetch = vi.fn<typeof fetch>(async () => upstream());
	const admission = new AppAiAdmission(
		{ readSystemValue: async () => APP_KEY },
		{ findProject: async () => PROJECT },
		{
			hit: async () => ({ count: 1, ttlMs: 60_000 }),
			release: async () => {},
		},
		metering,
		{ AI_GATEWAY_API_KEY: "upstream-key" },
	);
	const pricing = new ModelPricingService(
		{ findByModelId: async () => null, upsertMany: async () => 0 },
		{ seedResponse: PRICE_CATALOG, usdMicrosPerCredit: 32_000 },
	);
	const service = new AppAiMediaService(
		admission,
		pricing,
		metering,
		upstreamFetch,
	);
	return { metering, service, upstreamFetch };
}

describe("AppAiMediaService", () => {
	// Money: the hold pays for the images asked for; the charge counts the
	// images delivered.
	it("charges each delivered image of an image model at its flat price", async () => {
		const { metering, service, upstreamFetch } = setup(() =>
			jsonResponse(200, { images: ["aW1hZ2Ux", "aW1hZ2Uy"] }),
		);
		const reply = new FakeReply();

		await service.createImages(
			mediaRequest({
				model: "bytedance/seedream-5.5",
				prompt: "A red balloon",
				n: 3,
			}),
			reply,
		);

		expect(reply.statusCode).toBe(200);
		expect(JSON.parse(reply.body.toString("utf8")).data).toEqual([
			{ b64_json: "aW1hZ2Ux" },
			{ b64_json: "aW1hZ2Uy" },
		]);
		expect(String(upstreamFetch.mock.calls[0]?.[0])).toMatch(/\/image-model$/);
		// 3 x 35,000 micros = 105,000 micros = 329 cc at 32,000 micros a credit.
		expect(metering.reserve.mock.calls[0]?.[2]).toMatchObject({
			credits: 329,
			estimatedCostUsdMicros: 105_000,
		});
		// 2 delivered x 35,000 micros = 70,000 micros = 219 cc.
		expect(metering.settle).toHaveBeenCalledOnce();
		expect(metering.settle.mock.calls[0]?.[1]).toMatchObject({
			costUsdMicros: 70_000,
			finalCredits: 219,
			pricing: "direct",
		});
		expect(metering.refund).not.toHaveBeenCalled();
	});

	// Money: a Google image bills its tokens plus the image of its size, or
	// the gateway cost when the answer has one. A dropped size or a wrong
	// endpoint bills below cost.
	it.each<
		[
			string,
			string | undefined,
			GoogleAnswer["usage"] | undefined,
			number,
			number,
		]
	>([
		// 2K image 50,400 + 12 x 1.5 + 1,890 x 7.5 = 64,593 micros = 202 cc.
		[
			"the image and the tokens without a gateway cost",
			undefined,
			undefined,
			64_593,
			202,
		],
		// 0.051993 USD = 51,993 micros = 163 cc.
		["the gateway cost of the answer", "0.051993", undefined, 51_993, 163],
		// 50,400 + the token part of the hold 61,460 = 111,860 micros = 350 cc.
		[
			"the image and the token part of the hold without token counts",
			undefined,
			{ inputTokens: {}, outputTokens: {} },
			111_860,
			350,
		],
	])("bills a 2K Google image at %s", async (_label, gatewayCost, usage, costUsdMicros, finalCredits) => {
		const { metering, service, upstreamFetch } = setup(() =>
			jsonResponse(200, googleAnswer([GOOGLE_IMAGE_PART], gatewayCost, usage)),
		);
		const reply = new FakeReply();

		await service.createImages(
			mediaRequest({
				model: "google/gemini-nano-banana-2.1",
				prompt: "A red balloon",
				size: "2k",
			}),
			reply,
		);

		expect(reply.statusCode).toBe(200);
		expect(JSON.parse(reply.body.toString("utf8")).data).toEqual([
			{ b64_json: "aW1hZ2Ux" },
		]);
		expect(String(upstreamFetch.mock.calls[0]?.[0])).toMatch(
			/\/language-model$/,
		);
		expect(
			JSON.parse(String(upstreamFetch.mock.calls[0]?.[1]?.body)),
		).toMatchObject({
			maxOutputTokens: 8192,
			providerOptions: {
				google: {
					responseModalities: ["TEXT", "IMAGE"],
					imageConfig: { imageSize: "2K" },
				},
			},
		});
		// Hold: 50,400 + 13 bytes x 1.5 + 8,192 x 7.5 = 111,860 micros = 350 cc.
		expect(metering.reserve.mock.calls[0]?.[2]).toMatchObject({
			credits: 350,
			estimatedCostUsdMicros: 111_860,
		});
		expect(metering.settle).toHaveBeenCalledOnce();
		expect(metering.settle.mock.calls[0]?.[1]).toMatchObject({
			costUsdMicros,
			finalCredits,
			pricing: "direct",
		});
		expect(metering.refund).not.toHaveBeenCalled();
	});

	// Money: Google bills the tokens of an answer with no image, so they
	// settle; the app gets a 400, not a free refund. A file with no bytes is no image.
	it.each<[string, GoogleAnswerPart]>([
		["a text answer", { type: "text", text: "I cannot make that." }],
		[
			"an image file with no bytes",
			{
				type: "file",
				mediaType: "image/png",
				data: { type: "data", data: "" },
			},
		],
	])("bills the tokens and answers 400 when the Google model makes %s", async (_label, part) => {
		const { metering, service } = setup(() =>
			jsonResponse(200, googleAnswer([part])),
		);
		const reply = new FakeReply();

		await service.createImages(
			mediaRequest({
				model: "google/gemini-nano-banana-2.1",
				prompt: "A red balloon",
			}),
			reply,
		);

		expect(reply.statusCode).toBe(400);
		expect(JSON.parse(reply.body.toString("utf8"))).toMatchObject({
			error: { code: "invalid_request" },
		});
		// 12 x 1.5 + 1,890 x 7.5 = 14,193 micros = 45 cc.
		expect(metering.settle).toHaveBeenCalledOnce();
		expect(metering.settle.mock.calls[0]?.[1]).toMatchObject({
			costUsdMicros: 14_193,
			finalCredits: 45,
		});
		expect(metering.refund).not.toHaveBeenCalled();
	});

	// Money: an answer with no image, no tokens, and no cost did no paid work.
	// It is empty, so the hold is refunded, not billed at the 1 cc minimum.
	it("refunds the hold and answers 502 when the Google answer is empty", async () => {
		const { metering, service } = setup(() =>
			jsonResponse(
				200,
				googleAnswer([], undefined, {
					inputTokens: { total: 0, noCache: 0, cacheRead: 0 },
					outputTokens: { total: 0, text: 0, reasoning: 0 },
				}),
			),
		);
		const reply = new FakeReply();

		await service.createImages(
			mediaRequest({
				model: "google/gemini-nano-banana-2.1",
				prompt: "A red balloon",
			}),
			reply,
		);

		expect(reply.statusCode).toBe(502);
		expect(metering.refund).toHaveBeenCalledOnce();
		expect(metering.settle).not.toHaveBeenCalled();
	});

	// Money: Google bills each image of the answer, also above the n = 1 of
	// the hold, so each one goes to the app and bills.
	it("sends and bills each image of a Google answer", async () => {
		const { metering, service } = setup(() =>
			jsonResponse(200, googleAnswer([GOOGLE_IMAGE_PART, GOOGLE_IMAGE_PART])),
		);
		const reply = new FakeReply();

		await service.createImages(
			mediaRequest({
				model: "google/gemini-nano-banana-2.1",
				prompt: "Two red balloons",
			}),
			reply,
		);

		expect(reply.statusCode).toBe(200);
		expect(JSON.parse(reply.body.toString("utf8")).data).toHaveLength(2);
		// 2 x 33,600 (default size) + 14,193 tokens = 81,393 micros = 255 cc.
		expect(metering.settle.mock.calls[0]?.[1]).toMatchObject({
			costUsdMicros: 81_393,
			finalCredits: 255,
		});
	});

	it("refunds the image hold and answers 502 when the upstream answers 500", async () => {
		const { metering, service } = setup(() =>
			jsonResponse(500, {
				error: { message: "boom", type: "internal_server_error" },
			}),
		);
		const reply = new FakeReply();

		await service.createImages(
			mediaRequest({ model: "bytedance/seedream-5.5", prompt: "A cat" }),
			reply,
		);

		expect(reply.statusCode).toBe(502);
		expect(metering.refund).toHaveBeenCalledOnce();
		expect(metering.refund.mock.calls[0]?.[0]).toBe("hold_1");
		expect(metering.settle).not.toHaveBeenCalled();
	});

	// Money: a size without its own price would bill the default price. A
	// Google size below the default, or above 2K, can bill below cost.
	it.each<[string, z.input<typeof appAiImageGenerationRequestSchema>]>([
		[
			"a size on an image model without size prices",
			{ model: "bytedance/seedream-5.5", prompt: "A cat", size: "1024x1024" },
		],
		[
			"n = 2 on a Google model",
			{ model: "google/gemini-nano-banana-2.1", prompt: "A cat", n: 2 },
		],
		[
			"2K, below the default price",
			{ model: "google/gemini-3.1-flash-image", prompt: "A cat", size: "2K" },
		],
		[
			"4K on a Google model",
			{ model: "google/gemini-nano-banana-2.1", prompt: "A cat", size: "4K" },
		],
		[
			"a size on a Google model without size prices",
			{ model: "google/gemini-2.5-flash-image", prompt: "A cat", size: "1K" },
		],
	])("refuses %s before any hold", async (_label, body) => {
		const { metering, service, upstreamFetch } = setup(() =>
			jsonResponse(200, { images: ["aW1hZ2Ux"] }),
		);
		const reply = new FakeReply();

		await service.createImages(mediaRequest(body), reply);

		expect(reply.statusCode).toBe(400);
		expect(JSON.parse(reply.body.toString("utf8"))).toMatchObject({
			error: { code: "invalid_request" },
		});
		expect(metering.reserve).not.toHaveBeenCalled();
		expect(upstreamFetch).not.toHaveBeenCalled();
	});

	it("charges each input character at the rate and answers the MP3 bytes", async () => {
		const mp3 = Buffer.from("ID3-fake-mp3", "utf8");
		const { metering, service } = setup(() =>
			jsonResponse(200, { audio: mp3.toString("base64") }),
		);
		const reply = new FakeReply();

		await service.createSpeech(
			mediaRequest({
				model: "elevenlabs/eleven-v4",
				input: "a".repeat(1000),
				voice: "21m00Tcm4TlvDq8ikWAM",
			}),
			reply,
		);

		expect(reply.statusCode).toBe(200);
		expect(reply.headers["content-type"]).toBe("audio/mpeg");
		expect(reply.body.equals(mp3)).toBe(true);
		// 1,000 characters x 80 micros = 80,000 micros = 250 cc.
		expect(metering.reserve.mock.calls[0]?.[2]).toMatchObject({
			credits: 250,
		});
		expect(metering.settle.mock.calls[0]?.[1]).toMatchObject({
			costUsdMicros: 80_000,
			finalCredits: 250,
		});
	});

	// Money: a 200 with no audio delivers zero units, so the app pays nothing.
	it("refunds the speech hold and answers 502 when the upstream audio is empty", async () => {
		const { metering, service } = setup(() => jsonResponse(200, { audio: "" }));
		const reply = new FakeReply();

		await service.createSpeech(
			mediaRequest({
				model: "elevenlabs/eleven-v4",
				input: "Hello",
				voice: "21m00Tcm4TlvDq8ikWAM",
			}),
			reply,
		);

		expect(reply.statusCode).toBe(502);
		expect(metering.refund).toHaveBeenCalledOnce();
		expect(metering.settle).not.toHaveBeenCalled();
	});

	// Money: an allowed model without a price row must never run unbilled.
	it.each([
		["image", { model: "meta/muse-image-1.0", prompt: "A cat" }],
		[
			"speech",
			{
				model: "elevenlabs/eleven-flash-v2.5",
				input: "Hi",
				voice: "21m00Tcm4TlvDq8ikWAM",
			},
		],
	] as const)("answers 503 for an unpriced %s model and holds nothing", async (route, body) => {
		const { metering, service, upstreamFetch } = setup(() => {
			throw new Error("The upstream must not be called.");
		});
		const reply = new FakeReply();

		await (route === "image"
			? service.createImages(mediaRequest(body), reply)
			: service.createSpeech(mediaRequest(body), reply));

		expect(reply.statusCode).toBe(503);
		expect(JSON.parse(reply.body.toString("utf8"))).toMatchObject({
			error: { code: "gateway_unavailable" },
		});
		expect(metering.reserve).not.toHaveBeenCalled();
		expect(upstreamFetch).not.toHaveBeenCalled();
	});

	// Security and money: a refusal of the Wandit account, or an allowed model
	// that the gateway does not find, is an operator problem. The app gets no
	// upstream text, and pays nothing.
	it.each([
		[401, "authentication_error", "Invalid API key"],
		[402, "insufficient_funds", "Wandit team balance is empty"],
		[403, "forbidden", "Wandit team is blocked"],
		[404, "model_not_found", "Model elevenlabs/eleven-v4 not found"],
	])("answers 503 and refunds when the upstream answers %i", async (status, type, message) => {
		const { metering, service } = setup(() =>
			jsonResponse(status, { error: { message, type } }),
		);
		const reply = new FakeReply();

		await service.createSpeech(
			mediaRequest({
				model: "elevenlabs/eleven-v4",
				input: "Hello",
				voice: "21m00Tcm4TlvDq8ikWAM",
			}),
			reply,
		);

		expect(reply.statusCode).toBe(503);
		const bodyText = reply.body.toString("utf8");
		expect(JSON.parse(bodyText)).toMatchObject({
			error: { code: "gateway_unavailable" },
		});
		expect(bodyText).not.toContain(message);
		expect(metering.refund).toHaveBeenCalledOnce();
		expect(metering.settle).not.toHaveBeenCalled();
	});

	// Money: the provider length bills when it is a real number, else the
	// container length. Above the limit the real length bills and the app gets no text.
	it.each([
		["the provider length when it is valid", 12.5, 200, 40_000, 125],
		["the container length when the provider length is 0", 0, 200, 32_000, 100],
		[
			"the provider length when it is above the limit",
			400,
			400,
			1_280_000,
			4000,
		],
	])("charges %s", async (_label, durationInSeconds, status, costUsdMicros, finalCredits) => {
		const { metering, service } = setup(() =>
			jsonResponse(200, { text: "Hello there", durationInSeconds }),
		);
		const { readUpload, request } = transcriptionCall(wav(10));
		const reply = new FakeReply();

		await service.createTranscription(request, readUpload, reply);

		expect(reply.statusCode).toBe(status);
		expect(reply.body.toString("utf8").includes("Hello there")).toBe(
			status === 200,
		);
		// The hold uses the 10 s container: 32,000 micros = 100 cc.
		expect(metering.reserve.mock.calls[0]?.[2]).toMatchObject({
			credits: 100,
			estimatedCostUsdMicros: 32_000,
		});
		expect(metering.settle).toHaveBeenCalledOnce();
		expect(metering.settle.mock.calls[0]?.[1]).toMatchObject({
			costUsdMicros,
			finalCredits,
		});
		expect(metering.refund).not.toHaveBeenCalled();
	});

	// Money: a length the server cannot read or above the limit has no
	// safe hold, so the call stops before the hold and the upstream.
	it.each([
		["audio of unknown length", Buffer.from("not audio")],
		["audio above the limit", wav(301)],
	])("refuses %s before any hold", async (_label, audio) => {
		const { metering, service, upstreamFetch } = setup(() =>
			jsonResponse(200, { text: "Hello there" }),
		);
		const { readUpload, request } = transcriptionCall(audio);
		const reply = new FakeReply();

		await service.createTranscription(request, readUpload, reply);

		expect(reply.statusCode).toBe(400);
		expect(JSON.parse(reply.body.toString("utf8"))).toMatchObject({
			error: { code: "invalid_request" },
		});
		expect(metering.reserve).not.toHaveBeenCalled();
		expect(upstreamFetch).not.toHaveBeenCalled();
	});

	// Security: a caller without a valid key never makes the server buffer a file.
	it("does not read the file when the key is wrong", async () => {
		const { metering, service } = setup(() =>
			jsonResponse(200, { text: "Hello there" }),
		);
		const { readUpload, request } = transcriptionCall(
			wav(10),
			`Bearer ${mintAppAiKey(PROJECT_ID)}`,
		);
		const reply = new FakeReply();

		await service.createTranscription(request, readUpload, reply);

		expect(reply.statusCode).toBe(401);
		expect(readUpload).not.toHaveBeenCalled();
		expect(metering.reserve).not.toHaveBeenCalled();
	});

	it("refunds the transcription hold and answers 502 when the upstream answers 500", async () => {
		const { metering, service } = setup(() =>
			jsonResponse(500, {
				error: { message: "boom", type: "internal_server_error" },
			}),
		);
		const { readUpload, request } = transcriptionCall(wav(10));
		const reply = new FakeReply();

		await service.createTranscription(request, readUpload, reply);

		expect(reply.statusCode).toBe(502);
		expect(metering.refund).toHaveBeenCalledOnce();
		expect(metering.settle).not.toHaveBeenCalled();
	});
});
