/**
 * Picks the app design recipe of a web or desktop project from its project id.
 * The recipe is the home, KPI, and chart forms. The theme is not in it: the host writes src/styles/theme.json.
 * `runBuilderTurn` in `builder-turn.runtime.ts` appends its sentence to the session instructions.
 * The template skill `app-dashboard` explains every option id.
 * It has no I/O and stores nothing: the project id gives the recipe again on every turn.
 */
import { createHash } from "node:crypto";

/**
 * Option ids per axis, in sentence order. Each id names a file of templates/web-app/.claude/skills/app-dashboard:
 * homes/<id>.md, kpis/<id>.md, or charts/<id>.md. A new id moves only the projects that it wins.
 */
export const APP_RECIPE_OPTIONS = {
	home: [
		"kpi-band",
		"split",
		"bento",
		"main-rail",
		"focus-queue",
		"status-board",
		"briefing",
		"tabbed",
		"ledger",
		"board",
		"hero",
		"digest",
	],
	kpi: ["number", "icon", "delta", "spark", "meter", "strip"],
	chart: ["area", "bars", "compare", "stacked", "heat"],
} as const;

// 3 homes: the host cannot know the business.
// The agent takes the first option that fits it.
const RANKED_OPTION_COUNT = 3;

// Rendezvous hashing: each (project, axis, option) triple gets its own score.
// NUL separates the parts, so two different triples never give the same hash input.
// The first 4 bytes of the digest give a uniform 32-bit score.
function scoreOf(projectId: string, axis: string, optionId: string): number {
	return createHash("sha256")
		.update(`${projectId}\0${axis}\0${optionId}`)
		.digest()
		.readUInt32BE(0);
}

/**
 * Options of one axis, best first for this project (rendezvous hashing).
 * A new option takes only the projects where it scores highest. Equal scores keep the list order.
 */
export function rankOptions<T extends string>(
	projectId: string,
	axis: string,
	optionIds: readonly [T, ...T[]],
): [T, ...T[]] {
	// One hash per option, not one per comparison: the sort compares each option many times.
	const ranked = optionIds
		.map((optionId) => ({
			optionId,
			score: scoreOf(projectId, axis, optionId),
		}))
		.sort((left, right) => right.score - left.score)
		.map((scored) => scored.optionId);
	// SAFETY: `optionIds` is a non-empty tuple, and map and sort keep its length.
	return ranked as [T, ...T[]];
}

/**
 * The recipe sentence of a web or desktop project. The same id gives the same sentence,
 * so the prompt cache and the warm CLI process stay valid.
 * Home gives 3 ranked ids; KPI and chart give 1 id each.
 */
export function appRecipeInstruction(projectId: string): string {
	const homes = rankOptions(projectId, "home", APP_RECIPE_OPTIONS.home).slice(
		0,
		RANKED_OPTION_COUNT,
	);
	const kpi = rankOptions(projectId, "kpi", APP_RECIPE_OPTIONS.kpi)[0];
	const chart = rankOptions(projectId, "chart", APP_RECIPE_OPTIONS.chart)[0];
	return (
		"App design recipe of this project (the app-dashboard skill reads it; ignore it when that skill does not exist): " +
		`home=${homes.join("|")} kpi=${kpi} chart=${chart}.`
	);
}
