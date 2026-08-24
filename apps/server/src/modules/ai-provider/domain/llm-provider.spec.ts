import { beforeEach, describe, expect, it, vi } from "vitest";

const mockEnv = vi.hoisted(() => ({
	AI_GATEWAY_API_KEY: "gateway_test" as string | undefined,
	AI_PROVIDER: "vercel" as "openrouter" | "vercel",
	AI_PROVIDER_OVERRIDES: undefined as string | undefined,
	OPENROUTER_API_KEY: "openrouter_test" as string | undefined,
}));

const openrouterMocks = vi.hoisted(() => ({
	chat: vi.fn(),
	createOpenRouter: vi.fn(),
}));

vi.mock("@wandit/env/server", () => ({ env: mockEnv }));

vi.mock("@openrouter/ai-sdk-provider", () => ({
	createOpenRouter: openrouterMocks.createOpenRouter,
}));

import { capturedGenerationRef } from "../../metering/domain/metering";
import {
	createLlmModel,
	fromOpenRouterModelId,
	gatewayRoutingForModel,
	hasLlmProviderKey,
	llmProviderForTask,
	llmProviderKeyName,
	toOpenRouterModelId,
	withLlmAttribution,
} from "./llm-provider";

const CONTEXT = {
	operation: "chat" as const,
	organizationId: null,
	userId: "user-1",
};

type FakeStreamPart = Record<string, unknown> & { type: string };

function fakeOpenRouterModel(parts: FakeStreamPart[]) {
	return {
		doGenerate: vi.fn(async () => ({
			content: [],
			finishReason: "stop",
			providerMetadata: { openrouter: { usage: { cost: 0.5 } } },
			response: { id: "gen-abc123" },
			usage: { inputTokens: 1, outputTokens: 2, totalTokens: 3 },
			warnings: [],
		})),
		doStream: vi.fn(async () => ({
			stream: new ReadableStream<FakeStreamPart>({
				start(controller) {
					for (const part of parts) {
						controller.enqueue(part);
					}
					controller.close();
				},
			}),
		})),
		modelId: "x-ai/grok-4.5",
		provider: "openrouter",
		specificationVersion: "v4" as const,
		supportedUrls: {},
	};
}

async function collectStream<T>(stream: ReadableStream<T>): Promise<T[]> {
	const parts: T[] = [];

	for await (const part of stream as unknown as AsyncIterable<T>) {
		parts.push(part);
	}

	return parts;
}

beforeEach(() => {
	mockEnv.AI_PROVIDER = "vercel";
	mockEnv.AI_PROVIDER_OVERRIDES = undefined;
	mockEnv.AI_GATEWAY_API_KEY = "gateway_test";
	mockEnv.OPENROUTER_API_KEY = "openrouter_test";
	openrouterMocks.chat.mockReset();
	openrouterMocks.createOpenRouter.mockReset();
	openrouterMocks.createOpenRouter.mockReturnValue({
		chat: openrouterMocks.chat,
	});
});

describe("model id translation", () => {
	it("swaps the divergent creator prefixes both ways", () => {
		expect(toOpenRouterModelId("xai/grok-4.5")).toBe("x-ai/grok-4.5");
		expect(toOpenRouterModelId("meta/muse-spark-1.1")).toBe(
			"meta-llama/muse-spark-1.1",
		);
		expect(toOpenRouterModelId("mistral/mistral-large")).toBe(
			"mistralai/mistral-large",
		);
		expect(toOpenRouterModelId("alibaba/qwen3.7-plus")).toBe(
			"qwen/qwen3.7-plus",
		);
		expect(toOpenRouterModelId("zai/glm-4.6")).toBe("z-ai/glm-4.6");
		expect(toOpenRouterModelId("stepfun/step-3.7-flash")).toBe(
			"stepfun-ai/step-3.7-flash",
		);
		expect(fromOpenRouterModelId("x-ai/grok-4.5")).toBe("xai/grok-4.5");
		expect(fromOpenRouterModelId("meta-llama/muse-spark-1.1")).toBe(
			"meta/muse-spark-1.1",
		);
		expect(fromOpenRouterModelId("qwen/qwen3.7-plus")).toBe(
			"alibaba/qwen3.7-plus",
		);
		expect(fromOpenRouterModelId("z-ai/glm-4.6")).toBe("zai/glm-4.6");
		expect(fromOpenRouterModelId("stepfun-ai/step-3.7-flash")).toBe(
			"stepfun/step-3.7-flash",
		);
	});

	it("passes matching catalogs through unchanged", () => {
		for (const id of [
			"openai/gpt-5.6-terra",
			"anthropic/claude-sonnet-5",
			"google/gemini-3.6-flash",
			"deepseek/deepseek-v4-flash",
			"moonshotai/kimi-k3-fast",
		]) {
			expect(toOpenRouterModelId(id)).toBe(id);
			expect(fromOpenRouterModelId(id)).toBe(id);
		}
	});
});

