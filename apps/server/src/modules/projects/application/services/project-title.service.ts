import { Inject, Injectable, Logger } from "@nestjs/common";
import type { FileRef } from "@wandit/contracts";
import { env } from "@wandit/env/server";
import { generateText } from "ai";
import {
	createLlmModel,
	hasLlmProviderKey,
	withLlmAttribution,
} from "../../../ai-provider/domain/llm-provider";
import { MeteringService } from "../../../metering/application/services/metering.service";
import { llmGenerationCaptureFromError } from "../../../metering/domain/gateway-metering";
import { helperStepUsage } from "../../../metering/domain/metering";

const DEFAULT_PROJECT_TITLE_MODEL = "deepseek/deepseek-v4-flash";
const PROJECT_TITLE_MAX_LENGTH = 60;
const PROJECT_TITLE_SOURCE_MAX_LENGTH = 600;
const PROJECT_TITLE_TIMEOUT_MS = 10_000;
const PROJECT_TITLE_CAPTURE_ATTEMPTS = 3;
const BIDI_FORMAT_MARKS = /[\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069]/gu;

export const PROJECT_TITLE_PROMPT = `Generate a short project title from the user's request or attachment filenames.

Requirements:
- Use 3-6 words.
- Write in the same language, dialect, and script as the user's message or, when no message is present, the attachment filenames. Keep Arabic in Arabic, French in French, and Algerian Darija in Darija.
- Name the business, brand, or product when present.
- Return plain text only.
- Do not use surrounding quotes, backticks, emoji, or trailing punctuation.
- Do not explain your answer.`;

type ProjectTitleInput = {
	attachments?: FileRef[];
	fallbackTitle: string;
	/** Set when the project lives in an org workspace: the org is the payer. */
	organizationId?: string | null;
	prompt: string;
	usageEventId?: string;
	userId: string;
};

@Injectable()
export class ProjectTitleService {
	private readonly logger = new Logger(ProjectTitleService.name);

	constructor(
		@Inject(MeteringService)
		private readonly meteringService: MeteringService,
	) {}

	async generate(input: ProjectTitleInput): Promise<string> {
		try {
			return await this.generateTitle(input);
		} finally {
			if (input.usageEventId) {
				await this.meteringService.completeBundledReservation(
					input.usageEventId,
				);
			}
		}
	}

	private async generateTitle(input: ProjectTitleInput): Promise<string> {
		const generationPrompt = buildGenerationPrompt(input);

		if (!generationPrompt) {
			this.logger.warn(
				"Project title generation skipped: no prompt or attachment filename",
			);
			return input.fallbackTitle;
		}

		const model = env.AI_TITLE_MODEL ?? DEFAULT_PROJECT_TITLE_MODEL;

		if (!hasLlmProviderKey("project_title") || !model) {
			this.logger.warn(
				"Project title generation skipped: AI provider is not configured",
			);
			return input.fallbackTitle;
		}

		const meteringContext = {
			operation: "chat" as const,
			organizationId: input.organizationId ?? null,
			userId: input.userId,
		};

		try {
			const result = await generateText({
				abortSignal: AbortSignal.timeout(PROJECT_TITLE_TIMEOUT_MS),
				// Generous on purpose: a reasoning model configured via
				// AI_TITLE_MODEL spends thinking tokens from this same budget, and
				// an exhausted budget returns an empty title (finish "length").
				maxOutputTokens: 800,
				model: createLlmModel(model, {
					context: meteringContext,
					reasoningEffort: "low",
					task: "project_title",
				}),
				prompt: generationPrompt,
				// A title needs no deliberation. Only OpenAI models read this key;
				// every other provider ignores it.
				providerOptions: withLlmAttribution(
					{ openai: { reasoningEffort: "low" } },
					meteringContext,
					"project_title",
				),
				system: PROJECT_TITLE_PROMPT,
			});

			if (input.usageEventId) {
				await this.captureGeneration(input.usageEventId, {
					providerMetadata: result.providerMetadata,
					stepUsage: helperStepUsage("project_title", result.usage),
				});
			}

			const title = sanitizeProjectTitle(result.text);

			if (!title) {
				throw new Error("Model returned an empty project title");
			}

			return title;
		} catch (error) {
			const errorCapture = llmGenerationCaptureFromError(error);

			if (input.usageEventId && errorCapture) {
				try {
					await this.captureGeneration(input.usageEventId, {
						providerMetadata: errorCapture.providerMetadata,
						stepUsage: helperStepUsage("project_title", null),
					});
				} catch (captureError) {
					this.logger.warn(
						`Project title generation-reference capture failed: ${
							captureError instanceof Error
								? captureError.message
								: String(captureError)
						}`,
					);
				}
			}

			const message = error instanceof Error ? error.message : String(error);
			this.logger.warn(`Project title generation failed: ${message}`);
			return input.fallbackTitle;
		}
	}

	private async captureGeneration(
		usageEventId: string,
		capture: Parameters<MeteringService["captureGeneration"]>[1],
	): Promise<void> {
		let lastError: unknown;

		for (
			let attempt = 1;
			attempt <= PROJECT_TITLE_CAPTURE_ATTEMPTS;
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

function buildGenerationPrompt(input: ProjectTitleInput): string | null {
	const prompt = normalizeWhitespace(input.prompt);

	if (prompt) {
		return `User message:\n${prompt.slice(0, PROJECT_TITLE_SOURCE_MAX_LENGTH)}`;
	}

	const filenames = (input.attachments ?? [])
		.flatMap((attachment) =>
			attachment.filename ? [attachment.filename.trim()] : [],
		)
		.filter(Boolean)
		.join(", ");

	if (!filenames) {
		return null;
	}

	return `Attachment filenames:\n${normalizeWhitespace(filenames).slice(
		0,
		PROJECT_TITLE_SOURCE_MAX_LENGTH,
	)}`;
}

function sanitizeProjectTitle(value: string): string {
	const unwrapped = value
		.replace(BIDI_FORMAT_MARKS, "")
		.trim()
		.replace(/^["'`“”‘’«»]+/u, "")
		.replace(/["'`“”‘’«»]+$/u, "")
		.trim();
	const normalized = normalizeWhitespace(unwrapped);

	if (normalized.length <= PROJECT_TITLE_MAX_LENGTH) {
		return normalized;
	}

	const candidate = normalized.slice(0, PROJECT_TITLE_MAX_LENGTH + 1);
	const boundary = candidate.lastIndexOf(" ");

	return boundary > 0
		? candidate.slice(0, boundary)
		: normalized.slice(0, PROJECT_TITLE_MAX_LENGTH);
}

function normalizeWhitespace(value: string): string {
	return value.replace(/\s+/g, " ").trim();
}
