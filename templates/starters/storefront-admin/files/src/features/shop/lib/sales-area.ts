// The sales areas of the shop: the nine census divisions of the United States, and the area of each region code.
// The home "Sales by region" card and the region filter of the customer list group the delivery addresses with it.
// A customer row keeps only its two-letter region code. This file turns the code into an area.

/** Every sales area, west to east. Its label is the message key `areas.<area>`. */
export const SALES_AREAS = [
	"pacific",
	"mountain",
	"west_north_central",
	"west_south_central",
	"east_north_central",
	"east_south_central",
	"south_atlantic",
	"middle_atlantic",
	"new_england",
] as const;

/** One sales area. */
export type SalesArea = (typeof SALES_AREAS)[number];

// The area of each region code that the shop delivers to. A later table of addresses keeps the same codes.
const AREA_OF_REGION: ReadonlyMap<string, SalesArea> = new Map([
	["WA", "pacific"],
	["OR", "pacific"],
	["CA", "pacific"],
	["MT", "mountain"],
	["ID", "mountain"],
	["UT", "mountain"],
	["CO", "mountain"],
	["AZ", "mountain"],
	["NM", "mountain"],
	["MN", "west_north_central"],
	["IA", "west_north_central"],
	["NE", "west_north_central"],
	["OK", "west_south_central"],
	["TX", "west_south_central"],
	["WI", "east_north_central"],
	["MI", "east_north_central"],
	["OH", "east_north_central"],
	["KY", "east_south_central"],
	["TN", "east_south_central"],
	["VA", "south_atlantic"],
	["NC", "south_atlantic"],
	["SC", "south_atlantic"],
	["GA", "south_atlantic"],
	["NY", "middle_atlantic"],
	["PA", "middle_atlantic"],
	["VT", "new_england"],
	["RI", "new_england"],
]);

/** The area of a two-letter region code, for example "OR" gives "pacific". null for a code outside the map. */
export function salesAreaOf(region: string): SalesArea | null {
	return AREA_OF_REGION.get(region) ?? null;
}
