import { Logger } from "@nestjs/common";
import { generateText } from "ai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	HIGGSFIELD_PROMPT_REFINER_PROMPT,
	HiggsfieldPromptRefinerService,
} from "./higgsfield-prompt-refiner.service";

const mockEnv = vi.hoisted(() => ({
	AI_GATEWAY_API_KEY: "gateway_test" as string | undefined,
	AI_PROMPT_REFINER_MODEL: "test-provider/refiner-model" as string | undefined,
}));

vi.mock("@wandit/env/server", () => ({ env: mockEnv }));

vi.mock("ai", () => ({
	generateText: vi.fn(),
}));

const REFINED_PROMPT =
	"A sunlit studio product photo of a matte ceramic vase, soft rim light, shallow depth of field";

function setup() {
	const meteringService = {
		captureGeneration: vi.fn(
			async (): Promise<{ id: string } | null> => ({ id: "generation_ref_1" }),
		),
	};

	return {
		meteringService,
		service: new HiggsfieldPromptRefinerService(meteringService as never),
	};
}

function mockRefinement(text: string): void {
	vi.mocked(generateText).mockResolvedValue({
		providerMetadata: { gateway: { generationId: "generation_1" } },
		text,
		usage: { inputTokens: 40, outputTokens: 60 },
	} as unknown as Awaited<ReturnType<typeof generateText>>);
}

function refineImage(
	service: HiggsfieldPromptRefinerService,
	args: unknown,
): Promise<unknown> {
	return service.refineGenerationArgs({
		args,
		organizationId: null,
		parentEventId: "usage_event_1",
		toolName: "generate_image",
		userId: "user_1",
	});
}

