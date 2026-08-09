import {
	type TranscriptionResponse,
	transcriptionResponseSchema,
	transcriptionsRoutes,
} from "@wandit/contracts";

import { apiClient } from "@/shared/lib/api-client";

type NativeAudioUpload = {
	name: string;
	type: string;
	uri: string;
};

export async function createTranscription(
	fileUri: string,
): Promise<TranscriptionResponse> {
	const form = new FormData();
	const file: NativeAudioUpload = {
		name: "recording.m4a",
		type: "audio/mp4",
		uri: fileUri,
	};

	form.append("file", file as unknown as Blob);
	const operationId = `native-${Date.now().toString(36)}-${Math.random()
		.toString(36)
		.slice(2)}`;

	const data = await apiClient.post<TranscriptionResponse, FormData>(
		transcriptionsRoutes.create,
		form,
		{ headers: { "X-Operation-Id": operationId } },
	);

	return transcriptionResponseSchema.parse(data);
}
