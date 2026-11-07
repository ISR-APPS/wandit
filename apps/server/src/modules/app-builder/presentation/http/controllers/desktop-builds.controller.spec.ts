import { describe, expect, it } from "vitest";

import { PROJECT_ROLE_KEY } from "../../../../projects";
import { DesktopBuildsController } from "./desktop-builds.controller";

describe("DesktopBuildsController route metadata", () => {
	// A Can view member must not spend credits, ship the app, or see unreleased downloads.
	it("needs the editor role on the whole controller", () => {
		expect(
			Reflect.getMetadata(PROJECT_ROLE_KEY, DesktopBuildsController),
		).toEqual({ anyEngine: false, role: "editor" });
	});
});
