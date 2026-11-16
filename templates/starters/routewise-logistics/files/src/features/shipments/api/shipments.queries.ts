// Reads of shipments: the list of a period, one shipment with its timeline, and the open load of a driver or a vehicle.
// The route loaders prefetch the list and the detail. The home, the list page, the shipment page, and the side panels read them.
// Each queryFn reads the sample tables. A later turn replaces its body with a Supabase call that returns the same type.
import { queryOptions } from "@tanstack/react-query";
import {
	daysAgoOf,
	type ExceptionReason,
	getSampleTables,
	isOpenStatus,
	type LicenceClass,
	lateDaysOf,
	type PeriodDays,
	type SampleTables,
	type ServiceLevel,
	type ShipmentRow,
	type ShipmentStatus,
	type VehicleKind,
} from "~/features/logistics";

/** One shipment with the names that a list shows. The times are ISO texts. */
export type Shipment = {
	/** The URL id: the number of the reference. */
	id: string;
	/** The reference on the paperwork, for example "RW-44853". */
	reference: string;
	status: ShipmentStatus;
	service: ServiceLevel;
	pallets: number;
	weightKg: number;
	bookedAt: string;
	/** The end of the promised delivery day. */
	dueAt: string;
	/** When the shipment was delivered or failed. null while it is open. */
	closedAt: string | null;
	/** Calendar days after the due day: 0 is on time. An open shipment counts until today. */
	lateDays: number;
	/** Why the delivery is late or failed. null for a delivery with no problem. */
	exceptionReason: ExceptionReason | null;
	customerId: string;
	customerName: string;
	/** The town of the customer. */
	destination: string;
	/** The name of the depot that the shipment leaves from. */
	depotName: string;
	driverId: string | null;
	/** null while no driver has the shipment. */
	driverName: string | null;
	vehicleId: string | null;
	/** The fleet number of the vehicle, for example "B-05". null while no vehicle has the shipment. */
	vehicleUnit: string | null;
};

/** The steps that the timeline of a shipment can show. */
export type ShipmentEventKind =
	| "booked"
	| "assigned"
	| "picked_up"
	| "delay_reported"
	| "delivered"
	| "failed";

/** One step of a shipment that happened, with its time (ISO). */
export type ShipmentEvent = { kind: ShipmentEventKind; occurredAt: string };

/** One shipment with the records that only its own page shows. */
export type ShipmentDetail = Shipment & {
	assignedAt: string | null;
	pickedUpAt: string | null;
	/** The customer that receives the goods. */
	recipient: {
		contactName: string;
		phone: string;
		street: string;
		/** Road distance from the depot, in kilometers. */
		distanceKm: number;
		/** What the driver must know at the door. */
		deliveryNote: string;
	};
	driver: { phone: string; licenceClass: LicenceClass } | null;
	vehicle: { kind: VehicleKind; plate: string; capacityKg: number } | null;
	/** The steps that happened, newest first. */
	events: ShipmentEvent[];
	/** The 5 newest other shipments of the same customer. */
	related: Shipment[];
};

// Adds the customer, depot, driver, and vehicle names to shipment rows. A database join does this later.
function withNames(rows: ShipmentRow[], tables: SampleTables): Shipment[] {
	const customers = new Map(tables.customers.map((row) => [row.id, row]));
	const depots = new Map(tables.depots.map((row) => [row.id, row]));
	const drivers = new Map(tables.drivers.map((row) => [row.id, row]));
	const vehicles = new Map(tables.vehicles.map((row) => [row.id, row]));
	return rows.map((row) => {
		const customer = customers.get(row.customerId);
		return {
			id: row.id,
			reference: row.reference,
			status: row.status,
			service: row.service,
			pallets: row.pallets,
			weightKg: row.weightKg,
			bookedAt: row.bookedAt,
			dueAt: row.dueAt,
			closedAt: row.closedAt,
			lateDays: lateDaysOf(row, tables.dayStart),
			exceptionReason: row.exceptionReason,
			customerId: row.customerId,
			customerName: customer?.name ?? "",
			destination: customer?.town ?? "",
			depotName: depots.get(row.depotId)?.name ?? "",
			driverId: row.driverId,
			driverName: row.driverId
				? (drivers.get(row.driverId)?.name ?? null)
				: null,
			vehicleId: row.vehicleId,
			vehicleUnit: row.vehicleId
				? (vehicles.get(row.vehicleId)?.unit ?? null)
				: null,
		};
	});
}

