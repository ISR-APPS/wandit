import type { MultipartFile } from "@fastify/multipart";
import { PayloadTooLargeException } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { describe, expect, it, vi } from "vitest";

import type { TranscriptionService } from "../../../application/services/transcription.service";
import { TranscriptionsController } from "./transcriptions.controller";

function setup() {
	const transcriptionService = {
		transcribeAudio: vi.fn(),
	};
	const controller = new TranscriptionsController(
		transcriptionService as unknown as TranscriptionService,
	);

	return { controller, transcriptionService };
}

describe("TranscriptionsController", () => {
	it("maps multipart file-size failures to 413", async () => {
		const { controller, transcriptionService } = setup();
		const error = Object.assign(new Error("request file too large"), {
			code: "FST_REQ_FILE_TOO_LARGE",
		});
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
		expect(transcriptionService.transcribeAudio).not.toHaveBeenCalled();
	});
});
