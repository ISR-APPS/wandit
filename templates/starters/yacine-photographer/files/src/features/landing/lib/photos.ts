// The eight photographs of the site, with the camera settings that the EXIF chips print.
// photo-frame.tsx reads PHOTOS and prints the settings; content.ts names a photo by its id.
// The files are in public/images. The alt texts are in the "photos" group of messages.ts.
import type { TranslationKey } from "~/shared/i18n";

/** The id of one photograph. It is also the file name in public/images. */
export type PhotoId =
	| "casbah"
	| "harbour"
	| "market"
	| "rooftops"
	| "cafe"
	| "sea"
	| "wedding"
	| "window";

/** One photograph and the settings of its exposure. */
type Photo = {
	/** Path from the site root. Vite serves public/ there. */
	src: string;
	/** Width of the file in pixels. With height, it reserves the space before the load. */
	width: number;
	/** Height of the file in pixels. */
	height: number;
	/** Key of the alt text in messages.ts. */
	altKey: TranslationKey;
	/** Aperture as a camera prints it, for example "ƒ/2.8". */
	aperture: string;
	/** Shutter speed in seconds as a fraction, for example "1/250". */
	shutter: string;
	/** Film speed, for example "ISO 400". */
	iso: string;
	/** Focal length of the lens, for example "35 mm". */
	lens: string;
};

/** Every photograph by id. The settings match the scene: a fast shutter for the sea, a wide aperture indoors. */
export const PHOTOS: Record<PhotoId, Photo> = {
	casbah: {
		src: "/images/casbah.webp",
		width: 1600,
		height: 900,
		altKey: "photos.casbahAlt",
		aperture: "ƒ/5.6",
		shutter: "1/250",
		iso: "ISO 100",
		lens: "35 mm",
	},
	harbour: {
		src: "/images/harbour.webp",
		width: 1600,
		height: 900,
		altKey: "photos.harbourAlt",
		aperture: "ƒ/8",
		shutter: "1/500",
		iso: "ISO 100",
		lens: "50 mm",
	},
	market: {
		src: "/images/market.webp",
		width: 1200,
		height: 1600,
		altKey: "photos.marketAlt",
		aperture: "ƒ/2.8",
		shutter: "1/125",
		iso: "ISO 400",
		lens: "35 mm",
	},
	rooftops: {
		src: "/images/rooftops.webp",
		width: 1600,
		height: 900,
		altKey: "photos.rooftopsAlt",
		aperture: "ƒ/2",
		shutter: "1/60",
		iso: "ISO 400",
		lens: "35 mm",
	},
	cafe: {
		src: "/images/cafe.webp",
		width: 1600,
		height: 900,
		altKey: "photos.cafeAlt",
		aperture: "ƒ/1.4",
		shutter: "1/60",
		iso: "ISO 400",
		lens: "50 mm",
	},
	sea: {
		src: "/images/sea.webp",
		width: 1600,
		height: 900,
		altKey: "photos.seaAlt",
		aperture: "ƒ/11",
		shutter: "1/1000",
		iso: "ISO 100",
		lens: "50 mm",
	},
	wedding: {
		src: "/images/wedding.webp",
		width: 1200,
		height: 1600,
		altKey: "photos.weddingAlt",
		aperture: "ƒ/2.8",
		shutter: "1/250",
		iso: "ISO 400",
		lens: "35 mm",
	},
	window: {
		src: "/images/window.webp",
		width: 1200,
		height: 1600,
		altKey: "photos.windowAlt",
		aperture: "ƒ/2",
		shutter: "1/125",
		iso: "ISO 400",
		lens: "35 mm",
	},
};

/**
 * How much of the exposure an EXIF chip prints.
 * "short": aperture and shutter, for example "ƒ/2.8 · 1/250". "standard": plus the film speed. "full": plus the lens.
 */
export type ExifDetail = "short" | "standard" | "full";
