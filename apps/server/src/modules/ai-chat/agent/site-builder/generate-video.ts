/**
 * Shared video generation primitives.
 *
 * Image-to-video (generateBuildVideo): the page Builder uses the ambient-loop
 * profile for optional hero motion; standalone chat generation uses the
 * image-animation profile for a general five-second product/social clip.
 *
 * Text-to-video (generateTextToVideo): renders a clip from a director-crafted
 * prompt alone — no source still. It shares the provider, metering, and R2
 * upload path with the image path so there is only one media integration to
 * secure and maintain.
 *
 * Deliberately never throws: callers receive generated/failed/unavailable and
 * decide how to present or persist the failure.
 */
import { gateway } from "@ai-sdk/gateway";
import type { VideoDurationSeconds } from "@wandit/contracts";
import { env } from "@wandit/env/server";
import { experimental_generateVideo as generateVideo } from "ai";

import {
	IMMUTABLE_ASSET_CACHE_CONTROL,
	isR2Configured,
	isWanditHostedUrl,
	publicAssetUrl,
	putSiteFile,
	siteVideoKey,
} from "../../../../infrastructure/storage/r2";
import {
	classifyAiError,
	type NormalizedAiError,
	renderAiErrorSentence,
} from "../../../ai-errors/domain";
import { prepareVideoSourceImage } from "../../../media-generations/application/services/prepare-video-source-image";
import {
	VIDEO_QUALITY_CAPABILITIES,
	VIDEO_QUALITY_MODELS,
} from "../../../media-generations/domain/video-quality-models";
import {
	type GatewayGenerationFailure,
	type GatewayGenerationMetadata,
	type GatewayMeteringContext,
	gatewayGenerationCaptureFromError,
	withGatewayAttribution,
} from "../../../metering/domain/gateway-metering";

// Hard budget per build: video is the most expensive asset the builder can
// make, and the prompt says most pages need zero.
export const MAX_VIDEOS = 2;

export const VIDEO_ASPECTS = ["16:9", "9:16", "1:1"] as const;
export const IMAGE_VIDEO_DURATION_SECONDS = 5;

export type BuildVideoAspect = (typeof VIDEO_ASPECTS)[number];
export type ImageVideoProfile = "ambient-loop" | "image-animation";
export type ImageVideoMotion = "subtle" | "balanced" | "dynamic";

type VideoGenerationFailureDetails = {
	/** Safe structured classification for persistence and client rendering. */
	failure?: NormalizedAiError;
	/** Stable classifier for analytics; raw provider messages remain internal. */
	reasonCode?: string;
	/** Explicitly safe to persist and show to the user. */
	userMessage?: string;
};

const EXTENSION_BY_MEDIA_TYPE: Record<string, string> = {
	"video/mp4": "mp4",
	"video/webm": "webm",
};

const EXPECTED_VIDEO_RENDER_STARTUP_MS = 60_000;
const EXPECTED_VIDEO_RENDER_PER_SECOND_MS = 18_000;

function expectedVideoRenderMs(durationSeconds: number): number {
	if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
		throw new RangeError("Video duration must be a positive number");
	}

	return (
		EXPECTED_VIDEO_RENDER_STARTUP_MS +
		durationSeconds * EXPECTED_VIDEO_RENDER_PER_SECOND_MS
	);
}

// How long a healthy generation render is expected to take. The Trigger
// progress crawl and provider timeout intentionally share this model.
export const EXPECTED_VIDEO_RENDER_MS = {
	5: expectedVideoRenderMs(5),
	10: expectedVideoRenderMs(10),
	15: expectedVideoRenderMs(15),
} satisfies Record<VideoDurationSeconds, number>;

const BASE_VIDEO_TIMEOUT_MS = 6 * 60_000;
const EDIT_VIDEO_PROVIDER_TIMEOUT_MAX_MS = 14 * 60_000;

/**
 * Keep the established six-minute ceiling through 10 seconds, then grow it
 * in the same proportion as the progress model's expected render time.
 */
