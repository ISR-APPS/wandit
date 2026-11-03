/**
 * The theme deal, the set_theme patch, and the version gate of a V2 web app. Pure functions, no I/O.
 * builder-turn.runtime.ts deals the 3 cards of a theme question and writes the card of the answer.
 * AppThemeService answers the fallback selection for a project with no readable theme.json.
 * The set_theme host tool parses the agent input with parseThemePatch and applies it with applyThemePatch.
 * The coherence rules come from "@wandit/contracts/v2/app-theme", the looks from "/v2/app-theme-catalog".
 */
import type {
	AskUserHostToolOutput,
	SetThemeHostToolInput,
} from "@wandit/contracts";
import {
	APP_BODY_FONT_IDS,
	APP_DISPLAY_FONT_IDS,
	APP_LOOK_IDS,
	APP_THEME_OPTIONS,
	type AppLook,
	type AppLookFamily,
	type AppLookId,
	type AppThemeCategory,
	type AppThemeFamilyRules,
	type AppThemeFile,
	type AppThemeOrigin,
	type AppThemeSelection,
	appThemeSourceSchema,
	coherentSelection,
} from "@wandit/contracts/v2/app-theme";
import {
	APP_LOOK_FAMILIES,
	APP_LOOKS,
	APP_THEME_CATEGORIES,
	APP_THEME_FAMILY_RULES,
} from "@wandit/contracts/v2/app-theme-catalog";

import { rankOptions } from "./app-recipe";
import type { QuestionInteraction } from "./question-answers";

/** One card of a theme deal. The option id of the card is `look:<look>`. */
export type ThemeCard = { look: AppLookId; selection: AppThemeSelection };

/** The three cards of a deal, best first. Card 1 is the theme of "You choose". */
export type ThemeCards = [ThemeCard, ThemeCard, ThemeCard];

/** A `#rrggbb` brand color in lower case, the form of the selection schema. */
type HexColor = `#${string}`;

/** The selection fields that set_theme can name one by one. The source has its own patch fields. */
type ThemeFieldName = Exclude<keyof AppThemeSelection, "source">;

/** The set_theme input after the tolerant parse: only the fields that the agent named. */
export type ThemePatch = {
	/** A category: the patch deals a whole new theme for it. */
	business?: AppThemeCategory;
	look?: AppLookId;
	/** A world id in the form of the selection schema. The tool checks it with `worldCardOf`. */
	world?: string;
	/** Three brand colors: the patch makes a seeds source. */
	seeds?: { background: HexColor; foreground: HexColor; primary: HexColor };
	/** True deals another look than the current one. */
	reroll: boolean;
	/** The selection fields that the agent named, already valid. */
	fields: Partial<Pick<AppThemeSelection, ThemeFieldName>>;
};

// LIMIT: web-app@1.0.0 projects keep their old look system and get no theme features. Upgrade: a template migration that adds theme.json.
/**
 * True for "web-app@1.1.0" and later: only these projects have src/styles/theme.json. The theme cards,
 * set_theme, the pre-turn fallback, and the turn-end guard all check it. Any other text answers false.
 */
export function supportsAppTheme(templateVersion: string): boolean {
	const version = /^web-app@(?<major>\d+)\.(?<minor>\d+)\.\d+$/.exec(
		templateVersion,
	)?.groups;
	if (version === undefined) {
		return false;
	}
	const major = Number(version.major);
	// Compare numbers, not text: "1.10.0" is later than "1.2.0".
	return major > 1 || (major === 1 && Number(version.minor) >= 1);
}

/**
 * The id form of an agent or user text: no accents, lower case, and "-" for spaces.
 * "Néo doux" gives "neo-doux", "Sidebar footer" gives "sidebar-footer".
 */
function idOf(text: string): string {
	return text
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.trim()
		.toLowerCase()
		.replace(/[\s_]+/g, "-");
}

/** The deal category of a business text: "Real estate" gives "real-estate". An unknown text gives "other". */
function themeCategoryOf(business: string): AppThemeCategory {
	const id = idOf(business);
	return APP_THEME_CATEGORIES.find((category) => category === id) ?? "other";
}

