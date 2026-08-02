import { BadRequestException, HttpException } from "@nestjs/common";
import {
	applyElementOpsInputSchema,
	applyElementOpsOutputSchema,
	readElementsInputSchema,
	readElementsOutputSchema,
	readThemeInputSchema,
	readThemeOutputSchema,
} from "@wandit/contracts";
import { env } from "@wandit/env/server";
import type { DynamicToolUIPart, Tool } from "ai";
import type { FastifyReply, FastifyRequest } from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

const aiMocks = vi.hoisted(() => ({
	createAgentUIStream: vi.fn(),
	createUIMessageStream: vi.fn(),
	pipeUIMessageStreamToResponse: vi.fn(),
}));
const chatAgentMocks = vi.hoisted(() => ({
	createChatAgent: vi.fn(),
}));

vi.mock("ai", async (importOriginal) => {
	const actual = await importOriginal<typeof import("ai")>();

	return {
		...actual,
		createAgentUIStream: aiMocks.createAgentUIStream,
		createUIMessageStream: aiMocks.createUIMessageStream,
		pipeUIMessageStreamToResponse: aiMocks.pipeUIMessageStreamToResponse,
	};
});

vi.mock("../../agent/chat-agent", () => ({
	aiChatToolsForValidation: {},
	createChatAgent: chatAgentMocks.createChatAgent,
}));

vi.mock("../../../../infrastructure/analytics/analytics.service", () => ({
	AnalyticsService: class AnalyticsService {},
}));

import { InsufficientCreditsError } from "../../../credits/domain/errors/insufficient-credits.error";
import type { McpChatToolsResult } from "../../../mcp-connectors/application/services/mcp-chat-tools.service";
import { MeteringStateConflictError } from "../../../metering/domain/metering";
import type { WanditUIMessage } from "../../agent/chat-agent";
import { AiChatController } from "../../presentation/http/controllers/ai-chat.controller";
import { AiChatService, completeDanglingToolCalls } from "./ai-chat.service";

type AiChatServiceDependencies = ConstructorParameters<typeof AiChatService>;
type CapturedStreamOptions = {
	execute?: (options: {
		writer: {
			merge: (stream: ReadableStream<unknown>) => void;
			write: (part: unknown) => void;
		};
	}) => Promise<void>;
	onEnd?: (options: {
		isContinuation: boolean;
		responseMessage: WanditUIMessage;
	}) => Promise<void>;
};

const CHAT_ID = "chat-1";
const PROJECT_ID = "project-1";
const USER_ID = "user-1";

let capturedStreamOptions: CapturedStreamOptions | undefined;

function buildService({
	mcpResult = createMcpResult(),
	meteringOverrides = {},
	pricingOverrides = {},
}: {
	mcpResult?: McpChatToolsResult;
	meteringOverrides?: Record<string, unknown>;
	pricingOverrides?: Record<string, unknown>;
} = {}) {
	const chatsRepository = {
		findOwnedChatById: vi.fn().mockResolvedValue({
			id: CHAT_ID,
			projectId: PROJECT_ID,
		}),
		insertUiMessagesIfAbsent: vi.fn().mockResolvedValue(undefined),
		upsertUiMessage: vi.fn().mockResolvedValue(undefined),
	};
	const pagesRepository = {
		collectManualEditTrail: vi.fn().mockResolvedValue([]),
	};
	const pageEditsService = {};
	const leadScrapesRepository = {};
	const mediaGenerationsRepository = {};
	const marketingAssetsRepository = {};
	const imageGenerationsRepository = {};
	const mcpChatToolsService = {
		resolveToolsForUser: vi.fn().mockResolvedValue(mcpResult),
	};
	const meteringService = {
		captureGeneration: vi.fn().mockResolvedValue({ id: "generation-ref" }),
		claimBundledReservation: vi.fn().mockResolvedValue(null),
		findByIdempotencyKey: vi.fn().mockResolvedValue(null),
		reserveWithReplay: vi.fn().mockResolvedValue({
			event: {
				chatId: CHAT_ID,
				id: "usage-event-1",
				operation: "chat",
				status: "reserved",
			},
			replay: "none",
			replayed: false,
		}),
		settle: vi.fn().mockResolvedValue({
			id: "usage-event-1",
			status: "settled",
		}),
		...meteringOverrides,
	};
	const modelPricingService = {
		quoteTokenUsage: vi.fn().mockResolvedValue({
			costUsdMicros: 60_000,
			credits: 2,
		}),
		...pricingOverrides,
	};
	const service = new AiChatService(
		chatsRepository as unknown as AiChatServiceDependencies[0],
		pagesRepository as unknown as AiChatServiceDependencies[1],
		pageEditsService as unknown as AiChatServiceDependencies[2],
		leadScrapesRepository as unknown as AiChatServiceDependencies[3],
		mediaGenerationsRepository as unknown as AiChatServiceDependencies[4],
		marketingAssetsRepository as unknown as AiChatServiceDependencies[5],
		imageGenerationsRepository as unknown as AiChatServiceDependencies[6],
		mcpChatToolsService as unknown as AiChatServiceDependencies[7],
		meteringService as unknown as AiChatServiceDependencies[8],
		modelPricingService as unknown as AiChatServiceDependencies[9],
	);

	return {
		chatsRepository,
		meteringService,
		mcpChatToolsService,
		modelPricingService,
		pagesRepository,
		service,
	};
}

