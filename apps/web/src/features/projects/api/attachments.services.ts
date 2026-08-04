/**
 * Raw HTTP wrapper for user-asset attachment uploads (V2 spec §11).
 *
 * Flow position:
 * - PromptBox (dashboard/workspace composer) and the ask_user attachments
 *   tray call uploadAttachment() once PER FILE — the endpoint takes exactly
 *   one multipart part named "file"; callers loop for several files.
 * - The NestJS attachments endpoint validates type/size, streams to R2 and
 *   returns the public URL the AI SDK file parts / create-project body carry.
 *
 * Gotchas:
 * - This file should not know about React, toasts, or UI state.
 * - The endpoint is user-scoped (no projectId) so the dashboard composer can
 *   upload before a project exists.
 */
import {
	ATTACHMENT_MEDIA_TYPES,
	attachmentsRoutes,
	type UploadAttachmentResponse,
	uploadAttachmentResponseSchema,
} from "@wandit/contracts";

import { apiClient, isApiClientError } from "@/lib/api-client";

/** Client-side pre-check mirror of the server allowlist (contract §7.2). The
 *  three extensions ride along because Windows/macOS browsers often report an
 *  unreliable mime for CSV and Office documents. */
export const ATTACHMENT_ACCEPT = [
	...ATTACHMENT_MEDIA_TYPES,
	".csv",
	".docx",
	".xlsx",
].join(",");

/** Server-enforced cap (@fastify/multipart fileSize) — pre-checked client-side. */
export const ATTACHMENT_MAX_BYTES = 15 * 1024 * 1024;

/** Typed upload failure so the UI can pick the right dictionary string. */
export type AttachmentUploadErrorReason =
	| "unsupported" // 415 — media type outside the allowlist
	| "too-large" // 413 — over the 15 MiB multipart cap
	| "failed"; // anything else (network, 5xx, storage unavailable)

export class AttachmentUploadError extends Error {
	readonly reason: AttachmentUploadErrorReason;

	constructor(reason: AttachmentUploadErrorReason, message: string) {
		super(message);
		this.name = "AttachmentUploadError";
		this.reason = reason;
	}
}

// Upload ONE user asset and return the validated { url, key, … } response.
export async function uploadAttachment(
	file: File,
): Promise<UploadAttachmentResponse> {
	const form = new FormData();
	form.append("file", file, file.name);
	try {
		// Let axios set the multipart boundary itself — do not force Content-Type.
		const data = await apiClient.post<unknown>(attachmentsRoutes.upload, form);
		return uploadAttachmentResponseSchema.parse(data);
	} catch (error) {
		if (isApiClientError(error)) {
			if (error.statusCode === 415) {
				throw new AttachmentUploadError("unsupported", error.message);
			}
			if (error.statusCode === 413) {
				throw new AttachmentUploadError("too-large", error.message);
			}
		}
		throw new AttachmentUploadError(
			"failed",
			error instanceof Error ? error.message : "Upload failed",
		);
	}
}
