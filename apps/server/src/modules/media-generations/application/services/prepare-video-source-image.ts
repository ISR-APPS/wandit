import { createHash } from "node:crypto";
import sharp from "sharp";

import {
	getObjectBytes,
	IMMUTABLE_ASSET_CACHE_CONTROL,
	publicAssetKeyFromUrl,
	publicAssetUrl,
	putSiteFile,
	userUploadKey,
} from "../../../../infrastructure/storage/r2";
import {
	assessVideoSourceImage,
	MAX_SOURCE_PIXELS,
	type VideoSourceImageMeta,
	type VideoSourceRejectionCode,
	type VideoSourceRepair,
	videoSourceRejectionMessage,
} from "../../domain/assess-video-source-image";
import {
	type VideoSourceImageSpec,
	videoSourceImageSpecForModel,
} from "../../domain/video-source-image-spec";

export type PreparedVideoSourceImage =
	| {
			height: number;
			mediaType: string;
			repaired: boolean;
			status: "ready";
			url: string;
			width: number;
	  }
	| {
			reasonCode: VideoSourceRejectionCode;
			status: "rejected";
			userMessage: string;
	  };

const JPEG_QUALITY = 82;
// Bump whenever repair behavior can change output bytes independently of spec.
const PREPARE_PIPELINE_VERSION = 1;
const RECOMPRESSION_MAX_SIDE_PX = 2048;

type OutputMediaType = "image/jpeg" | "image/png" | "image/webp";
type SharpPipeline = ReturnType<typeof sharp>;

/**
 * Fetch, assess, and when needed repair one Wandit-hosted video source still.
 * The caller validates provenance before entering this shared I/O boundary.
 * Passing userId additionally preserves and verifies the strict four-segment
 * upload key required by chat-history attachment guards.
 */
export async function prepareVideoSourceImage(params: {
	modelId: string;
	sourceUrl: string;
	userId?: string;
}): Promise<PreparedVideoSourceImage> {
	const spec = videoSourceImageSpecForModel(params.modelId);
	const sourceKey = publicAssetKeyFromUrl(params.sourceUrl);

	if (!sourceKey) {
		return rejected("unreadable", {}, spec);
	}

	const bytes = await getObjectBytes(sourceKey);

	if (!bytes) {
		return rejected("unreadable", {}, spec);
	}

	let meta: VideoSourceImageMeta;

	try {
		const metadata = await sharp(bytes, {
			limitInputPixels: MAX_SOURCE_PIXELS,
		}).metadata();
		const width = metadata.autoOrient?.width ?? orientedWidth(metadata);
		const height = metadata.autoOrient?.height ?? orientedHeight(metadata);
		const mediaType = mediaTypeFromSharpFormat(metadata.format);

		if (!width || !height || !mediaType) {
			return rejected("unreadable", {}, spec);
		}

		meta = {
			byteLength: bytes.byteLength,
			hasAlpha: metadata.hasAlpha ?? false,
			height,
			mediaType,
			width,
		};
	} catch {
		return rejected("unreadable", {}, spec);
	}

	const assessment = assessVideoSourceImage(meta, spec);

	if (!assessment.ok) {
		return rejected(assessment.code, meta, spec);
	}

	if (assessment.repairs.length === 0) {
		return {
			height: meta.height,
			mediaType: meta.mediaType,
			repaired: false,
			status: "ready",
			url: params.sourceUrl,
			width: meta.width,
		};
	}

	const outputType = repairedMediaType(meta, assessment.repairs, spec);

	if (!outputType) {
		return rejected("unreadable", meta, spec);
	}

	const outputExtension = extensionForMediaType(outputType);
	const repairedKey = repairedSourceKey(
		sourceKey,
		outputExtension,
		spec,
		params.userId,
	);

	if (!repairedKey) {
		return rejected("unreadable", meta, spec);
	}

	let output: Buffer;
	let outputMeta: VideoSourceImageMeta;
	let outputAssessment: ReturnType<typeof assessVideoSourceImage>;

	try {
		output = await buildRepairedImage(bytes, meta, spec, outputType);

		if (output.byteLength > spec.maxSourceBytes) {
			output = await downscaleAndEncode(output, outputType);
		}

		outputMeta = await imageMeta(output);
		outputAssessment = assessVideoSourceImage(outputMeta, spec);

		if (
			outputAssessment.ok &&
			outputAssessment.repairs.some(
				(repair) => repair === "pad-aspect" || repair === "upscale-min-side",
			)
		) {
			// Integer rounding during a longest-side downscale can move an exact
			// boundary (for example 2.5:1) a fraction outside the descriptor.
			output = await buildRepairedImage(output, outputMeta, spec, outputType);
			outputMeta = await imageMeta(output);
			outputAssessment = assessVideoSourceImage(outputMeta, spec);
		}

		if (!outputAssessment.ok) {
			return rejected(outputAssessment.code, outputMeta, spec);
		}

		if (outputAssessment.repairs.includes("recompress")) {
			return rejected("too_large", outputMeta, spec);
		}

		if (outputAssessment.repairs.length > 0) {
			return rejected("unreadable", meta, spec);
		}
	} catch {
		return rejected("unreadable", meta, spec);
	}

	await putSiteFile(
		repairedKey,
		output,
		outputType,
		IMMUTABLE_ASSET_CACHE_CONTROL,
	);

	return {
		height: outputMeta.height,
		mediaType: outputType,
		repaired: true,
		status: "ready",
		url: publicAssetUrl(repairedKey),
		width: outputMeta.width,
	};
}

