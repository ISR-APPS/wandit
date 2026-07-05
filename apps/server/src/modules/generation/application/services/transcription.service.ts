import { Injectable } from "@nestjs/common";
import type { TranscriptionResponse } from "@wandit/contracts";
import { env } from "@wandit/env/server";
import { transcribe } from "ai";

import { AiGatewayNotConfiguredError } from "../../domain/errors/ai-gateway-not-configured.error";

@Injectable()
export class TranscriptionService {
	async transcribeAudio(input: {
		audio: Buffer;
		mimeType: string;
	}): Promise<TranscriptionResponse> {
		this.assertGatewayConfigured();

		const result = await transcribe({
			audio: input.audio,
			headers: {
				"Content-Type": input.mimeType,
			},
			model: env.AI_TRANSCRIPTION_MODEL,
		});

		return {
			...(result.durationInSeconds !== undefined
				? { durationSec: result.durationInSeconds }
				: {}),
			text: result.text,
		};
	}

	private assertGatewayConfigured() {
		if (!env.AI_GATEWAY_API_KEY) {
			throw new AiGatewayNotConfiguredError();
		}
	}
}
