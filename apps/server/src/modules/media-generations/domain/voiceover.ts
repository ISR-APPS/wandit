/**
 * Voiceover availability seam.
 *
 * Text-to-video narration renders natively through the AI Gateway's Kling 3.0
 * voice-control path. Video extensions use SpeechService plus ffmpeg muxing
 * because one narration track must span the source clip and every added leg.
 */
export function isVoiceoverGenerationAvailable(): boolean {
	return true;
}