async function streamThroughController(
	service: AiChatService,
	chatsRepository: ReturnType<typeof buildService>["chatsRepository"],
	messages: unknown[],
) {
	const controller = new AiChatController(service, chatsRepository as never);
	const request = {
		headers: {},
		raw: { once: vi.fn() },
	} as unknown as FastifyRequest;
	const reply = {
		hijack: vi.fn(),
		raw: {},
	} as unknown as FastifyReply;

	await controller.stream(
		CHAT_ID,
		{ messages },
		{ id: USER_ID } as never,
		request,
		reply,
	);

	return { reply, request };
}

function createMcpResult(
	overrides: Partial<McpChatToolsResult> = {},
): McpChatToolsResult {
	return {
		approvalMap: {},
		close: vi.fn().mockResolvedValue(undefined),
		notices: [],
		tools: {},
		...overrides,
	};
}

function streamOptions(messages: WanditUIMessage[] = [userMessage()]) {
	return {
		abortSignal: new AbortController().signal,
		chatId: CHAT_ID,
		messages,
		prepared: { eventId: "usage-event-1", release: vi.fn() },
		projectId: PROJECT_ID,
		reply: { raw: {} } as FastifyReply,
		userId: USER_ID,
	};
}

function userMessage(): WanditUIMessage {
	return {
		id: "user-message",
		parts: [{ text: "Hello", type: "text" }],
		role: "user",
	};
}

function assistantMessage(
	metadata?: WanditUIMessage["metadata"],
): WanditUIMessage {
	return {
		id: "assistant-message",
		metadata,
		parts: [{ text: "Hi", type: "text" }],
		role: "assistant",
	};
}

function capturedOnEnd() {
	const onEnd = capturedStreamOptions?.onEnd;

	if (!onEnd) {
		throw new Error("createUIMessageStream did not receive onEnd");
	}

	return onEnd;
}

function capturedExecute() {
	const execute = capturedStreamOptions?.execute;

	if (!execute) {
		throw new Error("createUIMessageStream did not receive execute");
	}

	return execute;
}

function capturedAgentStreamOptions() {
	const options = aiMocks.createAgentUIStream.mock.calls[0]?.[0];

	if (!options) {
		throw new Error("createAgentUIStream was not called");
	}

	return options;
}