export function videoProviderTimeoutMs(durationSeconds: number): number {
	return Math.max(
		BASE_VIDEO_TIMEOUT_MS,
		Math.ceil(
			(BASE_VIDEO_TIMEOUT_MS * expectedVideoRenderMs(durationSeconds)) /
				EXPECTED_VIDEO_RENDER_MS[10],
		),
	);
}

/**
 * Edit tasks have a fixed fifteen-minute worker ceiling. Preserve one minute
 * after a provider timeout for evidence capture, failure persistence, and
 * refund settlement instead of letting Trigger terminate the process first.
 */
export function editVideoProviderTimeoutMs(
	sourceDurationSeconds: number,
): number {
	return Math.min(
		EDIT_VIDEO_PROVIDER_TIMEOUT_MAX_MS,
		videoProviderTimeoutMs(sourceDurationSeconds),
	);
}

/**
 * Artifact and text-overlay exclusions sent as the provider's negativePrompt
 * (Kling/Veo/Wan have a real field for it). Deliberately a fixed house
 * string, not model-written: parsing a second model output would add a
 * failure mode for zero creative gain. Lives here (plain module) so both the
 * Nest director service and the Trigger runtime can import it.
 */
export const VIDEO_NEGATIVE_PROMPT =
	"blur, distortion, warping, watermark, text overlay, subtitles, captions, " +
	"low quality, compression artifacts, flickering, inconsistent lighting, " +
	"morphing faces, extra limbs, unnatural physics, jittery motion, " +
	"deformed hands, glitching logos";

export type GenerateBuildVideoResult =
	| (GatewayGenerationFailure & VideoGenerationFailureDetails)
	| { message: string; status: "unavailable" }
	| ({
			mediaType: string;
			status: "generated";
			url: string;
			/** Provider warnings about ignored/unsupported settings, for logging. */
			warnings?: string[];
	  } & GatewayGenerationMetadata);

