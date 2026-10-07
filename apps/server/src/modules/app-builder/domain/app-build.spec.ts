import { describe, expect, it } from "vitest";

import { appBuildStatusesThatMayMoveTo } from "./app-build";

describe("appBuildStatusesThatMayMoveTo", () => {
	it("lets only a queued row be claimed", () => {
		expect(appBuildStatusesThatMayMoveTo("building")).toEqual(["queued"]);
	});

	it("lets every live status fail", () => {
		expect(appBuildStatusesThatMayMoveTo("failed")).toEqual([
			"queued",
			"building",
			"uploading",
		]);
	});

	it("blocks only during the build and publishes only after the upload", () => {
		expect(appBuildStatusesThatMayMoveTo("blocked")).toEqual(["building"]);
		expect(appBuildStatusesThatMayMoveTo("published")).toEqual(["uploading"]);
	});

	it("never moves a row back to queued", () => {
		expect(appBuildStatusesThatMayMoveTo("queued")).toEqual([]);
	});
});
