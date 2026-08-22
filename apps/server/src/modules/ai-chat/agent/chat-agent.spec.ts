import { beforeEach, describe, expect, it, vi } from "vitest";

const aiMocks = vi.hoisted(() => ({
	generateObject: vi.fn(),
	settings: undefined as Record<string, unknown> | undefined,
	stopCondition: { maxSteps: 12 },
}));

vi.mock("ai", async (importOriginal) => {
	const actual = await importOriginal<typeof import("ai")>();

	return {
		...actual,
		generateObject: aiMocks.generateObject,
		isStepCount: vi.fn(() => aiMocks.stopCondition),
		ToolLoopAgent: class ToolLoopAgent {
			constructor(settings: Record<string, unknown>) {
				aiMocks.settings = settings;
			}
		},
	};
});

// Tool construction is the subject here; loading Trigger's HTTP client adds
// an unrelated Undici runtime to this unit spec.
vi.mock("@trigger.dev/sdk", () => ({
	auth: {},
	idempotencyKeys: {},
	tasks: {},
}));

vi.mock("../../ai-provider/domain/llm-provider", () => ({
	createLlmModel: vi.fn(() => "mock/model"),
	withLlmAttribution: (
		providerOptions: Record<string, unknown>,
		context: {
			operation: string;
			organizationId: string | null;
			userId: string;
		},
	) => ({
		...providerOptions,
		gateway: {
			tags: [
				`op:${context.operation}`,
				context.organizationId ? "ws:org" : "ws:personal",
			],
			user: context.userId,
		},
	}),
}));

vi.mock("./tools/edit-video.tool", () => ({
	createEditVideoTool: vi.fn(() => ({ execute: vi.fn() })),
	editVideoToolSchemaOnly: {},
}));

vi.mock("./tools/extend-video.tool", () => ({
	createExtendVideoTool: vi.fn(() => ({ execute: vi.fn() })),
	extendVideoToolSchemaOnly: {},
}));

vi.mock("./gateway-fetch", () => ({
	chatGatewayFetch: vi.fn(),
}));

import {
	InvalidToolInputError,
	NoSuchToolError,
	type Tool,
	type ToolCallRepairFunction,
} from "ai";
import {
	aiChatToolsForValidation,
	type ChatAgentDeps,
	createChatAgent,
} from "./chat-agent";
import { AI_CHAT_MAX_OUTPUT_TOKENS, AI_CHAT_MAX_STEPS } from "./chat-metering";

type HasRetiredComposerQuality = "quality" extends keyof ChatAgentDeps
	? true
	: false;

const HAS_RETIRED_COMPOSER_QUALITY: HasRetiredComposerQuality = false;

