// The structured sample content of the home page: section links, the three houses, the residence facts,
// the studio figures, and the choices of the viewing note. The sections of src/features/landing read it.
// The words live in messages.ts; this file holds the keys, the numbers, and the image files.
import type { TranslationKey } from "~/shared/i18n";

/** One anchor link of the header, the phone menu, and the footer. */
export type SectionLink = {
	/** The id of the target section on the home page, without "#". */
	id: string;
	label: TranslationKey;
};

/** The sections that the header and the phone menu link to, in page order. */
export const SECTION_LINKS: readonly SectionLink[] = [
	{ id: "portfolio", label: "nav.portfolio" },
	{ id: "residence", label: "nav.residence" },
	{ id: "contact", label: "nav.contact" },
];

/** One house of the portfolio row. Every text is a key of the `portfolio` group. */
export type PortfolioHouse = {
	/** The anchor id of the panel. The footer links to it. */
	id: string;
	/** The plate number, "01" to "03". It is also the giant outlined numeral. */
	plate: string;
	/** Key of the place line above the name, for example "Lofoten — Norway". */
	location: TranslationKey;
	name: TranslationKey;
	/** The second word of the name. It renders in bronze italics. */
	accent: TranslationKey;
	description: TranslationKey;
	/** Key of the caption under the photo, for example "Fig. 01 — North elevation". */
	figure: TranslationKey;
	/** Key of the map position at the end of the caption, for example "68°09′ N · 13°36′ E". */
	coordinates: TranslationKey;
	/** Key of the alt text of the photo. */
	alt: TranslationKey;
	/** A file in public/images. Each plate is 1100 x 1366 px. */
	image: string;
	/** The CSS object-position of the photo inside the 4:5 plate. */
	focus: string;
	bedrooms: number;
	/** Interior area in square metres. */
	interiorM2: number;
	completedYear: number;
	/** Guide price in millions of US dollars. */
	guidePriceMillions: number;
};

/** The three houses of the portfolio row, in plate order. */
export const PORTFOLIO_HOUSES: readonly PortfolioHouse[] = [
	{
		id: "vermilion-house",
		plate: "01",
		location: "portfolio.vermilionLocation",
		name: "portfolio.vermilionName",
		accent: "portfolio.vermilionAccent",
		description: "portfolio.vermilionDescription",
		figure: "portfolio.vermilionFigure",
		coordinates: "portfolio.vermilionCoordinates",
		alt: "portfolio.vermilionAlt",
		image: "/images/vermilion-house.webp",
		focus: "50% 32%",
		bedrooms: 4,
		interiorM2: 620,
		completedYear: 2019,
		guidePriceMillions: 8.4,
	},
	{
		id: "pavilion-nord",
		plate: "02",
		location: "portfolio.nordLocation",
		name: "portfolio.nordName",
		accent: "portfolio.nordAccent",
		description: "portfolio.nordDescription",
		figure: "portfolio.nordFigure",
		coordinates: "portfolio.nordCoordinates",
		alt: "portfolio.nordAlt",
		image: "/images/pavilion-nord.webp",
		focus: "50% 50%",
		bedrooms: 3,
		interiorM2: 340,
		completedYear: 2022,
		guidePriceMillions: 6.1,
	},
	{
		id: "kiri-house",
		plate: "03",
		location: "portfolio.kiriLocation",
		name: "portfolio.kiriName",
		accent: "portfolio.kiriAccent",
		description: "portfolio.kiriDescription",
		figure: "portfolio.kiriFigure",
		coordinates: "portfolio.kiriCoordinates",
		alt: "portfolio.kiriAlt",
		image: "/images/kiri-house.webp",
		focus: "50% 50%",
		bedrooms: 5,
		interiorM2: 410,
		completedYear: 2017,
		guidePriceMillions: 4.7,
	},
];

/** The facts of Casa Meridiana. ResidenceSection prints them in its spec table, in the order of the fields. */
export const CASA_MERIDIANA = {
	bedrooms: 6,
	bathrooms: 8,
	/** Interior area in square metres. */
	interiorM2: 1240,
	completedYear: 2021,
} as const;

/** One figure of the "Meridian, measured" band. */
export type StudioFigure = {
	/** A whole number, formatted with the group separator of the page language. */
	value: number;
	/** A small bronze sign after the figure, for example "+". Empty for none. */
	suffix: string;
	label: TranslationKey;
};

/** The four figures of the band, in reading order. */
export const STUDIO_FIGURES: readonly StudioFigure[] = [
	{ value: 140, suffix: "+", label: "numbers.placed" },
	{ value: 96400, suffix: "", label: "numbers.area" },
	{ value: 34, suffix: "", label: "numbers.days" },
	{ value: 12, suffix: "", label: "numbers.countries" },
];

/** One choice of the viewing note. The label goes into the email subject; the detail does not. */
export type ViewingChoice = {
	/** The value of the radio input. Unique inside its group. */
	id: string;
	/** The words of the label, joined with a space. A house uses its name key and its accent key. */
	label: readonly TranslationKey[];
	/** A muted second line under the label, or null. */
	detail: TranslationKey | null;
};

/** The houses that a visitor can name in the viewing note. The names come from PORTFOLIO_HOUSES and the hero. */
export const HOUSE_CHOICES: readonly ViewingChoice[] = [
	...PORTFOLIO_HOUSES.map((house) => ({
		id: house.id,
		label: [house.name, house.accent],
		detail: house.location,
	})),
	{
		id: "casa-meridiana",
		label: ["hero.currentName"],
		detail: "contact.casaLocation",
	},
	{
		id: "off-portfolio",
		label: ["contact.offPortfolio"],
		detail: "contact.offPortfolioDetail",
	},
];

/** The times of day that a visitor can ask for. Viewings follow the light of the house. */
export const LIGHT_CHOICES: readonly ViewingChoice[] = [
	{ id: "morning", label: ["contact.lightMorning"], detail: null },
	{ id: "afternoon", label: ["contact.lightAfternoon"], detail: null },
	{ id: "flexible", label: ["contact.lightFlexible"], detail: null },
];
