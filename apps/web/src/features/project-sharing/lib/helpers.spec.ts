import { describe, expect, it } from "vitest";

import { splitEmails } from "./helpers";

describe("splitEmails", () => {
	it("splits on commas, semicolons, spaces, and new lines, and drops empty parts", () => {
		expect(splitEmails(" a@x.dz, b@x.dz;c@x.dz\n\nd@x.dz  e@x.dz,, ")).toEqual([
			"a@x.dz",
			"b@x.dz",
			"c@x.dz",
			"d@x.dz",
			"e@x.dz",
		]);
	});
});
