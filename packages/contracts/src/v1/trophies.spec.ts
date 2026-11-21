import { describe, expect, it } from "vitest";
import {
	earnedTrophyIds,
	TROPHIES,
	TROPHY_LEVELS,
	type TrophyFacts,
	trophyLevelFor,
} from "./trophies";

const NO_FACTS: TrophyFacts = {
	projects: 0,
	appProjects: 0,
	targetPlatforms: 0,
	starterTemplates: 0,
	builds: 0,
	maxProjectTurns: 0,
	publishes: 0,
	liveProjects: 0,
	activeDomains: 0,
	mobileBuilds: 0,
	desktopBuilds: 0,
	themeDesigns: 0,
	images: 0,
	webSearches: 0,
	restores: 0,
	githubLinks: 0,
	leads: 0,
	friendsJoined: 0,
	friendsActivated: 0,
	friendsPaid: 0,
	collaborators: 0,
	feedbackSent: 0,
	feedbackAdopted: 0,
	bestBuildWeekStreak: 0,
	spentCredits: 0,
	topups: 0,
	earlyAdopter: 0,
};

describe("trophyLevelFor", () => {
	// A level starts at its minimum, not one point later, and the top level has no next level.
	it.each([
		[0, "kindle", 1, 40],
		[39, "kindle", 1, 40],
		[40, "flicker", 2, 120],
		[1199, "comet", 6, 1200],
		[1200, "nova", 7, null],
		[5000, "nova", 7, null],
	])("%d points is level %s (%d), next at %s", (points, id, index, next) => {
		const level = trophyLevelFor(points);
		expect([level.id, level.index, level.nextLevelPoints]).toEqual([
			id,
			index,
			next,
		]);
	});
});

describe("earnedTrophyIds", () => {
	// A trophy unlocks at its target, not one unit later.
	it.each([
		[4, ["first_project"]],
		[5, ["first_project", "projects_5"]],
	])("%d projects earn %j", (projects, expectedIds) => {
		expect(earnedTrophyIds({ ...NO_FACTS, projects })).toEqual(expectedIds);
	});
});

describe("catalog rules", () => {
	// A repeated id makes two rows share one stored unlock. A level out of order breaks trophyLevelFor.
	it("has unique trophy ids and levels in ascending point order", () => {
		const ids = TROPHIES.map((trophy) => trophy.id);
		expect(new Set(ids).size).toBe(ids.length);
		const minPoints = TROPHY_LEVELS.map((level) => level.minPoints);
		expect(minPoints).toEqual([...minPoints].sort((a, b) => a - b));
		expect(new Set(minPoints).size).toBe(minPoints.length);
	});
});
