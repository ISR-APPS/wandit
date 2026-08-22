import type { VideoSourceImageSpec } from "./video-source-image-spec";

export type VideoSourceImageMeta = {
	byteLength: number;
	hasAlpha: boolean;
	height: number;
	mediaType: string;
	width: number;
};

export type VideoSourceRepair =
	| "convert-format"
	| "pad-aspect"
	| "upscale-min-side"
	| "recompress";

export type VideoSourceRejectionCode =
	| "aspect_extreme"
	| "too_large"
	| "unreadable";

export type VideoSourceAssessment =
	| { ok: true; repairs: VideoSourceRepair[] }
	| { code: VideoSourceRejectionCode; ok: false };

const ABSOLUTE_MAX_ASPECT_RATIO = 4;
const ABSOLUTE_MIN_ASPECT_RATIO = 1 / ABSOLUTE_MAX_ASPECT_RATIO;
const MAX_PROCESSABLE_SOURCE_BYTES = 25 * 1024 * 1024;
export const MAX_SOURCE_PIXELS = 40_000_000;

export function assessVideoSourceImage(
	meta: VideoSourceImageMeta,
	spec: VideoSourceImageSpec,
): VideoSourceAssessment {
	if (meta.width * meta.height > MAX_SOURCE_PIXELS) {
		return { code: "too_large", ok: false };
	}

	if (meta.byteLength > MAX_PROCESSABLE_SOURCE_BYTES) {
		return { code: "too_large", ok: false };
	}

	const aspectRatio = meta.width / meta.height;

	if (
		aspectRatio < ABSOLUTE_MIN_ASPECT_RATIO ||
		aspectRatio > ABSOLUTE_MAX_ASPECT_RATIO
	) {
		return { code: "aspect_extreme", ok: false };
	}

	const repairs: VideoSourceRepair[] = [];

	if (!spec.acceptedMediaTypes.includes(meta.mediaType)) {
		repairs.push("convert-format");
	}

	if (meta.width < spec.minSidePx || meta.height < spec.minSidePx) {
		repairs.push("upscale-min-side");
	}

	if (
		aspectRatio < spec.aspectRatio.min ||
		aspectRatio > spec.aspectRatio.max
	) {
		repairs.push("pad-aspect");
	}

	if (meta.byteLength > spec.maxSourceBytes) {
		repairs.push("recompress");
	}

	return { ok: true, repairs };
}

/**
 * English user-safe rejection copy. The optional descriptor keeps the public
 * two-argument API useful while allowing callers that have a model descriptor
 * to name that model's precise accepted range and byte ceiling.
 */
export function videoSourceRejectionMessage(
	code: VideoSourceRejectionCode,
	meta: Partial<VideoSourceImageMeta>,
	spec?: VideoSourceImageSpec,
): string {
	if (code === "unreadable") {
		return "We could not read this image from storage. Please re-upload it.";
	}

	if (code === "too_large") {
		const pixelCount = (meta.width ?? 0) * (meta.height ?? 0);

		if (pixelCount > MAX_SOURCE_PIXELS) {
			return (
				`This image is ${formatNumber(pixelCount / 1_000_000)} megapixels (MP). ` +
				`We can prepare source images up to the ${formatNumber(MAX_SOURCE_PIXELS / 1_000_000)} MP limit. ` +
				"Please upload an image with smaller dimensions."
			);
		}

		const measured = formatByteLength(meta.byteLength);
		const processLimit = MAX_PROCESSABLE_SOURCE_BYTES;
		const exceedsProcessingCeiling =
			(meta.byteLength ?? Number.POSITIVE_INFINITY) > processLimit;
		const acceptedBytes =
			spec && !exceedsProcessingCeiling ? spec.maxSourceBytes : processLimit;
		const limitOwner = exceedsProcessingCeiling
			? "We can prepare source images"
			: "The video model accepts files";

		return measured
			? `This image is ${measured}. ${limitOwner} up to ${formatByteLength(acceptedBytes)}. Please upload a smaller or less detailed image.`
			: `This image is too large to prepare for video. Please upload a file no larger than ${formatByteLength(acceptedBytes)}.`;
	}

	const dimensions = formatDimensions(meta);
	const measuredRatio = formatMeasuredAspect(meta);
	const accepted = spec?.aspectRatio ?? {
		max: ABSOLUTE_MAX_ASPECT_RATIO,
		min: ABSOLUTE_MIN_ASPECT_RATIO,
	};
	const measurement = [dimensions, measuredRatio && `(${measuredRatio})`]
		.filter(Boolean)
		.join(" ");

	return measurement
		? `This image is ${measurement}. The video model accepts shapes between ${formatAspect(accepted.min)} and ${formatAspect(accepted.max)}. Please send a less stretched image.`
		: `This image is too stretched. The video model accepts shapes between ${formatAspect(accepted.min)} and ${formatAspect(accepted.max)}. Please send a less panoramic or tall image.`;
}

function formatAspect(ratio: number): string {
	if (ratio < 1) {
		return `1:${formatNumber(1 / ratio)}`;
	}

	return `${formatNumber(ratio)}:1`;
}

function formatByteLength(byteLength: number | undefined): string | null {
	if (byteLength === undefined || !Number.isFinite(byteLength)) {
		return null;
	}

	const mebibytes = byteLength / (1024 * 1024);
	return `${formatNumber(mebibytes)} MB`;
}

function formatDimensions(meta: Partial<VideoSourceImageMeta>): string | null {
	if (!meta.width || !meta.height) {
		return null;
	}

	return `${formatNumber(meta.width)}×${formatNumber(meta.height)} px`;
}

function formatMeasuredAspect(
	meta: Partial<VideoSourceImageMeta>,
): string | null {
	if (!meta.width || !meta.height) {
		return null;
	}

	return formatAspect(meta.width / meta.height);
}

function formatNumber(value: number): string {
	return Number(value.toFixed(2)).toString();
}
