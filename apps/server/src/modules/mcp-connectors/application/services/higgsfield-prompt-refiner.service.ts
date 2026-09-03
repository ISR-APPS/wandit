import { Inject, Injectable, Logger } from "@nestjs/common";
import { env } from "@wandit/env/server";
import { generateText } from "ai";
import {
	createLlmModel,
	hasLlmProviderKey,
	withLlmAttribution,
} from "../../../ai-provider/domain/llm-provider";
import { VideoDirectorService } from "../../../media-generations/application/services/video-director";
import { MeteringService } from "../../../metering/application/services/metering.service";
import { llmGenerationCaptureFromError } from "../../../metering/domain/gateway-metering";
import { helperStepUsage } from "../../../metering/domain/metering";

const PROMPT_REFINER_CAPTURE_ATTEMPTS = 3;
const PROMPT_REFINER_UNKNOWN_MODEL = "unknown";

export const HIGGSFIELD_PROMPT_REFINER_PROMPT = `You are a prompt engineer for AI image and video generation.
You receive a user's raw request and rewrite it into one polished, concrete generation prompt for the stated medium.
Preserve every explicit constraint the user gave: subject, any text to render (keep its exact wording and language), brand names, colors, style, aspect, mood, and count of subjects.
Add only what improves output quality: composition, lighting, materials, textures, camera framing, and for video: motion, pacing, and camera movement.
Never invent brand names, on-image text, watermarks, or logos the user did not ask for. Never change the subject.
Output ONLY the rewritten prompt text - no preamble, no quotes, no explanations. Keep it under 120 words.`;

type HiggsfieldPromptRefinerInput = {
	args: unknown;
	/** Set when the generation runs in an org workspace: the org is the payer. */
	organizationId: string | null;
	parentEventId: string | undefined;
	toolName: "generate_image" | "generate_video";
	userId: string;
};

type PromptTarget = {
	aspectRatio?: string;
	bypassVideoDirector?: boolean;
	durationSeconds?: number;
	model: string;
	prompt: string;
	referenceMediaCount?: number;
	talking?: boolean;
	voiceoverLanguage?: string;
	voiceoverScript?: string;
	withRefinedPrompt: (refined: string) => Record<string, unknown>;
};

@Injectable()
export class HiggsfieldPromptRefinerService {
	private readonly logger = new Logger(HiggsfieldPromptRefinerService.name);

	constructor(
		@Inject(MeteringService)
		private readonly meteringService: MeteringService,
		@Inject(VideoDirectorService)
		private readonly videoDirector: VideoDirectorService,
	) {}

