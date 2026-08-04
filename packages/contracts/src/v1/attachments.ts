/**
 * User-asset attachment upload contract (V2 spec §11). User-scoped (not
 * project-scoped) so the dashboard composer can upload before a project
 * exists. One file per request; clients loop for several files.
 */
import { z } from "zod";

export const ATTACHMENT_MEDIA_TYPES = [
	"image/jpeg",
	"image/png",
	"image/webp",
	"image/gif",
	"image/avif",
	"application/pdf",
	"text/plain",
	"text/csv",
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
] as const;

export const attachmentMediaTypeSchema = z.enum(ATTACHMENT_MEDIA_TYPES);

export const uploadAttachmentResponseSchema = z.object({
	url: z.url(),
	key: z.string().min(1),
	mediaType: attachmentMediaTypeSchema,
	filename: z.string().min(1),
	size: z.number().int().positive(),
});

export type UploadAttachmentResponse = z.infer<
	typeof uploadAttachmentResponseSchema
>;

/** Reference to an uploaded attachment carried inside JSON bodies
 *  (project creation) — mirrors the AI SDK FileUIPart minus `type`. */
export const fileRefSchema = z.object({
	url: z.url(),
	mediaType: z.string().min(1),
	filename: z.string().optional(),
});

export type FileRef = z.infer<typeof fileRefSchema>;

export const attachmentsRoutes = {
	// POST multipart (single part "file") — upload one user asset to R2.
	upload: "/api/v1/attachments",
} as const;
