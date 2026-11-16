// The sample tables of the dispatch desk: depots, customers, drivers, vehicles, and shipments.
// Only the query files (api/*.queries.ts of each feature) read them, through getSampleTables().
// The rows stand in for a database. A later turn replaces each queryFn with a Supabase call, then deletes this file.
// The tables show the desk at the start of today: every event is before this midnight, so no time is in the future.
// LIMIT: the history moves by one day at midnight, so the rows change then. Upgrade: real tables (STARTER.md).
import type { LicenceClass, VehicleKind } from "./fleet-status";
import { HOUR_MS, MINUTE_MS, startOfLocalDay } from "./relative-time";
import {
	EXCEPTION_REASONS,
	type ExceptionReason,
	type ServiceLevel,
	type ShipmentStatus,
} from "./shipment-status";

/** One depot. Each vehicle, driver, and customer belongs to one depot. */
export type DepotRow = {
	id: string;
	/** The name on the pages, for example "Harlow Bay hub". */
	name: string;
	town: string;
};

/** One customer that receives shipments. */
export type CustomerRow = {
	id: string;
	/** The company name. */
	name: string;
	/** The person that signs for a delivery. */
	contactName: string;
	phone: string;
	street: string;
	town: string;
	/** The depot that serves the customer. */
	depotId: string;
	/** Road distance from that depot, in kilometers. */
	distanceKm: number;
	/** True when the goods need a chilled truck. */
	isChilled: boolean;
	/** What the driver must know at the door. */
	deliveryNote: string;
};

/** One driver of the team. */
export type DriverRow = {
	id: string;
	name: string;
	phone: string;
	licenceClass: LicenceClass;
	depotId: string;
	/** The first day at the company, as ISO. */
	hiredAt: string;
	/** True on a rest day. An off-duty driver has no open shipment. */
	isOffDuty: boolean;
};

/** One vehicle of the fleet. */
export type VehicleRow = {
	id: string;
	/** The fleet number on the door, for example "B-05". */
	unit: string;
	kind: VehicleKind;
	plate: string;
	depotId: string;
	/** The largest payload, in kilograms. */
	capacityKg: number;
	/** How many pallets fit on the floor. */
	palletSpaces: number;
	odometerKm: number;
	/** The fuel level from 0 to 100. */
	fuelPercent: number;
	/** The day of the next service, as ISO. A past day is an overdue service. */
	serviceDueAt: string;
	lastInspectionAt: string;
	/** Why the vehicle is in the workshop. null when it is fit for the road. */
	workshopNote: string | null;
};

/** One shipment. The times are ISO texts. A step that did not happen yet is null. */
export type ShipmentRow = {
	/** The number of the reference, as text. It is also the URL id. */
	id: string;
	/** The reference on the paperwork, for example "RW-44853". */
	reference: string;
	customerId: string;
	/** The depot that the shipment leaves from. */
	depotId: string;
	service: ServiceLevel;
	pallets: number;
	weightKg: number;
	status: ShipmentStatus;
	bookedAt: string;
	/** The end of the promised delivery day. A shipment is late from the next day. */
	dueAt: string;
	assignedAt: string | null;
	pickedUpAt: string | null;
	/** When the shipment was delivered, or when the delivery failed. null while it is open. */
	closedAt: string | null;
	/** Why the delivery is late or failed. null for a delivery with no problem. */
	exceptionReason: ExceptionReason | null;
	/** When the driver or the depot reported the delay. null for a failed delivery: closedAt is its time. */
	exceptionAt: string | null;
	driverId: string | null;
	vehicleId: string | null;
};

/** Every sample table. Each list is in creation order; the query files sort and join them. */
export type SampleTables = {
	/** The midnight that starts today, in milliseconds since 1970. The tables show the desk at this moment. */
	dayStart: number;
	depots: DepotRow[];
	customers: CustomerRow[];
	drivers: DriverRow[];
	vehicles: VehicleRow[];
	shipments: ShipmentRow[];
};

const DEPOTS: DepotRow[] = [
	{ id: "dep-1", name: "Harlow Bay hub", town: "Harlow Bay" },
	{ id: "dep-2", name: "Northgate depot", town: "Northgate" },
	{ id: "dep-3", name: "Eastmere depot", town: "Eastmere" },
];

/** One customer before its id, phone, and street. `weight` is how often the customer ships: 5 ships the most. */
type CustomerSeed = {
	name: string;
	contactName: string;
	town: string;
	depotId: string;
	distanceKm: number;
	weight: number;
	isChilled?: boolean;
};

