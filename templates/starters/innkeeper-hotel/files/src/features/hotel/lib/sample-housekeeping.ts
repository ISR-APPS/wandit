// The sample housekeeping tasks of today and the attendants. It stands in for the tables
// `housekeeping_tasks` and `attendants`. The tasks follow the departures, the stays, and the arrivals of STAY_PLANS.
// The housekeeping page and the room board read `listHousekeepingTasks`.
import { MINUTE_MS, minuteOfDay, startOfLocalDay } from "./hotel-day";
import { STAY_PLANS, type StayPlan } from "./sample-reservations";
import { ROOM_SEEDS, type RoomSeed } from "./sample-rooms";
import { createSeededRandom, randomInt } from "./seeded-random";

/** Every kind of task. Its label is the message key `housekeeping.kinds.<kind>`. */
const TASK_KINDS = [
	"departure",
	"stayover",
	"arrival_check",
	"inspection",
	"turndown",
	"maintenance",
] as const;

/** One kind of task. `departure` is the full clean after a check-out. `turndown` is the evening service of a suite. */
export type TaskKind = (typeof TASK_KINDS)[number];

/** Every status, in the order of the work. Its label is the message key `housekeeping.statuses.<status>`. */
const TASK_STATUSES = ["todo", "in_progress", "done", "blocked"] as const;

/** One status. `blocked` waits for a repair: the room is out of order. */
export type TaskStatus = (typeof TASK_STATUSES)[number];

/** One person of the housekeeping team. */
export type Attendant = {
	id: string;
	fullName: string;
	/** The floor that the attendant cleans, or null for the evening service of all floors. */
	floor: 1 | 2 | 3 | null;
};

/** The team of today: one attendant per floor, and one for the evening. The names are invented. */
export const ATTENDANTS: readonly Attendant[] = [
	{ id: "ines", fullName: "Inès Morel", floor: 1 },
	{ id: "paolo", fullName: "Paolo Ricci", floor: 2 },
	{ id: "mireille", fullName: "Mireille Aubin", floor: 3 },
	{ id: "theo", fullName: "Théo Garnier", floor: null },
];

/** One task of today as the pages read it. */
export type HousekeepingTask = {
	id: string;
	roomId: string;
	kind: TaskKind;
	status: TaskStatus;
	attendantId: Attendant["id"];
	/** ISO time when the task starts, or null for a blocked task. */
	scheduledAt: string | null;
	/** Planned length, in minutes. */
	durationMinutes: number;
	/** ISO time when the task ended, or null before it. */
	doneAt: string | null;
	/** ISO time of the arrival that needs the room, or null. The page marks such a task as a rush. */
	dueAt: string | null;
	/** A line for the attendant, or null. */
	note: string | null;
};

/** One task as minutes after midnight. `listHousekeepingTasks` adds the dates and the status. */
type TaskPlan = {
	id: string;
	roomId: string;
	kind: TaskKind;
	attendantId: Attendant["id"];
	/** Minutes after midnight when the task starts. null for a blocked task. */
	startMinute: number | null;
	durationMinutes: number;
	/** Minutes after midnight of the arrival that needs the room, or null. */
	dueMinute: number | null;
	note: string | null;
};

// A fixed seed: the same plan of the day on every load.
const TASK_SEED = 7331;

/** The stay that leaves the room today, if one does. */
function departureOf(room: RoomSeed): StayPlan | undefined {
	return STAY_PLANS.find(
		(plan) =>
			plan.roomId === room.id &&
			plan.outcome === "stay" &&
			plan.checkInOffset + plan.nights === 0,
	);
}

/** The stay that sleeps in the room tonight, if one does. It can arrive today. */
function tonightOf(room: RoomSeed): StayPlan | undefined {
	return STAY_PLANS.find(
		(plan) =>
			plan.roomId === room.id &&
			plan.outcome === "stay" &&
			plan.checkInOffset <= 0 &&
			plan.checkInOffset + plan.nights > 0,
	);
}

