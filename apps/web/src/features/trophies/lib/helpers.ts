/**
 * Pure helpers of the trophies feature: join the API answer with the catalog, and compute progress.
 * The summary card, the trophies page, and the unlock toaster call them. They read TROPHIES from contracts.
 */
import {
	TROPHIES,
	TROPHY_LEVELS,
	type TrophiesResponse,
	type TrophyDefinition,
	type TrophyLevel,
	type TrophyLevelId,
} from "@wandit/contracts";

/** How a medallion shows a trophy. "hidden" is a secret trophy that is still locked. */
export type TrophyState = "locked" | "unlocked" | "hidden";

/** One catalog row with the state of the user. */
export type TrophyView = {
	definition: TrophyDefinition;
	state: TrophyState;
	/** Fact value, capped at the target. Null for a hidden trophy that is locked. */
	current: number | null;
	/** ISO date-time of the first unlock. Null while the trophy is locked. */
	unlockedAt: string | null;
	/** True when the user did not see the unlock toast yet. */
	isNew: boolean;
	/** Progress from 0 to 1. An unlocked trophy is 1. A hidden locked trophy is 0. */
	progressRatio: number;
};

/**
 * The catalog in TROPHIES order, joined with the answer by id.
 * The function skips a catalog row that the answer does not hold: the server runs an older catalog.
 */
export function toTrophyViews(response: TrophiesResponse): TrophyView[] {
	const entries = new Map(response.trophies.map((entry) => [entry.id, entry]));
	return TROPHIES.flatMap((definition) => {
		const entry = entries.get(definition.id);
		if (!entry) return [];
		const isUnlocked = entry.unlockedAt !== null;
		const state: TrophyState = isUnlocked
			? "unlocked"
			: definition.hidden
				? "hidden"
				: "locked";
		const progressRatio = isUnlocked
			? 1
			: Math.min(1, (entry.current ?? 0) / definition.target);
		return [
			{
				definition,
				state,
				current: entry.current,
				unlockedAt: entry.unlockedAt,
				isNew: entry.isNew,
				progressRatio,
			},
		];
	});
}

/** Number of trophies in the "Next up" lists of the summary card and the trophies page. */
const NEXT_UP_COUNT = 3;

/**
 * The 3 locked trophies that are nearest to their target, highest progress first.
 * A tie keeps the catalog order. The list skips hidden trophies, because their progress is secret.
 */
export function nearestTrophies(views: TrophyView[]) {
	return views
		.filter((view) => view.state === "locked")
		.sort((first, second) => second.progressRatio - first.progressRatio)
		.slice(0, NEXT_UP_COUNT);
}

/** Progress from the start of the level to the start of the next level, from 0 to 1. The top level is 1. */
export function levelProgressRatio(points: number, level: TrophyLevel) {
	if (level.nextLevelPoints === null) return 1;
	return Math.min(
		1,
		(points - level.minPoints) / (level.nextLevelPoints - level.minPoints),
	);
}

/** Id of the level after `level`, found by its start points. Null at the top level. */
export function nextLevelId(level: TrophyLevel): TrophyLevelId | null {
	return (
		TROPHY_LEVELS.find(
			(candidate) => candidate.minPoints === level.nextLevelPoints,
		)?.id ?? null
	);
}
