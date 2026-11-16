// The three circuits of the agency. CircuitsSection renders one card for each; BoardingPass lists them as choices.
// Texts live in the `circuits` group of messages.ts. The frame and the lock put each horizon on one shared line.
import type { TranslationKey } from "~/shared/i18n";
import { PHOTOS, type Photo, type PhotoLock } from "./photos";

/**
 * The frame height of a card. Three heights side by side make the staggered grid.
 * landing.css gives each one a clamp(): tall 380px to 470px, wide 280px to 350px, mid 360px to 410px.
 */
export type CircuitFrame = "tall" | "wide" | "mid";

/** One circuit card: its texts, its photo, and the three climate chips of its head. */
export type Circuit = {
	/** Stable id. Also the React key. */
	id: string;
	nameKey: TranslationKey;
	bodyKey: TranslationKey;
	/** Temperature, season by month, and travel time from Algiers, in that order. The first chip carries the sun dot. */
	chipKeys: readonly [TranslationKey, TranslationKey, TranslationKey];
	/** Days and nights, for example "5 days / 4 nights". */
	durationKey: TranslationKey;
	/** Price per traveller in Algerian dinars, written with its separators. */
	priceKey: TranslationKey;
	altKey: TranslationKey;
	/** Airport code of the circuit in the request code of the boarding pass, in `quote.circuitCodes`. */
	codeKey: TranslationKey;
	photo: Photo;
	/** Puts the horizon of the photo at 34% of the frame height. */
	lock: PhotoLock;
	frame: CircuitFrame;
};

/** The three circuits, in page order. Prices cover transport, lodging, full board, and the guide. */
export const CIRCUITS: readonly Circuit[] = [
	{
		id: "gourara",
		nameKey: "circuits.gourara.name",
		bodyKey: "circuits.gourara.body",
		chipKeys: [
			"circuits.gourara.temp",
			"circuits.gourara.season",
			"circuits.gourara.access",
		],
		durationKey: "circuits.gourara.duration",
		priceKey: "circuits.gourara.price",
		altKey: "circuits.gourara.alt",
		codeKey: "quote.circuitCodes.gourara",
		photo: PHOTOS.ksar,
		lock: { k: 1.35, ty: -14.8 },
		frame: "tall",
	},
	{
		id: "coast",
		nameKey: "circuits.coast.name",
		bodyKey: "circuits.coast.body",
		chipKeys: [
			"circuits.coast.temp",
			"circuits.coast.season",
			"circuits.coast.access",
		],
		durationKey: "circuits.coast.duration",
		priceKey: "circuits.coast.price",
		altKey: "circuits.coast.alt",
		codeKey: "quote.circuitCodes.coast",
		photo: PHOTOS.cove,
		lock: { k: 1.35, ty: -2.1 },
		frame: "wide",
	},
	{
		id: "constantine",
		nameKey: "circuits.constantine.name",
		bodyKey: "circuits.constantine.body",
		chipKeys: [
			"circuits.constantine.temp",
			"circuits.constantine.season",
			"circuits.constantine.access",
		],
		durationKey: "circuits.constantine.duration",
		priceKey: "circuits.constantine.price",
		altKey: "circuits.constantine.alt",
		codeKey: "quote.circuitCodes.constantine",
		photo: PHOTOS.bridge,
		lock: { k: 1.35, ty: -7.8 },
		frame: "mid",
	},
];
