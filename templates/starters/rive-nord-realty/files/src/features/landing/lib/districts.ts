// The four districts of the register filter and of the drawn map.
// RegisterSection, DistrictsSection, and ListingSlip read them. The texts live in the `districts` group of messages.ts.
// The figures are fictional sample content. A real agency replaces them with its own figures.
import type { TranslationKey } from "~/shared/i18n";

/** The id of a district. It is also the value of the register filter. */
export type DistrictId = "heights" | "belvedere" | "old-town" | "east-quay";

/** One district of the north bank, with its pin on the drawn map. */
export type District = {
	id: DistrictId;
	nameKey: TranslationKey;
	/** The opinion of the agency, shown on the district sheet. */
	quoteKey: TranslationKey;
	/** Homes on offer at the agency in this district, not only the ones on the page. */
	homesAvailable: number;
	/** Average asking price of the district, in euros per square metre. */
	averagePerSqm: number;
	/** Pin position on the map, in percent of the map width and height from the top start corner. */
	pinX: number;
	pinY: number;
	/** "above" puts the label over the dot, for a pin near the coast line. */
	labelSide: "above" | "below";
};

/** Order of the filter chips and of the slip choices. */
export const DISTRICTS: readonly District[] = [
	{
		id: "heights",
		nameKey: "districts.heights",
		quoteKey: "districts.heightsQuote",
		homesAvailable: 5,
		averagePerSqm: 4620,
		pinX: 41,
		pinY: 24,
		labelSide: "below",
	},
	{
		id: "east-quay",
		nameKey: "districts.eastQuay",
		quoteKey: "districts.eastQuayQuote",
		homesAvailable: 4,
		averagePerSqm: 3460,
		pinX: 78,
		pinY: 54,
		labelSide: "above",
	},
	{
		id: "old-town",
		nameKey: "districts.oldTown",
		quoteKey: "districts.oldTownQuote",
		homesAvailable: 6,
		averagePerSqm: 3690,
		pinX: 47,
		pinY: 50,
		labelSide: "above",
	},
	{
		id: "belvedere",
		nameKey: "districts.belvedere",
		quoteKey: "districts.belvedereQuote",
		homesAvailable: 4,
		averagePerSqm: 3780,
		pinX: 21,
		pinY: 40,
		labelSide: "below",
	},
];

/** Districts that the agency follows in all, also the ones with no pin on the map. */
export const DISTRICTS_COVERED = 11;

/** Homes on offer at the agency this week, in all districts. */
export const HOMES_AT_AGENCY = 23;

/** The district of an id. The id type allows only known ids, so the result always exists. */
export function districtOf(id: DistrictId): District {
	const district = DISTRICTS.find((item) => item.id === id);
	if (district === undefined) {
		throw new Error(`Unknown district ${id}`);
	}
	return district;
}
