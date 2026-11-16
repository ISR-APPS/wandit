// The photographs of the home page: one file per photo, with its pixel size.
// The section components read it and pass each entry to PhotoMask. The files are in public/images/.
// All six share one golden grade. A new photo must match it, or the page loses its light.

/** One photo file. The size lets the browser reserve the space before the image loads. */
export type Photo = {
	/** Path under public/, for example "/images/facial-care.webp". */
	src: string;
	/** Width of the file in pixels. */
	width: number;
	/** Height of the file in pixels. */
	height: number;
};

/** The six photos. Several sections show the same photo with another crop. */
export const PHOTOS = {
	portrait: { src: "/images/portrait-glow.webp", width: 960, height: 1345 },
	serum: { src: "/images/serum-ritual.webp", width: 1200, height: 900 },
	hands: { src: "/images/hands-cream.webp", width: 1000, height: 1000 },
	ceramics: { src: "/images/ceramics-room.webp", width: 1400, height: 1867 },
	practitioner: {
		src: "/images/practitioner.webp",
		width: 1000,
		height: 1352,
	},
	facial: { src: "/images/facial-care.webp", width: 1400, height: 934 },
} as const satisfies Record<string, Photo>;