/**
 * Three themes for a business, from 3 different families, best first. Each family gives a look that fits
 * the business, else any look of the family. Rendezvous hashing on the project id works as in the app recipe.
 * So the same input gives the same cards, also on the answer turn that writes the picked card.
 */
export function dealThemeCards(input: {
	projectId: string;
	business: AppThemeCategory;
	/** 0 for the theme question. A reroll passes another number, so the looks rank again. */
	round: number;
	/** The look of the current theme.json. A reroll never deals it again. */
	excludeLook?: AppLookId;
}): ThemeCards {
	const { business, excludeLook, projectId, round } = input;
	const looksOf = (family: AppLookFamily) =>
		APP_LOOK_IDS.filter(
			(id) => APP_LOOKS[id].family === family && id !== excludeLook,
		);
	const fittingLooksOf = (family: AppLookFamily) =>
		looksOf(family).filter((id) => {
			const look: AppLook = APP_LOOKS[id];
			return look.fits.includes(business);
		});
	const ranked = rankOptions(
		projectId,
		dealAxisOf(round, "family"),
		APP_LOOK_FAMILIES,
	);
	// Families with a look for this business come first, so all 3 cards fit when 3 families can.
	const [first, second, third] = [
		...ranked.filter((family) => fittingLooksOf(family).length > 0),
		...ranked.filter((family) => fittingLooksOf(family).length === 0),
	];
	if (first === undefined || second === undefined || third === undefined) {
		throw new Error("The look catalog has fewer than 3 families");
	}
	const cardOf = (family: AppLookFamily): ThemeCard => {
		const fitting = fittingLooksOf(family);
		const [look] = rankOptions(
			projectId,
			dealAxisOf(round, "look"),
			nonEmpty(fitting.length > 0 ? fitting : looksOf(family)),
		);
		return { look, selection: dealtSelection(projectId, round, look) };
	};
	return [cardOf(first), cardOf(second), cardOf(third)];
}

/**
 * The selection of the pre-turn fallback: card 1 of the deal for business "other".
 * The theme GET answers it for a missing or broken theme.json. The pre-turn fallback writes it for a HEAD
 * file with origin template. With no HEAD file, it writes it for a missing, broken, or template disk file.
 */
export function fallbackThemeSelection(projectId: string): AppThemeSelection {
	return dealThemeCards({ business: "other", projectId, round: 0 })[0]
		.selection;
}

/** The rank axis name of one deal round. Each round has its own names, so the same round deals the same again. */
function dealAxisOf(round: number, axis: string): string {
	return `theme-${round}-${axis}`;
}

/**
 * The selection of one dealt look. It takes the designed radius, border, and shadow of the look, and a
 * primary of the look. Each layout axis comes from the rules of its family. coherentSelection makes it
 * hold together. It reads only the project, the round, and the look. So a look of a round always gives the same card.
 */
function dealtSelection(
	projectId: string,
	round: number,
	lookId: AppLookId,
): AppThemeSelection {
	const look: AppLook = APP_LOOKS[lookId];
	const rules: AppThemeFamilyRules = APP_THEME_FAMILY_RULES[look.family];
	// Each axis ranks its own values, so two cards and two projects differ axis by axis.
	const pick = <Value extends string>(
		axis: string,
		values: readonly [Value, ...Value[]],
	): Value =>
		rankOptions(
			projectId,
			dealAxisOf(round, `${look.family}-${axis}`),
			values,
		)[0];
	const primaries: [
		AppThemeSelection["primary"],
		...AppThemeSelection["primary"][],
	] = ["look", ...look.primaries];
	return coherentSelection({
		source: { kind: "look", look: lookId },
		mode: look.defaults.mode,
		primary: rankOptions(
			projectId,
			dealAxisOf(round, `${lookId}-primary`),
			primaries,
		)[0],
		// The look fonts are a designed pair.
		font: "look",
		displayFont: "look",
		radius: look.defaults.radius,
		border: look.defaults.border,
		shadow: look.defaults.shadow,
		shadowStyle: look.defaults.shadowStyle,
		scale: pick("scale", rules.scale),
		content: pick("content", rules.content),
		sidebarStyle: pick("sidebarStyle", rules.sidebarStyle),
		sidebarCollapse: pick("sidebarCollapse", rules.sidebarCollapse),
		sidebarStart: pick("sidebarStart", rules.sidebarStart),
		sidebarTone: pick("sidebarTone", rules.sidebarTone),
		activeItem: pick("activeItem", rules.activeItem),
		header: pick("header", rules.header),
		userMenu: pick("userMenu", rules.userMenu),
		frame: pick("frame", rules.frame),
		icons: pick("icons", rules.icons),
		navIcon: pick("navIcon", rules.navIcon),
	});
}

