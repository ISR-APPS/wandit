import { gateway } from "@ai-sdk/gateway";
import { Injectable } from "@nestjs/common";
import type { VideoVoiceoverLanguage } from "@wandit/contracts";
import { experimental_generateSpeech } from "ai";

import { VOICEOVER_TTS_MODEL } from "../../../media-generations/domain/voiceover-models";
import {
	type GatewayMeteringContext,
	withGatewayAttribution,
} from "../../../metering/domain/gateway-metering";

export type SynthesizedVoiceover = {
	bytes: Uint8Array;
	mediaType: string;
};

@Injectable()
export class SpeechService {
	async synthesizeVoiceover(input: {
		abortSignal?: AbortSignal;
		language: VideoVoiceoverLanguage;
		metering: GatewayMeteringContext<"video">;
		script: string;
	}): Promise<SynthesizedVoiceover> {
		const result = await experimental_generateSpeech({
			...(input.abortSignal ? { abortSignal: input.abortSignal } : {}),
			language: input.language,
			maxRetries: 0,
			model: gateway.speech(VOICEOVER_TTS_MODEL),
			outputFormat: "mp3",
			providerOptions: withGatewayAttribution({}, input.metering),
			text: input.script,
		});

		return {
			bytes: result.audio.uint8Array,
			mediaType: result.audio.mediaType,
		};
	}
}
