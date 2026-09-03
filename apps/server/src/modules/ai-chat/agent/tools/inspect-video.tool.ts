/**
 * inspect_video — watches a video the user attached and turns it into an
 * advisory creative-direction brief for generate_video.
 *
 * The URL allowlist comes from the validated transcript. Exact equality is
 * intentional: the Brain may inspect only a video attached in this
 * conversation, never an arbitrary URL it invents.
 */
import { Logger } from "@nestjs/common";
import {
	type InspectVideoInput,
	type InspectVideoOutput,
	inspectVideoInputSchema,
	inspectVideoOutputSchema,
} from "@wandit/contracts";
import { env } from "@wandit/env/server";
import { generateText, type Tool, tool } from "ai";

import {
	createLlmModel,
	withLlmAttribution,
} from "../../../ai-provider/domain/llm-provider";
import type { MeteringService } from "../../../metering/application/services/metering.service";
import { llmGenerationCaptureFromError } from "../../../metering/domain/gateway-metering";
import {
	type CapturedGeneration,
	helperStepUsage,
} from "../../../metering/domain/metering";

const INSPECT_VIDEO_CAPTURE_ATTEMPTS = 3;
const INSPECT_VIDEO_MAX_OUTPUT_TOKENS = 3_000;
const inspectVideoLogger = new Logger("inspect-video");

export const INSPECT_VIDEO_SYSTEM_PROMPT = `You are a senior commercial video director analyzing a reference video's image and audio track. Turn only what you can see and hear into a production brief for a text-to-video generator.

The generator's hard limits:
- It renders one clip lasting exactly 5, 10, or 15 seconds.
- Aspect ratio is exactly 16:9, 9:16, or 1:1.
- It supports an optional single talking presenter, optional multi-shot structure, and optional single whole-video voiceover script in English, French, or Arabic.
- A voiceover script is at most 600 characters and should fit the clip at about 2.4 words per second.

The requested focus changes what you prioritize:
- motion: camera movement, subject motion, pacing, and cuts.
- style: color grading, lighting, mood, texture, and era.
- structure: narrative beats, shot order, and hook/reveal/CTA rhythm.
- product: how the product is presented, including angles, hands, context, and visible claims.

Write a concrete creative-direction brief that can drive generate_video. State the VIDEO TYPE inside the brief's prose. Preserve the reference's important subject, action, composition, visual style, and pacing, emphasizing the requested focus. Describe only what is visible or audible. When a camera technique is uncertain, use honest plain language such as "camera moves closer" instead of guessing a technical label.

Sound law:
- Generated clips are silent unless there is a talking presenter or one voiceover script.
- Never invent a music field. Describe reference music only as mood adjectives inside the prose brief.
- If the reference has meaningful speech, propose either one talking presenter or one whole-video voiceover script in the correct language. Never split narration across shots.
- If the reference has no meaningful speech to reproduce, state in the brief that the generated clip should stay silent.

Tier law: talking, narration, multi-shot, or a 15-second duration requires quality "max". Otherwise use quality "standard".

Long-reference law: if the reference runs longer than 15 seconds, also return a timestamped shotList covering its beats. Each beat has start and end seconds, a one-line description, and whether someone talks on camera. In that case the brief describes the overall arc; do not silently compress a long reference into one 15-second clip. If the reference is 15 seconds or shorter, omit shotList.

Return strict JSON only, with no markdown fences or commentary, in exactly this shape (optional keys may be omitted):
{
  "brief": "creative-direction prose with the VIDEO TYPE stated inside it",
  "suggested": {
    "aspect": "16:9" | "9:16" | "1:1",
    "durationSeconds": 5 | 10 | 15,
    "quality": "standard" | "max",
    "talking": boolean,
    "multiShot": boolean
  },
  "shotList"?: [
    {
      "startSeconds": number,
      "endSeconds": number,
      "description": "short one-line description",
      "talking": boolean
    }
  ],
  "voiceoverScript"?: "one whole-video script, at most 600 characters",
  "voiceoverLanguage"?: "en" | "fr" | "ar"
}`;

export type AvailableVideo = {
	filename?: string;
	mediaType?: string;
	url: string;
};

export type InspectVideoToolDeps = {
	availableVideos: readonly AvailableVideo[];
	meteringService: MeteringService;
	organizationId?: string | null;
	parentEventId?: string;
	userId: string;
};

