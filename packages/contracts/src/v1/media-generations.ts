/**
 * Durable video generation contracts.
 *
 * Two kinds share one attempt table and one polling route:
 * - "image-animation" — animates a user-provided source image (the original
 *   image-to-video mode; source columns are required for this kind).
 * - "text-to-video" — renders a clip from a director-crafted text prompt
 *   alone; source columns stay null.
 * The chat tool queues the work and the web polls the attempt route until it
 * reaches a terminal state.
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

// Mirrors media_generation_kind in
// packages/db/src/schema/media-generation-attempts.ts.
export const MEDIA_GENERATION_KINDS = [
	"image-animation",
	"text-to-video",
] as const;

export const mediaGenerationKindSchema = z.enum(MEDIA_GENERATION_KINDS);

export type MediaGenerationKind = z.infer<typeof mediaGenerationKindSchema>;

// Durations the provider path accepts (Kling v2.x renders 5 or 10 seconds;
// the DB CHECK mirrors this list). Image animation stays pinned to 5.
export const VIDEO_GENERATION_DURATIONS = [5, 10] as const;

export const videoDurationSecondsSchema = z.union([
	z.literal(5),
	z.literal(10),
]);

export type VideoDurationSeconds = z.infer<typeof videoDurationSecondsSchema>;

export const VIDEO_VOICEOVER_LANGUAGES = ["en", "fr", "ar"] as const;

export const videoVoiceoverLanguageSchema = z.enum(VIDEO_VOICEOVER_LANGUAGES);

export type VideoVoiceoverLanguage = z.infer<
	typeof videoVoiceoverLanguageSchema
>;

// Captured with the attempt so the future audio pipeline (OpenRouter branch)
// finds the request + script ready; today the clip renders silent and the
// voiceover is only stored.
export const videoVoiceoverSchema = z.object({
	language: videoVoiceoverLanguageSchema,
	script: z.string().min(1).max(600).optional(),
});

export type VideoVoiceover = z.infer<typeof videoVoiceoverSchema>;

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
// For image animation the source image doubles as the video's poster while
// work is in progress; text-to-video rows carry null source columns.
// `.catch()` on kind keeps a newer web tolerant of an older server mid-deploy.
export const mediaGenerationAttemptSchema = z.object({
	id: uuidSchema,
	kind: mediaGenerationKindSchema.catch("image-animation"),
	status: mediaGenerationStatusSchema,
	sourceImageUrl: z.url().nullable(),
	sourceMediaType: imageToVideoSourceMediaTypeSchema.nullable(),
	aspect: imageToVideoAspectSchema,
	motion: imageToVideoMotionSchema.nullable(),
	prompt: z.string(),
	durationSeconds: videoDurationSecondsSchema,
	// Display name (text-to-video only; animation rows stay null).
	title: z.string().nullable().catch(null),
	voiceover: videoVoiceoverSchema.nullable().catch(null),
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
