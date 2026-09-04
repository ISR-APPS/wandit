import { describe, expect, it } from "vitest";

import { canDraftAutostart } from "./autostart-eligibility";

describe("canDraftAutostart", () => {
	it("allows a draft without attachments", () => {
		expect(canDraftAutostart(0)).toBe(true);
	});

	it("refuses any draft that staged attachments", () => {
		expect(canDraftAutostart(1)).toBe(false);
	});
});
