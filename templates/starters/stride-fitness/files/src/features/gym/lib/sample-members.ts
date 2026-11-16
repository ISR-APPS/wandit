// The 120 members of the gym. This module stands in for a `members` table.
// sample-activity.ts books them into classes. The members, plans, and home pages read them through ~/features/gym.
// Every date is "today minus N days", so the rows stay the same during one day. The names are fictional.
import { addDays } from "./gym-time";
import { CLASS_TYPE_IDS, type ClassTypeId } from "./sample-classes";
import { PLAN_IDS, type PlanId } from "./sample-plans";
import {
	createSeededRandom,
	pickWeightedIndexes,
	randomInt,
} from "./seeded-random";

/** Every member status, in the order of the list tabs. */
export const MEMBER_STATUSES = ["active", "frozen", "lapsed"] as const;

/** active pays and trains. frozen pauses billing and visits for a while. lapsed ended the membership. */
export type MemberStatus = (typeof MEMBER_STATUSES)[number];

/** One member of the gym. Times are local midnights, in milliseconds since 1970. */
export type Member = {
	/** Stable id, for example "m-007". It is the `$memberId` of the detail page. */
	id: string;
	fullName: string;
	/** A fictional address on example.com. */
	email: string;
	planId: PlanId;
	status: MemberStatus;
	/** The day of the first visit. The billing day of each month follows it. */
	joinedAt: number;
	/** frozen only: the first day of the pause. */
	frozenFrom: number | null;
	/** frozen only: the first day back. Billing starts again that day. */
	frozenUntil: number | null;
	/** lapsed only: the first day without a membership. */
	endedAt: number | null;
	/** The visits per week that the member usually makes, 1 to 5. The bookings follow it. */
	weeklyVisits: number;
	/** Two class types that the member books more often than the others. */
	favoriteClassIds: readonly [ClassTypeId, ClassTypeId];
	/** A note of the front desk, or null. Data, not a UI text. */
	note: string | null;
};

const FIRST_NAMES = [
	"Ava",
	"Mateo",
	"Priya",
	"Jonah",
	"Leila",
	"Tomasz",
	"Nadia",
	"Owen",
	"Sofia",
	"Kwame",
	"Hana",
	"Lucas",
	"Imani",
	"Felix",
	"Yara",
	"Diego",
	"Maren",
	"Arjun",
	"Chloe",
	"Emeka",
	"Ingrid",
	"Rami",
	"Tessa",
	"Kenji",
	"Lena",
	"Marco",
	"Aaliyah",
	"Bruno",
	"Freya",
	"Hamza",
	"Iris",
	"Jasper",
	"Keira",
	"Luca",
	"Mina",
	"Nico",
	"Olive",
	"Pablo",
	"Quinn",
	"Rosa",
	"Samir",
	"Talia",
	"Umar",
	"Vera",
	"Wes",
	"Ximena",
	"Yusuf",
	"Zoe",
	"Abel",
	"Bianca",
	"Callum",
	"Dalia",
	"Elias",
	"Farah",
	"Gideon",
	"Hollis",
	"Ines",
	"Jude",
	"Kaia",
	"Levi",
	"Malia",
	"Nolan",
	"Odette",
	"Paolo",
	"Rhea",
	"Silas",
	"Tamsin",
	"Uri",
	"Valeria",
	"Wren",
	"Yosef",
	"Zara",
	"Anika",
	"Benji",
	"Celine",
	"Dario",
	"Esme",
	"Fintan",
	"Gemma",
	"Hugo",
	"Ilse",
	"Joaquin",
	"Kofi",
	"Linnea",
	"Mads",
	"Noor",
	"Orla",
	"Pim",
	"Renata",
	"Soren",
	"Thea",
	"Ulla",
	"Viktor",
	"Willa",
	"Xander",
	"Yasmin",
	"Zev",
	"Amara",
	"Basil",
	"Coralie",
	"Dmitri",
	"Elodie",
	"Florian",
	"Greta",
	"Hiro",
	"Isla",
	"Jalen",
	"Kasia",
	"Leon",
	"Maeve",
	"Nils",
	"Ottilie",
	"Petra",
	"Reuben",
	"Saoirse",
	"Tobias",
	"Una",
	"Vikram",
	"Signe",
	"Ezra",
] as const;

