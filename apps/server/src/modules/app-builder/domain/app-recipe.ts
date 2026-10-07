/**
 * Picks the app design recipe of a web project from its project id. Rendezvous hashing ranks the options of each axis.
 * `runBuilderTurn` in `builder-turn.runtime.ts` appends its sentence to the session instructions.
 * The template skill `app-dashboard` explains every option id.
 * It has no I/O and stores nothing: the project id gives the recipe again on every turn.
 */
import { createHash } from "node:crypto";

/**
 * Option ids per axis, in sentence order. Each id names a file or a section of templates/web-app/.claude/skills/app-dashboard.
 * accent and fonts are indexes inside the chosen style file. mode, shell, and density are sections of frame.md.
 * A new id moves only the projects that it wins. A built app keeps its choices in the App recipe line of its tokens.css.
 */
export const APP_RECIPE_OPTIONS = {
	style: [
		"livre",
		"regie",
		"cadran",
		"tampon",
		"brume",
		"console",
		"porcelaine",
		"suisse",
		"coffre",
		"preau",
		"etabli",
		"comptoir",
		"serre",
		"coulisses",
		"carnet",
		"brigade",
	],
	accent: ["1", "2", "3"],
	fonts: ["1", "2"],
	mode: ["light", "dark"],
	shell: ["inset", "floating", "bordered", "rail", "topbar"],
	density: ["compact", "regular", "comfortable"],
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

// 3 styles and 3 homes: the host cannot know the business.
// The agent takes the first option that fits it.
const RANKED_OPTION_COUNT = 3;
// 30 %: most business users expect a light app. 3 apps in 10 start dark for variety.
// A style with one mode ignores this axis.
const DARK_MODE_PERCENT = 30;

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
 * The recipe sentence of a web project. The same id gives the same sentence,
 * so the prompt cache and the warm CLI process stay valid.
 * Style and home give 3 ranked ids; every other axis gives 1 id.
 */
export function appRecipeInstruction(projectId: string): string {
	const styles = rankOptions(
		projectId,
		"style",
		APP_RECIPE_OPTIONS.style,
	).slice(0, RANKED_OPTION_COUNT);
	const accent = rankOptions(projectId, "accent", APP_RECIPE_OPTIONS.accent)[0];
	const fonts = rankOptions(projectId, "fonts", APP_RECIPE_OPTIONS.fonts)[0];
	// The score modulo 100 is a percent bucket from 0 to 99.
	const mode =
		scoreOf(projectId, "mode", "dark") % 100 < DARK_MODE_PERCENT
			? "dark"
			: "light";
	const shell = rankOptions(projectId, "shell", APP_RECIPE_OPTIONS.shell)[0];
	const density = rankOptions(
		projectId,
		"density",
		APP_RECIPE_OPTIONS.density,
	)[0];
	const homes = rankOptions(projectId, "home", APP_RECIPE_OPTIONS.home).slice(
		0,
		RANKED_OPTION_COUNT,
	);
	const kpi = rankOptions(projectId, "kpi", APP_RECIPE_OPTIONS.kpi)[0];
	const chart = rankOptions(projectId, "chart", APP_RECIPE_OPTIONS.chart)[0];
	return (
		"App design recipe of this project (the app-dashboard skill reads it; ignore it when that skill does not exist): " +
		`style=${styles.join("|")} accent=${accent} fonts=${fonts} mode=${mode} shell=${shell} density=${density} ` +
		`home=${homes.join("|")} kpi=${kpi} chart=${chart}.`
	);
}
