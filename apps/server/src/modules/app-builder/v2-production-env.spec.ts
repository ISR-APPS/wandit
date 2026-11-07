import { closeV2BuilderInProduction } from "@wandit/env/server";
import { describe, expect, it } from "vitest";

describe("closeV2BuilderInProduction", () => {
	// V2 stays closed and the backend limit stays on on Railway production,
	// even when Railway sets both switches to true.
	it.each([
		{ railwayEnvironment: "production", expected: false },
		{ railwayEnvironment: "staging", expected: true },
		{ railwayEnvironment: undefined, expected: true },
	])("answers $expected on the Railway environment $railwayEnvironment", ({
		railwayEnvironment,
		expected,
	}) => {
		const values = closeV2BuilderInProduction({
			BACKEND_LIMIT_OFF: true,
			RAILWAY_ENVIRONMENT_NAME: railwayEnvironment,
			V2_BUILDER_ENABLED: true,
		});
		expect(values.V2_BUILDER_ENABLED).toBe(expected);
		expect(values.BACKEND_LIMIT_OFF).toBe(expected);
	});
});