async function buildRepairedImage(
	bytes: Uint8Array,
	meta: VideoSourceImageMeta,
	spec: VideoSourceImageSpec,
	outputType: OutputMediaType,
): Promise<Buffer> {
	const idealCanvas = idealPaddedDimensions(meta, spec);
	const scale = Math.max(
		1,
		spec.minSidePx / Math.min(idealCanvas.width, idealCanvas.height),
	);
	const source = { height: meta.height, width: meta.width };
	let resizeAxis: { height: number } | { width: number } | null = null;

	if (scale > 1 && meta.width <= meta.height) {
		source.width = Math.ceil(meta.width * scale);
		source.height = Math.round((meta.height * source.width) / meta.width);
		resizeAxis = { width: source.width };
	} else if (scale > 1) {
		source.height = Math.ceil(meta.height * scale);
		source.width = Math.round((meta.width * source.height) / meta.height);
		resizeAxis = { height: source.height };
	}

	const canvas = paddedDimensions(source, spec);
	const average =
		canvas.width !== source.width || canvas.height !== source.height
			? await averageColor(bytes)
			: null;
	let pipeline = sharp(bytes, {
		limitInputPixels: MAX_SOURCE_PIXELS,
	}).autoOrient();

	if (resizeAxis) {
		// Set one axis only. Sharp's two-axis default is `cover`, which could crop
		// a rounding pixel and violate the source-image no-crop policy.
		pipeline = pipeline.resize(resizeAxis);
	}

	if (average) {
		// Sharp normalizes resize ahead of extend even when the calls are chained
		// in the opposite order. Scaling the source and the padding uniformly is
		// pixel-equivalent to the policy's conceptual pad-then-upscale operation.
		pipeline = pipeline.extend({
			background: average,
			bottom: Math.floor((canvas.height - source.height) / 2),
			left: Math.ceil((canvas.width - source.width) / 2),
			right: Math.floor((canvas.width - source.width) / 2),
			top: Math.ceil((canvas.height - source.height) / 2),
		});
	}

	pipeline = pipeline.withIccProfile("srgb");

	return encode(pipeline, outputType);
}

async function downscaleAndEncode(
	bytes: Uint8Array,
	outputType: OutputMediaType,
): Promise<Buffer> {
	const pipeline = sharp(bytes, { limitInputPixels: MAX_SOURCE_PIXELS })
		.resize({
			fit: "inside",
			height: RECOMPRESSION_MAX_SIDE_PX,
			width: RECOMPRESSION_MAX_SIDE_PX,
			withoutEnlargement: true,
		})
		.withIccProfile("srgb");

	return encode(pipeline, outputType);
}

function encode(
	pipeline: SharpPipeline,
	outputType: OutputMediaType,
): Promise<Buffer> {
	if (outputType === "image/png") {
		return pipeline.png({ compressionLevel: 9 }).toBuffer();
	}

	if (outputType === "image/webp") {
		return pipeline.webp({ quality: JPEG_QUALITY }).toBuffer();
	}

	return pipeline.jpeg({ quality: JPEG_QUALITY }).toBuffer();
}

async function averageColor(bytes: Uint8Array): Promise<{
	alpha: number;
	b: number;
	g: number;
	r: number;
}> {
	const normalized = await sharp(bytes, {
		limitInputPixels: MAX_SOURCE_PIXELS,
	})
		.autoOrient()
		.toColourspace("srgb")
		.ensureAlpha()
		.png()
		.toBuffer();
	const stats = await sharp(normalized, {
		limitInputPixels: MAX_SOURCE_PIXELS,
	}).stats();
	const [red, green = red, blue = red, alpha] = stats.channels;

	return {
		alpha: alpha ? alpha.mean / 255 : 1,
		b: Math.round(blue?.mean ?? 0),
		g: Math.round(green?.mean ?? 0),
		r: Math.round(red?.mean ?? 0),
	};
}

function paddedDimensions(
	meta: Pick<VideoSourceImageMeta, "height" | "width">,
	spec: VideoSourceImageSpec,
): { height: number; width: number } {
	const ratio = meta.width / meta.height;

	if (ratio > spec.aspectRatio.max) {
		return {
			height: Math.ceil(meta.width / spec.aspectRatio.max),
			width: meta.width,
		};
	}

	if (ratio < spec.aspectRatio.min) {
		return {
			height: meta.height,
			width: Math.ceil(meta.height * spec.aspectRatio.min),
		};
	}

	return { height: meta.height, width: meta.width };
}