/** The list as a non-empty tuple. Every family has 5 looks, so an empty list is a catalog bug. */
function nonEmpty<Item>(items: Item[]): [Item, ...Item[]] {
	const [head, ...tail] = items;
	if (head === undefined) {
		throw new Error("A look family has no look to deal");
	}
	return [head, ...tail];
}

/** The option id of a theme card in the ask_user tray. The answer names the picked card by it. */
export function themeCardOptionId(card: Pick<ThemeCard, "look">): string {
	return `look:${card.look}`;
}

/** One question of a paused ask_user call, as the resume envelope stores it. */
type PendingQuestion = QuestionInteraction["questions"][number];

/**
 * The 3 cards of a theme question, or null for any other question. The deal has no state. So the
 * suspend turn, the card parts, and the answer turn get the same cards for one business.
 */
export function themeCardsOfQuestion(
	projectId: string,
	question: Pick<PendingQuestion, "theme">,
): ThemeCards | null {
	return question.theme === undefined
		? null
		: dealThemeCards({
				business: themeCategoryOf(question.theme.business),
				projectId,
				round: 0,
			});
}

/**
 * The theme question as a single choice of its 3 cards. The agent sends no options; the tray adds
 * "You choose". Any other question comes back as it is.
 */
export function withThemeCardOptions(
	projectId: string,
	question: PendingQuestion,
): PendingQuestion {
	const cards = themeCardsOfQuestion(projectId, question);
	if (cards === null) {
		return question;
	}
	return {
		...question,
		kind: "single-choice",
		options: cards.map((card) => ({
			id: themeCardOptionId(card),
			label: APP_LOOKS[card.look].name,
		})),
	};
}

/**
 * What a theme question answer does to theme.json: write a card, or keep the current theme.
 * A picked card writes its look as the user's choice. "You choose" writes card 1 as a host choice.
 * A skip, or typed text without a pick, writes card 1 too, but keeps a theme that the user chose.
 */
export function themeOfAnswer(input: {
	projectId: string;
	/** The 3 cards of the question, from themeCardsOfQuestion. */
	cards: ThemeCards;
	/** The theme.json that the host trusts now, or null when the pre-turn fallback failed. */
	current: AppThemeFile | null;
	answer: Pick<AskUserHostToolOutput["answers"][number], "action" | "selected">;
}):
	| { kind: "write"; card: ThemeCard; origin: AppThemeOrigin }
	| { kind: "keep"; current: AppThemeFile } {
	const { answer, cards, current, projectId } = input;
	const pickedId = answer.action === "answered" ? answer.selected[0]?.id : null;
	// The web sends the option id: only the id of a catalog look counts as a pick.
	const look = APP_LOOK_IDS.find(
		(id) => themeCardOptionId({ look: id }) === pickedId,
	);
	if (look !== undefined) {
		// Round 0 is the round of the tray. The card depends on the project and the look, not on the family rank.
		return {
			card: { look, selection: dealtSelection(projectId, 0, look) },
			kind: "write",
			origin: "user",
		};
	}
	// The agent reads the typed text and calls set_theme for a change it asks for.
	if (answer.action !== "delegated" && current?.origin === "user") {
		return { current, kind: "keep" };
	}
	return { card: cards[0], kind: "write", origin: "host" };
}