describe("AiChatService MCP lifecycle", () => {
	beforeEach(() => {
		vi.resetAllMocks();
		capturedStreamOptions = undefined;
		chatAgentMocks.createChatAgent.mockReturnValue({});
		aiMocks.createAgentUIStream.mockResolvedValue(new ReadableStream());
		aiMocks.createUIMessageStream.mockImplementation((options: unknown) => {
			capturedStreamOptions = options as CapturedStreamOptions;
			return {};
		});
		aiMocks.pipeUIMessageStreamToResponse.mockImplementation(() => {});
	});

	it("reserves before the controller hijacks the HTTP reply", async () => {
		const { chatsRepository, meteringService, service } = buildService();

		const { reply } = await streamThroughController(service, chatsRepository, [
			userMessage(),
		]);

		expect(meteringService.reserveWithReplay).toHaveBeenCalledTimes(1);
		expect(reply.hijack).toHaveBeenCalledTimes(1);
		expect(
			meteringService.reserveWithReplay.mock.invocationCallOrder[0],
		).toBeLessThan(
			vi.mocked(reply.hijack).mock.invocationCallOrder[0] ?? Number.MAX_VALUE,
		);
	});

	it("reuses the still-reserved project-creation event", async () => {
		const { meteringService, service } = buildService();
		meteringService.claimBundledReservation.mockResolvedValue({
			attemptRef: `bundled-pending:project-stream:${PROJECT_ID}:user-message`,
			chatId: CHAT_ID,
			id: "project-usage-event",
			messageId: "user-message",
			operation: "chat",
			status: "reserved",
		});

		const prepared = await service.prepareStream({
			chatId: CHAT_ID,
			messages: [userMessage()],
			projectId: PROJECT_ID,
			userId: USER_ID,
		});

		expect(prepared.eventId).toBe("project-usage-event");
		expect(meteringService.claimBundledReservation).toHaveBeenCalledWith({
			chatId: CHAT_ID,
			claimAttemptRef: `bundled-pending:project-stream:${PROJECT_ID}:user-message`,
			expectedAttemptRef: `bundled-pending:project:${PROJECT_ID}`,
			idempotencyKey: `project-create:${PROJECT_ID}`,
			messageId: "user-message",
			operation: "chat",
			userId: USER_ID,
		});
		expect(meteringService.reserveWithReplay).not.toHaveBeenCalled();
		prepared.release();
	});

	it.each([
		"same",
		"different",
	])("returns 409 before provider work when the bundled creation claim is a %s-request replay", async () => {
		const { meteringService, service } = buildService();
		meteringService.claimBundledReservation.mockRejectedValueOnce(
			new MeteringStateConflictError(
				"project-usage-event",
				"reserved",
				"claim",
			),
		);

		const error = await service
			.prepareStream({
				chatId: CHAT_ID,
				messages: [userMessage()],
				projectId: PROJECT_ID,
				requestId: "claim-replay",
				userId: USER_ID,
			})
			.catch((caught: unknown) => caught);

		expect(error).toBeInstanceOf(HttpException);
		expect((error as HttpException).getStatus()).toBe(409);
		expect(meteringService.reserveWithReplay).not.toHaveBeenCalled();
		expect(aiMocks.createAgentUIStream).not.toHaveBeenCalled();
	});

	it("honors accepted holds after billing is switched off and suppresses only new holds", async () => {
		const previousMode = env.GENERATION_BILLING_MODE;
		(
			env as typeof env & { GENERATION_BILLING_MODE: "enforce" | "off" }
		).GENERATION_BILLING_MODE = "off";

		try {
			const claimed = buildService();
			claimed.meteringService.claimBundledReservation.mockResolvedValueOnce({
				id: "project-usage-event",
				status: "reserved",
			});

			const claimedPrepared = await claimed.service.prepareStream({
				chatId: CHAT_ID,
				messages: [userMessage()],
				projectId: PROJECT_ID,
				requestId: "accepted-creation",
				userId: USER_ID,
			});
			expect(claimedPrepared.eventId).toBe("project-usage-event");
			expect(
				claimed.meteringService.findByIdempotencyKey,
			).not.toHaveBeenCalled();
			claimedPrepared.release();

			const ordinaryReplay = buildService();
			ordinaryReplay.meteringService.findByIdempotencyKey.mockResolvedValueOnce(
				{
					id: "ordinary-usage-event",
					status: "reserved",
				},
			);
			await expect(
				ordinaryReplay.service.prepareStream({
					chatId: CHAT_ID,
					messages: [userMessage()],
					projectId: PROJECT_ID,
					requestId: "accepted-ordinary",
					userId: USER_ID,
				}),
			).rejects.toMatchObject({ status: 409 });
			expect(
				ordinaryReplay.meteringService.reserveWithReplay,
			).not.toHaveBeenCalled();

			const newOperation = buildService();
			const prepared = await newOperation.service.prepareStream({
				chatId: CHAT_ID,
				messages: [userMessage()],
				projectId: PROJECT_ID,
				requestId: "new-unmetered-operation",
				userId: USER_ID,
			});
			expect(prepared.eventId).toBeNull();
			expect(
				newOperation.meteringService.reserveWithReplay,
			).not.toHaveBeenCalled();
			prepared.release();
		} finally {
			(
				env as typeof env & {
					GENERATION_BILLING_MODE: "enforce" | "off";
				}
			).GENERATION_BILLING_MODE = previousMode;
		}
	});

	it.each([
		"reserved",
		"settled",
		"reconciled",
	] as const)("returns 409 before provider streaming for an ordinary %s replay", async (replay) => {
		const { meteringService, service } = buildService();
		meteringService.reserveWithReplay.mockResolvedValueOnce({
			event: { id: "usage-event-1", status: replay },
			replay,
			replayed: true,
		});

		const error = await service
			.prepareStream({
				chatId: CHAT_ID,
				messages: [userMessage()],
				projectId: PROJECT_ID,
				requestId: "ordinary-replay",
				userId: USER_ID,
			})
			.catch((caught: unknown) => caught);

		expect(error).toBeInstanceOf(HttpException);
		expect((error as HttpException).getStatus()).toBe(409);
		expect(aiMocks.createAgentUIStream).not.toHaveBeenCalled();
	});

	it.each([
		"refunded",
		"reconcile_failed",
	] as const)("returns 409 for a terminal ordinary %s replay", async (status) => {
		const { meteringService, service } = buildService();
		meteringService.reserveWithReplay.mockRejectedValueOnce(
			new MeteringStateConflictError("usage-event-1", status, "replay"),
		);

		const error = await service
			.prepareStream({
				chatId: CHAT_ID,
				messages: [userMessage()],
				projectId: PROJECT_ID,
				requestId: "terminal-replay",
				userId: USER_ID,
			})
			.catch((caught: unknown) => caught);

		expect(error).toBeInstanceOf(HttpException);
		expect((error as HttpException).getStatus()).toBe(409);
		expect(aiMocks.createAgentUIStream).not.toHaveBeenCalled();
	});

	it("caps one user's concurrently active streams at three and releases exactly once", async () => {
		const { service } = buildService();
		const prepared = [];

		for (let index = 0; index < 3; index += 1) {
			prepared.push(
				await service.prepareStream({
					chatId: CHAT_ID,
					messages: [userMessage()],
					projectId: PROJECT_ID,
					requestId: `request-${index}`,
					userId: USER_ID,
				}),
			);
		}

		const error = await service
			.prepareStream({
				chatId: CHAT_ID,
				messages: [userMessage()],
				projectId: PROJECT_ID,
				requestId: "request-4",
				userId: USER_ID,
			})
			.catch((caught: unknown) => caught);

		expect(error).toBeInstanceOf(Error);
		expect((error as { getStatus: () => number }).getStatus()).toBe(429);
		prepared[0]?.release();
		prepared[0]?.release();

		const replacement = await service.prepareStream({
			chatId: CHAT_ID,
			messages: [userMessage()],
			projectId: PROJECT_ID,
			requestId: "replacement",
			userId: USER_ID,
		});

		for (const item of [...prepared.slice(1), replacement]) {
			item.release();
		}
	});

	it("captures every step generation and settles aggregate end usage", async () => {
		const { meteringService, service } = buildService();
		const options = streamOptions();
		const writer = { merge: vi.fn(), write: vi.fn() };

		await service.stream(options);
		await capturedExecute()({ writer });
		const agentOptions = capturedAgentStreamOptions();
		const stepUsage = {
			inputTokens: 100,
			inputTokenDetails: {
				cacheReadTokens: 10,
				cacheWriteTokens: 5,
				noCacheTokens: 85,
			},
			outputTokens: 20,
			outputTokenDetails: { reasoningTokens: 5, textTokens: 15 },
			totalTokens: 120,
		};

		await agentOptions.onStepEnd?.({
			providerMetadata: { gateway: { generationId: "generation-1" } },
			usage: stepUsage,
		} as never);
		await agentOptions.onStepEnd?.({
			providerMetadata: { gateway: { generationId: "generation-2" } },
			usage: stepUsage,
		} as never);
		agentOptions.messageMetadata?.({
			part: { type: "finish", totalUsage: stepUsage },
		} as never);
		await agentOptions.onEnd?.({} as never);

		expect(meteringService.captureGeneration).toHaveBeenCalledTimes(2);
		expect(meteringService.captureGeneration).toHaveBeenNthCalledWith(
			1,
			"usage-event-1",
			{
				providerMetadata: { gateway: { generationId: "generation-1" } },
				stepUsage,
			},
		);
		expect(meteringService.settle).toHaveBeenCalledWith("usage-event-1", {
			modelId: env.AI_CHAT_MODEL,
			pricing: "token",
			rawUsage: stepUsage,
			usage: stepUsage,
		});
		options.prepared.release();
	});

	it("captures a gateway stream error for recovery without replacing its client handling", async () => {
		const { meteringService, service } = buildService();
		meteringService.captureGeneration
			.mockResolvedValueOnce(null)
			.mockResolvedValueOnce(null)
			.mockResolvedValueOnce({ id: "generation-ref-error" });
		const options = streamOptions();

		await service.stream(options);
		await capturedExecute()({
			writer: { merge: vi.fn(), write: vi.fn() },
		});
		const agentOptions = capturedAgentStreamOptions();
		const providerError = Object.assign(new Error("gateway failed"), {
			generationId: "generation-failed-stream",
		});

		expect(agentOptions.onError?.(providerError)).toBe("An error occurred.");
		await agentOptions.onEnd?.({} as never);

		expect(meteringService.captureGeneration).toHaveBeenCalledTimes(3);
		expect(meteringService.captureGeneration).toHaveBeenLastCalledWith(
			"usage-event-1",
			{
				providerMetadata: {
					gateway: { generationId: "generation-failed-stream" },
				},
			},
		);
		expect(meteringService.settle).not.toHaveBeenCalled();
		options.prepared.release();
	});

	it("retries a step generation capture without replaying the model step", async () => {
		const { meteringService, service } = buildService();
		meteringService.captureGeneration
			.mockRejectedValueOnce(new Error("database unavailable"))
			.mockRejectedValueOnce(new Error("database unavailable"))
			.mockResolvedValueOnce({ id: "generation-ref" });
		const options = streamOptions();

		await service.stream(options);
		await capturedExecute()({
			writer: { merge: vi.fn(), write: vi.fn() },
		});
		const agentOptions = capturedAgentStreamOptions();
		const step = {
			providerMetadata: { gateway: { generationId: "generation-retry" } },
			usage: { inputTokens: 100, outputTokens: 20 },
		};

		await agentOptions.onStepEnd?.(step as never);

		expect(meteringService.captureGeneration).toHaveBeenCalledTimes(3);
		expect(meteringService.captureGeneration).toHaveBeenLastCalledWith(
			"usage-event-1",
			{
				providerMetadata: step.providerMetadata,
				stepUsage: step.usage,
			},
		);
		options.prepared.release();
	});

	it("replays an unconfirmed step capture before settling", async () => {
		const { meteringService, service } = buildService();
		meteringService.captureGeneration
			.mockRejectedValueOnce(new Error("database unavailable"))
			.mockRejectedValueOnce(new Error("database unavailable"))
			.mockRejectedValueOnce(new Error("database unavailable"))
			.mockResolvedValueOnce({ id: "generation-ref" });
		const options = streamOptions();

		await service.stream(options);
		await capturedExecute()({
			writer: { merge: vi.fn(), write: vi.fn() },
		});
		const agentOptions = capturedAgentStreamOptions();
		const usage = { inputTokens: 100, outputTokens: 20 };

		await agentOptions.onStepEnd?.({
			providerMetadata: { gateway: { generationId: "generation-retry" } },
			usage,
		} as never);
		await agentOptions.onEnd?.({} as never);

		expect(meteringService.captureGeneration).toHaveBeenCalledTimes(4);
		expect(
			meteringService.captureGeneration.mock.invocationCallOrder[3],
		).toBeLessThan(
			meteringService.settle.mock.invocationCallOrder[0] ?? Number.MAX_VALUE,
		);
		expect(meteringService.settle).toHaveBeenCalledTimes(1);
		options.prepared.release();
	});

	it("does not settle when a gateway generation id never becomes durable", async () => {
		const { meteringService, service } = buildService();
		meteringService.captureGeneration.mockResolvedValue(null);
		const options = streamOptions();

		await service.stream(options);
		await capturedExecute()({
			writer: { merge: vi.fn(), write: vi.fn() },
		});
		const agentOptions = capturedAgentStreamOptions();
		const usage = { inputTokens: 100, outputTokens: 20 };

		await agentOptions.onStepEnd?.({
			providerMetadata: {},
			usage,
		} as never);
		await expect(agentOptions.onEnd?.({} as never)).rejects.toThrow(
			"AI Gateway generation id is missing",
		);

		expect(meteringService.captureGeneration).toHaveBeenCalledTimes(6);
		expect(meteringService.settle).not.toHaveBeenCalled();
		options.prepared.release();
	});

	it("aborts and releases a stream before stale-reservation recovery can race it", async () => {
		const timeoutController = new AbortController();
		const timeout = vi
			.spyOn(AbortSignal, "timeout")
			.mockReturnValue(timeoutController.signal);
		const { service } = buildService();
		const options = streamOptions();

		await service.stream(options);
		await capturedExecute()({
			writer: { merge: vi.fn(), write: vi.fn() },
		});
		const agentOptions = capturedAgentStreamOptions();

		expect(timeout).toHaveBeenCalledWith(35 * 60 * 1_000);
		expect(agentOptions.abortSignal.aborted).toBe(false);

		timeoutController.abort();

		expect(agentOptions.abortSignal.aborted).toBe(true);
		expect(options.prepared.release).toHaveBeenCalledTimes(1);
		timeout.mockRestore();
	});

	it("emits the typed billing data part when end settlement exhausts credits", async () => {
		const { meteringService, service } = buildService();
		meteringService.settle.mockRejectedValue(
			new InsufficientCreditsError(4, 1),
		);
		const options = streamOptions();
		const writer = { merge: vi.fn(), write: vi.fn() };

		await service.stream(options);
		await capturedExecute()({ writer });
		const agentOptions = capturedAgentStreamOptions();
		agentOptions.messageMetadata?.({
			part: {
				totalUsage: {
					inputTokenDetails: {
						cacheReadTokens: 0,
						cacheWriteTokens: 0,
						noCacheTokens: 100,
					},
					inputTokens: 100,
					outputTokenDetails: { reasoningTokens: 5, textTokens: 15 },
					outputTokens: 20,
					totalTokens: 120,
				},
				type: "finish",
			},
		} as never);
		await agentOptions.onEnd?.({} as never);

		expect(writer.write).toHaveBeenCalledWith({
			data: {
				code: "INSUFFICIENT_CREDITS",
				details: { availableCredits: 1, requiredCredits: 4 },
				statusCode: 402,
			},
			type: "data-billing-error",
		});
		options.prepared.release();
	});

	it("stops a nested tool loop and suppresses tool text for a billing refusal", async () => {
		const { service } = buildService();
		const options = streamOptions();
		const writer = { merge: vi.fn(), write: vi.fn() };

		await service.stream(options);
		await capturedExecute()({ writer });
		const agentOptions = capturedAgentStreamOptions();
		const transforms = agentOptions.experimental_transform;
		const stopOnBillingError = Array.isArray(transforms)
			? transforms[0]
			: transforms;
		const stopStream = vi.fn();

		if (!stopOnBillingError) {
			throw new Error("billing stream transform was not installed");
		}

		const transform = stopOnBillingError({ stopStream, tools: {} });
		const reader = new ReadableStream({
			start(controller) {
				controller.enqueue({
					error: new InsufficientCreditsError(25, 3),
					input: {},
					toolCallId: "tool_1",
					toolName: "animate_image",
					type: "tool-error",
				});
				controller.close();
			},
		})
			.pipeThrough(transform)
			.getReader();

		await expect(reader.read()).resolves.toEqual({
			done: true,
			value: undefined,
		});
		expect(stopStream).toHaveBeenCalledOnce();
		expect(writer.write).toHaveBeenCalledWith({
			data: {
				code: "INSUFFICIENT_CREDITS",
				details: { availableCredits: 3, requiredCredits: 25 },
				statusCode: 402,
			},
			type: "data-billing-error",
		});
		options.prepared.release();
	});

	it("preserves a clean selected target through UI validation and history seeding", async () => {
		const selectedTarget = {
			excerpt: "A focused launch headline",
			tag: "h1",
			wid: "hero-title",
		};
		const rawUserMessage = {
			id: "targeted-user-message",
			metadata: { selectedTarget },
			parts: [{ text: "Refine this headline", type: "text" }],
			role: "user",
		};
		const { chatsRepository, service } = buildService();

		await streamThroughController(service, chatsRepository, [rawUserMessage]);

		const responseMessage = assistantMessage();
		await capturedOnEnd()({
			isContinuation: false,
			responseMessage,
		});

		expect(chatsRepository.insertUiMessagesIfAbsent).toHaveBeenCalledWith(
			CHAT_ID,
			[rawUserMessage, responseMessage],
		);
		const insertedUserMessage =
			chatsRepository.insertUiMessagesIfAbsent.mock.calls[0]?.[1]?.[0];
		expect(insertedUserMessage).toEqual(rawUserMessage);
		expect(insertedUserMessage?.metadata?.selectedTarget).toEqual({
			excerpt: "A focused launch headline",
			tag: "h1",
			wid: "hero-title",
		});
		expect(
			Object.keys(insertedUserMessage?.metadata?.selectedTarget ?? {}).sort(),
		).toEqual(["excerpt", "tag", "wid"]);
	});

	it.each([
		{
			field: "tag",
			selectedTarget: {
				excerpt: "Headline",
				tag: "t".repeat(33),
				wid: "hero-title",
			},
		},
		{
			field: "excerpt",
			selectedTarget: {
				excerpt: "e".repeat(161),
				tag: "h1",
				wid: "hero-title",
			},
		},
	])("rejects an overlong selectedTarget $field at the controller boundary", async ({
		selectedTarget,
	}) => {
		const { chatsRepository, service } = buildService();
		const serviceStream = vi.spyOn(service, "stream");
		const error = await streamThroughController(service, chatsRepository, [
			{
				id: "invalid-target-message",
				metadata: { selectedTarget },
				parts: [{ text: "Refine this", type: "text" }],
				role: "user",
			},
		]).catch((caught: unknown) => caught);

		expect(error).toBeInstanceOf(BadRequestException);
		expect((error as BadRequestException).getResponse()).toEqual({
			code: "INVALID_UI_MESSAGES",
			message: "Messages do not match the AI chat protocol",
		});
		expect(serviceStream).not.toHaveBeenCalled();
	});

	it("closes MCP clients after the continuation persistence branch", async () => {
		const mcpTool = { type: "dynamic" } as unknown as Tool;
		const mcpResult = createMcpResult({
			approvalMap: {
				"mcp_meta-ads_create_campaign": "user-approval",
			},
			notices: ["Meta Ads needs reconnection."],
			tools: { "mcp_meta-ads_get_campaigns": mcpTool },
		});
		const { chatsRepository, meteringService, service } = buildService({
			mcpResult,
		});

		await service.stream(streamOptions());

		expect(mcpResult.close).not.toHaveBeenCalled();
		expect(chatAgentMocks.createChatAgent).toHaveBeenCalledWith(
			expect.objectContaining({
				meteringService,
				parentEventId: "usage-event-1",
			}),
			expect.stringContaining("Meta Ads needs reconnection."),
			mcpResult.tools,
			mcpResult.approvalMap,
		);

		const responseMessage = assistantMessage({
			model: "provider/model",
			usage: { inputTokens: 120, outputTokens: 30, totalTokens: 150 },
		});
		await capturedOnEnd()({
			isContinuation: true,
			responseMessage,
		});

		expect(chatsRepository.upsertUiMessage).toHaveBeenCalledWith(
			CHAT_ID,
			responseMessage,
		);
		expect(chatsRepository.insertUiMessagesIfAbsent).not.toHaveBeenCalled();
		expect(mcpResult.close).toHaveBeenCalledTimes(1);
	});

	it("attaches model and accumulated v7 usage through messageMetadata", async () => {
		const { service } = buildService();

		await service.stream(streamOptions());
		await capturedExecute()({
			writer: { merge: vi.fn(), write: vi.fn() },
		});

		const agentOptions = aiMocks.createAgentUIStream.mock.calls[0]?.[0] as
			| {
					messageMetadata?: (options: { part: unknown }) => unknown;
			  }
			| undefined;
		const messageMetadata = agentOptions?.messageMetadata;
		if (!messageMetadata) throw new Error("messageMetadata was not configured");

		expect(messageMetadata({ part: { type: "start" } })).toEqual({
			model: env.AI_CHAT_MODEL,
		});
		expect(
			messageMetadata({
				part: {
					type: "finish",
					totalUsage: {
						inputTokens: 120,
						inputTokenDetails: {
							cacheReadTokens: 20,
							cacheWriteTokens: 5,
							noCacheTokens: 100,
						},
						outputTokens: 30,
						outputTokenDetails: {
							reasoningTokens: 10,
							textTokens: 20,
						},
						totalTokens: 150,
					},
				},
			}),
		).toEqual({
			model: env.AI_CHAT_MODEL,
			usage: {
				inputTokens: 120,
				inputTokenDetails: {
					cacheReadTokens: 20,
					cacheWriteTokens: 5,
					noCacheTokens: 100,
				},
				outputTokens: 30,
				outputTokenDetails: {
					reasoningTokens: 10,
					textTokens: 20,
				},
				totalTokens: 150,
			},
		});
		expect(messageMetadata({ part: { type: "text-delta" } })).toBeUndefined();
	});

	it("closes MCP clients when ordinary persistence rejects", async () => {
		const persistenceError = new Error("database unavailable");
		const mcpResult = createMcpResult();
		const { chatsRepository, service } = buildService({ mcpResult });
		chatsRepository.insertUiMessagesIfAbsent.mockRejectedValue(
			persistenceError,
		);
		await service.stream(streamOptions());

		const responseMessage = assistantMessage({
			model: "provider/model",
			usage: { inputTokens: 120, outputTokens: 30, totalTokens: 150 },
		});
		await expect(
			capturedOnEnd()({
				isContinuation: false,
				responseMessage,
			}),
		).rejects.toBe(persistenceError);

		expect(chatsRepository.insertUiMessagesIfAbsent).toHaveBeenCalledWith(
			CHAT_ID,
			[userMessage(), responseMessage],
		);
		expect(chatsRepository.upsertUiMessage).not.toHaveBeenCalled();
		expect(mcpResult.close).toHaveBeenCalledTimes(1);
	});

	it("closes MCP clients and rethrows a failure before the pipe takes ownership", async () => {
		const pipeError = new Error("response pipe failed");
		const mcpResult = createMcpResult();
		const { service } = buildService({ mcpResult });
		aiMocks.pipeUIMessageStreamToResponse.mockImplementation(() => {
			throw pipeError;
		});

		await expect(service.stream(streamOptions())).rejects.toBe(pipeError);
		expect(mcpResult.close).toHaveBeenCalledTimes(1);
	});

	it("waits for and closes a concurrent MCP result when context gathering fails", async () => {
		const contextError = new Error("context query failed");
		const mcpResult = createMcpResult();
		const pendingMcpResult = deferred<McpChatToolsResult>();
		const { mcpChatToolsService, pagesRepository, service } = buildService();
		mcpChatToolsService.resolveToolsForUser.mockReturnValue(
			pendingMcpResult.promise,
		);
		pagesRepository.collectManualEditTrail.mockRejectedValue(contextError);
		const pendingStream = service.stream(streamOptions());

		expect(mcpChatToolsService.resolveToolsForUser).toHaveBeenCalledWith(
			USER_ID,
			"usage-event-1",
		);
		expect(pagesRepository.collectManualEditTrail).toHaveBeenCalledWith(
			PROJECT_ID,
		);
		pendingMcpResult.resolve(mcpResult);

		await expect(pendingStream).rejects.toBe(contextError);
		expect(mcpResult.close).toHaveBeenCalledTimes(1);
		expect(chatAgentMocks.createChatAgent).not.toHaveBeenCalled();
	});
});

