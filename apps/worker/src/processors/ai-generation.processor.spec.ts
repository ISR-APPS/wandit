import { env } from "@wandit/env/server";
import type { AiGenerationJobData } from "@wandit/jobs";
import { convertToModelMessages, streamText } from "ai";
import type { Job } from "bullmq";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { MeteringService } from "../../../server/src/modules/metering/application/services/metering.service";
import type { WorkerChatRepository } from "../infrastructure/persistence/worker-chat.repository";
import type { ChatEventsPublisher } from "../infrastructure/redis/chat-events.publisher";
import { AiGenerationProcessor } from "./ai-generation.processor";

vi.mock("ai", () => ({
	convertToModelMessages: vi.fn(async (messages) => messages),
	stepCountIs: vi.fn((steps: number) => ({ steps })),
	streamText: vi.fn(),
}));

vi.mock("@wandit/observability/node", () => ({
	Sentry: { captureException: vi.fn() },
}));

function setBillingMode(mode: "enforce" | "off") {
	(
		env as { GENERATION_BILLING_MODE: "enforce" | "off" }
	).GENERATION_BILLING_MODE = mode;
}

function setup() {
	const repository = {
		insertAssistantMessage: vi.fn(async () => assistantRow()),
		loadGenerationContext: vi.fn(async () => ({
			messages: [{ id: "message_1", parts: [], role: "user" }],
			projectId: "project_1",
			userId: "user_1",
		})),
	};
	const publisher = {
		clearActive: vi.fn(async () => undefined),
		markStarted: vi.fn(async () => undefined),
		publishDelta: vi.fn(async () => undefined),
		publishDone: vi.fn(async () => undefined),
		publishError: vi.fn(async () => undefined),
		publishMessageCompleted: vi.fn(async () => undefined),
		publishThinking: vi.fn(async () => undefined),
	};
	const metering = {
		captureGeneration: vi.fn(
			async (): Promise<{ id: string } | null> => ({
				id: "generation_ref_1",
			}),
		),
		findByIdempotencyKey: vi.fn(async () => ({
			attemptRef: "job_1",
			chatId: "chat_1",
			createdAt: new Date(),
			id: "usage_event_1",
			messageId: "message_1",
			operation: "chat",
			status: "reserved",
			userId: "user_1",
		})),
		refund: vi.fn(async () => undefined),
		settle: vi.fn(async () => ({ status: "settled" })),
	};
	const processor = new AiGenerationProcessor(
		repository as unknown as WorkerChatRepository,
		publisher as unknown as ChatEventsPublisher,
		metering as unknown as MeteringService,
	);

	return { metering, processor, publisher, repository };
}

beforeEach(() => {
	vi.clearAllMocks();
	setBillingMode("enforce");
	(
		env as { AI_GATEWAY_API_KEY?: string; AI_CHAT_MODEL: string }
	).AI_GATEWAY_API_KEY = "gateway_test";
	(
		env as { AI_GATEWAY_API_KEY?: string; AI_CHAT_MODEL: string }
	).AI_CHAT_MODEL = "openai/test";
	vi.mocked(streamText).mockReturnValue(streamResult() as never);
});

