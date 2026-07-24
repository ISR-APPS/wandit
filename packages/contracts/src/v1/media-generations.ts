/**
 * Durable image-to-video generation contracts.
 *
 * Video mode always starts from a user-provided image; it is intentionally
 * not a text-to-video API. The chat tool queues the work and the web polls the
 * attempt route until it reaches a terminal state.
 */
import { z } from "zod";
import { isoDateTimeSchema, uuidSchema } from "./shared/primitives";

export const IMAGE_TO_VIDEO_SOURCE_MEDIA_TYPES = [
	"image/jpeg",
	"image/png",
	"image/webp",
] as const;

export const imageToVideoSourceMediaTypeSchema = z.enum(
	IMAGE_TO_VIDEO_SOURCE_MEDIA_TYPES,
);

export type ImageToVideoSourceMediaType = z.infer<
	typeof imageToVideoSourceMediaTypeSchema
>;

export const IMAGE_TO_VIDEO_ASPECTS = ["16:9", "9:16", "1:1"] as const;

export const imageToVideoAspectSchema = z.enum(IMAGE_TO_VIDEO_ASPECTS);

export type ImageToVideoAspect = z.infer<typeof imageToVideoAspectSchema>;

export const IMAGE_TO_VIDEO_MOTIONS = [
	"subtle",
	"balanced",
	"dynamic",
] as const;

export const imageToVideoMotionSchema = z.enum(IMAGE_TO_VIDEO_MOTIONS);

export type ImageToVideoMotion = z.infer<typeof imageToVideoMotionSchema>;

export const IMAGE_TO_VIDEO_DURATION_SECONDS = 5 as const;

// Mirrors media_generation_status in
// packages/db/src/schema/media-generation-attempts.ts.
export const mediaGenerationStatusSchema = z.enum([
	"queued",
	"generating",
	"succeeded",
	"failed",
]);

export type MediaGenerationStatus = z.infer<typeof mediaGenerationStatusSchema>;

// Everything the result card needs in one ownership-checked polling request.
// The source image doubles as the video's poster while work is in progress.
export const mediaGenerationAttemptSchema = z.object({
	id: uuidSchema,
	status: mediaGenerationStatusSchema,
	sourceImageUrl: z.url(),
	sourceMediaType: imageToVideoSourceMediaTypeSchema,
	aspect: imageToVideoAspectSchema,
	motion: imageToVideoMotionSchema,
	prompt: z.string(),
	durationSeconds: z.literal(IMAGE_TO_VIDEO_DURATION_SECONDS),
	videoUrl: z.url().nullable(),
	videoMediaType: z.string().min(1).nullable(),
	error: z.string().nullable(),
	createdAt: isoDateTimeSchema,
	completedAt: isoDateTimeSchema.nullable(),
});

export type MediaGenerationAttempt = z.infer<
	typeof mediaGenerationAttemptSchema
>;

export const mediaGenerationsRoutes = {
	/** GET — one attempt's status (poll while queued/generating). */
	attempt: (attemptId: string) => `/api/v1/media-generations/${attemptId}`,
	/** GET — ownership-checked finished video attachment. */
	download: (attemptId: string) =>
		`/api/v1/media-generations/${attemptId}/download`,
} as const;
