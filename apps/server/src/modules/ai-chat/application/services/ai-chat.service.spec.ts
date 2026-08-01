import { BadRequestException } from "@nestjs/common";
import {
	applyElementOpsInputSchema,
	applyElementOpsOutputSchema,
	askUserOutputSchema,
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

import type { McpChatToolsResult } from "../../../mcp-connectors/application/services/mcp-chat-tools.service";
import type { WanditUIMessage } from "../../agent/chat-agent";
import { AiChatController } from "../../presentation/http/controllers/ai-chat.controller";
import { AiChatService, completeDanglingToolCalls } from "./ai-chat.service";

type AiChatServiceDependencies = ConstructorParameters<typeof AiChatService>;
type CapturedStreamOptions = {
	execute?: (options: {
		writer: { merge: (stream: ReadableStream<unknown>) => void };
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
}: {
	mcpResult?: McpChatToolsResult;
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
	const generationPolicyService = {};
	const mediaGenerationsRepository = {};
	const marketingAssetsRepository = {};
	const imageGenerationsRepository = {};
	const mcpChatToolsService = {
		resolveToolsForUser: vi.fn().mockResolvedValue(mcpResult),
	};
	const service = new AiChatService(
		chatsRepository as unknown as AiChatServiceDependencies[0],
		pagesRepository as unknown as AiChatServiceDependencies[1],
		pageEditsService as unknown as AiChatServiceDependencies[2],
		leadScrapesRepository as unknown as AiChatServiceDependencies[3],
		generationPolicyService as unknown as AiChatServiceDependencies[4],
		mediaGenerationsRepository as unknown as AiChatServiceDependencies[5],
		marketingAssetsRepository as unknown as AiChatServiceDependencies[6],
		imageGenerationsRepository as unknown as AiChatServiceDependencies[7],
		mcpChatToolsService as unknown as AiChatServiceDependencies[8],
	);

	return {
		chatsRepository,
		mcpChatToolsService,
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
		const { chatsRepository, service } = buildService({ mcpResult });

		await service.stream(streamOptions());

		expect(mcpResult.close).not.toHaveBeenCalled();
		expect(chatAgentMocks.createChatAgent).toHaveBeenCalledWith(
			expect.any(Object),
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
		await capturedExecute()({ writer: { merge: vi.fn() } });

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

describe("completeDanglingToolCalls ask_user", () => {
	it("repairs a prior unanswered question as dismissed without mutating transcript messages", () => {
		const pendingPart = {
			input: {
				options: [
					{ id: "option-1", label: "First option" },
					{ id: "option-2", label: "Second option" },
				],
				question: "Which option should I use?",
			},
			state: "input-available",
			toolCallId: "call-ask-user",
			type: "tool-ask_user",
		} satisfies WanditUIMessage["parts"][number];
		const priorMessage: WanditUIMessage = {
			id: "prior-assistant",
			parts: [pendingPart],
			role: "assistant",
		};
		const tailMessage = userMessage();

		const result = completeDanglingToolCalls([priorMessage, tailMessage]);
		const repairedPart = result[0]?.parts[0];

		expect(result[0]).not.toBe(priorMessage);
		expect(repairedPart).toEqual({
			...pendingPart,
			output: { dismissed: true },
			state: "output-available",
		});
		if (
			repairedPart?.type !== "tool-ask_user" ||
			repairedPart.state !== "output-available"
		) {
			throw new Error("Expected a repaired ask_user output");
		}
		expect(askUserOutputSchema.safeParse(repairedPart.output).success).toBe(
			true,
		);
		expect(priorMessage.parts[0]).toBe(pendingPart);
		expect(pendingPart.state).toBe("input-available");
		expect("output" in pendingPart).toBe(false);
		expect(result[1]).toBe(tailMessage);
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
