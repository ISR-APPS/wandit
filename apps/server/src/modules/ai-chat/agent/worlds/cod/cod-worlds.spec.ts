import { readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { formatWorldCandidates, getWorld } from "..";
import { codWorlds } from ".";

const PREVIEW_KEYS = ["accent", "fontFamily", "ground", "ink", "sampleWord"];

function listedIds(menu: string): string[] {
	return menu
		.split("\n")
		.filter((line) => line.startsWith("- "))
		.map((line) => line.slice(2, line.indexOf(" —")));
}

function worldsFuse(leftId: string, rightId: string): boolean {
	const left = getWorld(leftId);
	const right = getWorld(rightId);
	return (
		left?.fusesWith?.includes(rightId) === true ||
		right?.fusesWith?.includes(leftId) === true
	);
}

describe("COD worlds library", () => {
	it("registers every one of the 46 COD world files in the barrel", () => {
		const sourceFiles = readdirSync(new URL(".", import.meta.url))
			.filter(
				(name) =>
					name.endsWith(".ts") &&
					!name.endsWith(".spec.ts") &&
					!["blocks.ts", "genre.ts", "index.ts"].includes(name),
			)
			.map((name) => name.replace(/\.ts$/u, ""))
			.sort();
		const registeredIds = codWorlds.map((world) => world.id).sort();

		expect(codWorlds).toHaveLength(46);
		expect(registeredIds).toEqual(sourceFiles);
	});

	it("keeps fusion metadata complete and internally resolvable", () => {
		for (const world of codWorlds) {
			expect(world.kind).toBe("cod");
			expect(world.family?.length).toBeGreaterThan(0);
			expect(Object.keys(world.preview ?? {}).sort()).toEqual(PREVIEW_KEYS);
			expect(world.fusesWith?.length).toBeGreaterThan(0);

			for (const targetId of world.fusesWith ?? []) {
				const target = getWorld(targetId);
				expect(
					target,
					`${world.id} references unknown ${targetId}`,
				).toBeDefined();
				expect(target?.kind).toBe("cod");
			}
		}
	});

	it("samples an eight-world COD fusion menu whose ids resolve", () => {
		const { candidates: menu, cards } = formatWorldCandidates({
			business: "home appliance",
			industryHints: ["home & kitchen", "electronics & gadgets"],
			pageKind: "cod",
		});
		const ids = listedIds(menu);

		expect(menu).toContain("## COD FUNNEL WORLDS");
		expect(menu).toContain("Pick ONE BASE + 2-3 DONORS");
		expect(ids).toHaveLength(8);
		for (const id of ids) expect(getWorld(id)?.kind).toBe("cod");

		const hasFusablePair = ids.some((leftId, leftIndex) =>
			ids.slice(leftIndex + 1).some((rightId) => worldsFuse(leftId, rightId)),
		);
		expect(hasFusablePair).toBe(true);

		// Every COD world ships a preview, so every sampled world has a card
		// face for the taste question — same ids as the menu text.
		expect(cards.map((card) => card.id).sort()).toEqual([...ids].sort());
		for (const card of cards) {
			expect(Object.keys(card.preview).sort()).toEqual(PREVIEW_KEYS);
		}
	});

	it("prints each sampled world's family so the Brain can card 3 families", () => {
		const { candidates: menu } = formatWorldCandidates({
			business: "home appliance",
			industryHints: [],
			pageKind: "cod",
		});
		for (const id of listedIds(menu)) {
			expect(menu).toContain(`· family: ${getWorld(id)?.family}`);
		}
	});

	it("honors avoidFor exclusions across repeated hinted draws", () => {
		const hint = "beauty & cosmetics";
		const excluded = codWorlds.filter((world) =>
			world.avoidFor?.includes(hint),
		);
		expect(excluded.length).toBeGreaterThan(0);

		for (let draw = 0; draw < 25; draw++) {
			const { candidates: menu } = formatWorldCandidates({
				business: "beauty product",
				industryHints: [hint],
				pageKind: "cod",
			});
			for (const world of excluded) {
				expect(menu).not.toContain(`- ${world.id} — `);
			}
		}
	});

	it("samples different COD menus across calls", () => {
		const draws = new Set<string>();
		for (let draw = 0; draw < 10; draw++) {
			draws.add(
				formatWorldCandidates({
					business: "fitness accessory",
					industryHints: ["fitness equipment"],
					pageKind: "cod",
				}).candidates,
			);
		}
		expect(draws.size).toBeGreaterThan(1);
	});
});
