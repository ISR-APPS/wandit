import { beforeEach, describe, expect, it, vi } from "vitest";

import { VOICEOVER_TTS_MODEL } from "../../../media-generations/domain/voiceover-models";
import { SpeechService } from "./speech.service";

const speechMocks = vi.hoisted(() => ({
	generateSpeech: vi.fn(),
	speech: vi.fn(),
}));

vi.mock("@ai-sdk/gateway", () => ({
	gateway: { speech: speechMocks.speech },
}));

vi.mock("ai", () => ({
	experimental_generateSpeech: speechMocks.generateSpeech,
}));

describe("SpeechService", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		speechMocks.speech.mockReturnValue("speech-model");
	});

	it("synthesizes attributed voiceover bytes through the model seam", async () => {
		const bytes = new Uint8Array([73, 68, 51]);
		speechMocks.generateSpeech.mockResolvedValue({
			audio: { mediaType: "audio/mpeg", uint8Array: bytes },
			providerMetadata: { gateway: { generationId: "generation-1" } },
		});
		const service = new SpeechService();

		await expect(
			service.synthesizeVoiceover({
				language: "fr",
				metering: {
					operation: "video",
					organizationId: "organization-1",
					userId: "user-1",
				},
				script: "Une courte narration.",
			}),
		).resolves.toEqual({ bytes, mediaType: "audio/mpeg" });

		expect(speechMocks.speech).toHaveBeenCalledWith(VOICEOVER_TTS_MODEL);
		expect(speechMocks.generateSpeech).toHaveBeenCalledWith({
			language: "fr",
			maxRetries: 0,
			model: "speech-model",
			outputFormat: "mp3",
			providerOptions: {
				gateway: {
					tags: ["op:video", "ws:org"],
					user: "user-1",
				},
			},
			text: "Une courte narration.",
		});
	});
});