describe("completeDanglingToolCalls dynamic tools", () => {
	it("repairs input-streaming as output-error", () => {
		const { repaired } = repairDynamicPart({
			state: "input-streaming",
			toolCallId: "call-1",
			toolName: "mcp_meta-ads_get_campaigns",
			type: "dynamic-tool",
		});

		expect(repaired).toMatchObject({
			errorText: "Tool call was interrupted.",
			input: undefined,
			state: "output-error",
		});
	});

	it("repairs input-available as output-error", () => {
		const input = { accountId: "account-1" };
		const { repaired } = repairDynamicPart({
			input,
			state: "input-available",
			toolCallId: "call-2",
			toolName: "mcp_meta-ads_get_campaigns",
			type: "dynamic-tool",
		});

		expect(repaired).toMatchObject({
			errorText: "Tool call was interrupted.",
			input,
			state: "output-error",
		});
	});

	it("repairs approval-requested with a synthesized interrupted denial", () => {
		const { repaired } = repairDynamicPart({
			approval: { id: "approval-1", isAutomatic: false, signature: "signed" },
			input: { campaign: "Summer" },
			state: "approval-requested",
			toolCallId: "call-3",
			toolName: "mcp_meta-ads_create_campaign",
			type: "dynamic-tool",
		});

		expect(repaired).toMatchObject({
			approval: {
				approved: false,
				id: "approval-1",
				reason: "interrupted",
			},
			state: "output-denied",
		});
		expect(repaired.approval).toEqual({
			approved: false,
			id: "approval-1",
			reason: "interrupted",
		});
	});

	it("repairs a denied approval response while preserving its approval", () => {
		const approval = {
			approved: false as const,
			id: "approval-2",
			isAutomatic: false,
			reason: "user denied",
			signature: "signed",
		};
		const { repaired } = repairDynamicPart({
			approval,
			input: { campaignId: "campaign-1" },
			state: "approval-responded",
			toolCallId: "call-4",
			toolName: "mcp_meta-ads_delete_campaign",
			type: "dynamic-tool",
		});

		expect(repaired.state).toBe("output-denied");
		expect(repaired.approval).toEqual(approval);
	});

	it("repairs an approved response without output while preserving approval", () => {
		const approval = {
			approved: true as const,
			id: "approval-3",
			isAutomatic: false,
			signature: "signed",
		};
		const { repaired } = repairDynamicPart({
			approval,
			input: { budget: 500 },
			state: "approval-responded",
			toolCallId: "call-5",
			toolName: "mcp_meta-ads_update_budget",
			type: "dynamic-tool",
		});

		expect(repaired).toMatchObject({
			approval,
			errorText: "Tool call was interrupted.",
			state: "output-error",
		});
	});
});

