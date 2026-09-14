import { describe, expect, it } from "vitest";

import { tokenizeLine } from "./code-highlight";

describe("tokenizeLine", () => {
	it("makes one comment token of a comment line", () => {
		expect(tokenizeLine("// Chargily handles CIB and Edahabia cards")).toEqual([
			{ kind: "comment", text: "// Chargily handles CIB and Edahabia cards" },
		]);
	});

	it("keeps a string whole when it holds a comment marker, and tags const", () => {
		expect(tokenizeLine("const x = 'a // b'")).toEqual([
			{ kind: "keyword", text: "const" },
			{ kind: "plain", text: " x = " },
			{ kind: "string", text: "'a // b'" },
		]);
	});

	it("yields a number token for digits", () => {
		expect(tokenizeLine("amount: 2500,")).toEqual([
			{ kind: "plain", text: "amount: " },
			{ kind: "number", text: "2500" },
			{ kind: "plain", text: "," },
		]);
	});

	it("keeps digits inside a word plain", () => {
		expect(tokenizeLine("sha256()")).toEqual([
			{ kind: "plain", text: "sha256()" },
		]);
	});

	it("yields nothing for an empty line", () => {
		expect(tokenizeLine("")).toEqual([]);
	});
});