describe("provider key gate", () => {
	it("gates on the gateway key for vercel", () => {
		expect(hasLlmProviderKey("chat")).toBe(true);
		expect(llmProviderKeyName("chat")).toBe("AI_GATEWAY_API_KEY");
		mockEnv.AI_GATEWAY_API_KEY = undefined;
		expect(hasLlmProviderKey("chat")).toBe(false);
	});

	it("gates on the OpenRouter key when active", () => {
		mockEnv.AI_PROVIDER = "openrouter";
		mockEnv.AI_GATEWAY_API_KEY = undefined;
		expect(hasLlmProviderKey("chat")).toBe(true);
		expect(llmProviderKeyName("chat")).toBe("OPENROUTER_API_KEY");
		mockEnv.OPENROUTER_API_KEY = undefined;
		expect(hasLlmProviderKey("chat")).toBe(false);
	});

	it("gates each task on its own provider's key", () => {
		mockEnv.AI_PROVIDER_OVERRIDES = "page_build=openrouter";
		mockEnv.OPENROUTER_API_KEY = undefined;

		expect(hasLlmProviderKey("chat")).toBe(true);
		expect(hasLlmProviderKey("page_build")).toBe(false);
		expect(llmProviderKeyName("page_build")).toBe("OPENROUTER_API_KEY");
	});
});

describe("per-task provider overrides", () => {
	it("routes only the named task away from the default", () => {
		mockEnv.AI_PROVIDER_OVERRIDES = "page_build=openrouter";

		expect(llmProviderForTask("page_build")).toBe("openrouter");
		expect(llmProviderForTask("chat")).toBe("vercel");
		expect(llmProviderForTask("marketing")).toBe("vercel");
	});

	it("routes a task back to vercel when openrouter is the default", () => {
		mockEnv.AI_PROVIDER = "openrouter";
		mockEnv.AI_PROVIDER_OVERRIDES = "project_title=vercel";

		expect(llmProviderForTask("project_title")).toBe("vercel");
		expect(llmProviderForTask("chat")).toBe("openrouter");
	});

	it("reads several entries and tolerates spaces", () => {
		mockEnv.AI_PROVIDER_OVERRIDES =
			" page_build = openrouter , prompt_refine=openrouter ";

		expect(llmProviderForTask("page_build")).toBe("openrouter");
		expect(llmProviderForTask("prompt_refine")).toBe("openrouter");
		expect(llmProviderForTask("chat")).toBe("vercel");
	});

	it("ignores invalid entries instead of misrouting", () => {
		// The env schema rejects these at boot; with validation skipped the
		// task must fall back to AI_PROVIDER.
		mockEnv.AI_PROVIDER_OVERRIDES =
			"builder=openrouter,image=openrouter,page_build=upstream";

		expect(llmProviderForTask("page_build")).toBe("vercel");
		expect(llmProviderForTask("chat")).toBe("vercel");
	});

	it("re-reads the overrides when the env value changes", () => {
		mockEnv.AI_PROVIDER_OVERRIDES = "chat=openrouter";
		expect(llmProviderForTask("chat")).toBe("openrouter");

		mockEnv.AI_PROVIDER_OVERRIDES = undefined;
		expect(llmProviderForTask("chat")).toBe("vercel");
	});

	it("builds each task's model on that task's provider", () => {
		mockEnv.AI_PROVIDER_OVERRIDES = "page_build=openrouter";
		openrouterMocks.chat.mockReturnValue(fakeOpenRouterModel([]));

		expect(
			createLlmModel("openai/gpt-5.6-terra", {
				context: CONTEXT,
				task: "chat",
			}),
		).toBe("openai/gpt-5.6-terra");

		createLlmModel("xai/grok-4.5", {
			context: { ...CONTEXT, operation: "page_build" as const },
			task: "page_build",
		});

		expect(openrouterMocks.chat).toHaveBeenCalledWith("x-ai/grok-4.5", {
			user: "user-1",
		});
	});

	it("applies attribution by the task's provider, not the default", () => {
		mockEnv.AI_PROVIDER_OVERRIDES = "page_build=openrouter";
		const vendorOptions = { openai: { reasoningEffort: "high" } };

		expect(withLlmAttribution(vendorOptions, CONTEXT, "page_build")).toBe(
			vendorOptions,
		);
		expect(withLlmAttribution(vendorOptions, CONTEXT, "chat")).toMatchObject({
			gateway: { user: "user-1" },
		});
	});
});