describe("completeDanglingToolCalls page tools", () => {
	it("repairs apply_element_ops with schema-valid rejected output", () => {
		const repaired = repairBuiltInPart({
			input: { ops: [] },
			state: "input-streaming",
			toolCallId: "call-apply-element-ops",
			type: "tool-apply_element_ops",
		});

		expect(repaired).toMatchObject({
			input: {
				ops: [{ kind: "text", wid: "unknown" }],
			},
			output: {
				status: "rejected",
			},
			state: "output-available",
		});
		expect(applyElementOpsInputSchema.safeParse(repaired.input).success).toBe(
			true,
		);
		expect(applyElementOpsOutputSchema.safeParse(repaired.output).success).toBe(
			true,
		);
	});

	it("repairs read_elements while preserving a valid ordered input", () => {
		const input = { wids: ["hero-title", "pricing-cta"] };
		const repaired = repairBuiltInPart({
			input,
			state: "input-available",
			toolCallId: "call-read-elements",
			type: "tool-read_elements",
		});

		expect(repaired).toMatchObject({
			input,
			output: {
				status: "no-page",
			},
			state: "output-available",
		});
		expect(readElementsInputSchema.safeParse(repaired.input).success).toBe(
			true,
		);
		expect(readElementsOutputSchema.safeParse(repaired.output).success).toBe(
			true,
		);
	});

	it("repairs read_theme with schema-valid input and output", () => {
		const repaired = repairBuiltInPart({
			input: {},
			state: "input-streaming",
			toolCallId: "call-read-theme",
			type: "tool-read_theme",
		});

		expect(repaired).toMatchObject({
			input: {},
			output: {
				status: "no-page",
			},
			state: "output-available",
		});
		expect(readThemeInputSchema.safeParse(repaired.input).success).toBe(true);
		expect(readThemeOutputSchema.safeParse(repaired.output).success).toBe(true);
	});
});

function repairDynamicPart(part: DynamicToolUIPart) {
	const priorMessage: WanditUIMessage = {
		id: "prior-assistant",
		parts: [part],
		role: "assistant",
	};
	const tailMessage = userMessage();
	const result = completeDanglingToolCalls([priorMessage, tailMessage]);

	expect(result[1]).toBe(tailMessage);

	return {
		repaired: result[0]?.parts[0] as DynamicToolUIPart,
		result,
	};
}

function repairBuiltInPart(part: WanditUIMessage["parts"][number]) {
	const priorMessage: WanditUIMessage = {
		id: "prior-assistant",
		parts: [part],
		role: "assistant",
	};
	const tailMessage = userMessage();
	const result = completeDanglingToolCalls([priorMessage, tailMessage]);

	expect(result[1]).toBe(tailMessage);

	return result[0]?.parts[0] as {
		input: unknown;
		output: unknown;
		state: string;
	};
}

function deferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (reason?: unknown) => void;
	const promise = new Promise<T>((resolvePromise, rejectPromise) => {
		resolve = resolvePromise;
		reject = rejectPromise;
	});

	return { promise, reject, resolve };
}
