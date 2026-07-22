/**
 * Image-to-video animation behind the builder's animate_image tool (spec
 * §12): one already-hosted image (a generate_image result or a user asset)
 * becomes a short ambient loop via the gateway video model, uploaded to R2
 * under the attempt beside the images. Deliberately never throws — a page
 * build must never fail because of video; the still image always stands.
 * Graceful-unavailable is the required behavior when AI_VIDEO_MODEL is unset.
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

export type BuildVideoAspect = (typeof VIDEO_ASPECTS)[number];

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
	aspect: BuildVideoAspect;
	attemptId: string;
	/** Source still — MUST already be a Wandit-hosted (R2) asset. */
	imageUrl: string;
	/** 1-based position in the build, used for the R2 object name. */
	index: number;
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
		const result = await generateVideo({
			abortSignal: AbortSignal.timeout(VIDEO_TIMEOUT_MS),
			aspectRatio: params.aspect,
			duration: 5,
			fps: 30,
			generateAudio: false,
			model: gateway.video(env.AI_VIDEO_MODEL),
			n: 1,
			prompt: {
				image: params.imageUrl,
				text:
					"Restrained ambient motion for a website hero background. " +
					"Preserve the composition, subject, colors and framing exactly. " +
					"Only subtle lighting drift, gentle atmospheric/fabric movement, " +
					"a very slow camera float. No cuts, no morphing, no new objects, " +
					"no large motion. End in the same visual state as the first " +
					`frame. ${params.motionPrompt}`,
			},
			// std keeps cost down; Kling rejects imageTail (last-frame anchoring)
			// in std mode, so the loop closes via the prompt's "end in the same
			// visual state" instruction instead — good enough for slow ambient
			// motion. Upgrading to a clean anchored loop = mode "pro" + imageTail
			// at roughly double the cost.
			providerOptions: {
				klingai: { mode: "std" },
			},
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
