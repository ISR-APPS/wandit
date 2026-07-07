/**
 * Tests for the audio upload controller.
 *
 * Focus: oversized audio uploads should return a clear 413 error.
 */
import type { MultipartFile } from "@fastify/multipart";
import { PayloadTooLargeException } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { describe, expect, it, vi } from "vitest";

import type { TranscriptionService } from "../../../application/services/transcription.service";
import { TranscriptionsController } from "./transcriptions.controller";

// Build controller with a fake transcription service.
function setup() {
	const transcriptionService = {
		transcribeAudio: vi.fn(),
	};
	const controller = new TranscriptionsController(
		transcriptionService as unknown as TranscriptionService,
	);

	return { controller, transcriptionService };
}

// Test upload error handling.
describe("TranscriptionsController", () => {
	// Oversized upload should become HTTP 413.
	it("maps multipart file-size failures to 413", async () => {
		const { controller, transcriptionService } = setup();
		// Fastify uses this code when upload is too large.
		const error = Object.assign(new Error("request file too large"), {
			code: "FST_REQ_FILE_TOO_LARGE",
		});
		// Use an audio mimetype so the test reaches the buffer-read branch.
		const file = {
			mimetype: "audio/wav",
			toBuffer: vi.fn(async () => {
				throw error;
			}),
		} as unknown as MultipartFile;
		const request = {
			file: vi.fn(async () => file),
		};

		await expect(
			controller.create(request as unknown as FastifyRequest),
		).rejects.toBeInstanceOf(PayloadTooLargeException);
		// Do not call the AI service if upload reading failed.
		expect(transcriptionService.transcribeAudio).not.toHaveBeenCalled();
	});
});
