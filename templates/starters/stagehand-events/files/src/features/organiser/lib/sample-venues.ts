// The sample venues of the organiser: 8 fictional rooms, halls, and outdoor spaces.
// It stands in for a `venues` table. The events, the venues page, and the venue panel read it.
// Every name, person, and email is fictional. The emails use the reserved example.* domains.

/** The kinds of venue. Each one has the label `venues.kinds.<kind>`. */
export const VENUE_KINDS = [
	"concert_hall",
	"warehouse",
	"theatre",
	"pavilion",
	"rooftop",
	"conference_centre",
	"club",
	"studio",
] as const;

/** One kind of venue. */
export type VenueKind = (typeof VENUE_KINDS)[number];

/** The facilities of a venue. Each one has the label `venues.facilities.<facility>`. */
export const VENUE_FACILITIES = [
	"step_free",
	"bar",
	"green_room",
	"cloakroom",
	"seated",
	"outdoor",
	"catering",
	"av",
] as const;

/** One facility of a venue. */
export type VenueFacility = (typeof VENUE_FACILITIES)[number];

/** One row of the future `venues` table. */
export type Venue = {
	/** Stable id, for example "v-lantern". The `?venue=` search param holds it. */
	id: string;
	name: string;
	kind: VenueKind;
	/** The district of the city, a fictional name. */
	area: string;
	/** Licensed capacity, in people. An event can sell fewer tickets, never more. */
	capacity: number;
	/** Hire fee for one day, in whole euros. */
	hireFeePerDay: number;
	/** The end of the licence, in minutes after midnight. 1380 is 23:00. */
	curfewMinutes: number;
	/** The venue manager, a fictional person. */
	contactName: string;
	contactEmail: string;
	/** One line for the crew: where the trucks go in, and the limits. */
	loadInNote: string;
	facilities: VenueFacility[];
};

/** Every venue, the largest first. */
export const VENUES: readonly Venue[] = [
	{
		id: "v-quayside",
		name: "Quayside Warehouse",
		kind: "warehouse",
		area: "Dockside",
		capacity: 2400,
		hireFeePerDay: 9800,
		curfewMinutes: 1560,
		contactName: "Tobias Wren",
		contactEmail: "tobias.wren@example.com",
		loadInNote:
			"Dock door on the river side. Trucks up to 18 t. No parking after 18:00.",
		facilities: ["bar", "cloakroom", "green_room", "av"],
	},
	{
		id: "v-lantern",
		name: "The Lantern Hall",
		kind: "concert_hall",
		area: "Old Port",
		capacity: 1800,
		hireFeePerDay: 7400,
		curfewMinutes: 1380,
		contactName: "Ines Calloway",
		contactEmail: "ines.calloway@example.com",
		loadInNote: "Stage door on Rope Lane. Lift to the stage holds 1.5 t.",
		facilities: ["step_free", "bar", "green_room", "cloakroom", "av"],
	},
	{
		id: "v-foundry",
		name: "Foundry Conference Centre",
		kind: "conference_centre",
		area: "North Quarter",
		capacity: 1200,
		hireFeePerDay: 6200,
		curfewMinutes: 1320,
		contactName: "Priya Ashdown",
		contactEmail: "priya.ashdown@example.net",
		loadInNote:
			"Goods lift behind hall B. Book the lift 48 hours before load-in.",
		facilities: ["step_free", "seated", "catering", "av", "cloakroom"],
	},
	{
		id: "v-orchard",
		name: "Orchard Pavilion",
		kind: "pavilion",
		area: "Hillside Park",
		capacity: 900,
		hireFeePerDay: 4100,
		curfewMinutes: 1320,
		contactName: "Mateo Brandt",
		contactEmail: "mateo.brandt@example.org",
		loadInNote: "Vans only on the park road. Noise limit of 85 dB after 21:00.",
		facilities: ["step_free", "outdoor", "bar", "catering"],
	},
	{
		id: "v-saltbox",
		name: "Saltbox Theatre",
		kind: "theatre",
		area: "Market Quarter",
		capacity: 620,
		hireFeePerDay: 3300,
		curfewMinutes: 1380,
		contactName: "Hollis Varga",
		contactEmail: "hollis.varga@example.com",
		loadInNote: "Scene dock at the back. Fly tower with 24 bars.",
		facilities: ["seated", "bar", "green_room", "step_free"],
	},
	{
		id: "v-cellar",
		name: "The Cellar Club",
		kind: "club",
		area: "Old Town",
		capacity: 350,
		hireFeePerDay: 1600,
		curfewMinutes: 1620,
		contactName: "Dara Okonkwo",
		contactEmail: "dara.okonkwo@example.net",
		loadInNote:
			"Twelve steps down from the street. No lift: plan a hand carry.",
		facilities: ["bar", "cloakroom", "av"],
	},
	{
		id: "v-meridian",
		name: "Meridian Rooftop",
		kind: "rooftop",
		area: "Riverside",
		capacity: 280,
		hireFeePerDay: 2900,
		curfewMinutes: 1350,
		contactName: "Sunniva Holt",
		contactEmail: "sunniva.holt@example.org",
		loadInNote: "Service lift to level 9. Wind check two hours before doors.",
		facilities: ["outdoor", "bar", "catering", "step_free"],
	},
	{
		id: "v-glasshouse",
		name: "Glasshouse Studio",
		kind: "studio",
		area: "Canal Side",
		capacity: 150,
		hireFeePerDay: 950,
		curfewMinutes: 1320,
		contactName: "Reuben Achterberg",
		contactEmail: "reuben.achterberg@example.com",
		loadInNote: "Ground floor, wide double doors. Tables and stools on site.",
		facilities: ["step_free", "seated", "catering"],
	},
];

/** The venue of an id, or undefined for an unknown id. */
export function findVenue(id: string): Venue | undefined {
	return VENUES.find((venue) => venue.id === id);
}
