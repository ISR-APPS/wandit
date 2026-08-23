/**
 * attachments.requests.ts — native twin of the web attachments.services.ts.
 *
 * Flow position:
 * - The PromptBox attach flow (use-attachments.ts) calls uploadAttachment()
 *   once PER FILE — the endpoint takes exactly one multipart part named
 *   "file"; callers loop for several files.
 * - The NestJS endpoint validates type/size (magic-byte sniffing included),
 *   streams to R2 and returns the public URL that user-message file parts and
 *   createProject.attachments carry.
 *
 * Gotchas:
 * - Do NOT set Content-Type by hand — axios/fetch must add the multipart
 *   boundary itself.
 * - The `type` on the RN file object must be one of the 7 allowlisted MIME
 *   types AND match the file's real bytes (image/jpg is not accepted; HEIC
 *   must be re-encoded by the picker before it gets here).
 */
import {
	attachmentsRoutes,
	type UploadAttachmentResponse,
	uploadAttachmentResponseSchema,
} from "@wandit/contracts";

import { apiClient, isApiClientError } from "@/shared/lib/api-client";

/** Server-enforced cap (@fastify/multipart fileSize) — pre-checked client-side. */
export const ATTACHMENT_MAX_BYTES = 15 * 1024 * 1024;

/** Composer cap, mirrors the web client and createProject's schema max(6). */
export const ATTACHMENT_MAX_COUNT = 6;

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

type NativeFileUpload = {
	name: string;
	type: string;
	uri: string;
};

// Upload ONE local file and return the validated { url, key, … } response.
export async function uploadAttachment(
	file: NativeFileUpload,
): Promise<UploadAttachmentResponse> {
	const form = new FormData();
	form.append("file", file as unknown as Blob);

	try {
		const data = await apiClient.post<unknown, FormData>(
			attachmentsRoutes.upload,
			form,
		);
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
