// The five photographs of the home page, one entry per file, with its pixel size.
// The sections pass each entry to GradedPhoto, or to a plain <img> in the hero and the ritual stage.
// The files are in public/images/. All five share one grade, so a new photo must look like the same afternoon.

/** One photo file. The size lets the browser reserve the space before the image loads. */
export type Photo = {
	/** Path under public/, for example "/images/linen.webp". */
	src: string;
	/** Width of the file in pixels. */
	width: number;
	/** Height of the file in pixels. */
	height: number;
};

/** The five photos. The ritual stage shows the steam room, the pool, and the tea tray a second time. */
export const PHOTOS = {
	steamRoom: { src: "/images/steam-room.webp", width: 1600, height: 900 },
	coldPool: { src: "/images/cold-pool.webp", width: 1200, height: 1600 },
	linen: { src: "/images/linen.webp", width: 1200, height: 1608 },
	teaTray: { src: "/images/tea-tray.webp", width: 1200, height: 1600 },
	warmStones: { src: "/images/warm-stones.webp", width: 1200, height: 1608 },
} as const satisfies Record<string, Photo>;