describe("attribution options", () => {
	it("keeps the mandatory gateway attribution on vercel", () => {
		const options = withLlmAttribution(
			{ openai: { reasoningEffort: "low" } },
			CONTEXT,
			"chat",
		);

		expect(options).toEqual({
			gateway: { tags: ["op:chat", "ws:personal"], user: "user-1" },
			openai: { reasoningEffort: "low" },
		});
	});

	it("passes options through untouched on openrouter", () => {
		mockEnv.AI_PROVIDER = "openrouter";
		const vendorOptions = { openai: { reasoningEffort: "low" } };

		expect(withLlmAttribution(vendorOptions, CONTEXT, "chat")).toBe(
			vendorOptions,
		);
	});
});

describe("gateway routing pin", () => {
	it("pins openai models to the OpenAI provider only", () => {
		expect(gatewayRoutingForModel("openai/gpt-5.6-terra")).toEqual({
			only: ["openai"],
		});
	});

	it("leaves other creators on the gateway's default routing", () => {
		expect(gatewayRoutingForModel("xai/grok-4.5")).toEqual({});
		expect(gatewayRoutingForModel("anthropic/claude-opus-5")).toEqual({});
	});

	it("survives attribution on vercel", () => {
		const options = withLlmAttribution(
			{ gateway: gatewayRoutingForModel("openai/gpt-5.6-terra") },
			CONTEXT,
			"chat",
		);

		expect(options).toEqual({
			gateway: {
				only: ["openai"],
				tags: ["op:chat", "ws:personal"],
				user: "user-1",
			},
		});
	});
});

describe("createLlmModel on vercel", () => {
	it("returns the bare model id so the default provider resolves it", () => {
		expect(
			createLlmModel("openai/gpt-5.6-terra", {
				context: CONTEXT,
				task: "chat",
			}),
		).toBe("openai/gpt-5.6-terra");
	});

	it("builds an explicit gateway model when a custom fetch travels along", () => {
		const model = createLlmModel("openai/gpt-5.6-terra", {
			context: CONTEXT,
			fetch: (() => {
				throw new Error("never dispatched in this test");
			}) as unknown as typeof fetch,
			task: "chat",
		});

		expect(model).toMatchObject({ modelId: "openai/gpt-5.6-terra" });
	});
});