	/**
	 * Rewrites the generation prompt inside the raw MCP arguments. Any failure
	 * degrades to the original arguments: a refinement must never block or fail
	 * a paid generation.
	 *
	 * New-video prompts do NOT use the generic refiner below: they go through
	 * the one creative director (VideoDirectorService) so a Higgsfield render
	 * and a gateway render use the same brain. Surgical edit instructions bypass
	 * all rewriting because the provider must receive them verbatim.
	 */
	async refineGenerationArgs(
		input: HiggsfieldPromptRefinerInput,
	): Promise<unknown> {
		if (!isRecord(input.args)) {
			return input.args;
		}

		const target = locatePromptTarget(input.args);

		if (!target) {
			return input.args;
		}

		if (input.toolName === "generate_video") {
			if (target.bypassVideoDirector) {
				return input.args;
			}

			// craftConnectorVideoPrompt never throws — it degrades to its own
			// deterministic fallback, which still wraps the brief.
			const crafted = await this.videoDirector.craftConnectorVideoPrompt({
				aspect: target.aspectRatio,
				brief: target.prompt,
				durationSeconds: target.durationSeconds,
				model: target.model,
				organizationId: input.organizationId,
				parentEventId: input.parentEventId,
				referenceMediaCount: target.referenceMediaCount,
				...(target.talking === undefined ? {} : { talking: target.talking }),
				userId: input.userId,
				...(target.voiceoverLanguage
					? { voiceoverLanguage: target.voiceoverLanguage }
					: {}),
				...(target.voiceoverScript
					? { voiceoverScript: target.voiceoverScript }
					: {}),
			});

			return target.withRefinedPrompt(crafted.prompt);
		}

		if (!hasLlmProviderKey("prompt_refine")) {
			this.logger.warn(
				"Higgsfield prompt refinement skipped: AI provider is not configured",
			);
			return input.args;
		}

		const meteringContext = {
			operation: "chat" as const,
			organizationId: input.organizationId,
			userId: input.userId,
		};

		try {
			const result = await generateText({
				maxOutputTokens: 600,
				model: createLlmModel(env.AI_PROMPT_REFINER_MODEL, {
					context: meteringContext,
					reasoningEffort: "medium",
					task: "prompt_refine",
				}),
				prompt: buildRefinementPrompt(input.toolName, target),
				providerOptions: withLlmAttribution(
					{ openai: { reasoningEffort: "medium" } },
					meteringContext,
					"prompt_refine",
				),
				system: HIGGSFIELD_PROMPT_REFINER_PROMPT,
				telemetry: { functionId: "connector.prompt_refine" },
			});

			if (input.parentEventId) {
				await this.captureGeneration(input.parentEventId, {
					providerMetadata: result.providerMetadata,
					stepUsage: helperStepUsage("prompt_refine", result.usage),
				});
			}

			const refined = result.text.trim();

			if (!refined) {
				throw new Error("Model returned an empty generation prompt");
			}

			return target.withRefinedPrompt(refined);
		} catch (error) {
			const errorCapture = llmGenerationCaptureFromError(error);

			if (input.parentEventId && errorCapture) {
				try {
					await this.captureGeneration(input.parentEventId, {
						providerMetadata: errorCapture.providerMetadata,
						stepUsage: helperStepUsage("prompt_refine", null),
					});
				} catch (captureError) {
					this.logger.warn(
						`Higgsfield prompt refinement generation-reference capture failed: ${
							captureError instanceof Error
								? captureError.message
								: String(captureError)
						}`,
					);
				}
			}

			const message = error instanceof Error ? error.message : String(error);
			this.logger.warn(`Higgsfield prompt refinement failed: ${message}`);
			return input.args;
		}
	}