export async function generateBuildVideo(params: {
	abortSignal?: AbortSignal;
	aspect: BuildVideoAspect;
	attemptId: string;
	/** Defaults to the legacy five-second image-animation duration. */
	durationSeconds?: 5 | 10;
	/** Source still — MUST already be a Wandit-hosted (R2) asset. */
	imageUrl: string;
	/** 1-based position in the build, used for the R2 object name. */
	index: number;
	metering: GatewayMeteringContext<"video">;
	/** Renderer selected upstream and snapshotted on the attempt. */
	modelId: string;
	/** Persist Gateway evidence before bytes become recoverable in R2. */
	onProviderGeneration?: (
		generation: GatewayGenerationMetadata,
	) => Promise<void>;
	/** Defaults to the Builder's restrained ambient-loop behavior. */
	profile?: ImageVideoProfile;
	/** Standalone image-animation motion strength. Ignored for ambient loops. */
	motion?: ImageVideoMotion;
	motionPrompt: string;
	projectId: string;
	/** Enables Kling's native voice-control and audio generation together. */
	voiceControl: boolean;
}): Promise<GenerateBuildVideoResult> {
	if (
		!env.AI_GATEWAY_API_KEY ||
		!env.R2_PUBLIC_BASE_URL ||
		!isR2Configured() ||
		!env.TRIGGER_SECRET_KEY
	) {
		return {
			message: "video animation not configured — use the still image instead",
			status: "unavailable",
		};
	}

	// The model may only animate images IT generated or the user uploaded —
	// never an invented or hotlinked URL. Parsed origin + path-boundary
	// check, not a raw prefix check (prefix confusion).
	if (!isWanditHostedUrl(params.imageUrl)) {
		return {
			message:
				"only Wandit-hosted images (generate_image results or user assets " +
				"from the brief) can be animated — use the still image instead",
			status: "failed",
		};
	}

	let providerEvidence: GatewayGenerationMetadata | null = null;
	let providerAbortSignal = params.abortSignal;

	try {
		const prepared = await prepareVideoSourceImage({
			modelId: params.modelId,
			sourceUrl: params.imageUrl,
		});

		if (prepared.status === "rejected") {
			return {
				message: `video source image pre-flight rejected: ${prepared.reasonCode}`,
				reasonCode: prepared.reasonCode,
				status: "failed",
				userMessage: prepared.userMessage,
			};
		}

		const durationSeconds =
			params.durationSeconds ?? IMAGE_VIDEO_DURATION_SECONDS;
		const timeoutSignal = AbortSignal.timeout(
			videoProviderTimeoutMs(durationSeconds),
		);
		providerAbortSignal = params.abortSignal
			? AbortSignal.any([params.abortSignal, timeoutSignal])
			: timeoutSignal;
		const providerOptions: NonNullable<
			Parameters<typeof generateVideo>[0]["providerOptions"]
		> = withGatewayAttribution({}, params.metering);

		if (params.modelId.startsWith("klingai/")) {
			providerOptions.klingai = {
				mode: "std",
				...(params.voiceControl ? { voice_control: true } : {}),
			};
		}

		const result = await generateVideo({
			abortSignal: providerAbortSignal,
			aspectRatio: params.aspect,
			duration: durationSeconds,
			fps: 30,
			generateAudio: params.voiceControl,
			// Deterministic provider rejections are surfaced by the Gateway as
			// retryable 5xx responses; SDK retries would triple-bill a hopeless call.
			maxRetries: 0,
			model: gateway.video(params.modelId),
			n: 1,
			prompt: {
				image: prepared.url,
				text: buildVideoPrompt({ ...params, durationSeconds }),
			},
			// std keeps cost down; Kling rejects imageTail (last-frame anchoring)
			// in std mode, so the loop closes via the prompt's "end in the same
			// visual state" instruction instead — good enough for slow ambient
			// motion. Upgrading to a clean anchored loop = mode "pro" + imageTail
			// at roughly double the cost.
			providerOptions,
		});
		providerEvidence = {
			model: params.modelId,
			providerMetadata: result.providerMetadata,
		};
		await params.onProviderGeneration?.(providerEvidence);

		const mediaType = result.video.mediaType;
		const extension = EXTENSION_BY_MEDIA_TYPE[mediaType] ?? "mp4";
		const key = siteVideoKey(
			params.projectId,
			params.attemptId,
			params.index,
			extension,
		);

		await putSiteFile(
			key,
			result.video.uint8Array,
			mediaType,
			IMMUTABLE_ASSET_CACHE_CONTROL,
		);

		return {
			mediaType,
			model: params.modelId,
			providerMetadata: result.providerMetadata,
			status: "generated",
			url: publicAssetUrl(key),
		};
	} catch (error) {
		const errorCapture = gatewayGenerationCaptureFromError(error);
		const evidence =
			providerEvidence ??
			(errorCapture
				? {
						model: params.modelId,
						providerMetadata: errorCapture.providerMetadata,
					}
				: null);
		const failure = classifyVideoAdapterError({
			abortSignal: providerAbortSignal,
			error,
			model: params.modelId,
			providerMetadata: evidence?.providerMetadata,
		});

		return {
			...(evidence ?? {}),
			failure,
			message: renderAiErrorSentence(failure),
			...(evidence ? { providerUnits: providerEvidence ? 1 : 0 } : {}),
			status: "failed",
		};
	}
}

function buildVideoPrompt(params: {
	durationSeconds: 5 | 10;
	motion?: ImageVideoMotion;
	motionPrompt: string;
	profile?: ImageVideoProfile;
}): string {
	if ((params.profile ?? "ambient-loop") === "ambient-loop") {
		return (
			"Restrained ambient motion for a website hero background. " +
			"Preserve the composition, subject, colors and framing exactly. " +
			"Only subtle lighting drift, gentle atmospheric/fabric movement, " +
			"a very slow camera float. No cuts, no morphing, no new objects, " +
			"no large motion. End in the same visual state as the first " +
			`frame. ${params.motionPrompt}`
		);
	}

	const motionDirection: Record<ImageVideoMotion, string> = {
		subtle:
			"Use restrained subject motion, gentle environmental movement and a nearly locked camera.",
		balanced:
			"Use clear natural subject or product motion with a smooth, controlled camera move.",
		dynamic:
			"Use energetic but physically believable motion and a confident camera move without losing the subject.",
	};
	const durationLabel =
		params.durationSeconds === 5 ? "five-second" : "ten-second";

	return (
		`Create one continuous ${durationLabel} image-to-video shot from the supplied ` +
		"still. Preserve the exact subject identity, product shape, logos, text, " +
		"colors and scene continuity. Do not add people or objects, cut to another " +
		"shot, morph anatomy or packaging, distort lettering, or invent details. " +
		`${motionDirection[params.motion ?? "balanced"]} ` +
		`Motion direction: ${params.motionPrompt}`
	);
}