describe("chat agent cost bounds and gateway attribution", () => {
	beforeEach(() => {
		aiMocks.generateObject.mockReset();
		aiMocks.settings = undefined;
	});

	it("does not expose the retired composer quality dependency", () => {
		expect(HAS_RETIRED_COMPOSER_QUALITY).toBe(false);
	});

	it("sets explicit output, step, and per-user gateway bounds", () => {
		createChatAgent({
			availableImages: [],
			chatId: "chat-1",
			imageGenerationsRepository: {},
			leadScrapesRepository: {},
			marketingAssetsRepository: {},
			mediaGenerationsRepository: {},
			meteringService: {},
			pageEditsService: {},
			pagesRepository: {},
			projectId: "project-1",
			requestCountryCode: null,
			subject: { actorUserId: "user-1" },
			userId: "user-1",
		} as never);

		expect(aiMocks.settings).toMatchObject({
			maxOutputTokens: AI_CHAT_MAX_OUTPUT_TOKENS,
			providerOptions: {
				gateway: {
					tags: ["op:chat", "ws:personal"],
					user: "user-1",
				},
			},
			stopWhen: aiMocks.stopCondition,
		});
		expect(AI_CHAT_MAX_OUTPUT_TOKENS).toBe(16_000);
		expect(AI_CHAT_MAX_STEPS).toBe(12);
	});

	it("registers edit and extension tools with execute-less history twins", () => {
		createChatAgent({
			availableImages: [],
			chatId: "chat-1",
			imageGenerationsRepository: {},
			leadScrapesRepository: {},
			marketingAssetsRepository: {},
			mediaGenerationsRepository: {},
			meteringService: {},
			pageEditsService: {},
			pagesRepository: {},
			projectId: "project-1",
			requestCountryCode: null,
			subject: { actorUserId: "user-1" },
			userId: "user-1",
		} as never);

		const tools = aiMocks.settings?.tools as Record<string, Tool> | undefined;
		expect(tools?.edit_video?.execute).toBeTypeOf("function");
		expect(tools?.extend_video?.execute).toBeTypeOf("function");
		expect(aiChatToolsForValidation.edit_video.execute).toBeUndefined();
		expect(aiChatToolsForValidation.extend_video.execute).toBeUndefined();
	});

	it("repairs invalid tool input and safely declines unrecoverable calls", async () => {
		const repairedObject = { brief: "A complete page brief" };
		aiMocks.generateObject.mockResolvedValueOnce({ object: repairedObject });

		createChatAgent({
			availableImages: [],
			chatId: "chat-1",
			imageGenerationsRepository: {},
			leadScrapesRepository: {},
			marketingAssetsRepository: {},
			mediaGenerationsRepository: {},
			meteringService: {},
			pageEditsService: {},
			pagesRepository: {},
			projectId: "project-1",
			requestCountryCode: null,
			subject: { actorUserId: "user-1" },
			userId: "user-1",
		} as never);

		const repairToolCall = aiMocks.settings?.experimental_repairToolCall as
			| ToolCallRepairFunction<Record<string, Tool>>
			| undefined;
		expect(repairToolCall).toBeTypeOf("function");
		if (!repairToolCall) {
			throw new Error("Chat tool-call repair was not configured");
		}

		const toolCall = {
			input: '{"brief":"cut off',
			toolCallId: "tool-call-1",
			toolName: "generate_page",
			type: "tool-call" as const,
		};
		const inputSchema = vi.fn(async () => ({
			properties: { brief: { type: "string" as const } },
			type: "object" as const,
		}));
		const invalidToolInputError = new InvalidToolInputError({
			cause: new SyntaxError("Unexpected end of JSON input"),
			toolInput: toolCall.input,
			toolName: toolCall.toolName,
		});
		const repairOptions = {
			inputSchema,
			instructions: "You are the Wandit chat agent.",
			messages: [{ content: "Build a landing page", role: "user" as const }],
			system: undefined,
			toolCall,
			tools: {},
		};

		const repaired = await repairToolCall({
			...repairOptions,
			error: invalidToolInputError,
		});
		expect(repaired).toMatchObject({
			toolCallId: toolCall.toolCallId,
			toolName: toolCall.toolName,
			type: "tool-call",
		});
		expect(JSON.parse(repaired?.input ?? "")).toEqual(repairedObject);
		expect(inputSchema).toHaveBeenCalledWith({
			toolName: toolCall.toolName,
		});
		expect(aiMocks.generateObject).toHaveBeenCalledWith(
			expect.objectContaining({
				instructions: repairOptions.instructions,
				maxOutputTokens: 16_000,
				messages: expect.arrayContaining([
					expect.objectContaining({
						content: expect.stringContaining("COMPLETE arguments"),
						role: "user",
					}),
				]),
				model: aiMocks.settings?.model,
			}),
		);

		const unknownTool = await repairToolCall({
			...repairOptions,
			error: new NoSuchToolError({ toolName: "unknown_tool" }),
		});
		expect(unknownTool).toBeNull();
		expect(aiMocks.generateObject).toHaveBeenCalledTimes(1);

		aiMocks.generateObject.mockRejectedValueOnce(new Error("repair failed"));
		const failedRepair = await repairToolCall({
			...repairOptions,
			error: invalidToolInputError,
		});
		expect(failedRepair).toBeNull();
	});
});
