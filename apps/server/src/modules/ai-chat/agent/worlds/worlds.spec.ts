import { describe, expect, it } from "vitest";

import { designWorlds, formatWorldCandidates, getWorld } from "./index";

describe("design worlds library", () => {
	it("every world honors the library contract", () => {
		const ids = designWorlds.map((w) => w.id);
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
		}
	});

	it("getWorld resolves ids case- and whitespace-insensitively", () => {
		const first = designWorlds.at(0);
		if (!first) throw new Error("worlds library is empty");
		expect(getWorld(` ${first.id.toUpperCase()} `)).toBe(first);
		expect(getWorld("no-such-world")).toBeUndefined();
	});

	it("offers both sections with bounded, fitting samples", () => {
		const menu = formatWorldCandidates({
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
	});

	it("never offers a world that excludes the business", () => {
		// Sampling is random — assert the invariant across many draws.
		for (let i = 0; i < 25; i++) {
			const menu = formatWorldCandidates({
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

	it("samples different menus across calls (anti-convergence)", () => {
		const draws = new Set<string>();
		for (let i = 0; i < 10; i++) {
			draws.add(
				formatWorldCandidates({ business: "boutique", industryHints: [] }),
			);
		}
		// 10 draws from a 23-world library colliding into one menu would mean
		// the sampler is not sampling.
		expect(draws.size).toBeGreaterThan(1);
	});
});
