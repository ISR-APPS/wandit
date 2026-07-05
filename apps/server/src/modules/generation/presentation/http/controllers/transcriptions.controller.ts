import type { MultipartFile } from "@fastify/multipart";
import {
	BadRequestException,
	Controller,
	Inject,
	PayloadTooLargeException,
	Post,
	Req,
} from "@nestjs/common";
import type { TranscriptionResponse } from "@wandit/contracts";
import type { FastifyRequest } from "fastify";

import { TranscriptionService } from "../../../application/services/transcription.service";

type MultipartRequest = FastifyRequest & {
	file: () => Promise<MultipartFile | undefined>;
};

@Controller("v1/transcriptions")
export class TranscriptionsController {
	constructor(
		@Inject(TranscriptionService)
		private readonly transcriptionService: TranscriptionService,
	) {}

	@Post()
	async create(@Req() request: FastifyRequest): Promise<TranscriptionResponse> {
		const file = await this.readFile(request as MultipartRequest);

		if (!file.mimetype.startsWith("audio/")) {
			throw new BadRequestException({
				code: "UNSUPPORTED_AUDIO_TYPE",
				message: "The uploaded file must be an audio file",
			});
		}

		const audio = await this.readAudioBuffer(file);

		return this.transcriptionService.transcribeAudio({
			audio,
			mimeType: file.mimetype,
		});
	}

	private async readFile(request: MultipartRequest): Promise<MultipartFile> {
		try {
			const file = await request.file();

			if (!file) {
				throw new BadRequestException({
					code: "AUDIO_FILE_REQUIRED",
					message: "An audio file is required",
				});
			}

			return file;
		} catch (error) {
			if (error instanceof BadRequestException) {
				throw error;
			}

			throw new BadRequestException({
				code: "INVALID_MULTIPART_AUDIO",
				message: "The audio upload could not be read",
			});
		}
	}

	private async readAudioBuffer(file: MultipartFile): Promise<Buffer> {
		try {
			return await file.toBuffer();
		} catch (error) {
			if (this.isMultipartLimitError(error)) {
				throw new PayloadTooLargeException({
					code: "AUDIO_FILE_TOO_LARGE",
					message: "The uploaded audio file is too large",
				});
			}

			throw error;
		}
	}

	private isMultipartLimitError(error: unknown): boolean {
		return (
			this.isRecord(error) &&
			(error.code === "FST_REQ_FILE_TOO_LARGE" ||
				error.code === "FST_FILES_LIMIT" ||
				error.code === "FST_PARTS_LIMIT")
		);
	}

	private isRecord(value: unknown): value is Record<string, unknown> {
		return typeof value === "object" && value !== null;
	}
}