describe("AiGenerationProcessor metering", () => {
	it("tags, bounds, captures, saves, then settles", async () => {
		const { metering, processor, repository } = setup();

		await expect(processor.process(job())).resolves.toEqual({
			messageId: "assistant:job_1",
			processed: true,
		});

		expect(convertToModelMessages).toHaveBeenCalledOnce();
		expect(streamText).toHaveBeenCalledWith(
			expect.objectContaining({
				abortSignal: expect.any(AbortSignal),
				maxOutputTokens: 4_096,
				model: "openai/test",
				providerOptions: {
					gateway: {
						tags: ["op:chat", "ws:personal"],
						user: "user_1",
					},
				},
				stopWhen: { steps: 1 },
			}),
		);
		expect(metering.captureGeneration).toHaveBeenCalledWith("usage_event_1", {
			providerMetadata: { gateway: { generationId: "gen_1" } },
			stepUsage: usage(),
		});
		expect(metering.captureGeneration.mock.invocationCallOrder[0]).toBeLessThan(
			repository.insertAssistantMessage.mock.invocationCallOrder[0] ??
				Number.MAX_VALUE,
		);
		expect(repository.insertAssistantMessage).toHaveBeenCalledOnce();
		expect(
			repository.insertAssistantMessage.mock.invocationCallOrder[0],
		).toBeLessThan(
			metering.settle.mock.invocationCallOrder[0] ?? Number.MAX_VALUE,
		);
		expect(metering.settle).toHaveBeenCalledWith("usage_event_1", {
			modelId: "openai/test",
			pricing: "token",
			provider: "gateway",
			rawUsage: usage(),
			usage: usage(),
		});
	});

	it("refunds the durable reservation when provider work fails before save", async () => {
		const { metering, processor, repository } = setup();
		vi.mocked(streamText).mockImplementation(() => {
			throw new Error("provider unavailable");
		});

		await expect(processor.process(job())).rejects.toThrow(
			"provider unavailable",
		);
		expect(repository.insertAssistantMessage).not.toHaveBeenCalled();
		expect(metering.refund).toHaveBeenCalledWith(
			"usage_event_1",
			"legacy_chat_generation_failed",
		);
	});

	it("captures a synchronous gateway failure before the refund decision", async () => {
		const { metering, processor, repository } = setup();
		const providerError = Object.assign(new Error("gateway failed"), {
			generationId: "generation_failed_legacy",
		});
		vi.mocked(streamText).mockImplementation(() => {
			throw providerError;
		});
		metering.captureGeneration
			.mockResolvedValueOnce(null)
			.mockResolvedValueOnce(null)
			.mockResolvedValueOnce({ id: "generation_ref_error" });

		await expect(processor.process(job())).rejects.toBe(providerError);
		expect(repository.insertAssistantMessage).not.toHaveBeenCalled();
		expect(metering.captureGeneration).toHaveBeenCalledTimes(3);
		expect(metering.captureGeneration).toHaveBeenLastCalledWith(
			"usage_event_1",
			{
				providerMetadata: {
					gateway: { generationId: "generation_failed_legacy" },
				},
			},
		);
		// A durable ref keeps the hold for authoritative recovery/reconciliation.
		expect(metering.refund).not.toHaveBeenCalled();
	});

	it("retries a transient settlement failure after saving the response", async () => {
		const { metering, processor, repository } = setup();
		metering.settle
			.mockRejectedValueOnce(new Error("pricing temporarily unavailable"))
			.mockResolvedValueOnce({ status: "settled" });

		await expect(processor.process(job())).resolves.toMatchObject({
			processed: true,
		});
		expect(repository.insertAssistantMessage).toHaveBeenCalledOnce();
		expect(metering.settle).toHaveBeenCalledTimes(2);
		expect(metering.refund).not.toHaveBeenCalled();
	});

	it("does not refund a saved response when settlement retries exhaust", async () => {
		const { metering, processor } = setup();
		metering.settle.mockRejectedValue(new Error("pricing unavailable"));

		await expect(processor.process(job())).rejects.toThrow(
			"pricing unavailable",
		);
		expect(metering.settle).toHaveBeenCalledTimes(3);
		expect(metering.refund).not.toHaveBeenCalled();
	});

	it("does not refund provider work after its generation ref is durable", async () => {
		const { metering, processor, repository } = setup();
		repository.insertAssistantMessage.mockRejectedValueOnce(
			new Error("assistant write failed"),
		);

		await expect(processor.process(job())).rejects.toThrow(
			"assistant write failed",
		);
		expect(metering.captureGeneration).toHaveBeenCalledOnce();
		expect(metering.refund).not.toHaveBeenCalled();
		expect(metering.settle).not.toHaveBeenCalled();
	});

	it("retries a null generation ref but still saves and settles completed output", async () => {
		const { metering, processor, repository } = setup();
		metering.captureGeneration.mockResolvedValue(null);

		await expect(processor.process(job())).resolves.toMatchObject({
			processed: true,
		});
		expect(metering.captureGeneration).toHaveBeenCalledTimes(3);
		expect(repository.insertAssistantMessage).toHaveBeenCalledOnce();
		expect(metering.settle).toHaveBeenCalledOnce();
		expect(metering.refund).not.toHaveBeenCalled();
	});

	it("does not refund when a stream fails after publishing user-visible text", async () => {
		const { metering, processor, publisher, repository } = setup();
		vi.mocked(streamText).mockReturnValue({
			finishReason: Promise.resolve("error"),
			providerMetadata: Promise.resolve({}),
			stream: (async function* () {
				yield { text: "Already visible", type: "text-delta" };
				throw new Error("stream interrupted");
			})(),
			usage: Promise.resolve(usage()),
		} as never);

		await expect(processor.process(job())).rejects.toThrow(
			"stream interrupted",
		);
		expect(publisher.publishDelta).toHaveBeenCalledOnce();
		expect(repository.insertAssistantMessage).not.toHaveBeenCalled();
		expect(metering.refund).not.toHaveBeenCalled();
	});

	it("rejects enforced legacy jobs that have no reservation", async () => {
		const { metering, processor } = setup();

		await expect(
			processor.process(job({ usageEventId: null })),
		).rejects.toThrow("has no AI usage reservation");
		expect(streamText).not.toHaveBeenCalled();
		expect(metering.findByIdempotencyKey).not.toHaveBeenCalled();
		expect(metering.settle).not.toHaveBeenCalled();
	});

	it("does not call the provider for a reservation recovered before the job runs", async () => {
		const { metering, processor } = setup();
		metering.findByIdempotencyKey.mockResolvedValueOnce({
			attemptRef: "job_1",
			chatId: "chat_1",
			createdAt: new Date(),
			id: "usage_event_1",
			messageId: "message_1",
			operation: "chat",
			status: "refunded",
			userId: "user_1",
		});

		await expect(processor.process(job())).rejects.toThrow(
			"has no matching active AI usage reservation",
		);

		expect(metering.findByIdempotencyKey).toHaveBeenCalledWith(
			"legacy-chat:job_1",
			{ actorUserId: "user_1" },
		);
		expect(streamText).not.toHaveBeenCalled();
		expect(metering.refund).not.toHaveBeenCalled();
		expect(metering.settle).not.toHaveBeenCalled();
	});

	it("refunds an old queued reservation instead of racing recovery mid-provider", async () => {
		const { metering, processor } = setup();
		metering.findByIdempotencyKey.mockResolvedValueOnce({
			attemptRef: "job_1",
			chatId: "chat_1",
			createdAt: new Date(Date.now() - 31 * 60 * 1000),
			id: "usage_event_1",
			messageId: "message_1",
			operation: "chat",
			status: "reserved",
			userId: "user_1",
		});

		await expect(processor.process(job())).rejects.toThrow(
			"waited too long to start safely",
		);

		expect(streamText).not.toHaveBeenCalled();
		expect(metering.refund).toHaveBeenCalledOnce();
		expect(metering.refund).toHaveBeenCalledWith(
			"usage_event_1",
			"legacy_chat_generation_expired_before_start",
		);
		expect(metering.settle).not.toHaveBeenCalled();
	});

	it("rechecks age after context loading and never starts a now-stale reservation", async () => {
		const { metering, processor } = setup();
		metering.findByIdempotencyKey
			.mockResolvedValueOnce({
				attemptRef: "job_1",
				chatId: "chat_1",
				createdAt: new Date(Date.now() - 29 * 60 * 1000),
				id: "usage_event_1",
				messageId: "message_1",
				operation: "chat",
				status: "reserved",
				userId: "user_1",
			})
			.mockResolvedValueOnce({
				attemptRef: "job_1",
				chatId: "chat_1",
				createdAt: new Date(Date.now() - 31 * 60 * 1000),
				id: "usage_event_1",
				messageId: "message_1",
				operation: "chat",
				status: "reserved",
				userId: "user_1",
			});

		await expect(processor.process(job())).rejects.toThrow(
			"waited too long to start safely",
		);

		expect(metering.findByIdempotencyKey).toHaveBeenCalledTimes(2);
		expect(streamText).not.toHaveBeenCalled();
		expect(metering.refund).toHaveBeenCalledOnce();
		expect(metering.refund).toHaveBeenCalledWith(
			"usage_event_1",
			"legacy_chat_generation_expired_before_start",
		);
	});

	it("preserves billing-off jobs without a usage event", async () => {
		const { metering, processor } = setup();

		await expect(
			processor.process(job({ billingMode: "off", usageEventId: null })),
		).resolves.toMatchObject({ processed: true });
		expect(metering.findByIdempotencyKey).not.toHaveBeenCalled();
		expect(metering.captureGeneration).not.toHaveBeenCalled();
		expect(metering.settle).not.toHaveBeenCalled();
	});

	it("honors an enforce admission snapshot after the worker switch turns off", async () => {
		setBillingMode("off");
		const { metering, processor } = setup();

		await expect(processor.process(job())).resolves.toMatchObject({
			processed: true,
		});
		expect(metering.findByIdempotencyKey).toHaveBeenCalledTimes(2);
		expect(metering.settle).toHaveBeenCalledOnce();
	});

	it("honors an off admission snapshot after the worker switch turns on", async () => {
		const { metering, processor } = setup();

		await expect(
			processor.process(job({ billingMode: "off", usageEventId: null })),
		).resolves.toMatchObject({ processed: true });
		expect(metering.findByIdempotencyKey).not.toHaveBeenCalled();
		expect(metering.settle).not.toHaveBeenCalled();
	});

	it("rejects an inconsistent billing-off payload carrying a reservation", async () => {
		const { metering, processor } = setup();

		await expect(
			processor.process(job({ billingMode: "off" })),
		).rejects.toThrow(
			"Billing-off generation job must not carry an AI usage reservation",
		);
		expect(metering.findByIdempotencyKey).not.toHaveBeenCalled();
		expect(streamText).not.toHaveBeenCalled();
	});

	it("keeps backward compatibility for pre-snapshot billing-off jobs", async () => {
		const { metering, processor } = setup();

		await expect(
			processor.process(job({ billingMode: undefined, usageEventId: null })),
		).resolves.toMatchObject({ processed: true });
		expect(metering.findByIdempotencyKey).not.toHaveBeenCalled();
	});

	it("uses the runtime switch only when both legacy billing fields are absent", async () => {
		setBillingMode("off");
		const { metering, processor } = setup();

		await expect(
			processor.process(
				job({ billingMode: undefined, usageEventId: undefined }),
			),
		).resolves.toMatchObject({ processed: true });
		expect(metering.findByIdempotencyKey).not.toHaveBeenCalled();
	});

	it("rejects a refunded event after billing is switched off", async () => {
		setBillingMode("off");
		const { metering, processor } = setup();
		metering.findByIdempotencyKey.mockResolvedValueOnce({
			attemptRef: "job_1",
			chatId: "chat_1",
			createdAt: new Date(),
			id: "usage_event_1",
			messageId: "message_1",
			operation: "chat",
			status: "refunded",
			userId: "user_1",
		});

		await expect(processor.process(job())).rejects.toThrow(
			"has no matching active AI usage reservation",
		);
		expect(metering.findByIdempotencyKey).toHaveBeenCalledOnce();
		expect(streamText).not.toHaveBeenCalled();
	});
});

