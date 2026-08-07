import { Inject, Injectable, Logger } from "@nestjs/common";
import type {
	ImageToVideoAspect,
	VideoDurationSeconds,
} from "@wandit/contracts";
import { env } from "@wandit/env/server";
import { generateText } from "ai";

import { VIDEO_NEGATIVE_PROMPT } from "../../../ai-chat/agent/site-builder/generate-video";
import { MeteringService } from "../../../metering/application/services/metering.service";
import {
	gatewayGenerationCaptureFromError,
	withGatewayAttribution,
} from "../../../metering/domain/gateway-metering";
import { bundledUnmeteredStepUsage } from "../../../metering/domain/metering";

const DIRECTOR_CAPTURE_ATTEMPTS = 3;
// Reasoning tokens count against this budget on OpenAI models — sized so
// "medium" effort thinking cannot starve the ~175-word visible prompt (the
// same failure mode project-title.service.ts documents).
const DIRECTOR_MAX_OUTPUT_TOKENS = 1_200;
// Kling caps prompts at 2 500 chars; anything near it is a runaway output.
const DIRECTOR_MAX_PROMPT_CHARS = 2_400;

/**
 * The creative-director brain: one cheap generateText call that rewrites the
 * Brain's creative brief into a single provider prompt in the target model's
 * own prompting dialect. Professional video models respond dramatically
 * better to their documented domain language (shot grammar, camera moves,
 * lighting vocabulary, element budgets) than to raw user words — this is the
 * whole reason this step exists.
 *
 * Same survival contract as HiggsfieldPromptRefinerService: any failure
 * degrades to a deterministic fallback prompt and must never block or fail a
 * paid generation.
 */
export const VIDEO_DIRECTOR_PROMPT = `You are a commercial film director and prompt engineer for AI text-to-video models.
You receive a creative brief and write ONE generation prompt for the stated target model, in that model's documented prompting dialect. The prompt is sent to the model verbatim — output ONLY the prompt text, no preamble, no quotes, no explanations.

Non-negotiables, regardless of model:
- Preserve every explicit fact in the brief: product, brand names, colors, setting, audience cues. Never invent brand names or claims.
- Describe ONE continuous shot (no cuts): subject + one precise action with a clear endpoint (e.g. "…then settles into place"), environment, camera move, lighting, mood.
- Give every motion an explicit spatial anchor ("fingers wrapped around the bottle", not "holding it") — vague spatial language causes morphing.
- The clip renders SILENT: never write dialogue, sound effects, or music cues.
- Never ask for on-screen text, captions, subtitles, UI, or watermarks; logos only if physically printed on the product itself.
- Translate the brief's VIDEO TYPE into craft: product commercial → studio or lifestyle lighting, hero product framing, macro detail, polished dolly/orbit moves; UGC/testimonial → handheld phone feel, natural window light, casual eye-level framing; cinematic brand film → anamorphic framing, film grain, dramatic key light, confident crane or tracking moves; social teaser → high-energy push-ins, bold color, fast but physically believable motion.

Dialect: Kling (klingai/*)
- Shape: Subject (specific) + Action (precise, with endpoint) + Scene (3-5 elements MAX) + Camera Language + Lighting + Atmosphere.
- 30-60 words. Never exceed 90. Budget ≤ 7 concrete nouns — more makes the render fail.
- Camera vocabulary: dolly in/out, lateral tracking shot, crane up/down, slow pan, tilt, 360 orbit, handheld, steadicam float, push-in, locked-off static; combos like "slow dolly-in with a subtle arc".
- Motion adverbs: gracefully, swiftly, gradually, smoothly, rhythmically. Atmosphere adjectives: cinematic, ultra-detailed, photorealistic, studio-quality, moody, vibrant, serene, energetic.

Dialect: Veo (google/veo*)
- Shape: [Cinematography] + [Subject] + [Action] + [Context] + [Style & Ambiance], in that order — what comes first gets the most weight.
- Up to 120 words, never more than 175. Name the shot (medium shot, extreme close-up, low angle…), the lens language (shallow depth of field, macro, anamorphic, 35mm film, slightly grainy), and the lighting (golden hour backlight, soft window light from camera left, practical neon glow, harsh fluorescent overhead).

Dialect: anything else
- Use the Veo shape with plain cinematography vocabulary and stay under 100 words.

Duration: a 5-second clip is one beat — a single action reaching its endpoint. A 10-second clip is two beats of the SAME continuous shot: establish, then evolve (a reveal, a turn, a slow push-in that lands).

If the brief mentions a voiceover, keep the imagery breathing: unhurried pacing and clean hero moments the narration can sit on.`;

export type CraftVideoPromptInput = {
	aspect: ImageToVideoAspect;
	brief: string;
	durationSeconds: VideoDurationSeconds;
	/** Resolved gateway model id the prompt targets (dialect selection). */
	model: string;
	/** Set when the generation runs in an org workspace: the org is the payer. */
	organizationId: string | null;
	parentEventId: string | undefined;
	userId: string;
	voiceoverLanguage?: string;
};

