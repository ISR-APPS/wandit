import { describe, expect, it } from "vitest";

import type { AiChatRequestMetadata } from "../presentation/http/controllers/ai-chat.controller";
import { resolveVideoRequestKeySeed } from "./request-context";

const VIDEO_SUBMISSION_ID = "de890510-e194-4a18-8d4a-a30f80dbe32a";

function metadata(
	mode: "page" | "video",
	videoSubmissionId: unknown,
): AiChatRequestMetadata {
	return {
		composer: {
			mode,
			options: { videoSubmissionId },
			quality: "standard",
		},
	};
}

describe("resolveVideoRequestKeySeed", () => {
	it("prefers a validated Video submission UUID over a new message id", () => {
		expect(
			resolveVideoRequestKeySeed(
				metadata("video", VIDEO_SUBMISSION_ID),
				"message_after_transport_retry",
			),
		).toBe(VIDEO_SUBMISSION_ID);
	});

	it("falls back when the Video submission token is malformed", () => {
		expect(
			resolveVideoRequestKeySeed(metadata("video", "not-a-uuid"), "message_2"),
		).toBe("message_2");
	});

	it("ignores a submission token outside Video mode", () => {
		expect(
			resolveVideoRequestKeySeed(
				metadata("page", VIDEO_SUBMISSION_ID),
				"message_3",
			),
		).toBe("message_3");
	});
});