/** The values of a list, joined for the allowed-values text of a parse error. */
function allowedText(values: readonly (string | number)[]): string {
	return values.join(", ");
}

/**
 * The set_theme input as a patch, or the errors of every bad value. The parse is tolerant: case, accents,
 * spaces, a "px" on the border, and a hex without "#" pass. Each error names the allowed values.
 */
export function parseThemePatch(
	input: SetThemeHostToolInput,
): { ok: true; patch: ThemePatch } | { ok: false; errors: string[] } {
	const errors: string[] = [];
	const fields: ThemePatch["fields"] = {};
	const refuse = (
		name: string,
		value: string | number,
		allowed: string,
	): undefined => {
		errors.push(`${name} "${value}" is not valid. Allowed: ${allowed}.`);
		return undefined;
	};
	/** Keeps a parsed field. An undefined value already has its error. */
	const setField = <Name extends ThemeFieldName>(
		name: Name,
		value: AppThemeSelection[Name] | undefined,
	) => {
		if (value !== undefined) {
			fields[name] = value;
		}
	};
	/** The option of a list that the text names, or undefined after an error. */
	const optionOf = <Value extends string>(
		name: string,
		value: string,
		values: readonly Value[],
	): Value | undefined =>
		values.find((option) => option === idOf(value)) ??
		refuse(name, value, allowedText(values));
	const hexOf = (name: string, value: string): HexColor | undefined => {
		const digits = /^#?(?<digits>[0-9a-f]{6})$/.exec(value.trim().toLowerCase())
			?.groups?.digits;
		return digits === undefined
			? refuse(name, value, "a #rrggbb color")
			: `#${digits}`;
	};

	const enumFields = [
		"mode",
		"scale",
		"radius",
		"shadow",
		"shadowStyle",
		"content",
		"sidebarStyle",
		"sidebarCollapse",
		"sidebarStart",
		"sidebarTone",
		"activeItem",
		"header",
		"userMenu",
		"frame",
		"icons",
		"navIcon",
	] as const satisfies readonly ThemeFieldName[];
	for (const name of enumFields) {
		const value = input[name];
		if (value !== undefined) {
			setField(name, optionOf(name, value, APP_THEME_OPTIONS[name]));
		}
	}
	if (input.border !== undefined) {
		// "1px", "1.0", and the number 1 all name the "1" option.
		const width = String(
			Number(String(input.border).trim().replace(/px$/i, "")),
		);
		setField(
			"border",
			APP_THEME_OPTIONS.border.find((option) => option === width) ??
				refuse("border", input.border, allowedText(APP_THEME_OPTIONS.border)),
		);
	}
	if (input.font !== undefined) {
		setField(
			"font",
			optionOf("font", input.font, ["look", ...APP_BODY_FONT_IDS]),
		);
	}
	if (input.displayFont !== undefined) {
		setField(
			"displayFont",
			optionOf("displayFont", input.displayFont, [
				"look",
				...APP_DISPLAY_FONT_IDS,
			]),
		);
	}

	let look: AppLookId | undefined;
	if (input.look !== undefined) {
		// The agent can name a look by its id or by its name, for example "Néo doux".
		const key = idOf(input.look);
		look =
			APP_LOOK_IDS.find(
				(id) => id === key || idOf(APP_LOOKS[id].name) === key,
			) ?? refuse("look", input.look, allowedText(APP_LOOK_IDS));
	}
	let world: string | undefined;
	if (input.world !== undefined) {
		const key = idOf(input.world);
		world = appThemeSourceSchema.safeParse({ kind: "world", world: key })
			.success
			? key
			: refuse(
					"world",
					input.world,
					"the folder name of a design world skill, for example zellige",
				);
	}
	const isSeeds =
		input.background !== undefined || input.foreground !== undefined;
	let seeds: ThemePatch["seeds"];
	if (isSeeds) {
		// Brand seeds need all three colors: deriveTokens builds both palettes from them.
		const background = hexOf("background", input.background ?? "");
		const foreground = hexOf("foreground", input.foreground ?? "");
		const primary = hexOf("primary", input.primary ?? "");
		seeds =
			background === undefined ||
			foreground === undefined ||
			primary === undefined
				? undefined
				: { background, foreground, primary };
	} else if (input.primary !== undefined) {
		const key = idOf(input.primary);
		setField(
			"primary",
			key === "look"
				? "look"
				: (APP_THEME_OPTIONS.hue.find((hue) => hue === key) ??
						hexOf("primary", input.primary)),
		);
	}
	// One palette source per call: a look, a world, or brand colors.
	const sourceCount = [
		input.look !== undefined,
		input.world !== undefined,
		isSeeds,
	].filter(Boolean).length;
	if (sourceCount > 1) {
		errors.push("Name only one of look, world, or background and foreground.");
	}

	// All or nothing: one bad value changes no field, so the agent fixes it and calls again.
	if (errors.length > 0) {
		return { errors, ok: false };
	}
	return {
		ok: true,
		patch: {
			...(input.business === undefined
				? {}
				: { business: themeCategoryOf(input.business) }),
			...(look === undefined ? {} : { look }),
			...(world === undefined ? {} : { world }),
			...(seeds === undefined ? {} : { seeds }),
			fields,
			reroll: input.reroll === true,
		},
	};
}

