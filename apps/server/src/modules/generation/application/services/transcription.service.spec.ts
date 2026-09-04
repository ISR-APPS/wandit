import { BadRequestException, ConflictException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { MeteringService } from "../../../metering/application/services/metering.service";
import { MeteringStateConflictError } from "../../../metering/domain/metering";
import { AiGatewayNotConfiguredError } from "../../domain/errors/ai-gateway-not-configured.error";
import { TranscriptionService } from "./transcription.service";

type ReserveOutcome = Awaited<ReturnType<MeteringService["reserveWithReplay"]>>;

const gatewayMocks = vi.hoisted(() => ({
	doGenerate: vi.fn(),
	transcriptionModel: vi.fn(),
}));
const mockEnv = vi.hoisted(() => ({
	AI_GATEWAY_API_KEY: "gateway_test",
	AI_TRANSCRIPTION_MODEL: "openai/test-transcription",
	GENERATION_BILLING_MODE: "enforce",
}));

vi.mock("@ai-sdk/gateway", () => ({
	gateway: {
		transcriptionModel: gatewayMocks.transcriptionModel,
	},
}));

vi.mock("@wandit/env/server", () => ({ env: mockEnv }));

function setup() {
	const reserveWithReplay = vi.fn(
		async (): Promise<ReserveOutcome> => ({
			event: usageEvent(),
			replay: "none",
			replayed: false,
		}),
	);
	const metering = {
		captureGeneration: vi.fn(
			async (): Promise<{ id: string } | null> => ({
				id: "generation-ref-1",
			}),
		),
		// whisper-1 shape: $0.0001 per second (100 micros/s) at $0.04/credit.
		estimateMeasuredCost: vi.fn(
			async (input: {
				durationSeconds: number;
			}): Promise<{
				costUsdMicros: number;
				credits: number;
				unitUsdMicros: number;
			} | null> => ({
				costUsdMicros: Math.ceil(100 * input.durationSeconds),
				credits: Math.max(
					1,
					Math.ceil((Math.ceil(100 * input.durationSeconds) * 100) / 32_000),
				),
				unitUsdMicros: 100,
			}),
		),
		findByIdempotencyKey: vi.fn(
			async (): Promise<ReserveOutcome["event"] | null> => null,
		),
		refund: vi.fn(async () => undefined),
		reserveWithReplay,
		settle: vi.fn(async () => undefined),
		usdMicrosPerCredit: 32_000,
	};
	const service = new TranscriptionService(
		metering as unknown as MeteringService,
	);

	return { metering, service };
}

describe("TranscriptionService", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockEnv.AI_GATEWAY_API_KEY = "gateway_test";
		mockEnv.AI_TRANSCRIPTION_MODEL = "openai/test-transcription";
		mockEnv.GENERATION_BILLING_MODE = "enforce";
		gatewayMocks.transcriptionModel.mockReturnValue({
			doGenerate: gatewayMocks.doGenerate,
		});
	});

	it("caps duration before reserving or calling the provider", async () => {
		const { metering, service } = setup();

		await expect(
			service.transcribeAudio({
				audio: wavWithDuration(301),
				mimeType: "audio/wav",
				operationId: "operation-too-long",
				userId: "user-1",
			}),
		).rejects.toBeInstanceOf(BadRequestException);
		expect(metering.reserveWithReplay).not.toHaveBeenCalled();
		expect(gatewayMocks.doGenerate).not.toHaveBeenCalled();
	});

	it("fails missing gateway configuration before creating a hold", async () => {
		const { metering, service } = setup();
		mockEnv.AI_GATEWAY_API_KEY = "";

		await expect(
			service.transcribeAudio({
				audio: wavWithDuration(1),
				mimeType: "audio/wav",
				operationId: "operation-unconfigured",
				userId: "user-1",
			}),
		).rejects.toBeInstanceOf(AiGatewayNotConfiguredError);
		expect(metering.findByIdempotencyKey).toHaveBeenCalledWith(
			"transcription:user-1:operation-unconfigured",
			{ actorUserId: "user-1" },
		);
		expect(metering.reserveWithReplay).not.toHaveBeenCalled();
		expect(gatewayMocks.doGenerate).not.toHaveBeenCalled();
	});

	it("replays a stored terminal response without gateway configuration", async () => {
		const { metering, service } = setup();
		mockEnv.AI_GATEWAY_API_KEY = "";
		metering.findByIdempotencyKey.mockResolvedValueOnce(
			usageEvent(
				{
					transcriptionResponse: { durationSec: 1, text: "stored text" },
				},
				{
					attemptRef: "operation-unconfigured-replay",
					reservedCredits: 100,
					status: "settled",
				},
			),
		);

		await expect(
			service.transcribeAudio({
				audio: wavWithDuration(1),
				mimeType: "audio/wav",
				operationId: "operation-unconfigured-replay",
				userId: "user-1",
			}),
		).resolves.toEqual({ durationSec: 1, text: "stored text" });
		expect(metering.reserveWithReplay).not.toHaveBeenCalled();
		expect(gatewayMocks.doGenerate).not.toHaveBeenCalled();
	});

	it("reserves the floor, tags the call, captures its ref, and settles the measured cost", async () => {
		const { metering, service } = setup();
		gatewayMocks.doGenerate.mockResolvedValue({
			durationInSeconds: 61,
			providerMetadata: { gateway: { generationId: "gen-1" } },
			text: "hello",
		});

		await expect(
			service.transcribeAudio({
				audio: wavWithDuration(61),
				mimeType: "audio/wav",
				operationId: "operation-123456",
				userId: "user-1",
			}),
		).resolves.toEqual({ durationSec: 61, text: "hello" });

		expect(metering.reserveWithReplay).toHaveBeenCalledWith(
			"transcription",
			{ actorUserId: "user-1" },
			// 61 s × 100 micros = $0.0061 → 16 cc, below the 25 cc floor.
			expect.objectContaining({
				credits: 25,
				estimatedCostUsdMicros: 6_100,
				idempotencyKey: "transcription:user-1:operation-123456",
				measuredTerms: { estimatedUnitUsdMicros: 6_100, units: 1 },
			}),
		);
		expect(gatewayMocks.doGenerate).toHaveBeenCalledWith(
			expect.objectContaining({
				abortSignal: expect.any(AbortSignal),
				mediaType: "audio/wav",
				providerOptions: {
					gateway: {
						tags: ["op:transcription", "ws:personal"],
						user: "user-1",
					},
				},
			}),
		);
		expect(metering.captureGeneration).toHaveBeenCalledWith(
			"usage-event-1",
			expect.objectContaining({
				providerMetadata: { gateway: { generationId: "gen-1" } },
			}),
		);
		expect(metering.settle).toHaveBeenCalledWith(
			"usage-event-1",
			expect.objectContaining({
				costUsdMicros: 6_100,
				finalCredits: 20,
				pricing: "direct",
				pricingSnapshot: expect.objectContaining({
					mode: "measured",
					outcome: "delivered",
					source: "measured_local",
					usdMicrosPerSecond: 100,
				}),
			}),
		);
		expect(metering.settle).toHaveBeenCalledWith(
			"usage-event-1",
			expect.objectContaining({
				rawUsage: expect.objectContaining({
					durationSeconds: 61,
					providerDurationSeconds: 61,
					transcriptionResponse: { durationSec: 61, text: "hello" },
				}),
			}),
		);
	});

	it("settles under the reservation snapshot anchor, not the live config", async () => {
		// Reviewer scenario: the hold was reserved while AI_USD_PER_CREDIT was
		// 0.028 (snapshot 28_000); the config flipped to 0.04 before completion.
		const { metering, service } = setup();
		metering.usdMicrosPerCredit = 32_000;
		metering.reserveWithReplay.mockResolvedValueOnce({
			event: usageEvent(null, {
				pricingSnapshot: {
					mode: "measured",
					operation: "transcription",
					source: "operation_registry_reservation",
					unit: "operation",
					usdMicrosPerCredit: 28_000,
				},
			}),
			replay: "none",
			replayed: false,
		});
		gatewayMocks.doGenerate.mockResolvedValue({
			durationInSeconds: 61,
			providerMetadata: { gateway: { generationId: "gen-anchor" } },
			text: "hello",
		});

		await service.transcribeAudio({
			audio: wavWithDuration(61),
			mimeType: "audio/wav",
			operationId: "operation-anchor",
			userId: "user-1",
		});

		// 6_100 micros × 100 / 28_000 = 21.8 → 22 cc (16 cc at the live 32_000).
		expect(metering.settle).toHaveBeenCalledWith(
			"usage-event-1",
			expect.objectContaining({
				costUsdMicros: 6_100,
				finalCredits: 22,
				pricingSnapshot: expect.objectContaining({
					usdMicrosPerCredit: 28_000,
				}),
			}),
		);
	});

	it("holds and settles the floor when the model has no per-second rate", async () => {
		const { metering, service } = setup();
		metering.estimateMeasuredCost.mockResolvedValue(null);
		gatewayMocks.doGenerate.mockResolvedValue({
			durationInSeconds: 61,
			providerMetadata: { gateway: { generationId: "gen-token-priced" } },
			text: "token-priced model",
		});

		await expect(
			service.transcribeAudio({
				audio: wavWithDuration(61),
				mimeType: "audio/wav",
				operationId: "operation-no-rate",
				userId: "user-1",
			}),
		).resolves.toEqual({ durationSec: 61, text: "token-priced model" });
		expect(metering.reserveWithReplay).toHaveBeenCalledWith(
			"transcription",
			{ actorUserId: "user-1" },
			expect.objectContaining({
				credits: 25,
				estimatedCostUsdMicros: null,
				measuredTerms: { estimatedUnitUsdMicros: null, units: 1 },
			}),
		);
		// The gateway ref captured above reconciles the exact cost later.
		expect(metering.settle).toHaveBeenCalledWith(
			"usage-event-1",
			expect.objectContaining({
				costUsdMicros: null,
				finalCredits: 100,
				pricingSnapshot: expect.objectContaining({ usdMicrosPerSecond: null }),
			}),
		);
	});

	it("replays an admission hold after billing is switched off", async () => {
		const { metering, service } = setup();
		mockEnv.GENERATION_BILLING_MODE = "off";
		const existing = usageEvent(undefined, {
			attemptRef: "operation-toggle",
			model: "openai/test-transcription",
			reservedCredits: 100,
			status: "reserved",
		});
		metering.findByIdempotencyKey.mockResolvedValueOnce(existing);
		metering.reserveWithReplay.mockResolvedValueOnce({
			event: existing,
			replay: "reserved",
			replayed: true,
		});

		await expect(
			service.transcribeAudio({
				audio: wavWithDuration(1),
				mimeType: "audio/wav",
				operationId: "operation-toggle",
				userId: "user-1",
			}),
		).rejects.toBeInstanceOf(ConflictException);
		expect(metering.findByIdempotencyKey).toHaveBeenCalledWith(
			"transcription:user-1:operation-toggle",
			{ actorUserId: "user-1" },
		);
		expect(metering.reserveWithReplay).toHaveBeenCalledOnce();
		expect(gatewayMocks.doGenerate).not.toHaveBeenCalled();
	});

	it("creates no transcription hold when billing is off and none exists", async () => {
		const { metering, service } = setup();
		mockEnv.GENERATION_BILLING_MODE = "off";
		gatewayMocks.doGenerate.mockResolvedValue({
			durationInSeconds: 1,
			providerMetadata: {},
			text: "unmetered",
		});

		await expect(
			service.transcribeAudio({
				audio: wavWithDuration(1),
				mimeType: "audio/wav",
				operationId: "operation-off",
				userId: "user-1",
			}),
		).resolves.toEqual({ durationSec: 1, text: "unmetered" });
		expect(metering.findByIdempotencyKey).toHaveBeenCalledOnce();
		expect(metering.reserveWithReplay).not.toHaveBeenCalled();
	});

	it("uses a valid provider duration as authoritative for final credits", async () => {
		const { metering, service } = setup();
		gatewayMocks.doGenerate.mockResolvedValue({
			durationInSeconds: 121,
			providerMetadata: { gateway: { generationId: "gen-provider-duration" } },
			text: "provider timed transcript",
		});

		await expect(
			service.transcribeAudio({
				audio: wavWithDuration(30),
				mimeType: "audio/wav",
				operationId: "operation-provider-duration",
				userId: "user-1",
			}),
		).resolves.toEqual({
			durationSec: 121,
			text: "provider timed transcript",
		});
		expect(metering.reserveWithReplay).toHaveBeenCalledWith(
			"transcription",
			{ actorUserId: "user-1" },
			expect.objectContaining({ credits: 25, estimatedCostUsdMicros: 3_000 }),
		);
		// 121 s × 100 micros = $0.0121 → 31 cc.
		expect(metering.settle).toHaveBeenCalledWith(
			"usage-event-1",
			expect.objectContaining({
				costUsdMicros: 12_100,
				finalCredits: 38,
				pricingSnapshot: expect.objectContaining({
					billableDurationSeconds: 121,
					durationSource: "provider",
					localDurationSeconds: 30,
					providerDurationSeconds: 121,
				}),
				rawUsage: expect.objectContaining({
					billableDurationSeconds: 121,
					durationSeconds: 30,
					providerDurationSeconds: 121,
				}),
			}),
		);
	});

	it("settles at the maximum and withholds a transcript over the provider cap", async () => {
		const { metering, service } = setup();
		gatewayMocks.doGenerate.mockResolvedValue({
			durationInSeconds: 301,
			providerMetadata: { gateway: { generationId: "gen-over-cap" } },
			text: "must not be returned",
		});

		await expect(
			service.transcribeAudio({
				audio: wavWithDuration(1),
				mimeType: "audio/wav",
				operationId: "operation-provider-over-cap",
				userId: "user-1",
			}),
		).rejects.toMatchObject({
			response: {
				code: "AUDIO_DURATION_TOO_LONG",
				details: {
					durationSource: "provider",
					maxDurationSec: 300,
				},
			},
			status: 400,
		});
		expect(metering.settle).toHaveBeenCalledWith(
			"usage-event-1",
			// Capped at 300 s × 100 micros = $0.03 → 75 cc.
			expect.objectContaining({
				costUsdMicros: 30_000,
				finalCredits: 94,
				rawUsage: {
					billableDurationSeconds: 300,
					durationSeconds: 1,
					localDurationSeconds: 1,
					providerDurationSeconds: 301,
					rejectedReason: "provider_duration_exceeds_limit",
				},
			}),
		);
		expect(metering.refund).not.toHaveBeenCalled();
	});

	it("retries transient metering writes without repeating provider work", async () => {
		const { metering, service } = setup();
		gatewayMocks.doGenerate.mockResolvedValue({
			durationInSeconds: 1,
			providerMetadata: { gateway: { generationId: "gen-transient" } },
			text: "one provider response",
		});
		metering.captureGeneration
			.mockRejectedValueOnce(new Error("capture database timeout"))
			.mockRejectedValueOnce(new Error("capture database timeout"))
			.mockResolvedValueOnce({ id: "generation-ref-transient" });
		metering.settle
			.mockRejectedValueOnce(new Error("settle database timeout"))
			.mockRejectedValueOnce(new Error("settle database timeout"))
			.mockResolvedValueOnce(undefined);

		await expect(
			service.transcribeAudio({
				audio: wavWithDuration(1),
				mimeType: "audio/wav",
				operationId: "operation-transient-persistence",
				userId: "user-1",
			}),
		).resolves.toEqual({ durationSec: 1, text: "one provider response" });
		expect(gatewayMocks.doGenerate).toHaveBeenCalledTimes(1);
		expect(metering.captureGeneration).toHaveBeenCalledTimes(3);
		expect(metering.settle).toHaveBeenCalledTimes(3);
	});

	it("settles authoritative usage even when ref capture exhausts retries", async () => {
		const { metering, service } = setup();
		const captureError = new Error("capture database unavailable");
		gatewayMocks.doGenerate.mockResolvedValue({
			durationInSeconds: 121,
			providerMetadata: { gateway: { generationId: "gen-capture-failed" } },
			text: "durably billed transcript",
		});
		metering.captureGeneration.mockRejectedValue(captureError);

		await expect(
			service.transcribeAudio({
				audio: wavWithDuration(30),
				mimeType: "audio/wav",
				operationId: "operation-capture-exhausted",
				userId: "user-1",
			}),
		).rejects.toBe(captureError);
		expect(gatewayMocks.doGenerate).toHaveBeenCalledTimes(1);
		expect(metering.captureGeneration).toHaveBeenCalledTimes(3);
		expect(metering.settle).toHaveBeenCalledTimes(1);
		expect(metering.settle).toHaveBeenCalledWith(
			"usage-event-1",
			expect.objectContaining({
				finalCredits: 38,
				rawUsage: expect.objectContaining({
					providerDurationSeconds: 121,
					transcriptionResponse: {
						durationSec: 121,
						text: "durably billed transcript",
					},
				}),
			}),
		);
	});

	it("leaves a captured ref for recovery when settlement exhausts retries", async () => {
		const { metering, service } = setup();
		const settlementError = new Error("settlement database unavailable");
		gatewayMocks.doGenerate.mockResolvedValue({
			durationInSeconds: 121,
			providerMetadata: { gateway: { generationId: "gen-settle-failed" } },
			text: "must await recovery",
		});
		metering.settle.mockRejectedValue(settlementError);

		await expect(
			service.transcribeAudio({
				audio: wavWithDuration(30),
				mimeType: "audio/wav",
				operationId: "operation-settlement-exhausted",
				userId: "user-1",
			}),
		).rejects.toBe(settlementError);
		expect(gatewayMocks.doGenerate).toHaveBeenCalledTimes(1);
		expect(metering.captureGeneration).toHaveBeenCalledTimes(1);
		expect(metering.captureGeneration).toHaveBeenCalledWith(
			"usage-event-1",
			expect.objectContaining({
				stepUsage: {
					durationSeconds: 30,
					providerDurationSeconds: 121,
				},
			}),
		);
		expect(metering.settle).toHaveBeenCalledTimes(3);
	});

	it("requires a non-null generation ref but still settles authoritative usage", async () => {
		const { metering, service } = setup();
		gatewayMocks.doGenerate.mockResolvedValue({
			durationInSeconds: 1,
			providerMetadata: { provider: { requestId: "not-a-generation-id" } },
			text: "no gateway reference",
		});
		metering.captureGeneration.mockResolvedValue(null);

		await expect(
			service.transcribeAudio({
				audio: wavWithDuration(1),
				mimeType: "audio/wav",
				operationId: "operation-without-generation-id",
				userId: "user-1",
			}),
		).rejects.toThrow("did not expose a gateway generation id");
		expect(metering.captureGeneration).toHaveBeenCalledTimes(3);
		expect(metering.settle).toHaveBeenCalledTimes(1);
	});

	it("returns the stored response for a settled transport replay", async () => {
		const { metering, service } = setup();
		metering.reserveWithReplay.mockResolvedValueOnce({
			event: usageEvent({
				transcriptionResponse: { durationSec: 17, text: "stored text" },
			}),
			replay: "settled",
			replayed: true,
		});

		await expect(
			service.transcribeAudio({
				audio: wavWithDuration(1),
				mimeType: "audio/wav",
				operationId: "operation-replayed",
				userId: "user-1",
			}),
		).resolves.toEqual({ durationSec: 17, text: "stored text" });
		expect(gatewayMocks.doGenerate).not.toHaveBeenCalled();
		expect(metering.captureGeneration).not.toHaveBeenCalled();
		expect(metering.settle).not.toHaveBeenCalled();
	});

	it("returns the preserved settlement response after reconciliation", async () => {
		const { metering, service } = setup();
		metering.reserveWithReplay.mockResolvedValueOnce({
			event: usageEvent({
				gatewayReconciliation: { generations: [] },
				settlementRawUsage: {
					transcriptionResponse: {
						durationSec: 23,
						text: "reconciled text",
					},
				},
			}),
			replay: "reconciled",
			replayed: true,
		});

		await expect(
			service.transcribeAudio({
				audio: wavWithDuration(1),
				mimeType: "audio/wav",
				operationId: "operation-reconciled",
				userId: "user-1",
			}),
		).resolves.toEqual({ durationSec: 23, text: "reconciled text" });
		expect(gatewayMocks.doGenerate).not.toHaveBeenCalled();
	});

	it("keeps an in-flight stable-operation replay at 409", async () => {
		const { metering, service } = setup();
		metering.reserveWithReplay.mockResolvedValueOnce({
			event: usageEvent(),
			replay: "reserved",
			replayed: true,
		});

		await expect(
			service.transcribeAudio({
				audio: wavWithDuration(1),
				mimeType: "audio/wav",
				operationId: "operation-in-flight",
				userId: "user-1",
			}),
		).rejects.toBeInstanceOf(ConflictException);
		expect(gatewayMocks.doGenerate).not.toHaveBeenCalled();
	});

	it("refunds the hold when the provider fails", async () => {
		const { metering, service } = setup();
		gatewayMocks.doGenerate.mockRejectedValue(new Error("provider down"));

		await expect(
			service.transcribeAudio({
				audio: wavWithDuration(1),
				mimeType: "audio/wav",
				operationId: "operation-provider-failure",
				userId: "user-1",
			}),
		).rejects.toThrow("provider down");
		expect(metering.refund).toHaveBeenCalledWith(
			"usage-event-1",
			"transcription_provider_failed",
		);
	});

	it("captures a gateway error generation before refund and preserves the provider error", async () => {
		const { metering, service } = setup();
		const providerError = Object.assign(new Error("gateway failed"), {
			generationId: "generation_failed_transcription",
		});
		gatewayMocks.doGenerate.mockRejectedValue(providerError);
		metering.captureGeneration
			.mockResolvedValueOnce(null)
			.mockResolvedValueOnce(null)
			.mockResolvedValueOnce({ id: "generation-ref-error" });

		await expect(
			service.transcribeAudio({
				audio: wavWithDuration(1),
				mimeType: "audio/wav",
				operationId: "operation-gateway-error",
				userId: "user-1",
			}),
		).rejects.toBe(providerError);
		expect(metering.captureGeneration).toHaveBeenCalledTimes(3);
		expect(metering.captureGeneration).toHaveBeenLastCalledWith(
			"usage-event-1",
			{
				providerMetadata: {
					gateway: { generationId: "generation_failed_transcription" },
				},
			},
		);
		expect(metering.captureGeneration.mock.invocationCallOrder[2]).toBeLessThan(
			metering.refund.mock.invocationCallOrder[0] ?? Number.MAX_VALUE,
		);
		expect(metering.refund).toHaveBeenCalledWith(
			"usage-event-1",
			"transcription_provider_failed",
		);
	});

	it("does not replace a provider error when capture and refund cleanup fail", async () => {
		const { metering, service } = setup();
		const providerError = Object.assign(new Error("gateway failed"), {
			generationId: "generation_cleanup_failed",
		});
		gatewayMocks.doGenerate.mockRejectedValue(providerError);
		metering.captureGeneration.mockRejectedValue(
			new Error("capture unavailable"),
		);
		metering.refund.mockRejectedValue(new Error("refund unavailable"));

		await expect(
			service.transcribeAudio({
				audio: wavWithDuration(1),
				mimeType: "audio/wav",
				operationId: "operation-cleanup-failure",
				userId: "user-1",
			}),
		).rejects.toBe(providerError);
		expect(metering.captureGeneration).toHaveBeenCalledTimes(3);
		expect(metering.refund).toHaveBeenCalledOnce();
	});

	it("maps a retry after provider-failure refund to 409 without another call", async () => {
		const { metering, service } = setup();
		gatewayMocks.doGenerate.mockRejectedValue(new Error("provider down"));
		metering.reserveWithReplay
			.mockResolvedValueOnce({
				event: usageEvent(),
				replay: "none",
				replayed: false,
			})
			.mockRejectedValueOnce(
				new MeteringStateConflictError(
					"usage-event-1",
					"refunded",
					"replay reservation for",
				),
			);
		const request = {
			audio: wavWithDuration(1),
			mimeType: "audio/wav",
			operationId: "operation-provider-failure-retry",
			userId: "user-1",
		};

		await expect(service.transcribeAudio(request)).rejects.toThrow(
			"provider down",
		);
		await expect(service.transcribeAudio(request)).rejects.toMatchObject({
			response: {
				code: "TRANSCRIPTION_OPERATION_REPLAYED",
				message: "This transcription operation cannot execute again",
			},
			status: 409,
		});
		expect(gatewayMocks.doGenerate).toHaveBeenCalledTimes(1);
		expect(metering.refund).toHaveBeenCalledTimes(1);
	});
});