const CUSTOMER_SEEDS: CustomerSeed[] = [
	{
		name: "Alder & Finch Hardware",
		contactName: "Helena Marsh",
		town: "Saltby",
		depotId: "dep-1",
		distanceKm: 24,
		weight: 4,
	},
	{
		name: "Brightleaf Pharmacy",
		contactName: "Idris Kamara",
		town: "Harlow Bay",
		depotId: "dep-1",
		distanceKm: 6,
		weight: 5,
		isChilled: true,
	},
	{
		name: "Calloway Print Works",
		contactName: "Joanna Petrie",
		town: "Northgate",
		depotId: "dep-2",
		distanceKm: 8,
		weight: 3,
	},
	{
		name: "Dunmere Garden Supply",
		contactName: "Kofi Mensah",
		town: "Dunmere",
		depotId: "dep-3",
		distanceKm: 31,
		weight: 3,
	},
	{
		name: "Eastmere Dental Lab",
		contactName: "Leona Fischer",
		town: "Eastmere",
		depotId: "dep-3",
		distanceKm: 5,
		weight: 2,
	},
	{
		name: "Fennick Auto Parts",
		contactName: "Mateo Ruiz",
		town: "Calder Point",
		depotId: "dep-1",
		distanceKm: 38,
		weight: 5,
	},
	{
		name: "Greywick Books",
		contactName: "Noor Aziz",
		town: "Greywick",
		depotId: "dep-2",
		distanceKm: 27,
		weight: 2,
	},
	{
		name: "Harrow Paint & Tile",
		contactName: "Oskar Lind",
		town: "Westhaven",
		depotId: "dep-1",
		distanceKm: 44,
		weight: 4,
	},
	{
		name: "Ironbridge Tools",
		contactName: "Paloma Vega",
		town: "Thornley",
		depotId: "dep-2",
		distanceKm: 35,
		weight: 4,
	},
	{
		name: "Juniper Kitchenware",
		contactName: "Quentin Hale",
		town: "Ashby Cross",
		depotId: "dep-3",
		distanceKm: 19,
		weight: 3,
	},
	{
		name: "Kittiwake Cycles",
		contactName: "Rosa Ferrant",
		town: "Marrow Creek",
		depotId: "dep-1",
		distanceKm: 52,
		weight: 2,
	},
	{
		name: "Larkspur Florists",
		contactName: "Stefan Marek",
		town: "Larch Hill",
		depotId: "dep-2",
		distanceKm: 14,
		weight: 3,
		isChilled: true,
	},
	{
		name: "Marlow Office Supply",
		contactName: "Tessa Whitlock",
		town: "Harlow Bay",
		depotId: "dep-1",
		distanceKm: 9,
		weight: 5,
	},
	{
		name: "Nettlefield Brewing Supply",
		contactName: "Uma Krishnan",
		town: "Fallowfield",
		depotId: "dep-3",
		distanceKm: 42,
		weight: 3,
	},
	{
		name: "Oakhollow Pet Foods",
		contactName: "Vincent Auclair",
		town: "Redwater",
		depotId: "dep-1",
		distanceKm: 61,
		weight: 4,
	},
	{
		name: "Pemberton Optics",
		contactName: "Wanjiru Kimani",
		town: "Kingsmead",
		depotId: "dep-2",
		distanceKm: 22,
		weight: 1,
	},
	{
		name: "Quillon Electronics",
		contactName: "Xavier Dumont",
		town: "Northgate",
		depotId: "dep-2",
		distanceKm: 11,
		weight: 4,
	},
	{
		name: "Redfern Bakery Supply",
		contactName: "Yara Saleh",
		town: "Wrenfield",
		depotId: "dep-3",
		distanceKm: 26,
		weight: 4,
	},
	{
		name: "Saltmarsh Seafood",
		contactName: "Zofia Lewandowska",
		town: "Saltby",
		depotId: "dep-1",
		distanceKm: 21,
		weight: 4,
		isChilled: true,
	},
	{
		name: "Thistledown Textiles",
		contactName: "Adrian Coyle",
		town: "Pinefield",
		depotId: "dep-2",
		distanceKm: 48,
		weight: 2,
	},
	{
		name: "Umberfield Lighting",
		contactName: "Beatrix Holm",
		town: "Hollin Bridge",
		depotId: "dep-3",
		distanceKm: 37,
		weight: 2,
	},
	{
		name: "Vale & Wren Cosmetics",
		contactName: "Cedric Fontaine",
		town: "Westhaven",
		depotId: "dep-1",
		distanceKm: 46,
		weight: 3,
	},
	{
		name: "Westbrook Medical Supply",
		contactName: "Dalia Mansour",
		town: "Calder Point",
		depotId: "dep-1",
		distanceKm: 40,
		weight: 4,
		isChilled: true,
	},
	{
		name: "Yarrow Home Goods",
		contactName: "Emeka Obi",
		town: "Eastmere",
		depotId: "dep-3",
		distanceKm: 7,
		weight: 4,
	},
	{
		name: "Ashby Cross Timber",
		contactName: "Freya Lindholm",
		town: "Ashby Cross",
		depotId: "dep-3",
		distanceKm: 18,
		weight: 3,
	},
	{
		name: "Bellwether Wines",
		contactName: "Gareth Pryce",
		town: "Marrow Creek",
		depotId: "dep-1",
		distanceKm: 55,
		weight: 2,
	},
	{
		name: "Coldharbour Dairy",
		contactName: "Hana Sato",
		town: "Thornley",
		depotId: "dep-2",
		distanceKm: 33,
		weight: 4,
		isChilled: true,
	},
	{
		name: "Driftwood Furniture",
		contactName: "Imran Sheikh",
		town: "Redwater",
		depotId: "dep-1",
		distanceKm: 63,
		weight: 3,
	},
	{
		name: "Elmfield Sports",
		contactName: "Jelena Kovac",
		town: "Larch Hill",
		depotId: "dep-2",
		distanceKm: 16,
		weight: 2,
	},
	{
		name: "Foxglove Apothecary",
		contactName: "Kieran Doyle",
		town: "Greywick",
		depotId: "dep-2",
		distanceKm: 29,
		weight: 2,
		isChilled: true,
	},
	{
		name: "Gantry Steel Stock",
		contactName: "Linnea Berg",
		town: "Harlow Bay",
		depotId: "dep-1",
		distanceKm: 12,
		weight: 3,
	},
	{
		name: "Hartwell Veterinary Supply",
		contactName: "Marco Bianchi",
		town: "Dunmere",
		depotId: "dep-3",
		distanceKm: 30,
		weight: 2,
	},
	{
		name: "Inkwell Stationers",
		contactName: "Nia Roberts",
		town: "Kingsmead",
		depotId: "dep-2",
		distanceKm: 24,
		weight: 2,
	},
	{
		name: "Jadestone Ceramics",
		contactName: "Omar Farouk",
		town: "Fallowfield",
		depotId: "dep-3",
		distanceKm: 41,
		weight: 1,
	},
	{
		name: "Kingsmead Appliances",
		contactName: "Petra Vasquez",
		town: "Kingsmead",
		depotId: "dep-2",
		distanceKm: 23,
		weight: 3,
	},
	{
		name: "Lanternlight Camping",
		contactName: "Ruben Castell",
		town: "Pinefield",
		depotId: "dep-2",
		distanceKm: 50,
		weight: 2,
	},
];

