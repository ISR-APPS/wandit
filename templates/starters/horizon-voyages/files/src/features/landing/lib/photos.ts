// The six photographs of the page and the crop numbers that put their horizons on the lock line.
// LockedPhoto and the sections read these values. The files are in public/images/.
// The arithmetic is the one of the HORIZON world: see the comment on PhotoLock.

/** One WebP file of public/images, with its real size in pixels. */
export type Photo = {
	/** Path from the site root, for example "/images/dunes.webp". */
	src: string;
	/** Width of the file in pixels. */
	width: number;
	/** Height of the file in pixels. */
	height: number;
};

/**
 * The crop of a photo in a frame of fixed height. The image is `k` times the frame height,
 * centred, then moved up by `ty` percent of its own height, and sideways by `tx` percent of its width.
 * With f the horizon height in the source (0 to 1) and L the lock height in the frame: ty = 100 * (L / k - f).
 */
export type PhotoLock = {
	/** Image height as a multiple of the frame height. Large enough that the image covers the frame. */
	k: number;
	/** Vertical move in percent of the image height. Negative moves the image up. */
	ty: number;
	/** Sideways move in percent of the image width. 0 keeps the image centred. */
	tx?: number;
};

/** The six photographs. Landscapes are 1600px wide, portraits 960px to 1200px wide. */
export const PHOTOS = {
	/** A white hill town under a domed church, not a place in Algeria. Crop it to sea and sky only. */
	sea: { src: "/images/sea.webp", width: 1600, height: 900 },
	cove: { src: "/images/crique.webp", width: 1600, height: 900 },
	dunes: { src: "/images/dunes.webp", width: 1600, height: 900 },
	palms: { src: "/images/oasis.webp", width: 960, height: 1280 },
	bridge: { src: "/images/pont.webp", width: 1050, height: 1400 },
	ksar: { src: "/images/timimoun.webp", width: 1200, height: 1600 },
} as const satisfies Record<string, Photo>;
