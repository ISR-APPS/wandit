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

const EXTENSION_BY_MEDIA_TYPE: Record<string, string> = {
	"video/mp4": "mp4",
	"video/webm": "webm",
};

// Kling generations routinely take minutes; the ceiling is a safety net so a
// hung gateway call cannot eat the build's whole step budget.
const VIDEO_TIMEOUT_MS = 5 * 60_000;

// Ten-second text-to-video renders run longer than five-second animations,
// but this ceiling MUST stay below IMAGE_ANIMATION_STALE_GENERATING_MS
// (7 min) or the reconciler declares a live render stale mid-flight.
export const TEXT_VIDEO_TIMEOUT_MS = 6 * 60_000;

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
	| GatewayGenerationFailure
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
	/** Source still — MUST already be a Wandit-hosted (R2) asset. */
	imageUrl: string;
	/** 1-based position in the build, used for the R2 object name. */
	index: number;
	metering: GatewayMeteringContext<"video">;
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
}): Promise<GenerateBuildVideoResult> {
	if (!env.AI_VIDEO_MODEL || !env.R2_PUBLIC_BASE_URL || !isR2Configured()) {
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

	try {
		const timeoutSignal = AbortSignal.timeout(VIDEO_TIMEOUT_MS);
		const abortSignal = params.abortSignal
			? AbortSignal.any([params.abortSignal, timeoutSignal])
			: timeoutSignal;
		const providerOptions: NonNullable<
			Parameters<typeof generateVideo>[0]["providerOptions"]
		> = withGatewayAttribution({}, params.metering);

		if (env.AI_VIDEO_MODEL.startsWith("klingai/")) {
			providerOptions.klingai = { mode: "std" };
		}

		const result = await generateVideo({
			abortSignal,
			aspectRatio: params.aspect,
			duration: IMAGE_VIDEO_DURATION_SECONDS,
			fps: 30,
			generateAudio: false,
			model: gateway.video(env.AI_VIDEO_MODEL),
			n: 1,
			prompt: {
				image: params.imageUrl,
				text: buildVideoPrompt(params),
			},
			// std keeps cost down; Kling rejects imageTail (last-frame anchoring)
			// in std mode, so the loop closes via the prompt's "end in the same
			// visual state" instruction instead — good enough for slow ambient
			// motion. Upgrading to a clean anchored loop = mode "pro" + imageTail
			// at roughly double the cost.
			providerOptions,
		});
		providerEvidence = {
			model: env.AI_VIDEO_MODEL,
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
			model: env.AI_VIDEO_MODEL,
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
						model: env.AI_VIDEO_MODEL,
						providerMetadata: errorCapture.providerMetadata,
					}
				: null);

		return {
			...(evidence ?? {}),
			message: error instanceof Error ? error.message : String(error),
			...(evidence ? { providerUnits: providerEvidence ? 1 : 0 } : {}),
			status: "failed",
		};
	}
}

function buildVideoPrompt(params: {
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

	return (
		"Create one continuous five-second image-to-video shot from the supplied " +
		"still. Preserve the exact subject identity, product shape, logos, text, " +
		"colors and scene continuity. Do not add people or objects, cut to another " +
		"shot, morph anatomy or packaging, distort lettering, or invent details. " +
		`${motionDirection[params.motion ?? "balanced"]} ` +
		`Motion direction: ${params.motionPrompt}`
	);
}

/**
 * The text-to-video model id: explicit env var first, else the image model
 * with Kling's "-i2v" suffix swapped for "-t2v" (that is how Kling pairs
 * them), else the image model as-is (Veo/Seedance/Wan ids do both modes).
 */
export function resolveTextToVideoModel(): string | null {
	if (env.AI_VIDEO_TEXT_MODEL) {
		return env.AI_VIDEO_TEXT_MODEL;
	}
	if (!env.AI_VIDEO_MODEL) {
		return null;
	}
	return env.AI_VIDEO_MODEL.replace("-i2v", "-t2v");
}

// Veo renders only 4/6/8-second clips; map the house durations (5/10) onto
// the nearest legal value rather than failing the render on a model swap.
// KNOWN TRADE-OFF: the attempt row (whose CHECK only allows 5/10) and the
// cards keep showing the requested duration, so a Veo swap renders 6s/8s
// files labeled 5s/10s. A real Veo migration must migrate the duration
// vocabulary (contract + CHECK + composer choices) — same caveat as the
// original hardcoded duration.
function clampDurationForModel(
	model: string,
	duration: VideoDurationSeconds,
): number {
	if (model.startsWith("google/veo")) {
		return duration === 5 ? 6 : 8;
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
	/** Persist Gateway evidence before bytes become recoverable in R2. */
	onProviderGeneration?: (
		generation: GatewayGenerationMetadata,
	) => Promise<void>;
	/** Director-crafted final provider prompt — sent verbatim. */
	prompt: string;
	/** Director-crafted artifact/motion exclusions, when the model has a field for them. */
	negativePrompt?: string;
	projectId: string;
}): Promise<GenerateBuildVideoResult> {
	const model = resolveTextToVideoModel();
	if (!model || !env.R2_PUBLIC_BASE_URL || !isR2Configured()) {
		return {
			message: "text-to-video generation is not configured on this server",
			status: "unavailable",
		};
	}

	let providerEvidence: GatewayGenerationMetadata | null = null;

	try {
		const timeoutSignal = AbortSignal.timeout(TEXT_VIDEO_TIMEOUT_MS);
		const abortSignal = params.abortSignal
			? AbortSignal.any([params.abortSignal, timeoutSignal])
			: timeoutSignal;
		const providerOptions: NonNullable<
			Parameters<typeof generateVideo>[0]["providerOptions"]
		> = withGatewayAttribution({}, params.metering);

		if (model.startsWith("klingai/")) {
			// std keeps cost predictable (same trade-off as the image path).
			providerOptions.klingai = {
				mode: "std",
				...(params.negativePrompt
					? { negativePrompt: params.negativePrompt }
					: {}),
			};
		} else if (model.startsWith("google/veo")) {
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
			abortSignal,
			aspectRatio: params.aspect,
			duration: clampDurationForModel(model, params.durationSeconds),
			fps: 30,
			// Native model audio stays off: the voiceover pipeline (stubbed until
			// the audio provider lands) will own the soundtrack, and silent
			// renders are roughly half the cost on audio-capable models.
			generateAudio: false,
			model: gateway.video(model),
			n: 1,
			prompt: params.prompt,
			providerOptions,
		});
		providerEvidence = {
			model,
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
			model,
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
						model,
						providerMetadata: errorCapture.providerMetadata,
					}
				: null);

		return {
			...(evidence ?? {}),
			message: error instanceof Error ? error.message : String(error),
			...(evidence ? { providerUnits: providerEvidence ? 1 : 0 } : {}),
			status: "failed",
		};
	}
}
