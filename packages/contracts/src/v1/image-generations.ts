/**
 * Standalone image generation contracts (the chat's generate_image tool —
 * distinct from the images the site builder makes inside a page build).
 *
 * Generation can start from text alone or EDIT user-uploaded source images
 * (product photo, logo) so the output stays faithful to the real product.
 * The chat card polls the attempt route until it reaches a terminal state.
 */
import { z } from "zod";
import { mediaGenerationStatusSchema } from "./media-generations";
import { isoDateTimeSchema, uuidSchema } from "./shared/primitives";

export const IMAGE_GENERATION_ASPECTS = [
	"1:1",
	"3:2",
	"2:3",
	"4:3",
	"4:5",
	"9:16",
	"16:9",
] as const;

export const imageGenerationAspectSchema = z.enum(IMAGE_GENERATION_ASPECTS);

export type ImageGenerationAspect = z.infer<typeof imageGenerationAspectSchema>;

// Hard cap per attempt — image calls are the most expensive quick action.
export const MAX_IMAGES_PER_GENERATION = 4;

export const generatedImageSchema = z.object({
	// Added after launch; old durable rows intentionally omit it.
	index: z.number().int().min(1).max(MAX_IMAGES_PER_GENERATION).optional(),
	mediaType: z.string().min(1),
	url: z.url(),
});

export type GeneratedImage = z.infer<typeof generatedImageSchema>;

export const imageGenerationPlacementStatusSchema = z.object({
	status: z.enum(["pending", "applied", "failed"]),
});

export type ImageGenerationPlacementStatus = z.infer<
	typeof imageGenerationPlacementStatusSchema
>;

export const imageGenerationAttemptSchema = z.object({
	id: uuidSchema,
	status: mediaGenerationStatusSchema,
	title: z.string().min(1),
	prompt: z.string(),
	aspect: imageGenerationAspectSchema,
	count: z.number().int().min(1).max(MAX_IMAGES_PER_GENERATION),
	sourceImageUrls: z.array(z.url()),
	// Partial progress may be present while generating. Entries are sorted by
	// optional 1-based index and may omit failed slots; old rows are positional.
	images: z.array(generatedImageSchema).nullable(),
	// Present only when generate_image was asked to replace a page image.
	placement: imageGenerationPlacementStatusSchema.optional(),
	error: z.string().nullable(),
	createdAt: isoDateTimeSchema,
	completedAt: isoDateTimeSchema.nullable(),
});

export type ImageGenerationAttempt = z.infer<
	typeof imageGenerationAttemptSchema
>;

export const imageGenerationsRoutes = {
	/** GET — one attempt's status (poll while queued/generating). */
	attempt: (attemptId: string) => `/api/v1/image-generations/${attemptId}`,
	/** GET — ownership-checked download of one finished image (1-based index). */
	download: (attemptId: string, index: number) =>
		`/api/v1/image-generations/${attemptId}/download/${index}`,
} as const;
