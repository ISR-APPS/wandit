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

/** The `key=id|id` pairs of one recipe sentence, in sentence order. The skill reads the sentence this way. */
function recipePairsOf(sentence: string): [string, string[]][] {
	return [...sentence.matchAll(/(?<key>[a-z-]+)=(?<ids>[a-z0-9|-]+)/g)].flatMap(
		(pair) => {
			const key = pair.groups?.key;
			const ids = pair.groups?.ids;
			return key === undefined || ids === undefined
				? []
				: [[key, ids.split("|")]];
		},
	);
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

	it("gives 3 homes, spreads the picks, and reaches every option", () => {
		const projectIds = fixedProjectIds(3_000);
		// First id of each axis -> number of projects that get it first.
		const firstPickCounts = new Map<string, Map<string, number>>();

		for (const projectId of projectIds) {
			const sentence = appRecipeInstruction(projectId);
			// The prompt cache needs the same sentence for the same project on every turn.
			expect(appRecipeInstruction(projectId)).toBe(sentence);
			const pairs = recipePairsOf(sentence);
			expect(pairs.map(([key]) => key)).toEqual(
				Object.keys(APP_RECIPE_OPTIONS),
			);
			for (const [key, ids] of pairs) {
				if (key === "home") {
					expect(new Set(ids).size).toBe(3);
				}
				const firstId = ids[0] ?? "";
				const counts = firstPickCounts.get(key) ?? new Map<string, number>();
				counts.set(firstId, (counts.get(firstId) ?? 0) + 1);
				firstPickCounts.set(key, counts);
			}
		}

		for (const [axis, optionIds] of Object.entries(APP_RECIPE_OPTIONS)) {
			// Every id must get first picks, so this check also proves that every option is reached.
			// A uniform hash gives each option about 1/n of the first picks. Half to 1.5 times
			// that share is more than 6 standard deviations wide, so only a skewed hash fails.
			const fairShare = projectIds.length / optionIds.length;
			for (const id of optionIds) {
				const count = firstPickCounts.get(axis)?.get(id) ?? 0;
				expect(count, `${axis}=${id}`).toBeGreaterThan(fairShare * 0.5);
				expect(count, `${axis}=${id}`).toBeLessThan(fairShare * 1.5);
			}
		}
	});
});
