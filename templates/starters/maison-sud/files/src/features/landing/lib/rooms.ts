// The five rooms of House N°7, in the order a visitor walks them.
// The hero itinerary, the room walk, and the floor plan read this list.
// Each text is a message key. Each photo is a WebP file of public/images.
import type { TranslationKey } from "~/shared/i18n";

/** One stop of the itinerary. */
export type Room = {
	/** Stable id of the room. It is the React key of the lists. */
	id: "living" | "kitchen" | "corridor" | "bedroom" | "bathroom";
	/** Two digits of the walking number, for example "01". The page prints them alone or after "N°". Not translated. */
	digits: string;
	/** Full room name of the index list. */
	nameKey: TranslationKey;
	/** One-word name that fits a cell of the hero itinerary. */
	shortNameKey: TranslationKey;
	/** Surface and orientation, shown under the name in the index list. */
	factsKey: TranslationKey;
	/** The three lines of the caption plinth: micro-cap label, serif title, and note. */
	plinthLabelKey: TranslationKey;
	plinthTitleKey: TranslationKey;
	plinthNoteKey: TranslationKey;
	/** Alt text of the photo. */
	altKey: TranslationKey;
	/** Public path of the photo and its pixel size. */
	image: { src: string; width: number; height: number };
	/** Tailwind object-position class that keeps the subject inside the square crop. */
	focusClassName: string;
	/** The room rectangle on the 300 x 190 floor plan, in viewBox units. */
	plan: { x: number; y: number; width: number; height: number };
};

/** The itinerary. The order is the walking order, so the numbers are not decoration. */
export const ROOMS: readonly Room[] = [
	{
		id: "living",
		digits: "01",
		nameKey: "rooms.living",
		shortNameKey: "rooms.livingShort",
		factsKey: "rooms.livingFacts",
		plinthLabelKey: "rooms.livingLabel",
		plinthTitleKey: "rooms.livingTitle",
		plinthNoteKey: "rooms.livingNote",
		altKey: "rooms.livingAlt",
		image: { src: "/images/living-room.webp", width: 1600, height: 900 },
		focusClassName: "object-[58%_center]",
		plan: { x: 8, y: 8, width: 142, height: 96 },
	},
	{
		id: "kitchen",
		digits: "02",
		nameKey: "rooms.kitchen",
		shortNameKey: "rooms.kitchenShort",
		factsKey: "rooms.kitchenFacts",
		plinthLabelKey: "rooms.kitchenLabel",
		plinthTitleKey: "rooms.kitchenTitle",
		plinthNoteKey: "rooms.kitchenNote",
		altKey: "rooms.kitchenAlt",
		image: { src: "/images/kitchen.webp", width: 1440, height: 1920 },
		focusClassName: "object-[center_70%]",
		plan: { x: 150, y: 8, width: 142, height: 96 },
	},
	{
		id: "corridor",
		digits: "03",
		nameKey: "rooms.corridor",
		shortNameKey: "rooms.corridorShort",
		factsKey: "rooms.corridorFacts",
		plinthLabelKey: "rooms.corridorLabel",
		plinthTitleKey: "rooms.corridorTitle",
		plinthNoteKey: "rooms.corridorNote",
		altKey: "rooms.corridorAlt",
		image: { src: "/images/corridor.webp", width: 1440, height: 1920 },
		focusClassName: "object-[center_55%]",
		plan: { x: 8, y: 104, width: 284, height: 30 },
	},
	{
		id: "bedroom",
		digits: "04",
		nameKey: "rooms.bedroom",
		shortNameKey: "rooms.bedroomShort",
		factsKey: "rooms.bedroomFacts",
		plinthLabelKey: "rooms.bedroomLabel",
		plinthTitleKey: "rooms.bedroomTitle",
		plinthNoteKey: "rooms.bedroomNote",
		altKey: "rooms.bedroomAlt",
		image: { src: "/images/bedroom.webp", width: 1600, height: 900 },
		focusClassName: "object-[center_60%]",
		plan: { x: 8, y: 134, width: 162, height: 48 },
	},
	{
		id: "bathroom",
		digits: "05",
		nameKey: "rooms.bathroom",
		shortNameKey: "rooms.bathroomShort",
		factsKey: "rooms.bathroomFacts",
		plinthLabelKey: "rooms.bathroomLabel",
		plinthTitleKey: "rooms.bathroomTitle",
		plinthNoteKey: "rooms.bathroomNote",
		altKey: "rooms.bathroomAlt",
		image: { src: "/images/bathroom.webp", width: 1600, height: 900 },
		focusClassName: "object-[38%_center]",
		plan: { x: 170, y: 134, width: 122, height: 48 },
	},
];
