/**
 * Picks the app design recipe of a web project from its project id.
 * `runBuilderTurn` in `builder-turn.runtime.ts` appends its sentence to the session instructions.
 * The template skill `app-dashboard` explains every option id.
 * It has no I/O and stores nothing: the project id gives the recipe again on every turn.
 */
import { createHash } from "node:crypto";

/**
 * Option ids per axis. Each id names a file or a section of templates/web-app/.claude/skills/app-dashboard.
 * A new id moves only the projects that it wins. A built app keeps its choices in the App recipe line of its tokens.css.
 */
export const APP_RECIPE_OPTIONS = {
	theme: [
		"zinc-cobalt",
		"linen-navy",
		"basalt-cyan",
		"slate-teal",
		"sand-forest",
		"clay-olive",
		"graphite-lime",
		"stone-rust",
		"chalk-ochre",
		"oat-cocoa",
		"ivory-plum",
		"ash-fuchsia",
	],
	mode: ["light", "dark"],
	sidebar: ["flat", "tinted", "inverse"],
	shell: ["inset", "floating", "bordered", "rail", "topbar"],
	density: ["compact", "regular", "comfortable"],
	cards: ["outline", "raised", "filled"],
	home: [
		"kpi-band",
		"split",
		"bento",
		"main-rail",
		"focus-queue",
		"status-board",
		"briefing",
		"tabbed",
	],
	kpi: ["number", "icon", "delta", "spark", "meter", "strip"],
	chart: ["area", "bars", "compare", "stacked", "gauge"],
} as const;

type ThemeId = (typeof APP_RECIPE_OPTIONS.theme)[number];

/** Color family of each theme. The sentence offers 3 themes of 3 families, so the agent can match the business. */
export const THEME_FAMILIES = {
	"zinc-cobalt": "cool",
	"linen-navy": "cool",
	"basalt-cyan": "cool",
	"slate-teal": "green",
	"sand-forest": "green",
	"clay-olive": "green",
	"graphite-lime": "ink",
	"stone-rust": "warm",
	"chalk-ochre": "warm",
	"oat-cocoa": "warm",
	"ivory-plum": "berry",
	"ash-fuchsia": "berry",
} as const satisfies Record<ThemeId, string>;

// 3 themes and 3 homes: the host cannot know the business.
// The agent takes the first option that fits it.
const RANKED_OPTION_COUNT = 3;
// 30 %: most business users expect a light app. 3 apps in 10 start dark for variety.
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
 */
export function appRecipeInstruction(projectId: string): string {
	const themes: ThemeId[] = [];
	const families = new Set<string>();
	for (const theme of rankOptions(
		projectId,
		"theme",
		APP_RECIPE_OPTIONS.theme,
	)) {
		// Stop at 3 themes. Skip a theme whose family is taken, so the 3 themes differ in color.
		if (themes.length === RANKED_OPTION_COUNT) {
			break;
		}
		if (!families.has(THEME_FAMILIES[theme])) {
			themes.push(theme);
			families.add(THEME_FAMILIES[theme]);
		}
	}
	const homes = rankOptions(projectId, "home", APP_RECIPE_OPTIONS.home).slice(
		0,
		RANKED_OPTION_COUNT,
	);
	// The score modulo 100 is a percent bucket from 0 to 99.
	const mode =
		scoreOf(projectId, "mode", "dark") % 100 < DARK_MODE_PERCENT
			? "dark"
			: "light";
	const rankedSidebar = rankOptions(
		projectId,
		"sidebar",
		APP_RECIPE_OPTIONS.sidebar,
	)[0];
	// The inverse block of a theme applies in light mode only. In dark mode it does nothing, so tinted replaces it.
	const sidebar =
		mode === "dark" && rankedSidebar === "inverse" ? "tinted" : rankedSidebar;
	const shell = rankOptions(projectId, "shell", APP_RECIPE_OPTIONS.shell)[0];
	const density = rankOptions(
		projectId,
		"density",
		APP_RECIPE_OPTIONS.density,
	)[0];
	const cards = rankOptions(projectId, "cards", APP_RECIPE_OPTIONS.cards)[0];
	const kpi = rankOptions(projectId, "kpi", APP_RECIPE_OPTIONS.kpi)[0];
	const chart = rankOptions(projectId, "chart", APP_RECIPE_OPTIONS.chart)[0];
	return (
		"App design recipe of this project (the app-dashboard skill reads it; ignore it when that skill does not exist): " +
		`theme=${themes.join("|")} mode=${mode} sidebar=${sidebar} shell=${shell} density=${density} cards=${cards} ` +
		`home=${homes.join("|")} kpi=${kpi} chart=${chart}.`
	);
}
