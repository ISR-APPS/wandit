import { Inject, Injectable, Logger } from "@nestjs/common";
import { env } from "@wandit/env/server";
import { generateText } from "ai";

import { MeteringService } from "../../../metering/application/services/metering.service";
import {
	gatewayGenerationCaptureFromError,
	withGatewayAttribution,
} from "../../../metering/domain/gateway-metering";
import { bundledUnmeteredStepUsage } from "../../../metering/domain/metering";

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
	model: string;
	prompt: string;
	withRefinedPrompt: (refined: string) => Record<string, unknown>;
};

@Injectable()
export class HiggsfieldPromptRefinerService {
	private readonly logger = new Logger(HiggsfieldPromptRefinerService.name);

	constructor(
		@Inject(MeteringService)
		private readonly meteringService: MeteringService,
	) {}

	/**
	 * Rewrites the generation prompt inside the raw MCP arguments. Any failure
	 * degrades to the original arguments: a refinement must never block or fail
	 * a paid generation.
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

		if (!env.AI_GATEWAY_API_KEY) {
			this.logger.warn(
				"Higgsfield prompt refinement skipped: AI gateway is not configured",
			);
			return input.args;
		}

		try {
			const result = await generateText({
				maxOutputTokens: 600,
				model: env.AI_PROMPT_REFINER_MODEL,
				prompt: buildRefinementPrompt(input.toolName, target),
				providerOptions: withGatewayAttribution(
					{ openai: { reasoningEffort: "medium" } },
					{
						operation: "chat",
						organizationId: input.organizationId,
						userId: input.userId,
					},
				),
				system: HIGGSFIELD_PROMPT_REFINER_PROMPT,
			});

			if (input.parentEventId) {
				await this.captureGeneration(input.parentEventId, {
					providerMetadata: result.providerMetadata,
					stepUsage: bundledUnmeteredStepUsage("prompt_refine", result.usage),
				});
			}

			const refined = result.text.trim();

			if (!refined) {
				throw new Error("Model returned an empty generation prompt");
			}

			return target.withRefinedPrompt(refined);
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
		model: nonEmptyString(args.model) ?? PROMPT_REFINER_UNKNOWN_MODEL,
		prompt,
		withRefinedPrompt: (refined) => ({ ...args, prompt: refined }),
	};
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
