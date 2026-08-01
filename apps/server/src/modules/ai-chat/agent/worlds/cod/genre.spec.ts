import { describe, expect, it } from "vitest";

import { COD_BLOCK_IDS } from "./blocks";
import { COD_GENRE_DOC } from "./genre";

describe("COD genre layer", () => {
	it("carries the complete block vocabulary and token bridge", () => {
		expect(COD_GENRE_DOC.length).toBeGreaterThan(3000);
		expect(COD_GENRE_DOC).toContain("var(--radius)");

		for (const id of COD_BLOCK_IDS) {
			expect(COD_GENRE_DOC).toContain(id);
		}
	});

	it("emits plain prompt prose without template-literal syntax", () => {
		expect(COD_GENRE_DOC).not.toContain("`");
		expect(COD_GENRE_DOC).not.toContain("${");
	});
});
