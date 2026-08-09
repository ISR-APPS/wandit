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

// Test-side mirror of the sampler's fuzzy matcher (accent-fold + two-way
// includes). Duplicated on purpose: if the sampler's matching contract drifts,
// the affinity tests below break loudly instead of drifting with it.
function fold(s: string): string {
	return s
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.toLowerCase()
		.replace(/[^a-z0-9]/g, "");
}

function matchesHint(tags: string[] | undefined, hints: string[]): boolean {
	const t = (tags ?? []).map(fold).filter(Boolean);
	const h = hints.map(fold).filter(Boolean);
	return t.some((tag) =>
		h.some((hint) => tag.includes(hint) || hint.includes(tag)),
	);
}

describe("design library data", () => {
	it("keeps espresso-bronze's bg a clean hex (regression: trailing-comma string)", () => {
		const espresso = palettes.find((p) => p.id === "espresso-bronze");

		expect(espresso?.roles.bg).toBe("#14100C");
	});
});

describe("sampleCandidates", () => {
	it("samples the fixed menu sizes: 10 palettes, 10 pairings, 3 skeletons, 12 layout moves, 8 interactions, 4 motions, 3 finishes", () => {
		const candidates = sampleCandidates({
			business: "candles",
			rng: makeRng(7),
		});

		expect(candidates.palettes).toHaveLength(10);
		expect(candidates.fontPairings).toHaveLength(10);
		expect(candidates.skeletons).toHaveLength(3);
		expect(candidates.layoutMoves).toHaveLength(12);
		expect(candidates.interactions).toHaveLength(8);
		expect(candidates.motions).toHaveLength(4);
		expect(candidates.finishes).toHaveLength(3);
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

	it("accent-folds the business before avoidFor matching (clinique médicale)", () => {
		for (let seed = 0; seed < 200; seed++) {
			const candidates = sampleCandidates({
				business: "Clinique médicale à Alger",
				rng: makeRng(seed),
			});

			expect(candidates.palettes.map((p) => p.id)).not.toContain("noir-acide");
		}
	});

	it("accent-folds industryHints before avoidFor matching (médical → medical)", () => {
		// The business text itself is innocent — only the accented hint carries
		// the industry. Without accent folding, "médical" folds to nothing that
		// matches "medical" and the guarded entries would leak through.
		for (let seed = 0; seed < 200; seed++) {
			const candidates = sampleCandidates({
				business: "candles",
				industryHints: ["médical"],
				rng: makeRng(seed),
			});

			expect(candidates.palettes.map((p) => p.id)).not.toContain("noir-acide");
		}
	});

	it("ignores hints that fold to nothing (Arabic script must not match everything)", () => {
		// norm() strips non-Latin entirely, so an Arabic hint folds to "".
		// Unguarded, "".includes / .includes("") matches EVERY avoidFor tag and
		// every guarded entry vanishes. With the guard, noir-acide stays
		// sampleable and must appear at least once across many seeds.
		let sawNoirAcide = false;
		for (let seed = 0; seed < 200 && !sawNoirAcide; seed++) {
			const candidates = sampleCandidates({
				business: "candles",
				industryHints: ["مطعم"],
				rng: makeRng(seed),
			});
			sawNoirAcide = candidates.palettes.some((p) => p.id === "noir-acide");
		}

		expect(sawNoirAcide).toBe(true);
	});

	it("guarantees ~40% of the palette menu fits the industry hints", () => {
		const hints = ["restaurant"];
		const affineCount = palettes.filter((p) =>
			matchesHint(p.industries, hints),
		).length;
		// The library must actually carry restaurant-tagged palettes for the
		// guarantee to mean anything.
		expect(affineCount).toBeGreaterThan(0);
		const guaranteed = Math.min(Math.ceil(10 * 0.4), affineCount);

		for (let seed = 0; seed < 50; seed++) {
			const candidates = sampleCandidates({
				business: "bistro oriental",
				industryHints: hints,
				rng: makeRng(seed),
			});

			const affineInSample = candidates.palettes.filter((p) =>
				matchesHint(p.industries, hints),
			).length;
			expect(affineInSample).toBeGreaterThanOrEqual(guaranteed);
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
