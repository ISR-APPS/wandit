import { describe, expect, it } from "vitest";

import {
	formatAffiliateMoney,
	formatNullableAffiliateMoney,
} from "./formatters";

describe("affiliate money formatters", () => {
	it("renders nullable cents as an em dash without hiding zero", () => {
		expect(formatNullableAffiliateMoney(null, "usd")).toBe("—");
		expect(formatNullableAffiliateMoney(0, "usd")).toBe("$0");
	});

	it("preserves fractional cents-based USD values", () => {
		expect(formatAffiliateMoney(49, "usd")).toBe("$0.49");
		expect(formatNullableAffiliateMoney(49, "usd")).toBe("$0.49");
	});
});