/** Continuous target used to calculate scale before integer pixel rounding. */
function idealPaddedDimensions(
	meta: Pick<VideoSourceImageMeta, "height" | "width">,
	spec: VideoSourceImageSpec,
): { height: number; width: number } {
	const ratio = meta.width / meta.height;

	if (ratio > spec.aspectRatio.max) {
		return { height: meta.width / spec.aspectRatio.max, width: meta.width };
	}

	if (ratio < spec.aspectRatio.min) {
		return { height: meta.height, width: meta.height * spec.aspectRatio.min };
	}

	return { height: meta.height, width: meta.width };
}

function repairedSourceKey(
	sourceKey: string,
	extension: "jpg" | "png" | "webp",
	spec: VideoSourceImageSpec,
	userId?: string,
): string | null {
	const slash = sourceKey.lastIndexOf("/");
	const directory = slash >= 0 ? sourceKey.slice(0, slash + 1) : "";
	const filename = sourceKey.slice(slash + 1);

	if (!filename) {
		return null;
	}

	const fingerprint = repairedSourceFingerprint(spec);

	if (userId) {
		const [root, owner, uploadId, uploadFilename, ...extra] =
			sourceKey.split("/");

		if (
			root !== "uploads" ||
			owner !== userId ||
			!uploadId ||
			!uploadFilename ||
			extra.length > 0
		) {
			return null;
		}

		return userUploadKey(
			userId,
			uploadId,
			`${filenameStem(uploadFilename)}.video-src-${fingerprint}.${extension}`,
		);
	}

	return `${directory}${filenameStem(filename)}.video-src-${fingerprint}.${extension}`;
}

function repairedSourceFingerprint(spec: VideoSourceImageSpec): string {
	return createHash("sha256")
		.update(JSON.stringify(spec))
		.update(`:${PREPARE_PIPELINE_VERSION}`)
		.digest("hex")
		.slice(0, 8);
}

function filenameStem(filename: string): string {
	const dot = filename.lastIndexOf(".");
	return dot > 0 ? filename.slice(0, dot) : filename;
}

function extensionForMediaType(
	mediaType: OutputMediaType,
): "jpg" | "png" | "webp" {
	if (mediaType === "image/jpeg") {
		return "jpg";
	}

	return mediaType === "image/png" ? "png" : "webp";
}

function repairedMediaType(
	meta: Pick<VideoSourceImageMeta, "hasAlpha" | "mediaType">,
	repairs: readonly VideoSourceRepair[],
	spec: VideoSourceImageSpec,
): OutputMediaType | null {
	if (
		repairs.includes("recompress") &&
		!meta.hasAlpha &&
		spec.acceptedMediaTypes.includes("image/jpeg")
	) {
		return "image/jpeg";
	}

	if (
		!repairs.includes("convert-format") &&
		isOutputMediaType(meta.mediaType) &&
		spec.acceptedMediaTypes.includes(meta.mediaType)
	) {
		return meta.mediaType;
	}

	const preferences: OutputMediaType[] = meta.hasAlpha
		? ["image/png", "image/webp", "image/jpeg"]
		: ["image/jpeg", "image/png", "image/webp"];

	return (
		preferences.find((mediaType) =>
			spec.acceptedMediaTypes.includes(mediaType),
		) ?? null
	);
}

function isOutputMediaType(mediaType: string): mediaType is OutputMediaType {
	return (
		mediaType === "image/jpeg" ||
		mediaType === "image/png" ||
		mediaType === "image/webp"
	);
}

function mediaTypeFromSharpFormat(format: string | undefined): string | null {
	if (!format) {
		return null;
	}

	if (format === "jpg" || format === "jpeg") {
		return "image/jpeg";
	}

	return `image/${format}`;
}

async function imageMeta(bytes: Uint8Array): Promise<VideoSourceImageMeta> {
	const metadata = await sharp(bytes, {
		limitInputPixels: MAX_SOURCE_PIXELS,
	}).metadata();
	const width = metadata.autoOrient?.width ?? orientedWidth(metadata);
	const height = metadata.autoOrient?.height ?? orientedHeight(metadata);
	const mediaType = mediaTypeFromSharpFormat(metadata.format);

	if (!width || !height || !mediaType) {
		throw new Error("Image metadata is incomplete");
	}

	return {
		byteLength: bytes.byteLength,
		hasAlpha: metadata.hasAlpha ?? false,
		height,
		mediaType,
		width,
	};
}

function orientedHeight(metadata: {
	height?: number;
	orientation?: number;
	width?: number;
}): number | undefined {
	return swapsAxes(metadata.orientation) ? metadata.width : metadata.height;
}

function orientedWidth(metadata: {
	height?: number;
	orientation?: number;
	width?: number;
}): number | undefined {
	return swapsAxes(metadata.orientation) ? metadata.height : metadata.width;
}

function swapsAxes(orientation: number | undefined): boolean {
	return orientation !== undefined && orientation >= 5 && orientation <= 8;
}

function rejected(
	code: VideoSourceRejectionCode,
	meta: Partial<VideoSourceImageMeta>,
	spec: VideoSourceImageSpec,
): PreparedVideoSourceImage {
	return {
		reasonCode: code,
		status: "rejected",
		userMessage: videoSourceRejectionMessage(code, meta, spec),
	};
}
