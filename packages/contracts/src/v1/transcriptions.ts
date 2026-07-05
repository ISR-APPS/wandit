import { z } from "zod";

export const transcriptionResponseSchema = z.object({
	text: z.string(),
	durationSec: z.number().nonnegative().optional(),
});

export type TranscriptionResponse = z.infer<typeof transcriptionResponseSchema>;

export const transcriptionsRoutes = {
	create: "/api/v1/transcriptions",
} as const;