// The customer of the one shipment that waits for a large truck. It is the first row of the home.
const HEAVY_LOAD_CUSTOMER = "Gantry Steel Stock";

const STREETS = [
	"Quarry Lane",
	"Mill Road",
	"Foundry Street",
	"Canal Wharf",
	"Station Yard",
	"Market Row",
	"Tannery Close",
	"Orchard Way",
	"Kiln Road",
	"Harbour Street",
	"Weavers Lane",
	"Granary Square",
] as const;

const DELIVERY_NOTES = [
	"Deliveries at the rear dock. Ring the bell at gate 2.",
	"Tail lift needed. No forklift on site.",
	"Goods-in closes at 16:00.",
	"Call the contact 30 minutes before arrival.",
	"Sign in at reception before unloading.",
	"Forklift on site. Use bay 3.",
] as const;

const CHILLED_DELIVERY_NOTE =
	"Pallets go to the cold room. Hand over at the side door.";

/** One driver before its id and phone. `lateFactor` scales the chance of a late delivery: under 1 is a punctual driver. */
type DriverSeed = {
	name: string;
	licenceClass: LicenceClass;
	depotId: string;
	/** Years at the company. */
	years: number;
	lateFactor: number;
	isOffDuty?: boolean;
};

const DRIVER_SEEDS: DriverSeed[] = [
	{
		name: "Tomasz Wieczorek",
		licenceClass: "C",
		depotId: "dep-1",
		years: 9.4,
		lateFactor: 1,
	},
	{
		name: "Aisha Bello",
		licenceClass: "C1",
		depotId: "dep-1",
		years: 4.1,
		lateFactor: 0.7,
	},
	{
		name: "Callum Fraser",
		licenceClass: "B",
		depotId: "dep-1",
		years: 1.3,
		lateFactor: 1.25,
	},
	{
		name: "Mei-Lin Zhou",
		licenceClass: "B",
		depotId: "dep-1",
		years: 2.8,
		lateFactor: 0.9,
	},
	{
		name: "Rafael Ortega",
		licenceClass: "C1",
		depotId: "dep-1",
		years: 6.2,
		lateFactor: 1.5,
	},
	{
		name: "Ingrid Solberg",
		licenceClass: "C1",
		depotId: "dep-1",
		years: 7.7,
		lateFactor: 0.8,
		isOffDuty: true,
	},
	{
		name: "Deshawn Carter",
		licenceClass: "C",
		depotId: "dep-1",
		years: 3.5,
		lateFactor: 1.1,
	},
	{
		name: "Nadia Rahimi",
		licenceClass: "C",
		depotId: "dep-2",
		years: 11.2,
		lateFactor: 0.6,
	},
	{
		name: "Lukas Brandt",
		licenceClass: "C1",
		depotId: "dep-2",
		years: 5.0,
		lateFactor: 1,
	},
	{
		name: "Priya Nair",
		licenceClass: "C1",
		depotId: "dep-2",
		years: 2.2,
		lateFactor: 1.3,
	},
	{
		name: "Owen Gallagher",
		licenceClass: "B",
		depotId: "dep-2",
		years: 0.7,
		lateFactor: 0.95,
	},
	{
		name: "Samira Haddad",
		licenceClass: "C1",
		depotId: "dep-3",
		years: 8.3,
		lateFactor: 0.75,
	},
	{
		name: "Viktor Novak",
		licenceClass: "B",
		depotId: "dep-3",
		years: 4.6,
		lateFactor: 1.15,
		isOffDuty: true,
	},
	{
		name: "Grace Okafor",
		licenceClass: "C1",
		depotId: "dep-3",
		years: 1.9,
		lateFactor: 1,
		isOffDuty: true,
	},
];

