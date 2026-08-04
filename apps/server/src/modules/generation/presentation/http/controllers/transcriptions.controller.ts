/**
 * HTTP route for audio-to-text.
 *
 * The browser uploads one audio file. This controller checks the upload and
 * passes the bytes to TranscriptionService.
 */
import type { MultipartFile } from "@fastify/multipart";
// Nest decorators replace manual Express route registration.
import {
	BadRequestException,
	Controller,
	Headers,
	Inject,
	PayloadTooLargeException,
	Post,
	Req,
	UseGuards,
} from "@nestjs/common";
import type { AuthUser } from "@wandit/auth";
import type { TranscriptionResponse } from "@wandit/contracts";
import type { FastifyRequest } from "fastify";

import { CurrentUser, EarlyAccessGuard } from "../../../../auth";
import { TranscriptionService } from "../../../application/services/transcription.service";

// The multipart plugin adds `request.file()` at runtime.
type MultipartRequest = FastifyRequest & {
	file: () => Promise<MultipartFile | undefined>;
};

// main.ts adds `/api`, so this route is `/api/v1/transcriptions`.
@Controller("v1/transcriptions")
export class TranscriptionsController {
	constructor(
		// Nest injects the service. The controller does not create it manually.
		@Inject(TranscriptionService)
		private readonly transcriptionService: TranscriptionService,
	) {}

	// Accept one uploaded audio file and return recognized text.
	@UseGuards(EarlyAccessGuard)
	@Post()
	async create(
		@Req() request: FastifyRequest,
		@CurrentUser() user: AuthUser,
		@Headers("x-operation-id") operationId: string | undefined,
	): Promise<TranscriptionResponse> {
		const file = await this.readFile(request as MultipartRequest);

		// Basic check from upload metadata. This is not a deep file scan.
		if (!file.mimetype.startsWith("audio/")) {
			throw new BadRequestException({
				code: "UNSUPPORTED_AUDIO_TYPE",
				message: "The uploaded file must be an audio file",
			});
		}

		const audio = await this.readAudioBuffer(file);
		const stableOperationId = operationId?.trim();

		if (
			!stableOperationId ||
			stableOperationId.length < 16 ||
			stableOperationId.length > 128 ||
			!/^[A-Za-z0-9._:-]+$/u.test(stableOperationId)
		) {
			throw new BadRequestException({
				code: "TRANSCRIPTION_OPERATION_ID_REQUIRED",
				message: "A stable transcription operation id is required",
			});
		}

		// Service owns the AI SDK call.
		return this.transcriptionService.transcribeAudio({
			audio,
			mimeType: file.mimetype,
			operationId: stableOperationId,
			userId: user.id,
		});
	}

	// Read the uploaded file object from the request.
	private async readFile(request: MultipartRequest): Promise<MultipartFile> {
		try {
			const file = await request.file();

			// No file part in the form body.
			if (!file) {
				throw new BadRequestException({
					code: "AUDIO_FILE_REQUIRED",
					message: "An audio file is required",
				});
			}

			return file;
		} catch (error) {
			// Keep our own "missing file" error unchanged.
			if (error instanceof BadRequestException) {
				throw error;
			}

			// The upload body was invalid or not multipart.
			throw new BadRequestException({
				code: "INVALID_MULTIPART_AUDIO",
				message: "The audio upload could not be read",
			});
		}
	}

	// Convert the upload stream into a Buffer for the AI SDK.
	private async readAudioBuffer(file: MultipartFile): Promise<Buffer> {
		try {
			return await file.toBuffer();
		} catch (error) {
			// Upload was too large for the configured Fastify limit.
			if (this.isMultipartLimitError(error)) {
				throw new PayloadTooLargeException({
					code: "AUDIO_FILE_TOO_LARGE",
					message: "The uploaded audio file is too large",
				});
			}

			throw error;
		}
	}

	// Check if this is a Fastify upload-limit error.
	private isMultipartLimitError(error: unknown): boolean {
		return (
			this.isRecord(error) &&
			(error.code === "FST_REQ_FILE_TOO_LARGE" ||
				error.code === "FST_FILES_LIMIT" ||
				error.code === "FST_PARTS_LIMIT")
		);
	}

	// Runtime check before reading `error.code`.
	private isRecord(value: unknown): value is Record<string, unknown> {
		return typeof value === "object" && value !== null;
	}
}
