/**
 * Trophy catalog, levels, and API contract. A trophy gives points only, never credits or money.
 * The server module `trophies` fills TrophyFacts, stores each first unlock, and answers with trophiesResponseSchema.
 * The web feature `trophies` and the `/pricing` page read the catalog. The Fuel targets come from SPEND_BADGES.
 */
import { z } from "zod";
import { SPEND_BADGES, type SpendBadgeId } from "./credits";
import { isoDateTimeSchema } from "./shared/primitives";

/** Sections of the trophies page, in display order. */
export const trophyTracks = [
	"build",
	"ship",
	"craft",
	"grow",
	"team",
	"rhythm",
	"fuel",
	"special",
] as const;

export type TrophyTrack = (typeof trophyTracks)[number];

/** Rarity of a trophy, lowest first. TROPHY_POINTS gives the points of each. */
export const trophyRarities = ["common", "rare", "epic", "legendary"] as const;

export type TrophyRarity = (typeof trophyRarities)[number];

/** Points of one trophy for each rarity. The 40 trophies give 1,420 points in total. */
export const TROPHY_POINTS = {
	common: 10,
	rare: 25,
	epic: 60,
	legendary: 150,
} as const satisfies Record<TrophyRarity, number>;

/** Every count the catalog reads. The server fills it on each read. All values are numbers. */
export type TrophyFacts = {
	/** Projects of the user, deleted projects included. */
	projects: number;
	/** Projects with `engine = 'v2_app'`. */
	appProjects: number;
	/** Different `projects.target_platform` values. */
	targetPlatforms: number;
	/** Different `projects.starter_template_id` values. */
	starterTemplates: number;
	/** Settled `agent_session` and `page_build` usage events. */
	builds: number;
	/** Largest `builder_turns.turn_number` in one project of the user. */
	maxProjectTurns: number;
	/** Deployments of the user's projects that went live once. */
	publishes: number;
	/** Projects with an `active` deployment now. */
	liveProjects: number;
	/** Domains of the user with `status = 'active'`. */
	activeDomains: number;
	/** Settled `mobile_build` usage events. */
	mobileBuilds: number;
	/** Settled `desktop_build` usage events. */
	desktopBuilds: number;
	/** Settled `theme_design` usage events. */
	themeDesigns: number;
	/** Settled `image` usage events. */
	images: number;
	/** Settled `web_search` usage events. */
	webSearches: number;
	/** `app_commits` rows with `source = 'restore'` in the user's projects. */
	restores: number;
	/** `project_github_links` rows of the user. */
	githubLinks: number;
	/** Leads of the user's projects. */
	leads: number;
	/** `user_referrals` rows where the user is the referrer. */
	friendsJoined: number;
	/** Referred friends with `activated_at` set. */
	friendsActivated: number;
	/** Referred friends with `first_paid_at` set. */
	friendsPaid: number;
	/** Other users in `project_members` of the user's projects. */
	collaborators: number;
	/** `feedback` rows of the user. */
	feedbackSent: number;
	/** Feedback rows of the user with status `planned` or `resolved`. */
	feedbackAdopted: number;
	/** Longest run of ISO build weeks (UTC) in a row. */
	bestBuildWeekStreak: number;
	/** Decimal display credits: net lifetime spend of the personal wallet. */
	spentCredits: number;
	/** Personal top-up receipts that are not reversed. */
	topups: number;
	/** 1 when the user signed up before TROPHY_EARLY_ADOPTER_BEFORE, else 0. */
	earlyAdopter: number;
};

/** One catalog row. `Id` is a string while TROPHIES is built, then TrophyId. */
type TrophyDefinitionOf<Id extends string> = {
	readonly id: Id;
	readonly track: TrophyTrack;
	readonly rarity: TrophyRarity;
	/** The fact that the rule reads. The trophy unlocks when `facts[fact] >= target`. */
	readonly fact: keyof TrophyFacts;
	/** Smallest fact value that unlocks the trophy. Same unit as the fact. */
	readonly target: number;
	/** True when the web shows a riddle instead of the rule and the progress while the trophy is locked. */
	readonly hidden: boolean;
};