beforeEach(() => {
	vi.mocked(generateText).mockReset();
	mockEnv.AI_GATEWAY_API_KEY = "gateway_test";
	mockEnv.AI_PROMPT_REFINER_MODEL = "test-provider/refiner-model";
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe("HiggsfieldPromptRefinerService", () => {
	it("rewrites the prompt inside an object params and preserves every sibling key", async () => {
		mockRefinement(REFINED_PROMPT);
		const { service } = setup();

		await expect(
			refineImage(service, {
				params: {
					aspect_ratio: "16:9",
					count: 3,
					medias: ["https://cdn.example.com/source.png"],
					model: "seedream",
					prompt: "a vase",
				},
			}),
		).resolves.toEqual({
			params: {
				aspect_ratio: "16:9",
				count: 3,
				medias: ["https://cdn.example.com/source.png"],
				model: "seedream",
				prompt: REFINED_PROMPT,
			},
		});
		expect(generateText).toHaveBeenCalledWith(
			expect.objectContaining({
				maxOutputTokens: 600,
				model: "test-provider/refiner-model",
				prompt: "Medium: image\nTarget model: seedream\nUser request:\na vase",
				providerOptions: {
					gateway: {
						tags: ["op:chat", "ws:personal"],
						user: "user_1",
					},
					openai: { reasoningEffort: "medium" },
				},
				system: HIGGSFIELD_PROMPT_REFINER_PROMPT,
			}),
		);
	});

	it("names the medium and target model of a video generation", async () => {
		mockRefinement(REFINED_PROMPT);
		const { service } = setup();

		await service.refineGenerationArgs({
			args: { params: { prompt: "a launch film" } },
			organizationId: "org_1",
			parentEventId: undefined,
			toolName: "generate_video",
			userId: "user_1",
		});

		expect(generateText).toHaveBeenCalledWith(
			expect.objectContaining({
				prompt:
					"Medium: video\nTarget model: unknown\nUser request:\na launch film",
				providerOptions: {
					gateway: {
						tags: ["op:chat", "ws:org"],
						user: "user_1",
					},
					openai: { reasoningEffort: "medium" },
				},
			}),
		);
	});

	it("rewrites through a JSON-string params and re-stringifies the other keys", async () => {
		mockRefinement(REFINED_PROMPT);
		const { service } = setup();

		await expect(
			refineImage(service, {
				params: JSON.stringify({
					count: 2,
					model: "seedream",
					prompt: "a vase",
				}),
			}),
		).resolves.toEqual({
			params: JSON.stringify({
				count: 2,
				model: "seedream",
				prompt: REFINED_PROMPT,
			}),
		});
	});

	it("rewrites a top-level prompt when no params property exists", async () => {
		mockRefinement(REFINED_PROMPT);
		const { service } = setup();

		await expect(
			refineImage(service, { count: 2, prompt: "a vase" }),
		).resolves.toEqual({ count: 2, prompt: REFINED_PROMPT });
	});

	it("returns the original arguments untouched when no prompt is present", async () => {
		const { service } = setup();
		const args = { params: { medias: ["https://cdn.example.com/source.png"] } };

		await expect(refineImage(service, args)).resolves.toBe(args);
		expect(generateText).not.toHaveBeenCalled();
	});

	it("returns the original arguments when a JSON-string params cannot be parsed", async () => {
		const { service } = setup();
		const args = { params: "{not json" };

		await expect(refineImage(service, args)).resolves.toBe(args);
		expect(generateText).not.toHaveBeenCalled();
	});

	it("returns the original arguments when the provider fails", async () => {
		vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
		vi.mocked(generateText).mockRejectedValue(new Error("gateway timeout"));
		const { service } = setup();
		const args = { params: { prompt: "a vase" } };

		await expect(refineImage(service, args)).resolves.toBe(args);
	});

	it("returns the original arguments when the model answers with whitespace", async () => {
		vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
		mockRefinement("   \n  ");
		const { service } = setup();
		const args = { params: { prompt: "a vase" } };

		await expect(refineImage(service, args)).resolves.toBe(args);
	});

	it("skips refinement when the gateway key is missing", async () => {
		const warn = vi
			.spyOn(Logger.prototype, "warn")
			.mockImplementation(() => undefined);
		mockEnv.AI_GATEWAY_API_KEY = undefined;
		const { service } = setup();
		const args = { params: { prompt: "a vase" } };

		await expect(refineImage(service, args)).resolves.toBe(args);
		expect(generateText).not.toHaveBeenCalled();
		expect(warn).toHaveBeenCalledWith(
			"Higgsfield prompt refinement skipped: AI provider is not configured",
		);
	});

	it("captures the generation reference as bundled unmetered usage", async () => {
		mockRefinement(REFINED_PROMPT);
		const { meteringService, service } = setup();

		await refineImage(service, { params: { prompt: "a vase" } });

		expect(meteringService.captureGeneration).toHaveBeenCalledWith(
			"usage_event_1",
			{
				providerMetadata: { gateway: { generationId: "generation_1" } },
				stepUsage: {
					metering: {
						customerBilling: "bundled_unmetered",
						operation: "prompt_refine",
					},
					providerUsage: { inputTokens: 40, outputTokens: 60 },
				},
			},
		);
	});

	it("skips capture entirely without a parent event", async () => {
		mockRefinement(REFINED_PROMPT);
		const { meteringService, service } = setup();

		await expect(
			service.refineGenerationArgs({
				args: { params: { prompt: "a vase" } },
				organizationId: null,
				parentEventId: undefined,
				toolName: "generate_image",
				userId: "user_1",
			}),
		).resolves.toEqual({ params: { prompt: REFINED_PROMPT } });
		expect(meteringService.captureGeneration).not.toHaveBeenCalled();
	});

	it("keeps the original arguments when reference capture remains unavailable", async () => {
		vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
		mockRefinement(REFINED_PROMPT);
		const { meteringService, service } = setup();
		meteringService.captureGeneration.mockRejectedValue(
			new Error("database unavailable"),
		);
		const args = { params: { prompt: "a vase" } };

		await expect(refineImage(service, args)).resolves.toBe(args);
		expect(generateText).toHaveBeenCalledTimes(1);
		expect(meteringService.captureGeneration).toHaveBeenCalledTimes(3);
	});
});
