/**
 * Wire contract for the host tools the builder-turn task hands to the
 * harness. The AI SDK parses each tool call with the input schema; the
 * output schema types the result the tool returns. The sandbox never
 * sees them.
 */
import { z } from "zod";

// The literal list mirrors `BUILD_IMAGE_ASPECTS` in the V1 site builder
// (apps/server/src/modules/ai-chat/agent/site-builder/generate-image.ts):
// gpt-image-class models accept exact sizes, not free aspect ratios.
const hostImageAspects = ["1:1", "2:3", "3:2", "4:5", "16:9"] as const;

/**
 * Input of the `generate_image` host tool. `path` stays a plain string
 * here; the tool validates the prefix rules before it reserves credits.
 */
export const generateImageHostToolInputSchema = z.object({
	prompt: z.string().min(1).max(2000),
	aspect: z.enum(hostImageAspects),
	// Project-relative image target; the tool rejects `..` and absolute paths.
	path: z.string().min(1),
	// User photo URLs to edit instead of a text-only generation. The edit
	// model takes at most 4 sources.
	sourceImageUrls: z.array(z.url()).max(4).optional(),
});

/** Parsed `generate_image` input; the tool execute body reads this shape. */
export type GenerateImageHostToolInput = z.infer<
	typeof generateImageHostToolInputSchema
>;

/**
 * Output of the `generate_image` host tool. `path` is the final
 * project-relative file the task wrote into the sandbox; it can differ
 * from the requested path when the extension did not match the media type.
 */
export const generateImageHostToolOutputSchema = z.discriminatedUnion(
	"status",
	[
		z.object({
			status: z.literal("generated"),
			url: z.string(),
			width: z.number().int().nonnegative(),
			height: z.number().int().nonnegative(),
			path: z.string(),
		}),
		z.object({
			status: z.literal("failed"),
			message: z.string(),
		}),
		z.object({
			status: z.literal("unavailable"),
			message: z.string(),
		}),
	],
);

/** Parsed `generate_image` output; the union of the three statuses. */
export type GenerateImageHostToolOutput = z.infer<
	typeof generateImageHostToolOutputSchema
>;
