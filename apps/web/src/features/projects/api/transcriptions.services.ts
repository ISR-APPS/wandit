/**
 * Raw HTTP wrapper for voice transcription.
 *
 * Flow position:
 * - useVoiceDictation() records microphone audio in the browser.
 * - That hook calls transcribeAudio(), which POSTs the audio blob here.
 * - NestJS is the server-side Node framework handling the transcription route.
 * - The NestJS transcriptions endpoint returns recognized text, and PromptBox
 *   appends that text to the current draft before submit.
 *
 * Gotchas:
 * - This file should not know about React, toasts, or UI state.
 * - Let the browser/client library set multipart boundaries automatically.
 */
// Raw async wrapper for audio transcription — NO React in here. Posts a
// recorded audio blob as multipart/form-data (field "file") and parses the
// { text } response with the @wandit/contracts schema.

// Zod is the runtime validation library behind @wandit/contracts; parse()
// turns unknown API JSON into a checked, typed transcription response.
import {
	transcriptionResponseSchema,
	transcriptionsRoutes,
} from "@wandit/contracts";

import { apiClient } from "@/lib/api-client";

// Upload one recorded audio blob for transcription and return the validated
// server response, usually { text, durationSec? }.
export async function transcribeAudio(blob: Blob, fileName: string) {
	// FormData is the browser's standard way to send multipart uploads, the same
	// encoding an HTML file input would use.
	const form = new FormData();
	form.append("file", blob, fileName);
	// Let axios set the multipart boundary itself — do not force Content-Type.
	const operationId = globalThis.crypto.randomUUID();
	const data = await apiClient.post<unknown>(
		transcriptionsRoutes.create,
		form,
		{
			headers: { "X-Operation-Id": operationId },
		},
	);
	// Validate the server response before handing text back to PromptBox.
	return transcriptionResponseSchema.parse(data);
}
