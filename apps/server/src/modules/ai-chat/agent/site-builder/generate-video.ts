/**
 * Shared image-to-video primitive.
 *
 * The page Builder uses the ambient-loop profile for optional hero motion.
 * Standalone chat generation uses the image-animation profile for a general
 * five-second product/social clip. Both profiles keep the same provider,
 * timeout, hosted-source guard and R2 upload path so there is only one media
 * integration to secure and maintain.
 *
 * Deliberately never throws: callers receive generated/failed/unavailable and
 * decide how to present or persist the failure.
 */
import { gateway } from "@ai-sdk/gateway";
import { env } from "@wandit/env/server";
import { experimental_generateVideo as generateVideo } from "ai";

import {
	isR2Configured,
	isWanditHostedUrl,
	publicAssetUrl,
	putSiteFile,
	siteVideoKey,
} from "../../../../infrastructure/storage/r2";

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

export type GenerateBuildVideoResult =
	| { message: string; status: "failed" | "unavailable" }
	| { mediaType: string; status: "generated"; url: string };

export async function generateBuildVideo(params: {
	abortSignal?: AbortSignal;
	aspect: BuildVideoAspect;
	attemptId: string;
	/** Source still — MUST already be a Wandit-hosted (R2) asset. */
	imageUrl: string;
	/** 1-based position in the build, used for the R2 object name. */
	index: number;
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

	try {
		const timeoutSignal = AbortSignal.timeout(VIDEO_TIMEOUT_MS);
		const abortSignal = params.abortSignal
			? AbortSignal.any([params.abortSignal, timeoutSignal])
			: timeoutSignal;
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
			providerOptions: env.AI_VIDEO_MODEL.startsWith("klingai/")
				? {
						klingai: { mode: "std" },
					}
				: undefined,
		});

		const mediaType = result.video.mediaType;
		const extension = EXTENSION_BY_MEDIA_TYPE[mediaType] ?? "mp4";
		const key = siteVideoKey(
			params.projectId,
			params.attemptId,
			params.index,
			extension,
		);

		await putSiteFile(key, result.video.uint8Array, mediaType);

		return {
			mediaType,
			status: "generated",
			url: publicAssetUrl(key),
		};
	} catch (error) {
		return {
			message: error instanceof Error ? error.message : String(error),
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