describe("createLlmModel on openrouter", () => {
	beforeEach(() => {
		mockEnv.AI_PROVIDER = "openrouter";
	});

	it("translates the slug and carries attribution + knobs as settings", () => {
		openrouterMocks.chat.mockReturnValue(fakeOpenRouterModel([]));

		createLlmModel("xai/grok-4.5", {
			context: CONTEXT,
			reasoningEffort: "high",
			routingOrder: ["novita"],
			task: "chat",
		});

		expect(openrouterMocks.createOpenRouter).toHaveBeenCalledWith({
			apiKey: "openrouter_test",
		});
		expect(openrouterMocks.chat).toHaveBeenCalledWith("x-ai/grok-4.5", {
			provider: { order: ["novita"] },
			reasoning: { effort: "high" },
			user: "user-1",
		});
	});

	it("copies the response id into providerMetadata for one-shot calls", async () => {
		const inner = fakeOpenRouterModel([]);
		openrouterMocks.chat.mockReturnValue(inner);

		const model = createLlmModel("openai/gpt-5.6-terra", {
			context: CONTEXT,
			task: "chat",
		});
		const result = await (
			model as unknown as {
				doGenerate: (options: unknown) => Promise<never>;
			}
		).doGenerate({ prompt: [] });

		expect(result).toMatchObject({
			providerMetadata: {
				openrouter: { generationId: "gen-abc123", usage: { cost: 0.5 } },
			},
		});
	});

	it("copies the streamed response id onto the finish part", async () => {
		const inner = fakeOpenRouterModel([
			{ id: "gen-stream-1", type: "response-metadata" },
			{ textDelta: "hi", type: "text-delta" },
			{
				finishReason: "stop",
				type: "finish",
				usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
			},
		]);
		openrouterMocks.chat.mockReturnValue(inner);

		const model = createLlmModel("openai/gpt-5.6-terra", {
			context: CONTEXT,
			task: "chat",
		});
		const { stream } = await (
			model as unknown as {
				doStream: (
					options: unknown,
				) => Promise<{ stream: ReadableStream<FakeStreamPart> }>;
			}
		).doStream({ prompt: [] });
		const parts = await collectStream(stream);
		const finish = parts.find((part) => part.type === "finish");

		expect(finish).toMatchObject({
			providerMetadata: { openrouter: { generationId: "gen-stream-1" } },
		});
	});

	it("tags provider-emitted error parts with the generation id", async () => {
		const streamError = new Error("provider mid-stream failure");
		const inner = fakeOpenRouterModel([
			{ id: "gen-stream-err", type: "response-metadata" },
			{ error: streamError, type: "error" },
		]);
		openrouterMocks.chat.mockReturnValue(inner);

		const model = createLlmModel("openai/gpt-5.6-terra", {
			context: CONTEXT,
			task: "chat",
		});
		const { stream } = await (
			model as unknown as {
				doStream: (
					options: unknown,
				) => Promise<{ stream: ReadableStream<FakeStreamPart> }>;
			}
		).doStream({ prompt: [] });
		await collectStream(stream);

		expect(streamError).toMatchObject({
			openrouterGenerationId: "gen-stream-err",
		});
	});

	it("tags transport failures so a dead stream still exposes the id", async () => {
		const inner = fakeOpenRouterModel([]);
		// Deliver the metadata part on the first pull, then die on the next —
		// erroring with chunks still queued would discard them (streams spec),
		// which is not how a mid-flight socket death behaves.
		let pulls = 0;
		inner.doStream = vi.fn(async () => ({
			stream: new ReadableStream<FakeStreamPart>({
				pull(controller) {
					pulls += 1;

					if (pulls === 1) {
						controller.enqueue({ id: "gen-dead", type: "response-metadata" });
						return;
					}

					controller.error(new Error("socket died"));
				},
			}),
		}));
		openrouterMocks.chat.mockReturnValue(inner);

		const model = createLlmModel("openai/gpt-5.6-terra", {
			context: CONTEXT,
			task: "chat",
		});
		const { stream } = await (
			model as unknown as {
				doStream: (
					options: unknown,
				) => Promise<{ stream: ReadableStream<FakeStreamPart> }>;
			}
		).doStream({ prompt: [] });
		const caught = await collectStream(stream).then(
			() => null,
			(error: unknown) => error,
		);

		expect(caught).toMatchObject({
			message: "socket died",
			openrouterGenerationId: "gen-dead",
		});
	});
});

describe("capturedGenerationRef", () => {
	it("reads vercel gateway metadata", () => {
		expect(
			capturedGenerationRef({ gateway: { generationId: "gen_ulid" } }),
		).toEqual({ generationId: "gen_ulid", source: "vercel" });
	});

	it("reads the openrouter metadata the model wrapper writes", () => {
		expect(
			capturedGenerationRef({ openrouter: { generationId: "gen-abc123" } }),
		).toEqual({ generationId: "gen-abc123", source: "openrouter" });
	});

	it("returns null when neither provider exposed an id", () => {
		expect(capturedGenerationRef(undefined)).toBeNull();
		expect(capturedGenerationRef({})).toBeNull();
		expect(capturedGenerationRef({ openrouter: { usage: {} } })).toBeNull();
		expect(
			capturedGenerationRef({ openrouter: { generationId: "" } }),
		).toBeNull();
	});
});
