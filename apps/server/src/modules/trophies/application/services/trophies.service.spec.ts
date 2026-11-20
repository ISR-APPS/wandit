import { describe, expect, it } from "vitest";

import type {
	TrophyCountFacts,
	TrophyUnlockRow,
} from "../../infrastructure/persistence/trophies.repository";
import { TrophiesService, type TrophiesStore } from "./trophies.service";

const USER = "user-1";
const NOW = new Date("2026-11-20T12:00:00.000Z");
const EARLIER = new Date("2026-10-01T08:00:00.000Z");

const NO_FACTS: TrophyCountFacts = {
	activeDomains: 0,
	appProjects: 0,
	builds: 0,
	collaborators: 0,
	desktopBuilds: 0,
	earlyAdopter: 0,
	feedbackAdopted: 0,
	feedbackSent: 0,
	friendsActivated: 0,
	friendsJoined: 0,
	friendsPaid: 0,
	githubLinks: 0,
	images: 0,
	leads: 0,
	liveProjects: 0,
	maxProjectTurns: 0,
	mobileBuilds: 0,
	projects: 0,
	publishes: 0,
	restores: 0,
	starterTemplates: 0,
	targetPlatforms: 0,
	themeDesigns: 0,
	topups: 0,
	webSearches: 0,
};

/**
 * In-memory `user_trophies` of one user. `insertUnlocks` skips an id that is already stored, like ON CONFLICT DO NOTHING.
 * `parallelRows` are rows that another request stores just before this insert.
 */
function fakeStore(input: {
	facts: Partial<TrophyCountFacts>;
	stored: TrophyUnlockRow[];
	parallelRows?: TrophyUnlockRow[];
}): { store: TrophiesStore; rows: TrophyUnlockRow[] } {
	const rows = [...input.stored];
	const store: TrophiesStore = {
		insertUnlocks: async (_userId, trophyIds) => {
			rows.push(...(input.parallelRows ?? []));
			const inserted = trophyIds
				.filter((id) => !rows.some((row) => row.trophyId === id))
				.map((trophyId) => ({ seenAt: null, trophyId, unlockedAt: NOW }));
			rows.push(...inserted);
			return inserted;
		},
		listUnlocks: async () => [...rows],
		markSeen: async () => {},
		readBuildWeekStarts: async () => [],
		readFacts: async () => ({ ...NO_FACTS, ...input.facts }),
	};
	return { rows, store };
}

const noSpend = { netConsumedCentiCredits: async () => 0 };

describe("TrophiesService.list", () => {
	it("stores one unlock when a fact reaches a target for the first time", async () => {
		const { rows, store } = fakeStore({ facts: { projects: 1 }, stored: [] });

		const result = await new TrophiesService(store, noSpend).list(USER, NOW);

		expect(rows.map((row) => row.trophyId)).toEqual(["first_project"]);
		expect(result.points).toBe(10);
		expect(
			result.trophies.find((trophy) => trophy.id === "first_project"),
		).toEqual({
			current: 1,
			id: "first_project",
			isNew: true,
			unlockedAt: NOW.toISOString(),
		});
	});

	it("keeps a stored trophy and its points when its fact goes back to 0", async () => {
		const { rows, store } = fakeStore({
			facts: {},
			stored: [{ seenAt: NOW, trophyId: "first_project", unlockedAt: EARLIER }],
		});

		const result = await new TrophiesService(store, noSpend).list(USER, NOW);

		expect(rows).toHaveLength(1);
		expect(result.points).toBe(10);
		expect(
			result.trophies.find((trophy) => trophy.id === "first_project"),
		).toEqual({
			current: 0,
			id: "first_project",
			isNew: false,
			unlockedAt: EARLIER.toISOString(),
		});
	});

	it("hides the progress of a locked hidden trophy but not of a locked visible one", async () => {
		const { store } = fakeStore({
			facts: { projects: 3, targetPlatforms: 2 },
			stored: [],
		});

		const result = await new TrophiesService(store, noSpend).list(USER, NOW);
		const byId = new Map(result.trophies.map((trophy) => [trophy.id, trophy]));

		expect(byId.get("polyglot")?.current).toBeNull();
		expect(byId.get("projects_5")?.current).toBe(3);
	});

	it("drops a stored id that is not in the catalog from the trophies and the points", async () => {
		const { store } = fakeStore({
			facts: {},
			stored: [
				{ seenAt: null, trophyId: "retired_trophy", unlockedAt: EARLIER },
			],
		});

		const result = await new TrophiesService(store, noSpend).list(USER, NOW);

		expect(result.points).toBe(0);
		expect(result.trophies.some((trophy) => trophy.unlockedAt !== null)).toBe(
			false,
		);
	});

	it("shows the unlock time of a parallel read that stored the trophy first", async () => {
		const { store } = fakeStore({
			facts: { projects: 1 },
			parallelRows: [
				{ seenAt: null, trophyId: "first_project", unlockedAt: EARLIER },
			],
			stored: [],
		});

		const result = await new TrophiesService(store, noSpend).list(USER, NOW);

		expect(
			result.trophies.find((trophy) => trophy.id === "first_project")
				?.unlockedAt,
		).toBe(EARLIER.toISOString());
	});
});
