import { describe, expect, it } from "vitest";

import { formatCandidates, palettes, sampleCandidates } from "./directions";

// Deterministic LCG (numerical-recipes constants): the sampler only needs a
// () => number in [0, 1), and these tests must never flake on Math.random.
function makeRng(seed: number): () => number {
	let state = seed >>> 0;
	return () => {
		state = (state * 1_664_525 + 1_013_904_223) >>> 0;
		return state / 4_294_967_296;
	};
}

describe("design library data", () => {
	it("keeps espresso-bronze's bg a clean hex (regression: trailing-comma string)", () => {
		const espresso = palettes.find((p) => p.id === "espresso-bronze");

		expect(espresso?.roles.bg).toBe("#14100C");
	});
});

describe("sampleCandidates", () => {
	it("samples the fixed menu sizes: 5 palettes, 5 pairings, 4 skeletons, 5 interactions, 4 motions", () => {
		const candidates = sampleCandidates({
			business: "candles",
			rng: makeRng(7),
		});

		expect(candidates.palettes).toHaveLength(5);
		expect(candidates.fontPairings).toHaveLength(5);
		expect(candidates.skeletons).toHaveLength(4);
		expect(candidates.interactions).toHaveLength(5);
		expect(candidates.motions).toHaveLength(4);
	});

	it("never offers an entry whose avoidFor matches the business", () => {
		// "medical" is on the avoidFor list of the noir-acide palette and the
		// tanker-general / melodrama-switzer pairings — across many seeds none
		// of them may ever surface for a medical business.
		for (let seed = 0; seed < 200; seed++) {
			const candidates = sampleCandidates({
				business: "Medical clinic in Algiers",
				rng: makeRng(seed),
			});

			expect(candidates.palettes.map((p) => p.id)).not.toContain("noir-acide");
			const pairingIds = candidates.fontPairings.map((f) => f.id);
			expect(pairingIds).not.toContain("tanker-general");
			expect(pairingIds).not.toContain("melodrama-switzer");
		}
	});

	it("excludes cooled-down ids, whatever the shuffle order", () => {
		// Cool down everything except five known palettes: the sample must be
		// exactly those five, so no cooled-down id can ever leak through.
		const keepIds = palettes.slice(0, 5).map((p) => p.id);
		const cooldownIds = new Set(palettes.slice(5).map((p) => p.id));

		for (let seed = 0; seed < 50; seed++) {
			const candidates = sampleCandidates({
				business: "candles",
				cooldownIds,
				rng: makeRng(seed),
			});

			expect(candidates.palettes.map((p) => p.id).sort()).toEqual(
				[...keepIds].sort(),
			);
		}
	});
});

describe("formatCandidates", () => {
	it("prints every sampled palette's hex roles", () => {
		const candidates = sampleCandidates({
			business: "candles",
			rng: makeRng(3),
		});

		const text = formatCandidates(candidates);

		for (const palette of candidates.palettes) {
			expect(text).toContain(`bg ${palette.roles.bg}`);
			expect(text).toContain(`surface ${palette.roles.surface}`);
			expect(text).toContain(`ink ${palette.roles.ink}`);
			expect(text).toContain(`accent ${palette.roles.accent}`);
		}
		expect(text).toMatch(/bg #[0-9A-F]{6}/);
	});
});