function usageEvent(
	rawUsage: unknown = null,
	overrides: Partial<ReserveOutcome["event"]> = {},
): ReserveOutcome["event"] {
	return {
		attemptRef: null,
		chatId: null,
		id: "usage-event-1",
		messageId: null,
		model: "openai/test-transcription",
		operation: "transcription",
		parentEventId: null,
		provider: null,
		rawUsage,
		reservedCredits: 100,
		status: "reserved",
		...overrides,
	} as ReserveOutcome["event"];
}

function wavWithDuration(seconds: number): Buffer {
	const byteRate = 1_000;
	const dataSize = seconds * byteRate;
	const audio = Buffer.alloc(44 + dataSize);
	audio.write("RIFF", 0, "ascii");
	audio.writeUInt32LE(audio.length - 8, 4);
	audio.write("WAVE", 8, "ascii");
	audio.write("fmt ", 12, "ascii");
	audio.writeUInt32LE(16, 16);
	audio.writeUInt16LE(1, 20);
	audio.writeUInt16LE(1, 22);
	audio.writeUInt32LE(byteRate, 24);
	audio.writeUInt32LE(byteRate, 28);
	audio.writeUInt16LE(1, 32);
	audio.writeUInt16LE(8, 34);
	audio.write("data", 36, "ascii");
	audio.writeUInt32LE(dataSize, 40);

	return audio;
}