export type CraftedVideoPrompt = {
	negativePrompt: string;
	prompt: string;
	/** False when the director degraded to the deterministic fallback. */
	directed: boolean;
};

@Injectable()
export class VideoDirectorService {
	private readonly logger = new Logger(VideoDirectorService.name);

	constructor(
		@Inject(MeteringService)
		private readonly meteringService: MeteringService,
	) {}

	async craftVideoPrompt(
		input: CraftVideoPromptInput,
	): Promise<CraftedVideoPrompt> {
		if (!env.AI_GATEWAY_API_KEY) {
			this.logger.warn("Video director skipped: AI gateway is not configured");
			return fallbackPrompt(input);
		}

		try {
			const result = await generateText({
				maxOutputTokens: DIRECTOR_MAX_OUTPUT_TOKENS,
				model: env.AI_VIDEO_DIRECTOR_MODEL ?? env.AI_PROMPT_REFINER_MODEL,
				prompt: buildDirectorRequest(input),
				providerOptions: withGatewayAttribution(
					{ openai: { reasoningEffort: "medium" } },
					{
						operation: "chat",
						organizationId: input.organizationId,
						userId: input.userId,
					},
				),
				system: VIDEO_DIRECTOR_PROMPT,
			});

			// Best-effort, unlike the refiner: the crafted prompt is the product
			// here, and this capture only bundles unmetered usage into the parent
			// chat event — a bookkeeping failure must not degrade the render to
			// the fallback prompt.
			if (input.parentEventId) {
				try {
					await this.captureGeneration(input.parentEventId, {
						providerMetadata: result.providerMetadata,
						stepUsage: bundledUnmeteredStepUsage("prompt_refine", result.usage),
					});
				} catch (captureError) {
					this.logger.warn(
						`Video director usage capture failed (prompt kept): ${
							captureError instanceof Error
								? captureError.message
								: String(captureError)
						}`,
					);
				}
			}

			const prompt = result.text.trim();

			// "length" means the token budget cut the prompt mid-sentence — a
			// truncated prompt is worse than the deterministic fallback.
			if (
				!prompt ||
				result.finishReason === "length" ||
				prompt.length > DIRECTOR_MAX_PROMPT_CHARS
			) {
				throw new Error(
					`Director returned an unusable video prompt (finish: ${result.finishReason}, chars: ${prompt.length})`,
				);
			}

			return {
				directed: true,
				negativePrompt: VIDEO_NEGATIVE_PROMPT,
				prompt,
			};
		} catch (error) {
			const errorCapture = gatewayGenerationCaptureFromError(error);

			if (input.parentEventId && errorCapture) {
				try {
					await this.captureGeneration(input.parentEventId, {
						providerMetadata: errorCapture.providerMetadata,
						stepUsage: bundledUnmeteredStepUsage("prompt_refine", null),
					});
				} catch (captureError) {
					this.logger.warn(
						`Video director generation-reference capture failed: ${
							captureError instanceof Error
								? captureError.message
								: String(captureError)
						}`,
					);
				}
			}

			const message = error instanceof Error ? error.message : String(error);
			this.logger.warn(
				`Video director failed, using fallback prompt: ${message}`,
			);
			return fallbackPrompt(input);
		}
	}

	private async captureGeneration(
		usageEventId: string,
		capture: Parameters<MeteringService["captureGeneration"]>[1],
	): Promise<void> {
		let lastError: unknown;

		for (let attempt = 1; attempt <= DIRECTOR_CAPTURE_ATTEMPTS; attempt += 1) {
			try {
				const generationRef = await this.meteringService.captureGeneration(
					usageEventId,
					capture,
				);

				if (!generationRef) {
					throw new Error("AI Gateway generation id is missing");
				}

				return;
			} catch (error) {
				lastError = error;
			}
		}

		throw lastError;
	}
}

function buildDirectorRequest(input: CraftVideoPromptInput): string {
	const voiceoverLine = input.voiceoverLanguage
		? `Voiceover: a ${input.voiceoverLanguage} voiceover will be added later — leave visual room for narration.`
		: "Voiceover: none.";

	return [
		`Target model: ${input.model}`,
		`Aspect ratio: ${input.aspect}`,
		`Duration: ${input.durationSeconds} seconds`,
		voiceoverLine,
		"CREATIVE BRIEF:",
		input.brief,
	].join("\n");
}

/**
 * Deterministic degrade path: a serviceable prompt straight from the brief.
 * Worse than the director's cut, but it never blocks a paid generation.
 */
function fallbackPrompt(input: CraftVideoPromptInput): CraftedVideoPrompt {
	const brief = input.brief.replace(/\s+/g, " ").trim().slice(0, 500);

	return {
		directed: false,
		negativePrompt: VIDEO_NEGATIVE_PROMPT,
		prompt:
			`One continuous ${input.durationSeconds}-second commercial shot. ${brief} ` +
			"Cinematic, professional, ultra-detailed, photorealistic. Smooth " +
			"controlled camera move with a clear endpoint. No text overlays, no " +
			"captions, no watermarks.",
	};
}
