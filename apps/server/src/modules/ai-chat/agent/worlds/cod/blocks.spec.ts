import { describe, expect, it } from "vitest";

import { COD_BLOCK_IDS, COD_BLOCKS } from "./blocks";

describe("COD block vocabulary", () => {
	it("keeps the permanent 30-block API complete and unique", () => {
		expect(COD_BLOCKS).toHaveLength(30);
		expect(COD_BLOCK_IDS).toHaveLength(30);
		expect(new Set(COD_BLOCK_IDS).size).toBe(COD_BLOCK_IDS.length);

		for (const id of COD_BLOCK_IDS) {
			expect(id).toMatch(/^[a-z]+(?:-[a-z]+)*$/u);
		}
		for (const block of COD_BLOCKS) {
			expect(block.description).toContain("\nTypical content:");
		}
	});

	it("keeps exactly three mandatory spine blocks", () => {
		expect(COD_BLOCKS.filter((block) => block.category === "spine")).toEqual([
			expect.objectContaining({ id: "hero" }),
			expect.objectContaining({ id: "order-form" }),
			expect.objectContaining({ id: "sticky-cta" }),
		]);
	});
});
