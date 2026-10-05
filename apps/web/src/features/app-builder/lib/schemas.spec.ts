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

	it("keeps a Cloud panel id in panel", () => {
		expect(
			appBuilderSearchSchema.parse({ view: "more", panel: "logs" }),
		).toEqual({ view: "more", panel: "logs" });
	});

	it("drops the old Cloud view and its cloudPanel param", () => {
		expect(
			appBuilderSearchSchema.parse({ view: "cloud", cloudPanel: "logs" }),
		).toEqual({});
	});

	// The tablet viewport is gone. An old link must still open the workspace.
	it("drops the old tablet viewport", () => {
		expect(appBuilderSearchSchema.parse({ viewport: "tablet" })).toEqual({});
	});

	it("parses the Secrets Cloud panel", () => {
		expect(appBuilderSearchSchema.parse({ panel: "secrets" })).toEqual({
			panel: "secrets",
		});
	});

	it("drops unknown values instead of throwing", () => {
		const result = appBuilderSearchSchema.parse({
			view: "settings",
			panel: "connectors",
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
