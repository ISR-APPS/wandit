import { describe, expect, it } from "vitest";

import { parseNumstat } from "./git-numstat";

describe("parseNumstat", () => {
	it("parses added, removed, and unchanged counts per file", () => {
		const output = "10\t2\tsrc/routes/index.tsx\n1\t1\tpackage.json\n";

		expect(parseNumstat(output)).toEqual([
			{ path: "src/routes/index.tsx", insertions: 10, deletions: 2 },
			{ path: "package.json", insertions: 1, deletions: 1 },
		]);
	});

	it("stores 0 and 0 for a binary file line", () => {
		const output = "-\t-\tpublic/logo.png\n";

		expect(parseNumstat(output)).toEqual([
			{ path: "public/logo.png", insertions: 0, deletions: 0 },
		]);
	});

	it("keeps the rename marker inside the path", () => {
		const output = "3\t0\t{old.ts => new.ts}\n";

		expect(parseNumstat(output)).toEqual([
			{ path: "{old.ts => new.ts}", insertions: 3, deletions: 0 },
		]);
	});

	it("returns an empty list on empty output and skips malformed lines", () => {
		expect(parseNumstat("")).toEqual([]);
		expect(parseNumstat("\n\nnot-a-numstat-line\n")).toEqual([]);
	});
});
