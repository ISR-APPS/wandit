/**
 * Shared contract for audio transcription.
 *
 * The upload itself is multipart/form-data, so Zod does not validate the file.
 * This file validates the JSON response after the server turns audio into text.
 */
// Zod validates runtime JSON and also gives us TypeScript types.
import { z } from "zod";

// Response after the server converts audio to text.
export const transcriptionResponseSchema = z.object({
	text: z.string(),
	durationSec: z.number().nonnegative().optional(),
});

// TypeScript type created from the schema above.
export type TranscriptionResponse = z.infer<typeof transcriptionResponseSchema>;

// Route path constants. These do not make network calls by themselves.
export const transcriptionsRoutes = {
	// POST multipart/form-data with one audio file.
	create: "/api/v1/transcriptions",
} as const;
