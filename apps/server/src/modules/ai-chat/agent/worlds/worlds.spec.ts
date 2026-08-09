import { readdirSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { designWorlds, formatWorldCandidates, getWorld } from "./index";

const PREVIEW_KEYS = ["accent", "fontFamily", "ground", "ink", "sampleWord"];

/** World files in a directory, by convention filename === world.id. */
function worldFileIds(dirUrl: URL, infraFiles: string[]): string[] {
	return readdirSync(dirUrl)
		.filter(
			(name) =>
				name.endsWith(".ts") &&
				!name.endsWith(".spec.ts") &&
				!infraFiles.includes(name),
		)
		.map((name) => name.replace(/\.ts$/u, ""))
		.sort();
}

describe("design worlds library", () => {
	it("every world honors the library contract", () => {
		const ids = designWorlds.map((w) => w.id);
		expect(designWorlds).toHaveLength(127);
		expect(new Set(ids).size).toBe(ids.length);

		for (const world of designWorlds) {
			// ids are lookup keys typed by the Brain — keep them url-ish.
			expect(world.id).toMatch(/^[a-z][a-z0-9-]*$/u);
			// A world is a bible, not a blurb: shallow docs regress to the
			// fragment-sampling era this library exists to end.
			expect(world.doc.length).toBeGreaterThan(3000);
			expect(world.tagline.length).toBeGreaterThan(40);
			expect(world.mood.length).toBeGreaterThanOrEqual(3);
			expect(world.name.length).toBeGreaterThan(1);
			// Every world must be card-capable (taste cards render from the
			// preview) and family-tagged (menu diversity + 3-family card rule).
			expect(world.family, `${world.id} has no family`).toMatch(
				/^[a-z][a-z0-9-]*$/u,
			);
			expect(
				Object.keys(world.preview ?? {}).sort(),
				`${world.id} preview shape`,
			).toEqual(PREVIEW_KEYS);
			if (world.kind !== "cod") {
				expect(world.doc).toContain("var(--radius)");
			}
		}
	});

	it("registers every non-cod world file in the barrel", () => {
		// The cod barrel has had this guard from day one; the top level did
		// not, which is how matiere.ts shipped unregistered for weeks.
		const fileIds = [
			...worldFileIds(new URL(".", import.meta.url), ["index.ts", "types.ts"]),
			...worldFileIds(new URL("landing/", import.meta.url), ["index.ts"]),
		].sort();
		const registeredIds = designWorlds
			.filter((world) => world.kind !== "cod")
			.map((world) => world.id)
			.sort();
		expect(registeredIds).toEqual(fileIds);
	});

	it("getWorld resolves ids case- and whitespace-insensitively", () => {
		const first = designWorlds.at(0);
		if (!first) throw new Error("worlds library is empty");
		expect(getWorld(` ${first.id.toUpperCase()} `)).toBe(first);
		expect(getWorld("no-such-world")).toBeUndefined();
	});

	it("does not call the primary hue accent when --accent is a ground token", () => {
		for (const [id, primaryPole] of [
			["nocturne", "AMBER"],
			["cargo", "TAPE"],
		] as const) {
			const world = getWorld(id);

			expect(world).toBeDefined();
			expect(world?.doc).toContain(`${primaryPole}→--primary`);
			expect(world?.doc).toContain("→--accent");
			expect(world?.doc.replaceAll("--accent", "")).not.toMatch(/\baccent\b/iu);
		}
	});

	it("keeps the repaired world radius laws internally consistent", () => {
		const palestre = getWorld("palestre")?.doc ?? "";
		const cargo = getWorld("cargo")?.doc ?? "";
		const forge = getWorld("forge")?.doc ?? "";
		const beton = getWorld("beton")?.doc ?? "";

		expect(palestre).toContain(
			"every action slab and chip consumes var(--radius) directly",
		);
		expect(palestre).not.toContain("nothing is rounded");
		expect(palestre).not.toContain("a 999px accent dot");
		expect(cargo).toContain(
			"var(--radius) on every CTA slab, size pill and chip",
		);
		expect(cargo).not.toContain("a 999px var(--primary) dot");
		expect(forge).toContain(
			"buttons, CTAs, chips and steppers consume var(--radius) directly",
		);
		expect(forge).toContain(
			"every other rectangle uses min(var(--radius), 0px)",
		);
		expect(beton).toContain("only curved exception is the true circular seal");
		expect(beton).not.toContain("two stamp pills");
	});

	it("offers both sections with bounded, fitting samples", () => {
		const { candidates: menu, cards } = formatWorldCandidates({
			business: "cabinet dentaire",
			industryHints: ["medical", "dental", "clinic"],
		});

		expect(menu).toContain("WEBSITE WORLDS");
		expect(menu).toContain("PRODUCT-PAGE WORLDS");
		// 6 per section max — the menu must stay a menu, not a catalog dump.
		const entries = menu.split("\n").filter((l) => l.startsWith("- "));
		expect(entries.length).toBeLessThanOrEqual(12);
		expect(entries.length).toBeGreaterThanOrEqual(4);
		// Medical hints must surface at least one strong industry fit.
		expect(menu).toContain("STRONG FIT");
		// Every sampled world ships a card face — the taste question renders
		// specimen cards from these, so menu ids and card ids must agree
		// (cards dedupe kind "both" worlds sampled into both sections).
		const menuIds = new Set(
			entries.map((line) => line.slice(2).split(" — ")[0] ?? ""),
		);
		expect(new Set(cards.map((card) => card.id))).toEqual(menuIds);
		expect(new Set(cards.map((card) => card.id)).size).toBe(cards.length);
		for (const card of cards) {
			expect(Object.keys(card.preview).sort()).toEqual(PREVIEW_KEYS);
			expect(card.name.length).toBeGreaterThan(1);
			expect(card.tagline.length).toBeGreaterThan(40);
		}
	});

	it("never offers a world that excludes the business", () => {
		// Sampling is random — assert the invariant across many draws.
		for (let i = 0; i < 25; i++) {
			const { candidates: menu } = formatWorldCandidates({
				business: "cabinet d'avocats",
				industryHints: ["law", "legal"],
			});
			for (const world of designWorlds) {
				if (world.avoidFor?.some((tag) => tag === "law")) {
					expect(menu).not.toContain(`- ${world.id} — `);
				}
			}
		}
	});

	it("never seats two worlds of the same family in one website menu", () => {
		// Sibling designs (two dark-luxury worlds, two hand-craft worlds)
		// would waste menu range on near-neighbors. Sampling is random —
		// assert the invariant across many draws.
		for (let i = 0; i < 25; i++) {
			const { candidates: menu } = formatWorldCandidates({
				business: "boutique",
				industryHints: [],
				pageKind: "website",
			});
			const websiteSection = menu.split("PRODUCT-PAGE WORLDS")[0] ?? "";
			const families = websiteSection
				.split("\n")
				.filter((line) => line.startsWith("- "))
				.map((line) => line.slice(2).split(" — ")[0] ?? "")
				.map((id) => getWorld(id)?.family)
				.filter((family): family is string => Boolean(family));
			expect(new Set(families).size).toBe(families.length);
		}
	});

	it("samples different menus across calls (anti-convergence)", () => {
		const draws = new Set<string>();
		for (let i = 0; i < 10; i++) {
			draws.add(
				formatWorldCandidates({ business: "boutique", industryHints: [] })
					.candidates,
			);
		}
		// 10 draws from a 127-world library colliding into one menu would mean
		// the sampler is not sampling.
		expect(draws.size).toBeGreaterThan(1);
	});
});
