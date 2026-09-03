/**
 * HTTP route for user-asset attachment uploads (V2 spec §11).
 *
 * The browser sends one multipart file ("file" part); this controller reads
 * the upload and hands the bytes to UploadsService, which validates and
 * stores them in R2. Route: POST /api/v1/attachments (user-scoped — it works
 * before any project exists, for the dashboard composer).
 */
import type { MultipartFile } from "@fastify/multipart";
import {
	BadRequestException,
	Controller,
	Inject,
	PayloadTooLargeException,
	Post,
	Req,
} from "@nestjs/common";
import type { AuthUser } from "@wandit/auth";
import type { UploadAttachmentResponse } from "@wandit/contracts";
import type { FastifyRequest } from "fastify";

import { CurrentUser } from "../../../../auth";
import {
	attachmentSizeLimitFor,
	UploadsService,
} from "../../../application/services/uploads.service";

// The multipart plugin adds `request.file()` at runtime.
type MultipartRequest = FastifyRequest & {
	file: (options?: {
		limits?: { fileSize?: number };
	}) => Promise<MultipartFile | undefined>;
};

const MAX_ATTACHMENT_UPLOAD_BYTES = 50 * 1024 * 1024;

// main.ts adds `/api`, so this route is `/api/v1/attachments`.
@Controller("v1")
export class UploadsController {
	constructor(
		@Inject(UploadsService)
		private readonly uploadsService: UploadsService,
	) {}

	// Accept ONE uploaded file and return its hosted reference. Clients loop
	// over this endpoint for several files (contract §7.2).
	@Post("attachments")
	async upload(
		@Req() request: FastifyRequest,
		@CurrentUser() user: AuthUser,
	): Promise<UploadAttachmentResponse> {
		const file = await this.readFile(request as MultipartRequest);
		const buffer = await this.readFileBuffer(file);

		return this.uploadsService.uploadAttachment(user.id, {
			buffer,
			filename: file.filename,
			mimetype: file.mimetype,
		});
	}

	// Read the uploaded file object from the request.
	private async readFile(request: MultipartRequest): Promise<MultipartFile> {
		try {
			// The global multipart limit stays at 15 MiB for every other endpoint.
			// Attachments need the video ceiling; UploadsService applies the lower
			// image/document and audio limits once it knows the declared media type.
			const file = await request.file({
				limits: { fileSize: MAX_ATTACHMENT_UPLOAD_BYTES },
			});

			// No file part in the form body.
			if (!file) {
				throw new BadRequestException({
					code: "ATTACHMENT_FILE_REQUIRED",
					message: "A file is required",
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
				code: "INVALID_MULTIPART_ATTACHMENT",
				message: "The file upload could not be read",
			});
		}
	}

	// Convert the upload stream into a Buffer for validation and storage.
	private async readFileBuffer(file: MultipartFile): Promise<Buffer> {
		try {
			return await file.toBuffer();
		} catch (error) {
			// Upload exceeded the attachment route's absolute 50 MiB limit. Use
			// the lower declared-category limit so the caller gets a useful retry cap.
			if (this.isMultipartLimitError(error)) {
				throw new PayloadTooLargeException({
					code: "ATTACHMENT_FILE_TOO_LARGE",
					message: attachmentSizeLimitFor(file.mimetype).message,
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
