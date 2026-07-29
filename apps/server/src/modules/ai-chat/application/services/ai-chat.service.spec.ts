import type { DynamicToolUIPart, Tool } from "ai";
import type { FastifyReply } from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

const aiMocks = vi.hoisted(() => ({
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
		createUIMessageStream: aiMocks.createUIMessageStream,
		pipeUIMessageStreamToResponse: aiMocks.pipeUIMessageStreamToResponse,
	};
});

vi.mock("../../agent/chat-agent", () => ({
	createChatAgent: chatAgentMocks.createChatAgent,
}));

import type { McpChatToolsResult } from "../../../mcp-connectors/application/services/mcp-chat-tools.service";
import type { WanditUIMessage } from "../../agent/chat-agent";
import { AiChatService, completeDanglingToolCalls } from "./ai-chat.service";

type AiChatServiceDependencies = ConstructorParameters<typeof AiChatService>;
type CapturedStreamOptions = {
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

function assistantMessage(): WanditUIMessage {
	return {
		id: "assistant-message",
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

describe("AiChatService MCP lifecycle", () => {
	beforeEach(() => {
		vi.resetAllMocks();
		capturedStreamOptions = undefined;
		chatAgentMocks.createChatAgent.mockReturnValue({});
		aiMocks.createUIMessageStream.mockImplementation((options: unknown) => {
			capturedStreamOptions = options as CapturedStreamOptions;
			return {};
		});
		aiMocks.pipeUIMessageStreamToResponse.mockImplementation(() => {});
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

		await capturedOnEnd()({
			isContinuation: true,
			responseMessage: assistantMessage(),
		});

		expect(chatsRepository.upsertUiMessage).toHaveBeenCalledTimes(1);
		expect(chatsRepository.insertUiMessagesIfAbsent).not.toHaveBeenCalled();
		expect(mcpResult.close).toHaveBeenCalledTimes(1);
	});

	it("closes MCP clients when ordinary persistence rejects", async () => {
		const persistenceError = new Error("database unavailable");
		const mcpResult = createMcpResult();
		const { chatsRepository, service } = buildService({ mcpResult });
		chatsRepository.insertUiMessagesIfAbsent.mockRejectedValue(
			persistenceError,
		);
		await service.stream(streamOptions());

		await expect(
			capturedOnEnd()({
				isContinuation: false,
				responseMessage: assistantMessage(),
			}),
		).rejects.toBe(persistenceError);

		expect(chatsRepository.insertUiMessagesIfAbsent).toHaveBeenCalledTimes(1);
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

function deferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (reason?: unknown) => void;
	const promise = new Promise<T>((resolvePromise, rejectPromise) => {
		resolve = resolvePromise;
		reject = rejectPromise;
	});

	return { promise, reject, resolve };
}
