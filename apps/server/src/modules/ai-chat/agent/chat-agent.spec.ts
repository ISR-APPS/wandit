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
import { z } from "zod";
import {
	aiChatToolsForValidation,
	type ChatAgentDeps,
	createChatAgent,
	createChatToolCallRepair,
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

	it("gates video inspection while keeping every history twin", () => {
		createChatAgent({
			availableImages: [],
			availableVideos: [],
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
		expect(tools?.product_video?.execute).toBeTypeOf("function");
		expect(tools?.edit_video?.execute).toBeTypeOf("function");
		expect(tools?.extend_video?.execute).toBeTypeOf("function");
		expect(tools?.inspect_video?.execute).toBeTypeOf("function");
		expect(aiMocks.settings?.instructions).toContain(
			"call inspect_video FIRST",
		);
		expect(aiChatToolsForValidation.product_video.execute).toBeUndefined();
		expect(aiChatToolsForValidation.edit_video.execute).toBeUndefined();
		expect(aiChatToolsForValidation.extend_video.execute).toBeUndefined();
		expect(aiChatToolsForValidation.inspect_video.execute).toBeUndefined();

		createChatAgent({
			availableImages: [],
			availableVideos: [],
			chatId: "chat-1",
			hasHiggsfieldConnector: true,
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

		const connectedTools = aiMocks.settings?.tools as
			| Record<string, Tool>
			| undefined;
		expect(connectedTools).not.toHaveProperty("inspect_video");
		expect(aiMocks.settings?.instructions).not.toContain(
			"call inspect_video FIRST",
		);
		expect(aiChatToolsForValidation.inspect_video).toBeDefined();
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
		// The repair model sees what it sent and why it was rejected.
		const repairMessage = (
			aiMocks.generateObject.mock.calls[0]?.[0] as {
				messages: Array<{ content: string }>;
			}
		).messages.at(-1)?.content;
		expect(repairMessage).toContain(toolCall.input);
		expect(repairMessage).toContain("Unexpected end of JSON input");
		expect(repairMessage).not.toContain("cut off before the JSON closed");

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

	it("names the zod issues and validates the repair with the tool's own schema", async () => {
		const repairedObject = {
			sourceImageUrls: ["https://assets.example.com/uploads/u/a.jpg"],
		};
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

		const repairToolCall = aiMocks.settings
			?.experimental_repairToolCall as ToolCallRepairFunction<
			Record<string, Tool>
		>;
		const schema = z.object({ sourceImageUrls: z.array(z.url()).max(1) });
		const toolInput = JSON.stringify({
			sourceImageUrls: [
				"https://assets.example.com/uploads/u/a.jpg",
				"https://assets.example.com/uploads/u/b.jpg",
			],
		});
		// Real chain: InvalidToolInputError → TypeValidationError → ZodError.
		const zodError = schema.safeParse(JSON.parse(toolInput)).error;
		const error = new InvalidToolInputError({
			cause: Object.assign(new Error("Type validation failed"), {
				cause: zodError,
			}),
			toolInput,
			toolName: "generate_image",
		});
		const inputSchema = vi.fn(async () => ({
			properties: {},
			type: "object" as const,
		}));

		const repaired = await repairToolCall({
			error,
			inputSchema,
			instructions: "You are the Wandit chat agent.",
			messages: [{ content: "Make a product shot", role: "user" as const }],
			system: undefined,
			toolCall: {
				input: toolInput,
				toolCallId: "tool-call-2",
				toolName: "generate_image",
				type: "tool-call" as const,
			},
			tools: { generate_image: { inputSchema } as unknown as Tool },
		});

		expect(repaired?.input).toBe(JSON.stringify(repairedObject));
		// The tool's own schema validates the repair; the SDK-derived JSON
		// document is only the fallback for tools without one.
		expect(inputSchema).not.toHaveBeenCalled();
		const call = aiMocks.generateObject.mock.calls.at(-1)?.[0] as {
			messages: Array<{ content: string }>;
			schema: unknown;
		};
		expect(call.schema).toBe(inputSchema);
		const repairMessage = call.messages.at(-1)?.content ?? "";
		expect(repairMessage).toContain("sourceImageUrls: Too big");
		expect(repairMessage).toContain(toolInput);
		expect(repairMessage).not.toContain("cut off");
	});

	describe("tool-call repair metering", () => {
		const toolCall = {
			input: '{"brief":"cut off',
			toolCallId: "tool-call-1",
			toolName: "generate_page",
			type: "tool-call" as const,
		};
		const repairOptions = {
			inputSchema: vi.fn(async () => ({
				properties: { brief: { type: "string" as const } },
				type: "object" as const,
			})),
			instructions: "You are the Wandit chat agent.",
			messages: [{ content: "Build a landing page", role: "user" as const }],
			system: undefined,
			toolCall,
			tools: {},
		};
		const invalidToolInputError = new InvalidToolInputError({
			cause: new SyntaxError("Unexpected end of JSON input"),
			toolInput: toolCall.input,
			toolName: toolCall.toolName,
		});

		it("captures the repair generation as helper-billable usage on the chat event", async () => {
			aiMocks.generateObject.mockResolvedValueOnce({
				object: { brief: "complete" },
				providerMetadata: { gateway: { generationId: "repair-gen" } },
				usage: { inputTokens: 12, outputTokens: 4 },
			});
			const captureGeneration = vi.fn(async () => undefined);
			const repair = createChatToolCallRepair({
				captureGeneration,
				model: {} as never,
			});

			const repaired = await repair({
				...repairOptions,
				error: invalidToolInputError,
			});

			expect(JSON.parse(repaired?.input ?? "")).toEqual({ brief: "complete" });
			expect(captureGeneration).toHaveBeenCalledWith({
				providerMetadata: { gateway: { generationId: "repair-gen" } },
				stepUsage: {
					metering: {
						customerBilling: "helper_billable",
						task: "tool_call_repair",
					},
					providerUsage: { inputTokens: 12, outputTokens: 4 },
				},
			});
		});

		it("meters the provider call once, at step end, even when the schema rejects the repair", async () => {
			const stepEnd = {
				providerMetadata: { gateway: { generationId: "repair-gen" } },
				usage: { inputTokens: 1200, outputTokens: 6 },
			};
			// The real SDK reports the step BEFORE it validates the object, then
			// throws NoObjectGeneratedError — which carries no generation id.
			aiMocks.generateObject.mockImplementationOnce(
				async (options: {
					onStepEnd?: (event: typeof stepEnd) => Promise<void>;
				}) => {
					await options.onStepEnd?.(stepEnd);
					throw new Error(
						"No object generated: response did not match schema.",
					);
				},
			);
			const captureGeneration = vi.fn(async () => undefined);
			const repair = createChatToolCallRepair({
				captureGeneration,
				model: {} as never,
			});

			const repaired = await repair({
				...repairOptions,
				error: invalidToolInputError,
			});

			expect(repaired).toBeNull();
			expect(captureGeneration).toHaveBeenCalledTimes(1);
			expect(captureGeneration).toHaveBeenCalledWith({
				providerMetadata: stepEnd.providerMetadata,
				stepUsage: {
					metering: {
						customerBilling: "helper_billable",
						task: "tool_call_repair",
					},
					providerUsage: stepEnd.usage,
				},
			});

			// A successful repair reports the same call twice (step end, then
			// the result); it is still captured once.
			aiMocks.generateObject.mockImplementationOnce(
				async (options: {
					onStepEnd?: (event: typeof stepEnd) => Promise<void>;
				}) => {
					await options.onStepEnd?.(stepEnd);
					return { object: { brief: "complete" }, ...stepEnd };
				},
			);
			captureGeneration.mockClear();

			const repairedTwice = await repair({
				...repairOptions,
				error: invalidToolInputError,
			});

			expect(JSON.parse(repairedTwice?.input ?? "")).toEqual({
				brief: "complete",
			});
			expect(captureGeneration).toHaveBeenCalledTimes(1);
		});

		it("keeps the repaired call when the capture fails", async () => {
			aiMocks.generateObject.mockResolvedValueOnce({
				object: { brief: "complete" },
				providerMetadata: { gateway: { generationId: "repair-gen" } },
				usage: null,
			});
			const repair = createChatToolCallRepair({
				captureGeneration: vi.fn(async () => {
					throw new Error("metering down");
				}),
				model: {} as never,
			});

			const repaired = await repair({
				...repairOptions,
				error: invalidToolInputError,
			});

			expect(repaired).not.toBeNull();
		});

		it("wires the capture to the chat event and skips it without one", async () => {
			const captureGeneration = vi
				.fn()
				.mockRejectedValueOnce(new Error("transient"))
				.mockResolvedValueOnce({ id: "ref" });
			const build = (parentEventId: string | undefined) =>
				createChatAgent({
					availableImages: [],
					chatId: "chat-1",
					imageGenerationsRepository: {},
					leadScrapesRepository: {},
					marketingAssetsRepository: {},
					mediaGenerationsRepository: {},
					meteringService: { captureGeneration },
					pageEditsService: {},
					pagesRepository: {},
					parentEventId,
					projectId: "project-1",
					requestCountryCode: null,
					subject: { actorUserId: "user-1" },
					userId: "user-1",
				} as never);

			build("chat-event-1");
			const repair = aiMocks.settings
				?.experimental_repairToolCall as ToolCallRepairFunction<
				Record<string, Tool>
			>;
			aiMocks.generateObject.mockResolvedValueOnce({
				object: { brief: "complete" },
				providerMetadata: { gateway: { generationId: "repair-gen" } },
				usage: null,
			});
			await repair({ ...repairOptions, error: invalidToolInputError });
			// Bounded retry: the transient first failure is retried once.
			expect(captureGeneration).toHaveBeenCalledTimes(2);
			expect(captureGeneration).toHaveBeenLastCalledWith(
				"chat-event-1",
				expect.objectContaining({
					providerMetadata: { gateway: { generationId: "repair-gen" } },
				}),
			);

			captureGeneration.mockClear();
			build(undefined);
			const unbilledRepair = aiMocks.settings
				?.experimental_repairToolCall as ToolCallRepairFunction<
				Record<string, Tool>
			>;
			aiMocks.generateObject.mockResolvedValueOnce({
				object: { brief: "complete" },
				providerMetadata: {},
				usage: null,
			});
			await unbilledRepair({ ...repairOptions, error: invalidToolInputError });
			expect(captureGeneration).not.toHaveBeenCalled();
		});
	});
});
