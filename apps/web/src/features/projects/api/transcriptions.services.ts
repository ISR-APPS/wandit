// Raw async wrapper for audio transcription — NO React in here. Posts a
// recorded audio blob as multipart/form-data (field "file") and parses the
// { text } response with the @wandit/contracts schema.

import {
	transcriptionResponseSchema,
	transcriptionsRoutes,
} from "@wandit/contracts";

import { apiClient } from "@/lib/api-client";

export async function transcribeAudio(blob: Blob, fileName: string) {
	const form = new FormData();
	form.append("file", blob, fileName);
	// Let axios set the multipart boundary itself — do not force Content-Type.
	const data = await apiClient.post<unknown>(transcriptionsRoutes.create, form);
	return transcriptionResponseSchema.parse(data);
}
