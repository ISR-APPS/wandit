import type { AskUserHostToolOutput } from "@wandit/contracts";
import {
	APP_LOOK_IDS,
	type AppLookId,
	type AppThemeFile,
	type AppThemeOrigin,
	buildAppThemeFile,
} from "@wandit/contracts/v2/app-theme";
import {
	APP_LOOKS,
	APP_THEME_CATEGORIES,
} from "@wandit/contracts/v2/app-theme-catalog";
import { describe, expect, it } from "vitest";

import {
	applyThemePatch,
	dealThemeCards,
	supportsAppTheme,
	themeOfAnswer,
} from "./app-theme-deal";

/** Fixed v4-format UUIDs, so every run checks the same projects. */
const PROJECT_IDS = Array.from(
	{ length: 40 },
	(_, index) => `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
);

/**
 * A theme.json on the look `look`, with the layout of a real deal. The mode is dark, so a case
 * can tell a kept mode from the light mode of most looks.
 */
function themeFileOf(look: AppLookId, origin: AppThemeOrigin): AppThemeFile {
	const [card] = dealThemeCards({
		business: "other",
		projectId: "project-1",
		round: 0,
	});
	return buildAppThemeFile({
		origin,
		selection: {
			...card.selection,
			mode: "dark",
			source: { kind: "look", look },
		},
	});
}

/** The cards of a theme question for business "restaurant" in project-1. */
const RESTAURANT_CARDS = dealThemeCards({
	business: "restaurant",
	projectId: "project-1",
	round: 0,
});

describe("theme deal", () => {
	it.each([
		["web-app@1.0.0", false],
		["web-app@1.1.0", true],
		// A later major counts, also with minor 0.
		["web-app@2.0.0", true],
		["mobile-app@1.1.0", false],
		// The desktop template has theme.json from its first version.
		["desktop-app@1.0.0", true],
		["web-app@1.1", false],
	])("gates the theme features of %s: %s", (templateVersion, expected) => {
		expect(supportsAppTheme(templateVersion)).toBe(expected);
	});

	it("deals the same cards for the same project, and other cards for other projects", () => {
		const firstLooks = new Set<string>();
		for (const projectId of PROJECT_IDS) {
			const cards = dealThemeCards({
				business: "ecommerce",
				projectId,
				round: 0,
			});
			// The answer turn deals again to find the picked card, so a second deal must match.
			expect(
				dealThemeCards({ business: "ecommerce", projectId, round: 0 }),
			).toEqual(cards);
			firstLooks.add(cards[0].look);
		}
		expect(firstLooks.size).toBeGreaterThan(1);
	});

	it.each(
		APP_THEME_CATEGORIES,
	)("deals 3 cards from 3 families, each a look that fits %s when its family has one", (business) => {
		for (const projectId of PROJECT_IDS) {
			const cards = dealThemeCards({ business, projectId, round: 0 });
			const families = cards.map((card) => APP_LOOKS[card.look].family);
			expect(new Set(families).size).toBe(3);
			for (const card of cards) {
				const family = APP_LOOKS[card.look].family;
				const familyFits = APP_LOOK_IDS.some(
					(id) =>
						APP_LOOKS[id].family === family &&
						APP_LOOKS[id].fits.some((category) => category === business),
				);
				expect(
					APP_LOOKS[card.look].fits.some((category) => category === business),
				).toBe(familyFits);
			}
		}
	});

	it.each(APP_LOOK_IDS)("never rerolls the current look %s", (look) => {
		const current = themeFileOf(look, "user");
		for (const projectId of PROJECT_IDS) {
			const next = applyThemePatch({
				current,
				patch: { fields: {}, reroll: true },
				projectId,
			});
			expect(next?.selection.source).not.toEqual({ kind: "look", look });
			// The user chose dark: the new look keeps it.
			expect(next?.selection.mode).toBe("dark");
		}
	});

	it("keeps a theme the user picked when a patch names only a business", () => {
		const patch = {
			business: "restaurant",
			fields: {},
			reroll: false,
		} as const;
		expect(
			applyThemePatch({
				current: themeFileOf("lagon", "user"),
				patch,
				projectId: "project-1",
			}),
		).toBeNull();
		// A host theme is not a choice of the user, so the business deals a new one.
		expect(
			applyThemePatch({
				current: themeFileOf("lagon", "host"),
				patch,
				projectId: "project-1",
			})?.origin,
		).toBe("host");
	});

	it.each<
		[
			string,
			AskUserHostToolOutput["answers"][number]["action"],
			string | null,
			AppThemeOrigin,
			{ look: AppLookId; origin: AppThemeOrigin } | "keep",
		]
	>([
		[
			"a picked card",
			"answered",
			`look:${RESTAURANT_CARDS[1].look}`,
			"user",
			{ look: RESTAURANT_CARDS[1].look, origin: "user" },
		],
		["a skip over a user theme", "dismissed", null, "user", "keep"],
		["typed text over a user theme", "answered", null, "user", "keep"],
		["an id that is not a look", "answered", "look:../theme", "user", "keep"],
		[
			"You choose over a user theme",
			"delegated",
			null,
			"user",
			{ look: RESTAURANT_CARDS[0].look, origin: "host" },
		],
		[
			"a skip over a host theme",
			"dismissed",
			null,
			"host",
			{ look: RESTAURANT_CARDS[0].look, origin: "host" },
		],
	])("answers %s of the theme question", (_label, action, pickedId, currentOrigin, expected) => {
		const effect = themeOfAnswer({
			answer: {
				action,
				selected: pickedId === null ? [] : [{ id: pickedId, label: "Look" }],
			},
			cards: RESTAURANT_CARDS,
			current: themeFileOf("lagon", currentOrigin),
			projectId: "project-1",
		});
		if (expected === "keep") {
			expect(effect.kind).toBe("keep");
			return;
		}
		// A picked card is the card that the tray showed, with the same layout.
		expect(effect).toEqual({
			card: RESTAURANT_CARDS.find((card) => card.look === expected.look),
			kind: "write",
			origin: expected.origin,
		});
	});

	it("moves the user menu to the header when the sidebar is offcanvas and starts collapsed", () => {
		const next = applyThemePatch({
			current: themeFileOf("lagon", "host"),
			patch: {
				fields: {
					sidebarCollapse: "offcanvas",
					sidebarStart: "collapsed",
					userMenu: "sidebar-footer",
				},
				reroll: false,
			},
			projectId: "project-1",
		});
		expect(next?.selection.userMenu).toBe("header");
	});
});