/** The payload in kilograms and the pallet spaces of each vehicle kind. */
const KIND_CAPACITY = {
	van: { capacityKg: 1200, palletSpaces: 4 },
	box_truck: { capacityKg: 3500, palletSpaces: 10 },
	rigid: { capacityKg: 9000, palletSpaces: 16 },
	chilled: { capacityKg: 3000, palletSpaces: 8 },
} satisfies Record<VehicleKind, { capacityKg: number; palletSpaces: number }>;

/** One vehicle before its id and its dates. */
type VehicleSeed = {
	unit: string;
	kind: VehicleKind;
	plate: string;
	depotId: string;
	odometerKm: number;
	fuelPercent: number;
	/** Days from today to the next service. Negative for an overdue service. */
	serviceInDays: number;
	/** Days since the last inspection. */
	inspectedDaysAgo: number;
	/** The driver that normally drives it: an index of DRIVER_SEEDS. */
	regularDriver: number;
	/** The vehicle is in the workshop from this count of days before today. */
	workshopSinceDaysAgo?: number;
	workshopNote?: string;
};

const VEHICLE_SEEDS: VehicleSeed[] = [
	{
		unit: "V-01",
		kind: "van",
		plate: "HBR 4127",
		depotId: "dep-1",
		odometerKm: 84_310,
		fuelPercent: 92,
		serviceInDays: 41,
		inspectedDaysAgo: 96,
		regularDriver: 2,
	},
	{
		unit: "V-02",
		kind: "van",
		plate: "HBR 5083",
		depotId: "dep-1",
		odometerKm: 131_870,
		fuelPercent: 88,
		serviceInDays: -3,
		inspectedDaysAgo: 211,
		regularDriver: 3,
	},
	{
		unit: "V-03",
		kind: "van",
		plate: "NGT 2264",
		depotId: "dep-2",
		odometerKm: 108_450,
		fuelPercent: 34,
		serviceInDays: 12,
		inspectedDaysAgo: 143,
		regularDriver: 10,
		workshopSinceDaysAgo: 1,
		workshopNote: "Gearbox fault. The part arrives tomorrow.",
	},
	{
		unit: "V-04",
		kind: "van",
		plate: "EMR 7719",
		depotId: "dep-3",
		odometerKm: 62_940,
		fuelPercent: 71,
		serviceInDays: 63,
		inspectedDaysAgo: 38,
		regularDriver: 12,
	},
	{
		unit: "B-05",
		kind: "box_truck",
		plate: "HBR 6351",
		depotId: "dep-1",
		odometerKm: 187_620,
		fuelPercent: 96,
		serviceInDays: 9,
		inspectedDaysAgo: 172,
		regularDriver: 4,
	},
	{
		unit: "B-06",
		kind: "box_truck",
		plate: "HBR 1490",
		depotId: "dep-1",
		odometerKm: 243_180,
		fuelPercent: 47,
		serviceInDays: 0,
		inspectedDaysAgo: 268,
		regularDriver: 5,
		workshopSinceDaysAgo: 2,
		workshopNote: "Planned brake service. Back on the road tomorrow.",
	},
	{
		unit: "B-07",
		kind: "box_truck",
		plate: "NGT 3806",
		depotId: "dep-2",
		odometerKm: 156_090,
		fuelPercent: 84,
		serviceInDays: 27,
		inspectedDaysAgo: 61,
		regularDriver: 9,
	},
	{
		unit: "B-08",
		kind: "box_truck",
		plate: "EMR 9242",
		depotId: "dep-3",
		odometerKm: 121_530,
		fuelPercent: 100,
		serviceInDays: 78,
		inspectedDaysAgo: 24,
		regularDriver: 11,
	},
	{
		unit: "R-09",
		kind: "rigid",
		plate: "HBR 8815",
		depotId: "dep-1",
		odometerKm: 412_760,
		fuelPercent: 58,
		serviceInDays: 13,
		inspectedDaysAgo: 119,
		regularDriver: 0,
	},
	{
		unit: "R-10",
		kind: "rigid",
		plate: "NGT 5527",
		depotId: "dep-2",
		odometerKm: 338_410,
		fuelPercent: 66,
		serviceInDays: 55,
		inspectedDaysAgo: 83,
		regularDriver: 7,
	},
	{
		unit: "C-11",
		kind: "chilled",
		plate: "HBR 2938",
		depotId: "dep-1",
		odometerKm: 204_370,
		fuelPercent: 49,
		serviceInDays: 34,
		inspectedDaysAgo: 18,
		regularDriver: 1,
	},
	{
		unit: "C-12",
		kind: "chilled",
		plate: "NGT 6674",
		depotId: "dep-2",
		odometerKm: 149_820,
		fuelPercent: 90,
		serviceInDays: 104,
		inspectedDaysAgo: 52,
		regularDriver: 8,
	},
];

