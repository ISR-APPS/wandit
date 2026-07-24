import { z } from "zod";

import { creativeSpecSchema } from "./creative-spec";

/**
 * V2 is snapshotted when the Brain queues a build. creativeCapsule and
 * creativeSpec are absent until the queued Art Director succeeds, then
 * persisted back into the same mutable attempt row before the Builder starts.
 */
export const pageAttemptSpecV2Schema = z.object({
	artDirectorExtractionSystemPrompt: z.string().min(1).optional(),
	artDirectorModel: z.string().min(1),
	artDirectorSystemPrompt: z.string().min(1),
	brief: z.string().min(1),
	creativeCapsule: z.string().min(1).optional(),
	creativeSpec: creativeSpecSchema.optional(),
	designerSystemPrompt: z.string().min(1),
	title: z.string().min(1),
	version: z.literal(2),
});

/**
 * Attempts queued before the Art Director pipeline shipped already contain a
 * combined factual + visual brief. They bypass the new call but stay valid.
 */
export const legacyPageAttemptSpecSchema = z.object({
	brief: z.string().min(1),
	designerSystemPrompt: z.string().min(1),
	title: z.string().min(1),
	version: z.never().optional(),
});

export const pageAttemptSpecSchema = z.union([
	pageAttemptSpecV2Schema,
	legacyPageAttemptSpecSchema,
]);

export type PageAttemptSpecV2 = z.infer<typeof pageAttemptSpecV2Schema>;
export type PageAttemptSpec = z.infer<typeof pageAttemptSpecSchema>;