	private async captureGeneration(
		usageEventId: string,
		capture: Parameters<MeteringService["captureGeneration"]>[1],
	): Promise<void> {
		let lastError: unknown;

		for (
			let attempt = 1;
			attempt <= PROMPT_REFINER_CAPTURE_ATTEMPTS;
			attempt += 1
		) {
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

/**
 * Higgsfield takes a single `params` property that is either an object or a
 * JSON string. Only the prompt inside it is rewritten; every sibling key
 * (model, count, aspect_ratio, medias, duration, preset_id…) is carried over
 * untouched.
 */
function locatePromptTarget(
	args: Record<string, unknown>,
): PromptTarget | null {
	const params = args.params;

	if (isRecord(params)) {
		const prompt = nonEmptyString(params.prompt);

		if (!prompt) {
			return null;
		}

		return {
			...promptContext(params),
			model: nonEmptyString(params.model) ?? PROMPT_REFINER_UNKNOWN_MODEL,
			prompt,
			withRefinedPrompt: (refined) => ({
				...args,
				params: { ...params, prompt: refined },
			}),
		};
	}

	if (typeof params === "string") {
		const parsed = parseJsonRecord(params);

		if (!parsed) {
			return null;
		}

		const prompt = nonEmptyString(parsed.prompt);

		if (!prompt) {
			return null;
		}

		return {
			...promptContext(parsed),
			model: nonEmptyString(parsed.model) ?? PROMPT_REFINER_UNKNOWN_MODEL,
			prompt,
			withRefinedPrompt: (refined) => ({
				...args,
				params: JSON.stringify({ ...parsed, prompt: refined }),
			}),
		};
	}

	if (params !== undefined) {
		return null;
	}

	const prompt = nonEmptyString(args.prompt);

	if (!prompt) {
		return null;
	}

	return {
		...promptContext(args),
		model: nonEmptyString(args.model) ?? PROMPT_REFINER_UNKNOWN_MODEL,
		prompt,
		withRefinedPrompt: (refined) => ({ ...args, prompt: refined }),
	};
}

/**
 * Read-only view of the generation prompt inside raw MCP arguments — the
 * brief gate in mcp-chat-tools uses it to inspect a call before any LLM
 * rewrite or reservation happens.
 */
export function locateGenerationPrompt(args: unknown): string | null {
	if (!isRecord(args)) {
		return null;
	}

	return locatePromptTarget(args)?.prompt ?? null;
}

// Media roles that carry sound or motion, not a visual frame: a call whose
// only references are these has NO existing first frame, and the director
// must not be told to "write motion-first from that frame".
const FRAMELESS_MEDIA_ROLE = /audio|voice|sound|music|motion|video/i;

/**
 * Aspect/duration/reference-media context carried next to the prompt
 * (free-form values). `referenceMediaCount` counts only frame-carrying
 * `medias` entries (start_image, image, end_image…): those mean the call
 * animates an existing frame, and the director must know, or it rewrites the
 * brief as a from-scratch text-to-video scene. Audio/motion references never
 * count — they add sound or movement to a render that still needs its scene
 * described in full.
 */
function promptContext(record: Record<string, unknown>): {
	aspectRatio?: string;
	bypassVideoDirector?: boolean;
	durationSeconds?: number;
	referenceMediaCount?: number;
	talking?: boolean;
	voiceoverLanguage?: string;
	voiceoverScript?: string;
} {
	const aspectRatio = nonEmptyString(record.aspect_ratio);
	const duration =
		typeof record.duration === "number" && Number.isFinite(record.duration)
			? record.duration
			: typeof record.duration === "string" &&
					Number.isFinite(Number(record.duration))
				? Number(record.duration)
				: undefined;
	const referenceMediaCount = Array.isArray(record.medias)
		? record.medias.filter((media) => {
				const role = isRecord(media) ? media.role : undefined;
				return typeof role !== "string" || !FRAMELESS_MEDIA_ROLE.test(role);
			}).length
		: 0;
	const talking =
		typeof record.talking === "boolean" ? record.talking : undefined;
	const voiceoverLanguage = nonEmptyString(record.voiceoverLanguage);
	const voiceoverScript = nonEmptyString(record.voiceoverScript);

	return {
		...(aspectRatio ? { aspectRatio } : {}),
		...(isVideoEditCall(record) ? { bypassVideoDirector: true } : {}),
		...(duration && duration > 0 ? { durationSeconds: duration } : {}),
		...(referenceMediaCount > 0 ? { referenceMediaCount } : {}),
		...(talking === undefined ? {} : { talking }),
		...(voiceoverLanguage ? { voiceoverLanguage } : {}),
		...(voiceoverScript ? { voiceoverScript } : {}),
	};
}

/**
 * Accept singular, plural, snake-case, kebab-case, and camel-case spellings for
 * the video-reference role. Compacting the token keeps edit detection stable
 * without treating an ordinary video or motion reference as a surgical edit.
 */
function isVideoEditCall(record: Record<string, unknown>): boolean {
	if (compactProviderToken(record.mode) === "videoedit") {
		return true;
	}

	return (
		Array.isArray(record.medias) &&
		record.medias.some((media) => {
			if (!isRecord(media)) {
				return false;
			}

			const role = compactProviderToken(media.role);

			return role === "videoreference" || role === "videoreferences";
		})
	);
}

function compactProviderToken(value: unknown): string | null {
	return typeof value === "string"
		? value
				.trim()
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, "")
		: null;
}

function buildRefinementPrompt(
	toolName: HiggsfieldPromptRefinerInput["toolName"],
	target: PromptTarget,
): string {
	const medium = toolName === "generate_video" ? "video" : "image";

	return `Medium: ${medium}\nTarget model: ${target.model}\nUser request:\n${target.prompt}`;
}

function parseJsonRecord(value: string): Record<string, unknown> | null {
	try {
		const parsed: unknown = JSON.parse(value);

		return isRecord(parsed) ? parsed : null;
	} catch {
		return null;
	}
}

function nonEmptyString(value: unknown): string | null {
	return typeof value === "string" && value.trim() ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