// The Fuel trophies keep the spend badge rarities. A new spend badge then needs a rarity here.
const FUEL_RARITIES = {
	spark: "common",
	apprentice: "common",
	builder: "rare",
	artisan: "rare",
	master: "epic",
	legend: "legendary",
} as const satisfies Record<SpendBadgeId, TrophyRarity>;

/**
 * The 40 trophies, in display order inside each track. A row id is also the `user_trophies.trophy_id` value.
 * Never rename an id: a stored unlock with an unknown id is dropped from the answer.
 */
export const TROPHIES = [
	// Build
	{
		id: "first_project",
		track: "build",
		rarity: "common",
		fact: "projects",
		target: 1,
		hidden: false,
	},
	{
		id: "projects_5",
		track: "build",
		rarity: "rare",
		fact: "projects",
		target: 5,
		hidden: false,
	},
	{
		id: "projects_25",
		track: "build",
		rarity: "epic",
		fact: "projects",
		target: 25,
		hidden: false,
	},
	{
		id: "first_app",
		track: "build",
		rarity: "common",
		fact: "appProjects",
		target: 1,
		hidden: false,
	},
	{
		id: "builds_50",
		track: "build",
		rarity: "rare",
		fact: "builds",
		target: 50,
		hidden: false,
	},
	{
		id: "builds_500",
		track: "build",
		rarity: "epic",
		fact: "builds",
		target: 500,
		hidden: false,
	},
	{
		id: "marathon",
		track: "build",
		rarity: "rare",
		fact: "maxProjectTurns",
		target: 30,
		hidden: false,
	},
	// Ship
	{
		id: "first_publish",
		track: "ship",
		rarity: "common",
		fact: "publishes",
		target: 1,
		hidden: false,
	},
	{
		id: "publishes_10",
		track: "ship",
		rarity: "rare",
		fact: "publishes",
		target: 10,
		hidden: false,
	},
	{
		id: "publishes_50",
		track: "ship",
		rarity: "epic",
		fact: "publishes",
		target: 50,
		hidden: false,
	},
	{
		id: "live_3",
		track: "ship",
		rarity: "rare",
		fact: "liveProjects",
		target: 3,
		hidden: false,
	},
	{
		id: "own_domain",
		track: "ship",
		rarity: "rare",
		fact: "activeDomains",
		target: 1,
		hidden: false,
	},
	// Craft
	{
		id: "mobile_build",
		track: "craft",
		rarity: "rare",
		fact: "mobileBuilds",
		target: 1,
		hidden: false,
	},
	{
		id: "desktop_build",
		track: "craft",
		rarity: "rare",
		fact: "desktopBuilds",
		target: 1,
		hidden: false,
	},
	{
		id: "polyglot",
		track: "craft",
		rarity: "epic",
		fact: "targetPlatforms",
		target: 3,
		hidden: true,
	},
	{
		id: "art_director",
		track: "craft",
		rarity: "common",
		fact: "themeDesigns",
		target: 1,
		hidden: false,
	},
	{
		id: "images_25",
		track: "craft",
		rarity: "rare",
		fact: "images",
		target: 25,
		hidden: false,
	},
	{
		id: "research_25",
		track: "craft",
		rarity: "rare",
		fact: "webSearches",
		target: 25,
		hidden: false,
	},
	{
		id: "time_traveler",
		track: "craft",
		rarity: "common",
		fact: "restores",
		target: 1,
		hidden: true,
	},
	{
		id: "explorer",
		track: "craft",
		rarity: "common",
		fact: "starterTemplates",
		target: 3,
		hidden: false,
	},
	{
		id: "open_source",
		track: "craft",
		rarity: "rare",
		fact: "githubLinks",
		target: 1,
		hidden: false,
	},
	// Grow
	{
		id: "first_lead",
		track: "grow",
		rarity: "common",
		fact: "leads",
		target: 1,
		hidden: false,
	},
	{
		id: "leads_100",
		track: "grow",
		rarity: "epic",
		fact: "leads",
		target: 100,
		hidden: false,
	},
	{
		id: "ambassador",
		track: "grow",
		rarity: "common",
		fact: "friendsJoined",
		target: 1,
		hidden: false,
	},
	{
		id: "mentor",
		track: "grow",
		rarity: "rare",
		fact: "friendsActivated",
		target: 1,
		hidden: false,
	},
	{
		id: "rainmaker",
		track: "grow",
		rarity: "epic",
		fact: "friendsPaid",
		target: 1,
		hidden: false,
	},
	// Team
	{
		id: "team_player",
		track: "team",
		rarity: "rare",
		fact: "collaborators",
		target: 1,
		hidden: false,
	},
	{
		id: "bug_hunter",
		track: "team",
		rarity: "common",
		fact: "feedbackSent",
		target: 1,
		hidden: false,
	},
	{
		id: "shaped_wandit",
		track: "team",
		rarity: "epic",
		fact: "feedbackAdopted",
		target: 1,
		hidden: false,
	},
	// Rhythm
	{
		id: "steady_4",
		track: "rhythm",
		rarity: "rare",
		fact: "bestBuildWeekStreak",
		target: 4,
		hidden: false,
	},
	{
		id: "seasoned_12",
		track: "rhythm",
		rarity: "epic",
		fact: "bestBuildWeekStreak",
		target: 12,
		hidden: false,
	},
	{
		id: "half_year",
		track: "rhythm",
		rarity: "legendary",
		fact: "bestBuildWeekStreak",
		target: 26,
		hidden: false,
	},
	// Fuel: one trophy per spend badge, so the targets and the names stay the same as the badges.
	...SPEND_BADGES.map(
		(badge) =>
			({
				id: `spend_${badge.id}`,
				track: "fuel",
				rarity: FUEL_RARITIES[badge.id],
				fact: "spentCredits",
				target: badge.thresholdCredits,
				hidden: false,
			}) as const,
	),
	// Special
	{
		id: "backer",
		track: "special",
		rarity: "common",
		fact: "topups",
		target: 1,
		hidden: false,
	},
	{
		id: "early_adopter",
		track: "special",
		rarity: "epic",
		fact: "earlyAdopter",
		target: 1,
		hidden: false,
	},
] as const satisfies readonly TrophyDefinitionOf<string>[];

