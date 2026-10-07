import { describe, expect, it } from "vitest";

import {
	APP_RECIPE_OPTIONS,
	appRecipeInstruction,
	rankOptions,
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
	for (const pair of sentence.matchAll(
		/(?<axis>[a-z]+)=(?<ids>[a-z0-9|-]+)/g,
	)) {
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

	it("offers 3 styles and 3 homes, spreads the first picks, and reaches every option", () => {
		const projectIds = fixedProjectIds(3_000);
		const seen = new Map<string, Set<string>>();
		// First id of each axis -> number of projects that get it first.
		const firstPickCounts = new Map<string, Map<string, number>>();
		let darkCount = 0;

		for (const projectId of projectIds) {
			const recipe = recipeOf(appRecipeInstruction(projectId));
			const styles = recipe.get("style") ?? [];
			const homes = recipe.get("home") ?? [];
			expect(new Set(styles).size).toBe(3);
			expect(new Set(homes).size).toBe(3);
			if (recipe.get("mode")?.join("|") === "dark") {
				darkCount += 1;
			}
			for (const [axis, ids] of recipe) {
				const seenIds = seen.get(axis) ?? new Set<string>();
				for (const id of ids) {
					seenIds.add(id);
				}
				seen.set(axis, seenIds);
				const firstId = ids[0] ?? "";
				const counts = firstPickCounts.get(axis) ?? new Map<string, number>();
				counts.set(firstId, (counts.get(firstId) ?? 0) + 1);
				firstPickCounts.set(axis, counts);
			}
		}

		// The sentence names every axis once, in the order of APP_RECIPE_OPTIONS.
		expect([...seen.keys()]).toEqual(Object.keys(APP_RECIPE_OPTIONS));
		// Equal sets: every id appears at least once, and no unknown id appears.
		for (const [axis, optionIds] of Object.entries(APP_RECIPE_OPTIONS)) {
			expect(seen.get(axis), axis).toEqual(new Set(optionIds));
		}
		// A uniform hash gives each option about 1/n of the first picks. Half to 1.5 times
		// that share is more than 6 standard deviations wide, so only a skewed hash fails.
		for (const [axis, optionIds] of Object.entries(APP_RECIPE_OPTIONS)) {
			// Mode uses a 30 % dark bucket, not a uniform pick. The dark share check below covers it.
			if (axis === "mode") {
				continue;
			}
			const fairShare = projectIds.length / optionIds.length;
			for (const id of optionIds) {
				const count = firstPickCounts.get(axis)?.get(id) ?? 0;
				expect(count, `${axis}=${id}`).toBeGreaterThan(fairShare * 0.5);
				expect(count, `${axis}=${id}`).toBeLessThan(fairShare * 1.5);
			}
		}
		expect(darkCount / projectIds.length).toBeGreaterThanOrEqual(0.2);
		expect(darkCount / projectIds.length).toBeLessThanOrEqual(0.4);
	});
});
