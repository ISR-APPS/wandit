import type { MultipartFile } from "@fastify/multipart";
import type { FastifyRequest } from "fastify";
import { describe, expect, it, vi } from "vitest";

import type { UploadsService } from "../../../application/services/uploads.service";
import { UploadsController } from "./uploads.controller";

describe("UploadsController", () => {
	it("raises the multipart file limit to 50 MiB for the attachments route", async () => {
		const file = {
			filename: "reference.mp4",
			mimetype: "video/mp4",
			toBuffer: vi.fn(async () => Buffer.from("video")),
		} as unknown as MultipartFile;
		const request = {
			file: vi.fn(async () => file),
		};
		const uploadsService = {
			uploadAttachment: vi.fn(async () => ({ url: "stored" })),
		};
		const controller = new UploadsController(
			uploadsService as unknown as UploadsService,
		);

		await controller.upload(
			request as unknown as FastifyRequest,
			{ id: "user-1" } as never,
		);

		expect(request.file).toHaveBeenCalledWith({
			limits: { fileSize: 50 * 1024 * 1024 },
		});
		expect(uploadsService.uploadAttachment).toHaveBeenCalledWith("user-1", {
			buffer: Buffer.from("video"),
			filename: "reference.mp4",
			mimetype: "video/mp4",
		});
	});

	it("reports the lower audio cap when the multipart stream exceeds 50 MiB", async () => {
		const limitError = Object.assign(new Error("file too large"), {
			code: "FST_REQ_FILE_TOO_LARGE",
		});
		const file = {
			filename: "soundtrack.mp3",
			mimetype: "audio/mpeg",
			toBuffer: vi.fn(async () => {
				throw limitError;
			}),
		} as unknown as MultipartFile;
		const request = {
			file: vi.fn(async () => file),
		};
		const uploadsService = {
			uploadAttachment: vi.fn(),
		};
		const controller = new UploadsController(
			uploadsService as unknown as UploadsService,
		);

		await expect(
			controller.upload(
				request as unknown as FastifyRequest,
				{ id: "user-1" } as never,
			),
		).rejects.toMatchObject({
			response: {
				code: "ATTACHMENT_FILE_TOO_LARGE",
				message: "Audio files must be 25 MB or smaller",
			},
		});
		expect(uploadsService.uploadAttachment).not.toHaveBeenCalled();
	});
});
