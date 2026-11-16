// The lists of the home page: the nav links, the film strips, the series, the wall, the contact sheet, and the prints.
// The section components read them. Each text is a key of messages.ts; each photo is an id of photos.ts.
// Frame numbers follow a real roll: a frame, then its half step "A", then the next frame.
import type { TranslationKey } from "~/shared/i18n";
import type { PhotoId } from "./photos";

/** One anchor link of the header. `href` is the id of a section of the page. */
type NavLink = { href: string; labelKey: TranslationKey };

/** The section links, in page order. Below 820px they sit in a second row of the sticky header. */
export const NAV_LINKS: NavLink[] = [
	{ href: "#series", labelKey: "site.navSeries" },
	{ href: "#gallery", labelKey: "site.navGallery" },
	{ href: "#sheet", labelKey: "site.navSheet" },
	{ href: "#prints", labelKey: "site.navPrints" },
	{ href: "#contact", labelKey: "site.navContact" },
];

/** One frame of a strip or of the contact sheet. `number` is the frame number that the film edge prints. */
type Frame = { photo: PhotoId; number: string };

/** The eight frames of the strip under the hero. The viewport edge cuts the strip, so the roll continues. */
export const STRIP_FRAMES: Frame[] = [
	{ photo: "casbah", number: "21" },
	{ photo: "harbour", number: "21A" },
	{ photo: "market", number: "22" },
	{ photo: "rooftops", number: "23" },
	{ photo: "cafe", number: "24" },
	{ photo: "sea", number: "24A" },
	{ photo: "wedding", number: "25" },
	{ photo: "window", number: "26" },
];

/** One series of the photographer: its cover photo, its index number, and its text keys. */
export type Series = {
	photo: PhotoId;
	/** Index of the series, printed on the plate of its cover. */
	number: string;
	titleKey: TranslationKey;
	/** First and last year of the series, for example "2021 — 2026". */
	yearsKey: TranslationKey;
	bodyKey: TranslationKey;
	/**
	 * The grid place and the vertical offset of the card, as Tailwind classes.
	 * The grid has one column on a phone, two on a tablet, and three from 821px.
	 */
	place: string;
	/** The Tailwind aspect class of the cover. */
	ratio: string;
};

/** The three open series, in page order. The cards sit at three heights; the third takes a full tablet row. */
export const SERIES: Series[] = [
	{
		photo: "casbah",
		number: "01",
		titleKey: "series.casbahTitle",
		yearsKey: "series.casbahYears",
		bodyKey: "series.casbahBody",
		place: "",
		ratio: "aspect-[4/5]",
	},
	{
		photo: "harbour",
		number: "02",
		titleKey: "series.coastTitle",
		yearsKey: "series.coastYears",
		bodyKey: "series.coastBody",
		place: "[--cut:1] max-[470px]:mt-2 min-[471px]:mt-[clamp(24px,5vw,64px)]",
		ratio: "aspect-[4/5]",
	},
	{
		photo: "wedding",
		number: "03",
		titleKey: "series.weddingsTitle",
		yearsKey: "series.weddingsYears",
		bodyKey: "series.weddingsBody",
		place:
			"[--cut:2] max-[470px]:mt-2 min-[471px]:max-[820px]:col-span-2 min-[471px]:max-[820px]:mt-[26px] min-[821px]:mt-[clamp(10px,2.4vw,30px)]",
		// The cover turns wide on a tablet, where the card takes a full row.
		ratio: "aspect-[4/5] min-[471px]:max-[820px]:aspect-[16/10]",
	},
];

/** One print of the wall. A wide print has the 3:2 ratio; the others have 3:4. */
type WallPrint = { photo: PhotoId; isWide: boolean };

/** One column of the wall. `id` is its React key. */
type WallColumn = { id: string; prints: WallPrint[] };

/**
 * The three columns of the wall, six prints each. The ratios alternate, so no two rows line up.
 * Eight photographs fill eighteen prints, so a search over the scroll progress set this order.
 * At every width from 360px, no photograph shows in two side-by-side columns at the same moment.
 * On a landscape desktop, no photograph shows twice in the window. Re-check both rules
 * when you change a print, a ratio, or the drift shares in landing.css.
 */
export const WALL_COLUMNS: WallColumn[] = [
	{
		id: "left",
		prints: [
			{ photo: "window", isWide: false },
			{ photo: "cafe", isWide: true },
			{ photo: "casbah", isWide: false },
			{ photo: "sea", isWide: true },
			{ photo: "market", isWide: false },
			{ photo: "rooftops", isWide: true },
		],
	},
	{
		id: "middle",
		prints: [
			{ photo: "cafe", isWide: true },
			{ photo: "rooftops", isWide: false },
			{ photo: "harbour", isWide: true },
			{ photo: "wedding", isWide: false },
			{ photo: "rooftops", isWide: true },
			{ photo: "wedding", isWide: false },
		],
	},
	{
		id: "right",
		prints: [
			{ photo: "casbah", isWide: true },
			{ photo: "market", isWide: false },
			{ photo: "sea", isWide: true },
			{ photo: "window", isWide: false },
			{ photo: "cafe", isWide: true },
			{ photo: "harbour", isWide: false },
		],
	},
];

/** One frame of the contact sheet. A kept frame gets a grease-pencil mark; `mark` selects one of its three tilts. */
type SheetFrame = Frame & { mark?: "a" | "b" | "c" };

/** One strip of the contact sheet: four frames between two sprocket bands. `id` is its React key. */
type SheetRow = { id: string; frames: SheetFrame[] };

/** The two rows of the contact sheet. Three frames are kept: the count that the margin and the note state. */
export const SHEET_ROWS: SheetRow[] = [
	{
		id: "frames-12-13",
		frames: [
			{ photo: "casbah", number: "12" },
			{ photo: "rooftops", number: "12A", mark: "a" },
			{ photo: "cafe", number: "13" },
			{ photo: "market", number: "13A" },
		],
	},
	{
		id: "frames-14-15",
		frames: [
			{ photo: "sea", number: "14", mark: "c" },
			{ photo: "harbour", number: "14A" },
			{ photo: "window", number: "15", mark: "b" },
			{ photo: "wedding", number: "15A" },
		],
	},
];

/** The three square frames of the vertical strip beside the client quote. */
export const QUOTE_STRIP: PhotoId[] = ["wedding", "rooftops", "cafe"];

/** One paper print for sale. `ratio` is the Tailwind aspect class of its photograph. */
export type Print = {
	photo: PhotoId;
	ratio: string;
	/** Paper size, for example "60 × 90 cm". */
	formatKey: TranslationKey;
	/** Price in Algerian dinars, as a figure. The plate prints the currency code after it. */
	amountKey: TranslationKey;
	/** Edition size and the name of the picture. */
	editionKey: TranslationKey;
};

/** The three prints, from the largest to the smallest. Their bases align, so their tops make a staircase. */
export const PRINTS: Print[] = [
	{
		photo: "rooftops",
		ratio: "aspect-[4/5]",
		formatKey: "prints.largeFormat",
		amountKey: "prints.largeAmount",
		editionKey: "prints.largeEdition",
	},
	{
		photo: "sea",
		ratio: "aspect-square",
		formatKey: "prints.mediumFormat",
		amountKey: "prints.mediumAmount",
		editionKey: "prints.mediumEdition",
	},
	{
		photo: "market",
		ratio: "aspect-[5/4]",
		formatKey: "prints.smallFormat",
		amountKey: "prints.smallAmount",
		editionKey: "prints.smallEdition",
	},
];
