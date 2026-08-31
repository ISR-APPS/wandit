/**
 * Durable video generation contracts.
 *
 * Five kinds share one attempt table and one polling route:
 * - "image-animation" — animates a user-provided source image (the original
 *   image-to-video mode; source columns are required for this kind).
 * - "text-to-video" — renders a clip from a director-crafted text prompt
 *   alone; source columns stay null.
 * - "video-product" — renders a five-second commercial from one snapshotted
 *   product image.
 * - "video-edit" — edits a snapshotted source video.
 * - "video-extension" — joins continuation legs onto a source video.
 * The chat tool queues the work and the web polls the attempt route until it
 * reaches a terminal state.
 */
import { z } from "zod";
import { aiErrorDataSchema } from "./ai-errors";
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
	"video-product",
	"video-edit",
	"video-extension",
] as const;

export const mediaGenerationKindSchema = z.enum(MEDIA_GENERATION_KINDS);

export type MediaGenerationKind = z.infer<typeof mediaGenerationKindSchema>;

// Durations the provider path accepts. Fifteen seconds is max-tier only and is
// enforced server-side; the DB CHECK mirrors this list. Image animation stays
// pinned to 5.
export const VIDEO_GENERATION_DURATIONS = [5, 10, 15] as const;

export const videoDurationSecondsSchema = z.union([
	z.literal(5),
	z.literal(10),
	z.literal(15),
]);

export type VideoDurationSeconds = z.infer<typeof videoDurationSecondsSchema>;

export const videoResultDurationSecondsSchema = z
	.number()
	.int()
	.min(1)
	.max(120);

export type VideoResultDurationSeconds = z.infer<
	typeof videoResultDurationSecondsSchema
>;

export const videoQualities = ["standard", "max"] as const;

export const videoQualitySchema = z.enum(videoQualities);

export type VideoQuality = z.infer<typeof videoQualitySchema>;

export const VIDEO_VOICEOVER_LANGUAGES = ["en", "fr", "ar"] as const;

export const videoVoiceoverLanguageSchema = z.enum(VIDEO_VOICEOVER_LANGUAGES);

export type VideoVoiceoverLanguage = z.infer<
	typeof videoVoiceoverLanguageSchema
>;

// Captured with the attempt so talking-person speech and off-camera narration
// can carry the exact script into Kling native voice control. Video extension
// narration is synthesized once across the fully joined clip.
export const videoVoiceoverSchema = z.object({
	deliveryStatus: z.enum(["delivered", "failed"]).nullish().catch(null),
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
// work is in progress; the other video kinds carry null image-source columns.
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
	// `.catch()` on durationSeconds likewise keeps a stale web bundle tolerant
	// of a newer server mid-deploy. This field is display-only, so showing the
	// wrong duration is preferable to erroring the whole card. Bundles already
	// shipped before this batch cannot be protected; deploy web first.
	durationSeconds: videoResultDurationSecondsSchema.catch(10),
	// Display name (video output tools only; animation rows stay null).
	title: z.string().nullable().catch(null),
	voiceover: videoVoiceoverSchema.nullable().catch(null),
	videoUrl: z.url().nullable(),
	videoMediaType: z.string().min(1).nullable(),
	error: z.string().nullable(),
	// Normalized failure detail (docs/features/ai-error-normalization-and-observability.md).
	failure: aiErrorDataSchema.nullable().optional(),
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
