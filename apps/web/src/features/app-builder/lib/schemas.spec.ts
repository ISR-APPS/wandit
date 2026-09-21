import { describe, expect, it } from "vitest";

import { appBuilderSearchSchema } from "./schemas";

describe("appBuilderSearchSchema", () => {
	it("keeps known values", () => {
		expect(
			appBuilderSearchSchema.parse({
				view: "more",
				panel: "payments",
				device: "android",
				viewport: "mobile",
				file: "src/app.tsx",
			}),
		).toEqual({
			view: "more",
			panel: "payments",
			device: "android",
			viewport: "mobile",
			file: "src/app.tsx",
		});
	});

	it("parses the tablet viewport", () => {
		expect(appBuilderSearchSchema.parse({ viewport: "tablet" })).toEqual({
			viewport: "tablet",
		});
	});

	it("drops unknown values instead of throwing", () => {
		const result = appBuilderSearchSchema.parse({
			view: "settings",
			panel: 42,
			device: "windows",
			viewport: "",
			file: "x".repeat(600),
		});
		expect(result.view).toBeUndefined();
		expect(result.panel).toBeUndefined();
		expect(result.device).toBeUndefined();
		expect(result.viewport).toBeUndefined();
		expect(result.file).toBeUndefined();
	});

	it("accepts an empty search", () => {
		expect(appBuilderSearchSchema.parse({})).toEqual({});
	});
});
