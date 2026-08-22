import {
	editVideoInputSchema,
	editVideoOutputSchema,
	extendVideoInputSchema,
	extendVideoOutputSchema,
	generateVideoOutputSchema,
	mediaGenerationAttemptSchema,
	videoBuildProgressSchema,
} from "@wandit/contracts";
import { describe, expect, it } from "vitest";

const ATTEMPT_ID = "11111111-1111-4111-8111-111111111111";

function attemptPayload({
	durationSeconds = 10,
	kind = "text-to-video",
}: {
	durationSeconds?: number;
	kind?: string;
} = {}) {
	return {
		aspect: "16:9",
		completedAt: null,
		createdAt: "2026-08-21T12:00:00.000Z",
		durationSeconds,
		error: null,
		id: ATTEMPT_ID,
		kind,
		motion: null,
		prompt: "A cinematic product reveal",
		sourceImageUrl: null,
		sourceMediaType: null,
		status: "queued",
		title: "Product reveal",
		videoMediaType: null,
		videoUrl: null,
		voiceover: null,
	};
}

describe("media generation contracts", () => {
	it("round-trips narration delivery status", () => {
		const attempt = mediaGenerationAttemptSchema.parse({
			...attemptPayload({ kind: "video-extension" }),
			voiceover: {
				deliveryStatus: "failed",
				language: "en",
				script: "Keep moving forward.",
			},
		});

		expect(attempt.voiceover).toEqual({
			deliveryStatus: "failed",
			language: "en",
			script: "Keep moving forward.",
		});
	});

	it("accepts an older voiceover payload without delivery status", () => {
		const attempt = mediaGenerationAttemptSchema.parse({
			...attemptPayload({ kind: "video-extension" }),
			voiceover: {
				language: "fr",
				script: "Continuez à avancer.",
			},
		});

		expect(attempt.voiceover).toEqual({
			language: "fr",
			script: "Continuez à avancer.",
		});
	});

	it.each([
		20, 30,
	])("preserves a %i-second joined result duration", (durationSeconds) => {
		const attempt = mediaGenerationAttemptSchema.parse(
			attemptPayload({ durationSeconds }),
		);

		expect(attempt.durationSeconds).toBe(durationSeconds);
	});

	it("falls back for an unknown response duration without rejecting the card", () => {
		const attempt = mediaGenerationAttemptSchema.parse(
			attemptPayload({ durationSeconds: 999 }),
		);

		expect(attempt.durationSeconds).toBe(10);
	});

	it.each([
		"video-edit",
		"video-extension",
	])("preserves the %s attempt kind", (kind) => {
		const attempt = mediaGenerationAttemptSchema.parse(
			attemptPayload({ kind }),
		);

		expect(attempt.kind).toBe(kind);
	});

	it("falls back for an unknown attempt kind", () => {
		const attempt = mediaGenerationAttemptSchema.parse(
			attemptPayload({ kind: "future-video-kind" }),
		);

		expect(attempt.kind).toBe("image-animation");
	});
});

describe("video chat tool contracts", () => {
	it("parses edit_video input", () => {
		expect(
			editVideoInputSchema.parse({
				instruction: "Keep the framing and change the bottle to blue.",
				sourceAttemptId: ATTEMPT_ID,
				title: "Blue bottle edit",
			}),
		).toEqual({
			instruction: "Keep the framing and change the bottle to blue.",
			sourceAttemptId: ATTEMPT_ID,
			title: "Blue bottle edit",
		});
	});

	it("defaults extension leg settings and accepts a voiceover", () => {
		expect(
			extendVideoInputSchema.parse({
				continuationBrief: "Continue the orbit into a close-up.",
				sourceAttemptId: ATTEMPT_ID,
				title: "Extended orbit",
				voiceover: { language: "fr", script: "Découvrez la suite." },
			}),
		).toEqual({
			acceptSilent: false,
			continuationBrief: "Continue the orbit into a close-up.",
			legCount: 1,
			legDurationSeconds: 5,
			sourceAttemptId: ATTEMPT_ID,
			title: "Extended orbit",
			voiceover: { language: "fr", script: "Découvrez la suite." },
		});
	});

	it("uses the generate_video output contract for edit and extension", () => {
		const output = {
			attemptId: ATTEMPT_ID,
			message: "Queued.",
			status: "queued" as const,
		};

		expect(editVideoOutputSchema).toBe(generateVideoOutputSchema);
		expect(extendVideoOutputSchema).toBe(generateVideoOutputSchema);
		expect(editVideoOutputSchema.parse(output)).toEqual(output);
		expect(extendVideoOutputSchema.parse(output)).toEqual(output);
	});

	it("preserves known progress stages and catches future ones by field", () => {
		expect(videoBuildProgressSchema.parse({ stage: "joining" }).stage).toBe(
			"joining",
		);
		expect(
			videoBuildProgressSchema.parse({ stage: "future-stage" }).stage,
		).toBeNull();
	});
});
