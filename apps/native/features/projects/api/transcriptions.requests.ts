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

	const data = await apiClient.post<TranscriptionResponse, FormData>(
		transcriptionsRoutes.create,
		form,
	);

	return transcriptionResponseSchema.parse(data);
}
