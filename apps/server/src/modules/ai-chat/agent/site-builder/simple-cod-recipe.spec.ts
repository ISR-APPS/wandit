import { afterEach, describe, expect, it, vi } from "vitest";

import { COD_BLOCK_IDS } from "../worlds/cod/blocks";
import {
	SIMPLE_COD_SKELETONS,
	sampleSimpleCodRecipe,
} from "./simple-cod-recipe";

const LEVER_PREFIXES = [
	"- SURFACE:",
	"- ACCENT:",
	"- ARABIC FONT:",
	"- LATIN FONT:",
	"- RADIUS:",
	"- CARDS:",
	"- HERO:",
	"- TRUST STRIP:",
	"- STRUCTURE:",
] as const;

const HERO_LAYOUT_NAMES = [
	"PRICE CARD",
	"RECAP CLOSE",
	"IMAGE FIRST",
	"TRUST EYEBROW",
] as const;

// Numerical Recipes LCG: distribution coverage must not depend on ambient
// Math.random or become flaky under repeated CI runs.
function makeRng(seed: number): () => number {
	let state = seed >>> 0;

	return () => {
		state = (state * 1_664_525 + 1_013_904_223) >>> 0;
		return state / 4_294_967_296;
	};
}

function planFor(name: string): string {
	const skeleton = SIMPLE_COD_SKELETONS.find(
		(candidate) => candidate.name === name,
	);

	expect(skeleton, `Missing skeleton ${name}`).toBeDefined();
	return skeleton?.plan ?? "";
}

afterEach(() => {
	vi.restoreAllMocks();
});

describe("SIMPLE COD skeleton data", () => {
	it("keeps every weighted skeleton inside the permanent block vocabulary", () => {
		const permanentIds = new Set(COD_BLOCK_IDS);
		const names = SIMPLE_COD_SKELETONS.map((skeleton) => skeleton.name);

		expect(new Set(names).size).toBe(names.length);
		expect(
			SIMPLE_COD_SKELETONS.map(({ name, weight }) => [name, weight]),
		).toEqual([
			["classic-funnel", 28],
			["poster-funnel", 20],
			["offer-metronome", 16],
			["technical-catalog", 16],
			["variant-lookbook", 12],
			["proof-minimal", 8],
		]);

		for (const skeleton of SIMPLE_COD_SKELETONS) {
			expect(skeleton.weight, skeleton.name).toBeGreaterThan(0);
			expect(skeleton.blocks[0], skeleton.name).toBe("hero");
			expect(skeleton.blocks, skeleton.name).toContain("order-form");
			expect(skeleton.blocks.length, skeleton.name).toBeGreaterThanOrEqual(4);
			expect(skeleton.blocks.length, skeleton.name).toBeLessThanOrEqual(6);

			for (const block of skeleton.blocks) {
				expect(permanentIds.has(block), `${skeleton.name}: ${block}`).toBe(
					true,
				);
			}
		}
	});

	it("states every fact-gated fallback in the structure plan", () => {
		expect(planFor("classic-funnel")).toContain("fewer than 2 usable photos");
		expect(planFor("classic-funnel")).toContain("how-it-works-steps");

		expect(planFor("poster-funnel")).toContain("weak photos");
		expect(planFor("poster-funnel")).toContain("text-led card");

		expect(planFor("technical-catalog")).toContain("no annotatable parts");
		expect(planFor("technical-catalog")).toContain("spec-table");
		expect(planFor("technical-catalog")).toContain("how-it-works-steps");

		expect(planFor("variant-lookbook")).toContain("fewer than 3");
		expect(planFor("variant-lookbook")).toContain("unboxing-gallery");

		expect(planFor("proof-minimal")).toContain("benefits-icons");
		expect(planFor("proof-minimal")).toContain("faq BEFORE the form");
	});
});

describe("sampleSimpleCodRecipe", () => {
	it("renders exactly one line for every sampled lever", () => {
		const lines = sampleSimpleCodRecipe().split("\n");

		for (const prefix of LEVER_PREFIXES) {
			expect(
				lines.filter((line) => line.startsWith(prefix)),
				prefix,
			).toHaveLength(1);
		}
	});

	it("can reach every skeleton and hero order", () => {
		vi.spyOn(Math, "random").mockImplementation(makeRng(2_026));
		const sampledSkeletons = new Set<string>();
		const sampledHeroLayouts = new Set<string>();

		for (let sample = 0; sample < 600; sample++) {
			const recipe = sampleSimpleCodRecipe();
			const structureLine = recipe
				.split("\n")
				.find((line) => line.startsWith("- STRUCTURE: "));
			const heroLine = recipe
				.split("\n")
				.find((line) => line.startsWith("- HERO: "));

			expect(structureLine).toBeDefined();
			expect(heroLine).toBeDefined();
			sampledSkeletons.add(structureLine?.slice("- STRUCTURE: ".length) ?? "");

			for (const layout of HERO_LAYOUT_NAMES) {
				if (heroLine?.startsWith(`- HERO: ${layout} —`)) {
					sampledHeroLayouts.add(layout);
				}
			}
		}

		expect([...sampledSkeletons].sort()).toEqual(
			SIMPLE_COD_SKELETONS.map((skeleton) => skeleton.name).sort(),
		);
		expect([...sampledHeroLayouts].sort()).toEqual(
			[...HERO_LAYOUT_NAMES].sort(),
		);
	});
});
