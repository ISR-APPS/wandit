/**
 * Voiceover generation stub.
 *
 * The generate_video flow already captures the user's voiceover request
 * (language + a Brain-written script) on the media_generation_attempts row —
 * see the `voiceover` jsonb column. Actual audio synthesis and muxing land
 * with the audio-provider work (branch feat/ai-provider-openrouter): per that
 * branch's contract, media models stay on the Vercel AI Gateway, which
 * already exposes TTS today (`gateway.speech("openai/tts-1")` +
 * `experimental_generateSpeech` from `ai`), so the future service can live
 * beside TranscriptionService in the generation module and read its input
 * from the attempt row.
 *
 * Until then this flag keeps every call site honest: the clip renders
 * silent, the card says the narration script is saved, and nothing pretends
 * audio exists.
 */
export function isVoiceoverGenerationAvailable(): boolean {
	// TODO(audio-provider): flip on once TTS + muxing ship; the attempt row's
	// `voiceover` column already carries {language, script}.
	return false;
}