export type VideoCostEstimateInput = {
	audio: boolean;
	durationSeconds: number;
	kind: "video";
	mode: "std";
	modelId: string;
};

/**
 * The provider-cost estimate input for one video render, as the call sites
 * above will actually submit it (resolved renderer, clamped duration, std
 * mode, audio only when Kling voice control is on). Null without a renderer;
 * the reserve then uses the registry floor.
 */
export function videoCostEstimateInput(input: {
	audio?: boolean;
	durationSeconds: number | null | undefined;
	modelId: string | null | undefined;
}): VideoCostEstimateInput | null {
	const modelId = input.modelId;

	if (!modelId) {
		return null;
	}

	const requested = input.durationSeconds;
	// House durations (5/10/15) follow the renderer clamp. An edit renders the
	// source clip's real length (4-30 s) and keeps that number. Anything else
	// falls back to the five-second house clip.
	const durationSeconds =
		requested === 5 || requested === 10 || requested === 15
			? clampDurationForModel(modelId, requested)
			: Number.isSafeInteger(requested) && (requested as number) > 0
				? (requested as number)
				: clampDurationForModel(modelId, IMAGE_VIDEO_DURATION_SECONDS);

	return {
		audio: input.audio === true,
		durationSeconds,
		kind: "video",
		mode: "std",
		modelId,
	};
}

// Veo renders only 4/6/8-second clips; map the house durations (5/10/15) onto
// the nearest legal value rather than failing the render on a model swap.
// KNOWN TRADE-OFF: the attempt and cards keep showing the requested duration,
// so a Veo swap renders 6s/8s files labeled 5s/10s/15s.
function clampDurationForModel(
	model: string,
	duration: VideoDurationSeconds,
): number {
	if (model.startsWith("google/veo")) {
		return duration === 5 ? 6 : 8;
	}
	if (
		duration > VIDEO_QUALITY_CAPABILITIES.standard.maxDurationSeconds &&
		(model === VIDEO_QUALITY_MODELS.standard.t2v ||
			model === VIDEO_QUALITY_MODELS.standard.i2v)
	) {
		console.warn(
			`Clamping ${model} video duration from ${duration}s to ${VIDEO_QUALITY_CAPABILITIES.standard.maxDurationSeconds}s`,
		);
		return VIDEO_QUALITY_CAPABILITIES.standard.maxDurationSeconds;
	}
	return duration;
}

