// The lots that are not sold yet. LotsSection renders them as the price table.
// A real site reads these rows from a table: STARTER.md says how.
import type { TranslationKey } from "~/shared/i18n";

/** The sale state of a lot. Only "available" prints in bronze. */
export type LotStatus = "available" | "option" | "reserved";

/** One row of the price table. */
export type Lot = {
	/** The lot reference, for example "DLP-04". It is a code, so it has no translation. */
	ref: string;
	/** Key of the villa type name in the `villas` group. */
	typeKey: TranslationKey;
	/** Key of the surface text, unit included. A lot of the villa cards reads the key of its card. */
	surfaceKey: TranslationKey;
	/** Count of bedrooms. */
	bedrooms: number;
	/** Key of the price text, or of "On request". A lot of the villa cards reads the key of its card. */
	priceKey: TranslationKey;
	/** The sale state. It sets the status mark and its color. */
	status: LotStatus;
};

/** The text key of each sale state. */
export const LOT_STATUS_KEYS: Record<LotStatus, TranslationKey> = {
	available: "lots.statusAvailable",
	option: "lots.statusOption",
	reserved: "lots.statusReserved",
};

/** The five lots that remain, in reference order. Three are available: the lede of the section says the same. */
export const REMAINING_LOTS: readonly Lot[] = [
	{
		ref: "DLP-04",
		typeKey: "villas.pinName",
		surfaceKey: "villas.pinSurface",
		bedrooms: 4,
		priceKey: "villas.pinPrice",
		status: "available",
	},
	{
		ref: "DLP-06",
		typeKey: "villas.pinName",
		surfaceKey: "lots.surface336",
		bedrooms: 4,
		priceKey: "lots.price104",
		status: "option",
	},
	{
		ref: "DLP-07",
		typeKey: "villas.cypresName",
		surfaceKey: "villas.cypresSurface",
		bedrooms: 5,
		priceKey: "villas.cypresPrice",
		status: "available",
	},
	{
		ref: "DLP-09",
		typeKey: "villas.cypresName",
		surfaceKey: "lots.surface462",
		bedrooms: 5,
		priceKey: "lots.price142",
		status: "reserved",
	},
	{
		ref: "DLP-12",
		typeKey: "villas.palmierName",
		surfaceKey: "villas.palmierSurface",
		bedrooms: 6,
		priceKey: "lots.priceOnRequest",
		status: "available",
	},
];
