export type VideoSourceImageSpec = {
	/** Media types the model accepts as a source still. */
	acceptedMediaTypes: readonly string[];
	/** Aspect ratio (width/height) must be inside [min, max]. */
	aspectRatio: { max: number; min: number };
	/** Hard ceiling on the source file the provider will take. */
	maxSourceBytes: number;
	/** Minimum pixels on EACH side. */
	minSidePx: number;
};

const MEBIBYTE = 1024 * 1024;

const DEFAULT_VIDEO_SOURCE_IMAGE_SPEC = {
	acceptedMediaTypes: ["image/jpeg", "image/png", "image/webp"],
	aspectRatio: { max: 4, min: 1 / 4 },
	maxSourceBytes: 20 * MEBIBYTE,
	minSidePx: 64,
} as const satisfies VideoSourceImageSpec;

/**
 * Provider/model-family constraints belong here, not at generation call sites.
 * Prefix entries let a provider add model revisions without duplicating policy.
 */
const VIDEO_SOURCE_IMAGE_SPECS = [
	{
		modelIdPrefix: "klingai/",
		spec: {
			acceptedMediaTypes: ["image/jpeg", "image/png"],
			aspectRatio: { max: 2.5, min: 1 / 2.5 },
			maxSourceBytes: 10 * MEBIBYTE,
			minSidePx: 300,
		},
	},
] as const satisfies readonly {
	modelIdPrefix: string;
	spec: VideoSourceImageSpec;
}[];

export function videoSourceImageSpecForModel(
	modelId: string,
): VideoSourceImageSpec {
	const configured = VIDEO_SOURCE_IMAGE_SPECS.find(({ modelIdPrefix }) =>
		modelId.startsWith(modelIdPrefix),
	)?.spec;
	const spec = configured ?? DEFAULT_VIDEO_SOURCE_IMAGE_SPEC;

	// Return a value object so one caller cannot mutate the shared descriptor
	// used to validate another request.
	return {
		acceptedMediaTypes: [...spec.acceptedMediaTypes],
		aspectRatio: { ...spec.aspectRatio },
		maxSourceBytes: spec.maxSourceBytes,
		minSidePx: spec.minSidePx,
	};
}