/** Id of one TROPHIES row. Also the `user_trophies.trophy_id` value. */
export type TrophyId = (typeof TROPHIES)[number]["id"];

/** One catalog row with a known id. */
export type TrophyDefinition = TrophyDefinitionOf<TrophyId>;

/** Ids in TROPHIES order. */
export const trophyIds: readonly TrophyId[] = TROPHIES.map(
	(trophy) => trophy.id,
);

/** Parses one trophy id from a request body. An id outside the catalog fails. */
export const trophyIdSchema = z.enum(trophyIds);

/** The 7 levels, lowest first. A level starts at `minPoints` points. */
export const TROPHY_LEVELS = [
	{ id: "kindle", minPoints: 0 },
	{ id: "flicker", minPoints: 40 },
	{ id: "flame", minPoints: 120 },
	{ id: "blaze", minPoints: 260 },
	{ id: "forge", minPoints: 480 },
	{ id: "comet", minPoints: 800 },
	{ id: "nova", minPoints: 1200 },
] as const satisfies readonly { id: string; minPoints: number }[];

export type TrophyLevelId = (typeof TROPHY_LEVELS)[number]["id"];

/** Level ids in TROPHY_LEVELS order. The web maps each id to a translated name. */
export const trophyLevelIds: readonly TrophyLevelId[] = TROPHY_LEVELS.map(
	(level) => level.id,
);

/**
 * Users who sign up before this time get the `early_adopter` trophy. ISO date-time, UTC.
 * Product choice: Zack sets the real date at go-live.
 */
export const TROPHY_EARLY_ADOPTER_BEFORE = "2027-01-01T00:00:00.000Z";

/**
 * Largest target of one fact in TROPHIES, or 0 when no trophy reads the fact.
 * The server caps each count of the facts query at this value, so the query stops early.
 */
