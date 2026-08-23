import {
	type VideoDurationSeconds,
	type VideoQuality,
	videoQualities,
} from "@wandit/contracts";

export { type VideoQuality, videoQualities };

export const VIDEO_QUALITY_MODELS = {
	standard: {
		i2v: "klingai/kling-v2.6-i2v",
		t2v: "klingai/kling-v2.6-t2v",
	},
	max: {
		i2v: "klingai/kling-v3.0-i2v",
		t2v: "klingai/kling-v3.0-t2v",
	},
} as const satisfies Record<VideoQuality, Record<VideoGenerationKind, string>>;

export type VideoQualityCapabilities = {
	maxDurationSeconds: 10 | 15;
	multiShot: boolean;
	narration: boolean;
	talking: boolean;
};

export const VIDEO_QUALITY_CAPABILITIES = {
	standard: {
		maxDurationSeconds: 10,
		multiShot: false,
		narration: false,
		talking: false,
	},
	max: {
		maxDurationSeconds: 15,
		multiShot: true,
		narration: true,
		talking: true,
	},
} as const satisfies Record<VideoQuality, VideoQualityCapabilities>;

/** Fixed-operation engines must never be selected as generation tier renderers. */
export const VIDEO_EDIT_ENGINE_MODEL = "bytedance/seedance-2.5";
export const VIDEO_PRODUCT_ENGINE_MODEL = "bytedance/seedance-2.5";

export type VideoGenerationKind = "i2v" | "t2v";

export type VideoQualityUpgradeReason =
	| "duration"
	| "multi-shot"
	| "narration"
	| "talking-person";

export type VideoGenerationPlan = {
	autoUpgraded: boolean;
	modelId: string;
	quality: VideoQuality;
	upgradeReasons: VideoQualityUpgradeReason[];
};

/**
 * Resolves the renderer from the requested tier and required capabilities.
 * Capability overflow can only move a request upward to max; it never
 * silently downgrades a max request.
 */
export function resolveVideoGenerationPlan(input: {
	durationSeconds: VideoDurationSeconds;
	kind: VideoGenerationKind;
	multiShot: boolean;
	narration: boolean;
	quality: VideoQuality;
	talking: boolean;
}): VideoGenerationPlan {
	const requestedCapabilities = VIDEO_QUALITY_CAPABILITIES[input.quality];
	const upgradeReasons: VideoQualityUpgradeReason[] = [];

	if (input.talking && !requestedCapabilities.talking) {
		upgradeReasons.push("talking-person");
	}
	if (input.narration && !requestedCapabilities.narration) {
		upgradeReasons.push("narration");
	}
	if (input.multiShot && !requestedCapabilities.multiShot) {
		upgradeReasons.push("multi-shot");
	}
	if (input.durationSeconds > requestedCapabilities.maxDurationSeconds) {
		upgradeReasons.push("duration");
	}

	const quality =
		input.quality === "standard" && upgradeReasons.length > 0
			? "max"
			: input.quality;

	return {
		autoUpgraded: quality !== input.quality,
		modelId: VIDEO_QUALITY_MODELS[quality][input.kind],
		quality,
		upgradeReasons,
	};
}
