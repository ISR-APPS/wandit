import { describe, expect, it } from "vitest";

import { pickSupabaseRegion } from "./supabase-region";

describe("pickSupabaseRegion", () => {
	it.each(["DE", "nl"])("picks Frankfurt for %s", (countryCode) => {
		expect(pickSupabaseRegion(countryCode)).toBe("eu-central-1");
	});

	it.each(["FR", "MA", "US", "", null])("picks Paris for %s", (countryCode) => {
		expect(pickSupabaseRegion(countryCode)).toBe("eu-west-3");
	});
});