const LAST_NAMES = [
	"Lindqvist",
	"Moreau",
	"Haddad",
	"Brennan",
	"Kowalski",
	"Achebe",
	"Sato",
	"Varga",
	"Delgado",
	"Fischer",
	"Nkemelu",
	"Rossi",
	"Halvorsen",
	"Mendez",
	"Park",
	"Ibrahim",
	"Novak",
	"Quinlan",
	"Abiodun",
	"Castellano",
	"Doyle",
	"Eriksen",
	"Ferreira",
	"Gallo",
	"Hartley",
	"Iqbal",
	"Jensen",
	"Kamara",
	"Laurent",
	"Mbeki",
	"Nakashima",
	"Oduya",
	"Petrov",
	"Ramos",
	"Solberg",
	"Tanaka",
	"Ueda",
	"Vasquez",
	"Whitfield",
	"Yilmaz",
	"Zielinski",
	"Adler",
	"Bakker",
	"Coelho",
	"Dubois",
	"Eze",
	"Fontaine",
	"Grieve",
	"Holm",
	"Ito",
	"Juarez",
	"Keane",
	"Lowe",
	"Marsh",
	"Nyberg",
	"Ortiz",
	"Pereira",
	"Reyes",
	"Sandoval",
	"Thorne",
] as const;

// Front desk notes. Each note goes to one member at most.
const NOTES = [
	"Training for a first half marathon in April.",
	"Prefers bike 4 in the Cycle Room, front row.",
	"Recovering from a shoulder strain. Coach Jonas has the plan.",
	"Brings a friend on Saturdays. Ask about a referral.",
	"Asked about personal training. Call back after the holidays.",
	"Second trimester. Low-impact options in every class.",
	"Wants to deadlift body weight by summer.",
	"Works night shifts, so trains around noon.",
	"Latex allergy. Use the cloth bands.",
	"Back after a long break. Keep the load light for a month.",
	"Prefers email to phone calls.",
	"Knee surgery last year. No box jumps.",
	"New to strength training. Booked an intro with Coach Jonas.",
	"Usually first in for the 06:30 slot.",
	"Training for an amateur boxing bout in the spring.",
	"Lost a key fob in October. New fob issued.",
	"Asked for a quieter spot in Vinyasa Flow.",
	"Moved across town. Asked about the off-peak plan.",
	"Likes a written program for open gym days.",
	"Lower back pain on rowers. Swap for the bike.",
	"Uses a wheelchair on long days. Main Floor ramp is fine.",
	"Teaches dance. Very strong in Mobility & Stretch.",
	"Asked for a freeze over the exam weeks.",
	"Signed up after the open day in September.",
] as const;

/** Count of members. 120 rows give the list six pages. */
const MEMBER_COUNT = 120;
// Fixed seed: the same members on every load.
const MEMBERS_SEED = 1207;
// Days before today when the newest members joined. Two weeks feed the "new members" figure and its comparison.
const RECENT_JOIN_DAYS = [0, 1, 3, 4, 6, 9, 11, 13] as const;
// The new member at this index of RECENT_JOIN_DAYS freezes at once for a trip.
// The first page of the list, newest first, then shows a second status.
const FROZEN_NEW_MEMBER_INDEX = 4;
const LAPSED_COUNT = 15;
// Frozen members of the shuffle. With the new member above, 10 members are frozen.
const FROZEN_COUNT = 9;
// Weights of PLAN_IDS, in the same order: Unlimited is the most common plan.
const PLAN_WEIGHTS = [34, 14, 22, 18, 12] as const;

// The visits per week of a new member on each plan. The Eight a Month plan allows about two.
function weeklyVisitsFor(planId: PlanId, random: () => number): number {
	if (planId === "eight") {
		return 2;
	}
	if (planId === "off-peak" || planId === "student") {
		return randomInt(random, 2, 3);
	}
	return randomInt(random, 3, 5);
}

