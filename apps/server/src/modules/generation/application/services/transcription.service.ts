/**
 * Turns uploaded audio into text.
 *
 * The controller reads the uploaded file. This service sends the audio bytes to
 * the AI transcription model and returns the text.
 *
 * Note: we call the gateway model directly instead of the `transcribe()` helper
 * from the `ai` package. The helper guesses the audio format by looking at the
 * first bytes of the file, but its lookup table has a bug: it expects m4a files
 * to start with "ftyp", while real m4a files start with a 4-byte size first.
 * The guess then falls back to "audio/wav", and the gateway rejects the request
 * with "This model does not support the format you provided". We already know
 * the real content type from the upload, so we pass it ourselves.
 */
import { gateway } from "@ai-sdk/gateway";
import { Injectable } from "@nestjs/common";
// Shared response type used by API and frontend.
import type { TranscriptionResponse } from "@wandit/contracts";
// Typed environment values, including model name and API key.
import { env } from "@wandit/env/server";

import { AiGatewayNotConfiguredError } from "../../domain/errors/ai-gateway-not-configured.error";

// `@Injectable()` lets the controller inject this service.
@Injectable()
export class TranscriptionService {
	// Run one transcription request.
	async transcribeAudio(input: {
		audio: Buffer;
		mimeType: string;
	}): Promise<TranscriptionResponse> {
		// Fail early if the server is missing the AI API key.
		this.assertGatewayConfigured();

		// Resolve the configured model on the gateway and send the audio bytes
		// together with the real content type from the upload.
		const model = gateway.transcriptionModel(env.AI_TRANSCRIPTION_MODEL);
		const result = await model.doGenerate({
			audio: input.audio,
			mediaType: normalizeAudioMediaType(input.mimeType),
		});

		// The provider may or may not return duration.
		return {
			...(result.durationInSeconds != null
				? { durationSec: result.durationInSeconds }
				: {}),
			text: result.text,
		};
	}

	// Shared config check for this service.
	private assertGatewayConfigured() {
		if (!env.AI_GATEWAY_API_KEY) {
			throw new AiGatewayNotConfiguredError();
		}
	}
}

// Clean up the client-provided content type before sending it to the gateway.
function normalizeAudioMediaType(mimeType: string): string {
	// Browsers often add codec details ("audio/webm;codecs=opus") — drop them.
	const bareType = mimeType.split(";")[0]?.trim().toLowerCase() ?? mimeType;

	// Common aliases for AAC-in-MP4 audio map to the one name the gateway knows.
	if (
		bareType === "audio/m4a" ||
		bareType === "audio/x-m4a" ||
		bareType === "audio/aac"
	) {
		return "audio/mp4";
	}

	return bareType;
}