export function trophyMaxTargetFor(fact: keyof TrophyFacts): number {
	return TROPHIES.reduce(
		(max, trophy) =>
			trophy.fact === fact ? Math.max(max, trophy.target) : max,
		0,
	);
}

/** Ids of the trophies whose rule the facts meet, in TROPHIES order. The server stores the new ones. */
export function earnedTrophyIds(facts: TrophyFacts): TrophyId[] {
	return TROPHIES.filter((trophy) => facts[trophy.fact] >= trophy.target).map(
		(trophy) => trophy.id,
	);
}

/** Sum of TROPHY_POINTS for the given ids. A repeated id counts one time. */
export function trophyPointsFor(ids: readonly TrophyId[]): number {
	const idSet = new Set(ids);
	return TROPHIES.reduce(
		(points, trophy) =>
			idSet.has(trophy.id) ? points + TROPHY_POINTS[trophy.rarity] : points,
		0,
	);
}

/** The level of a points total in the API answer. */
export const trophyLevelSchema = z.object({
	id: z.enum(trophyLevelIds),
	// Position in TROPHY_LEVELS, from 1 (kindle) to 7 (nova). The web shows it in the level ring.
	index: z.int().min(1).max(TROPHY_LEVELS.length),
	minPoints: z.int().nonnegative(),
	// Points where the next level starts. Null at the top level.
	nextLevelPoints: z.int().positive().nullable(),
});

export type TrophyLevel = z.infer<typeof trophyLevelSchema>;

/** The level of `points`: the last level whose `minPoints` the points reach. Below 0 points gives the first level. */
export function trophyLevelFor(points: number): TrophyLevel {
	const level =
		TROPHY_LEVELS.filter((candidate) => candidate.minPoints <= points).at(-1) ??
		TROPHY_LEVELS[0];
	const nextLevel = TROPHY_LEVELS.find(
		(candidate) => candidate.minPoints > points,
	);
	return {
		id: level.id,
		index: TROPHY_LEVELS.indexOf(level) + 1,
		minPoints: level.minPoints,
		nextLevelPoints: nextLevel?.minPoints ?? null,
	};
}

/** Number of weeks in the build-week strip of the trophies page. The last item is this week. */
export const TROPHY_RECENT_BUILD_WEEKS = 12;

/**
 * Answer of GET trophiesRoutes.list for the session user. It does not read the workspace header.
 * Points and the level come from the stored trophies, so they never go down.
 */
export const trophiesResponseSchema = z.object({
	points: z.int().nonnegative(),
	level: trophyLevelSchema,
	// Build weeks are ISO weeks (Monday to Sunday, UTC) with one settled build or more.
	buildWeeks: z.object({
		// Weeks in a row up to this week, or up to last week when this week has no build yet.
		currentStreak: z.int().nonnegative(),
		bestStreak: z.int().nonnegative(),
		// One item per week, oldest first. True when the week has a build.
		recent: z.array(z.boolean()).length(TROPHY_RECENT_BUILD_WEEKS),
	}),
	// One item per TROPHIES row, in TROPHIES order.
	trophies: z.array(
		z.object({
			id: trophyIdSchema,
			// Progress toward the target, capped at the target. Null for a hidden trophy that is locked.
			current: z.number().nonnegative().nullable(),
			// Time of the first unlock. Null while the trophy is locked.
			unlockedAt: isoDateTimeSchema.nullable(),
			// True when the trophy is stored and `seen_at` is null.
			isNew: z.boolean(),
		}),
	),
});

export type TrophiesResponse = z.infer<typeof trophiesResponseSchema>;

/** Body of POST trophiesRoutes.seen. The web sends the ids of the new trophies after it shows their toasts. */
export const markTrophiesSeenBodySchema = z.strictObject({
	trophyIds: z.array(trophyIdSchema).min(1).max(trophyIds.length),
});

export type MarkTrophiesSeenBody = z.infer<typeof markTrophiesSeenBodySchema>;

/** Full paths of the trophy routes. Both need a signed-in user. */
export const trophiesRoutes = {
	list: "/api/v1/trophies",
	seen: "/api/v1/trophies/seen",
} as const;