function buildTaskPlans(): TaskPlan[] {
	const random = createSeededRandom(TASK_SEED);
	const plans: TaskPlan[] = [];
	// Each floor attendant cleans the rooms with a stay in turn. The counter gives the next free slot per floor.
	const stayoverSlots = new Map<number, number>();
	let turndownSlot = 0;
	for (const room of ROOM_SEEDS) {
		const attendantId =
			ATTENDANTS.find((attendant) => attendant.floor === room.floor)?.id ??
			"ines";
		const isSuite = room.type === "suite" || room.type === "junior_suite";
		if (
			room.outOfOrder &&
			room.outOfOrder.fromOffset <= 0 &&
			room.outOfOrder.untilOffset > 0
		) {
			plans.push({
				id: `task-${room.number}-maintenance`,
				roomId: room.id,
				kind: "maintenance",
				attendantId,
				startMinute: null,
				// A deep clean of 60 minutes follows the repair.
				durationMinutes: 60,
				dueMinute: null,
				note: room.outOfOrder.reason,
			});
			continue;
		}
		const departure = departureOf(room);
		const tonight = tonightOf(room);
		const arrivesToday = tonight?.checkInOffset === 0;
		if (departure) {
			// A room with an arrival today is cleaned first: 10 to 55 minutes after the check-out, and not before 09:30.
			// A room with no arrival waits for the afternoon: from 14:15 to 17:00.
			const startMinute = arrivesToday
				? Math.max(departure.departureMinute + 10, 570) +
					randomInt(random, 0, 45)
				: 855 + 15 * randomInt(random, 0, 11);
			plans.push({
				id: `task-${room.number}-departure`,
				roomId: room.id,
				kind: "departure",
				attendantId,
				startMinute,
				// A suite takes 60 minutes, a room 45.
				durationMinutes: isSuite ? 60 : 45,
				dueMinute: arrivesToday && tonight ? tonight.arrivalMinute : null,
				note: departure.departureMinute >= 720 ? "Late check-out." : null,
			});
		} else if (tonight && !arrivesToday) {
			const slot = stayoverSlots.get(room.floor) ?? 0;
			stayoverSlots.set(room.floor, slot + 1);
			plans.push({
				id: `task-${room.number}-stayover`,
				roomId: room.id,
				kind: "stayover",
				attendantId,
				// One room every 35 minutes from 09:15, with up to 10 minutes of delay.
				startMinute: 555 + slot * 35 + randomInt(random, 0, 10),
				durationMinutes: 25,
				dueMinute: null,
				// The bed linen changes after every third night of a stay.
				note: -tonight.checkInOffset % 3 === 0 ? "Change the bed linen." : null,
			});
		} else if (arrivesToday && tonight) {
			plans.push({
				id: `task-${room.number}-arrival`,
				roomId: room.id,
				kind: "arrival_check",
				attendantId,
				// A check before the arrival, from 11:45 to 13:45.
				startMinute: 705 + 15 * randomInt(random, 0, 8),
				durationMinutes: 15,
				dueMinute: tonight.arrivalMinute,
				note: tonight.request,
			});
		} else {
			plans.push({
				id: `task-${room.number}-inspection`,
				roomId: room.id,
				kind: "inspection",
				attendantId,
				// A short check of an empty room, from 13:00 to 15:00.
				startMinute: 780 + 15 * randomInt(random, 0, 8),
				durationMinutes: 10,
				dueMinute: null,
				note: null,
			});
		}
		// A suite with guests tonight gets the evening service: one suite every 25 minutes from 17:30.
		if (isSuite && tonight) {
			plans.push({
				id: `task-${room.number}-turndown`,
				roomId: room.id,
				kind: "turndown",
				attendantId: "theo",
				startMinute: 1050 + turndownSlot * 25,
				durationMinutes: 20,
				dueMinute: null,
				note: null,
			});
			turndownSlot += 1;
		}
	}
	return plans;
}

const TASK_PLANS: TaskPlan[] = buildTaskPlans();

/** Every task of today at `now` (milliseconds since 1970), in the order of the rooms. The status follows the clock. */
export function listHousekeepingTasks(now: number): HousekeepingTask[] {
	const todayStart = startOfLocalDay(now);
	const nowMinute = minuteOfDay(now);
	return TASK_PLANS.map((plan) => {
		const endMinute =
			plan.startMinute === null
				? null
				: plan.startMinute + plan.durationMinutes;
		const status: TaskStatus =
			plan.startMinute === null || endMinute === null
				? "blocked"
				: nowMinute < plan.startMinute
					? "todo"
					: nowMinute < endMinute
						? "in_progress"
						: "done";
		return {
			id: plan.id,
			roomId: plan.roomId,
			kind: plan.kind,
			status,
			attendantId: plan.attendantId,
			scheduledAt:
				plan.startMinute === null
					? null
					: new Date(todayStart + plan.startMinute * MINUTE_MS).toISOString(),
			durationMinutes: plan.durationMinutes,
			doneAt:
				status === "done" && endMinute !== null
					? new Date(todayStart + endMinute * MINUTE_MS).toISOString()
					: null,
			dueAt:
				plan.dueMinute === null
					? null
					: new Date(todayStart + plan.dueMinute * MINUTE_MS).toISOString(),
			note: plan.note,
		};
	});
}