export function createInspectVideoTool(
	deps: InspectVideoToolDeps,
): Tool<InspectVideoInput, InspectVideoOutput> {
	return tool({
		description:
			"Analyze a video the user attached when they want a new video informed " +
			"by its motion, style, structure, or product presentation. Pass the " +
			"exact URL from the video's attachment marker and choose the focus that " +
			"best matches what the user cares about. The result is advisory input " +
			"for generate_video; use its brief and suggested settings rather than " +
			"guessing from the filename.",
		inputSchema: inspectVideoInputSchema,
		outputSchema: inspectVideoOutputSchema,
		execute: async (input, options): Promise<InspectVideoOutput> => {
			const attached = deps.availableVideos.find(
				(video) => video.url === input.url,
			);

			if (!attached) {
				return {
					message: "This URL is not a video attached in this conversation.",
					status: "unavailable",
				};
			}

			const meteringContext = {
				operation: "chat" as const,
				organizationId: deps.organizationId ?? null,
				userId: deps.userId,
			};

			try {
				const result = await generateText({
					abortSignal: options.abortSignal,
					maxOutputTokens: INSPECT_VIDEO_MAX_OUTPUT_TOKENS,
					messages: [
						{
							content: [
								{
									data: attached.url,
									mediaType: attached.mediaType || "video/mp4",
									type: "file",
								},
								{
									text:
										"Analyze this full reference video and its audio track. " +
										`Primary focus: ${input.focus}. Return the required JSON only.`,
									type: "text",
								},
							],
							role: "user",
						},
					],
					model: createLlmModel(env.AI_VIDEO_INSPECT_MODEL, {
						context: meteringContext,
						task: "video_inspect",
					}),
					providerOptions: withLlmAttribution(
						{},
						meteringContext,
						"video_inspect",
					),
					system: INSPECT_VIDEO_SYSTEM_PROMPT,
					telemetry: { functionId: "video.inspect" },
				});

				await captureGenerationSafely(deps, {
					providerMetadata: result.providerMetadata,
					stepUsage: helperStepUsage("video_inspect", result.usage),
				});

				return parseInspectVideoResponse(result.text);
			} catch (error) {
				const errorCapture = llmGenerationCaptureFromError(error);

				if (errorCapture) {
					await captureGenerationSafely(deps, {
						providerMetadata: errorCapture.providerMetadata,
						stepUsage: helperStepUsage("video_inspect", null),
					});
				}

				inspectVideoLogger.warn(
					`Video inspection failed: ${
						error instanceof Error ? error.message : String(error)
					}`,
				);
				return unavailableInspectVideo();
			}
		},
	});
}

export function parseInspectVideoResponse(text: string): InspectVideoOutput {
	try {
		const decoded: unknown = JSON.parse(stripJsonCodeFence(text));

		if (!isRecord(decoded)) {
			return unavailableInspectVideo();
		}

		const suggested = isRecord(decoded.suggested) ? decoded.suggested : {};
		const durationSeconds = nearestVideoDuration(suggested.durationSeconds);
		const candidateShotList = Array.isArray(decoded.shotList)
			? decoded.shotList.map((shot) =>
					isRecord(shot)
						? {
								description: shot.description,
								endSeconds: shot.endSeconds,
								startSeconds: shot.startSeconds,
								talking: shot.talking,
							}
						: shot,
				)
			: undefined;
		const shotList = candidateShotList?.some(
			(shot) =>
				isRecord(shot) &&
				typeof shot.endSeconds === "number" &&
				shot.endSeconds > 15,
		)
			? candidateShotList
			: undefined;
		const voiceoverLanguage =
			decoded.voiceoverLanguage === "en" ||
			decoded.voiceoverLanguage === "fr" ||
			decoded.voiceoverLanguage === "ar"
				? decoded.voiceoverLanguage
				: undefined;
		const invalidVoiceoverLanguage =
			decoded.voiceoverLanguage !== undefined &&
			voiceoverLanguage === undefined;
		const voiceoverScript =
			!invalidVoiceoverLanguage && typeof decoded.voiceoverScript === "string"
				? decoded.voiceoverScript.slice(0, 600)
				: undefined;
		const narration =
			typeof voiceoverScript === "string" && voiceoverScript.length > 0;
		const qualityRequired =
			suggested.talking === true ||
			suggested.multiShot === true ||
			durationSeconds === 15 ||
			narration;
		const candidate = {
			status: "ok" as const,
			brief:
				typeof decoded.brief === "string"
					? decoded.brief.slice(0, 4_000)
					: decoded.brief,
			suggested: {
				aspect: suggested.aspect,
				durationSeconds,
				multiShot: suggested.multiShot,
				quality:
					suggested.quality === "max" || qualityRequired ? "max" : "standard",
				talking: suggested.talking,
			},
			...(shotList ? { shotList } : {}),
			...(voiceoverLanguage ? { voiceoverLanguage } : {}),
			...(voiceoverScript !== undefined ? { voiceoverScript } : {}),
		};
		const parsed = inspectVideoOutputSchema.safeParse(candidate);

		return parsed.success ? parsed.data : unavailableInspectVideo();
	} catch {
		return unavailableInspectVideo();
	}
}

function stripJsonCodeFence(text: string): string {
	const trimmed = text.trim();
	const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/iu.exec(trimmed);

	return fenced?.[1]?.trim() ?? trimmed;
}

function nearestVideoDuration(value: unknown): unknown {
	if (typeof value !== "number" || !Number.isFinite(value)) {
		return value;
	}

	return [5, 10, 15].reduce((nearest, duration) =>
		Math.abs(duration - value) < Math.abs(nearest - value) ? duration : nearest,
	);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function unavailableInspectVideo(): InspectVideoOutput {
	return {
		message:
			"This attached video could not be analyzed right now. Tell the user " +
			"honestly and ask them to try again.",
		status: "unavailable",
	};
}

async function captureGenerationSafely(
	deps: Pick<InspectVideoToolDeps, "meteringService" | "parentEventId">,
	capture: CapturedGeneration,
): Promise<void> {
	if (!deps.parentEventId) {
		return;
	}

	let lastError: unknown;

	for (
		let attempt = 1;
		attempt <= INSPECT_VIDEO_CAPTURE_ATTEMPTS;
		attempt += 1
	) {
		try {
			const generationRef = await deps.meteringService.captureGeneration(
				deps.parentEventId,
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

	inspectVideoLogger.warn(
		`Video inspection usage capture failed: ${
			lastError instanceof Error ? lastError.message : String(lastError)
		}`,
	);
}

export type InspectVideoTool = ReturnType<typeof createInspectVideoTool>;

export const inspectVideoToolSchemaOnly: Tool<
	InspectVideoInput,
	InspectVideoOutput
> = tool({
	inputSchema: inspectVideoInputSchema,
	outputSchema: inspectVideoOutputSchema,
});
