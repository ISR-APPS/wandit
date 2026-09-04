import { generateText } from "ai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HIGGSFIELD_MULTISHOT_AUDIO_MODEL } from "../../../mcp-connectors/domain/higgsfield-models";
import { VideoDirectorService } from "./video-director";

const mockEnv = vi.hoisted(() => ({
	AI_GATEWAY_API_KEY: "gateway_test" as string | undefined,
	AI_PROMPT_REFINER_MODEL: "test-provider/refiner-model" as string | undefined,
	AI_VIDEO_DIRECTOR_MODEL: undefined as string | undefined,
}));

vi.mock("@wandit/env/server", () => ({ env: mockEnv }));

vi.mock("ai", () => ({
	generateText: vi.fn(),
}));

const DIRECTED_PROMPT =
	"Slow dolly-in on the serum bottle as morning light sweeps across it, settling into a hero close-up";

function setup() {
	const meteringService = {
		captureGeneration: vi.fn(
			async (): Promise<{ id: string } | null> => ({ id: "generation_ref_1" }),
		),
	};

	return {
		meteringService,
		service: new VideoDirectorService(meteringService as never),
	};
}

function mockDirection(text: string): void {
	vi.mocked(generateText).mockResolvedValue({
		finishReason: "stop",
		providerMetadata: { gateway: { generationId: "generation_1" } },
		text,
		usage: { inputTokens: 40, outputTokens: 60 },
	} as unknown as Awaited<ReturnType<typeof generateText>>);
}

function directorRequestPrompt(): string {
	const call = vi.mocked(generateText).mock.calls[0]?.[0] as
		| { prompt?: string }
		| undefined;

	return call?.prompt ?? "";
}

beforeEach(() => {
	vi.mocked(generateText).mockReset();
	mockEnv.AI_GATEWAY_API_KEY = "gateway_test";
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe("VideoDirectorService.craftConnectorVideoPrompt", () => {
	it("tells the director brain when the call animates an existing frame", async () => {
		const { service } = setup();
		mockDirection(DIRECTED_PROMPT);

		const crafted = await service.craftConnectorVideoPrompt({
			aspect: "1:1",
			brief: "SUBJECT: a serum bottle… KEY MOMENT: the drop lands…",
			durationSeconds: 10,
			model: HIGGSFIELD_MULTISHOT_AUDIO_MODEL,
			organizationId: null,
			parentEventId: undefined,
			referenceMediaCount: 1,
			userId: "user_1",
		});

		expect(crafted).toEqual({
			directed: true,
			negativePrompt: expect.any(String),
			prompt: DIRECTED_PROMPT,
		});
		expect(directorRequestPrompt()).toContain(
			"Reference media: the call carries 1 reference media",
		);
	});

	it("omits the reference-media line for a from-scratch render", async () => {
		const { service } = setup();
		mockDirection(DIRECTED_PROMPT);

		await service.craftConnectorVideoPrompt({
			brief: "SUBJECT: a serum bottle… KEY MOMENT: the drop lands…",
			model: HIGGSFIELD_MULTISHOT_AUDIO_MODEL,
			organizationId: null,
			parentEventId: undefined,
			userId: "user_1",
		});

		expect(directorRequestPrompt()).not.toContain("Reference media:");
		expect(directorRequestPrompt()).not.toContain("Multi-shot:");
		expect(directorRequestPrompt()).not.toContain("Talking person:");
		expect(directorRequestPrompt()).toContain("Voiceover: none.");
	});

	it("composes native connector narration with the exact script and nobody speaking on screen", async () => {
		const { service } = setup();
		mockDirection(DIRECTED_PROMPT);

		const crafted = await service.craftConnectorVideoPrompt({
			aspect: "9:16",
			brief: "SUBJECT: a shoe moves through a quiet dawn street.",
			durationSeconds: 10,
			model: HIGGSFIELD_MULTISHOT_AUDIO_MODEL,
			organizationId: null,
			parentEventId: undefined,
			talking: false,
			userId: "user_1",
			voiceoverLanguage: "fr",
			voiceoverScript: "Chaque pas devient plus léger.",
		});

		expect(directorRequestPrompt()).toContain(
			"Talking person: no — nobody visibly speaks on screen.",
		);
		expect(directorRequestPrompt()).toContain(
			'Native off-camera narration: the provider will render these exact fr words after your visual prompt: "Chaque pas devient plus léger."',
		);
		expect(crafted.prompt).toBe(
			`${DIRECTED_PROMPT}\n\nVoiceover narration, calm confident voice, fr: "Chaque pas devient plus léger."`,
		);
		expect(crafted.prompt).not.toContain("saying exactly:");
	});

	it("restores the exact talking script when the connector director drops it", async () => {
		const { service } = setup();
		mockDirection(DIRECTED_PROMPT);

		const crafted = await service.craftConnectorVideoPrompt({
			brief: "SUBJECT: the founder presents her serum to camera.",
			model: HIGGSFIELD_MULTISHOT_AUDIO_MODEL,
			organizationId: null,
			parentEventId: undefined,
			talking: true,
			userId: "user_1",
			voiceoverLanguage: "fr",
			voiceoverScript: "Voici votre nouveau rituel.",
		});

		expect(crafted.prompt).toBe(
			`${DIRECTED_PROMPT}\n\nsaying exactly: "Voici votre nouveau rituel."`,
		);
	});

	it("keeps the start image in the fallback prompt when the director is unavailable", async () => {
		mockEnv.AI_GATEWAY_API_KEY = undefined;
		const { service } = setup();

		const crafted = await service.craftConnectorVideoPrompt({
			brief: "SUBJECT: a serum bottle… KEY MOMENT: the drop lands…",
			durationSeconds: 6,
			model: HIGGSFIELD_MULTISHOT_AUDIO_MODEL,
			organizationId: null,
			parentEventId: undefined,
			referenceMediaCount: 1,
			userId: "user_1",
		});

		expect(crafted.directed).toBe(false);
		expect(crafted.prompt).toContain(
			"One continuous 6-second commercial shot animating the provided start image.",
		);
		expect(generateText).not.toHaveBeenCalled();
	});

	it("never claims a start image in the fallback for a from-scratch render", async () => {
		mockEnv.AI_GATEWAY_API_KEY = undefined;
		const { service } = setup();

		const crafted = await service.craftConnectorVideoPrompt({
			brief: "SUBJECT: a serum bottle… KEY MOMENT: the drop lands…",
			durationSeconds: 6,
			model: HIGGSFIELD_MULTISHOT_AUDIO_MODEL,
			organizationId: null,
			parentEventId: undefined,
			userId: "user_1",
		});

		expect(crafted.directed).toBe(false);
		expect(crafted.prompt).toContain(
			"One continuous 6-second commercial shot.",
		);
		expect(crafted.prompt).not.toContain("start image");
	});
});