// The newest booking first. The reference numbers follow the booking time.
function newestFirst(rows: ShipmentRow[]): ShipmentRow[] {
	return [...rows].sort((first, second) =>
		second.bookedAt.localeCompare(first.bookedAt),
	);
}

/**
 * Every open shipment, and the shipments that closed in the last `days` full days. The newest booking comes first.
 * The home counts and filters the open rows. The list page filters, sorts, and pages all rows in the browser.
 */
export function shipmentsQueryOptions(days: PeriodDays) {
	return queryOptions({
		queryKey: ["shipments", "list", days],
		queryFn: async () => {
			const tables = getSampleTables();
			// LIMIT: every row of the period in one read, about 600 rows for 30 days. Upgrade: server paging (tables-paging.md of the app-dashboard skill).
			// A closed row counts by its local close day. The sample rows close before today, so the list equals the figures of the home.
			const rows = tables.shipments.filter(
				(row) =>
					row.closedAt === null ||
					daysAgoOf(row.closedAt, tables.dayStart) <= days,
			);
			return withNames(newestFirst(rows), tables);
		},
	});
}

// The steps of a shipment that have a time, newest first.
function eventsOf(row: ShipmentRow): ShipmentEvent[] {
	const steps: { kind: ShipmentEventKind; occurredAt: string | null }[] = [
		{ kind: "booked", occurredAt: row.bookedAt },
		{ kind: "assigned", occurredAt: row.assignedAt },
		{ kind: "picked_up", occurredAt: row.pickedUpAt },
		{ kind: "delay_reported", occurredAt: row.exceptionAt },
		{
			kind: row.status === "failed" ? "failed" : "delivered",
			occurredAt: row.closedAt,
		},
	];
	return steps
		.flatMap((step) =>
			step.occurredAt ? [{ kind: step.kind, occurredAt: step.occurredAt }] : [],
		)
		.sort((first, second) => second.occurredAt.localeCompare(first.occurredAt));
}

/** One shipment with its recipient, driver, vehicle, timeline, and related shipments. null when the id does not exist. */
export function shipmentQueryOptions(id: string) {
	return queryOptions({
		queryKey: ["shipments", "detail", id],
		queryFn: async (): Promise<ShipmentDetail | null> => {
			const tables = getSampleTables();
			const row = tables.shipments.find((shipment) => shipment.id === id);
			const customer = tables.customers.find(
				(item) => item.id === row?.customerId,
			);
			// The id comes from the URL. An unknown id is "not found", not an error.
			if (!row || !customer) {
				return null;
			}
			const [shipment] = withNames([row], tables);
			if (!shipment) {
				return null;
			}
			const driver = tables.drivers.find((item) => item.id === row.driverId);
			const vehicle = tables.vehicles.find((item) => item.id === row.vehicleId);
			const related = newestFirst(
				tables.shipments.filter(
					(other) => other.customerId === row.customerId && other.id !== id,
				),
			).slice(0, 5);
			return {
				...shipment,
				assignedAt: row.assignedAt,
				pickedUpAt: row.pickedUpAt,
				recipient: {
					contactName: customer.contactName,
					phone: customer.phone,
					street: customer.street,
					distanceKm: customer.distanceKm,
					deliveryNote: customer.deliveryNote,
				},
				driver: driver
					? { phone: driver.phone, licenceClass: driver.licenceClass }
					: null,
				vehicle: vehicle
					? {
							kind: vehicle.kind,
							plate: vehicle.plate,
							capacityKg: vehicle.capacityKg,
						}
					: null,
				events: eventsOf(row),
				related: withNames(related, tables),
			};
		},
	});
}

/** The owner of an open load: one driver or one vehicle. */
export type LoadOwner =
	| { kind: "driver"; driverId: string }
	| { kind: "vehicle"; vehicleId: string };

/** The open shipments of one driver or of one vehicle, the soonest due day first. The side panels list them. */
export function openLoadQueryOptions(owner: LoadOwner) {
	return queryOptions({
		queryKey: ["shipments", "open-load", owner],
		queryFn: async () => {
			const tables = getSampleTables();
			const rows = tables.shipments.filter(
				(row) =>
					isOpenStatus(row.status) &&
					(owner.kind === "driver"
						? row.driverId === owner.driverId
						: row.vehicleId === owner.vehicleId),
			);
			return withNames(rows, tables).sort((first, second) =>
				first.dueAt.localeCompare(second.dueAt),
			);
		},
	});
}