export async function generateTextToVideo(params: {
	abortSignal?: AbortSignal;
	aspect: BuildVideoAspect;
	attemptId: string;
	durationSeconds: VideoDurationSeconds;
	/** 1-based clip index, used for the R2 object name (recovery probes 1). */
	index: number;
	metering: GatewayMeteringContext<"video">;
	/** Renderer selected upstream and snapshotted on the attempt. */
	modelId: string;
	/** Persist Gateway evidence before bytes become recoverable in R2. */
	onProviderGeneration?: (
		generation: GatewayGenerationMetadata,
	) => Promise<void>;
	/** Director-crafted final provider prompt — sent verbatim. */
	prompt: string;
	/** Director-crafted artifact/motion exclusions, when the model has a field for them. */
	negativePrompt?: string;
	projectId: string;
	/** Enables Kling's native voice-control and audio generation together. */
	voiceControl: boolean;
}): Promise<GenerateBuildVideoResult> {
	if (
		!env.AI_GATEWAY_API_KEY ||
		!env.R2_PUBLIC_BASE_URL ||
		!isR2Configured() ||
		!env.TRIGGER_SECRET_KEY
	) {
		return {
			message: "text-to-video generation is not configured on this server",
			status: "unavailable",
		};
	}

	let providerEvidence: GatewayGenerationMetadata | null = null;
	let providerAbortSignal = params.abortSignal;

	try {
		const timeoutSignal = AbortSignal.timeout(
			videoProviderTimeoutMs(params.durationSeconds),
		);
		providerAbortSignal = params.abortSignal
			? AbortSignal.any([params.abortSignal, timeoutSignal])
			: timeoutSignal;
		const providerOptions: NonNullable<
			Parameters<typeof generateVideo>[0]["providerOptions"]
		> = withGatewayAttribution({}, params.metering);

		if (params.modelId.startsWith("klingai/")) {
			// std keeps cost predictable (same trade-off as the image path).
			providerOptions.klingai = {
				mode: "std",
				...(params.voiceControl ? { voice_control: true } : {}),
				...(params.negativePrompt
					? { negativePrompt: params.negativePrompt }
					: {}),
			};
		} else if (params.modelId.startsWith("google/veo")) {
			// Veo's providerOptions key is "vertex" despite the google/ model id.
			// enhancePrompt defaults to TRUE — Gemini silently rewrites the
			// prompt — and the director already owns it, so switch that off.
			providerOptions.vertex = {
				enhancePrompt: false,
				...(params.negativePrompt
					? { negativePrompt: params.negativePrompt }
					: {}),
			};
		}

		const result = await generateVideo({
			abortSignal: providerAbortSignal,
			aspectRatio: params.aspect,
			duration: clampDurationForModel(params.modelId, params.durationSeconds),
			fps: 30,
			// Talking people and off-camera narration share Kling's native voice
			// control switch. Extension soundtracks use the separate TTS pipeline.
			generateAudio: params.voiceControl,
			// Deterministic provider rejections are surfaced by the Gateway as
			// retryable 5xx responses; SDK retries would triple-bill a hopeless call.
			maxRetries: 0,
			model: gateway.video(params.modelId),
			n: 1,
			prompt: params.prompt,
			providerOptions,
		});
		providerEvidence = {
			model: params.modelId,
			providerMetadata: result.providerMetadata,
		};
		await params.onProviderGeneration?.(providerEvidence);

		const mediaType = result.video.mediaType;
		const extension = EXTENSION_BY_MEDIA_TYPE[mediaType] ?? "mp4";
		const key = siteVideoKey(
			params.projectId,
			params.attemptId,
			params.index,
			extension,
		);

		await putSiteFile(
			key,
			result.video.uint8Array,
			mediaType,
			IMMUTABLE_ASSET_CACHE_CONTROL,
		);

		return {
			mediaType,
			model: params.modelId,
			providerMetadata: result.providerMetadata,
			status: "generated",
			// Unsupported-setting warnings (e.g. an aspect this model cannot do)
			// surface here instead of vanishing — the Trigger runtime logs them.
			...(result.warnings.length > 0
				? {
						warnings: result.warnings.map((warning) => JSON.stringify(warning)),
					}
				: {}),
			url: publicAssetUrl(key),
		};
	} catch (error) {
		const errorCapture = gatewayGenerationCaptureFromError(error);
		const evidence =
			providerEvidence ??
			(errorCapture
				? {
						model: params.modelId,
						providerMetadata: errorCapture.providerMetadata,
					}
				: null);
		const failure = classifyVideoAdapterError({
			abortSignal: providerAbortSignal,
			error,
			model: params.modelId,
			providerMetadata: evidence?.providerMetadata,
		});

		return {
			...(evidence ?? {}),
			failure,
			message: renderAiErrorSentence(failure),
			...(evidence ? { providerUnits: providerEvidence ? 1 : 0 } : {}),
			status: "failed",
		};
	}
}

export function classifyVideoAdapterError(input: {
	abortSignal?: AbortSignal;
	error: unknown;
	model: string;
	providerMetadata?: unknown;
}): NormalizedAiError {
	const context = {
		abortSignal: input.abortSignal,
		model: input.model,
		providerMetadata: input.providerMetadata,
		route: "vercel" as const,
		surface: "video" as const,
	};
	const classified = classifyAiError(input.error, context);
	if (classified) return classified;

	const fallback = classifyAiError(
		new TypeError("Video provider adapter failed without a classifiable error"),
		context,
	);
	if (!fallback) {
		throw new Error("Video provider adapter failure could not be classified");
	}
	return fallback;
}
