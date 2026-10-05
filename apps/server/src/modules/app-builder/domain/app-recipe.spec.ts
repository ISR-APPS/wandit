import { describe, expect, it } from "vitest";

import {
	APP_RECIPE_OPTIONS,
	appRecipeInstruction,
	rankOptions,
	THEME_FAMILIES,
} from "./app-recipe";

/** Fixed v4-format UUIDs, so every run checks the same projects. */
function fixedProjectIds(count: number): string[] {
	return Array.from(
		{ length: count },
		(_, index) => `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
	);
}

/** Reads the `axis=id|id` pairs of one recipe sentence. */
function recipeOf(sentence: string): Map<string, string[]> {
	const recipe = new Map<string, string[]>();
	for (const pair of sentence.matchAll(/(?<axis>[a-z]+)=(?<ids>[a-z|-]+)/g)) {
		const axis = pair.groups?.axis;
		const ids = pair.groups?.ids;
		if (axis !== undefined && ids !== undefined) {
			recipe.set(axis, ids.split("|"));
		}
	}
	return recipe;
}

describe("app recipe", () => {
	it("moves a project only to the new option when an axis gets one more option", () => {
		const changedPicks = fixedProjectIds(1_000).flatMap((projectId) => {
			const before = rankOptions(projectId, "kpi", APP_RECIPE_OPTIONS.kpi)[0];
			const after = rankOptions(projectId, "kpi", [
				...APP_RECIPE_OPTIONS.kpi,
				"new",
			])[0];
			return after === before ? [] : [after];
		});

		// One set holds both facts: some picks change, and every change goes to "new".
		expect(new Set(changedPicks)).toEqual(new Set(["new"]));
	});

	it("offers 3 themes of 3 families and reaches every option", () => {
		const projectIds = fixedProjectIds(3_000);
		const familyOf = new Map<string, string>(Object.entries(THEME_FAMILIES));
		const seen = new Map<string, Set<string>>();
		let darkCount = 0;

		for (const projectId of projectIds) {
			const recipe = recipeOf(appRecipeInstruction(projectId));
			const themes = recipe.get("theme") ?? [];
			const homes = recipe.get("home") ?? [];
			const mode = recipe.get("mode")?.join("|");
			const sidebar = recipe.get("sidebar")?.join("|");
			expect(themes).toHaveLength(3);
			expect(new Set(themes.map((theme) => familyOf.get(theme))).size).toBe(3);
			expect(homes).toHaveLength(3);
			expect(new Set(homes).size).toBe(3);
			expect(`mode=${mode} sidebar=${sidebar}`).not.toBe(
				"mode=dark sidebar=inverse",
			);
			if (mode === "dark") {
				darkCount += 1;
			}
			for (const [axis, ids] of recipe) {
				const seenIds = seen.get(axis) ?? new Set<string>();
				for (const id of ids) {
					seenIds.add(id);
				}
				seen.set(axis, seenIds);
			}
		}

		// The sentence names every axis once, in the order of APP_RECIPE_OPTIONS.
		expect([...seen.keys()]).toEqual(Object.keys(APP_RECIPE_OPTIONS));
		// Equal sets: every id appears at least once, and no unknown id appears.
		for (const [axis, optionIds] of Object.entries(APP_RECIPE_OPTIONS)) {
			expect(seen.get(axis), axis).toEqual(new Set(optionIds));
		}
		expect(darkCount / projectIds.length).toBeGreaterThanOrEqual(0.2);
		expect(darkCount / projectIds.length).toBeLessThanOrEqual(0.4);
	});
});