/**
 * The next selection and origin after a set_theme patch, or null when the patch changes nothing.
 * A business-only patch deals card 1 for the business, but never over a theme that the user picked.
 * A reroll deals another look and keeps the mode of a theme that the user chose.
 * Every other patch keeps the current theme and changes only the fields that it names.
 */
export function applyThemePatch(input: {
	projectId: string;
	/** The current theme.json, or null when the file is missing or broken. */
	current: AppThemeFile | null;
	patch: ThemePatch;
}): { selection: AppThemeSelection; origin: AppThemeOrigin } | null {
	const { current, patch, projectId } = input;
	const namesMore =
		patch.reroll ||
		patch.look !== undefined ||
		patch.world !== undefined ||
		patch.seeds !== undefined ||
		Object.keys(patch.fields).length > 0;
	// The deal of a business never replaces a theme that the user picked.
	if (
		!namesMore &&
		(patch.business === undefined || current?.origin === "user")
	) {
		return null;
	}
	// LIMIT: theme.json does not store the business. Without one in the patch, a reroll or a patch on a missing file deals for "other". Upgrade: store the business in theme.json.
	const business = patch.business ?? "other";
	const currentSource = current?.selection.source;
	const currentLook =
		currentSource?.kind === "look" ? currentSource.look : undefined;
	const base = patch.reroll
		? dealThemeCards({
				business,
				excludeLook: currentLook,
				projectId,
				// Each current look gives its own round. So the next look depends on
				// the current look, not only on the project.
				round:
					1 +
					(currentLook === undefined ? 0 : APP_LOOK_IDS.indexOf(currentLook)),
			})[0].selection
		: patch.business !== undefined && current?.origin !== "user"
			? dealThemeCards({ business, projectId, round: 0 })[0].selection
			: (current?.selection ??
				dealThemeCards({ business, projectId, round: 0 })[0].selection);
	const look: AppLook | undefined =
		patch.look === undefined ? undefined : APP_LOOKS[patch.look];
	const source: AppThemeSelection["source"] =
		patch.look !== undefined
			? { kind: "look", look: patch.look }
			: patch.world !== undefined
				? { kind: "world", world: patch.world }
				: patch.seeds !== undefined
					? { kind: "seeds", ...patch.seeds }
					: base.source;
	return {
		origin: namesMore ? "user" : "host",
		selection: coherentSelection({
			...base,
			// A new look comes with the radius, border, and shadow it is designed with.
			...(look === undefined ? {} : look.defaults),
			// The user's mode survives a reroll. The primary comes from the new look: a reroll asks for new colors.
			mode:
				patch.reroll && current?.origin === "user"
					? current.selection.mode
					: base.mode,
			...patch.fields,
			source,
		}),
	};
}
