// The two colorways of the lamp: their text keys and their photos.
// The hero toggle, the order card, and the reserve swatches map over COLORWAYS.
// LandingPage holds the chosen id in React state; landing.css reads it from data-colorway.
import type { TranslationKey } from "~/shared/i18n";

/** Id of a colorway. Also the value of `data-colorway` on the page root. */
export type Colorway = "creme" | "noir";

/** One colorway as the page shows it. */
type ColorwayOption = {
	id: Colorway;
	/** Short name, for example "Crème". */
	nameKey: TranslationKey;
	/** The base stone, for example "Travertine base". */
	baseKey: TranslationKey;
	/** Museum caption under the hero frame. */
	captionKey: TranslationKey;
	/** Alt text of the photo. */
	altKey: TranslationKey;
	/** Photo in public/images, a 4:5-ish portrait. */
	src: string;
	/** Pixel size of the WebP file, for the width and height attributes. */
	width: number;
	height: number;
};

/** Crème first: it is the state of the page at load. */
export const COLORWAYS: readonly ColorwayOption[] = [
	{
		id: "creme",
		nameKey: "colorway.creme",
		baseKey: "colorway.cremeBase",
		captionKey: "colorway.cremeCaption",
		altKey: "colorway.cremeAlt",
		src: "/images/lamp-creme.webp",
		width: 1100,
		height: 1366,
	},
	{
		id: "noir",
		nameKey: "colorway.noir",
		baseKey: "colorway.noirBase",
		captionKey: "colorway.noirCaption",
		altKey: "colorway.noirAlt",
		src: "/images/lamp-noir.webp",
		width: 1100,
		height: 1467,
	},
];
