import { Logger } from "@nestjs/common";
import { generateText } from "ai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	HIGGSFIELD_EDIT_MODEL,
	HIGGSFIELD_MULTISHOT_AUDIO_MODEL,
} from "../../domain/higgsfield-models";
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
const DIRECTED_PROMPT =
	"Slow dolly-in on a matte ceramic vase as morning light sweeps across it, settling into a hero close-up";

function setup() {
	const meteringService = {
		captureGeneration: vi.fn(
			async (): Promise<{ id: string } | null> => ({ id: "generation_ref_1" }),
		),
	};
	const videoDirector = {
		craftConnectorVideoPrompt: vi.fn(async () => ({
			directed: true,
			negativePrompt: "no text",
			prompt: DIRECTED_PROMPT,
		})),
	};

	return {
		meteringService,
		service: new HiggsfieldPromptRefinerService(
			meteringService as never,
			videoDirector as never,
		),
		videoDirector,
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

	it("routes a video generation through the ONE creative director, never the generic refiner", async () => {
		const { service, videoDirector } = setup();

		await expect(
			service.refineGenerationArgs({
				args: {
					params: {
						aspect_ratio: "9:16",
						duration: 6,
						model: HIGGSFIELD_MULTISHOT_AUDIO_MODEL,
						prompt: "SUBJECT: a serum bottle… KEY MOMENT: the drop lands…",
					},
				},
				organizationId: "org_1",
				parentEventId: "usage_event_1",
				toolName: "generate_video",
				userId: "user_1",
			}),
		).resolves.toEqual({
			params: {
				aspect_ratio: "9:16",
				duration: 6,
				model: HIGGSFIELD_MULTISHOT_AUDIO_MODEL,
				prompt: DIRECTED_PROMPT,
			},
		});

		expect(videoDirector.craftConnectorVideoPrompt).toHaveBeenCalledWith({
			aspect: "9:16",
			brief: "SUBJECT: a serum bottle… KEY MOMENT: the drop lands…",
			durationSeconds: 6,
			model: HIGGSFIELD_MULTISHOT_AUDIO_MODEL,
			organizationId: "org_1",
			parentEventId: "usage_event_1",
			userId: "user_1",
		});
		expect(generateText).not.toHaveBeenCalled();
	});

	it("leaves a mode-marked connected video edit unchanged", async () => {
		const { service, videoDirector } = setup();
		const args = {
			request_id: "edit-request-1",
			params: {
				aspect_ratio: "16:9",
				medias: [{ role: "source_video", value: "media-video-1" }],
				mode: "video_edit",
				model: HIGGSFIELD_EDIT_MODEL,
				prompt: "Replace the red mug with a blue mug; keep everything else.",
				seed: 42,
			},
		};

		await expect(
			service.refineGenerationArgs({
				args,
				organizationId: "org_1",
				parentEventId: "usage_event_1",
				toolName: "generate_video",
				userId: "user_1",
			}),
		).resolves.toBe(args);
		expect(videoDirector.craftConnectorVideoPrompt).not.toHaveBeenCalled();
		expect(generateText).not.toHaveBeenCalled();
	});

	it("recognizes a video-reference role spelling without an edit mode", async () => {
		const { service, videoDirector } = setup();
		const args = {
			params: JSON.stringify({
				medias: [{ role: "Video-Reference", value: "media-video-1" }],
				model: HIGGSFIELD_EDIT_MODEL,
				prompt: "Make the jacket green and preserve the rest.",
				use_unlim: false,
			}),
		};

		await expect(
			service.refineGenerationArgs({
				args,
				organizationId: null,
				parentEventId: undefined,
				toolName: "generate_video",
				userId: "user_1",
			}),
		).resolves.toBe(args);
		expect(videoDirector.craftConnectorVideoPrompt).not.toHaveBeenCalled();
		expect(generateText).not.toHaveBeenCalled();
	});

	it("forwards connector narration fields and preserves every sibling parameter", async () => {
		const { service, videoDirector } = setup();

		await expect(
			service.refineGenerationArgs({
				args: {
					request_id: "request-1",
					params: {
						aspect_ratio: "9:16",
						duration: 10,
						generate_audio: true,
						medias: [{ role: "audio", value: "media-9" }],
						model: HIGGSFIELD_MULTISHOT_AUDIO_MODEL,
						prompt: "SUBJECT: a shoe moves through a quiet dawn street.",
						talking: false,
						use_unlim: false,
						voiceoverLanguage: "fr",
						voiceoverScript: "Chaque pas devient plus léger.",
					},
				},
				organizationId: "org_1",
				parentEventId: "usage_event_1",
				toolName: "generate_video",
				userId: "user_1",
			}),
		).resolves.toEqual({
			request_id: "request-1",
			params: {
				aspect_ratio: "9:16",
				duration: 10,
				generate_audio: true,
				medias: [{ role: "audio", value: "media-9" }],
				model: HIGGSFIELD_MULTISHOT_AUDIO_MODEL,
				prompt: DIRECTED_PROMPT,
				talking: false,
				use_unlim: false,
				voiceoverLanguage: "fr",
				voiceoverScript: "Chaque pas devient plus léger.",
			},
		});

		expect(videoDirector.craftConnectorVideoPrompt).toHaveBeenCalledWith({
			aspect: "9:16",
			brief: "SUBJECT: a shoe moves through a quiet dawn street.",
			durationSeconds: 10,
			model: HIGGSFIELD_MULTISHOT_AUDIO_MODEL,
			organizationId: "org_1",
			parentEventId: "usage_event_1",
			talking: false,
			userId: "user_1",
			voiceoverLanguage: "fr",
			voiceoverScript: "Chaque pas devient plus léger.",
		});
	});

	it("tells the director when the video call carries reference media", async () => {
		const { service, videoDirector } = setup();

		await service.refineGenerationArgs({
			args: {
				params: {
					medias: [{ role: "start_image", value: "media-1" }],
					model: HIGGSFIELD_MULTISHOT_AUDIO_MODEL,
					prompt: "slow dolly push-in on the serum bottle as light blooms",
				},
			},
			organizationId: null,
			parentEventId: undefined,
			toolName: "generate_video",
			userId: "user_1",
		});

		expect(videoDirector.craftConnectorVideoPrompt).toHaveBeenCalledWith(
			expect.objectContaining({ referenceMediaCount: 1 }),
		);
	});

	it("carries the reference-media flag through a JSON-string params", async () => {
		const { service, videoDirector } = setup();

		await service.refineGenerationArgs({
			args: {
				params: JSON.stringify({
					medias: [{ role: "start_image", value: "media-1" }],
					model: HIGGSFIELD_MULTISHOT_AUDIO_MODEL,
					prompt: "slow dolly push-in on the serum bottle as light blooms",
				}),
			},
			organizationId: null,
			parentEventId: undefined,
			toolName: "generate_video",
			userId: "user_1",
		});

		expect(videoDirector.craftConnectorVideoPrompt).toHaveBeenCalledWith(
			expect.objectContaining({ referenceMediaCount: 1 }),
		);
	});

	it("never counts audio or motion references as an existing first frame", async () => {
		const { service, videoDirector } = setup();

		// A voice/music reference adds sound to a from-scratch render: telling
		// the director "the first frame already exists" would strip the scene
		// description from a render that has no frame at all.
		await service.refineGenerationArgs({
			args: {
				params: {
					medias: [{ role: "audio", value: "media-9" }],
					model: HIGGSFIELD_EDIT_MODEL,
					prompt: "SUBJECT: a serum bottle… KEY MOMENT: the drop lands…",
				},
			},
			organizationId: null,
			parentEventId: undefined,
			toolName: "generate_video",
			userId: "user_1",
		});

		expect(videoDirector.craftConnectorVideoPrompt).toHaveBeenCalledWith(
			expect.not.objectContaining({ referenceMediaCount: expect.anything() }),
		);
	});

	it("leaves video arguments without a prompt untouched and asks no director", async () => {
		const { service, videoDirector } = setup();
		const args = { params: { medias: ["https://cdn.example.com/still.png"] } };

		await expect(
			service.refineGenerationArgs({
				args,
				organizationId: null,
				parentEventId: undefined,
				toolName: "generate_video",
				userId: "user_1",
			}),
		).resolves.toBe(args);
		expect(videoDirector.craftConnectorVideoPrompt).not.toHaveBeenCalled();
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

	it("captures the generation reference as helper-billable usage", async () => {
		mockRefinement(REFINED_PROMPT);
		const { meteringService, service } = setup();

		await refineImage(service, { params: { prompt: "a vase" } });

		expect(meteringService.captureGeneration).toHaveBeenCalledWith(
			"usage_event_1",
			{
				providerMetadata: { gateway: { generationId: "generation_1" } },
				stepUsage: {
					metering: {
						customerBilling: "helper_billable",
						task: "prompt_refine",
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
