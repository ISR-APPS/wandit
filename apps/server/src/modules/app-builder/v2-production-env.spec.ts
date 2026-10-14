import { closeV2BuilderInProduction } from "@wandit/env/server";
import { describe, expect, it } from "vitest";

describe("closeV2BuilderInProduction", () => {
	// V2 stays closed on Railway production, even when Railway sets V2_BUILDER_ENABLED=true.
	it.each([
		{ railwayEnvironment: "production", expected: false },
		{ railwayEnvironment: "staging", expected: true },
		{ railwayEnvironment: undefined, expected: true },
	])("answers $expected on the Railway environment $railwayEnvironment", ({
		railwayEnvironment,
		expected,
	}) => {
		expect(
			closeV2BuilderInProduction({
				RAILWAY_ENVIRONMENT_NAME: railwayEnvironment,
				V2_BUILDER_ENABLED: true,
			}).V2_BUILDER_ENABLED,
		).toBe(expected);
	});
});