/** The load of one vehicle at the start of today. `vehicle` is an index of VEHICLE_SEEDS. */
type TodayRun = {
	vehicle: number;
	/** In transit: the driver picked the load up yesterday evening. Scheduled: the load leaves today. */
	status: "in_transit" | "scheduled";
	shipmentCount: number;
	/** The first shipment of the run is one day late for this reason. */
	lateReason?: ExceptionReason;
};

const TODAY_RUNS: TodayRun[] = [
	{ vehicle: 8, status: "in_transit", shipmentCount: 4, lateReason: "traffic" },
	{
		vehicle: 10,
		status: "in_transit",
		shipmentCount: 3,
		lateReason: "recipient_absent",
	},
	{ vehicle: 9, status: "in_transit", shipmentCount: 4 },
	{ vehicle: 0, status: "scheduled", shipmentCount: 2 },
	{ vehicle: 1, status: "scheduled", shipmentCount: 3 },
	{ vehicle: 4, status: "scheduled", shipmentCount: 4 },
	{ vehicle: 11, status: "scheduled", shipmentCount: 3 },
	{
		vehicle: 6,
		status: "scheduled",
		shipmentCount: 3,
		lateReason: "loading_delay",
	},
	{ vehicle: 7, status: "scheduled", shipmentCount: 3 },
];

// Days from today to the due day of each shipment that has no driver yet. The heavy load comes on top of these.
const UNASSIGNED_DUE_IN_DAYS = [0, 0, 1, 1, 1, 2, 2];

// The count of days before today that have closed shipments: two periods of the longest chart period.
const HISTORY_DAYS = 180;

// Closed shipments per working day: at the start of the history, and now. The company grows.
const OPENING_RATE = 15;
const CURRENT_RATE = 20;

// The share of a normal working day that each weekday carries, Sunday first.
const WEEKDAY_FACTORS = [0.12, 1.08, 1, 1.02, 1.1, 1.18, 0.42];

// The chance that a delivery is late, before the driver factor. The desk improved its planning about a month ago.
const LATE_RATE_BEFORE = 0.105;
const LATE_RATE_NOW = 0.07;
const LATE_RATE_CHANGE_DAYS_AGO = 34;
// A storm closed the coast road on these days before today: about three deliveries in ten were late.
const STORM_FIRST_DAYS_AGO = 24;
const STORM_LAST_DAYS_AGO = 22;
const STORM_LATE_RATE = 0.3;
const FAILED_RATE = 0.032;

// The weight of each reason of a late delivery, in the order of EXCEPTION_REASONS.
const LATE_REASON_WEIGHTS = [34, 24, 16, 14, 12];
// A failed delivery has these reasons only: the driver was at the door and could not hand over.
const FAILED_REASONS = [
	"recipient_absent",
	"address_problem",
	"vehicle_breakdown",
] as const satisfies readonly ExceptionReason[];
const FAILED_REASON_WEIGHTS = [52, 33, 15];

// The first reference number of the history.
const FIRST_REFERENCE = 41_207;

// A fixed seed gives the same rows for the whole day, so the numbers do not jump between loads.
const SEED = 20_417;

// mulberry32: a small generator with a 32-bit state. It returns a number from 0 to 1, 1 not included.
function createRandom(seed: number): () => number {
	let state = seed;
	return () => {
		state = (state + 0x6d2b79f5) | 0;
		let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
		mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
		return ((mixed ^ (mixed >>> 14)) >>> 0) / 4_294_967_296;
	};
}

// The item at `index`, with a wrap at the end of the list. The list is never empty.
function cycle<Item>(items: readonly Item[], index: number): Item {
	const item = items[index % items.length];
	if (item === undefined) {
		throw new Error("cycle needs a list with one item or more.");
	}
	return item;
}

// True when a driver with this licence may drive this kind of vehicle.
function canDrive(licenceClass: LicenceClass, kind: VehicleKind): boolean {
	if (kind === "van") {
		return true;
	}
	return kind === "rigid" ? licenceClass === "C" : licenceClass !== "B";
}

/** A shipment before it gets its number. The numbers follow the booking time. */
type ShipmentDraft = Omit<ShipmentRow, "id" | "reference"> & {
	/** bookedAt in milliseconds, for the sort. */
	bookedMs: number;
};