// Builds the members from the local midnight of today. The same day gives the same rows.
function buildMembers(todayStart: number): Member[] {
	const random = createSeededRandom(MEMBERS_SEED);
	// A shuffle of the indexes decides who is new, lapsed, and frozen.
	const order = Array.from({ length: MEMBER_COUNT }, (_, index) => index);
	for (let index = order.length - 1; index > 0; index -= 1) {
		const swap = randomInt(random, 0, index);
		[order[index], order[swap]] = [order[swap] ?? 0, order[index] ?? 0];
	}
	const roleOf = new Map<number, "new" | "lapsed" | "frozen">();
	order.forEach((memberIndex, position) => {
		if (position < RECENT_JOIN_DAYS.length) {
			roleOf.set(memberIndex, "new");
		} else if (position < RECENT_JOIN_DAYS.length + LAPSED_COUNT) {
			roleOf.set(memberIndex, "lapsed");
		} else if (
			position <
			RECENT_JOIN_DAYS.length + LAPSED_COUNT + FROZEN_COUNT
		) {
			roleOf.set(memberIndex, "frozen");
		}
	});

	let newCount = 0;
	let noteIndex = 0;
	return Array.from({ length: MEMBER_COUNT }, (_, index) => {
		const firstName = FIRST_NAMES[index] ?? "Alex";
		// 37 and 60 share no factor, so the last names spread and every full name differs.
		const lastName = LAST_NAMES[(index * 37) % LAST_NAMES.length] ?? "Moreau";
		const planId =
			PLAN_IDS[pickWeightedIndexes(random, PLAN_WEIGHTS, 1)[0] ?? 0] ??
			"unlimited";
		const role = roleOf.get(index);
		const favorites = pickWeightedIndexes(
			random,
			CLASS_TYPE_IDS.map(() => 1),
			2,
		);
		const member: Member = {
			id: `m-${String(index + 1).padStart(3, "0")}`,
			fullName: `${firstName} ${lastName}`,
			email: `${firstName}.${lastName}@example.com`.toLowerCase(),
			planId,
			status: "active",
			joinedAt: todayStart,
			frozenFrom: null,
			frozenUntil: null,
			endedAt: null,
			weeklyVisits: weeklyVisitsFor(planId, random),
			favoriteClassIds: [
				CLASS_TYPE_IDS[favorites[0] ?? 0] ?? "hiit",
				CLASS_TYPE_IDS[favorites[1] ?? 1] ?? "spin",
			],
			// About one member in five has a note.
			note: random() < 0.2 ? (NOTES[noteIndex++] ?? null) : null,
		};
		if (role === "new") {
			const recentIndex = newCount++;
			member.joinedAt = addDays(
				todayStart,
				-(RECENT_JOIN_DAYS[recentIndex] ?? 0),
			);
			// Fixed dates and no random draw, so the rows of the other members stay the same.
			if (recentIndex === FROZEN_NEW_MEMBER_INDEX) {
				member.status = "frozen";
				member.frozenFrom = addDays(todayStart, -1);
				member.frozenUntil = addDays(todayStart, 13);
				member.note =
					"Away on a work trip for two weeks. Freeze agreed at sign-up.";
			}
		} else if (role === "lapsed") {
			const endedDaysAgo = randomInt(random, 6, 150);
			member.status = "lapsed";
			member.joinedAt = addDays(
				todayStart,
				-(endedDaysAgo + randomInt(random, 60, 700)),
			);
			member.endedAt = addDays(todayStart, -endedDaysAgo);
		} else if (role === "frozen") {
			member.status = "frozen";
			member.joinedAt = addDays(todayStart, -randomInt(random, 120, 800));
			member.frozenFrom = addDays(todayStart, -randomInt(random, 3, 40));
			member.frozenUntil = addDays(todayStart, randomInt(random, 7, 45));
		} else {
			// Older members are fewer: the gym grows. 40 % joined in the last six months.
			const band = random();
			const daysAgo =
				band < 0.4
					? randomInt(random, 15, 180)
					: band < 0.75
						? randomInt(random, 181, 540)
						: randomInt(random, 541, 1100);
			member.joinedAt = addDays(todayStart, -daysAgo);
		}
		return member;
	});
}

// The members of one day. A cache, because every query of every page reads the same 120 rows.
let cache: { todayStart: number; members: Member[] } | null = null;

/** The members, built from the local midnight `todayStart`. The rows are the same during the whole day. */
export function membersOfDay(todayStart: number): Member[] {
	if (cache?.todayStart !== todayStart) {
		cache = { todayStart, members: buildMembers(todayStart) };
	}
	return cache.members;
}

/** Whether the member can train on the local day `dayStart`: joined, not lapsed, and not frozen that day. */
export function isTrainingOn(member: Member, dayStart: number): boolean {
	if (member.joinedAt > dayStart) {
		return false;
	}
	if (member.endedAt !== null && dayStart >= member.endedAt) {
		return false;
	}
	if (
		member.frozenFrom !== null &&
		member.frozenUntil !== null &&
		dayStart >= member.frozenFrom &&
		dayStart < member.frozenUntil
	) {
		return false;
	}
	return true;
}