function job(
	overrides: Partial<AiGenerationJobData> = {},
): Job<AiGenerationJobData, unknown, "generate-copy"> {
	return {
		data: {
			action: "chatMessage",
			billingMode: "enforce",
			chatId: "chat_1",
			jobId: "job_1",
			messageId: "message_1",
			projectId: "project_1",
			prompt: "Hello",
			usageEventId: "usage_event_1",
			userId: "user_1",
			...overrides,
		},
		id: "job_1",
		name: "generate-copy",
	} as Job<AiGenerationJobData, unknown, "generate-copy">;
}

function streamResult() {
	return {
		finishReason: Promise.resolve("stop"),
		providerMetadata: Promise.resolve({
			gateway: { generationId: "gen_1" },
		}),
		stream: (async function* () {
			yield { text: "Hello", type: "text-delta" };
		})(),
		usage: Promise.resolve(usage()),
	};
}

function usage() {
	return {
		inputTokenDetails: {
			cacheReadTokens: 10,
			cacheWriteTokens: 0,
			noCacheTokens: 90,
		},
		inputTokens: 100,
		outputTokens: 20,
		totalTokens: 120,
	};
}

function assistantRow() {
	return {
		chatId: "chat_1",
		createdAt: new Date("2026-08-01T00:00:00.000Z"),
		id: "assistant:job_1",
		metadata: {},
		parts: [{ state: "done", text: "Hello", type: "text" }],
		role: "assistant" as const,
		seq: 2,
	};
}