// Builds every table for the day that starts at `dayStart`. The newest event is before that midnight.
function buildSampleTables(dayStart: number): SampleTables {
	const random = createRandom(SEED);
	const between = (low: number, high: number) => low + random() * (high - low);
	const pickWeighted = (weights: readonly number[]): number => {
		const total = weights.reduce((sum, weight) => sum + weight, 0);
		let roll = random() * total;
		for (const [index, weight] of weights.entries()) {
			roll -= weight;
			if (roll < 0) {
				return index;
			}
		}
		return weights.length - 1;
	};
	const iso = (ms: number) => new Date(ms).toISOString();
	// The midnight that starts the day `daysAgo` days before today. A negative count is a day after today.
	const midnightOf = (daysAgo: number): number => {
		const day = new Date(dayStart);
		// setDate keeps the calendar day across a clock change.
		day.setDate(day.getDate() - daysAgo);
		return day.getTime();
	};
	// The last minute of that day: the promised delivery day ends then.
	const endOfDay = (daysAgo: number) => midnightOf(daysAgo - 1) - MINUTE_MS;

	const customers: CustomerRow[] = CUSTOMER_SEEDS.map((seed, index) => ({
		id: `cus-${String(index + 1).padStart(2, "0")}`,
		name: seed.name,
		contactName: seed.contactName,
		// 555-01xx is a range that no real phone uses.
		phone: `555-01${String(index + 20).padStart(2, "0")}`,
		street: `${12 + ((index * 37) % 180)} ${cycle(STREETS, index * 5)}`,
		town: seed.town,
		depotId: seed.depotId,
		distanceKm: seed.distanceKm,
		isChilled: seed.isChilled === true,
		deliveryNote: seed.isChilled
			? CHILLED_DELIVERY_NOTE
			: cycle(DELIVERY_NOTES, index * 7),
	}));
	const drivers: DriverRow[] = DRIVER_SEEDS.map((seed, index) => ({
		id: `drv-${String(index + 1).padStart(2, "0")}`,
		name: seed.name,
		phone: `555-01${String(index + 1).padStart(2, "0")}`,
		licenceClass: seed.licenceClass,
		depotId: seed.depotId,
		hiredAt: iso(midnightOf(Math.round(seed.years * 365))),
		isOffDuty: seed.isOffDuty === true,
	}));
	const vehicles: VehicleRow[] = VEHICLE_SEEDS.map((seed, index) => ({
		id: `veh-${String(index + 1).padStart(2, "0")}`,
		unit: seed.unit,
		kind: seed.kind,
		plate: seed.plate,
		depotId: seed.depotId,
		...KIND_CAPACITY[seed.kind],
		odometerKm: seed.odometerKm,
		fuelPercent: seed.fuelPercent,
		serviceDueAt: iso(midnightOf(-seed.serviceInDays)),
		lastInspectionAt: iso(midnightOf(seed.inspectedDaysAgo)),
		workshopNote: seed.workshopNote ?? null,
	}));

	const drafts: ShipmentDraft[] = [];

	// The weight of a load of `pallets` pallets on a vehicle of this kind.
	const loadOf = (kind: VehicleKind, pallets: number) => {
		const { capacityKg, palletSpaces } = KIND_CAPACITY[kind];
		// A full pallet weighs the payload divided by the spaces. The weight is in steps of 5 kg.
		const weightKg =
			Math.round(
				(pallets * (capacityKg / palletSpaces) * between(0.45, 0.95)) / 5,
			) * 5;
		return { pallets, weightKg };
	};

	// The closed shipments: one loop per day, the oldest day first.
	const customerWeights = CUSTOMER_SEEDS.map((seed) => seed.weight);
	for (let daysAgo = HISTORY_DAYS; daysAgo >= 1; daysAgo -= 1) {
		const midnight = midnightOf(daysAgo);
		const progress = 1 - daysAgo / HISTORY_DAYS;
		const rate =
			(OPENING_RATE + (CURRENT_RATE - OPENING_RATE) * progress) *
			(WEEKDAY_FACTORS[new Date(midnight).getDay()] ?? 1) *
			between(0.82, 1.18);
		const isStorm =
			daysAgo <= STORM_FIRST_DAYS_AGO && daysAgo >= STORM_LAST_DAYS_AGO;
		const baseLateRate = isStorm
			? STORM_LATE_RATE
			: daysAgo > LATE_RATE_CHANGE_DAYS_AGO
				? LATE_RATE_BEFORE
				: LATE_RATE_NOW;

		for (let count = Math.round(rate); count > 0; count -= 1) {
			const customerIndex = pickWeighted(customerWeights);
			const customer = customers[customerIndex];
			if (!customer) {
				continue;
			}
			// A vehicle of the depot of the customer, fit for the goods and not in the workshop on that day.
			const fleet = VEHICLE_SEEDS.flatMap((seed, index) =>
				seed.depotId === customer.depotId &&
				(seed.kind === "chilled") === customer.isChilled &&
				(seed.workshopSinceDaysAgo ?? 0) < daysAgo
					? [index]
					: [],
			);
			const vehicleIndex = fleet[Math.floor(random() * fleet.length)];
			const vehicleSeed =
				vehicleIndex === undefined ? undefined : VEHICLE_SEEDS[vehicleIndex];
			const vehicle =
				vehicleIndex === undefined ? undefined : vehicles[vehicleIndex];
			if (!vehicleSeed || !vehicle) {
				continue;
			}
			// The regular driver does about four runs in five. A colleague of the depot with the right licence does the others.
			const reliefDrivers = DRIVER_SEEDS.flatMap((seed, index) =>
				index !== vehicleSeed.regularDriver &&
				seed.depotId === vehicleSeed.depotId &&
				canDrive(seed.licenceClass, vehicleSeed.kind)
					? [index]
					: [],
			);
			const reliefIndex =
				reliefDrivers[Math.floor(random() * reliefDrivers.length)];
			const driverIndex =
				random() < 0.18 && reliefIndex !== undefined
					? reliefIndex
					: vehicleSeed.regularDriver;
			const driver = drivers[driverIndex];
			if (!driver) {
				continue;
			}

			const outcomeRoll = random();
			const lateRate =
				baseLateRate * (DRIVER_SEEDS[driverIndex]?.lateFactor ?? 1);
			const isFailed = outcomeRoll < FAILED_RATE;
			const isLate = !isFailed && outcomeRoll < FAILED_RATE + lateRate;
			// A late delivery was due one day before, now and then two days before.
			const lateDays = isLate ? (random() < 0.8 ? 1 : 2) : 0;
			// One on-time delivery in four arrives a day before its due day.
			const earlyDays = !isLate && !isFailed && random() < 0.25 ? 1 : 0;
			const dueDaysAgo = daysAgo + lateDays - earlyDays;
			const closedMs = midnight + between(8.5, 18.5) * HOUR_MS;
			let exceptionReason: ExceptionReason | null = null;
			if (isFailed) {
				exceptionReason = cycle(
					FAILED_REASONS,
					pickWeighted(FAILED_REASON_WEIGHTS),
				);
			} else if (isLate) {
				// The storm closed a road, so its late deliveries are traffic delays.
				exceptionReason = isStorm
					? "traffic"
					: cycle(EXCEPTION_REASONS, pickWeighted(LATE_REASON_WEIGHTS));
			}
			// A depot delay keeps the load in the depot until the delivery day. Every other delay happens on the road.
			const pickupDaysAgo =
				isLate && exceptionReason !== "loading_delay" ? dueDaysAgo : daysAgo;
			const pickedUpMs = Math.min(
				midnightOf(pickupDaysAgo) + between(5.5, 9.5) * HOUR_MS,
				closedMs - HOUR_MS,
			);
			// The planner assigns the run in the afternoon before the pickup.
			const assignedMs =
				midnightOf(pickupDaysAgo + 1) + between(14, 18.5) * HOUR_MS;
			const bookedMs = Math.min(
				midnightOf(pickupDaysAgo + 1 + Math.floor(between(0, 3.4))) +
					between(8, 17) * HOUR_MS,
				assignedMs - 2 * HOUR_MS,
			);
			const exceptionMs = isLate
				? midnightOf(dueDaysAgo) + between(11, 17) * HOUR_MS
				: null;

			drafts.push({
				bookedMs,
				customerId: customer.id,
				depotId: vehicle.depotId,
				service: customer.isChilled
					? "chilled"
					: random() < 0.18
						? "express"
						: "standard",
				// One shipment takes 1 to 6 pallets, and never more than the floor of the vehicle.
				...loadOf(
					vehicle.kind,
					1 + Math.floor(random() * Math.min(6, vehicle.palletSpaces)),
				),
				status: isFailed ? "failed" : "delivered",
				bookedAt: iso(bookedMs),
				dueAt: iso(endOfDay(dueDaysAgo)),
				assignedAt: iso(assignedMs),
				pickedUpAt: iso(pickedUpMs),
				closedAt: iso(closedMs),
				exceptionReason,
				exceptionAt: exceptionMs === null ? null : iso(exceptionMs),
				driverId: driver.id,
				vehicleId: vehicle.id,
			});
		}
	}

	// The open shipments with a driver: the runs of today.
	for (const run of TODAY_RUNS) {
		const vehicleSeed = VEHICLE_SEEDS[run.vehicle];
		const vehicle = vehicles[run.vehicle];
		const driver = vehicleSeed ? drivers[vehicleSeed.regularDriver] : undefined;
		if (!vehicleSeed || !vehicle || !driver) {
			continue;
		}
		// Each stop of a run is another customer of the depot.
		const stops = customers.filter(
			(customer) =>
				customer.depotId === vehicle.depotId &&
				customer.isChilled === (vehicle.kind === "chilled") &&
				customer.name !== HEAVY_LOAD_CUSTOMER,
		);
		const firstStop = Math.floor(random() * stops.length);
		const palletsPerStop = Math.floor(vehicle.palletSpaces / run.shipmentCount);
		for (let stop = 0; stop < run.shipmentCount; stop += 1) {
			const customer = cycle(stops, firstStop + stop * 2);
			const isLate = stop === 0 && run.lateReason !== undefined;
			// The last stop of a long run is due tomorrow. The others are due today.
			const dueDaysAgo = isLate
				? 1
				: stop === run.shipmentCount - 1 && run.shipmentCount > 2
					? -1
					: 0;
			const isInTransit = run.status === "in_transit";
			// A load in transit left yesterday evening. A late one left in the morning of its due day.
			const pickedUpMs = isInTransit
				? midnightOf(1) +
					(isLate ? between(6, 8.5) : between(17, 21.5)) * HOUR_MS
				: null;
			const assignedMs =
				pickedUpMs === null
					? midnightOf(isLate ? 2 : 1) + between(14, 18.5) * HOUR_MS
					: isLate
						? midnightOf(2) + between(15, 18) * HOUR_MS
						: pickedUpMs - between(3, 7) * HOUR_MS;
			const bookedMs = assignedMs - between(4, 40) * HOUR_MS;
			drafts.push({
				bookedMs,
				customerId: customer.id,
				depotId: vehicle.depotId,
				service: customer.isChilled
					? "chilled"
					: dueDaysAgo === 0 && random() < 0.3
						? "express"
						: "standard",
				// Most stops fill their share of the floor. Some leave one space free.
				...loadOf(
					vehicle.kind,
					Math.max(1, palletsPerStop - (random() < 0.35 ? 1 : 0)),
				),
				status: run.status,
				bookedAt: iso(bookedMs),
				dueAt: iso(endOfDay(dueDaysAgo)),
				assignedAt: iso(assignedMs),
				pickedUpAt: pickedUpMs === null ? null : iso(pickedUpMs),
				closedAt: null,
				exceptionReason: isLate ? (run.lateReason ?? null) : null,
				exceptionAt: isLate
					? iso(midnightOf(1) + between(13, 17) * HOUR_MS)
					: null,
				driverId: driver.id,
				vehicleId: vehicle.id,
			});
		}
	}

	// The open shipments with no driver yet. The planner assigns them today.
	const heavyCustomer = customers.find(
		(customer) => customer.name === HEAVY_LOAD_CUSTOMER,
	);
	if (heavyCustomer) {
		// Steel on 12 pallets needs the large truck, and that truck is on the road. So the load waits, two days late.
		const bookedMs = midnightOf(4) + 10.4 * HOUR_MS;
		drafts.push({
			bookedMs,
			customerId: heavyCustomer.id,
			depotId: heavyCustomer.depotId,
			service: "standard",
			pallets: 12,
			weightKg: 6480,
			status: "unassigned",
			bookedAt: iso(bookedMs),
			dueAt: iso(endOfDay(2)),
			assignedAt: null,
			pickedUpAt: null,
			closedAt: null,
			exceptionReason: null,
			exceptionAt: null,
			driverId: null,
			vehicleId: null,
		});
	}
	const walkIns = customers.filter(
		(customer) => !customer.isChilled && customer.name !== HEAVY_LOAD_CUSTOMER,
	);
	for (const [index, dueInDays] of UNASSIGNED_DUE_IN_DAYS.entries()) {
		const customer = cycle(walkIns, 3 + index * 4);
		// A shipment due today was booked yesterday as express. The others were booked in the last two days.
		const bookedMs =
			midnightOf(dueInDays === 0 ? 1 : 1 + (index % 2)) +
			between(9, 17.5) * HOUR_MS;
		drafts.push({
			bookedMs,
			customerId: customer.id,
			depotId: customer.depotId,
			service: dueInDays === 0 ? "express" : "standard",
			...loadOf("box_truck", 1 + Math.floor(random() * 5)),
			status: "unassigned",
			bookedAt: iso(bookedMs),
			dueAt: iso(endOfDay(-dueInDays)),
			assignedAt: null,
			pickedUpAt: null,
			closedAt: null,
			exceptionReason: null,
			exceptionAt: null,
			driverId: null,
			vehicleId: null,
		});
	}

	// The reference numbers follow the booking time, as in a real order book.
	const shipments: ShipmentRow[] = drafts
		.sort((first, second) => first.bookedMs - second.bookedMs)
		.map(({ bookedMs: _bookedMs, ...draft }, index) => {
			const number = String(FIRST_REFERENCE + index);
			return { ...draft, id: number, reference: `RW-${number}` };
		});

	return { dayStart, depots: DEPOTS, customers, drivers, vehicles, shipments };
}

// Built on the first read of a day, then kept. A tab that stays open past midnight gets the rows of the new day.
let cachedTables: SampleTables | null = null;

/** The sample tables. Every query file calls it, so all pages see the same rows. */
export function getSampleTables(): SampleTables {
	const dayStart = startOfLocalDay(Date.now());
	if (cachedTables?.dayStart !== dayStart) {
		cachedTables = buildSampleTables(dayStart);
	}
	return cachedTables;
}
